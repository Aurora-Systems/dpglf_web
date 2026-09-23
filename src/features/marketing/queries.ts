import { isDbConfigured, query, queryOne } from '@/lib/db';

/**
 * Read models for the public site.
 *
 * Every function here degrades to an empty result if the database is missing or
 * erroring. The marketing site is the Foundation's front door — it must still
 * render its story, mission and calls to action when the data layer is down.
 */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error(`[marketing:query] ${(e as Error).message}`);
    return fallback;
  }
}

export interface CompetitionCard {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  word_min: number;
  word_max: number;
  themes: string[];
  min_age: number | null;
  max_age: number | null;
}

export async function featuredCompetition(): Promise<CompetitionCard | null> {
  return safe(
    () =>
      queryOne<CompetitionCard>(
        `SELECT id, name, slug, tagline, status, opens_at, closes_at, word_min, word_max, themes, min_age, max_age
           FROM competitions
          WHERE status IN ('open', 'judging', 'closed')
          ORDER BY is_featured DESC,
                   CASE status WHEN 'open' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END,
                   closes_at ASC NULLS LAST
          LIMIT 1`,
      ),
    null,
  );
}

export async function openCompetitions(): Promise<CompetitionCard[]> {
  return safe(
    () =>
      query<CompetitionCard>(
        `SELECT id, name, slug, tagline, status, opens_at, closes_at, word_min, word_max, themes, min_age, max_age
           FROM competitions
          WHERE status IN ('open', 'judging', 'closed', 'completed')
          ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, closes_at DESC NULLS LAST
          LIMIT 12`,
      ),
    [],
  );
}

export interface StoryCard {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  language: string | null;
  genre: string | null;
  themes: string[];
  published_at: string | null;
  author_name: string | null;
  author_slug: string | null;
  country: string | null;
  visibility: string;
  cover_key: string | null;
}

const STORY_CARD_SELECT = `
  SELECT s.id, s.slug, s.title, s.synopsis, s.language, s.genre, s.themes, s.published_at,
         COALESCE(NULLIF(p.pen_name, ''), NULLIF(p.display_name, ''), u.name) AS author_name,
         p.slug AS author_slug,
         am.country,
         am.visibility,
         fc.storage_key AS cover_key
    FROM stories s
    JOIN archive_metadata am ON am.story_id = s.id
    JOIN users u ON u.id = s.author_id
    LEFT JOIN profiles p ON p.user_id = s.author_id
    LEFT JOIN files fc ON fc.id = s.cover_file_id`;

export async function featuredStories(limit = 3): Promise<StoryCard[]> {
  return safe(
    () =>
      query<StoryCard>(
        `${STORY_CARD_SELECT}
          WHERE am.visibility IN ('public_excerpt', 'public_full')
            AND s.status IN ('published', 'archived')
          ORDER BY am.featured DESC, s.published_at DESC NULLS LAST
          LIMIT $1`,
        [limit],
      ),
    [],
  );
}

export interface ImpactMetrics {
  submissions: number;
  publishedStories: number;
  countries: number;
  authors: number;
  mentors: number;
  adaptationReady: number;
}

export async function impactMetrics(): Promise<ImpactMetrics> {
  return safe(
    async () => {
      const row = await queryOne<Record<string, string>>(
        `SELECT
           (SELECT count(*) FROM submissions WHERE status <> 'DRAFT')                       AS submissions,
           (SELECT count(*) FROM stories WHERE status IN ('published', 'archived'))         AS published_stories,
           (SELECT count(DISTINCT country) FROM archive_metadata
             WHERE country IS NOT NULL AND country <> '')                                    AS countries,
           (SELECT count(DISTINCT author_id) FROM stories)                                   AS authors,
           (SELECT count(*) FROM user_roles WHERE role = 'mentor')                           AS mentors,
           (SELECT count(*) FROM archive_metadata WHERE adaptation_ready)                    AS adaptation_ready`,
      );
      return {
        submissions: Number(row?.submissions ?? 0),
        publishedStories: Number(row?.published_stories ?? 0),
        countries: Number(row?.countries ?? 0),
        authors: Number(row?.authors ?? 0),
        mentors: Number(row?.mentors ?? 0),
        adaptationReady: Number(row?.adaptation_ready ?? 0),
      };
    },
    { submissions: 0, publishedStories: 0, countries: 0, authors: 0, mentors: 0, adaptationReady: 0 },
  );
}

export interface NewsCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  published_at: string | null;
  tags: string[];
  /** R2 key of the post's picture, served through /media; null when it has none. */
  cover_key: string | null;
  cover_alt: string;
}

export async function latestNews(limit = 3): Promise<NewsCard[]> {
  return safe(
    () =>
      query<NewsCard>(
        `SELECT n.id, n.slug, n.title, n.excerpt, n.published_at, n.tags,
                f.storage_key AS cover_key, n.cover_alt
           FROM news_posts n
           LEFT JOIN files f ON f.id = n.cover_file_id
          WHERE n.status = 'published' AND n.published_at <= now()
          ORDER BY n.published_at DESC
          LIMIT $1`,
        [limit],
      ),
    [],
  );
}

export interface PartnerCard {
  id: string;
  name: string;
  slug: string;
  type: string;
  website: string | null;
  description: string;
  partner_status: string;
}

export async function publicPartners(): Promise<PartnerCard[]> {
  return safe(
    () =>
      query<PartnerCard>(
        `SELECT id, name, slug, type, website, description, partner_status
           FROM organisations
          WHERE is_public = true
          ORDER BY sort_order, name`,
      ),
    [],
  );
}

export async function publicPage(slug: string) {
  return safe(
    () =>
      queryOne<{ slug: string; title: string; summary: string; body_html: string; version: number; updated_at: string }>(
        `SELECT slug, title, summary, body_html, version, updated_at
           FROM pages WHERE slug = $1 AND status = 'published'`,
        [slug],
      ),
    null,
  );
}

export async function publicAuthors(limit = 60) {
  return safe(
    () =>
      query<{
        slug: string;
        display_name: string;
        pen_name: string | null;
        country: string | null;
        bio: string;
        story_count: string;
      }>(
        `SELECT p.slug, p.display_name, p.pen_name, p.country, p.bio,
                count(s.id) FILTER (
                  WHERE s.status IN ('published','archived')
                    AND am.visibility IN ('public_excerpt','public_full')
                )::text AS story_count
           FROM profiles p
           LEFT JOIN stories s ON s.author_id = p.user_id
           LEFT JOIN archive_metadata am ON am.story_id = s.id
          WHERE p.is_public = true AND p.slug IS NOT NULL
          GROUP BY p.slug, p.display_name, p.pen_name, p.country, p.bio
          ORDER BY count(s.id) DESC, p.display_name
          LIMIT $1`,
        [limit],
      ),
    [],
  );
}

export interface CompetitionDetail extends CompetitionCard {
  description: string;
  rules_html: string;
  eligibility_html: string;
  faq: { q: string; a: string }[];
  languages: string[];
  countries: string[];
  max_entries: number;
  results_at: string | null;
  blind_judging: boolean;
  requires_guardian_consent: boolean;
  rules_version: string;
}

export async function competitionBySlug(slug: string): Promise<CompetitionDetail | null> {
  return safe(
    () =>
      queryOne<CompetitionDetail>(
        `SELECT id, name, slug, tagline, description, rules_html, eligibility_html, faq,
                themes, languages, countries, min_age, max_age, word_min, word_max, max_entries,
                opens_at, closes_at, results_at, status, blind_judging, requires_guardian_consent,
                rules_version
           FROM competitions
          WHERE slug = $1 AND status <> 'draft'`,
        [slug],
      ),
    null,
  );
}

export async function newsBySlug(slug: string) {
  return safe(
    () =>
      queryOne<{
        id: string;
        slug: string;
        title: string;
        excerpt: string;
        body_html: string;
        tags: string[];
        published_at: string | null;
        author_name: string | null;
        cover_key: string | null;
        cover_alt: string;
      }>(
        `SELECT n.id, n.slug, n.title, n.excerpt, n.body_html, n.tags, n.published_at, u.name AS author_name,
                f.storage_key AS cover_key, n.cover_alt
           FROM news_posts n
           LEFT JOIN users u ON u.id = n.author_id
           LEFT JOIN files f ON f.id = n.cover_file_id
          WHERE n.slug = $1 AND n.status = 'published' AND n.published_at <= now()`,
        [slug],
      ),
    null,
  );
}

export async function allNews(limit = 40) {
  return safe(
    () =>
      query<NewsCard>(
        `SELECT n.id, n.slug, n.title, n.excerpt, n.published_at, n.tags,
                f.storage_key AS cover_key, n.cover_alt
           FROM news_posts n
           LEFT JOIN files f ON f.id = n.cover_file_id
          WHERE n.status = 'published' AND n.published_at <= now()
          ORDER BY n.published_at DESC
          LIMIT $1`,
        [limit],
      ),
    [],
  );
}

export async function policyPages() {
  return safe(
    () =>
      query<{ slug: string; title: string; summary: string; updated_at: string }>(
        `SELECT slug, title, summary, updated_at
           FROM pages WHERE kind = 'policy' AND status = 'published' ORDER BY title`,
      ),
    [],
  );
}

/** The homepage banner text, set from the admin settings console. */
export async function siteAnnouncement(): Promise<string | null> {
  return safe(
    async () => {
      const row = await queryOne<{ value: { text?: string } }>(
        `SELECT value FROM settings WHERE key = 'site.announcement'`,
      );
      const text = row?.value?.text;
      return typeof text === 'string' && text.trim() ? text.trim() : null;
    },
    null,
  );
}
