import { createServiceClient } from '@/lib/supabase/server';
import { ProductMatch } from '@/types';

// ---------------------------------------------------------------------------
// Amazon product price cache
//
// getAmazonProductByAsin burns 1 SerpApi call per lookup. This module wraps
// it with a Supabase-backed 24-hour cache keyed on (asin, zip_code).
//
// Cache hit  → return stored ProductMatch, no SerpApi call.
// Cache miss → caller fetches from SerpApi, then calls writeCache().
// ---------------------------------------------------------------------------

const TTL_HOURS = 24;

interface CacheRow {
  asin: string;
  zip_code: string;
  name: string;
  brand: string;
  price: number;
  size: string;
  unit: string;
  price_per_unit: number;
  image_url: string | null;
  link: string | null;
  cached_at: string;
}

/**
 * Look up an ASIN in the cache.
 * Returns the cached ProductMatch if it exists and is < 24 hours old, null otherwise.
 */
export async function readCache(
  asin: string,
  zipCode: string,
): Promise<ProductMatch | null> {
  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('amazon_product_cache')
      .select('*')
      .eq('asin', asin)
      .eq('zip_code', zipCode)
      .gte('cached_at', cutoff)
      .maybeSingle();

    if (error) {
      console.warn('[amazon-cache] read error:', error.message);
      return null;
    }
    if (!data) return null;

    const row = data as CacheRow;
    console.log(`[amazon-cache] HIT for ASIN "${asin}" (cached ${row.cached_at})`);

    return {
      id: row.asin,
      name: row.name,
      brand: row.brand,
      price: Number(row.price),
      promo_price: null,
      size: row.size,
      unit: row.unit,
      price_per_unit: Number(row.price_per_unit),
      image_url: row.image_url ?? null,
      store: 'amazon',
      asin: row.asin,
      is_prime: false,
      link: row.link ?? undefined,
      match_score: 0, // Will be overwritten by the caller
    };
  } catch (err) {
    console.warn('[amazon-cache] read exception:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Write or update a ProductMatch into the cache.
 * Only caches products with a real price (> 0) — no point caching $0 lookups.
 */
export async function writeCache(
  product: ProductMatch,
  zipCode: string,
): Promise<void> {
  if (!product.asin || product.price <= 0) return;

  try {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('amazon_product_cache')
      .upsert(
        {
          asin: product.asin,
          zip_code: zipCode,
          name: product.name,
          brand: product.brand,
          price: product.price,
          size: product.size,
          unit: product.unit,
          price_per_unit: product.price_per_unit,
          image_url: product.image_url,
          link: product.link ?? null,
          cached_at: new Date().toISOString(),
        },
        { onConflict: 'asin,zip_code' },
      );

    if (error) {
      console.warn('[amazon-cache] write error:', error.message);
    } else {
      console.log(`[amazon-cache] WRITE ASIN "${product.asin}" $${product.price}`);
    }
  } catch (err) {
    console.warn('[amazon-cache] write exception:', err instanceof Error ? err.message : err);
  }
}
