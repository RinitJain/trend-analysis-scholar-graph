import type {NextConfig} from 'next';
import dotenv from 'dotenv';

dotenv.config();

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure heavy native/node-only libs are required at runtime, not bundled by Turbopack
  serverExternalPackages: ['pdf-parse'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
