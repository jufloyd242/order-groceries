import { getClientCredentialsToken } from './auth';
import { ProductMatch } from '@/types';

const KROGER_API_BASE = 'https://api.kroger.com/v1';

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand: string;
  items: Array<{
    size: string;
    price?: {
      regular: number;
      promo: number;
    };
    nationalPrice?: {
      regular: number;
      promo: number;
    };
    fulfillment?: {
      curbside?: { price: number; promo?: number };
      fip?: { price: number; promo?: number };
      inStore?: { price: number; promo?: number };
    };
  }>;
  images: Array<{
    perspective: string;
    sizes: Array<{
      size: string;
      url: string;
    }>;
  }>;
}

interface KrogerSearchResponse {
  data: KrogerProduct[];
  meta: {
    pagination: {
      start: number;
      limit: number;
      total: number;
    };
  };
}

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
  });

  const res = await fetch(`${KROGER_API_BASE}/products?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger product search failed: ${res.status} ${body}`);
  }

  const data: KrogerSearchResponse = await res.json();

  return data.data.map((product) => mapKrogerProduct(product));
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
 * Map a raw Kroger API product to our standardized ProductMatch format.
 */
function mapKrogerProduct(product: KrogerProduct): ProductMatch {
  const item = product.items?.[0];
  
  // Try to find the most specific price possible
  let price = item?.price?.regular ?? item?.nationalPrice?.regular ?? 0;
  let promoPrice = item?.price?.promo ?? item?.nationalPrice?.promo ?? null;

  // If regular price is 0, check fulfillment types (common in cert/specific stores)
  if (price === 0 && item?.fulfillment) {
    const f = item.fulfillment;
    const bestF = f.curbside || f.inStore || f.fip;
    if (bestF) {
      price = bestF.price;
      promoPrice = bestF.promo ?? null;
    }
  }

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
    promo_price: promoPrice && promoPrice > 0 && promoPrice < price ? promoPrice : null,
    size,
    unit: sizeMatch?.[2] ?? '',
    price_per_unit: Math.round(pricePerUnit * 100) / 100,
    image_url: imageUrl,
    store: 'kroger',
    upc: product.upc,
    match_score: 0, // Set by fuzzy matcher
  };
}
