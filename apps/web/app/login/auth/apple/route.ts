import { NextResponse, type NextRequest } from 'next/server';
import { getOAuthStateStore } from '@/lib/data/oauth-state';

/**
 * Cognito configuration for tenant user social sign-in (ADR-0014).
 *
 * These values come from the deployed BenchAuthStack (INFRA lane).
 */
const COGNITO_DOMAIN = 'https://bench-auth.auth.eu-west-2.amazoncognito.com';
const CLIENT_ID = '7c6m3ubjne0u3adejpn58ou8cr';

/**
 * GET /login/auth/apple
 *
 * Initiates the Apple OAuth flow via Cognito. Generates a CSRF state token,
 * stores it with the request origin, and redirects to Cognito's authorize
 * endpoint with `identity_provider=SignInWithApple`.
 *
 * The callback route verifies the state and exchanges the code for tokens,
 * then looks up the user by email and creates an admin session.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // In Amplify SSR, nextUrl.origin returns localhost. Read actual host from headers.
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;
  const redirectUri = `${origin}/login/auth/callback`;

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
    identity_provider: 'SignInWithApple',
  });

  const authorizeUrl = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;

  return NextResponse.redirect(authorizeUrl);
}
