import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closeTask } from '@/lib/todoist/client';

/**
 * POST /api/list/cleanup-on-cart
 *
 * Called when items are added to the shopping cart.
 * Conditionally removes items from the local list and completes Todoist tasks,
 * respecting the auto_remove_on_cart setting and the retained_items list.
 *
 * Body: { listItemIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { listItemIds } = await request.json();

    if (!listItemIds || !Array.isArray(listItemIds) || listItemIds.length === 0) {
      return NextResponse.json({ success: true, removed: 0, todoistClosed: 0 });
    }

    const supabase = await createClient();

    // 1. Check the auto_remove_on_cart setting
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['auto_remove_on_cart', 'retained_items']);

    const settings = (settingsData || []).reduce<Record<string, string>>((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const autoRemove = settings.auto_remove_on_cart !== 'false'; // default: true
    if (!autoRemove) {
      return NextResponse.json({ success: true, removed: 0, todoistClosed: 0, reason: 'auto_remove disabled' });
    }

    // 2. Parse retained items set (lowercase for case-insensitive matching)
    const retainedSet = new Set(
      (settings.retained_items || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );

    // 3. Fetch the list items we're processing
    const { data: listItems, error: fetchError } = await supabase
      .from('list_items')
      .select('id, raw_text, normalized_text, todoist_task_id')
      .in('id', listItemIds);

    if (fetchError) throw fetchError;
    if (!listItems || listItems.length === 0) {
      return NextResponse.json({ success: true, removed: 0, todoistClosed: 0 });
    }

    // 4. Separate into removable vs retained
    const toRemove = listItems.filter((item) => {
      const name = (item.normalized_text || item.raw_text).toLowerCase();
      return !retainedSet.has(name);
    });

    const retained = listItems.filter((item) => {
      const name = (item.normalized_text || item.raw_text).toLowerCase();
      return retainedSet.has(name);
    });

    // 5. Delete removable items from local list
    let removedCount = 0;
    if (toRemove.length > 0) {
      const removeIds = toRemove.map((i) => i.id);
      const { error: deleteError } = await supabase
        .from('list_items')
        .delete()
        .in('id', removeIds);

      if (deleteError) {
        console.error('Failed to delete list items:', deleteError);
      } else {
        removedCount = removeIds.length;
      }
    }

    // 6. Complete Todoist tasks for removable items (fire-and-forget, don't block)
    let todoistClosed = 0;
    const todoistTasks = toRemove.filter((i) => i.todoist_task_id);
    for (const item of todoistTasks) {
      try {
        await closeTask(item.todoist_task_id!);
        todoistClosed++;
      } catch (err) {
        console.error(`Failed to close Todoist task ${item.todoist_task_id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      removed: removedCount,
      todoistClosed,
      retained: retained.map((i) => i.raw_text),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup-on-cart error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
