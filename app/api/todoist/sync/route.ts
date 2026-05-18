import { NextRequest, NextResponse } from 'next/server';
import { pullGroceryItems } from '@/lib/todoist/client';
import { createRequestClient } from '@/lib/supabase/server';

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
    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Try per-user OAuth token first, fall back to env token
    let todoistToken: string | undefined;
    const { data: auth } = await supabase
      .from('todoist_auth')
      .select('access_token')
      .maybeSingle();
    if (auth?.access_token) {
      todoistToken = auth.access_token;
    }

    // Get project name from user settings
    const { data: projectSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'todoist_project_name')
      .maybeSingle();
    const projectName = projectSetting?.value || undefined;

    const items = await pullGroceryItems(todoistToken, projectName);

    return NextResponse.json({
      success: true,
      project_name: projectName || process.env.TODOIST_PROJECT_NAME || 'groceries',
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
