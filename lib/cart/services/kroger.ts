import { CartItem, StoreSubmitResult } from '@/types';

/**
 * Submit Kroger cart items via our server-side API.
 * The server handles token management and Kroger API calls.
 */
export async function submitKrogerCart(items: CartItem[]): Promise<StoreSubmitResult> {
  const krogerItems = items.filter((i) => i.store === 'kroger' && i.upc);

  if (krogerItems.length === 0) {
    return { store: 'kroger', success: true, itemsAdded: 0, itemsFailed: 0, errors: [] };
  }

  const res = await fetch('/api/kroger/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: krogerItems.map((i) => ({ upc: i.upc!, quantity: i.quantity })),
    }),
  });

  const data = await res.json();

  if (res.status === 401 && data.authUrl) {
    return {
      store: 'kroger',
      success: false,
      itemsAdded: 0,
      itemsFailed: krogerItems.length,
      errors: ['Authentication required'],
      authUrl: data.authUrl,
    };
  }

  if (data.success) {
    return {
      store: 'kroger',
      success: true,
      itemsAdded: krogerItems.length,
      itemsFailed: 0,
      errors: [],
    };
  }

  return {
    store: 'kroger',
    success: false,
    itemsAdded: 0,
    itemsFailed: krogerItems.length,
    errors: [data.error || 'Unknown Kroger cart error'],
  };
}
