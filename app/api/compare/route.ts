import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveItem } from '@/lib/matching/preferences';
import { searchProducts as searchKroger, getProductByUpc } from '@/lib/kroger/products';
import { searchAmazonProducts as searchAmazon } from '@/lib/amazon/products';
import { scoreMatches } from '@/lib/matching/fuzzy';
import { compareItem, summarizeResults } from '@/lib/comparison/engine';
import { ComparisonResult, ListItem, ResolvedItem } from '@/types';

export async function GET() {
  try {
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

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'Kroger Location ID not configured in settings or environment.' },
        { status: 400 }
      );
    }

    // 2. Fetch list items
    const { data: items, error: itemsError } = await supabase
      .from('list_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, results: [], summary: null });
    }

    // 3. Resolve each item and fetch store products in parallel
    const comparisonResults: ComparisonResult[] = await Promise.all(
      items.map(async (item: ListItem) => {
        try {
          // Resolve item to a specific preference or search query
          const resolved: ResolvedItem = await resolveItem(item);
          const query = resolved.searchQuery;
          const pref = resolved.preference;

          // For items with a saved UPC, bypass search entirely (exact product match)
          let krogerProducts: import('@/types').ProductMatch[] = [];
          let amazonProducts: import('@/types').ProductMatch[] = [];

          const hasExactKroger = pref?.preferred_upc;
          const hasExactAmazon = pref?.preferred_asin;

          const [krogerResult, amazonResult] = await Promise.all([
            hasExactKroger
              ? getProductByUpc(pref!.preferred_upc!, locationId).catch(() => null)
              : searchKroger(query, locationId, 5, pref?.preferred_brand ?? undefined).catch((err) => {
                  console.error(`Kroger search failed for "${query}" at location "${locationId}":`, err);
                  return [] as import('@/types').ProductMatch[];
                }),
            hasExactAmazon
              ? searchAmazon(pref!.preferred_asin!, zipCode, 1).catch((err) => {
                  console.error(`Amazon ASIN lookup failed for "${pref!.preferred_asin}":`, err);
                  return [] as import('@/types').ProductMatch[];
                })
              : searchAmazon(query, zipCode, 5).catch((err) => {
                  console.error(`Amazon search failed for "${query}":`, err);
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

          amazonProducts = amazonResult as import('@/types').ProductMatch[];

          if (krogerProducts.length === 0) {
            console.log(`⚠️ Kroger search returned 0 results for "${query}" at location "${locationId}"`);
          }

          // Score products with fuzzy matching and filter out weak matches
          const MIN_MATCH_SCORE = 30;
          const byName = (a: import('@/types').ProductMatch, b: import('@/types').ProductMatch) => a.name.localeCompare(b.name);
          const scoredKroger = scoreMatches(query, krogerProducts).filter(p => p.match_score >= MIN_MATCH_SCORE).sort(byName);
          const scoredAmazon = scoreMatches(query, amazonProducts).filter(p => p.match_score >= MIN_MATCH_SCORE).sort(byName);

          // Perform comparison (pass preference so it can prioritize saved products)
          return compareItem(resolved.listItem, scoredKroger, scoredAmazon, resolved.preference);
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

    // 4. Summarize results
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
