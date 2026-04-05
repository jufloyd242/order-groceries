import { ProductMatch } from '@/types';
import {
  SerpApiAmazonResultSchema,
  SerpApiResponseSchema,
  SerpApiAmazonResult,
  SerpApiProductPageSchema,
} from './schemas';
import { readCache, writeCache } from './cache';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

/**
 * Search Amazon for products via SerpApi.
 *
 * @param query - Search term (e.g., "toilet paper")
 * @param zipCode - Zip code for localized pricing (default: 80516)
 * @param limit - Max results to return (default: 5)
 */
export async function searchAmazonProducts(
  query: string,
  zipCode: string = '80516',
  limit: number = 5
): Promise<ProductMatch[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn('[Amazon] SERPAPI_API_KEY not set — skipping Amazon search');
    return [];
  }

  // Note: SerpApi Amazon organic results do NOT include prices.
  // Prices are fetched separately via getAmazonProductByAsin for the winning product.
  // This call exists purely for discovery: names, ASINs, thumbnails, ratings.
  const params = new URLSearchParams({
    engine: 'amazon',
    amazon_domain: 'amazon.com',
    k: query,
    api_key: apiKey,
    zip_code: zipCode,
  });

  let raw: unknown;
  try {
    const res = await fetch(`${SERPAPI_BASE}?${params}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.warn(`[Amazon] SerpApi HTTP ${res.status} for "${query}"`);
      return [];
    }
    raw = await res.json();
  } catch (err) {
    console.warn('[Amazon] Network error for', query, err instanceof Error ? err.message : err);
    return [];
  }

  const parsed = SerpApiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[Amazon] Response schema parse failed for "${query}":`, parsed.error.message);
    return [];
  }

  if (parsed.data.error) {
    console.warn(`[Amazon] SerpApi API error for "${query}":`, parsed.data.error);
    return [];
  }

  const results = parsed.data.organic_results ?? [];
  console.log(`[Amazon] "${query}" → ${results.length} candidates from SerpApi`);

  const seen = new Set<string>();
  const products: ProductMatch[] = [];

  for (const unknown of results) {
    if (products.length >= limit) break;
    const result = SerpApiAmazonResultSchema.safeParse(unknown);
    if (!result.success) continue;
    const asin = result.data.asin;
    if (!asin) continue;             // skip results with no ASIN
    if (seen.has(asin)) continue;    // skip duplicates
    seen.add(asin);
    products.push(mapAmazonProduct(result.data));
  }

  return products;
}

/**
 * Fetch a single Amazon product by ASIN using the amazon_product engine.
 * Bypasses search entirely for exact product matching (analogous to Kroger's getProductByUpc).
 * Returns the product if found, null otherwise.
 *
 * @param asin - Amazon Standard Identification Number (e.g., "B08XYZ123")
 * @param zipCode - Zip code for localized pricing
 */
export async function getAmazonProductByAsin(
  asin: string,
  zipCode: string = '80516'
): Promise<ProductMatch | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn('[Amazon] SERPAPI_API_KEY not set — skipping ASIN lookup');
    return null;
  }

  // Cache check — avoid burning SerpApi calls for repeat lookups
  const cached = await readCache(asin, zipCode);
  if (cached) return cached;

  const params = new URLSearchParams({
    engine: 'amazon_product',
    amazon_domain: 'amazon.com',
    asin,
    api_key: apiKey,
    zip_code: zipCode,
  });

  const res = await fetch(`${SERPAPI_BASE}?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Amazon] ASIN lookup failed for "${asin}": ${res.status} ${body}`);
    return null;
  }

  const raw = await res.json();
  const parsed = SerpApiProductPageSchema.safeParse(raw);

  if (!parsed.success || !parsed.data.product_results) {
    console.warn(`[Amazon] ASIN lookup returned no product_results for "${asin}"`);
    return null;
  }

  if (parsed.data.error) {
    console.error(`[Amazon] SerpApi error for ASIN "${asin}": ${parsed.data.error}`);
    return null;
  }

  const p = parsed.data.product_results;
  const price = p.price?.value ?? 0;

  const sizeMatch = (p.title ?? '').match(
    /(\d+\.?\d*)\s*(oz|lb|ct|count|pack|pk|rolls?|fl oz|gal|qt|L|g|kg|sheets?)/i
  );
  const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : '';
  const unit = sizeMatch ? normalizeUnit(sizeMatch[2]) : '';
  let pricePerUnit = price;
  if (sizeMatch) {
    const sv = parseFloat(sizeMatch[1]);
    if (sv > 0) pricePerUnit = price / sv;
  }

  const productUrl = p.link || `https://www.amazon.com/dp/${asin}`;

  console.log(`[Amazon] ASIN "${asin}" resolved: "${p.title}" $${price || 'N/A'}`);

  const product: ProductMatch = {
    id: asin,
    name: p.title ?? asin,
    brand: p.brand ?? extractBrand(p.title ?? ''),
    price,
    promo_price: null,
    size,
    unit,
    price_per_unit: Math.round(pricePerUnit * 100) / 100,
    image_url: p.thumbnail ?? null,
    store: 'amazon',
    asin,
    is_prime: false,
    link: productUrl,
    match_score: 100, // Exact ASIN match — always top score
  };

  // Fire-and-forget: write to cache in background (don't block the response)
  writeCache(product, zipCode).catch(() => {});

  return product;
}

/**
 * Map a SerpApi Amazon result to our standardized ProductMatch format.
 */
function mapAmazonProduct(result: SerpApiAmazonResult): ProductMatch {
  // price.value already resolved by SerpApiPriceSchema transform (value or parsed from raw)
  const price = result.price?.value ?? 0;

  // Try to extract size from title (e.g., "Charmin Ultra Soft, 12 Mega Rolls")
  const sizeMatch = result.title.match(
    /(\d+\.?\d*)\s*(oz|lb|ct|count|pack|pk|rolls?|fl oz|gal|qt|L|g|kg|sheets?)/i
  );

  const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : '';
  const unit = sizeMatch ? normalizeUnit(sizeMatch[2]) : '';

  let pricePerUnit = price;
  if (sizeMatch) {
    const sizeValue = parseFloat(sizeMatch[1]);
    if (sizeValue > 0) {
      pricePerUnit = price / sizeValue;
    }
  }

  return {
    id: result.asin,
    name: result.title,
    brand: extractBrand(result.title),
    price,
    promo_price: null,
    size,
    unit,
    price_per_unit: Math.round(pricePerUnit * 100) / 100,
    image_url: result.thumbnail ?? null,
    store: 'amazon',
    asin: result.asin,
    is_prime: result.is_prime ?? false,
    link: result.link || undefined,
    match_score: 0, // Set by fuzzy matcher
  };
}

/**
 * Extract a likely brand name from an Amazon product title.
 * Usually the first word or two before the product description.
 */
function extractBrand(title: string): string {
  // Common pattern: "Brand Name - Product Description" or "Brand Name Product"
  const dashSplit = title.split(/\s[-–—]\s/);
  if (dashSplit.length > 1) {
    return dashSplit[0].trim();
  }

  // Take first 1-2 words as brand if title is long enough
  const words = title.split(/\s+/);
  if (words.length >= 4) {
    return words.slice(0, 2).join(' ');
  }

  return '';
}

/**
 * Normalize various unit representations to a standard form.
 */
function normalizeUnit(raw: string): string {
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    count: 'ct',
    pack: 'ct',
    pk: 'ct',
    roll: 'ct',
    rolls: 'ct',
    sheet: 'ct',
    sheets: 'ct',
    pound: 'lb',
    pounds: 'lb',
    lbs: 'lb',
    ounce: 'oz',
    ounces: 'oz',
    gallon: 'gal',
    gallons: 'gal',
    quart: 'qt',
    quarts: 'qt',
    liter: 'L',
    liters: 'L',
    gram: 'g',
    grams: 'g',
    kilogram: 'kg',
    kilograms: 'kg',
  };
  return map[lower] ?? lower;
}
