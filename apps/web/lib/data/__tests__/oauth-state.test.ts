import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOAuthStateStore,
  _resetOAuthStateStoreInstance,
} from '../oauth-state';

/**
 * OAuth State Store tests
 *
 * Note: These tests verify the singleton behavior and interface contract.
 * Full DynamoDB integration tests would require mocking the AWS SDK client.
 * The actual DynamoDB behavior is covered by the @bench/data package tests.
 */
describe('OAuthStateStore', () => {
  beforeEach(() => {
    _resetOAuthStateStoreInstance();
  });

  describe('interface', () => {
    it('returns an OAuthStateStore instance with create and verify methods', () => {
      const store = getOAuthStateStore();
      expect(store).toBeDefined();
      expect(typeof store.create).toBe('function');
      expect(typeof store.verify).toBe('function');
    });
  });

  describe('singleton behavior', () => {
    it('returns the same instance on subsequent calls', () => {
      const store1 = getOAuthStateStore();
      const store2 = getOAuthStateStore();
      expect(store1).toBe(store2);
    });

    it('returns a fresh instance after reset', () => {
      const store1 = getOAuthStateStore();
      _resetOAuthStateStoreInstance();
      const store2 = getOAuthStateStore();
      expect(store1).not.toBe(store2);
    });
  });
});
