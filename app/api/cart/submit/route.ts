import { NextRequest, NextResponse } from 'next/server';
import { getKrogerAccessToken } from '@/lib/kroger/token_manager';
import { getAuthorizationUrl } from '@/lib/kroger/auth';
import { addItemsToCart } from '@/lib/kroger/cart';
import { CartItem, StoreSubmitResult } from '@/types';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * POST /api/cart/submit
 * Submit cart items to their respective stores.
 * Handles Kroger natively; Amazon is a placeholder.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { items }: { items: CartItem[] } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 });
    }

    const krogerItems = items.filter((i) => i.store === 'kroger' && i.upc);
    const amazonItems = items.filter((i) => i.store === 'amazon');
    const results: StoreSubmitResult[] = [];

    // ── King Soopers submission ──────────────────────────────
    if (krogerItems.length > 0) {
      const token = await getKrogerAccessToken(supabase, user.id);
      console.log(`[cart/submit] user=${user.id} krogerItems=${krogerItems.length} tokenFound=${!!token}`);

      if (!token) {
        const redirectUri =
          process.env.KROGER_REDIRECT_URI || 'http://localhost:3000/api/kroger/auth/callback';
        results.push({
          store: 'kroger',
          success: false,
          itemsAdded: 0,
          itemsFailed: krogerItems.length,
          errors: ['Not authenticated with King Soopers'],
          authUrl: getAuthorizationUrl(redirectUri),
        });
      } else {
        try {
          await addItemsToCart(
            token,
            krogerItems.map((i) => ({ upc: i.upc!, quantity: i.quantity }))
          );
          results.push({
            store: 'kroger',
            success: true,
            itemsAdded: krogerItems.length,
            itemsFailed: 0,
            errors: [],
          });
        } catch (err) {
          results.push({
            store: 'kroger',
            success: false,
            itemsAdded: 0,
            itemsFailed: krogerItems.length,
            errors: [err instanceof Error ? err.message : 'Kroger cart error'],
          });
        }
      }
    }

    // ── Amazon URL-based cart ──────────────────────────────────
    // Amazon has no URL that adds items to a user's personal cart.
    // /gp/aws/cart/add.html creates a separate "Associates cart" and breaks after
    // auth redirects. Best UX: open the product page so the user taps "Add to Cart".
    let amazonCartUrl: string | null = null;
    if (amazonItems.length > 0) {
      const amazonItemsWithAsin = amazonItems.filter((i) => i.asin);
      if (amazonItemsWithAsin.length > 0) {
        const firstAsin = amazonItemsWithAsin[0].asin!;
        amazonCartUrl = `https://www.amazon.com/dp/${encodeURIComponent(firstAsin)}`;
        results.push({
          store: 'amazon',
          success: true,
          itemsAdded: amazonItemsWithAsin.length,
          itemsFailed: amazonItems.length - amazonItemsWithAsin.length,
          errors: [],
        });
      } else {
        results.push({
          store: 'amazon',
          success: false,
          itemsAdded: 0,
          itemsFailed: amazonItems.length,
          errors: ['No ASINs found for Amazon items — please add manually.'],
        });
      }
    }

    const submittedIds = results
      .filter((r) => r.success)
      .flatMap((r) => items.filter((i) => i.store === r.store).map((i) => i.id));

    // ── Record price history for successfully submitted items ─
    const successfulItems = items.filter((i) =>
      results.some((r) => r.success && r.store === i.store)
    );
    if (successfulItems.length > 0) {
      const historyRows = successfulItems
        .filter((i) => i.price > 0)
        .map((i) => ({
          product_name: i.name,
          store: i.store,
          price: i.price,
          price_per_unit: null as number | null,
          unit: i.size || null,
          user_id: user.id,
        }));
      if (historyRows.length > 0) {
        // Fire-and-forget — don't fail the cart submission if history insert fails
        supabase.from('price_history').insert(historyRows).then(({ error }) => {
          if (error) console.error('[price_history] Insert failed:', error.message);
        });
      }
    }

    // If any store needs OAuth, surface it at the top level
    const needsAuth = results.find((r) => r.authUrl);
    if (needsAuth) {
      // Return 200 (not 401) so iOS can decode the results array and show
      // the "Not authenticated" message + re-link prompt. A 401 is swallowed
      // by APIClient before the body is parsed.
      return NextResponse.json(
        { success: false, results, submittedIds, authUrl: needsAuth.authUrl }
      );
    }

    return NextResponse.json({
      success: results.length === 0 || results.every((r) => r.success),
      results,
      submittedIds,
      amazonCartUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
