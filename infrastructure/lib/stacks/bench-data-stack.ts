import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export interface BenchDataStackProps extends cdk.StackProps {
  readonly databaseName?: string;
}

/**
 * Bench Data Stack - Aurora Serverless v2 (Postgres) + pgvector
 *
 * Per ADR-0001: Aurora chosen for relational integrity, RLS tenant isolation,
 * and pgvector for V2 semantic matching. Replaces the Phase 0 DynamoDB design.
 *
 * Per ADR-0002: Multi-tenancy via RLS - every table has tenant_id, enforced by
 * Postgres row-level security policies.
 */
export class BenchDataStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly databaseCluster: rds.DatabaseCluster;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly ddlSecret: secretsmanager.ISecret;
  public readonly appSecret: secretsmanager.ISecret;
  public readonly databaseProxy: rds.DatabaseProxy;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: BenchDataStackProps) {
    super(scope, id, props);

    const databaseName = props?.databaseName ?? 'bench';

    // VPC with isolated subnets for the database (no NAT needed for DB-only access)
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'bench-vpc',
      maxAzs: 2,
      natGateways: 1, // One NAT for Lambda outbound (Secrets Manager, etc.)
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security group for Aurora cluster and RDS Proxy
    // allowAllOutbound: true is safe - cluster is in isolated subnet with no internet route
    // RDS Proxy needs egress to reach the cluster on 5432
    this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'bench-aurora-sg',
      description: 'Security group for Bench Aurora cluster and RDS Proxy',
      allowAllOutbound: true,
    });

    // Allow inbound Postgres from within the VPC (Lambda → Proxy → Cluster)
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow Postgres from VPC'
    );

    // Database credentials in Secrets Manager
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: 'bench/aurora/credentials',
      description: 'Bench Aurora database credentials (master user)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'bench_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // DDL role credentials (bench_ddl - schema owner, BYPASSRLS)
    // Used by migrations and SECURITY DEFINER functions
    this.ddlSecret = new secretsmanager.Secret(this, 'DdlSecret', {
      secretName: 'bench/aurora/ddl-credentials',
      description: 'Bench Aurora DDL role credentials (schema owner)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'bench_ddl' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // App role credentials (bench_app - runtime, NOBYPASSRLS)
    // Used by Lambda functions; subject to RLS policies
    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: 'bench/aurora/app-credentials',
      description: 'Bench Aurora app role credentials (runtime)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'bench_app' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Aurora Serverless v2 cluster with Postgres + pgvector
    this.databaseCluster = new rds.DatabaseCluster(this, 'DatabaseCluster', {
      clusterIdentifier: 'bench-aurora',
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      defaultDatabaseName: databaseName,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2('reader', {
          scaleWithWriter: true,
          publiclyAccessible: false,
        }),
      ],
      storageEncrypted: true,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      backup: {
        retention: cdk.Duration.days(7),
        preferredWindow: '02:00-03:00', // UTC
      },
      enableDataApi: true, // Enable Data API for serverless access
    });

    // RDS Proxy for connection pooling (critical for Lambda)
    // Includes all three role secrets for flexible connection routing
    this.databaseProxy = new rds.DatabaseProxy(this, 'DatabaseProxy', {
      dbProxyName: 'bench-aurora-proxy',
      proxyTarget: rds.ProxyTarget.fromCluster(this.databaseCluster),
      secrets: [this.databaseSecret, this.ddlSecret, this.appSecret],
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.securityGroup],
      requireTLS: true,
      idleClientTimeout: cdk.Duration.minutes(30),
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'BenchVpcId',
    });

    new cdk.CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.databaseCluster.clusterEndpoint.hostname,
      description: 'Aurora cluster endpoint',
      exportName: 'BenchDatabaseEndpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseProxyEndpoint', {
      value: this.databaseProxy.endpoint,
      description: 'RDS Proxy endpoint (use this from Lambda)',
      exportName: 'BenchDatabaseProxyEndpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'Database credentials secret ARN (master)',
      exportName: 'BenchDatabaseSecretArn',
    });

    new cdk.CfnOutput(this, 'DdlSecretArn', {
      value: this.ddlSecret.secretArn,
      description: 'DDL role credentials secret ARN',
      exportName: 'BenchDdlSecretArn',
    });

    new cdk.CfnOutput(this, 'AppSecretArn', {
      value: this.appSecret.secretArn,
      description: 'App role credentials secret ARN',
      exportName: 'BenchAppSecretArn',
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: databaseName,
      description: 'Database name',
      exportName: 'BenchDatabaseName',
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'Database security group ID',
      exportName: 'BenchDatabaseSecurityGroupId',
    });
  }
}
