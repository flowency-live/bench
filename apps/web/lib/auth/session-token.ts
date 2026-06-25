/**
 * Pure session-token primitives — Edge-safe (no `next/headers`, no Node APIs).
 *
 * This module holds everything the Edge middleware needs to verify a session
 * cookie: the cookie name, the payload types, and the Web Crypto HMAC sign/verify.
 * Keeping it free of `next/headers` means the middleware bundle stays lean and
 * never pulls in server-only request primitives.
 *
 * The cookie-mutating helpers live in `./session` (server-only); they re-export
 * these types and reuse `signToken`/`verifySessionToken` so the format is
 * identical across server code and Edge middleware.
 *
 * Token format:  base64url(JSON payload) + "." + base64url(HMAC-SHA256 of part 1)
 *
 * The secret is `process.env.SESSION_SECRET`, with a dev fallback that keeps
 * local dev working with no env. The fallback is intentionally NOT secret and
 * must be overridden in any deployed environment.
 */

export const SESSION_COOKIE = 'bench_session';

/** 8-hour session lifetime. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Dev-only signing secret — override via SESSION_SECRET when deployed. */
const DEV_SECRET = 'bench-dev-session-secret-change-me';

function secret(): string {
  return process.env.SESSION_SECRET || DEV_SECRET;
}

/** Admin (tenant owner) session. */
export interface AdminSession {
  readonly kind: 'admin';
  readonly tenantId: string;
  readonly email: string;
  readonly role: 'owner';
  /** Unix epoch seconds. */
  readonly exp: number;
}

/** Member (consultant claiming/editing their own profile) session. */
export interface MemberSession {
  readonly kind: 'member';
  readonly tenantId: string;
  readonly profileId: string;
  readonly scope: 'edit';
  /** Unix epoch seconds. */
  readonly exp: number;
}

export type Session = AdminSession | MemberSession;

/** The payload accepted by `createSession` — `exp` is filled in by the caller. */
export type SessionInput =
  | Omit<AdminSession, 'exp'>
  | Omit<MemberSession, 'exp'>;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/* --------------------------------------------------------------------------
 * Web Crypto helpers (Edge-safe — no Node `Buffer`/`crypto`).
 * ------------------------------------------------------------------------ */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  // btoa is available in both Node 18+ and the Edge runtime.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(encodedPayload: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload),
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

/** Constant-time-ish comparison of two strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Sign a full session payload into a `bench_session` token string. */
export async function signToken(payload: Session): Promise<string> {
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const sig = await sign(encodedPayload);
  return `${encodedPayload}.${sig}`;
}

/**
 * Verify and decode a session token string.
 *
 * Returns the payload, or `null` when the token is malformed, the signature is
 * invalid, or it has expired. Pure (no cookie access) so the Edge middleware can
 * use it directly.
 */
export async function verifySessionToken(token: string): Promise<Session | null> {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const encodedPayload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let expectedSig: string;
  try {
    expectedSig = await sign(encodedPayload);
  } catch {
    return null;
  }
  if (!safeEqual(providedSig, expectedSig)) return null;

  let payload: Session;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encodedPayload));
    payload = JSON.parse(json) as Session;
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds()) {
    return null;
  }
  if (payload.kind !== 'admin' && payload.kind !== 'member') {
    return null;
  }

  return payload;
}
