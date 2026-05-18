import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/kroger/auth';
import { saveKrogerAuth } from '@/lib/kroger/token_manager';
import { createClient, createRequestClient, createServiceClient } from '@/lib/supabase/server';

// Matches a Supabase UUID used as the OAuth state param in the new iOS flow.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    // Authenticate the callback — three cases:
    //   UUID state  → new iOS flow: state is the Supabase userId embedded by /authorize
    //   eyJ* state  → legacy iOS flow: state is the raw Supabase JWT (kept for old builds)
    //   no state    → web browser: use cookie-based session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase: any;
    let user: { id: string } | null = null;

    if (state && UUID_RE.test(state)) {
      // New iOS: /authorize embedded the userId as state — use service role to act on their behalf
      supabase = createServiceClient();
      user = { id: state };
    } else if (state && state.startsWith('eyJ')) {
      // Legacy iOS: state is the Supabase JWT
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
    await saveKrogerAuth(supabase, tokenResult, user.id);

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
