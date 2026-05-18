import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/todoist/projects
 * Lists the authenticated user's Todoist projects using their stored OAuth token.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user's Todoist token
    const { data: auth, error: authError } = await supabase
      .from('todoist_auth')
      .select('access_token')
      .maybeSingle();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    if (!auth) {
      return NextResponse.json(
        { error: 'Todoist account not linked. Link it in Settings.' },
        { status: 401 }
      );
    }

    // Fetch projects from Todoist REST API
    const res = await fetch('https://api.todoist.com/rest/v2/projects', {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Todoist API error: ${res.status} ${body}` },
        { status: res.status }
      );
    }

    const projects: Array<{ id: string; name: string; color: string; is_favorite: boolean }> =
      await res.json();

    return NextResponse.json({
      success: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isFavorite: p.is_favorite,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Todoist projects error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
