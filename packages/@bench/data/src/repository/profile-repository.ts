/**
 * Profile repository - DynamoDB implementation
 *
 * Provides tenant-scoped data access for consultant profiles.
 * Every method requires tenantId as the first parameter to enforce isolation.
 *
 * Per ADR-0008: The repository layer is the only path to the table.
 * Handlers/services never touch DynamoDBDocumentClient directly.
 */
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  tenantPK,
  profilePK,
  profileSK,
  statusGSI2PK,
  validateTenantId,
} from '../keys.js';

/**
 * Profile status
 */
export type ProfileStatus =
  | 'draft'
  | 'invited'
  | 'in_progress'
  | 'submitted'
  | 'published'
  | 'archived';

/**
 * Profile entity
 */
export interface Profile {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly headline: string | null;
  readonly bio: string | null;
  readonly headshotAssetId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly publishedAt: string | null;
  readonly archivedAt: string | null;
}

/**
 * Profile summary for listing
 */
export interface ProfileSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly updatedAt: string;
}

/**
 * Positioning update
 */
export interface PositioningUpdate {
  readonly headline: string;
  readonly bio: string;
}

/**
 * Create profile input
 */
export interface CreateProfileInput {
  readonly id: string;
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role?: string;
}

/**
 * Profile repository interface
 */
export interface ProfileRepository {
  /**
   * Find all profiles for the tenant.
   */
  findAll(tenantId: string): Promise<ProfileSummary[]>;

  /**
   * Find profiles by status for the tenant.
   */
  findByStatus(tenantId: string, status: ProfileStatus): Promise<ProfileSummary[]>;

  /**
   * Find a profile by ID within the tenant.
   */
  findById(tenantId: string, profileId: string): Promise<Profile | null>;

  /**
   * Create a new profile.
   */
  create(tenantId: string, input: CreateProfileInput): Promise<Profile>;

  /**
   * Update profile status.
   */
  updateStatus(tenantId: string, profileId: string, status: ProfileStatus): Promise<void>;

  /**
   * Update profile positioning (headline and bio).
   */
  updatePositioning(tenantId: string, profileId: string, positioning: PositioningUpdate): Promise<void>;

  /**
   * Update headshot asset ID.
   */
  updateHeadshot(tenantId: string, profileId: string, assetId: string | null): Promise<void>;
}

/**
 * DynamoDB item shape for profiles
 */
interface ProfileItem {
  PK: string;
  SK: string;
  GSI2PK: string;
  GSI2SK: string;
  entityType: 'PROFILE';
  id: string;
  tenantId: string;
  consultantName: string;
  consultantEmail: string;
  role: string | null;
  status: ProfileStatus;
  headline: string | null;
  bio: string | null;
  headshotAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
}

function itemToProfile(item: ProfileItem): Profile {
  return {
    id: item.id,
    tenantId: item.tenantId,
    consultantName: item.consultantName,
    consultantEmail: item.consultantEmail,
    role: item.role,
    status: item.status,
    headline: item.headline,
    bio: item.bio,
    headshotAssetId: item.headshotAssetId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    submittedAt: item.submittedAt,
    publishedAt: item.publishedAt,
    archivedAt: item.archivedAt,
  };
}

function itemToSummary(item: ProfileItem): ProfileSummary {
  return {
    id: item.id,
    tenantId: item.tenantId,
    consultantName: item.consultantName,
    role: item.role,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}

/**
 * Create a profile repository.
 *
 * @param client - DynamoDB Document client
 * @param tableName - DynamoDB table name
 * @returns ProfileRepository instance
 */
export function createProfileRepository(
  client: DynamoDBDocumentClient,
  tableName: string
): ProfileRepository {
  return {
    async findAll(tenantId: string): Promise<ProfileSummary[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': tenantPK(tenantId),
            ':skPrefix': 'PROFILE#',
          },
        })
      );

      return (result.Items as ProfileItem[] ?? []).map(itemToSummary);
    },

    async findByStatus(tenantId: string, status: ProfileStatus): Promise<ProfileSummary[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :pk',
          ExpressionAttributeValues: {
            ':pk': statusGSI2PK(tenantId, status),
          },
        })
      );

      return (result.Items as ProfileItem[] ?? []).map(itemToSummary);
    },

    async findById(tenantId: string, profileId: string): Promise<Profile | null> {
      validateTenantId(tenantId);

      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: profilePK(tenantId, profileId),
            SK: profileSK(profileId),
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      const item = result.Item as ProfileItem;

      // Double-check tenant isolation (defense in depth)
      if (item.tenantId !== tenantId) {
        return null;
      }

      return itemToProfile(item);
    },

    async create(tenantId: string, input: CreateProfileInput): Promise<Profile> {
      validateTenantId(tenantId);

      const now = new Date().toISOString();
      const status: ProfileStatus = 'draft';

      const item: ProfileItem = {
        PK: profilePK(tenantId, input.id),
        SK: profileSK(input.id),
        GSI2PK: statusGSI2PK(tenantId, status),
        GSI2SK: input.id,
        entityType: 'PROFILE',
        id: input.id,
        tenantId,
        consultantName: input.consultantName,
        consultantEmail: input.consultantEmail,
        role: input.role ?? null,
        status,
        headline: null,
        bio: null,
        headshotAssetId: null,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        publishedAt: null,
        archivedAt: null,
      };

      // Also write to tenant partition for listing
      const listItem = {
        PK: tenantPK(tenantId),
        SK: profileSK(input.id),
        GSI2PK: statusGSI2PK(tenantId, status),
        GSI2SK: input.id,
        entityType: 'PROFILE',
        id: input.id,
        tenantId,
        consultantName: input.consultantName,
        consultantEmail: input.consultantEmail,
        role: input.role ?? null,
        status,
        headline: null,
        bio: null,
        headshotAssetId: null,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        publishedAt: null,
        archivedAt: null,
      };

      await client.send(new PutCommand({ TableName: tableName, Item: item }));
      await client.send(new PutCommand({ TableName: tableName, Item: listItem }));

      return itemToProfile(item);
    },

    async updateStatus(tenantId: string, profileId: string, status: ProfileStatus): Promise<void> {
      validateTenantId(tenantId);

      const now = new Date().toISOString();
      const timestampAttr = getStatusTimestampAttr(status);

      const updateExpression = timestampAttr
        ? 'SET #status = :status, #updated = :now, #timestamp = :now, GSI2PK = :gsi2pk'
        : 'SET #status = :status, #updated = :now, GSI2PK = :gsi2pk';

      const expressionAttrNames: Record<string, string> = {
        '#status': 'status',
        '#updated': 'updatedAt',
      };

      if (timestampAttr) {
        expressionAttrNames['#timestamp'] = timestampAttr;
      }

      const params = {
        TableName: tableName,
        Key: {
          PK: profilePK(tenantId, profileId),
          SK: profileSK(profileId),
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttrNames,
        ExpressionAttributeValues: {
          ':status': status,
          ':now': now,
          ':gsi2pk': statusGSI2PK(tenantId, status),
        },
        ConditionExpression: 'attribute_exists(PK) AND tenantId = :tenantId',
      };

      // @ts-expect-error - ExpressionAttributeValues typing
      params.ExpressionAttributeValues[':tenantId'] = tenantId;

      await client.send(new UpdateCommand(params));

      // Also update the list item
      await client.send(
        new UpdateCommand({
          ...params,
          Key: {
            PK: tenantPK(tenantId),
            SK: profileSK(profileId),
          },
        })
      );
    },

    async updatePositioning(
      tenantId: string,
      profileId: string,
      positioning: PositioningUpdate
    ): Promise<void> {
      validateTenantId(tenantId);

      const now = new Date().toISOString();

      const params = {
        TableName: tableName,
        Key: {
          PK: profilePK(tenantId, profileId),
          SK: profileSK(profileId),
        },
        UpdateExpression: 'SET headline = :headline, bio = :bio, updatedAt = :now',
        ExpressionAttributeValues: {
          ':headline': positioning.headline,
          ':bio': positioning.bio,
          ':now': now,
          ':tenantId': tenantId,
        },
        ConditionExpression: 'attribute_exists(PK) AND tenantId = :tenantId',
      };

      await client.send(new UpdateCommand(params));

      // Also update the list item
      await client.send(
        new UpdateCommand({
          ...params,
          Key: {
            PK: tenantPK(tenantId),
            SK: profileSK(profileId),
          },
        })
      );
    },

    async updateHeadshot(
      tenantId: string,
      profileId: string,
      assetId: string | null
    ): Promise<void> {
      validateTenantId(tenantId);

      const now = new Date().toISOString();

      const params = {
        TableName: tableName,
        Key: {
          PK: profilePK(tenantId, profileId),
          SK: profileSK(profileId),
        },
        UpdateExpression: 'SET headshotAssetId = :assetId, updatedAt = :now',
        ExpressionAttributeValues: {
          ':assetId': assetId,
          ':now': now,
          ':tenantId': tenantId,
        },
        ConditionExpression: 'attribute_exists(PK) AND tenantId = :tenantId',
      };

      await client.send(new UpdateCommand(params));

      // Also update the list item
      await client.send(
        new UpdateCommand({
          ...params,
          Key: {
            PK: tenantPK(tenantId),
            SK: profileSK(profileId),
          },
        })
      );
    },
  };
}

/**
 * Get the timestamp attribute name for a status transition.
 */
function getStatusTimestampAttr(status: ProfileStatus): string | null {
  switch (status) {
    case 'submitted':
      return 'submittedAt';
    case 'published':
      return 'publishedAt';
    case 'archived':
      return 'archivedAt';
    default:
      return null;
  }
}
