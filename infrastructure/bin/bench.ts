#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BenchFoundationStack } from '../lib/stacks/bench-foundation-stack';
import { BenchDataStack } from '../lib/stacks/bench-data-stack';
import { BenchAuthStack } from '../lib/stacks/bench-auth-stack';
import { BenchApiStack } from '../lib/stacks/bench-api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'eu-west-2',
};

const commonTags = {
  Project: 'Bench',
  Environment: 'production',
  ManagedBy: 'CDK',
};

const foundationStack = new BenchFoundationStack(app, 'BenchFoundationStack', {
  env,
  description: 'Bench Foundation - Route 53, ACM, S3 for assets',
  tags: commonTags,
});

const dataStack = new BenchDataStack(app, 'BenchDataStack', {
  env,
  description: 'Bench Data - DynamoDB single-table with multi-tenant isolation',
  tags: commonTags,
});

const authStack = new BenchAuthStack(app, 'BenchAuthStack', {
  env,
  description: 'Bench Auth - Cognito User Pool with tenant support',
  tags: commonTags,
  table: dataStack.table,
});
authStack.addDependency(dataStack);

const apiStack = new BenchApiStack(app, 'BenchApiStack', {
  env,
  description: 'Bench API - HTTP API with Lambda functions',
  tags: commonTags,
  table: dataStack.table,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  assetsBucket: foundationStack.assetsBucket,
  certificate: foundationStack.certificate,
  hostedZone: foundationStack.hostedZone,
});
apiStack.addDependency(dataStack);
apiStack.addDependency(authStack);
apiStack.addDependency(foundationStack);
