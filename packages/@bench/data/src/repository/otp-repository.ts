/**
 * OTP Repository — DynamoDB implementation (ADR-0014)
 *
 * Provides phone OTP storage for passwordless authentication:
 * - 6-digit numeric codes
 * - 5-minute TTL (DynamoDB TTL attribute)
 * - Single-use (deleted after successful verification)
 *
 * Key pattern: OTP#{phoneHash}
 * The phone number is hashed before storage for privacy.
 */
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * OTP TTL in seconds (5 minutes)
 */
const OTP_TTL_SECONDS = 5 * 60;

/**
 * Build OTP partition key from phone hash
 */
function otpPK(phoneHash: string): string {
  return `OTP#${phoneHash}`;
}

/**
 * OTP creation result
 */
export interface OtpCreateResult {
  /** The 6-digit OTP code (send this to the user) */
  readonly code: string;
  /** ISO timestamp when the OTP expires */
  readonly expiresAt: string;
}

/**
 * OTP repository interface
 */
export interface OtpRepository {
  /**
   * Create a new OTP for a phone hash.
   * Generates a 6-digit code with 5-minute TTL.
   * If an OTP already exists for this phone, it's overwritten.
   *
   * @param phoneHash - SHA-256 hash of the phone number
   * @returns The generated code and expiry time
   */
  create(phoneHash: string): Promise<OtpCreateResult>;

  /**
   * Verify an OTP code.
   * Returns true if the code matches and hasn't expired.
   * On successful verification, the OTP is deleted (single-use).
   * On wrong code, the OTP is preserved (allows retries until expiry).
   * On expired OTP, it's deleted.
   *
   * @param phoneHash - SHA-256 hash of the phone number
   * @param code - The 6-digit code to verify
   * @returns true if valid, false otherwise
   */
  verify(phoneHash: string, code: string): Promise<boolean>;

  /**
   * Delete an OTP (e.g., when user cancels or too many attempts).
   *
   * @param phoneHash - SHA-256 hash of the phone number
   */
  delete(phoneHash: string): Promise<void>;
}

/**
 * DynamoDB item shape for OTP
 */
interface OtpItem {
  PK: string;
  SK: string;
  entityType: 'OTP';
  phoneHash: string;
  code: string;
  TTL: number;
  expiresAt: string;
  createdAt: string;
}

/**
 * Generate a cryptographically random 6-digit OTP code.
 */
function generateOtpCode(): string {
  // Generate a random number between 0 and 999999
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Array is guaranteed to have one element since we created it with size 1
  const code = (array[0] ?? 0) % 1000000;
  // Pad to 6 digits
  return code.toString().padStart(6, '0');
}

/**
 * Create an OTP repository backed by DynamoDB.
 *
 * @param client - DynamoDB Document client
 * @param tableName - DynamoDB table name
 * @returns OtpRepository instance
 */
export function createOtpRepository(
  client: DynamoDBDocumentClient,
  tableName: string
): OtpRepository {
  return {
    async create(phoneHash: string): Promise<OtpCreateResult> {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
      const code = generateOtpCode();

      const item: OtpItem = {
        PK: otpPK(phoneHash),
        SK: otpPK(phoneHash),
        entityType: 'OTP',
        phoneHash,
        code,
        TTL: Math.floor(expiresAt.getTime() / 1000),
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
      };

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        })
      );

      return {
        code,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async verify(phoneHash: string, code: string): Promise<boolean> {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: otpPK(phoneHash),
            SK: otpPK(phoneHash),
          },
        })
      );

      if (!result.Item) {
        return false;
      }

      const item = result.Item as OtpItem;

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(item.expiresAt);
      if (now > expiresAt) {
        // Delete expired OTP
        await this.delete(phoneHash);
        return false;
      }

      // Check if code matches
      if (item.code !== code) {
        return false;
      }

      // Valid! Delete (single-use) and return true
      await this.delete(phoneHash);
      return true;
    },

    async delete(phoneHash: string): Promise<void> {
      await client.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            PK: otpPK(phoneHash),
            SK: otpPK(phoneHash),
          },
        })
      );
    },
  };
}
