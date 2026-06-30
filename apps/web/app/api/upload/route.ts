import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { getSession, getTenantId } from '@/lib/auth/session';

const BUCKET_NAME = process.env.ASSETS_BUCKET ?? 'bench-assets-771551874768';
const REGION = process.env.AWS_REGION ?? 'eu-west-2';
const CLOUDFRONT_DOMAIN = process.env.ASSETS_CDN_DOMAIN ?? 'd11emspihzqp3c.cloudfront.net';

/**
 * Server-side upload handler.
 * Receives the image blob and uploads directly to S3, bypassing CORS issues.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const tenantId = getTenantId(session);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const profileId = formData.get('profileId') as string | null;

    if (!file || !profileId) {
      return NextResponse.json(
        { error: 'Missing file or profileId' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique key
    const assetId = randomUUID();
    const key = `tenants/${tenantId}/profiles/${profileId}/headshot-${assetId}.jpg`;

    // Upload to S3
    const client = new S3Client({ region: REGION });
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      })
    );

    // Return the CDN URL
    const assetUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

    return NextResponse.json({ assetUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
