import { StoreSearchAdapter, StoreSearchOptions, ProductMatch } from '@/types';
import { searchAmazonProducts } from './products';

export const amazonAdapter: StoreSearchAdapter = {
  store: 'amazon',
  async search(query: string, options: StoreSearchOptions): Promise<ProductMatch[]> {
    const results = await searchAmazonProducts(query, options.zipCode ?? '80516', options.limit ?? 5);
    console.log(
      `[amazonAdapter] "${query}" → ${results.length} result(s)`,
      results[0] ? `| first: "${results[0].name}" $${results[0].price || 'N/A'}` : '| (none)'
    );
    return results;
  },
};
