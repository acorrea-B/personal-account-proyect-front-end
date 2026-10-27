import type { MetadataRoute } from 'next';

// The install manifest: the brand icons ride the same exported files as the
// favicon set, on the canonical bucket host until a custom domain lands.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Professional Profile',
    short_name: 'Profile',
    description: 'Private profile and CV management.',
    start_url: '/app/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#0f6fc5',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
