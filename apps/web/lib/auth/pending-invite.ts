/**
 * Pending Invite Cookie Management.
 *
 * When a user clicks an invite link, instead of immediately creating a session,
 * we store the invite details in a signed cookie and redirect to /login.
 * After the user proves their identity (via email magic link, phone OTP, or social),
 * we read this pending invite to bind their verified identity to the tenant.
 *
 * This decouples "holding an invite" from "being authenticated" per ADR-0014.
 *
 * Cookie format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 * Same signing pattern as session-token.ts for consistency.
 */

import { cookies } from 'next/headers';

export const PENDING_INVITE_COOKIE = 'bench_pending_invite';

/** 30-minute TTL matches invite link expiry. */
export const PENDING_INVITE_TTL_SECONDS = 30 * 60;

/** Dev-only signing secret — uses same secret as session for simplicity. */
const DEV_SECRET = 'bench-dev-session-secret-change-me';

function secret(): string {
  return process.env.SESSION_SECRET || DEV_SECRET;
}

/**
 * Pending invite payload.
 *
 * Stored in cookie after user clicks invite link, before they authenticate.
 */
export interface PendingInvite {
  /** Target tenant for the invite. */
  readonly tenantId: string;
  /** 'ADMIN' for admin invites, or actual profileId for consultant invites. */
  readonly profileId: string;
  /** Role to assign on successful binding. */
  readonly role: 'admin' | 'viewer';
  /** Hash of the original token (for burning after success). */
  readonly tokenHash: string;
  /** Magic link ID (for burning after success). */
  readonly linkId: string;
  /** Original invite expiry (ISO string). */
  readonly expiresAt: string;
  /** Email from the invite's createdBy field (for matching). */
  readonly email: string;
  /** Cookie expiry (Unix epoch seconds). */
  readonly exp: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/* --------------------------------------------------------------------------
 * Web Crypto helpers (same as session-token.ts for Edge compatibility).
 * ------------------------------------------------------------------------ */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function signPendingInvite(payload: PendingInvite): Promise<string> {
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const sig = await sign(encodedPayload);
  return `${encodedPayload}.${sig}`;
}

async function verifyPendingInviteToken(token: string): Promise<PendingInvite | null> {
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

  let payload: PendingInvite;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encodedPayload));
    payload = JSON.parse(json) as PendingInvite;
  } catch {
    return null;
  }

  // Check cookie hasn't expired
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds()) {
    return null;
  }

  return payload;
}

/* --------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

/** Input for setting a pending invite (exp is computed automatically). */
export type PendingInviteInput = Omit<PendingInvite, 'exp'>;

/**
 * Store a pending invite in a signed cookie.
 *
 * Called when user clicks an invite link. The invite is held until they
 * complete identity verification, then it's consumed during binding.
 */
export async function setPendingInvite(input: PendingInviteInput): Promise<void> {
  const exp = nowSeconds() + PENDING_INVITE_TTL_SECONDS;
  const payload: PendingInvite = { ...input, exp };
  const token = await signPendingInvite(payload);

  const store = await cookies();
  store.set(PENDING_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict', // Stricter than session - invite shouldn't be sent cross-site
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PENDING_INVITE_TTL_SECONDS,
  });
}

/**
 * Read and verify the pending invite from cookies.
 *
 * Returns the pending invite payload, or null if:
 * - No cookie present
 * - Cookie signature invalid
 * - Cookie expired
 */
export async function getPendingInvite(): Promise<PendingInvite | null> {
  const store = await cookies();
  const token = store.get(PENDING_INVITE_COOKIE)?.value;
  if (!token) return null;
  return verifyPendingInviteToken(token);
}

/**
 * Clear the pending invite cookie.
 *
 * Called after successful identity binding (invite consumed)
 * or when user cancels/times out.
 */
export async function clearPendingInvite(): Promise<void> {
  const store = await cookies();
  store.set(PENDING_INVITE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Check if there's a valid pending invite.
 *
 * Also checks that the original invite hasn't expired
 * (the cookie might be valid but the invite itself could have expired).
 */
export async function hasPendingInvite(): Promise<boolean> {
  const pending = await getPendingInvite();
  if (!pending) return false;

  // Also check the original invite expiry
  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    // Invite expired - clear the stale cookie
    await clearPendingInvite();
    return false;
  }

  return true;
}
