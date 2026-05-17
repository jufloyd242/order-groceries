import { CartItem, StoreSubmitResult } from '@/types';

/**
 * Amazon does not offer a programmatic "add to cart" API.
 * Instead, we generate affiliate deep links per ASIN that the user opens in their browser.
 * The submit function returns these links as metadata so the client can present
 * "Open on Amazon" buttons.
 */

const AMAZON_AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || 'sgo-20';

/** Generate an Amazon product deep link for an ASIN. */
export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}?tag=${encodeURIComponent(AMAZON_AFFILIATE_TAG)}`;
}

export async function submitAmazonCart(items: CartItem[]): Promise<StoreSubmitResult> {
  const amazonItems = items.filter((i) => i.store === 'amazon' && i.asin);

  if (amazonItems.length === 0) {
    return { store: 'amazon', success: true, itemsAdded: 0, itemsFailed: 0, errors: [] };
  }

  // No API call — generate affiliate links for client to open
  const links = amazonItems.map((i) => ({
    name: i.name,
    asin: i.asin!,
    url: amazonProductUrl(i.asin!),
  }));

  return {
    store: 'amazon',
    success: true,
    itemsAdded: amazonItems.length,
    itemsFailed: 0,
    errors: [],
    // Attach links as metadata — client reads these to show "Open on Amazon" buttons
    amazonLinks: links,
  } as StoreSubmitResult & { amazonLinks: typeof links };
}
