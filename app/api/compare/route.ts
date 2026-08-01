import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveItem } from '@/lib/matching/preferences';
import { searchProducts as searchKroger, getProductByUpc } from '@/lib/kroger/products';
// import { searchAmazonProducts as searchAmazon, getAmazonProductByAsin } from '@/lib/amazon/products';
import { scoreMatches } from '@/lib/matching/fuzzy';
import { applySemanticMatching } from '@/lib/ai/groq';
import { compareItem, summarizeResults } from '@/lib/comparison/engine';
import { ComparisonResult, ListItem, ResolvedItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const selectedIds = idsParam ? idsParam.split(',').filter(Boolean) : null;

    const supabase = await createClient();

    // 1. Fetch settings (for locationId and zip)
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value');
    
    const settings = (settingsData || []).reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const locationId = settings.kroger_location_id || process.env.KROGER_DEFAULT_LOCATION_ID;
    const zipCode = settings.default_zip_code || process.env.DEFAULT_ZIP_CODE || '80516';

    console.log('[compare] Resolved locationId:', locationId ?? '(none)', '| zipCode:', zipCode);

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'Kroger Location ID not configured in settings or environment.' },
        { status: 400 }
      );
    }

    // 2. Fetch list items — filter by selected IDs at DB level when provided
    const baseQuery = supabase
      .from('list_items')
      .select('*')
      .order('created_at', { ascending: true });
    const { data: items, error: itemsError } = await (
      selectedIds && selectedIds.length > 0
        ? baseQuery.in('id', selectedIds)
        : baseQuery
    );

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, results: [], summary: null });
    }

    // 3. Resolve each item and fetch store products in parallel
    const settled = await Promise.allSettled(
      items.map(async (item: ListItem) => {
        try {
          // Resolve item to a specific preference or search query
          const resolved: ResolvedItem = await resolveItem(item);
          const query = resolved.searchQuery;
          const pref = resolved.preference;

          // For items with a saved UPC, bypass search entirely (exact product match)
          let krogerProducts: import('@/types').ProductMatch[] = [];

          const hasExactKroger = pref?.preferred_upc;

          const [krogerResult] = await Promise.all([
            hasExactKroger
              ? getProductByUpc(pref!.preferred_upc!, locationId).catch(() => null)
              : searchKroger(query, locationId, 5, pref?.preferred_brand ?? undefined).catch((err) => {
                  console.error(`Kroger search failed for "${query}" at location "${locationId}":`, err);
                  return [] as import('@/types').ProductMatch[];
                }),
          ]);

          // Normalize results: exact lookups return single product or null
          if (hasExactKroger) {
            krogerProducts = krogerResult ? [krogerResult as import('@/types').ProductMatch] : [];
            // If exact lookup failed, fall back to search
            if (krogerProducts.length === 0) {
              krogerProducts = await searchKroger(query, locationId, 5, pref?.preferred_brand ?? undefined).catch(() => []);
            }
          } else {
            krogerProducts = krogerResult as import('@/types').ProductMatch[];
          }

          if (krogerProducts.length === 0) {
            console.log(`⚠️ Kroger search returned 0 results for "${query}" at location "${locationId}"`);
          }

          // Pinned products (saved UPC/ASIN): skip fuzzy scoring entirely.
          // The user explicitly chose these, so any Fuse score is irrelevant.
          // Regular searches: use a lenient threshold (20) — Kroger/Amazon's own
          // search engines already handle relevance. Fuse here only rejects extreme
          // outliers (e.g., a stock-fallback returning an unrelated category item).
          const MIN_MATCH_SCORE = 20;
          const byName = (a: import('@/types').ProductMatch, b: import('@/types').ProductMatch) => a.name.localeCompare(b.name);

          const scoredKroger = (hasExactKroger && krogerProducts.length > 0)
            ? krogerProducts.map((p) => ({ ...p, match_score: 100 }))
            : scoreMatches(query, krogerProducts).filter(p => p.match_score >= MIN_MATCH_SCORE).sort(byName);

          const [aiKroger] = await Promise.all([
            hasExactKroger ? scoredKroger : applySemanticMatching(query, scoredKroger),
          ]);

          return compareItem(resolved.listItem, aiKroger, [], resolved.preference);
        } catch (err) {
          console.error(`Error comparing item "${item.raw_text}":`, err);
          return {
            item,
            kroger: [],
            amazon: [],
            selected_kroger: null,
            selected_amazon: null,
            winner: 'tie',
            savings: 0,
            price_per_unit: { kroger: null, amazon: null, unit: 'each' },
          } as ComparisonResult;
        }
      })
    );

    // Flatten allSettled results — fulfilled items are included, rejected items get
    // a fallback ComparisonResult so the page always renders something.
    const comparisonResults: ComparisonResult[] = settled.map((outcome, i) => {
      if (outcome.status === 'fulfilled') return outcome.value;
      const item = items[i] as ListItem;
      console.error(`Error comparing item "${item.raw_text}":`, outcome.reason);
      return {
        item,
        kroger: [],
        amazon: [],
        selected_kroger: null,
        selected_amazon: null,
        winner: 'tie',
        savings: 0,
        price_per_unit: { kroger: null, amazon: null, unit: 'each' },
      } as ComparisonResult;
    });
    const summary = summarizeResults(comparisonResults);

    return NextResponse.json({
      success: true,
      results: comparisonResults,
      summary: {
        ...summary,
        unmappedCount: items.filter(i => i.status === 'pending').length
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Comparison API error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
