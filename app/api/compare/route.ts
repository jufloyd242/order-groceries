import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveItem } from '@/lib/matching/preferences';
import { searchProducts as searchKroger, getProductByUpc } from '@/lib/kroger/products';
import { searchAmazonProducts as searchAmazon, getAmazonProductByAsin } from '@/lib/amazon/products';
import { scoreMatches } from '@/lib/matching/fuzzy';
import { compareItem, summarizeResults } from '@/lib/comparison/engine';
import { ComparisonResult, ListItem, ResolvedItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const compareAmazon = searchParams.get('amazon') === 'true';

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
              : searchKroger(query, locationId, 5, pref?.preferred_brand ?? undefined).catch((err) => {
                  console.error(`Kroger search failed for "${query}" at location "${locationId}":`, err);
                  return [] as import('@/types').ProductMatch[];
                }),
            compareAmazon
              ? (hasExactAmazon
                  ? getAmazonProductByAsin(pref!.preferred_asin!, zipCode).catch((err) => {
                      console.error(`Amazon ASIN lookup failed for "${pref!.preferred_asin}":`, err);
                      return null;
                    })
                  : searchAmazon(query, zipCode, 5).catch((err) => {
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
              krogerProducts = await searchKroger(query, locationId, 5, pref?.preferred_brand ?? undefined).catch(() => []);
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

          // Lower threshold (5) to surface weak matches during debugging.
          // Raise back to 30 once Amazon results are confirmed working end-to-end.
          const MIN_MATCH_SCORE = 5;
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
