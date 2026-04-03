import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/list/restore-pinned
 *
 * Reactivates all pinned (persistent = true) items that are currently 'purchased'
 * by flipping their status back to 'pending'. Also dispatches a list-status-changed
 * signal via the response so the client can re-fetch.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: updated, error } = await supabase
      .from('list_items')
      .update({ status: 'pending' })
      .eq('persistent', true)
      .eq('status', 'purchased')
      .select('id');

    if (error) throw error;

    return NextResponse.json({ success: true, restored: updated?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('restore-pinned error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
