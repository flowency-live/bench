/**
 * Server-side session cookie helpers.
 *
 * Wraps the pure, Edge-safe token primitives in `./session-token` with the
 * cookie read/write operations that need `next/headers` `cookies()` (server
 * components, Route Handlers, server actions). The Edge middleware imports the
 * pure verifier from `./session-token` instead, so this module's `next/headers`
 * dependency never reaches the middleware bundle.
 *
 * The session is a compact, HMAC-signed token (NOT encrypted — it carries no
 * secrets, only identity + scope) stored in the `bench_session` httpOnly cookie,
 * secure in production, sameSite=lax, ~8h expiry.
 */

import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  nowSeconds,
  signToken,
  verifySessionToken,
  type Session,
  type SessionInput,
} from './session-token';

// Re-export the shared surface so callers can import everything from one place.
export {
  SESSION_COOKIE,
  verifySessionToken,
};
export type {
  Session,
  SessionInput,
  AdminSession,
  MemberSession,
  PlatformSession,
  ClientSession,
} from './session-token';

/**
 * Mint a session and set the `bench_session` cookie.
 *
 * The `exp` claim is computed here (now + 8h); the cookie's Max-Age is matched.
 */
export async function createSession(input: SessionInput): Promise<void> {
  const exp = nowSeconds() + SESSION_TTL_SECONDS;
  const payload = { ...input, exp } as Session;
  const token = await signToken(payload);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * Read + verify the current session from the request cookies.
 * Returns the payload, or `null` if absent / invalid / expired.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Clear the session cookie (sign-out). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Extract the active tenant ID from any session type.
 *
 * Used to replace hardcoded PILOT_TENANT_ID with session-derived tenant scoping.
 * Per ADR-0010 / auth-journey-build-plan.md Phase 1.
 *
 * - AdminSession/MemberSession: returns the bound `tenantId`
 * - PlatformSession: returns `activeTenantId` (set when godmode switches into a tenant)
 * - null/invalid: returns null
 */
export function getTenantId(session: Session | null): string | null {
  if (!session) return null;
  if (session.kind === 'platform') return session.activeTenantId ?? null;
  if (session.kind === 'admin' || session.kind === 'member' || session.kind === 'client') {
    return session.tenantId;
  }
  return null;
}
