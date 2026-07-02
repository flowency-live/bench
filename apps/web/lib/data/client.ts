/**
 * Client repository accessors for the Client Portal feature.
 *
 * Provides singleton instances of the client-related repositories:
 * - ClientRepository: manage client companies
 * - ClientContactRepository: manage contacts at those companies
 * - ClientActivityRepository: track client activity (views, exports)
 */

import type {
  Client,
  ClientContact,
  ClientActivity,
  ClientVisibilityMode,
  CreateClientInput,
  UpdateClientInput,
  CreateClientContactInput,
  UpdateClientContactInput,
  LogClientActivityInput,
} from '@bench/types';
import {
  createClientRepository as createDynamoClientRepo,
  createClientContactRepository as createDynamoContactRepo,
  createClientActivityRepository as createDynamoActivityRepo,
  createPortalLinkRepository as createDynamoPortalLinkRepo,
  createClient,
  type ClientRepository,
  type ClientContactRepository,
  type ClientActivityRepository,
  type PortalLinkRepository,
  type PortalLink,
  type PortalLinkLookup,
  type CreatePortalLinkInput,
} from '@bench/data';

// Re-export types for consumers
export type {
  Client,
  ClientContact,
  ClientActivity,
  ClientVisibilityMode,
  CreateClientInput,
  UpdateClientInput,
  CreateClientContactInput,
  UpdateClientContactInput,
  LogClientActivityInput,
  ClientRepository,
  ClientContactRepository,
  ClientActivityRepository,
  PortalLinkRepository,
  PortalLink,
  PortalLinkLookup,
  CreatePortalLinkInput,
};

let clientRepoInstance: ClientRepository | null = null;
let contactRepoInstance: ClientContactRepository | null = null;
let activityRepoInstance: ClientActivityRepository | null = null;
let portalLinkRepoInstance: PortalLinkRepository | null = null;

function getClientAndTable() {
  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  const client = createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
  return { client, tableName };
}

/**
 * Get the DynamoDB client repository.
 */
export function getClientRepository(): ClientRepository {
  if (clientRepoInstance) return clientRepoInstance;

  const { client, tableName } = getClientAndTable();
  clientRepoInstance = createDynamoClientRepo(client, tableName);

  return clientRepoInstance;
}

/**
 * Get the DynamoDB client contact repository.
 */
export function getClientContactRepository(): ClientContactRepository {
  if (contactRepoInstance) return contactRepoInstance;

  const { client, tableName } = getClientAndTable();
  contactRepoInstance = createDynamoContactRepo(client, tableName);

  return contactRepoInstance;
}

/**
 * Get the DynamoDB client activity repository.
 */
export function getClientActivityRepository(): ClientActivityRepository {
  if (activityRepoInstance) return activityRepoInstance;

  const { client, tableName } = getClientAndTable();
  activityRepoInstance = createDynamoActivityRepo(client, tableName);

  return activityRepoInstance;
}

/**
 * Get the DynamoDB portal link repository.
 */
export function getPortalLinkRepository(): PortalLinkRepository {
  if (portalLinkRepoInstance) return portalLinkRepoInstance;

  const { client, tableName } = getClientAndTable();
  portalLinkRepoInstance = createDynamoPortalLinkRepo(client, tableName);

  return portalLinkRepoInstance;
}

/**
 * Reset all singleton instances (for testing only).
 * @internal
 */
export function _resetClientRepositoryInstances(): void {
  clientRepoInstance = null;
  contactRepoInstance = null;
  activityRepoInstance = null;
  portalLinkRepoInstance = null;
}
