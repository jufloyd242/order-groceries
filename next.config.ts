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
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
    ],
  },
};

export default nextConfig;
