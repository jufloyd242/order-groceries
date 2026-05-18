import { NextRequest, NextResponse } from 'next/server';
import { createTask } from '@/lib/todoist/client';
import { createClient, createRequestClient } from '@/lib/supabase/server';

/**
 * POST /api/todoist/task
 *
 * Creates a new task in the configured Todoist grocery project,
 * tagged with the sgo_added label so it can be identified as app-created.
 *
 * Body: { content: string }
 * Returns: { success: true, todoist_task_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    // Fetch per-user Todoist token if available
    const { data: todoistAuth } = await supabase
      .from('todoist_auth')
      .select('access_token')
      .maybeSingle();
    const todoistToken = todoistAuth?.access_token || undefined;

    const todoist_task_id = await createTask(content.trim(), todoistToken);

    return NextResponse.json({ success: true, todoist_task_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create Todoist task error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
