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
 */
export async function searchProducts(
  query: string,
  locationId: string,
  limit: number = 5
): Promise<ProductMatch[]> {
  const token = await getClientCredentialsToken();

  const params = new URLSearchParams({
    'filter.term': query,
    'filter.locationId': locationId,
    'filter.limit': String(limit),
    'filter.fulfillment': 'ais',  // Available In Store — locks results to locationId inventory
  });

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
 * Search for King Soopers store locations near a zip code.
 */
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

  const params = new URLSearchParams({
    'filter.chain': chain,
    'filter.zipCode.near': zipCode,
  });

  const res = await fetch(`${KROGER_API_BASE}/locations?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger location search failed: ${res.status} ${body}`);
  }

  const data = await res.json();

  return data.data.map(
    (loc: {
      locationId: string;
      name: string;
      address: { addressLine1: string; city: string; state: string; zipCode: string };
    }) => ({
      locationId: loc.locationId,
      name: loc.name,
      address: loc.address.addressLine1,
      city: loc.address.city,
      state: loc.address.state,
      zipCode: loc.address.zipCode,
    })
  );
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
    match_score: 0, // Set by fuzzy matcher
  };
}
