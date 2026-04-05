import { ProductMatch } from '@/types';
import {
  SerpApiAmazonResultSchema,
  SerpApiResponseSchema,
  SerpApiAmazonResult,
  SerpApiProductPageSchema,
} from './schemas';

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
    throw new Error('SERPAPI_API_KEY is not set. Add it to your .env.local file.');
  }

  const params = new URLSearchParams({
    engine: 'amazon',
    type: 'search',
    amazon_domain: 'amazon.com',
    k: query,
    api_key: apiKey,
    zip_code: zipCode,
  });

  const res = await fetch(`${SERPAPI_BASE}?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpApi request failed: ${res.status} ${body}`);
  }

  const raw = await res.json();

  // Log raw response so we can diagnose missing/zero prices during development
  console.log(`[Amazon] Raw SerpApi response for "${query}" (${(raw.organic_results ?? []).length} organic results):`,
    JSON.stringify((raw.organic_results ?? []).slice(0, 3).map((r: Record<string, unknown>) => ({
      title: r.title,
      asin: r.asin,
      price: r.price,
    })), null, 2)
  );

  const parsed = SerpApiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`SerpApi response parse failed: ${parsed.error.message}`);
  }

  if (parsed.data.error) {
    throw new Error(`SerpApi error: ${parsed.data.error}`);
  }

  const results = parsed.data.organic_results ?? [];

  return results
    .slice(0, limit)
    .map((unknown) => {
      const result = SerpApiAmazonResultSchema.safeParse(unknown);
      return result.success ? mapAmazonProduct(result.data) : null;
    })
    // Only drop items that failed schema parsing — price=0 is kept so the
    // UI can show "Check Amazon for Price" rather than hiding the product.
    .filter((p): p is ProductMatch => p !== null);
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
    throw new Error('SERPAPI_API_KEY is not set. Add it to your .env.local file.');
  }

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

  return {
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
