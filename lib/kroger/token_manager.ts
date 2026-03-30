import { createClient } from '@/lib/supabase/server';

const KROGER_AUTH_KEY = 'kroger_user_auth';

interface KrogerAuthData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // timestamp
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
 * Get the current user-level Kroger access token.
 * Refreshes it automatically if expired using the refresh token.
 */
export async function getKrogerAccessToken(): Promise<string | null> {
  const supabase = await createClient();

  const { data: setting, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', KROGER_AUTH_KEY)
    .maybeSingle();

  if (error || !setting) return null;

  try {
    let authData: KrogerAuthData = JSON.parse(setting.value);

    // Check if expired (with 1 min buffer)
    if (Date.now() < authData.expires_at - 60_000) {
      return authData.access_token;
    }

    // Attempt refresh
    const refreshed = await refreshToken(authData.refresh_token);
    if (!refreshed) throw new KrogerAuthExpiredError();

    return refreshed.access_token;
  } catch (err) {
    if (err instanceof KrogerAuthExpiredError) throw err;
    console.error('Failed to parse or refresh Kroger auth:', err);
    return null;
  }
}

/**
 * Save new auth data (token exchange result) into Supabase.
 */
export async function saveKrogerAuth(data: { access_token: string, refresh_token: string, expires_in: number }): Promise<void> {
  const supabase = await createClient();
  
  const authData: KrogerAuthData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  const { error } = await supabase.from('app_settings').upsert({
    key: KROGER_AUTH_KEY,
    value: JSON.stringify(authData),
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

/**
 * Refresh the Kroger token using a refresh token.
 */
async function refreshToken(refreshTokenStr: string): Promise<KrogerAuthData | null> {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';

  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
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
      // 401 = revoked refresh token; throw typed error so callers can redirect to OAuth
      if (res.status === 401) throw new KrogerAuthExpiredError();
      throw new Error(`Refresh failed: ${res.status}`);
    }

    const data = await res.json();
    const updated: KrogerAuthData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshTokenStr, // Use new refresh token if provided
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    // Store the updated token
    await saveKrogerAuth(data);

    return updated;
  } catch (err) {
    console.error('Kroger refresh token error:', err);
    return null;
  }
}
