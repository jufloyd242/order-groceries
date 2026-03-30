import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/kroger/auth';

/**
 * GET /api/kroger/auth/authorize
 * Starts the Kroger OAuth2 Authorization Code flow.
 * Redirects the user to the Kroger login page.
 */
export async function GET(request: NextRequest) {
  try {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/kroger/auth/callback`;

    const authUrl = getAuthorizationUrl(redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
