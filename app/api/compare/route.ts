import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveItem } from '@/lib/matching/preferences';
import { searchProducts as searchKroger } from '@/lib/kroger/products';
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

          // Fetch products from both stores in parallel
          const [krogerProducts, amazonProducts] = await Promise.all([
            searchKroger(query, locationId, 5).catch((err) => {
              console.error(`Kroger search failed for "${query}" at location "${locationId}":`, err);
              return [];
            }),
            searchAmazon(query, zipCode, 5).catch((err) => {
              console.error(`Amazon search failed for "${query}":`, err);
              return [];
            }),
          ]);

          if (krogerProducts.length === 0) {
            console.log(`⚠️ Kroger search returned 0 results for "${query}" at location "${locationId}"`);
          }

          // Score products with fuzzy matching
          const scoredKroger = scoreMatches(query, krogerProducts);
          const scoredAmazon = scoreMatches(query, amazonProducts);

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
