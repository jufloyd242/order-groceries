import { ProductMatch } from '@/types';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

interface SerpApiAmazonResult {
  position: number;
  title: string;
  asin: string;
  link: string;
  price?: {
    raw: string;
    value: number;
    currency: string;
  };
  rating?: number;
  ratings_total?: number;
  is_prime?: boolean;
  thumbnail?: string;
  delivery?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiAmazonResult[];
  error?: string;
}

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
    amazon_domain: 'amazon.com',
    k: query,
    api_key: apiKey,
    // SerpApi supports zip_code for localized results
  });

  const res = await fetch(`${SERPAPI_BASE}?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpApi request failed: ${res.status} ${body}`);
  }

  const data: SerpApiResponse = await res.json();

  if (data.error) {
    throw new Error(`SerpApi error: ${data.error}`);
  }

  const results = data.organic_results ?? [];

  return results.slice(0, limit).map((result) => mapAmazonProduct(result));
}

/**
 * Map a SerpApi Amazon result to our standardized ProductMatch format.
 */
function mapAmazonProduct(result: SerpApiAmazonResult): ProductMatch {
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
