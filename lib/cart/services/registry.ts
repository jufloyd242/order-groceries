import { CartItem, StoreId, StoreSubmitResult, CartSubmitResult } from '@/types';
import { submitKrogerCart } from './kroger';
import { submitAmazonCart } from './amazon';

/** Map of store → submit function. Add new stores here. */
const storeServices: Record<StoreId, (items: CartItem[]) => Promise<StoreSubmitResult>> = {
  kroger: submitKrogerCart,
  amazon: submitAmazonCart,
};

/**
 * Submit all cart items to their respective stores in parallel.
 * One store failing does not block others.
 */
export async function submitCart(items: CartItem[]): Promise<CartSubmitResult> {
  const byStore = items.reduce<Partial<Record<StoreId, CartItem[]>>>((acc, item) => {
    acc[item.store] = acc[item.store] || [];
    acc[item.store]!.push(item);
    return acc;
  }, {});

  const storeIds = Object.keys(byStore) as StoreId[];
  const results = await Promise.all(
    storeIds.map((storeId) => storeServices[storeId](byStore[storeId]!))
  );

  const submittedIds: string[] = [];
  for (const result of results) {
    if (result.success) {
      const storeItems = byStore[result.store] || [];
      submittedIds.push(...storeItems.map((i) => i.id));
    }
  }

  return { results, submittedIds };
}
