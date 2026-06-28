import { NextResponse, type NextRequest } from 'next/server';
import { getOAuthStateStore } from '@/lib/data/oauth-state';
import { getUserRepository } from '@/lib/data/user';
import { createSession } from '@/lib/auth/session';

/**
 * Cognito configuration for tenant user social sign-in (ADR-0014).
 */
const COGNITO_DOMAIN = 'https://bench-auth.auth.eu-west-2.amazoncognito.com';
const CLIENT_ID = '7c6m3ubjne0u3adejpn58ou8cr';

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
 * GET /login/auth/callback
 *
 * Handles the OAuth callback from Cognito after Google/Apple sign-in:
 * 1. Verifies the CSRF state token
 * 2. Exchanges the authorization code for tokens
 * 3. Extracts the email from the ID token
 * 4. Looks up the user by email in the UserRepository
 * 5. Creates an admin session and redirects to dashboard
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // In Amplify SSR, request.url/nextUrl.origin returns localhost.
  // Read actual host from headers for all redirects.
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('[login-auth] OAuth error:', error, searchParams.get('error_description'));
    return NextResponse.redirect(`${origin}/login?error=oauth_error`);
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  // Verify CSRF state
  const stateStore = getOAuthStateStore();
  const stateData = await stateStore.verify(state);
  if (!stateData) {
    console.error('[login-auth] Invalid or expired state token');
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  // Build the redirect URI (must match exactly what was sent in the authorize request)
  const redirectUri = `${origin}/login/auth/callback`;

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
    console.error('[login-auth] Token exchange failed:', tokenResponse.status, errorText);
    return NextResponse.redirect(`${origin}/login?error=token_exchange_failed`);
  }

  const tokens = (await tokenResponse.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokens.id_token) {
    console.error('[login-auth] No ID token in response');
    return NextResponse.redirect(`${origin}/login?error=no_id_token`);
  }

  // Decode the ID token to get the email
  let email: string;
  try {
    const claims = decodeJwtPayload(tokens.id_token);
    email = String(claims.email ?? '').trim().toLowerCase();
  } catch (err) {
    console.error('[login-auth] Failed to decode ID token:', err);
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
  }

  if (!email) {
    console.error('[login-auth] No email in ID token');
    return NextResponse.redirect(`${origin}/login?error=no_email`);
  }

  // Look up the user by email
  const userRepo = getUserRepository();
  const user = await userRepo.getByEmail(email);

  if (!user) {
    console.error('[login-auth] No user found for email:', email);
    return NextResponse.redirect(`${origin}/login?error=user_not_found`);
  }

  // Create admin session
  await createSession({
    kind: 'admin',
    tenantId: user.tenantId,
    email: user.email,
    role: 'owner',
  });

  // Redirect to dashboard
  return NextResponse.redirect(`${origin}/dashboard`);
}
