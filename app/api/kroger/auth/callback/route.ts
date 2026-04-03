import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/kroger/auth';
import { saveKrogerAuth } from '@/lib/kroger/token_manager';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/kroger/auth/callback
 * Handles the redirection from Kroger after the user grants authorization.
 * Exchanges the code for a token and stores it for the current user.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Kroger OAuth Error:', error);
      return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/settings?error=missing_code`);
    }

    const redirectUri = process.env.KROGER_REDIRECT_URI
      || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/kroger/auth/callback`;

    // 1. Exchange code for token
    const tokenResult = await exchangeCodeForToken(code, redirectUri);

    // 2. Save token for this user
    await saveKrogerAuth(supabase, tokenResult);

    return NextResponse.redirect(`${origin}/settings?success=kroger_auth`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Kroger callback error:', message);
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(message)}`);
  }
}
