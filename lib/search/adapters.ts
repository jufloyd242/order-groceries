/**
 * Bootstrap file for the store search registry.
 *
 * This is the single file to edit when adding a new store:
 *   1. Write lib/<store>/adapter.ts implementing StoreSearchAdapter
 *   2. Import it here and call registerAdapter(yourAdapter)
 *
 * Usage:
 *   import { searchAll } from '@/lib/search/adapters';
 *   const results = await searchAll('milk', { locationId, zipCode });
 */
import { registerAdapter, searchAll, registeredStores } from './registry';
import { krogerAdapter } from '@/lib/kroger/adapter';
import { amazonAdapter } from '@/lib/amazon/adapter';

registerAdapter(krogerAdapter);
registerAdapter(amazonAdapter);

export { searchAll, registeredStores };
