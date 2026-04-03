import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/kroger/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/kroger/auth/authorize
 * Starts the Kroger OAuth2 Authorization Code flow.
 * Redirects the user to the Kroger login page.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Use env variable so redirect_uri always matches what's registered in the Kroger Developer Portal
    const redirectUri = process.env.KROGER_REDIRECT_URI
      || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/kroger/auth/callback`;

    const authUrl = getAuthorizationUrl(redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
