import { ProductMatch, StoreSearchAdapter, StoreSearchOptions } from '@/types';

// Module-level singleton — adapters registered at startup.
const adapters = new Map<string, StoreSearchAdapter>();

/**
 * Register a store search adapter.
 * Call once per store during application bootstrap (see lib/search/adapters.ts).
 */
export function registerAdapter(adapter: StoreSearchAdapter): void {
  adapters.set(adapter.store, adapter);
}

/**
 * Search all registered stores in parallel.
 *
 * Uses Promise.allSettled so a single store failure never blocks results
 * from other stores. Failed stores are silently dropped (errors logged).
 *
 * @returns Flattened array of ProductMatch from all stores that succeeded.
 */
export async function searchAll(
  query: string,
  options: StoreSearchOptions = {}
): Promise<ProductMatch[]> {
  if (adapters.size === 0) return [];

  const settled = await Promise.allSettled(
    [...adapters.values()].map((adapter) => adapter.search(query, options))
  );

  const results: ProductMatch[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    } else {
      console.error('[searchAll] Store adapter failed:', outcome.reason);
    }
  }

  return results;
}

/** Returns all currently registered store names (useful for UI). */
export function registeredStores(): ProductMatch['store'][] {
  return [...adapters.keys()] as ProductMatch['store'][];
}
