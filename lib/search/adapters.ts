/**
 * Bootstrap file for the store search registry.
 *
 * This is the single file to edit when adding a new store:
 *   1. Write lib/<store>/adapter.ts implementing StoreSearchAdapter
 *   2. Import it here and call registerAdapter(yourAdapter)
 *
 * Usage:
 *   import { searchAll, mapToNormalizedProduct } from '@/lib/search/adapters';
 *   const results = await searchAll('milk', { locationId, zipCode });
 */
import { registerAdapter, searchAll, registeredStores } from './registry';
import { krogerAdapter } from '@/lib/kroger/adapter';
import { amazonAdapter } from '@/lib/amazon/adapter';
import { ProductMatch, NormalizedProduct } from '@/types';

registerAdapter(krogerAdapter);
registerAdapter(amazonAdapter);

/**
 * Normalize any raw ProductMatch into a NormalizedProduct.
 *
 * Since ProductMatch IS NormalizedProduct (type alias), this is an identity
 * function today. Its value is as a named contract point: all code that
 * constructs products should flow through here, so future normalization steps
 * (e.g. title-casing, stripping HTML entities, clamping negative prices) can
 * be added in one place without touching individual adapters.
 */
export function mapToNormalizedProduct(product: ProductMatch): NormalizedProduct {
  return {
    ...product,
    // Clamp negative prices to 0 (API quirk guard)
    price: Math.max(0, product.price),
    price_per_unit: Math.max(0, product.price_per_unit),
  };
}

export { searchAll, registeredStores };
