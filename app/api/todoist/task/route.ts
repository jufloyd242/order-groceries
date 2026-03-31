import { NextRequest, NextResponse } from 'next/server';
import { createTask } from '@/lib/todoist/client';

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
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    const todoist_task_id = await createTask(content.trim());

    return NextResponse.json({ success: true, todoist_task_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create Todoist task error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
