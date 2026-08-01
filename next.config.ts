import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Google Cloud Run containerized deployment
  images: {
    unoptimized: true, // Cloud Run has no persistent storage for image cache
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.kroger.com',
      },
    ],
  },
};

export default nextConfig;
