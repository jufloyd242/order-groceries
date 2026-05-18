import { NextRequest, NextResponse } from 'next/server';
import { getTodoistAuthorizationUrl } from '@/lib/todoist/auth';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/todoist/auth/authorize
 * Starts the Todoist OAuth2 flow.
 * iOS / API clients (Accept: application/json): returns { authUrl } as JSON.
 * Web clients: redirects to Todoist login page.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const redirectUri =
      process.env.TODOIST_REDIRECT_URI ||
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/todoist/auth/callback`;

    // iOS passes a state param (Supabase JWT) for callback auth
    const state = request.nextUrl.searchParams.get('state') || undefined;
    const authUrl = getTodoistAuthorizationUrl(redirectUri, state);

    const acceptHeader = request.headers.get('accept') ?? '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({ success: true, authUrl });
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
