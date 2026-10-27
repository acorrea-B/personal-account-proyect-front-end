import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

// The public crawl set: the landing and the account entry points. The
// private workspace and the verification handoff never appear here.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries = ['', 'login/', 'register/'];
  return entries.map((path) => ({
    url: `${siteUrl}/${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
