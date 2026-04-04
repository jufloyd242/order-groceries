import { StoreSearchAdapter, StoreSearchOptions, ProductMatch } from '@/types';
import { searchAmazonProducts } from './products';

export const amazonAdapter: StoreSearchAdapter = {
  store: 'amazon',
  async search(query: string, options: StoreSearchOptions): Promise<ProductMatch[]> {
    return searchAmazonProducts(query, options.zipCode ?? '80516', options.limit ?? 5);
  },
};
