/**
 * Audit event kinds
 */
export type EventKind =
  | 'link_created'
  | 'link_sent'
  | 'link_opened'
  | 'link_revoked'
  | 'link_expired'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_submitted'
  | 'profile_published'
  | 'profile_archived';

/**
 * Audit event entity
 */
export interface AuditEvent {
  readonly id: string;
  readonly profileId: string;
  readonly linkId: string | null;
  readonly kind: EventKind;
  readonly actor: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

/**
 * Event for display in audit trail
 */
export interface AuditEventSummary {
  readonly id: string;
  readonly kind: EventKind;
  readonly description: string;
  readonly actor: string;
  readonly createdAt: string;
}
