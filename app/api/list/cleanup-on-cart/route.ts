import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closeTask } from '@/lib/todoist/client';

/**
 * POST /api/list/cleanup-on-cart
 *
 * Called after a successful cart submission to a store.
 * Soft-deletes list_items by setting status to 'purchased' (never hard-deletes).
 * Also completes the corresponding Todoist tasks.
 *
 * Body: { listItemIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { listItemIds } = await request.json();

    if (!listItemIds || !Array.isArray(listItemIds) || listItemIds.length === 0) {
      return NextResponse.json({ success: true, purchased: 0, todoistClosed: 0 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Fetch items to get their todoist_task_ids before updating
    const { data: listItems, error: fetchError } = await supabase
      .from('list_items')
      .select('id, todoist_task_id')
      .in('id', listItemIds);

    if (fetchError) throw fetchError;
    if (!listItems || listItems.length === 0) {
      return NextResponse.json({ success: true, purchased: 0, todoistClosed: 0 });
    }

    // 2. Soft-delete: mark all submitted items as 'purchased'
    const { error: updateError } = await supabase
      .from('list_items')
      .update({ status: 'purchased' })
      .in('id', listItemIds);

    if (updateError) throw updateError;

    // 3. Close corresponding Todoist tasks (swallow individual errors)
    let todoistClosed = 0;
    const closePromises = listItems
      .filter((i) => i.todoist_task_id)
      .map(async (item) => {
        try {
          await closeTask(item.todoist_task_id!);
          todoistClosed++;
        } catch (err) {
          console.error(`Failed to close Todoist task ${item.todoist_task_id}:`, err);
        }
      });
    await Promise.allSettled(closePromises);

    // Dispatch status change so the home page re-fetches
    return NextResponse.json({ success: true, purchased: listItems.length, todoistClosed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('cleanup-on-cart error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

