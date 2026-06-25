import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export interface BenchAuthStackProps extends cdk.StackProps {
  readonly domainName?: string;
  readonly vpc: ec2.IVpc;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly databaseSecurityGroup: ec2.ISecurityGroup;
}

/**
 * Bench Auth Stack - Cognito User Pool with multi-tenant support
 */
export class BenchAuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: BenchAuthStackProps) {
    super(scope, id, props);

    const domainName = props.domainName ?? 'bench.opstack.uk';

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'bench-users',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({
          mutable: false,
          minLen: 1,
          maxLen: 64,
        }),
        role: new cognito.StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 32,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
    });

    // Pre-token generation Lambda - adds tenant context to JWT claims
    // Currently reads from Cognito attributes; will query DB when needed
    const preTokenLambda = new lambda.Function(this, 'PreTokenGenerationLambda', {
      functionName: 'bench-pre-token-generation',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const tenantId = event.request.userAttributes['custom:tenantId'];
          const role = event.request.userAttributes['custom:role'] || 'owner';

          event.response = {
            claimsOverrideDetails: {
              claimsToAddOrOverride: {
                'custom:tenantId': tenantId,
                'custom:role': role,
              },
            },
          };

          return event;
        };
      `),
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: {
        DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
      },
    });

    // Grant read access to database credentials
    props.databaseSecret.grantRead(preTokenLambda);

    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION,
      preTokenLambda
    );

    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: 'bench-auth',
      },
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'bench-web',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${domainName}/api/auth/callback`,
          'http://localhost:3000/api/auth/callback',
        ],
        logoutUrls: [
          `https://${domainName}`,
          'http://localhost:3000',
        ],
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'BenchUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'BenchUserPoolArn',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'BenchUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito User Pool Domain',
      exportName: 'BenchUserPoolDomain',
    });

    new cdk.CfnOutput(this, 'HostedUIUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI URL',
    });
  }
}
