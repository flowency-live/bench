import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
  signToken,
  nowSeconds,
  type Session,
} from '@/lib/auth/session-token';
import { PILOT_TENANT_ID } from '@/lib/tenant';

/**
 * Edge auth middleware.
 *
 * Verifies the `bench_session` cookie (Web Crypto HMAC, the SAME verifier used
 * server-side) and gates protected routes:
 *
 *  - /dashboard, /profiles/*, /admin/*  → require a valid session.
 *  - /profiles/:id/edit (the wizard)    → allowed for an admin session, OR a
 *    member session whose profileId matches :id.
 *
 * Public (no session needed): /login, /auth/*, /share/*, /invite/*, Next
 * internals and static assets. The matcher already excludes most static paths;
 * the in-handler allow-list is defence in depth.
 *
 * NOTE: middleware runs on the Edge runtime — keep this dependency-light and use
 * Web Crypto only. `verifySessionToken` is pure (no `next/headers`), so it is
 * Edge-safe.
 */

/** Path prefixes that always bypass auth. */
const PUBLIC_PREFIXES = [
  '/login',
  '/auth/',
  '/share/',
  '/invite/',
  '/_next/',
  '/favicon.ico',
  '/logo-change-connected.webp',
];

function isPublic(pathname: string): boolean {
  if (pathname === '/auth' || pathname === '/login') return true;
  // Godmode sign-in + its auth callbacks are public (no platform session yet).
  if (pathname === '/godmode/login' || pathname.startsWith('/godmode/login/')) {
    return true;
  }
  if (pathname === '/godmode/auth' || pathname.startsWith('/godmode/auth/')) {
    return true;
  }
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Godmode routes that require a `platform` session (excludes the public ones). */
function isGodmode(pathname: string): boolean {
  return pathname === '/godmode' || pathname.startsWith('/godmode/');
}

function isProtected(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/profiles/') ||
    pathname.startsWith('/admin/') ||
    isGodmode(pathname)
  );
}

/** Match `/profiles/:id/edit` and return the profile id, else null. */
function editProfileId(pathname: string): string | null {
  const match = /^\/profiles\/([^/]+)\/edit(?:\/.*)?$/.exec(pathname);
  const id = match?.[1];
  return id ? decodeURIComponent(id) : null;
}

function authorize(session: Session, pathname: string): boolean {
  // Godmode routes require a platform session.
  if (isGodmode(pathname)) {
    return session.kind === 'platform';
  }

  // A platform session may reach tenant routes ONLY once it has switched into a
  // tenant (impersonation); `activeTenantId` is set by the switchTenant action.
  if (session.kind === 'platform') {
    return session.activeTenantId != null;
  }

  // Admins can reach anything protected (non-godmode).
  if (session.kind === 'admin') return true;

  // Members may ONLY reach the edit wizard for their own profile.
  if (session.kind === 'member') {
    const id = editProfileId(pathname);
    return id !== null && id === session.profileId;
  }

  return false;
}

/**
 * AUTH_BYPASS mode — development only.
 *
 * When AUTH_BYPASS=true, the middleware auto-mints an admin session for
 * protected routes if no valid session exists. This lets developers work on
 * dashboard/profile UI without wiring up the full magic-link flow.
 *
 * The bypass session:
 * - kind: 'admin'
 * - tenantId: PILOT_TENANT_ID ('change-connected')
 * - email: 'bypass@dev.local'
 * - role: 'owner'
 * - exp: 8 hours from now
 *
 * To enable: set AUTH_BYPASS=true in .env.local (local dev) or Amplify env vars.
 * To disable: remove the var or set AUTH_BYPASS=false.
 *
 * WARNING: Never enable in production. This is for development velocity only.
 */
function isAuthBypassEnabled(): boolean {
  return process.env.AUTH_BYPASS === 'true';
}

async function createBypassSession(): Promise<string> {
  const payload: Session = {
    kind: 'admin',
    tenantId: PILOT_TENANT_ID,
    email: 'bypass@dev.local',
    role: 'owner',
    exp: nowSeconds() + SESSION_TTL_SECONDS,
  };
  return signToken(payload);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || !isProtected(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let session = token ? await verifySessionToken(token) : null;

  // AUTH_BYPASS auto-mints an ADMIN session — never valid for godmode, which
  // always requires a real platform session. So skip the bypass on /godmode.
  if (!session && isAuthBypassEnabled() && !isGodmode(pathname)) {
    const bypassToken = await createBypassSession();
    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE, bypassToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  }

  if (!session || !authorize(session, pathname)) {
    // Godmode routes bounce to the godmode login; everything else to /login.
    const loginPath = isGodmode(pathname) ? '/godmode/login' : '/login';
    const loginUrl = new URL(loginPath, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Run on protected paths only. Static assets, `_next`, and files with an
 * extension are excluded so the middleware never touches them.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profiles/:path*',
    '/admin/:path*',
    '/godmode',
    '/godmode/:path*',
  ],
};
