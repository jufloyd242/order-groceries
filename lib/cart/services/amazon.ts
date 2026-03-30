import { CartItem, StoreSubmitResult } from '@/types';

/**
 * Amazon cart submission — placeholder for future implementation.
 * Architecture is ready: implement ASIN-based cart API here.
 */
export async function submitAmazonCart(items: CartItem[]): Promise<StoreSubmitResult> {
  const amazonItems = items.filter((i) => i.store === 'amazon');

  if (amazonItems.length === 0) {
    return { store: 'amazon', success: true, itemsAdded: 0, itemsFailed: 0, errors: [] };
  }

  // TODO: Implement Amazon cart API
  return {
    store: 'amazon',
    success: false,
    itemsAdded: 0,
    itemsFailed: amazonItems.length,
    errors: ['Amazon cart integration coming soon — please add items manually.'],
  };
}
