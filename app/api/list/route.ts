import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/list
 * Returns all current shopping list items from Supabase.
 */
export async function GET() {
  const supabase = await createClient();
  
  const { data: items, error } = await supabase
    .from('list_items')
    .select('*')
    .order('created_at', { ascending: true }); // old items at top, like a list

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    count: items?.length || 0,
    items: items || [],
  });
}

/**
 * POST /api/list
 * Add one or more items to the shopping list.
 * Body: { items: [{ raw_text: "milk", source?: "manual" | "todoist", todoist_task_id?: "..." }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const newItems = body.items || [body];

    // Get existing to prevent duplicates
    const { data: existingData } = await supabase.from('list_items').select('raw_text');
    const existingTexts = existingData ? existingData.map(e => e.raw_text.toLowerCase()) : [];

    const itemsToInsert = [];
    const skipped = [];

    for (const item of newItems) {
      if (!item.raw_text || typeof item.raw_text !== 'string') {
        continue;
      }

      const trimmed = item.raw_text.trim();
      if (!trimmed) continue;

      if (existingTexts.includes(trimmed.toLowerCase())) {
        skipped.push(trimmed);
        continue;
      }

      itemsToInsert.push({
        raw_text: trimmed,
        source: item.source || 'manual',
        todoist_task_id: item.todoist_task_id || null,
        status: 'pending',
      });
      existingTexts.push(trimmed.toLowerCase()); // prevent dupes in same batch
    }

    if (itemsToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        added: 0,
        skipped: skipped.length,
        items: [],
      });
    }

    const { data: inserted, error } = await supabase
      .from('list_items')
      .insert(itemsToInsert)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      added: inserted?.length || 0,
      skipped: skipped.length,
      items: inserted || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/list
 * Remove item(s) from the list.
 * Body: { id: "single-id" } or { ids: ["id1", "id2"] } or { clear: true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (body.clear === true) {
      // Just delete everything
      const { error } = await supabase.from('list_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      return NextResponse.json({ success: true, removed: 'all' });
    }

    const idsToRemove: string[] = body.ids || (body.id ? [body.id] : []);

    if (idsToRemove.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provide id, ids, or clear: true' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('list_items').delete().in('id', idsToRemove);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      removed: idsToRemove.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
