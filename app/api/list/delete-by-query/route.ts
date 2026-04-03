import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/list/delete-by-query
 * Delete list items that match a search query.
 * Used when a user adds products to cart from the search page.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Find list items where the name contains or matches the query
    const { data: items, error: fetchError } = await supabase
      .from('list_items')
      .select('id')
      .ilike('name', `%${query}%`);

    if (fetchError) {
      console.error('Error fetching list items:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch list items' },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No matching items found',
      });
    }

    const itemIds = items.map((item) => item.id);

    // Delete the matching items
    const { error: deleteError } = await supabase
      .from('list_items')
      .delete()
      .in('id', itemIds);

    if (deleteError) {
      console.error('Error deleting list items:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete list items' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: itemIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete list items error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
