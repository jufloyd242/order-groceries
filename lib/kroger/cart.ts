import { exchangeCodeForToken } from './auth';

const KROGER_API_BASE = 'https://api.kroger.com/v1';

export interface CartItemInput {
  upc: string;
  quantity: number;
}

/**
 * Add items to a user's Kroger cart.
 * Requires a user-level access token obtained via the Authorization Code flow.
 * Note: Cart writes use `PUT /v1/cart/add`
 */
export async function addItemsToCart(
  accessToken: string,
  items: CartItemInput[]
): Promise<void> {
  // We must map our items to the format Kroger expects
  const payload = {
    items: items.map((item) => ({
      upc: item.upc,
      quantity: item.quantity,
    })),
  };

  const res = await fetch(`${KROGER_API_BASE}/cart/add`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorMsg = `Kroger cart addition failed: ${res.status}`;
    try {
      const errorBody = await res.text();
      errorMsg += ` ${errorBody}`;
    } catch {
      // Ignore if can't read text
    }
    throw new Error(errorMsg);
  }
}
