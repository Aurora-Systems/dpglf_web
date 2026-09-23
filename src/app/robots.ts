import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // /media serves only the public brand, media and cover prefixes (every
      // other key 404s), and news pictures double as link previews, so those
      // are open. The longer allow paths win over the /media/ disallow.
      // No blanket 'Allow: /': anything not disallowed is allowed anyway, and
      // crawlers that take the first matching line would stop at it.
      allow: ['/media/dpglf/brand/', '/media/dpglf/media/', '/media/dpglf/cover/'],
      // Nothing behind the sign-in wall should be crawled: these areas hold
      // unpublished manuscripts and personal data.
      disallow: ['/dashboard/', '/api/', '/media/', '/consent/', '/login', '/signup'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
