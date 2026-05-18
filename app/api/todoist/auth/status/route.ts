import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/todoist/auth/status
 * Returns whether the current user has linked their Todoist account.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await createRequestClient(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('todoist_auth')
    .select('updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    linked: data !== null,
    linked_at: data?.updated_at ?? null,
  });
}
