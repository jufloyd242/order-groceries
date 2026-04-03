import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reopenTask } from '@/lib/todoist/client';

/**
 * POST /api/list/revert-cart
 *
 * Called when cart items are removed manually (not after a successful store submission).
 * Reverts the corresponding list_items status back to 'pending' so they appear
 * available for search again, and reopens their Todoist tasks.
 *
 * Body: { listItemIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { listItemIds } = await request.json();

    if (!listItemIds || !Array.isArray(listItemIds) || listItemIds.length === 0) {
      return NextResponse.json({ success: true, reverted: 0, todoistReopened: 0 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Fetch the list items to get their todoist_task_ids
    const { data: listItems, error: fetchError } = await supabase
      .from('list_items')
      .select('id, todoist_task_id')
      .in('id', listItemIds);

    if (fetchError) throw fetchError;
    if (!listItems || listItems.length === 0) {
      return NextResponse.json({ success: true, reverted: 0, todoistReopened: 0 });
    }

    // 2. Revert status to 'pending' for all matching items
    const { error: updateError } = await supabase
      .from('list_items')
      .update({ status: 'pending' })
      .in('id', listItemIds);

    if (updateError) throw updateError;

    // 3. Reopen Todoist tasks in the background (swallow individual errors)
    let todoistReopened = 0;
    const reopenPromises = listItems
      .filter((item) => item.todoist_task_id)
      .map(async (item) => {
        try {
          await reopenTask(item.todoist_task_id!);
          todoistReopened++;
        } catch (err) {
          console.error(`Failed to reopen Todoist task ${item.todoist_task_id}:`, err);
        }
      });
    await Promise.allSettled(reopenPromises);

    return NextResponse.json({ success: true, reverted: listItems.length, todoistReopened });
  } catch (err) {
    console.error('revert-cart error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
