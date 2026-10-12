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
  /** The attached rubric, if any. */
  rubric_name: string | null;
  rubric_version: number | null;
  rubric_criteria: number;
}

// Entries exclude writers' unsent drafts. Correlated subqueries rather than a
// GROUP BY, so the rubric join cannot multiply the count.
const ADMIN_COMPETITION_SELECT = `
  SELECT c.*,
         r.name AS rubric_name,
         r.version AS rubric_version,
         (SELECT count(*) FROM rubric_criteria rc WHERE rc.rubric_id = c.rubric_id)::int AS rubric_criteria,
         (SELECT count(*) FROM submissions s
           WHERE s.competition_id = c.id AND s.status <> 'DRAFT')::int AS submission_count
    FROM competitions c
    LEFT JOIN rubrics r ON r.id = c.rubric_id`;

export async function adminCompetitions(): Promise<AdminCompetition[]> {
  return safe(
    () => query<AdminCompetition>(`${ADMIN_COMPETITION_SELECT} ORDER BY c.created_at DESC`),
    [],
  );
}

export async function adminCompetition(id: string): Promise<AdminCompetition | null> {
  return safe(
    () => queryOne<AdminCompetition>(`${ADMIN_COMPETITION_SELECT} WHERE c.id = $1`, [id]),
    null,
  );
}

export interface RubricRow {
  id: string;
  name: string;
  version: number;
  is_locked: boolean;
  description: string;
  created_at: string;
  criteria: number;
  criterion_labels: string[];
  /** Competitions that currently judge with this rubric. */
  competitions: { id: string; name: string }[];
}

export async function rubrics(): Promise<RubricRow[]> {
  return safe(
    () =>
      query<RubricRow>(
        `SELECT r.id, r.name, r.version, r.is_locked, r.description, r.created_at,
                (SELECT count(*) FROM rubric_criteria rc WHERE rc.rubric_id = r.id)::int AS criteria,
                ARRAY(SELECT rc.label FROM rubric_criteria rc
                       WHERE rc.rubric_id = r.id ORDER BY rc.sort_order) AS criterion_labels,
                COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.created_at DESC)
                            FROM competitions c WHERE c.rubric_id = r.id), '[]'::json) AS competitions
           FROM rubrics r
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

/**
 * Submitted entries per status, for the filter chips. `n` honours the same
 * competition and search filters as adminSubmissions; `total` ignores them, so
 * a "waiting" count stays true whatever the filters say.
 */
export async function adminSubmissionCounts(filters: {
  competitionId?: string;
  q?: string;
}): Promise<Record<string, { n: number; total: number }>> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filters.competitionId) {
    params.push(filters.competitionId);
    conds.push(`s.competition_id = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    conds.push(`(s.title ILIKE $${params.length} OR s.reference ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }

  const rows = await safe(
    () =>
      query<{ status: string; n: number; total: number }>(
        `SELECT s.status,
                count(*) FILTER (WHERE ${conds.length ? conds.join(' AND ') : 'true'})::int AS n,
                count(*)::int AS total
           FROM submissions s
           JOIN users u ON u.id = s.writer_id
          WHERE s.status <> 'DRAFT'
          GROUP BY s.status`,
        params,
      ),
    [],
  );
  return Object.fromEntries(rows.map((r) => [r.status, { n: r.n, total: r.total }]));
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

/**
 * The guardian consent an entry relies on: who gave it, how and when. Shown on
 * the staff page for the safeguarding record; the phone number and IP stay out.
 */
export async function consentForSubmission(submissionId: string) {
  return safe(
    () =>
      queryOne<{
        status: string;
        guardian_name: string;
        guardian_email: string;
        relationship: string;
        method: string;
        requested_at: string;
        granted_at: string | null;
        revoked_at: string | null;
        evidence_file_id: string | null;
      }>(
        `SELECT gc.status, gc.guardian_name, gc.guardian_email, gc.relationship, gc.method,
                gc.requested_at, gc.granted_at, gc.revoked_at, gc.evidence_file_id
           FROM submissions s
           JOIN guardian_consents gc ON gc.id = s.consent_id
          WHERE s.id = $1`,
        [submissionId],
      ),
    null,
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
           -- The latest handoff only: cancelled rows stay behind as history.
           LEFT JOIN LATERAL (
             SELECT status FROM emoworld_sync_queue
              WHERE story_id = s.id ORDER BY created_at DESC LIMIT 1
           ) q ON true
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
        // Dates as 'YYYY-MM-DD' text: the driver would otherwise hand back Date
        // objects (which the form's .slice() cannot take), at local midnight.
        `SELECT id, owner_name, ownership_note, licence_type, territory,
                term_start::text AS term_start, term_end::text AS term_end,
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

/**
 * People for the staff list. `q` matches name or email; `roles` keeps only
 * people holding at least one of those roles (the "Staff" chip passes both
 * administrator roles).
 */
export async function adminUsers(q?: string, roles?: string[]) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (roles && roles.length > 0) {
    params.push(roles);
    where.push(
      `EXISTS (SELECT 1 FROM user_roles fr WHERE fr.user_id = u.id AND fr.role = ANY($${params.length}::text[]))`,
    );
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
           ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          GROUP BY u.id
          ORDER BY u.created_at DESC
          LIMIT 300`,
        params,
      ),
    [],
  );
}

export interface AdminUserCounts {
  all: number;
  writer: number;
  judge: number;
  mentor: number;
  editor: number;
  partner: number;
  /** Admin or super admin. */
  staff: number;
}

/** How many people each role chip on the list would show, for the same search. */
export async function adminUserCounts(q?: string): Promise<AdminUserCounts> {
  const params: unknown[] = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE u.name ILIKE $1 OR u.email ILIKE $1`;
  }
  const empty: AdminUserCounts = { all: 0, writer: 0, judge: 0, mentor: 0, editor: 0, partner: 0, staff: 0 };
  return safe(async () => {
    const row = await queryOne<AdminUserCounts>(
      `SELECT count(*)::int AS "all",
              count(*) FILTER (WHERE 'writer' = ANY(r.roles))::int AS writer,
              count(*) FILTER (WHERE 'judge' = ANY(r.roles))::int AS judge,
              count(*) FILTER (WHERE 'mentor' = ANY(r.roles))::int AS mentor,
              count(*) FILTER (WHERE 'editor' = ANY(r.roles))::int AS editor,
              count(*) FILTER (WHERE 'partner' = ANY(r.roles))::int AS partner,
              count(*) FILTER (WHERE r.roles && ARRAY['admin', 'super_admin'])::int AS staff
         FROM users u
         LEFT JOIN LATERAL (SELECT array_agg(role) AS roles FROM user_roles WHERE user_id = u.id) r ON true
         ${where}`,
      params,
    );
    return row ?? empty;
  }, empty);
}

/** One person for the manage page. Null for an unknown id. */
export async function adminUser(id: string) {
  return safe(
    () =>
      queryOne<{
        id: string;
        name: string;
        email: string;
        status: string;
        email_verified_at: string | null;
        created_at: string;
        last_login_at: string | null;
        roles: string[] | null;
        submissions: number;
        drafts: number;
      }>(
        `SELECT u.id, u.name, u.email, u.status, u.email_verified_at, u.created_at, u.last_login_at,
                array_remove(array_agg(DISTINCT ur.role), NULL) AS roles,
                (SELECT count(*)::int FROM submissions s
                  WHERE s.writer_id = u.id AND s.status <> 'DRAFT') AS submissions,
                (SELECT count(*)::int FROM submissions s
                  WHERE s.writer_id = u.id AND s.status = 'DRAFT') AS drafts
           FROM users u
           LEFT JOIN user_roles ur ON ur.user_id = u.id
          WHERE u.id = $1::uuid
          GROUP BY u.id`,
        [id],
      ),
    null,
  );
}

/**
 * A person's recent audit trail: what they did, and what staff did to their
 * account (roles changed, suspended). `about_them` marks the second kind.
 */
export async function userActivity(userId: string, limit = 30) {
  return safe(
    () =>
      query<{
        id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        created_at: string;
        metadata: Record<string, unknown>;
        actor_id: string | null;
        actor_name: string | null;
        actor_email: string | null;
        about_them: boolean;
        /** The record's own name, as in auditLog. */
        entity_label: string | null;
      }>(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, a.metadata,
                a.actor_id, u.name AS actor_name, u.email AS actor_email,
                (a.actor_id IS DISTINCT FROM $1::uuid) AS about_them,
                ${auditEntityLabelSql('a')} AS entity_label
           FROM audit_events a
           LEFT JOIN users u ON u.id = a.actor_id
          WHERE a.actor_id = $1::uuid OR (a.entity_type = 'user' AND a.entity_id = $2)
          ORDER BY a.created_at DESC
          LIMIT $3::int`,
        [userId, userId, limit],
      ),
    [],
  );
}

/** Rights enquiries, open ones first. `statuses` keeps only those stages. */
export async function adminInquiries(statuses?: string[]) {
  const params: unknown[] = [];
  let where = '';
  if (statuses && statuses.length > 0) {
    params.push(statuses);
    where = `WHERE i.status = ANY($1::text[])`;
  }
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
        handled_at: string | null;
        handled_by_name: string | null;
        story_id: string | null;
        story_title: string | null;
        story_slug: string | null;
        organisation_name: string | null;
      }>(
        `SELECT i.id, i.requester_name, i.requester_email, i.requester_role, i.format, i.message,
                i.status, i.created_at, i.response_note, i.handled_at, h.name AS handled_by_name,
                i.story_id, s.title AS story_title, s.slug AS story_slug, o.name AS organisation_name
           FROM adaptation_inquiries i
           LEFT JOIN stories s ON s.id = i.story_id
           LEFT JOIN organisations o ON o.id = i.organisation_id
           LEFT JOIN users h ON h.id = i.handled_by
           ${where}
          ORDER BY CASE i.status WHEN 'new' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
                   i.created_at DESC
          LIMIT 200`,
        params,
      ),
    [],
  );
}

/** Rights enquiries per status, for the view links. */
export async function adminInquiryCounts(): Promise<Record<string, number>> {
  return safe(async () => {
    const rows = await query<{ status: string; n: number }>(
      `SELECT status, count(*)::int AS n FROM adaptation_inquiries GROUP BY status`,
    );
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }, {});
}

/** Contact form messages, optionally only those with one status (new, handled, spam). */
export async function adminMessages(status?: string) {
  const params: unknown[] = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE status = $1';
  }
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
           ${where}
          ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC
          LIMIT 200`,
        params,
      ),
    [],
  );
}

/** How many messages carry each status, for the inbox filter. */
export async function adminMessageCounts(): Promise<Record<string, number>> {
  const rows = await safe(
    () => query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM contact_messages GROUP BY status`),
    [],
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
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
        cover_key: string | null;
      }>(
        `SELECT n.id, n.slug, n.title, n.excerpt, n.status, n.published_at, n.updated_at,
                f.storage_key AS cover_key
           FROM news_posts n
           LEFT JOIN files f ON f.id = n.cover_file_id
          ORDER BY COALESCE(n.published_at, n.updated_at) DESC LIMIT 200`,
      ),
    [],
  );
}

/** One post with everything its edit form needs. */
export async function adminNewsPost(id: string) {
  return safe(
    () =>
      queryOne<{
        id: string;
        slug: string;
        title: string;
        excerpt: string;
        body_html: string;
        tags: string[];
        status: string;
        published_at: string | null;
        updated_at: string;
        cover_key: string | null;
        cover_alt: string;
      }>(
        `SELECT n.id, n.slug, n.title, n.excerpt, n.body_html, n.tags, n.status, n.published_at,
                n.updated_at, f.storage_key AS cover_key, n.cover_alt
           FROM news_posts n
           LEFT JOIN files f ON f.id = n.cover_file_id
          WHERE n.id = $1::uuid`,
        [id],
      ),
    null,
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
        /** False for a row that exists but has no wording yet. */
        has_body: boolean;
      }>(
        `SELECT id, slug, title, kind, status, version, updated_at, (btrim(body_html) <> '') AS has_body
           FROM pages ORDER BY kind, title`,
      ),
    [],
  );
}

/** One policy or static page with everything its editor needs, drafts included. */
export async function adminPage(slug: string) {
  return safe(
    () =>
      queryOne<{
        id: string;
        slug: string;
        title: string;
        summary: string;
        body_html: string;
        kind: string;
        status: string;
        version: number;
        updated_at: string;
        updated_by_name: string | null;
      }>(
        `SELECT p.id, p.slug, p.title, p.summary, p.body_html, p.kind, p.status, p.version, p.updated_at,
                u.name AS updated_by_name
           FROM pages p
           LEFT JOIN users u ON u.id = p.updated_by
          WHERE p.slug = $1`,
        [slug],
      ),
    null,
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
                  (SELECT 'Cover · ' || st.title FROM stories st WHERE st.cover_file_id = f.id LIMIT 1),
                  (SELECT 'News · ' || n.title FROM news_posts n WHERE n.cover_file_id = f.id LIMIT 1)
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

/** How many files there are of each purpose, for the library filter. */
export async function adminFileCounts(): Promise<Record<string, number>> {
  const rows = await safe(
    () => query<{ purpose: string; n: number }>(`SELECT purpose, count(*)::int AS n FROM files GROUP BY purpose`),
    [],
  );
  return Object.fromEntries(rows.map((r) => [r.purpose, Number(r.n)]));
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
        actor_id: string | null;
        actor_name: string | null;
        actor_email: string | null;
        /** The record's own name (entry title, person, story...) where one is easy to find. */
        entity_label: string | null;
      }>(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip, a.created_at,
                a.actor_id, u.name AS actor_name, u.email AS actor_email,
                ${auditEntityLabelSql('a')} AS entity_label
           FROM audit_events a
           LEFT JOIN users u ON u.id = a.actor_id
           ${where}
          ORDER BY a.created_at DESC
          LIMIT $${params.length}::int`,
        params,
      ),
    [],
  );
}

/**
 * SQL for an audit event's record name (entry title, person, story...), given
 * the audit_events alias. Null when the record is gone or has no page.
 * Labels compare on id::text: entity_id is free text, and a cast the other way
 * would fail the whole log on one row that is not a uuid.
 */
function auditEntityLabelSql(a: string): string {
  return `CASE ${a}.entity_type
            WHEN 'submission' THEN (SELECT COALESCE(NULLIF(s.title, ''), s.reference)
                                      FROM submissions s WHERE s.id::text = ${a}.entity_id)
            WHEN 'story' THEN (SELECT st.title FROM stories st WHERE st.id::text = ${a}.entity_id)
            WHEN 'user' THEN (SELECT COALESCE(NULLIF(eu.name, ''), eu.email)
                                FROM users eu WHERE eu.id::text = ${a}.entity_id)
            WHEN 'competition' THEN (SELECT c.name FROM competitions c WHERE c.id::text = ${a}.entity_id)
            WHEN 'news_post' THEN (SELECT n.title FROM news_posts n WHERE n.id::text = ${a}.entity_id)
            WHEN 'setting' THEN ${a}.entity_id
          END`;
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
        /** Whether the message body was stored, which the retry needs. */
        retryable: boolean;
      }>(
        `SELECT id, type, to_email, subject, created_at, sent_at, attempts, last_error,
                (channel = 'email' AND payload ? 'html') AS retryable
           FROM notifications ORDER BY created_at DESC LIMIT $1`,
        [limit],
      ),
    [],
  );
}

export interface NotificationSummary {
  sent: number;
  unsent: number;
  week_sent: number;
  week_unsent: number;
  /** Unsent messages the retry can act on (their body was stored). */
  retryable: number;
}

/** Delivery totals for the email page: all time, and the last seven days. */
export async function notificationSummary(): Promise<NotificationSummary> {
  const empty: NotificationSummary = { sent: 0, unsent: 0, week_sent: 0, week_unsent: 0, retryable: 0 };
  return safe(async () => {
    const row = await queryOne<NotificationSummary>(
      `SELECT count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
              count(*) FILTER (WHERE sent_at IS NULL)::int AS unsent,
              count(*) FILTER (WHERE sent_at IS NULL AND channel = 'email' AND payload ? 'html')::int AS retryable,
              count(*) FILTER (WHERE sent_at IS NOT NULL AND created_at >= now() - interval '7 days')::int AS week_sent,
              count(*) FILTER (WHERE sent_at IS NULL AND created_at >= now() - interval '7 days')::int AS week_unsent
         FROM notifications`,
    );
    return row ?? empty;
  }, empty);
}
