import { NextRequest, NextResponse } from 'next/server';
import { addItemsToCart, CartItemInput } from '@/lib/kroger/cart';
import { getKrogerAccessToken, KrogerAuthExpiredError } from '@/lib/kroger/token_manager';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/kroger/cart
 * Pushes items to the user's King Soopers / Kroger cart.
 * Body: { items: [{ upc: string, quantity: number }] }
 * Automatically handles user-level authentication via stored token and refresh.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const items: CartItemInput[] = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No items to add.' }, { status: 400 });
    }

    // 1. Get access token from this user's kroger_auth row (auto-refreshes if expired)
    const token = await getKrogerAccessToken(supabase);

    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Kroger authentication required.', 
        authUrl: '/api/kroger/auth/authorize' 
      }, { status: 401 });
    }

    // 2. Add to cart via Kroger API
    await addItemsToCart(token, items);

    return NextResponse.json({
      success: true,
      addedCount: items.length,
      message: `Successfully added ${items.length} item${items.length !== 1 ? 's' : ''} to your King Soopers cart.`
    });
  } catch (error) {
    if (error instanceof KrogerAuthExpiredError) {
      return NextResponse.json(
        { success: false, error: error.message, authUrl: '/api/kroger/auth/authorize' },
        { status: 401 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kroger cart addition error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
