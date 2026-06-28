import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export interface BenchAuthStackProps extends cdk.StackProps {
  readonly domainName?: string;
  readonly table: dynamodb.ITable;
  /**
   * Google OAuth client ID for godmode sign-in.
   * If not provided, Google IdP will not be configured.
   * Required for godmode Google sign-in (ADR-0012).
   */
  readonly googleClientId?: string;
  /**
   * ARN of the Secrets Manager secret containing the Google OAuth client secret.
   * The secret should have a JSON key 'clientSecret'.
   * If not provided, Google IdP will not be configured.
   */
  readonly googleClientSecretArn?: string;
  /**
   * Enable SES email identity for the domain.
   * When true, creates SES identity with DKIM and Route 53 records.
   */
  readonly enableSesIdentity?: boolean;
}

/**
 * Bench Auth Stack - Cognito User Pool with multi-tenant support
 *
 * Per ADR-0008: Uses DynamoDB for tenant lookups (no VPC required).
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
    });

    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION,
      preTokenLambda
    );

    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: 'bench-auth',
      },
    });

    // Google IdP for godmode sign-in (ADR-0012)
    // Only configured if googleClientId and googleClientSecretArn are provided
    let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;
    if (props.googleClientId && props.googleClientSecretArn) {
      const googleSecret = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'GoogleOAuthSecret',
        props.googleClientSecretArn
      );

      googleProvider = new cognito.UserPoolIdentityProviderGoogle(
        this,
        'GoogleProvider',
        {
          userPool: this.userPool,
          clientId: props.googleClientId,
          clientSecretValue: googleSecret.secretValueFromJson('clientSecret'),
          scopes: ['email', 'profile', 'openid'],
          attributeMapping: {
            email: cognito.ProviderAttribute.GOOGLE_EMAIL,
            fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          },
        }
      );
    }

    // Determine supported identity providers
    const supportedIdentityProviders = googleProvider
      ? [
          cognito.UserPoolClientIdentityProvider.COGNITO,
          cognito.UserPoolClientIdentityProvider.GOOGLE,
        ]
      : [cognito.UserPoolClientIdentityProvider.COGNITO];

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'bench-web',
      generateSecret: false,
      supportedIdentityProviders,
      authFlows: {
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
          `https://${domainName}/godmode/auth/callback`, // Godmode Google OAuth callback
          'http://localhost:3000/api/auth/callback',
          'http://localhost:3000/godmode/auth/callback', // Dev godmode callback
        ],
        logoutUrls: [
          `https://${domainName}`,
          `https://${domainName}/godmode`, // Godmode logout
          'http://localhost:3000',
          'http://localhost:3000/godmode', // Dev godmode logout
        ],
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // Ensure client depends on Google provider if configured
    if (googleProvider) {
      this.userPoolClient.node.addDependency(googleProvider);
    }

    // SES Email Identity for sending emails (Phase 4, ADR-0012)
    if (props.enableSesIdentity) {
      // Look up hosted zone internally (no cross-stack dependency)
      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName,
      });

      const emailIdentity = new ses.EmailIdentity(this, 'EmailIdentity', {
        identity: ses.Identity.publicHostedZone(hostedZone),
        // DKIM signing enabled by default
        // Route 53 records created automatically
      });

      new cdk.CfnOutput(this, 'SesEmailIdentityArn', {
        value: emailIdentity.emailIdentityArn,
        description: 'SES Email Identity ARN',
      });

      new cdk.CfnOutput(this, 'SesSenderEmail', {
        value: `no-reply@${domainName}`,
        description: 'SES sender email address',
      });
    }

    // IAM Managed Policy for Amplify runtime (SES + Cognito permissions)
    // Attach this policy to the Amplify SSR service role via AWS Console
    const amplifyRuntimePolicy = new iam.ManagedPolicy(
      this,
      'AmplifyRuntimePolicy',
      {
        managedPolicyName: 'bench-amplify-runtime-policy',
        description:
          'Grants Amplify SSR runtime permissions for SES email and Cognito auth (ADR-0012)',
        statements: [
          // SES: Send emails from bench.opstack.uk
          new iam.PolicyStatement({
            sid: 'SesSendEmail',
            effect: iam.Effect.ALLOW,
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: [
              `arn:aws:ses:${this.region}:${this.account}:identity/${domainName}`,
            ],
            conditions: {
              StringEquals: {
                'ses:FromAddress': `no-reply@${domainName}`,
              },
            },
          }),
          // Cognito: User auth operations (Phase 3 - owner email/password)
          new iam.PolicyStatement({
            sid: 'CognitoUserAuth',
            effect: iam.Effect.ALLOW,
            actions: [
              'cognito-idp:SignUp',
              'cognito-idp:InitiateAuth',
              'cognito-idp:RespondToAuthChallenge',
              'cognito-idp:ForgotPassword',
              'cognito-idp:ConfirmForgotPassword',
              'cognito-idp:ConfirmSignUp',
              'cognito-idp:GetUser',
              'cognito-idp:GlobalSignOut',
            ],
            resources: [this.userPool.userPoolArn],
          }),
          // Cognito: Admin operations for user management
          new iam.PolicyStatement({
            sid: 'CognitoAdminOps',
            effect: iam.Effect.ALLOW,
            actions: [
              'cognito-idp:AdminCreateUser',
              'cognito-idp:AdminGetUser',
              'cognito-idp:AdminSetUserPassword',
              'cognito-idp:AdminUpdateUserAttributes',
              'cognito-idp:AdminDeleteUser',
            ],
            resources: [this.userPool.userPoolArn],
          }),
        ],
      }
    );

    new cdk.CfnOutput(this, 'AmplifyRuntimePolicyArn', {
      value: amplifyRuntimePolicy.managedPolicyArn,
      description:
        'Attach this policy to your Amplify SSR service role in IAM Console',
      exportName: 'BenchAmplifyRuntimePolicyArn',
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

    // Google IdP callback URL (for Google Cloud Console configuration)
    new cdk.CfnOutput(this, 'GoogleIdpCallbackUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com/oauth2/idpresponse`,
      description:
        'Google IdP callback URL - configure this in Google Cloud Console as Authorized redirect URI',
    });

    // Godmode callback URL
    new cdk.CfnOutput(this, 'GodmodeCallbackUrl', {
      value: `https://${domainName}/godmode/auth/callback`,
      description: 'Godmode auth callback URL',
    });
  }
}
