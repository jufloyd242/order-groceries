import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/list/{itemId}/purchased
 * Mark a list item as purchased (added to cart).
 * Body: (optional) { quantity: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID required' },
        { status: 400 }
      );
    }

    // Parse optional body for quantity update
    let body = {};
    try {
      body = await request.json();
    } catch {
      // No body is OK
    }

    const updates: any = {
      status: 'purchased',
      purchased_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If quantity is in body, update it
    if ('quantity' in body && typeof body.quantity === 'number') {
      updates.quantity = body.quantity;
    }

    const { error } = await supabase
      .from('list_items')
      .update(updates)
      .eq('id', itemId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Item marked as purchased`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mark purchased error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
