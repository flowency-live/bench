/**
 * Platform (godmode) super-admin authorization — see ADR-0010 §Decisions(2).
 *
 * Godmode is NOT a per-user DB flag (unlike bndy). A platform admin is simply
 * an allowlisted email. Until Google OAuth is wired, godmode bootstraps via a
 * magic link to one of these allowlisted addresses.
 *
 * An email is a platform admin when (all lowercased) ANY of:
 *  - it appears in `process.env.PLATFORM_ADMIN_EMAILS` (comma-separated), OR
 *  - it ends with `@flowency.co.uk` (the Flowency staff domain), OR
 *  - it equals the seeded founder `jason@flowency.co.uk` (always allowed).
 */

import { getSession } from '@/lib/auth/session';
import type { PlatformSession } from '@/lib/auth/session-token';

/** Always-allowed founder, even with no env configured. */
const SEEDED_PLATFORM_ADMIN = 'jason@flowency.co.uk';

/** Flowency staff domain — every Flowency mailbox is a platform admin. */
const FLOWENCY_DOMAIN = '@flowency.co.uk';

/** True if `email` may sign in to the godmode platform area. */
export function isPlatformAdmin(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === SEEDED_PLATFORM_ADMIN) return true;
  if (normalized.endsWith(FLOWENCY_DOMAIN)) return true;

  const configured = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(normalized);
}

/**
 * Read the current session and return it only when it is a platform session.
 * Returns `null` for absent / invalid / non-platform sessions, so godmode pages
 * and actions can gate with a single call.
 */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  const session = await getSession();
  return session?.kind === 'platform' ? session : null;
}
