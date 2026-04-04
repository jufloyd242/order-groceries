import { StoreSearchAdapter, StoreSearchOptions, ProductMatch } from '@/types';
import { searchProducts } from './products';

export const krogerAdapter: StoreSearchAdapter = {
  store: 'kroger',
  async search(query: string, options: StoreSearchOptions): Promise<ProductMatch[]> {
    if (!options.locationId) {
      console.warn('[krogerAdapter] No locationId provided — skipping Kroger search');
      return [];
    }
    return searchProducts(query, options.locationId, options.limit ?? 5);
  },
};
