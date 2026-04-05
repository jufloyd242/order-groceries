import { getClientCredentialsToken } from './auth';
import { ProductMatch } from '@/types';
import {
  KrogerProductSchema,
  KrogerSearchResponseSchema,
  KrogerProduct,
  extractKrogerPrice,
} from './schemas';

const KROGER_API_BASE = 'https://api.kroger.com/v1';

/**
 * Search for products at a specific King Soopers location.
 *
 * @param query - Search term (e.g., "milk", "toilet paper")
 * @param locationId - Kroger store location ID
 * @param limit - Max results (default 5)
 * @param brand - Optional brand filter to narrow results (e.g., "Kroger", "Horizon")
 */
export async function searchProducts(
  query: string,
  locationId: string,
  limit: number = 5,
  brand?: string
): Promise<ProductMatch[]> {
  const token = await getClientCredentialsToken();

  const params = new URLSearchParams({
    'filter.term': query,
    'filter.locationId': locationId,
    'filter.limit': String(limit),
    // Omitting filter.fulfillment intentionally — 'ais' (Available In Store) drops
    // products that are temporarily out of stock even though they have valid prices,
    // which was the primary cause of intermittent 0-result comparisons. The location
    // ID is sufficient to get location-specific pricing.
  });

  // Add brand filter to narrow results and avoid category mismatches
  // e.g., searching "apples" with brand filter avoids "Apple Scented Soap"
  if (brand) {
    params.set('filter.brand', brand);
  }

  const res = await fetch(`${KROGER_API_BASE}/products?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',  // Prevent stale cached responses
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger product search failed: ${res.status} ${body}`);
  }

  const raw = await res.json();
  const parsed = KrogerSearchResponseSchema.safeParse(raw);
  const rawProducts = parsed.success ? parsed.data.data : [];

  // Map and filter out products with no price at this location
  return rawProducts
    .map((unknown) => {
      const result = KrogerProductSchema.safeParse(unknown);
      return result.success ? mapKrogerProduct(result.data) : null;
    })
    .filter((p): p is ProductMatch => p !== null && p.price > 0);
}

/**
 * Fetch a specific Kroger product by its UPC.
 * Bypasses search entirely for exact product matching.
 * Returns the product if found and in stock, null otherwise.
 */
export async function getProductByUpc(
  upc: string,
  locationId: string
): Promise<ProductMatch | null> {
  const token = await getClientCredentialsToken();

  const params = new URLSearchParams({
    'filter.productId': upc,
    'filter.locationId': locationId,
    // Omitting filter.fulfillment — same reason as searchProducts (see above)
  });

  const res = await fetch(`${KROGER_API_BASE}/products?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const raw = await res.json();
  const parsed = KrogerSearchResponseSchema.safeParse(raw);
  const rawProducts = parsed.success ? parsed.data.data : [];

  if (rawProducts.length === 0) return null;

  const result = KrogerProductSchema.safeParse(rawProducts[0]);
  if (!result.success) return null;

  const product = mapKrogerProduct(result.data);
  // Return the product regardless of price — a price of $0 means the item is
  // temporarily unpriced at this location, not that it doesn't exist. Returning
  // null here causes the compare route to fall back to a generic text search
  // which may return a completely different product and lose the user's pin.
  // compareItem treats price=0 as "unavailable" and displays accordingly.
  return product;
}

/**
 * Search for King Soopers store locations near a zip code.
 */
// Kroger's /locations API uses internal chain codes (not display names).
// Map human-readable names (used in app settings) to their API codes.
const KROGER_CHAIN_CODES: Record<string, string> = {
  'king soopers': 'KINGSOOPERS',
  'kroger': 'KROGER',
  'fred meyer': 'FREDMEYER',
  'ralphs': 'RALPHS',
  'marianos': 'MARIANOS',
  'harris teeter': 'HARRISTEETER',
  'smith\'s': 'SMITHS',
  'pick n save': 'PICKNSAVE',
  'dillons': 'DILLONS',
  'gerbes': 'GERBES',
  'pay less': 'PAYLESS',
  'city market': 'CITYMARKET',
  'ruler foods': 'RULERFOODS',
};

export async function searchLocations(
  zipCode: string,
  chain: string = 'King Soopers'
): Promise<
  Array<{
    locationId: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  }>
> {
  const token = await getClientCredentialsToken();

  // Normalize chain display name to Kroger's internal chain code
  const chainCode = KROGER_CHAIN_CODES[chain.toLowerCase()] ?? chain.toUpperCase().replace(/\s+/g, '');

  const params = new URLSearchParams({
    'filter.chain': chainCode,
    'filter.zipCode.near': zipCode,
    'filter.radiusInMiles': '10',
  });

  console.log(`[searchLocations] Requesting: GET ${KROGER_API_BASE}/locations?${params}`);

  const res = await fetch(`${KROGER_API_BASE}/locations?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const rawBody = await res.text();
  console.log(`[searchLocations] Response status: ${res.status}`);
  console.log(`[searchLocations] Response body (first 500 chars): ${rawBody.slice(0, 500)}`);

  if (!res.ok) {
    throw new Error(`Kroger location search failed: ${res.status} ${rawBody}`);
  }

  let data: { data?: Array<{ locationId: string; name: string; address: { addressLine1: string; city: string; state: string; zipCode: string } }> };
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`Kroger location search returned invalid JSON: ${rawBody.slice(0, 200)}`);
  }

  return (data?.data ?? []).map((loc) => ({
    locationId: loc.locationId,
    name: loc.name,
    address: loc.address?.addressLine1 ?? '',
    city: loc.address?.city ?? '',
    state: loc.address?.state ?? '',
    zipCode: loc.address?.zipCode ?? '',
  }));
}

/**
 * Map a Zod-validated Kroger product to our standardized ProductMatch format.
 */
function mapKrogerProduct(product: KrogerProduct): ProductMatch {
  const item = product.items?.[0];
  const { price, promoPrice } = extractKrogerPrice(item);

  const size = item?.size ?? '';

  // Extract a usable image URL
  const frontImage = product.images?.find(
    (img) => img.perspective === 'front'
  );
  const imageUrl =
    frontImage?.sizes?.find((s) => s.size === 'medium')?.url ??
    frontImage?.sizes?.[0]?.url ??
    null;

  // Calculate price per unit (rough — the comparison engine refines this)
  const sizeMatch = size.match(/([\d.]+)\s*(oz|lb|ct|fl oz|gal|qt|L|g|kg)/i);
  let pricePerUnit = price;
  if (sizeMatch) {
    const sizeValue = parseFloat(sizeMatch[1]);
    if (sizeValue > 0) {
      pricePerUnit = price / sizeValue;
    }
  }

  return {
    id: product.productId,
    name: product.description,
    brand: product.brand ?? '',
    price,
    promo_price: promoPrice,
    size,
    unit: sizeMatch?.[2] ?? '',
    price_per_unit: Math.round(pricePerUnit * 100) / 100,
    image_url: imageUrl,
    store: 'kroger',
    upc: product.upc,
    department: product.categories?.[0] ?? null,
    link: product.upc
      ? `https://www.kingsoopers.com/p/item/${product.upc}`
      : `https://www.kingsoopers.com/p/${product.productId}`,
    match_score: 0, // Set by fuzzy matcher
  };
}
