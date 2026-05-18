import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/kroger/auth';
import { saveKrogerAuth } from '@/lib/kroger/token_manager';
import { createClient, createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/kroger/auth/callback
 * Handles the redirection from Kroger after the user grants authorization.
 * Exchanges the code for a token and stores it for the current user.
 *
 * iOS flow: the Supabase JWT is passed as the OAuth `state` parameter so the
 * callback can authenticate without browser cookies. On success the response
 * redirects to `smartgroceryoptimizer://kroger/linked` which ASWebAuthenticationSession
 * intercepts to close the browser sheet.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // iOS passes the Supabase JWT here

    // Authenticate: prefer state-carried JWT (iOS), fall back to session cookie (web)
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let user: { id: string } | null = null;

    if (state && state.startsWith('eyJ')) {
      // state contains the Supabase JWT — build a synthetic request to validate it
      const syntheticRequest = new Request(request.url, {
        headers: { Authorization: `Bearer ${state}` },
      });
      const result = await createRequestClient(syntheticRequest as NextRequest);
      supabase = result.supabase;
      user = result.user;
    } else {
      supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    const isIOS = state !== null;

    if (!user) {
      return isIOS
        ? NextResponse.redirect('smartgroceryoptimizer://kroger/error?reason=unauthenticated')
        : NextResponse.redirect(`${origin}/login`);
    }

    if (error) {
      console.error('Kroger OAuth Error:', error);
      return isIOS
        ? NextResponse.redirect(`smartgroceryoptimizer://kroger/error?reason=${encodeURIComponent(error)}`)
        : NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return isIOS
        ? NextResponse.redirect('smartgroceryoptimizer://kroger/error?reason=missing_code')
        : NextResponse.redirect(`${origin}/settings?error=missing_code`);
    }

    const redirectUri = process.env.KROGER_REDIRECT_URI
      || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/kroger/auth/callback`;

    // 1. Exchange code for token
    const tokenResult = await exchangeCodeForToken(code, redirectUri);

    // 2. Save token for this user
    await saveKrogerAuth(supabase, tokenResult);

    // 3. Redirect — iOS gets a custom scheme URL that ASWebAuthenticationSession intercepts
    return isIOS
      ? NextResponse.redirect('smartgroceryoptimizer://kroger/linked')
      : NextResponse.redirect(`${origin}/settings?success=kroger_auth`);
  } catch (err) {
    console.error('[kroger/callback] Caught error:', err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    const { searchParams } = new URL(request.url);
    const isIOS = searchParams.get('state') !== null;
    return isIOS
      ? NextResponse.redirect(`smartgroceryoptimizer://kroger/error?reason=${encodeURIComponent(message)}`)
      : NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(message)}`);
  }
}
