import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Note: Don't use 'standalone' - Amplify handles Next.js SSR natively
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ['@bench/ui', '@bench/domain', '@bench/types', '@bench/data'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '*.s3.eu-west-2.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
