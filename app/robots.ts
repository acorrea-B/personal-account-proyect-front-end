import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

// The crawler contract: the landing and the account entry points stay
// crawlable; the private workspace (and the logout handoff, and the
// pending-verification step) stay out of every index.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/app/cv/', '/app/profile/', '/logout/', '/register/confirm/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
