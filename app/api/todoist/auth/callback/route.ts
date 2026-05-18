import { NextRequest, NextResponse } from 'next/server';
import { exchangeTodoistCodeForToken } from '@/lib/todoist/auth';
import { createClient, createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/todoist/auth/callback
 * Handles the redirect from Todoist after the user grants authorization.
 * Exchanges the code for a token and stores it for the current user.
 *
 * iOS flow: the Supabase JWT is passed as the OAuth `state` parameter.
 * On success, redirects to `smartgroceryoptimizer://todoist/linked`.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // Authenticate: prefer state-carried JWT (iOS), fall back to session cookie (web)
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let user: { id: string } | null = null;

    if (state && state.startsWith('eyJ')) {
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
        ? NextResponse.redirect('smartgroceryoptimizer://todoist/error?reason=unauthenticated')
        : NextResponse.redirect(`${origin}/login`);
    }

    if (error) {
      console.error('Todoist OAuth Error:', error);
      return isIOS
        ? NextResponse.redirect(`smartgroceryoptimizer://todoist/error?reason=${encodeURIComponent(error)}`)
        : NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return isIOS
        ? NextResponse.redirect('smartgroceryoptimizer://todoist/error?reason=missing_code')
        : NextResponse.redirect(`${origin}/settings?error=missing_code`);
    }

    const redirectUri =
      process.env.TODOIST_REDIRECT_URI ||
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}/api/todoist/auth/callback`;

    // 1. Exchange code for token
    const tokenResult = await exchangeTodoistCodeForToken(code, redirectUri);

    // 2. Store token for this user (Todoist tokens don't expire, but store for consistency)
    const { error: dbError } = await supabase.from('todoist_auth').upsert(
      {
        user_id: user.id,
        access_token: tokenResult.access_token,
        refresh_token: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (dbError) {
      console.error('[todoist/callback] DB error:', dbError.message);
      return isIOS
        ? NextResponse.redirect(`smartgroceryoptimizer://todoist/error?reason=${encodeURIComponent(dbError.message)}`)
        : NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(dbError.message)}`);
    }

    // 3. Redirect
    return isIOS
      ? NextResponse.redirect('smartgroceryoptimizer://todoist/linked')
      : NextResponse.redirect(`${origin}/settings?success=todoist_auth`);
  } catch (err) {
    console.error('[todoist/callback] Caught error:', err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    const { searchParams } = new URL(request.url);
    const isIOS = searchParams.get('state') !== null;
    return isIOS
      ? NextResponse.redirect(`smartgroceryoptimizer://todoist/error?reason=${encodeURIComponent(message)}`)
      : NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(message)}`);
  }
}
