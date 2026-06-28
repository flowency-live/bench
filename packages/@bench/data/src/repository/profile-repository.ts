/**
 * Profile repository - DynamoDB implementation
 *
 * Implements the canonical ProfileRepository interface from @bench/types.
 * Provides tenant-scoped data access for consultant profiles.
 *
 * Per ADR-0008: The repository layer is the only path to the table.
 * Per ADR-0011: two-axis model — `status` (lifecycle) + `availability` (market
 * position). The old single lifecycle (draft…archived + submitted/published/
 * archived timestamps) is gone.
 *
 * Per data-contract.md:
 * - get() assembles children (skills, stories, testimonial)
 * - list() returns one row per profile (no duplicates)
 * - update() replaces child collections present in the patch
 */
import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type {
  Availability,
  Profile,
  ProfileRepository,
  ProfileSummary,
  ProfileStatus,
  ProfileSkill,
  ProfileStory,
  ProfileTestimonial,
  ProfilePositioning,
  ProfileRatesAndPreferences,
  CreateConsultantInput,
  ProfilePatch,
} from '@bench/types';
import {
  tenantPK,
  profilePK,
  profileSK,
  skillSK,
  storySK,
  statusGSI2PK,
  validateTenantId,
} from '../keys.js';

/** Default availability for a freshly-created profile / legacy items missing it. */
const DEFAULT_AVAILABILITY: Availability = { status: 'available' };

/**
 * DynamoDB item types
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
  availability: Availability;
  ratesAndPreferences: ProfileRatesAndPreferences | null;
  positioning: ProfilePositioning | null;
  headshotAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SkillItem {
  PK: string;
  SK: string;
  entityType: 'SKILL';
  id: string;
  title: string;
  body: string;
  order: number;
}

interface StoryItem {
  PK: string;
  SK: string;
  entityType: 'STORY';
  id: string;
  clientTag: string;
  title: string;
  body: string;
  order: number;
}

interface TestimonialItem {
  PK: string;
  SK: string;
  entityType: 'TESTIMONIAL';
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  authorCompany: string;
}

interface ListingItem {
  PK: string;
  SK: string;
  entityType: 'PROFILE_LISTING';
  id: string;
  tenantId: string;
  consultantName: string;
  role: string | null;
  status: ProfileStatus;
  availability: Availability;
  headshotAssetId: string | null;
  updatedAt: string;
}

type ChildItem = SkillItem | StoryItem | TestimonialItem;
type AnyItem = ProfileItem | ChildItem | ListingItem;

/**
 * Assemble a Profile from DynamoDB items (profile + children).
 */
function assembleProfile(
  profileItem: ProfileItem,
  childItems: ChildItem[]
): Profile {
  const skills: ProfileSkill[] = [];
  const stories: ProfileStory[] = [];
  let testimonial: ProfileTestimonial | null = null;

  for (const item of childItems) {
    switch (item.entityType) {
      case 'SKILL':
        skills.push({
          id: item.id,
          title: item.title,
          body: item.body,
          order: item.order,
        });
        break;
      case 'STORY':
        stories.push({
          id: item.id,
          clientTag: item.clientTag,
          title: item.title,
          body: item.body,
          order: item.order,
        });
        break;
      case 'TESTIMONIAL':
        testimonial = {
          id: item.id,
          quote: item.quote,
          authorName: item.authorName,
          authorRole: item.authorRole,
          authorCompany: item.authorCompany,
        };
        break;
    }
  }

  // Sort by order
  skills.sort((a, b) => a.order - b.order);
  stories.sort((a, b) => a.order - b.order);

  return {
    id: profileItem.id,
    tenantId: profileItem.tenantId,
    consultantName: profileItem.consultantName,
    consultantEmail: profileItem.consultantEmail,
    role: profileItem.role,
    status: profileItem.status,
    availability: profileItem.availability ?? DEFAULT_AVAILABILITY,
    ratesAndPreferences: profileItem.ratesAndPreferences ?? null,
    positioning: profileItem.positioning,
    headshotAssetId: profileItem.headshotAssetId,
    skills,
    stories,
    testimonial,
    createdAt: profileItem.createdAt,
    updatedAt: profileItem.updatedAt,
  };
}

/**
 * Convert listing item to ProfileSummary.
 */
function itemToSummary(item: ListingItem | ProfileItem): ProfileSummary {
  return {
    id: item.id,
    tenantId: item.tenantId,
    consultantName: item.consultantName,
    role: item.role,
    status: item.status,
    availability: item.availability ?? DEFAULT_AVAILABILITY,
    headshotUrl: null, // Resolved by view layer from headshotAssetId
    updatedAt: item.updatedAt,
  };
}

/**
 * Generate a UUID.
 */
function generateId(): string {
  return crypto.randomUUID();
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
    async list(tenantId: string): Promise<readonly ProfileSummary[]> {
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

      const items = (result.Items ?? []) as (ListingItem | ProfileItem)[];
      return items.map(itemToSummary);
    },

    async get(tenantId: string, profileId: string): Promise<Profile | null> {
      validateTenantId(tenantId);

      // Query the profile partition to get profile + all children
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': profilePK(tenantId, profileId),
          },
        })
      );

      const items = (result.Items ?? []) as AnyItem[];
      if (items.length === 0) {
        return null;
      }

      // Find the profile item
      const profileItem = items.find(
        (item): item is ProfileItem => item.entityType === 'PROFILE'
      );

      if (!profileItem) {
        return null;
      }

      // Defense in depth: verify tenant ownership
      if (profileItem.tenantId !== tenantId) {
        return null;
      }

      // Get child items
      const childItems = items.filter(
        (item): item is ChildItem =>
          item.entityType === 'SKILL' ||
          item.entityType === 'STORY' ||
          item.entityType === 'TESTIMONIAL'
      );

      return assembleProfile(profileItem, childItems);
    },

    async create(
      tenantId: string,
      input: CreateConsultantInput
    ): Promise<Profile> {
      validateTenantId(tenantId);

      const id = generateId();
      const now = new Date().toISOString();
      const status: ProfileStatus = 'no_profile';
      const availability: Availability = DEFAULT_AVAILABILITY;

      const profileItem: ProfileItem = {
        PK: profilePK(tenantId, id),
        SK: profileSK(id),
        GSI2PK: statusGSI2PK(tenantId, status),
        GSI2SK: id,
        entityType: 'PROFILE',
        id,
        tenantId,
        consultantName: input.consultantName,
        consultantEmail: input.consultantEmail,
        role: input.role ?? null,
        status,
        availability,
        ratesAndPreferences: null,
        positioning: null,
        headshotAssetId: null,
        createdAt: now,
        updatedAt: now,
      };

      // Listing item (no GSI2 keys to avoid duplicates in findByStatus)
      const listingItem: ListingItem = {
        PK: tenantPK(tenantId),
        SK: profileSK(id),
        entityType: 'PROFILE_LISTING',
        id,
        tenantId,
        consultantName: input.consultantName,
        role: input.role ?? null,
        status,
        availability,
        headshotAssetId: null,
        updatedAt: now,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: tableName, Item: profileItem } },
            { Put: { TableName: tableName, Item: listingItem } },
          ],
        })
      );

      return {
        id,
        tenantId,
        consultantName: input.consultantName,
        consultantEmail: input.consultantEmail,
        role: input.role ?? null,
        status,
        availability,
        ratesAndPreferences: null,
        positioning: null,
        headshotAssetId: null,
        skills: [],
        stories: [],
        testimonial: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async update(
      tenantId: string,
      profileId: string,
      patch: ProfilePatch
    ): Promise<Profile> {
      validateTenantId(tenantId);

      // First, get the existing profile and children
      const existing = await this.get(tenantId, profileId);
      if (!existing) {
        throw new Error('Profile not found');
      }

      const now = new Date().toISOString();
      const pk = profilePK(tenantId, profileId);

      // Build the updated profile
      const updatedProfile: Profile = {
        ...existing,
        consultantName: patch.consultantName ?? existing.consultantName,
        role: patch.role !== undefined ? patch.role : existing.role,
        availability:
          patch.availability !== undefined
            ? patch.availability
            : existing.availability,
        ratesAndPreferences:
          patch.ratesAndPreferences !== undefined
            ? patch.ratesAndPreferences
            : existing.ratesAndPreferences,
        positioning:
          patch.positioning !== undefined
            ? patch.positioning
            : existing.positioning,
        headshotAssetId:
          patch.headshotAssetId !== undefined
            ? patch.headshotAssetId
            : existing.headshotAssetId,
        skills: patch.skills !== undefined ? [...patch.skills] : existing.skills,
        stories:
          patch.stories !== undefined ? [...patch.stories] : existing.stories,
        testimonial:
          patch.testimonial !== undefined
            ? patch.testimonial
            : existing.testimonial,
        updatedAt: now,
      };

      // Build transaction items
      const transactItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [];

      // Update profile item
      const profileItem: ProfileItem = {
        PK: pk,
        SK: profileSK(profileId),
        GSI2PK: statusGSI2PK(tenantId, updatedProfile.status),
        GSI2SK: profileId,
        entityType: 'PROFILE',
        id: profileId,
        tenantId,
        consultantName: updatedProfile.consultantName,
        consultantEmail: updatedProfile.consultantEmail,
        role: updatedProfile.role,
        status: updatedProfile.status,
        availability: updatedProfile.availability,
        ratesAndPreferences: updatedProfile.ratesAndPreferences,
        positioning: updatedProfile.positioning,
        headshotAssetId: updatedProfile.headshotAssetId,
        createdAt: updatedProfile.createdAt,
        updatedAt: now,
      };
      transactItems.push({ Put: { TableName: tableName, Item: profileItem } });

      // Update listing item
      const listingItem: ListingItem = {
        PK: tenantPK(tenantId),
        SK: profileSK(profileId),
        entityType: 'PROFILE_LISTING',
        id: profileId,
        tenantId,
        consultantName: updatedProfile.consultantName,
        role: updatedProfile.role,
        status: updatedProfile.status,
        availability: updatedProfile.availability,
        headshotAssetId: updatedProfile.headshotAssetId,
        updatedAt: now,
      };
      transactItems.push({ Put: { TableName: tableName, Item: listingItem } });

      // If skills were provided in patch, replace them
      if (patch.skills !== undefined) {
        // Put all new skills (overwrites existing items with same order key)
        const newSkillOrders = new Set(updatedProfile.skills.map((s) => s.order));
        for (const skill of updatedProfile.skills) {
          const skillItem: SkillItem = {
            PK: pk,
            SK: skillSK(skill.order),
            entityType: 'SKILL',
            id: skill.id,
            title: skill.title,
            body: skill.body,
            order: skill.order,
          };
          transactItems.push({ Put: { TableName: tableName, Item: skillItem } });
        }
        // Delete only orphan orders (existing orders not in new set)
        for (const skill of existing.skills) {
          if (!newSkillOrders.has(skill.order)) {
            transactItems.push({
              Delete: {
                TableName: tableName,
                Key: { PK: pk, SK: skillSK(skill.order) },
              },
            });
          }
        }
      }

      // If stories were provided in patch, replace them
      if (patch.stories !== undefined) {
        // Put all new stories (overwrites existing items with same order key)
        const newStoryOrders = new Set(updatedProfile.stories.map((s) => s.order));
        for (const story of updatedProfile.stories) {
          const storyItem: StoryItem = {
            PK: pk,
            SK: storySK(story.order),
            entityType: 'STORY',
            id: story.id,
            clientTag: story.clientTag,
            title: story.title,
            body: story.body,
            order: story.order,
          };
          transactItems.push({ Put: { TableName: tableName, Item: storyItem } });
        }
        // Delete only orphan orders (existing orders not in new set)
        for (const story of existing.stories) {
          if (!newStoryOrders.has(story.order)) {
            transactItems.push({
              Delete: {
                TableName: tableName,
                Key: { PK: pk, SK: storySK(story.order) },
              },
            });
          }
        }
      }

      // If testimonial was provided in patch, replace it
      if (patch.testimonial !== undefined) {
        // Delete existing testimonial if any
        if (existing.testimonial) {
          transactItems.push({
            Delete: {
              TableName: tableName,
              Key: { PK: pk, SK: 'TESTIMONIAL' },
            },
          });
        }
        // Add new testimonial if not null
        if (updatedProfile.testimonial) {
          const testimonialItem: TestimonialItem = {
            PK: pk,
            SK: 'TESTIMONIAL',
            entityType: 'TESTIMONIAL',
            id: updatedProfile.testimonial.id,
            quote: updatedProfile.testimonial.quote,
            authorName: updatedProfile.testimonial.authorName,
            authorRole: updatedProfile.testimonial.authorRole,
            authorCompany: updatedProfile.testimonial.authorCompany,
          };
          transactItems.push({
            Put: { TableName: tableName, Item: testimonialItem },
          });
        }
      }

      // DynamoDB TransactWriteItems limit is 100
      if (transactItems.length > 100) {
        throw new Error('Update too large: exceeds DynamoDB transaction limit');
      }

      await client.send(
        new TransactWriteCommand({ TransactItems: transactItems })
      );

      return updatedProfile;
    },

    async setStatus(
      tenantId: string,
      profileId: string,
      status: ProfileStatus
    ): Promise<Profile> {
      validateTenantId(tenantId);

      // Get existing profile
      const existing = await this.get(tenantId, profileId);
      if (!existing) {
        throw new Error('Profile not found');
      }

      const now = new Date().toISOString();

      // Build the updated profile
      const updatedProfile: Profile = {
        ...existing,
        status,
        updatedAt: now,
      };

      const pk = profilePK(tenantId, profileId);

      // Update profile item
      const profileItem: ProfileItem = {
        PK: pk,
        SK: profileSK(profileId),
        GSI2PK: statusGSI2PK(tenantId, status),
        GSI2SK: profileId,
        entityType: 'PROFILE',
        id: profileId,
        tenantId,
        consultantName: updatedProfile.consultantName,
        consultantEmail: updatedProfile.consultantEmail,
        role: updatedProfile.role,
        status,
        availability: updatedProfile.availability,
        positioning: updatedProfile.positioning,
        headshotAssetId: updatedProfile.headshotAssetId,
        createdAt: updatedProfile.createdAt,
        updatedAt: now,
      };

      // Update listing item
      const listingItem: ListingItem = {
        PK: tenantPK(tenantId),
        SK: profileSK(profileId),
        entityType: 'PROFILE_LISTING',
        id: profileId,
        tenantId,
        consultantName: updatedProfile.consultantName,
        role: updatedProfile.role,
        status,
        availability: updatedProfile.availability,
        headshotAssetId: updatedProfile.headshotAssetId,
        updatedAt: now,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: tableName, Item: profileItem } },
            { Put: { TableName: tableName, Item: listingItem } },
          ],
        })
      );

      return updatedProfile;
    },
  };
}
