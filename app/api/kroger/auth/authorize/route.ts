import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/kroger/auth';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/kroger/auth/authorize
 * Starts the Kroger OAuth2 Authorization Code flow.
 *
 * Web clients: redirects to the Kroger login page.
 * iOS / API clients (Accept: application/json): returns { authUrl } as JSON so the
 * caller can open the URL in ASWebAuthenticationSession.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await createRequestClient(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const redirectUri = process.env.KROGER_REDIRECT_URI
      || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/kroger/auth/callback`;

    // iOS sends Accept: application/json — return JSON instead of a redirect.
    // Embed state=<userId> (36-char UUID) in the URL so the callback can identify
    // the user without browser cookies. The iOS app opens this URL as-is and must
    // NOT append anything extra — Kroger rejects URLs with oversized state params.
    const acceptHeader = request.headers.get('accept') ?? '';
    if (acceptHeader.includes('application/json')) {
      const authUrl = getAuthorizationUrl(redirectUri, user.id);
      return NextResponse.json({ success: true, authUrl });
    }

    const authUrl = getAuthorizationUrl(redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
