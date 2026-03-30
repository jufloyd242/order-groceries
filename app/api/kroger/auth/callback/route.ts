import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/kroger/auth';
import { saveKrogerAuth } from '@/lib/kroger/token_manager';

/**
 * GET /api/kroger/auth/callback
 * Handles the redirection from Kroger after the user grants authorization.
 * Exchanges the code for a token and stores it.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Kroger OAuth Error:', error);
      return NextResponse.redirect('/settings?error=' + encodeURIComponent(error));
    }

    if (!code) {
      return NextResponse.redirect('/settings?error=missing_code');
    }

    // Use env variable so redirect_uri always matches what's registered in the Kroger Developer Portal
    const redirectUri = process.env.KROGER_REDIRECT_URI
      || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/kroger/auth/callback`;

    // 1. Exchange code for token
    const tokenResult = await exchangeCodeForToken(code, redirectUri);

    // 2. Save token persistently in Supabase
    await saveKrogerAuth(tokenResult);

    // 3. Return to settings or home
    return NextResponse.redirect('/settings?success=kroger_auth');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kroger callback error:', message);
    return NextResponse.redirect('/settings?error=' + encodeURIComponent(message));
  }
}
