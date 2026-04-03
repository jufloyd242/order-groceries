import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/kroger/products';
import { searchAmazonProducts } from '@/lib/amazon/products';
import { ProductMatch } from '@/types';
import { createClient } from '@/lib/supabase/server';

interface BatchQuery {
  itemId: string;
  query: string;
}

interface BatchResultItem {
  itemId: string;
  query: string;
  kroger: ProductMatch[];
  amazon: ProductMatch[];
}

/**
 * POST /api/search/batch
 *
 * Runs parallel product searches for multiple grocery list items.
 * Capped at 3 concurrent Kroger calls to avoid rate limits.
 *
 * Body: {
 *   queries: Array<{ itemId: string; query: string }>;
 *   stores: ('kroger' | 'amazon')[];
 *   locationId: string;
 *   zipCode?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      queries,
      stores,
      locationId,
      zipCode = process.env.DEFAULT_ZIP_CODE || '80516',
    }: {
      queries: BatchQuery[];
      stores: ('kroger' | 'amazon')[];
      locationId: string;
      zipCode?: string;
    } = body;

    if (!queries?.length) {
      return NextResponse.json({ success: false, error: 'queries is required' }, { status: 400 });
    }
    if (!locationId && stores.includes('kroger')) {
      return NextResponse.json({ success: false, error: 'locationId is required for kroger' }, { status: 400 });
    }

    const doKroger = stores.includes('kroger');
    const doAmazon = stores.includes('amazon');
    const CONCURRENCY = 3;

    // Process in batches of CONCURRENCY to avoid rate limits
    const results: BatchResultItem[] = [];

    for (let i = 0; i < queries.length; i += CONCURRENCY) {
      const chunk = queries.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(async ({ itemId, query }): Promise<BatchResultItem> => {
          const [kroger, amazon] = await Promise.allSettled([
            doKroger ? searchProducts(query, locationId, 20) : Promise.resolve([] as ProductMatch[]),
            doAmazon ? searchAmazonProducts(query, zipCode, 20) : Promise.resolve([] as ProductMatch[]),
          ]);

          return {
            itemId,
            query,
            kroger: kroger.status === 'fulfilled' ? kroger.value : [],
            amazon: amazon.status === 'fulfilled' ? amazon.value : [],
          };
        })
      );

      for (const r of chunkResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Batch search error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
