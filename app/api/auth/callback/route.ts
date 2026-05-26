import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/auth/callback
 *
 * Handles the redirect from Supabase after Google OAuth.
 * Exchanges the one-time `code` for a persistent session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Cloud Run terminates TLS at the load balancer and forwards the real host via
  // x-forwarded-host / x-forwarded-proto headers. Using request.url directly
  // returns the internal container address (http://0.0.0.0:8080).
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('Auth callback error:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
