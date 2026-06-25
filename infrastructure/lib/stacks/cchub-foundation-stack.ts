import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type { Construct } from 'constructs';

export interface CCHubFoundationStackProps extends cdk.StackProps {
  readonly domainName?: string;
}

export class CCHubFoundationStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.ICertificate;
  public readonly assetsBucket: s3.Bucket;
  public readonly assetsDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: CCHubFoundationStackProps) {
    super(scope, id, props);

    const domainName = props?.domainName ?? 'cchub.opstack.uk';

    // Route 53 Hosted Zone
    // Note: The hosted zone should be created manually first, then imported
    // This allows DNS to be configured before the stack is deployed
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName,
    });

    // ACM Certificate for the domain (DNS validation)
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // S3 Bucket for assets (headshots, logo, PDFs)
    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `cchub-assets-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: [`https://${domainName}`, `https://*.${domainName}`],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFront distribution for assets
    this.assetsDistribution = new cloudfront.Distribution(this, 'AssetsDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      domainNames: [`assets.${domainName}`],
      certificate: this.certificate,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Route 53 record for assets subdomain
    new route53.ARecord(this, 'AssetsAliasRecord', {
      zone: this.hostedZone,
      recordName: 'assets',
      target: route53.RecordTarget.fromAlias(
        new cdk.aws_route53_targets.CloudFrontTarget(this.assetsDistribution)
      ),
    });

    // Outputs
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM Certificate ARN',
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'S3 Assets Bucket Name',
    });

    new cdk.CfnOutput(this, 'AssetsDistributionDomain', {
      value: this.assetsDistribution.distributionDomainName,
      description: 'CloudFront Distribution Domain',
    });

    new cdk.CfnOutput(this, 'AssetsDomain', {
      value: `assets.${domainName}`,
      description: 'Assets Domain URL',
    });
  }
}
