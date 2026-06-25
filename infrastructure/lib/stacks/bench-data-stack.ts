import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

export interface BenchDataStackProps extends cdk.StackProps {
  readonly tableName?: string;
}

/**
 * Bench Data Stack - DynamoDB single-table design with multi-tenant isolation
 *
 * Key Design (per ADR-0008):
 * - All partition keys are prefixed with TENANT#{tenantId} for complete isolation
 * - GSI1: Email lookups (global, for login - returns tenantId)
 * - GSI2: Tenant-scoped status queries (profiles by status within a tenant)
 * - GSI3: Token hash lookup (global, for magic link validation)
 *
 * Access Patterns:
 * | Pattern                          | PK                         | SK                    | Index |
 * |----------------------------------|----------------------------|-----------------------|-------|
 * | Get tenant                       | TENANT#{id}                | TENANT#{id}           | -     |
 * | Get user by id                   | TENANT#{tid}#USER#{id}     | USER#{id}             | -     |
 * | Get user by email (login)        | -                          | -                     | GSI1  |
 * | Get profile by id                | TENANT#{tid}#PROFILE#{id}  | PROFILE#{id}          | -     |
 * | List profiles in tenant          | TENANT#{tid}               | begins_with PROFILE#  | -     |
 * | List profiles by status          | -                          | -                     | GSI2  |
 * | Skills/stories/testimonial       | TENANT#{tid}#PROFILE#{id}  | SKILL#{n}/STORY#{n}   | -     |
 * | Links/events for profile         | TENANT#{tid}#PROFILE#{id}  | LINK#{type}/EVENT#{ts}| -     |
 * | Validate magic link (global)     | -                          | -                     | GSI3  |
 */
export class BenchDataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: BenchDataStackProps) {
    super(scope, id, props);

    const tableName = props?.tableName ?? 'bench-main';

    this.table = new dynamodb.Table(this, 'MainTable', {
      tableName,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'TTL',
    });

    // GSI1: Email lookups (global, for login - returns tenantId)
    // GSI1PK: EMAIL#{email}
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Tenant-scoped status queries
    // GSI2PK: TENANT#{tid}#STATUS#{status}
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: Token hash lookup (global, for magic link validation)
    // GSI3PK: TOKENHASH#{hash}
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: {
        name: 'GSI3PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI3SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
      exportName: 'BenchTableName',
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN',
      exportName: 'BenchTableArn',
    });

    new cdk.CfnOutput(this, 'TableStreamArn', {
      value: this.table.tableStreamArn ?? '',
      description: 'DynamoDB table stream ARN',
      exportName: 'BenchTableStreamArn',
    });
  }
}
