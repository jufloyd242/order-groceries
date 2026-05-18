import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/server';
import { closeTask } from '@/lib/todoist/client';

/**
 * POST /api/list/cleanup-on-cart
 *
 * Called after a successful cart submission to a store.
 * 1. Marks submitted items as 'purchased'.
 * 2. Closes corresponding Todoist tasks.
 * 3. Auto-recreates staple (persistent) items as new 'pending' rows
 *    so they're ready for the next shopping trip.
 *
 * Body: { listItemIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { listItemIds } = await request.json();

    if (!listItemIds || !Array.isArray(listItemIds) || listItemIds.length === 0) {
      return NextResponse.json({ success: true, purchased: 0, todoistClosed: 0, staplesRestored: 0 });
    }

    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Fetch full item data (need persistent flag + preference link for staple recreation)
    const { data: listItems, error: fetchError } = await supabase
      .from('list_items')
      .select('id, raw_text, normalized_text, quantity, unit, quantity_type, min_required_amount, min_required_unit, source, todoist_task_id, persistent, department, preference_id, user_id')
      .in('id', listItemIds);

    if (fetchError) throw fetchError;
    if (!listItems || listItems.length === 0) {
      return NextResponse.json({ success: true, purchased: 0, todoistClosed: 0, staplesRestored: 0 });
    }

    // 2. Mark all submitted items as 'purchased'
    const { error: updateError } = await supabase
      .from('list_items')
      .update({ status: 'purchased', purchased_at: new Date().toISOString() })
      .in('id', listItemIds);

    if (updateError) throw updateError;

    // 3. Close corresponding Todoist tasks (swallow individual errors)
    // Fetch per-user Todoist token if available
    const { data: todoistAuth } = await supabase
      .from('todoist_auth')
      .select('access_token')
      .maybeSingle();
    const todoistToken = todoistAuth?.access_token || undefined;

    let todoistClosed = 0;
    const closePromises = listItems
      .filter((i) => i.todoist_task_id)
      .map(async (item) => {
        try {
          await closeTask(item.todoist_task_id!, todoistToken);
          todoistClosed++;
        } catch (err) {
          console.error(`Failed to close Todoist task ${item.todoist_task_id}:`, err);
        }
      });
    await Promise.allSettled(closePromises);

    // 4. Auto-recreate staple items as new 'pending' rows
    const stapleItems = listItems.filter((i) => i.persistent === true);
    let staplesRestored = 0;
    if (stapleItems.length > 0) {
      const newRows = stapleItems.map((item) => ({
        raw_text: item.raw_text,
        normalized_text: item.normalized_text,
        quantity: 1, // Reset to 1 for next trip
        unit: item.unit,
        quantity_type: item.quantity_type,
        min_required_amount: item.min_required_amount,
        min_required_unit: item.min_required_unit,
        source: 'manual' as const,
        status: 'pending' as const,
        persistent: true,
        department: item.department,
        preference_id: item.preference_id, // Keep the same product mapping
        user_id: item.user_id,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('list_items')
        .insert(newRows)
        .select('id');

      if (insertError) {
        console.error('Failed to recreate staple items:', insertError.message);
      } else {
        staplesRestored = inserted?.length ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      purchased: listItems.length,
      todoistClosed,
      staplesRestored,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('cleanup-on-cart error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

