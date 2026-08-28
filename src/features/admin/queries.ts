import { isDbConfigured, query, queryOne } from '@/lib/db';

/** Read models for the staff console. All callers are already behind requireStaff(). */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error(`[admin:query] ${(e as Error).message}`);
    return fallback;
  }
}

// ---- competitions ----------------------------------------------------------------

export interface AdminCompetition {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  results_at: string | null;
  word_min: number;
  word_max: number;
  max_entries: number;
  min_age: number | null;
  max_age: number | null;
  themes: string[];
  countries: string[];
  languages: string[];
  blind_judging: boolean;
  allow_score_revision: boolean;
  requires_guardian_consent: boolean;
  rules_version: string;
  rules_html: string;
  eligibility_html: string;
  description: string;
  rubric_id: string | null;
  is_featured: boolean;
  submission_count: number;
}

export async function adminCompetitions(): Promise<AdminCompetition[]> {
  return safe(
    () =>
      query<AdminCompetition>(
        `SELECT c.*, count(s.id) FILTER (WHERE s.status <> 'DRAFT')::int AS submission_count
           FROM competitions c
           LEFT JOIN submissions s ON s.competition_id = c.id
          GROUP BY c.id
          ORDER BY c.created_at DESC`,
      ),
    [],
  );
}

export async function adminCompetition(id: string): Promise<AdminCompetition | null> {
  return safe(
    () =>
      queryOne<AdminCompetition>(
        `SELECT c.*, count(s.id) FILTER (WHERE s.status <> 'DRAFT')::int AS submission_count
           FROM competitions c
           LEFT JOIN submissions s ON s.competition_id = c.id
          WHERE c.id = $1
          GROUP BY c.id`,
        [id],
      ),
    null,
  );
}

export async function rubrics() {
  return safe(
    () =>
      query<{ id: string; name: string; version: number; is_locked: boolean; criteria: number }>(
        `SELECT r.id, r.name, r.version, r.is_locked, count(rc.id)::int AS criteria
           FROM rubrics r
           LEFT JOIN rubric_criteria rc ON rc.rubric_id = r.id
          GROUP BY r.id
          ORDER BY r.created_at DESC`,
      ),
    [],
  );
}

// ---- submissions -------------------------------------------------------------------

export interface AdminSubmissionRow {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  writer_name: string;
  writer_email: string;
  competition_name: string;
  competition_id: string;
  word_count: number | null;
  submitted_at: string | null;
  consent_status: string | null;
  age_band: string | null;
  assigned: number;
  completed: number;
  average_score: string | null;
}

export async function adminSubmissions(filters: {
  status?: string;
  competitionId?: string;
  q?: string;
  limit?: number;
}): Promise<AdminSubmissionRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`s.status = $${params.length}`);
  } else {
    where.push(`s.status <> 'DRAFT'`);
  }
  if (filters.competitionId) {
    params.push(filters.competitionId);
    where.push(`s.competition_id = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`(s.title ILIKE $${params.length} OR s.reference ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }
  params.push(filters.limit ?? 200);

  return safe(
    () =>
      query<AdminSubmissionRow>(
        `SELECT s.id, s.reference, s.title, s.status, u.name AS writer_name, u.email AS writer_email,
                c.name AS competition_name, c.id AS competition_id, s.word_count, s.submitted_at,
                gc.status AS consent_status, p.age_band,
                count(ra.id) FILTER (WHERE ra.status <> 'revoked')::int AS assigned,
                count(ra.id) FILTER (WHERE ra.status = 'completed')::int AS completed,
                round(avg(r.total_score) FILTER (WHERE r.submitted_at IS NOT NULL), 1)::text AS average_score
           FROM submissions s
           JOIN users u ON u.id = s.writer_id
           JOIN competitions c ON c.id = s.competition_id
           LEFT JOIN profiles p ON p.user_id = s.writer_id
           LEFT JOIN guardian_consents gc ON gc.id = s.consent_id
           LEFT JOIN review_assignments ra ON ra.submission_id = s.id
           LEFT JOIN reviews r ON r.assignment_id = ra.id
          WHERE ${where.join(' AND ')}
          GROUP BY s.id, u.name, u.email, c.name, c.id, gc.status, p.age_band
          ORDER BY s.submitted_at DESC NULLS LAST
          LIMIT $${params.length}`,
        params,
      ),
    [],
  );
}

export async function reviewsForSubmission(submissionId: string) {
  return safe(
    () =>
      query<{
        assignment_id: string;
        review_id: string | null;
        judge_name: string;
        status: string;
        conflict_flag: boolean;
        conflict_note: string;
        total_score: string | null;
        max_score: string | null;
        recommendation: string | null;
        comments: string;
        internal_notes: string;
        submitted_at: string | null;
        locked_at: string | null;
      }>(
        `SELECT ra.id AS assignment_id, r.id AS review_id, u.name AS judge_name, ra.status,
                ra.conflict_flag, ra.conflict_note,
                r.total_score::text, r.max_score::text, r.recommendation, r.comments,
                r.internal_notes, r.submitted_at, r.locked_at
           FROM review_assignments ra
           JOIN users u ON u.id = ra.judge_id
           LEFT JOIN reviews r ON r.assignment_id = ra.id
          WHERE ra.submission_id = $1
          ORDER BY u.name`,
        [submissionId],
      ),
    [],
  );
}

// ---- stories & archive ----------------------------------------------------------------

export interface AdminStoryRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  author_name: string;
  published_at: string | null;
  visibility: string | null;
  featured: boolean | null;
  adaptation_ready: boolean | null;
  submission_id: string | null;
  sync_status: string | null;
}

export async function adminStories(): Promise<AdminStoryRow[]> {
  return safe(
    () =>
      query<AdminStoryRow>(
        `SELECT s.id, s.slug, s.title, s.status, u.name AS author_name, s.published_at,
                am.visibility, am.featured, am.adaptation_ready, s.submission_id,
                q.status AS sync_status
           FROM stories s
           JOIN users u ON u.id = s.author_id
           LEFT JOIN archive_metadata am ON am.story_id = s.id
           LEFT JOIN emoworld_sync_queue q ON q.story_id = s.id
          ORDER BY s.updated_at DESC`,
      ),
    [],
  );
}

export async function adminStory(id: string) {
  return safe(
    () =>
      queryOne<{
        id: string;
        slug: string;
        title: string;
        synopsis: string;
        excerpt: string | null;
        body_html: string | null;
        language: string;
        genre: string | null;
        themes: string[];
        word_count: number | null;
        status: string;
        published_at: string | null;
        author_id: string;
        author_name: string;
        submission_id: string | null;
        reference: string | null;
        competition_name: string | null;
        country: string | null;
        region: string | null;
        am_language: string | null;
        am_genre: string | null;
        am_themes: string[] | null;
        keywords: string[] | null;
        age_band: string | null;
        cultural_context: string | null;
        edition: string | null;
        year: number | null;
        visibility: string | null;
        featured: boolean | null;
        adaptation_ready: boolean | null;
        adaptation_notes: string | null;
        cover_file_id: string | null;
        cover_key: string | null;
      }>(
        `SELECT s.id, s.slug, s.title, s.synopsis, s.excerpt, s.body_html, s.language, s.genre,
                s.themes, s.word_count, s.status, s.published_at, s.author_id, u.name AS author_name,
                s.cover_file_id, fc.storage_key AS cover_key,
                s.submission_id, sub.reference, c.name AS competition_name,
                am.country, am.region, am.language AS am_language, am.genre AS am_genre,
                am.themes AS am_themes, am.keywords, am.age_band, am.cultural_context,
                am.edition, am.year, am.visibility, am.featured, am.adaptation_ready,
                am.adaptation_notes
           FROM stories s
           JOIN users u ON u.id = s.author_id
           LEFT JOIN archive_metadata am ON am.story_id = s.id
           LEFT JOIN submissions sub ON sub.id = s.submission_id
           LEFT JOIN competitions c ON c.id = sub.competition_id
           LEFT JOIN files fc ON fc.id = s.cover_file_id
          WHERE s.id = $1`,
        [id],
      ),
    null,
  );
}

export async function rightsForStory(storyId: string) {
  return safe(
    () =>
      query<{
        id: string;
        owner_name: string;
        ownership_note: string;
        licence_type: string | null;
        territory: string | null;
        term_start: string | null;
        term_end: string | null;
        restrictions: string;
        status: string;
        notes: string;
      }>(
        `SELECT id, owner_name, ownership_note, licence_type, territory, term_start, term_end,
                restrictions, status, notes
           FROM rights_records WHERE story_id = $1 ORDER BY created_at DESC`,
        [storyId],
      ),
    [],
  );
}

/** Approved submissions that do not yet have a canonical story record. */
export async function publishableSubmissions() {
  return safe(
    () =>
      query<{
        id: string;
        reference: string | null;
        title: string;
        writer_name: string;
        status: string;
        competition_name: string;
      }>(
        `SELECT s.id, s.reference, s.title, u.name AS writer_name, s.status, c.name AS competition_name
           FROM submissions s
           JOIN users u ON u.id = s.writer_id
           JOIN competitions c ON c.id = s.competition_id
          WHERE s.status IN ('EDITORIAL', 'APPROVED_FOR_PUBLICATION')
            AND NOT EXISTS (SELECT 1 FROM stories st WHERE st.submission_id = s.id)
          ORDER BY s.updated_at DESC`,
      ),
    [],
  );
}

// ---- people, inquiries, messages, content ------------------------------------------------

export async function adminUsers(q?: string) {
  const params: unknown[] = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE u.name ILIKE $1 OR u.email ILIKE $1`;
  }
  return safe(
    () =>
      query<{
        id: string;
        name: string;
        email: string;
        status: string;
        email_verified_at: string | null;
        created_at: string;
        last_login_at: string | null;
        roles: string[] | null;
        submissions: number;
      }>(
        `SELECT u.id, u.name, u.email, u.status, u.email_verified_at, u.created_at, u.last_login_at,
                array_remove(array_agg(DISTINCT ur.role), NULL) AS roles,
                count(DISTINCT s.id)::int AS submissions
           FROM users u
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN submissions s ON s.writer_id = u.id
           ${where}
          GROUP BY u.id
          ORDER BY u.created_at DESC
          LIMIT 300`,
        params,
      ),
    [],
  );
}

export async function adminInquiries() {
  return safe(
    () =>
      query<{
        id: string;
        requester_name: string;
        requester_email: string;
        requester_role: string | null;
        format: string | null;
        message: string;
        status: string;
        created_at: string;
        response_note: string;
        story_title: string | null;
        story_slug: string | null;
        organisation_name: string | null;
      }>(
        `SELECT i.id, i.requester_name, i.requester_email, i.requester_role, i.format, i.message,
                i.status, i.created_at, i.response_note,
                s.title AS story_title, s.slug AS story_slug, o.name AS organisation_name
           FROM adaptation_inquiries i
           LEFT JOIN stories s ON s.id = i.story_id
           LEFT JOIN organisations o ON o.id = i.organisation_id
          ORDER BY CASE i.status WHEN 'new' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
                   i.created_at DESC
          LIMIT 200`,
      ),
    [],
  );
}

export async function adminMessages() {
  return safe(
    () =>
      query<{
        id: string;
        name: string;
        email: string;
        organisation: string;
        topic: string;
        subject: string;
        message: string;
        status: string;
        created_at: string;
      }>(
        `SELECT id, name, email, organisation, topic, subject, message, status, created_at
           FROM contact_messages
          ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC
          LIMIT 200`,
      ),
    [],
  );
}

export async function adminNews() {
  return safe(
    () =>
      query<{
        id: string;
        slug: string;
        title: string;
        excerpt: string;
        status: string;
        published_at: string | null;
        updated_at: string;
      }>(
        `SELECT id, slug, title, excerpt, status, published_at, updated_at
           FROM news_posts ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 200`,
      ),
    [],
  );
}

export async function adminPages() {
  return safe(
    () =>
      query<{
        id: string;
        slug: string;
        title: string;
        kind: string;
        status: string;
        version: number;
        updated_at: string;
      }>(`SELECT id, slug, title, kind, status, version, updated_at FROM pages ORDER BY kind, title`),
    [],
  );
}

export interface AdminFileRow {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: string;
  purpose: string;
  visibility: string;
  created_at: string;
  owner_name: string | null;
  linked_to: string | null;
}

/** The file library: every registered R2 object and what it belongs to. */
export async function adminFiles(purpose?: string): Promise<AdminFileRow[]> {
  const params: unknown[] = [];
  let where = '';
  if (purpose) {
    params.push(purpose);
    where = 'WHERE f.purpose = $1';
  }
  return safe(
    () =>
      query<AdminFileRow>(
        `SELECT f.id, f.original_name, f.mime_type, f.size_bytes::text, f.purpose, f.visibility,
                f.created_at, u.name AS owner_name,
                COALESCE(
                  (SELECT s.reference || ' · ' || s.title FROM submissions s WHERE s.file_id = f.id LIMIT 1),
                  (SELECT s2.reference || ' · v' || v.version_number
                     FROM story_versions v JOIN submissions s2 ON s2.id = v.submission_id
                    WHERE v.file_id = f.id LIMIT 1),
                  (SELECT 'Cover · ' || st.title FROM stories st WHERE st.cover_file_id = f.id LIMIT 1)
                ) AS linked_to
           FROM files f
           LEFT JOIN users u ON u.id = f.owner_id
           ${where}
          ORDER BY f.created_at DESC
          LIMIT 300`,
        params,
      ),
    [],
  );
}

export async function allSettings() {
  return safe(
    () =>
      query<{ key: string; value: unknown; updated_at: string; updated_by_name: string | null }>(
        `SELECT s.key, s.value, s.updated_at, u.name AS updated_by_name
           FROM settings s LEFT JOIN users u ON u.id = s.updated_by
          ORDER BY s.key`,
      ),
    [],
  );
}

export async function auditLog(limit = 200, entityType?: string) {
  const params: unknown[] = [];
  let where = '';
  if (entityType) {
    params.push(entityType);
    where = `WHERE a.entity_type = $1`;
  }
  params.push(limit);
  return safe(
    () =>
      query<{
        id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        metadata: Record<string, unknown>;
        ip: string | null;
        created_at: string;
        actor_name: string | null;
        actor_email: string | null;
      }>(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip, a.created_at,
                u.name AS actor_name, u.email AS actor_email
           FROM audit_events a
           LEFT JOIN users u ON u.id = a.actor_id
           ${where}
          ORDER BY a.created_at DESC
          LIMIT $${params.length}`,
        params,
      ),
    [],
  );
}

export async function notificationLog(limit = 100) {
  return safe(
    () =>
      query<{
        id: string;
        type: string;
        to_email: string | null;
        subject: string;
        created_at: string;
        sent_at: string | null;
        attempts: number;
        last_error: string | null;
      }>(
        `SELECT id, type, to_email, subject, created_at, sent_at, attempts, last_error
           FROM notifications ORDER BY created_at DESC LIMIT $1`,
        [limit],
      ),
    [],
  );
}
