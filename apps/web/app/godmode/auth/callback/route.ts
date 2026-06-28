import { NextResponse, type NextRequest } from 'next/server';
import { getOAuthStateStore } from '@/lib/data/oauth-state';
import { createSession } from '@/lib/auth/session';

/**
 * Cognito configuration for godmode Google sign-in (ADR-0012).
 */
const COGNITO_DOMAIN = 'https://bench-auth.auth.eu-west-2.amazoncognito.com';
const CLIENT_ID = '7c6m3ubjne0u3adejpn58ou8cr';

/**
 * Allowed email domain for godmode access.
 * Only users with this email domain can sign in as platform admins.
 */
const ALLOWED_EMAIL_DOMAIN = '@flowency.co.uk';

/**
 * Decode a JWT payload without verification.
 * The token is already validated by Cognito, so we just need to extract claims.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = parts[1];
  if (!payload) {
    throw new Error('Invalid JWT: missing payload');
  }
  const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
  return JSON.parse(decoded) as Record<string, unknown>;
}

/**
 * GET /godmode/auth/callback
 *
 * Handles the OAuth callback from Cognito after Google sign-in:
 * 1. Verifies the CSRF state token
 * 2. Exchanges the authorization code for tokens
 * 3. Extracts the email from the ID token
 * 4. Asserts the email domain is allowed
 * 5. Creates a platform session and redirects to godmode
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('[godmode-auth] OAuth error:', error, searchParams.get('error_description'));
    return NextResponse.redirect(
      new URL('/godmode/login?error=oauth_error', request.url),
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/godmode/login?error=missing_params', request.url),
    );
  }

  // Verify CSRF state
  const stateStore = getOAuthStateStore();
  const stateData = await stateStore.verify(state);
  if (!stateData) {
    console.error('[godmode-auth] Invalid or expired state token');
    return NextResponse.redirect(
      new URL('/godmode/login?error=invalid_state', request.url),
    );
  }

  // Build the redirect URI (must match exactly what was sent in the authorize request)
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/godmode/auth/callback`;

  // Exchange code for tokens
  const tokenResponse = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[godmode-auth] Token exchange failed:', tokenResponse.status, errorText);
    return NextResponse.redirect(
      new URL('/godmode/login?error=token_exchange_failed', request.url),
    );
  }

  const tokens = (await tokenResponse.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokens.id_token) {
    console.error('[godmode-auth] No ID token in response');
    return NextResponse.redirect(
      new URL('/godmode/login?error=no_id_token', request.url),
    );
  }

  // Decode the ID token to get the email
  let email: string;
  try {
    const claims = decodeJwtPayload(tokens.id_token);
    email = String(claims.email ?? '').trim().toLowerCase();
  } catch (err) {
    console.error('[godmode-auth] Failed to decode ID token:', err);
    return NextResponse.redirect(
      new URL('/godmode/login?error=invalid_token', request.url),
    );
  }

  if (!email) {
    console.error('[godmode-auth] No email in ID token');
    return NextResponse.redirect(
      new URL('/godmode/login?error=no_email', request.url),
    );
  }

  // Assert email domain
  if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
    console.error('[godmode-auth] Email domain not allowed:', email);
    return NextResponse.redirect(
      new URL('/godmode/login?error=unauthorized_domain', request.url),
    );
  }

  // Create platform session
  await createSession({
    kind: 'platform',
    email,
  });

  // Redirect to godmode dashboard
  return NextResponse.redirect(new URL('/godmode', request.url));
}
