const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';
const KROGER_API_BASE = 'https://api.kroger.com/v1';

let cachedToken: { access_token: string; expires_at: number } | null = null;
// Single in-flight refresh promise shared across all parallel callers.
// Prevents a race where N items being compared simultaneously each try to
// refresh an expired token at the same moment, causing redundant requests
// and potential Kroger rate-limit errors that silently return [] per item.
let tokenRefreshPromise: Promise<string> | null = null;

/**
 * Get Kroger Client Credentials (service-to-service) access token.
 * Used for product search and location lookup — no user login needed.
 * Token is cached in memory and refreshed before expiry.
 */
export async function getClientCredentialsToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  // Deduplicate: if a refresh is already in flight, wait for it instead of
  // making a second identical request.
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'KROGER_CLIENT_ID and KROGER_CLIENT_SECRET must be set in .env.local'
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );

  tokenRefreshPromise = fetch(KROGER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Kroger auth failed: ${res.status} ${body}`);
      }
      const data = await res.json();
      cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      return cachedToken.access_token;
    })
    .finally(() => {
      tokenRefreshPromise = null;
    });

  return tokenRefreshPromise;
}

/**
 * Build the Kroger OAuth2 Authorization Code URL.
 * Used for cart operations that require user-specific auth.
 */
export function getAuthorizationUrl(redirectUri: string): string {
  const clientId = process.env.KROGER_CLIENT_ID;
  if (!clientId) {
    throw new Error('KROGER_CLIENT_ID must be set in .env.local');
  }

  const params = new URLSearchParams({
    scope: 'cart.basic:write product.compact',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  return `${KROGER_API_BASE}/connect/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token (user-specific).
 * Used after the Kroger OAuth2 callback.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'KROGER_CLIENT_ID and KROGER_CLIENT_SECRET must be set in .env.local'
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );

  const res = await fetch(KROGER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger token exchange failed: ${res.status} ${body}`);
  }

  return res.json();
}
