import type { NextConfig } from 'next';

// The dist dir is overridable: production builds run with
// NEXT_DIST_DIR=.next-prod (npm run build:isolated) so the build never
// replaces the dev server's chunk vocabulary in the shared .next while a
// dev session is live - the race that blanked every dev route with 404s.
// The dev server keeps .next; the static export always ships from out/.
const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/photos/**',
      },
    ],
  },
};

export default nextConfig;
