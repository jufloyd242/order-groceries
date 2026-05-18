import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * DELETE /api/todoist/auth/unlink
 * Removes the current user's stored Todoist OAuth token.
 */
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await createRequestClient(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('todoist_auth')
    .delete()
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
