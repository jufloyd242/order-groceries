import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DEV ONLY — returns the current user's Supabase access token.
// Used by the iOS simulator dev-login bypass.
// This route must NOT be deployed to production.
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    access_token: session.access_token,
    user: session.user.email,
  });
}
