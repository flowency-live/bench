/**
 * Cognito Identity Service — ADR-0014 Passwordless.
 *
 * Provides identity lookup for Cognito users (social auth via OAuth).
 * Password-based methods removed per ADR-0014.
 *
 * User Pool: eu-west-2_QjvjE2Cvl
 */

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-2';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? 'eu-west-2_QjvjE2Cvl';

let client: CognitoIdentityProviderClient | null = null;

function getClient(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: AWS_REGION });
  }
  return client;
}

/** Error codes for Cognito operations. */
export type CognitoErrorCode = 'USER_NOT_FOUND' | 'UNKNOWN';

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

  console.error(`[cognito-error] ${context ?? 'unknown'}: ${err.name} - ${err.message}`);

  if (err.name === 'UserNotFoundException') {
    return new CognitoError('USER_NOT_FOUND', 'No account found for this email.');
  }

  return new CognitoError('UNKNOWN', err.message);
}
