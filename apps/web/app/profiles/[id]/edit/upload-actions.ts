'use server';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { PILOT_TENANT_ID } from '@/lib/tenant';

const BUCKET_NAME = process.env.ASSETS_BUCKET ?? 'bench-assets';
const REGION = process.env.AWS_REGION ?? 'eu-west-2';
const CLOUDFRONT_DOMAIN = process.env.ASSETS_CDN_DOMAIN ?? 'assets.bench.opstack.uk';

/**
 * Generates a presigned URL for uploading a headshot image to S3.
 * Returns both the upload URL and the final CDN URL for the asset.
 */
export async function getHeadshotUploadUrl(profileId: string): Promise<{
  uploadUrl: string;
  assetUrl: string;
  assetKey: string;
}> {
  const assetId = randomUUID();
  const key = `tenants/${PILOT_TENANT_ID}/profiles/${profileId}/headshot-${assetId}.jpg`;

  const client = new S3Client({ region: REGION });

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: 'image/jpeg',
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: 300, // 5 minutes
  });

  const assetUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

  return {
    uploadUrl,
    assetUrl,
    assetKey: key,
  };
}
