#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CCHubFoundationStack } from '../lib/stacks/cchub-foundation-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'eu-west-2', // London - UK data residency
};

// Phase 0: Foundation stack
new CCHubFoundationStack(app, 'CCHubFoundationStack', {
  env,
  description: 'CCHub Foundation - Route 53, ACM, S3 for assets',
  tags: {
    Project: 'CCHub',
    Environment: 'production',
  },
});

// Phase 1 stacks will be added here:
// - CCHubAuthStack (Cognito)
// - CCHubDataStack (DynamoDB)
// - CCHubApiStack (API Gateway + Lambda)
// - CCHubFrontendStack (Amplify)
// - CCHubPdfStack (PDF Lambda)
