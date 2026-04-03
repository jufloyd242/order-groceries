import type { SupabaseClient } from '@supabase/supabase-js';

interface KrogerAuthData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms timestamp
}

/**
 * Thrown when Kroger refresh token is revoked or expired.
 * Callers should redirect the user through the OAuth flow.
 */
export class KrogerAuthExpiredError extends Error {
  constructor() {
    super('Kroger session expired — re-authentication required.');
    this.name = 'KrogerAuthExpiredError';
  }
}

/**
 * Get the current user's Kroger access token.
 * Auto-refreshes using the stored refresh token if the access token is expired.
 *
 * @param supabase - SSR Supabase client (scoped to the authenticated user via RLS)
 */
export async function getKrogerAccessToken(supabase: SupabaseClient): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('kroger_auth')
    .select('access_token, refresh_token, expires_at')
    .maybeSingle();

  if (error || !row) return null;

  // Token still valid (1 min buffer)
  if (Date.now() < row.expires_at - 60_000) {
    return row.access_token;
  }

  // Expired — attempt refresh
  try {
    const refreshed = await refreshKrogerToken(supabase, row.refresh_token);
    return refreshed.access_token;
  } catch (err) {
    if (err instanceof KrogerAuthExpiredError) throw err;
    console.error('Failed to refresh Kroger auth:', err);
    return null;
  }
}

/**
 * Persist new Kroger auth tokens for the current user.
 * Uses upsert with conflict on user_id (one row per user in kroger_auth table).
 *
 * @param supabase - SSR Supabase client (scoped to the authenticated user via RLS)
 */
export async function saveKrogerAuth(
  supabase: SupabaseClient,
  data: { access_token: string; refresh_token: string; expires_in: number }
): Promise<void> {
  const { error } = await supabase.from('kroger_auth').upsert(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}

/**
 * Refresh the Kroger access token using the stored refresh token.
 */
async function refreshKrogerToken(
  supabase: SupabaseClient,
  refreshTokenStr: string
): Promise<KrogerAuthData> {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';

  if (!clientId || !clientSecret) {
    throw new Error('Kroger client credentials not configured.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(KROGER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenStr,
    }).toString(),
  });

  if (!res.ok) {
    if (res.status === 401) throw new KrogerAuthExpiredError();
    throw new Error(`Kroger token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  const updated: KrogerAuthData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshTokenStr,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  // Persist refreshed tokens
  await saveKrogerAuth(supabase, {
    access_token: updated.access_token,
    refresh_token: updated.refresh_token,
    expires_in: data.expires_in,
  });

  return updated;
}

