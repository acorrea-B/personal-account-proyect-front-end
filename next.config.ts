import type { NextConfig } from 'next';

// The dist dir is overridable: the local verification build runs with
// NEXT_DIST_DIR=.next-prod (npm run build:isolated) so the build never
// replaces the dev server's chunk vocabulary in the shared .next while a
// dev session is live - the race that blanked every dev route with 404s.
// Note the export contract: next build with the default .next dir writes
// the static site to out/ for the ci and deploy workflows; with a custom
// dist dir the export lands inside that dir and out/ is not produced,
// which is why the keep-running CI builds stay on the default.
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
