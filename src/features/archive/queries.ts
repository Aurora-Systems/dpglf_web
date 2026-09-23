import { isDbConfigured, query, queryOne } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';
import { visibleLevels, type Visibility } from '@/lib/permissions';

/**
 * Story Archive search.
 *
 * Postgres full-text search plus indexed metadata filters — no separate search
 * service. That is sufficient for the first thousands of stories and keeps the
 * architecture to one moving part; revisit only when real archive usage proves
 * it insufficient.
 *
 * Visibility is applied in SQL, never in the template. A story the viewer may
 * not see never leaves the database.
 */

export interface ArchiveFilters {
  q?: string;
  country?: string;
  language?: string;
  genre?: string;
  theme?: string;
  year?: string;
  edition?: string;
  age?: string;
  adaptationReady?: boolean;
  page?: number;
}

export interface ArchiveRow {
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
  visibility: Visibility;
  adaptation_ready: boolean;
  year: number | null;
  cover_key: string | null;
}

export const PAGE_SIZE = 12;

export async function searchArchive(
  user: SessionUser | null,
  filters: ArchiveFilters,
): Promise<{ rows: ArchiveRow[]; total: number }> {
  if (!isDbConfigured()) return { rows: [], total: 0 };

  const levels = visibleLevels(user);
  const params: unknown[] = [levels];
  const where: string[] = [
    `am.visibility = ANY($1::text[])`,
    `s.status IN ('published', 'archived', 'approved')`,
  ];

  const q = filters.q?.trim();
  if (q) {
    params.push(q);
    // websearch_to_tsquery understands quoted phrases and OR the way a reader
    // would expect from a search box.
    where.push(`am.search_vector @@ websearch_to_tsquery('english', $${params.length})`);
  }
  for (const [column, value] of [
    ['am.country', filters.country],
    ['am.language', filters.language],
    ['am.genre', filters.genre],
    ['am.edition', filters.edition],
    ['am.age_band', filters.age],
  ] as const) {
    if (value) {
      params.push(value);
      where.push(`${column} = $${params.length}`);
    }
  }
  if (filters.theme) {
    params.push(filters.theme);
    where.push(`$${params.length} = ANY(am.themes)`);
  }
  if (filters.year) {
    params.push(Number(filters.year));
    where.push(`am.year = $${params.length}`);
  }
  if (filters.adaptationReady) where.push(`am.adaptation_ready = true`);

  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;
  const rankOrder = q
    ? `ts_rank(am.search_vector, websearch_to_tsquery('english', $2)) DESC,`
    : `am.featured DESC,`;

  try {
    const rows = await query<ArchiveRow>(
      `SELECT s.id, s.slug, s.title, s.synopsis, s.language, s.genre, s.themes, s.published_at,
              COALESCE(NULLIF(p.pen_name, ''), NULLIF(p.display_name, ''), u.name) AS author_name,
              CASE WHEN p.is_public THEN p.slug END AS author_slug, am.country, am.visibility, am.adaptation_ready, am.year,
              fc.storage_key AS cover_key
         FROM stories s
         JOIN archive_metadata am ON am.story_id = s.id
         JOIN users u ON u.id = s.author_id
         LEFT JOIN profiles p ON p.user_id = s.author_id
         LEFT JOIN files fc ON fc.id = s.cover_file_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${rankOrder} s.published_at DESC NULLS LAST, s.title
        LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      params,
    );
    const count = await queryOne<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM stories s
         JOIN archive_metadata am ON am.story_id = s.id
        WHERE ${where.join(' AND ')}`,
      params,
    );
    return { rows, total: Number(count?.n ?? 0) };
  } catch (e) {
    console.error(`[archive:search] ${(e as Error).message}`);
    return { rows: [], total: 0 };
  }
}

export interface ArchiveFacets {
  countries: string[];
  languages: string[];
  genres: string[];
  themes: string[];
  years: number[];
  editions: string[];
  ageBands: string[];
}

export async function archiveFacets(user: SessionUser | null): Promise<ArchiveFacets> {
  const empty: ArchiveFacets = {
    countries: [],
    languages: [],
    genres: [],
    themes: [],
    years: [],
    editions: [],
    ageBands: [],
  };
  if (!isDbConfigured()) return empty;
  try {
    const row = await queryOne<{
      countries: string[] | null;
      languages: string[] | null;
      genres: string[] | null;
      themes: string[] | null;
      years: number[] | null;
      editions: string[] | null;
      age_bands: string[] | null;
    }>(
      `SELECT array_remove(array_agg(DISTINCT am.country), NULL)  AS countries,
              array_remove(array_agg(DISTINCT am.language), NULL) AS languages,
              array_remove(array_agg(DISTINCT am.genre), NULL)    AS genres,
              array_remove(array_agg(DISTINCT t), NULL)           AS themes,
              array_remove(array_agg(DISTINCT am.year), NULL)     AS years,
              array_remove(array_agg(DISTINCT am.edition), NULL)  AS editions,
              array_remove(array_agg(DISTINCT am.age_band), NULL) AS age_bands
         FROM archive_metadata am
         JOIN stories s ON s.id = am.story_id
         LEFT JOIN LATERAL unnest(am.themes) AS t ON true
        WHERE am.visibility = ANY($1::text[])
          AND s.status IN ('published', 'archived', 'approved')`,
      [visibleLevels(user)],
    );
    return {
      countries: (row?.countries ?? []).filter(Boolean).sort(),
      languages: (row?.languages ?? []).filter(Boolean).sort(),
      genres: (row?.genres ?? []).filter(Boolean).sort(),
      themes: (row?.themes ?? []).filter(Boolean).sort(),
      years: (row?.years ?? []).filter(Boolean).sort((a, b) => b - a),
      editions: (row?.editions ?? []).filter(Boolean).sort(),
      ageBands: (row?.age_bands ?? []).filter(Boolean).sort(),
    };
  } catch (e) {
    console.error(`[archive:facets] ${(e as Error).message}`);
    return empty;
  }
}

export interface ArchiveStory extends ArchiveRow {
  author_id: string;
  body_html: string | null;
  excerpt: string | null;
  word_count: number | null;
  cultural_context: string;
  keywords: string[];
  age_band: string | null;
  edition: string | null;
  region: string | null;
  author_bio: string;
  author_country: string | null;
  competition_name: string | null;
}

export async function archiveStory(user: SessionUser | null, slug: string): Promise<ArchiveStory | null> {
  if (!isDbConfigured()) return null;
  try {
    return await queryOne<ArchiveStory>(
      `SELECT s.id, s.slug, s.title, s.synopsis, s.language, s.genre, s.themes, s.published_at,
              s.author_id, s.body_html, s.excerpt, s.word_count,
              COALESCE(NULLIF(p.pen_name, ''), NULLIF(p.display_name, ''), u.name) AS author_name,
              -- A private profile still supplies the byline, never its bio or page.
              CASE WHEN p.is_public THEN p.slug END AS author_slug,
              CASE WHEN p.is_public THEN COALESCE(p.bio, '') ELSE '' END AS author_bio,
              CASE WHEN p.is_public THEN p.country END AS author_country,
              am.country, am.region, am.visibility, am.adaptation_ready, am.year,
              am.cultural_context, am.keywords, am.age_band, am.edition,
              c.name AS competition_name,
              fc.storage_key AS cover_key
         FROM stories s
         JOIN archive_metadata am ON am.story_id = s.id
         JOIN users u ON u.id = s.author_id
         LEFT JOIN profiles p ON p.user_id = s.author_id
         LEFT JOIN submissions sub ON sub.id = s.submission_id
         LEFT JOIN competitions c ON c.id = sub.competition_id
         LEFT JOIN files fc ON fc.id = s.cover_file_id
        WHERE s.slug = $1
          AND am.visibility = ANY($2::text[])
          AND s.status IN ('published', 'archived', 'approved')`,
      [slug, visibleLevels(user)],
    );
  } catch (e) {
    console.error(`[archive:story] ${(e as Error).message}`);
    return null;
  }
}

export async function publicationsForStory(storyId: string) {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      publication_type: string;
      title: string;
      edition: string | null;
      publisher: string | null;
      isbn: string | null;
      publication_date: string | null;
      url: string | null;
    }>(
      `SELECT id, publication_type, title, edition, publisher, isbn, publication_date, url
         FROM publications WHERE story_id = $1 ORDER BY publication_date DESC NULLS LAST`,
      [storyId],
    );
  } catch {
    return [];
  }
}

export async function authorProfile(slug: string) {
  if (!isDbConfigured()) return null;
  try {
    return await queryOne<{
      user_id: string;
      display_name: string;
      pen_name: string | null;
      bio: string;
      country: string | null;
      city: string | null;
      languages: string[];
      achievements: string;
      website: string | null;
    }>(
      `SELECT user_id, display_name, pen_name, bio, country, city, languages, achievements, website
         FROM profiles WHERE slug = $1 AND is_public = true`,
      [slug],
    );
  } catch {
    return null;
  }
}

export async function storiesByAuthor(user: SessionUser | null, authorId: string): Promise<ArchiveRow[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<ArchiveRow>(
      `SELECT s.id, s.slug, s.title, s.synopsis, s.language, s.genre, s.themes, s.published_at,
              COALESCE(NULLIF(p.pen_name, ''), NULLIF(p.display_name, ''), u.name) AS author_name,
              CASE WHEN p.is_public THEN p.slug END AS author_slug, am.country, am.visibility, am.adaptation_ready, am.year,
              fc.storage_key AS cover_key
         FROM stories s
         JOIN archive_metadata am ON am.story_id = s.id
         JOIN users u ON u.id = s.author_id
         LEFT JOIN profiles p ON p.user_id = s.author_id
         LEFT JOIN files fc ON fc.id = s.cover_file_id
        WHERE s.author_id = $1
          AND am.visibility = ANY($2::text[])
          AND s.status IN ('published', 'archived', 'approved')
        ORDER BY s.published_at DESC NULLS LAST`,
      [authorId, visibleLevels(user)],
    );
  } catch {
    return [];
  }
}
