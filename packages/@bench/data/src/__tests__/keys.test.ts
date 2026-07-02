/**
 * Key builder tests for client-related keys
 */
import { describe, it, expect } from 'vitest';
import {
  clientPK,
  clientSK,
  contactSK,
  clientActivitySK,
  clientMagicLinkSK,
} from '../keys.js';

describe('Client key builders', () => {
  const tenantId = 'tenant-001';
  const clientId = 'client-001';

  describe('clientPK', () => {
    it('builds partition key with tenant and client prefixes', () => {
      expect(clientPK(tenantId, clientId)).toBe('TENANT#tenant-001#CLIENT#client-001');
    });
  });

  describe('clientSK', () => {
    it('builds sort key with client prefix', () => {
      expect(clientSK(clientId)).toBe('CLIENT#client-001');
    });
  });
});

describe('ClientContact key builders', () => {
  const contactId = 'contact-001';

  describe('contactSK', () => {
    it('builds sort key with contact prefix', () => {
      expect(contactSK(contactId)).toBe('CONTACT#contact-001');
    });
  });
});

describe('ClientActivity key builders', () => {
  const eventId = 'event-001';

  describe('clientActivitySK', () => {
    it('builds sort key with timestamp and event ID', () => {
      const timestamp = new Date('2026-07-02T10:30:00.000Z');
      expect(clientActivitySK(timestamp, eventId)).toBe(
        'ACTIVITY#2026-07-02T10:30:00.000Z#event-001'
      );
    });

    it('sorts chronologically by timestamp', () => {
      const earlier = clientActivitySK(new Date('2026-07-02T09:00:00.000Z'), 'a');
      const later = clientActivitySK(new Date('2026-07-02T10:00:00.000Z'), 'b');
      expect(earlier < later).toBe(true);
    });
  });
});

describe('ClientMagicLink key builders', () => {
  const linkId = 'link-001';

  describe('clientMagicLinkSK', () => {
    it('builds sort key with portal type prefix', () => {
      expect(clientMagicLinkSK(linkId)).toBe('LINK#portal#link-001');
    });
  });
});
