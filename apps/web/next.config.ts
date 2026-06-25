import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cchub/ui', '@cchub/domain', '@cchub/types'],
  experimental: {
    typedRoutes: true,
  },
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
