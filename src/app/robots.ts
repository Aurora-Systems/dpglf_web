import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing behind the sign-in wall, and no signed media URLs, should be
      // crawled — these areas hold unpublished manuscripts and personal data.
      disallow: ['/dashboard/', '/api/', '/media/', '/consent/', '/login', '/signup'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
