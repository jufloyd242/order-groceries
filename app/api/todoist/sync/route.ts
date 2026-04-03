import { NextRequest, NextResponse } from 'next/server';
import { pullGroceryItems } from '@/lib/todoist/client';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/todoist/sync
 *
 * Pulls all active tasks from the configured Todoist "groceries" project
 * and returns them as potential shopping list items.
 *
 * The client will de-duplicate these against existing list_items before inserting.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const items = await pullGroceryItems();

    return NextResponse.json({
      success: true,
      project_name: process.env.TODOIST_PROJECT_NAME || 'groceries',
      count: items.length,
      items: items.map((item) => ({
        raw_text: item.content,
        todoist_task_id: item.taskId,
        source: 'todoist' as const,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('Todoist sync error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
