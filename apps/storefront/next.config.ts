import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Product images served by the admin API's storage adapter: local disk
    // (dev, same-origin proxy) and Supabase Storage (production).
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
