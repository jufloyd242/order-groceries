import { createServerClient } from '@supabase/ssr';
import { createClient as createJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if middleware is refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client using the service role key.
 * Use this for write operations (INSERT, UPDATE, DELETE) from server-side
 * API routes to bypass RLS while keeping the anon key for reads.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (never NEXT_PUBLIC_).
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Fall back to anon key gracefully — e.g., during local dev without the key set.
    console.warn(
      'SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. ' +
      'Set this env var in production for proper RLS bypass on writes.'
    );
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

/**
 * Create a Supabase client that accepts EITHER:
 *   - A cookie-based session (web browser)
 *   - An Authorization: Bearer <token> header (iOS app)
 *
 * Use this in API routes that need to support both the web UI and the iOS companion app.
 */
export async function createRequestClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const client = createJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      }
    );
    const { data: { user } } = await client.auth.getUser(token);
    return { supabase: client, user };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
