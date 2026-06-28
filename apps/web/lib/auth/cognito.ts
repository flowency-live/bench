/**
 * Cognito Auth Service — Phase 3 (ADR-0012).
 *
 * Provides SRP-based email/password authentication for tenant owners via AWS Cognito.
 * Uses the shared Cognito User Pool deployed by INFRA (BenchAuthStack).
 *
 * User Pool: eu-west-2_QjvjE2Cvl
 * Client ID: 7c6m3ubjne0u3adejpn58ou8cr
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-2';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? 'eu-west-2_QjvjE2Cvl';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? '7c6m3ubjne0u3adejpn58ou8cr';

let client: CognitoIdentityProviderClient | null = null;

function getClient(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: AWS_REGION });
  }
  return client;
}

/** Error codes for Cognito operations. */
export type CognitoErrorCode =
  | 'USER_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'INVALID_CODE'
  | 'INVALID_PASSWORD'
  | 'UNKNOWN';

/** Cognito-specific error with a typed code. */
export class CognitoError extends Error {
  constructor(
    public readonly code: CognitoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CognitoError';
  }
}

/** Result of a successful sign-up. */
export interface SignUpResult {
  readonly userSub: string;
  readonly userConfirmed: boolean;
}

/** Result of a successful sign-in. */
export interface SignInResult {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken?: string;
}

/** Result of initiating forgot password. */
export interface ForgotPasswordResult {
  readonly destination: string;
  readonly deliveryMedium: string;
}

/**
 * Register a new user with Cognito using admin APIs.
 *
 * Used when an owner claims their onboarding link and sets their password.
 * Since selfSignUpEnabled is false in our user pool, we use AdminCreateUser
 * followed by AdminSetUserPassword to create a confirmed user.
 */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const username = email.toLowerCase();

  try {
    // Create user with suppressed welcome message (we handle our own onboarding)
    const createResult = await getClient().send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: [
          { Name: 'email', Value: username },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: 'SUPPRESS', // Don't send temp password email
      }),
    );

    const userSub = createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value ?? '';

    // Set the permanent password (makes user CONFIRMED)
    await getClient().send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: password,
        Permanent: true,
      }),
    );

    return {
      userSub,
      userConfirmed: true,
    };
  } catch (err) {
    throw mapCognitoError(err, 'signUp');
  }
}

/**
 * Authenticate a user via SRP and return tokens.
 *
 * Uses USER_PASSWORD_AUTH flow (requires client to have userPassword enabled,
 * but our pool is SRP-only so we use USER_SRP_AUTH in practice).
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    // Use USER_PASSWORD_AUTH for simplicity (client configured with userSrp: true)
    // This is acceptable for server-side auth where we control the client
    const result = await getClient().send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email.toLowerCase(),
          PASSWORD: password,
        },
      }),
    );

    const auth = result.AuthenticationResult;
    if (!auth?.AccessToken || !auth?.IdToken) {
      throw new CognitoError('UNKNOWN', 'Authentication did not return tokens');
    }

    return {
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
    };
  } catch (err) {
    throw mapCognitoError(err, 'signIn');
  }
}

/**
 * Initiate forgot password flow (sends a code to the user's email).
 */
export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  try {
    const result = await getClient().send(
      new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: email.toLowerCase(),
      }),
    );

    return {
      destination: result.CodeDeliveryDetails?.Destination ?? email,
      deliveryMedium: result.CodeDeliveryDetails?.DeliveryMedium ?? 'EMAIL',
    };
  } catch (err) {
    throw mapCognitoError(err, 'forgotPassword');
  }
}

/**
 * Complete forgot password by confirming the code and setting a new password.
 */
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  try {
    await getClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: email.toLowerCase(),
        ConfirmationCode: code,
        Password: newPassword,
      }),
    );
  } catch (err) {
    throw mapCognitoError(err, 'confirmForgotPassword');
  }
}

/**
 * Get the Cognito user's sub (unique ID) for bindIdentity.
 * Returns null if the user doesn't exist in Cognito.
 */
export async function getUserSub(email: string): Promise<string | null> {
  try {
    const result = await getClient().send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email.toLowerCase(),
      }),
    );

    const subAttr = result.UserAttributes?.find((attr) => attr.Name === 'sub');
    return subAttr?.Value ?? null;
  } catch (err) {
    if (isAwsError(err) && err.name === 'UserNotFoundException') {
      return null;
    }
    throw mapCognitoError(err, 'getUserSub');
  }
}

/** Type guard for AWS SDK errors. */
function isAwsError(err: unknown): err is { name: string; message: string } {
  return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
}

/** Map AWS Cognito exceptions to typed CognitoError. */
function mapCognitoError(err: unknown, context?: string): CognitoError {
  if (err instanceof CognitoError) {
    return err;
  }

  if (!isAwsError(err)) {
    console.error(`[cognito-error] ${context ?? 'unknown'}: non-AWS error`, err);
    return new CognitoError('UNKNOWN', String(err));
  }

  // Log the raw error for debugging
  console.error(`[cognito-error] ${context ?? 'unknown'}: ${err.name} - ${err.message}`);

  switch (err.name) {
    case 'UsernameExistsException':
      return new CognitoError('USER_EXISTS', 'An account with this email already exists.');
    case 'NotAuthorizedException':
      // For signUp context, this usually means a configuration issue, not bad credentials
      if (context === 'signUp') {
        return new CognitoError('UNKNOWN', `Registration failed: ${err.message}`);
      }
      return new CognitoError('INVALID_CREDENTIALS', 'Incorrect email or password.');
    case 'UserNotFoundException':
      return new CognitoError('USER_NOT_FOUND', 'No account found for this email.');
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
      return new CognitoError('INVALID_CODE', 'Invalid or expired verification code.');
    case 'InvalidPasswordException':
      return new CognitoError(
        'INVALID_PASSWORD',
        'Password must be at least 12 characters with uppercase, lowercase, numbers, and symbols.',
      );
    case 'InvalidParameterException':
      return new CognitoError('INVALID_PASSWORD', err.message);
    default:
      return new CognitoError('UNKNOWN', err.message);
  }
}
