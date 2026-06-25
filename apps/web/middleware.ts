import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  verifySessionToken,
  type Session,
} from '@/lib/auth/session-token';

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
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isProtected(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/profiles/') ||
    pathname.startsWith('/admin/')
  );
}

/** Match `/profiles/:id/edit` and return the profile id, else null. */
function editProfileId(pathname: string): string | null {
  const match = /^\/profiles\/([^/]+)\/edit(?:\/.*)?$/.exec(pathname);
  const id = match?.[1];
  return id ? decodeURIComponent(id) : null;
}

function authorize(session: Session, pathname: string): boolean {
  // Admins can reach anything protected.
  if (session.kind === 'admin') return true;

  // Members may ONLY reach the edit wizard for their own profile.
  if (session.kind === 'member') {
    const id = editProfileId(pathname);
    return id !== null && id === session.profileId;
  }

  return false;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || !isProtected(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !authorize(session, pathname)) {
    const loginUrl = new URL('/login', request.url);
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
  ],
};
