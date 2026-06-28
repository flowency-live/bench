import { NextResponse, type NextRequest } from 'next/server';
import { getOAuthStateStore } from '@/lib/data/oauth-state';

/**
 * Cognito configuration for godmode Google sign-in (ADR-0012).
 *
 * These values come from the deployed BenchAuthStack (INFRA lane).
 */
const COGNITO_DOMAIN = 'https://bench-auth.auth.eu-west-2.amazoncognito.com';
const CLIENT_ID = '7c6m3ubjne0u3adejpn58ou8cr';

/**
 * GET /godmode/auth/google
 *
 * Initiates the Google OAuth flow via Cognito. Generates a CSRF state token,
 * stores it with the request origin, and redirects to Cognito's authorize
 * endpoint with `identity_provider=Google`.
 *
 * The callback route verifies the state and exchanges the code for tokens.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/godmode/auth/callback`;

  // Generate and store CSRF state
  const stateStore = getOAuthStateStore();
  const state = await stateStore.create(origin);

  // Build Cognito authorize URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'email openid profile',
    state,
    identity_provider: 'Google',
  });

  const authorizeUrl = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;

  return NextResponse.redirect(authorizeUrl);
}
