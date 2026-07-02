/**
 * DynamoDB key builders for tenant-prefixed keys
 *
 * Per ADR-0008: All partition keys are prefixed with TENANT#{tenantId}
 * to enforce tenant isolation at the data layer.
 *
 * Key Patterns:
 * | Pattern                 | PK                         | SK                    |
 * |-------------------------|----------------------------|-----------------------|
 * | Tenant                  | TENANT#{id}                | TENANT#{id}           |
 * | User                    | TENANT#{tid}#USER#{id}     | USER#{id}             |
 * | Profile                 | TENANT#{tid}#PROFILE#{id}  | PROFILE#{id}          |
 * | Profile list in tenant  | TENANT#{tid}               | PROFILE#{id}          |
 * | Skills for profile      | TENANT#{tid}#PROFILE#{id}  | SKILL#{order}         |
 * | Stories for profile     | TENANT#{tid}#PROFILE#{id}  | STORY#{order}         |
 * | Magic link for profile  | TENANT#{tid}#PROFILE#{id}  | LINK#{type}#{id}      |
 * | Event for profile       | TENANT#{tid}#PROFILE#{id}  | EVENT#{timestamp}     |
 * | Client                  | TENANT#{tid}#CLIENT#{id}   | CLIENT#{id}           |
 * | Client list in tenant   | TENANT#{tid}               | CLIENT#{id}           |
 * | ClientContact           | TENANT#{tid}#CLIENT#{id}   | CONTACT#{id}          |
 * | Client magic link       | TENANT#{tid}#CLIENT#{id}   | LINK#portal#{id}      |
 * | ClientActivity          | TENANT#{tid}#CLIENT#{id}   | ACTIVITY#{ts}#{id}    |
 *
 * GSI Key Patterns:
 * | Index | Purpose                    | PK Pattern                       |
 * |-------|----------------------------|----------------------------------|
 * | GSI1  | Email lookup (login)       | EMAIL#{email}                    |
 * | GSI2  | Status query (per-tenant)  | TENANT#{tid}#STATUS#{status}     |
 * | GSI3  | Token lookup (global)      | TOKENHASH#{hash}                 |
 */

// ============================================
// Primary Key Builders
// ============================================

/**
 * Build tenant partition key
 */
export function tenantPK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

/**
 * Build tenant sort key (same as PK for tenant items)
 */
export function tenantSK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

/**
 * Build profile partition key
 */
export function profilePK(tenantId: string, profileId: string): string {
  return `TENANT#${tenantId}#PROFILE#${profileId}`;
}

/**
 * Build profile sort key
 */
export function profileSK(profileId: string): string {
  return `PROFILE#${profileId}`;
}

/**
 * Build user partition key
 */
export function userPK(tenantId: string, userId: string): string {
  return `TENANT#${tenantId}#USER#${userId}`;
}

/**
 * Build user sort key
 */
export function userSK(userId: string): string {
  return `USER#${userId}`;
}

/**
 * Build magic link sort key
 */
export function magicLinkSK(type: string, linkId: string): string {
  return `LINK#${type}#${linkId}`;
}

/**
 * Build skill sort key
 */
export function skillSK(order: number): string {
  return `SKILL#${order.toString().padStart(4, '0')}`;
}

/**
 * Build story sort key
 */
export function storySK(order: number): string {
  return `STORY#${order.toString().padStart(4, '0')}`;
}

/**
 * Build event sort key
 */
export function eventSK(timestamp: Date): string {
  return `EVENT#${timestamp.toISOString()}`;
}

// ============================================
// Client Key Builders
// ============================================

/**
 * Build client partition key
 */
export function clientPK(tenantId: string, clientId: string): string {
  return `TENANT#${tenantId}#CLIENT#${clientId}`;
}

/**
 * Build client sort key
 */
export function clientSK(clientId: string): string {
  return `CLIENT#${clientId}`;
}

/**
 * Build client contact sort key
 */
export function contactSK(contactId: string): string {
  return `CONTACT#${contactId}`;
}

/**
 * Build client activity sort key (for chronological ordering)
 */
export function clientActivitySK(timestamp: Date, eventId: string): string {
  return `ACTIVITY#${timestamp.toISOString()}#${eventId}`;
}

/**
 * Build client magic link sort key (portal type)
 */
export function clientMagicLinkSK(linkId: string): string {
  return `LINK#portal#${linkId}`;
}

// ============================================
// GSI Key Builders
// ============================================

/**
 * Build GSI1 partition key for email lookup
 */
export function emailGSI1PK(email: string): string {
  return `EMAIL#${email.toLowerCase()}`;
}

/**
 * Build GSI2 partition key for status query
 */
export function statusGSI2PK(tenantId: string, status: string): string {
  return `TENANT#${tenantId}#STATUS#${status}`;
}

/**
 * Build GSI3 partition key for token hash lookup
 */
export function tokenHashGSI3PK(tokenHash: string): string {
  return `TOKENHASH#${tokenHash}`;
}

// ============================================
// Key Validation
// ============================================

/**
 * Validate that a tenant ID is provided and non-empty
 * @throws Error if tenantId is empty or undefined
 */
export function validateTenantId(tenantId: string | undefined): asserts tenantId is string {
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('tenantId is required and cannot be empty');
  }
}
