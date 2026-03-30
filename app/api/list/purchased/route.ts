import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/list/purchased
 * Bulk mark multiple items as purchased.
 * Body: { itemIds: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const itemIds = body.itemIds;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemIds array required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('list_items')
      .update({
        status: 'purchased',
        updated_at: new Date().toISOString(),
      })
      .in('id', itemIds);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${itemIds.length} item(s) marked as purchased`,
      count: itemIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bulk mark purchased error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
