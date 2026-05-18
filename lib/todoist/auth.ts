const TODOIST_AUTH_URL = 'https://todoist.com/oauth/authorize';
const TODOIST_TOKEN_URL = 'https://todoist.com/oauth/access_token';

/**
 * Build the Todoist OAuth2 Authorization URL.
 */
export function getTodoistAuthorizationUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.TODOIST_CLIENT_ID;
  if (!clientId) {
    throw new Error('TODOIST_CLIENT_ID must be set in .env.local');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'data:read_write',
    state: state || '',
    redirect_uri: redirectUri,
  });

  return `${TODOIST_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeTodoistCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string }> {
  const clientId = process.env.TODOIST_CLIENT_ID;
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TODOIST_CLIENT_ID and TODOIST_CLIENT_SECRET must be set in .env.local');
  }

  const res = await fetch(TODOIST_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Todoist token exchange failed: ${res.status} ${body}`);
  }

  return res.json();
}
