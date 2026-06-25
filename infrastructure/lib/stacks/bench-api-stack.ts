import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import type { Construct } from 'constructs';

export interface BenchApiStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly databaseProxy: rds.IDatabaseProxy;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
  readonly assetsBucket: s3.IBucket;
  readonly certificate: acm.ICertificate;
  readonly hostedZone: route53.IHostedZone;
  readonly domainName?: string;
}

/**
 * Bench API Stack - HTTP API with Lambda functions
 *
 * Per ADR-0001/0002: Lambdas connect to Aurora via RDS Proxy.
 * Each request sets tenant context via SET LOCAL for RLS enforcement.
 */
export class BenchApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly jwtSigningKey: kms.Key;

  constructor(scope: Construct, id: string, props: BenchApiStackProps) {
    super(scope, id, props);

    const domainName = props.domainName ?? 'bench.opstack.uk';

    this.jwtSigningKey = new kms.Key(this, 'JwtSigningKey', {
      description: 'Bench JWT signing key for magic link sessions',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: 'bench/jwt-secret',
      description: 'JWT signing secret for Bench magic link sessions',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'secret',
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    // Lambda security group - allows outbound (VPC CIDR rule in Data stack permits Postgres)
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: 'bench-lambda-sg',
      description: 'Security group for Bench Lambda functions',
      allowAllOutbound: true,
    });

    const commonEnv = {
      DATABASE_PROXY_ENDPOINT: props.databaseProxy.endpoint,
      DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
      ASSETS_BUCKET: props.assetsBucket.bucketName,
      JWT_SECRET_ARN: jwtSecret.secretArn,
      USER_POOL_ID: props.userPool.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      DOMAIN_NAME: domainName,
      NODE_OPTIONS: '--enable-source-maps',
    };

    const createLambda = (name: string, description: string) => {
      return new lambda.Function(this, `${name}Lambda`, {
        functionName: `bench-${name.toLowerCase()}`,
        description,
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
          exports.handler = async (event) => {
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: '${name} endpoint placeholder', path: event.rawPath }),
            };
          };
        `),
        environment: commonEnv,
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE,
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSecurityGroup],
      });
    };

    const profilesLambda = createLambda('Profiles', 'Profile CRUD operations');
    const magicLinksLambda = createLambda('MagicLinks', 'Magic link generation and validation');
    const wizardLambda = createLambda('Wizard', 'Wizard auto-save and submit');
    const assetsLambda = createLambda('Assets', 'Image upload and processing');
    const tenantsLambda = createLambda('Tenants', 'Tenant settings and brand tokens');

    const allLambdas = [profilesLambda, magicLinksLambda, wizardLambda, assetsLambda, tenantsLambda];

    for (const fn of allLambdas) {
      // Grant access to database credentials
      props.databaseSecret.grantRead(fn);
      jwtSecret.grantRead(fn);
      this.jwtSigningKey.grantEncryptDecrypt(fn);
    }

    props.assetsBucket.grantReadWrite(assetsLambda);
    props.assetsBucket.grantPut(profilesLambda);

    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: 'bench-api',
      description: 'Bench API - Consultant Profile Platform',
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Bench-Session',
          'X-Bench-Tenant',
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: [
          `https://${domainName}`,
          `https://*.${domainName}`,
          'http://localhost:3000',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },
    });

    const jwtAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      }
    );

    const profilesIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ProfilesIntegration',
      profilesLambda
    );
    const magicLinksIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'MagicLinksIntegration',
      magicLinksLambda
    );
    const wizardIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'WizardIntegration',
      wizardLambda
    );
    const assetsIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'AssetsIntegration',
      assetsLambda
    );
    const tenantsIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'TenantsIntegration',
      tenantsLambda
    );

    // Protected routes
    this.httpApi.addRoutes({
      path: '/api/profiles',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: profilesIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/profiles/{id}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PUT],
      integration: profilesIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/profiles/{id}/publish',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: profilesIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/profiles/{id}/archive',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: profilesIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/links/invite',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: magicLinksIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/links/share',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: magicLinksIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/links/{id}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: magicLinksIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/assets/upload-url',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: assetsIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/assets/{id}/process',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: assetsIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/tenants/{id}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PUT],
      integration: tenantsIntegration,
      authorizer: jwtAuthorizer,
    });

    // Public routes
    this.httpApi.addRoutes({
      path: '/api/links/validate/{token}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: magicLinksIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/wizard/{profileId}',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: wizardIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/wizard/{profileId}/submit',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: wizardIntegration,
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API endpoint URL',
      exportName: 'BenchApiEndpoint',
    });

    new cdk.CfnOutput(this, 'HttpApiId', {
      value: this.httpApi.httpApiId,
      description: 'HTTP API ID',
      exportName: 'BenchApiId',
    });
  }
}
