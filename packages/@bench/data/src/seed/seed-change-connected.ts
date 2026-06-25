/**
 * Seed script for tenant "Change Connected" (tenant #1)
 *
 * Creates:
 * - Tenant: Change Connected
 * - Profile 1: Oliver Bradley - Founder & Chief Connecting Officer
 * - Profile 2: Jason Jones - Delivery Execution and Flow Optimisation
 *
 * Usage: pnpm --filter @bench/data seed
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  tenantPK,
  tenantSK,
  profilePK,
  profileSK,
  skillSK,
  storySK,
  statusGSI2PK,
} from '../keys.js';

const TABLE_NAME = process.env.TABLE_NAME ?? 'bench-main';
const REGION = process.env.AWS_REGION ?? 'eu-west-2';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// ============================================
// Constants
// ============================================

const TENANT_ID = 'change-connected';
const NOW = new Date().toISOString();

// Change Connected brand tokens (from tenant.types.ts)
const BRAND_TOKENS = {
  bgPrimary: '#001930',
  bgPanel: '#002e52',
  accent: '#baeb5b',
  textPrimary: '#ffffff',
  textSecondary: '#9dadc8',
  fontDisplay: 'Poppins',
  fontBody: 'Poppins',
  logoAssetId: null,
};

// ============================================
// Tenant Data
// ============================================

const tenantItem = {
  PK: tenantPK(TENANT_ID),
  SK: tenantSK(TENANT_ID),
  entityType: 'TENANT',
  id: TENANT_ID,
  name: 'Change Connected',
  slug: 'change-connected',
  brandTokens: BRAND_TOKENS,
  customDomain: 'changeconnected.co.uk',
  status: 'active',
  trialEndsAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

// ============================================
// Profile 1: Oliver Bradley
// ============================================

const OLIVER_ID = 'oliver-bradley';

const oliverProfile = {
  PK: profilePK(TENANT_ID, OLIVER_ID),
  SK: profileSK(OLIVER_ID),
  entityType: 'PROFILE',
  GSI2PK: statusGSI2PK(TENANT_ID, 'published'),
  GSI2SK: OLIVER_ID,
  id: OLIVER_ID,
  tenantId: TENANT_ID,
  consultantName: 'Oliver Bradley',
  consultantEmail: 'oliver@changeconnected.co.uk',
  role: 'Founder & Chief Connecting Officer',
  status: 'published',
  positioning: {
    headline: 'Founder & Chief Connecting Officer',
    bio: 'Oliver founded Change Connected to bring together the best independent consultants and match them with organisations that need real expertise. With a background in transformation leadership and a passion for building genuine relationships, Oliver leads the network with energy and purpose.',
  },
  headshotAssetId: null,
  createdAt: NOW,
  updatedAt: NOW,
  submittedAt: NOW,
  publishedAt: NOW,
  archivedAt: null,
};

// Profile listing item (for tenant-scoped queries) - NO GSI2 keys
const oliverListingItem = {
  PK: tenantPK(TENANT_ID),
  SK: profileSK(OLIVER_ID),
  entityType: 'PROFILE_LISTING',
  id: OLIVER_ID,
  tenantId: TENANT_ID,
  consultantName: 'Oliver Bradley',
  role: 'Founder & Chief Connecting Officer',
  status: 'published',
  headshotAssetId: null,
  updatedAt: NOW,
};

const oliverSkills = [
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: skillSK(1),
    entityType: 'SKILL',
    id: 'skill-ob-1',
    title: 'Network Leadership',
    body: 'Building and nurturing a high-quality network of independent change and transformation consultants.',
    order: 1,
  },
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: skillSK(2),
    entityType: 'SKILL',
    id: 'skill-ob-2',
    title: 'Transformation Strategy',
    body: 'Defining and executing transformation programmes that deliver measurable business outcomes.',
    order: 2,
  },
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: skillSK(3),
    entityType: 'SKILL',
    id: 'skill-ob-3',
    title: 'Client Relationship Management',
    body: 'Building long-term partnerships with clients to understand their challenges and match them with the right expertise.',
    order: 3,
  },
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: skillSK(4),
    entityType: 'SKILL',
    id: 'skill-ob-4',
    title: 'Team Building',
    body: 'Assembling high-performing delivery teams from the network to tackle complex engagements.',
    order: 4,
  },
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: skillSK(5),
    entityType: 'SKILL',
    id: 'skill-ob-5',
    title: 'Business Development',
    body: 'Identifying opportunities and developing propositions that create value for clients and consultants.',
    order: 5,
  },
];

const oliverStories = [
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: storySK(1),
    entityType: 'STORY',
    id: 'story-ob-1',
    clientTag: 'FTSE 100 Retailer',
    title: 'Digital Transformation Leadership',
    body: 'Led a team of 12 consultants through a major digital transformation, delivering a new e-commerce platform in 8 months.',
    order: 1,
  },
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: storySK(2),
    entityType: 'STORY',
    id: 'story-ob-2',
    clientTag: 'Global Bank',
    title: 'Agile Operating Model',
    body: 'Designed and implemented a new agile operating model across 20 product teams, reducing time-to-market by 40%.',
    order: 2,
  },
  {
    PK: profilePK(TENANT_ID, OLIVER_ID),
    SK: storySK(3),
    entityType: 'STORY',
    id: 'story-ob-3',
    clientTag: 'Energy Sector',
    title: 'Network Launch',
    body: 'Founded Change Connected and grew the network to 50+ consultants within the first year of operation.',
    order: 3,
  },
];

// ============================================
// Profile 2: Jason Jones
// ============================================

const JASON_ID = 'jason-jones';

const jasonProfile = {
  PK: profilePK(TENANT_ID, JASON_ID),
  SK: profileSK(JASON_ID),
  entityType: 'PROFILE',
  GSI2PK: statusGSI2PK(TENANT_ID, 'published'),
  GSI2SK: JASON_ID,
  id: JASON_ID,
  tenantId: TENANT_ID,
  consultantName: 'Jason Jones',
  consultantEmail: 'jason@changeconnected.co.uk',
  role: 'Delivery Execution & Flow Optimisation',
  status: 'published',
  positioning: {
    headline: 'Delivery Execution & Flow Optimisation',
    bio: 'Jason specialises in helping organisations achieve predictable delivery through flow optimisation, Agile/Lean practices, and practical DevOps adoption. With deep technical roots and hands-on leadership experience, Jason bridges the gap between strategy and execution.',
  },
  headshotAssetId: null,
  createdAt: NOW,
  updatedAt: NOW,
  submittedAt: NOW,
  publishedAt: NOW,
  archivedAt: null,
};

// Profile listing item (for tenant-scoped queries) - NO GSI2 keys
const jasonListingItem = {
  PK: tenantPK(TENANT_ID),
  SK: profileSK(JASON_ID),
  entityType: 'PROFILE_LISTING',
  id: JASON_ID,
  tenantId: TENANT_ID,
  consultantName: 'Jason Jones',
  role: 'Delivery Execution & Flow Optimisation',
  status: 'published',
  headshotAssetId: null,
  updatedAt: NOW,
};

const jasonSkills = [
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: skillSK(1),
    entityType: 'SKILL',
    id: 'skill-jj-1',
    title: 'Flow Optimisation',
    body: 'Identifying and removing bottlenecks in delivery pipelines to achieve continuous, predictable flow of value.',
    order: 1,
  },
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: skillSK(2),
    entityType: 'SKILL',
    id: 'skill-jj-2',
    title: 'Agile Coaching',
    body: 'Coaching teams and organisations in Scrum, Kanban, and scaled Agile frameworks with a focus on outcomes over ceremony.',
    order: 2,
  },
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: skillSK(3),
    entityType: 'SKILL',
    id: 'skill-jj-3',
    title: 'DevOps Adoption',
    body: 'Practical DevOps implementation including CI/CD pipelines, infrastructure as code, and platform engineering.',
    order: 3,
  },
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: skillSK(4),
    entityType: 'SKILL',
    id: 'skill-jj-4',
    title: 'Delivery Leadership',
    body: 'Leading cross-functional delivery teams through complex programmes with clear governance and stakeholder management.',
    order: 4,
  },
];

const jasonStories = [
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: storySK(1),
    entityType: 'STORY',
    id: 'story-jj-1',
    clientTag: 'Financial Services',
    title: 'Release Frequency Transformation',
    body: 'Transformed a quarterly release cycle to continuous deployment, increasing release frequency from 4 to 200+ per year.',
    order: 1,
  },
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: storySK(2),
    entityType: 'STORY',
    id: 'story-jj-2',
    clientTag: 'Healthcare Provider',
    title: 'Flow Metrics Implementation',
    body: 'Implemented flow metrics across 15 teams, reducing lead time from 45 days to 8 days within 6 months.',
    order: 2,
  },
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: storySK(3),
    entityType: 'STORY',
    id: 'story-jj-3',
    clientTag: 'Retail Tech',
    title: 'Platform Engineering',
    body: 'Built an internal developer platform that reduced environment provisioning from 2 weeks to 15 minutes.',
    order: 3,
  },
  {
    PK: profilePK(TENANT_ID, JASON_ID),
    SK: storySK(4),
    entityType: 'STORY',
    id: 'story-jj-4',
    clientTag: 'Insurance',
    title: 'Agile Transformation',
    body: 'Led an agile transformation for a 200-person IT organisation, improving team satisfaction and delivery predictability.',
    order: 4,
  },
];

// ============================================
// Seed Functions
// ============================================

async function seedTenant(): Promise<void> {
  console.log('Seeding tenant: Change Connected...');
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: tenantItem,
    })
  );
  console.log('  ✓ Tenant created');
}

async function seedProfile(
  profile: Record<string, unknown>,
  listingItem: Record<string, unknown>,
  skills: Record<string, unknown>[],
  stories: Record<string, unknown>[]
): Promise<void> {
  const name = profile.consultantName as string;
  console.log(`Seeding profile: ${name}...`);

  // Write all items individually (DynamoDB limits batches to 25 items)
  const items = [profile, listingItem, ...skills, ...stories];

  for (const item of items) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );
  }

  console.log(
    `  ✓ Profile created with ${skills.length} skills and ${stories.length} stories`
  );
}

async function main(): Promise<void> {
  console.log(`\n=== Seeding ${TABLE_NAME} in ${REGION} ===\n`);

  try {
    await seedTenant();
    await seedProfile(
      oliverProfile,
      oliverListingItem,
      oliverSkills,
      oliverStories
    );
    await seedProfile(
      jasonProfile,
      jasonListingItem,
      jasonSkills,
      jasonStories
    );

    console.log('\n=== Seed complete ===\n');
    console.log('Summary:');
    console.log('  • Tenant: Change Connected');
    console.log('  • Profiles: 2 (Oliver Bradley, Jason Jones)');
    console.log('  • Skills: 9 total');
    console.log('  • Stories: 7 total\n');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

main();
