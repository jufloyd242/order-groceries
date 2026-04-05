import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveItem } from '@/lib/matching/preferences';
import { searchProducts as searchKroger, getProductByUpc } from '@/lib/kroger/products';
import { searchAmazonProducts as searchAmazon, getAmazonProductByAsin } from '@/lib/amazon/products';
import { scoreMatches } from '@/lib/matching/fuzzy';
import { applySemanticMatching } from '@/lib/ai/groq';
import { compareItem, summarizeResults } from '@/lib/comparison/engine';
import { ComparisonResult, ListItem, ResolvedItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const compareAmazon = searchParams.get('amazon') === 'true';
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
          let amazonProducts: import('@/types').ProductMatch[] = [];

          const hasExactKroger = pref?.preferred_upc;
          const hasExactAmazon = pref?.preferred_asin;

          const [krogerResult, amazonResult] = await Promise.all([
            hasExactKroger
              ? getProductByUpc(pref!.preferred_upc!, locationId).catch(() => null)
              : searchKroger(query, locationId, 15, pref?.preferred_brand ?? undefined).catch((err) => {
                  console.error(`Kroger search failed for "${query}" at location "${locationId}":`, err);
                  return [] as import('@/types').ProductMatch[];
                }),
            compareAmazon
              ? (hasExactAmazon
                  ? getAmazonProductByAsin(pref!.preferred_asin!, zipCode).catch((err) => {
                      console.error(`Amazon ASIN lookup failed for "${pref!.preferred_asin}":`, err);
                      return null;
                    })
                  : searchAmazon(query, zipCode, 15).catch((err) => {
                      console.error(`Amazon search failed for "${query}":`, err);
                      return [] as import('@/types').ProductMatch[];
                    }))
              : Promise.resolve([] as import('@/types').ProductMatch[]),
          ]);

          // Normalize results: exact lookups return single product or null
          if (hasExactKroger) {
            krogerProducts = krogerResult ? [krogerResult as import('@/types').ProductMatch] : [];
            // If exact lookup failed, fall back to search
            if (krogerProducts.length === 0) {
              krogerProducts = await searchKroger(query, locationId, 15, pref?.preferred_brand ?? undefined).catch(() => []);
            }
          } else {
            krogerProducts = krogerResult as import('@/types').ProductMatch[];
          }

          amazonProducts = hasExactAmazon
            // getAmazonProductByAsin returns ProductMatch | null
            ? (amazonResult ? [amazonResult as import('@/types').ProductMatch] : [])
            : (amazonResult as import('@/types').ProductMatch[] ?? []);

          // Debug: always log Amazon result count so we know if SerpApi is returning data at all
          if (compareAmazon) {
            console.log(`[Debug] Amazon found ${amazonProducts.length} items for query: "${query}"`);
          }

          if (krogerProducts.length === 0) {
            console.log(`⚠️ Kroger search returned 0 results for "${query}" at location "${locationId}"`);
          }

          // Log raw Amazon results before fuzzy filtering (diagnose score drop-off)
          if (compareAmazon && amazonProducts.length > 0) {
            const preScore = scoreMatches(query, amazonProducts);
            console.log(`[compare] Amazon raw scores for "${query}":`,
              preScore.slice(0, 5).map((p) => `${p.name} → ${p.match_score} (\$${p.price})`)
            );
          } else if (compareAmazon) {
            console.log(`⚠️ Amazon returned 0 results for "${query}"`);
          }

          // Combined raw count log — confirms data is flowing before fuzzy filtering
          console.log('Query:', query, 'Kroger Raw Count:', krogerProducts.length, 'Amazon Raw Count:', amazonProducts.length);

          // Pinned products (saved UPC/ASIN): skip fuzzy scoring entirely.
          // The user explicitly chose these, so any Fuse score is irrelevant.
          // Regular searches: use a lenient threshold (20) — Kroger/Amazon's own
          // search engines already handle relevance. Fuse here only rejects extreme
          // outliers (e.g., a stock-fallback returning an unrelated category item).
          // Low strictness: keep almost everything so the AI has a big pool to choose from.
          const MIN_MATCH_SCORE = 10;
          const byScore = (a: import('@/types').ProductMatch, b: import('@/types').ProductMatch) => b.match_score - a.match_score;

          const scoredKroger = (hasExactKroger && krogerProducts.length > 0)
            ? krogerProducts.map((p) => ({ ...p, match_score: 100 }))
            : scoreMatches(query, krogerProducts).filter(p => p.match_score >= MIN_MATCH_SCORE).sort(byScore);

          const scoredAmazon = (hasExactAmazon && amazonProducts.length > 0)
            ? amazonProducts.map((p) => ({ ...p, match_score: 100 }))
            : scoreMatches(query, amazonProducts).filter(p => p.match_score >= MIN_MATCH_SCORE).sort(byScore);

          // AI semantic matching: if the top fuzzy score < 80, send candidates to
          // Groq to pick the best semantic match. Pinned products skip this.
          // If GROQ_API_KEY is not set, this is a no-op.
          const [aiKroger, aiAmazon] = await Promise.all([
            hasExactKroger ? scoredKroger : applySemanticMatching(query, scoredKroger),
            hasExactAmazon ? scoredAmazon : applySemanticMatching(query, scoredAmazon),
          ]);

          // ASIN price enrichment: SerpApi organic search results have no prices.
          // Once we've identified the best Amazon match, do a single product-page
          // lookup to get the real price. This is 1 extra API call per item, but
          // it's the only reliable way to get Amazon pricing via SerpApi.
          let finalAmazon = aiAmazon;
          if (compareAmazon && !hasExactAmazon && aiAmazon.length > 0) {
            const topAmazon = aiAmazon[0];
            if (topAmazon.asin && topAmazon.price === 0) {
              const enriched = await getAmazonProductByAsin(topAmazon.asin, zipCode).catch(() => null);
              if (enriched && enriched.price > 0) {
                console.log(`[compare] Amazon price enriched: "${topAmazon.name}" $${enriched.price}`);
                finalAmazon = [
                  { ...enriched, match_score: topAmazon.match_score, ai_reasoning: topAmazon.ai_reasoning },
                  ...aiAmazon.slice(1),
                ];
              }
            }
          }

          // Perform comparison (pass preference so it can prioritize saved products)
          return compareItem(resolved.listItem, aiKroger, finalAmazon, resolved.preference);
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
