/**
 * Admin (tenant owner) allow-list.
 *
 * For the pilot, the set of people who may sign in as the owner is small and
 * known. We gate magic-link issuance on this list so a request for a sign-in
 * link only ever mints one for a real admin (the login flow still returns the
 * same neutral response either way, so the list is never leaked).
 *
 * Sources, both lowercased:
 *  - `process.env.ADMIN_EMAILS` — comma-separated allow-list (ops-configurable).
 *  - the seeded founder, always allowed: oliver@changeconnected.co.uk.
 */

const SEEDED_FOUNDER = 'oliver@changeconnected.co.uk';

/** True if `email` is permitted to sign in as a tenant owner. */
export function isAuthorizedAdmin(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === SEEDED_FOUNDER) return true;

  const configured = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(normalized);
}
