/**
 * TenantRepository — DynamoDB implementation (ADR-0008, ADR-0010).
 *
 * Tenants are top-level items keyed `TENANT#{id}`. Unlike profile operations,
 * `list()` is a cross-tenant scan (godmode only, small cardinality).
 */
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Tenant,
  TenantStatus,
  BrandTokens,
  TenantRepository,
  CreateTenantInput,
} from '@bench/types';
import { DEFAULT_BRAND_TOKENS } from '@bench/types';
import { tenantPK, tenantSK } from '../keys.js';

/**
 * DynamoDB item shape for a Tenant.
 */
interface TenantItem {
  PK: string;
  SK: string;
  entityType: 'TENANT';
  id: string;
  name: string;
  instanceName: string;
  slug: string;
  brandTokens: BrandTokens;
  customDomain: string | null;
  status: TenantStatus;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Slugify a company name → a stable, URL-safe id.
 * Lowercase, non-alphanumerics → single hyphen, trimmed of leading/trailing
 * hyphens. Empty results fall back to a timestamped id so create never fails.
 */
function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `tenant-${Date.now()}`;
}

/**
 * Map a DynamoDB item to a Tenant domain object.
 */
function itemToTenant(item: TenantItem): Tenant {
  return {
    id: item.id,
    name: item.name,
    instanceName: item.instanceName,
    slug: item.slug,
    brandTokens: item.brandTokens,
    customDomain: item.customDomain,
    status: item.status,
    trialEndsAt: item.trialEndsAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Create a TenantRepository backed by DynamoDB.
 */
export function createTenantRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): TenantRepository {
  return {
    /**
     * List all tenants (godmode cross-tenant operation).
     * Returns tenants sorted by name.
     */
    async list(): Promise<readonly Tenant[]> {
      const result = await client.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: 'entityType = :entityType AND begins_with(PK, :pkPrefix)',
          ExpressionAttributeValues: {
            ':entityType': 'TENANT',
            ':pkPrefix': 'TENANT#',
          },
        }),
      );

      const items = (result.Items ?? []) as TenantItem[];
      const tenants = items.map(itemToTenant);

      // Sort by name (case-insensitive)
      return tenants.sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Get a single tenant by id.
     */
    async get(id: string): Promise<Tenant | null> {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: tenantPK(id),
            SK: tenantSK(id),
          },
        }),
      );

      if (!result.Item) {
        return null;
      }

      return itemToTenant(result.Item as TenantItem);
    },

    /**
     * Create a new tenant.
     * - id/slug derived from name (slugify)
     * - instanceName defaults to name
     * - brandTokens merged over DEFAULT_BRAND_TOKENS
     * - status = 'active', timestamps set
     * - CR3: clobber guard prevents overwriting existing tenant
     */
    async create(input: CreateTenantInput): Promise<Tenant> {
      const id = slugify(input.name);
      const now = new Date().toISOString();

      // Merge partial brandTokens over defaults
      const brandTokens: BrandTokens = {
        ...DEFAULT_BRAND_TOKENS,
        ...(input.brandTokens ?? {}),
      };

      const item: TenantItem = {
        PK: tenantPK(id),
        SK: tenantSK(id),
        entityType: 'TENANT',
        id,
        name: input.name.trim(),
        instanceName: input.instanceName?.trim() ?? input.name.trim(),
        slug: id,
        brandTokens,
        customDomain: input.customDomain ?? null,
        status: 'active',
        trialEndsAt: null,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'ConditionalCheckFailedException'
        ) {
          throw new Error(`Tenant with id '${id}' already exists`);
        }
        throw error;
      }

      return itemToTenant(item);
    },

    /**
     * Update a tenant's status (suspend/reactivate).
     */
    async setStatus(id: string, status: TenantStatus): Promise<Tenant> {
      // Fetch existing tenant
      const existing = await this.get(id);
      if (!existing) {
        throw new Error('Tenant not found');
      }

      const now = new Date().toISOString();

      const item: TenantItem = {
        PK: tenantPK(id),
        SK: tenantSK(id),
        entityType: 'TENANT',
        id: existing.id,
        name: existing.name,
        instanceName: existing.instanceName,
        slug: existing.slug,
        brandTokens: existing.brandTokens,
        customDomain: existing.customDomain,
        status,
        trialEndsAt: existing.trialEndsAt,
        createdAt: existing.createdAt,
        updatedAt: now,
      };

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        }),
      );

      return itemToTenant(item);
    },

    /**
     * Delete a tenant with cascade.
     * Deletes:
     * - The tenant item (PK: TENANT#{id}, SK: TENANT#{id})
     * - All listing items (PK: TENANT#{id}, SK: USER#*, PROFILE#*)
     * - All user items (PK: TENANT#{id}#USER#*, SK: USER#*)
     * - All profile items and children (PK: TENANT#{id}#PROFILE#*, SK: *)
     *
     * This prevents orphaned users from answering getByEmail (cross-tenant leak).
     */
    async delete(id: string): Promise<void> {
      // 1. Query items with PK = TENANT#{id} (tenant + listing items)
      const listingResult = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': tenantPK(id),
          },
        }),
      );
      const listingItems = listingResult.Items ?? [];

      // 2. Scan items with PK starting with TENANT#{id}# (user/profile items)
      const childResult = await client.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: 'begins_with(PK, :pkPrefix)',
          ExpressionAttributeValues: {
            ':pkPrefix': `TENANT#${id}#`,
          },
        }),
      );
      const childItems = childResult.Items ?? [];

      // Combine all items to delete
      const allItems = [...listingItems, ...childItems];

      if (allItems.length === 0) {
        return;
      }

      // 3. Batch delete all items (max 25 per BatchWriteCommand)
      const BATCH_SIZE = 25;
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);
        const deleteRequests = batch.map((item) => ({
          DeleteRequest: {
            Key: {
              PK: item.PK as string,
              SK: item.SK as string,
            },
          },
        }));

        await client.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: deleteRequests,
            },
          }),
        );
      }
    },
  };
}
