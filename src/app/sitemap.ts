import type { MetadataRoute } from 'next';
import { isDbConfigured, query } from '@/lib/db';
import { SITE } from '@/lib/brand';
import { POLICY_STUBS } from '@/features/marketing/policies';

const STATIC_ROUTES = [
  '',
  '/about',
  '/how-it-works',
  '/programmes',
  '/programmes/tales-from-the-baobab',
  '/perspectives',
  '/archive',
  '/authors',
  '/partners',
  '/support',
  '/news',
  '/contact',
  '/policies',
];

async function rows<T>(sql: string): Promise<T[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<T>(sql);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [stories, authors, news, competitions] = await Promise.all([
    // Only what is genuinely public — an internal or partner-only record must
    // never be advertised in the sitemap.
    rows<{ slug: string; updated_at: string }>(
      `SELECT s.slug, s.updated_at FROM stories s
         JOIN archive_metadata am ON am.story_id = s.id
        WHERE am.visibility IN ('public_excerpt','public_full')
          AND s.status IN ('published','archived')`,
    ),
    rows<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM profiles WHERE is_public = true AND slug IS NOT NULL`,
    ),
    rows<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM news_posts WHERE status = 'published' AND published_at <= now()`,
    ),
    rows<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM competitions WHERE status <> 'draft'`,
    ),
  ]);

  return [
    ...STATIC_ROUTES.map((path) => ({
      url: `${SITE.url}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
    })),
    ...POLICY_STUBS.map((p) => ({ url: `${SITE.url}/policies/${p.slug}`, priority: 0.3 })),
    ...competitions.map((c) => ({ url: `${SITE.url}/programmes/${c.slug}`, lastModified: c.updated_at, priority: 0.8 })),
    ...stories.map((s) => ({ url: `${SITE.url}/archive/${s.slug}`, lastModified: s.updated_at, priority: 0.6 })),
    ...authors.map((a) => ({ url: `${SITE.url}/authors/${a.slug}`, lastModified: a.updated_at, priority: 0.5 })),
    ...news.map((n) => ({ url: `${SITE.url}/news/${n.slug}`, lastModified: n.updated_at, priority: 0.5 })),
  ];
}
