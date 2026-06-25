/**
 * DynamoDB client factory
 *
 * Creates a DynamoDB Document client configured for the Bench table.
 * Uses IAM authentication - no database credentials needed.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface ClientConfig {
  readonly region?: string;
  readonly endpoint?: string;
}

/**
 * Create a DynamoDB Document client.
 *
 * @param config - Optional configuration (region, endpoint for local dev)
 * @returns DynamoDB Document client
 */
export function createClient(config?: ClientConfig): DynamoDBDocumentClient {
  const baseClient = new DynamoDBClient({
    region: config?.region ?? process.env['AWS_REGION'] ?? 'eu-west-2',
    ...(config?.endpoint && { endpoint: config.endpoint }),
  });

  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}

/**
 * Get the table name from environment.
 */
export function getTableName(): string {
  const tableName = process.env['TABLE_NAME'];
  if (!tableName) {
    throw new Error('TABLE_NAME environment variable is required');
  }
  return tableName;
}
