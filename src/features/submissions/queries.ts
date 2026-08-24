import { isDbConfigured, query, queryOne } from '@/lib/db';
import type { SubmissionStatus } from '@/lib/workflow';

export interface SubmissionListRow {
  id: string;
  reference: string | null;
  title: string;
  status: SubmissionStatus;
  competition_name: string;
  competition_slug: string;
  closes_at: string | null;
  submitted_at: string | null;
  updated_at: string;
  word_count: number | null;
}

export async function mySubmissions(writerId: string, limit = 50): Promise<SubmissionListRow[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<SubmissionListRow>(
      `SELECT s.id, s.reference, s.title, s.status, s.submitted_at, s.updated_at, s.word_count,
              c.name AS competition_name, c.slug AS competition_slug, c.closes_at
         FROM submissions s
         JOIN competitions c ON c.id = s.competition_id
        WHERE s.writer_id = $1
        ORDER BY s.updated_at DESC
        LIMIT $2`,
      [writerId, limit],
    );
  } catch (e) {
    console.error(`[submissions:mine] ${(e as Error).message}`);
    return [];
  }
}

export interface SubmissionDetail {
  id: string;
  reference: string | null;
  writer_id: string;
  writer_name: string;
  writer_email: string;
  competition_id: string;
  competition_name: string;
  competition_slug: string;
  closes_at: string | null;
  word_min: number;
  word_max: number;
  requires_guardian_consent: boolean;
  rules_version: string;
  blind_judging: boolean;
  title: string;
  synopsis: string;
  language: string;
  genre: string | null;
  themes: string[];
  cultural_context: string;
  word_count: number | null;
  status: SubmissionStatus;
  file_id: string | null;
  file_name: string | null;
  file_size: number | null;
  declarations: Record<string, unknown>;
  consent_id: string | null;
  consent_status: string | null;
  consent_guardian_email: string | null;
  anon_label: string | null;
  eligibility_note: string;
  submitted_at: string | null;
  reopened_until: string | null;
  created_at: string;
  updated_at: string;
  age_band: string | null;
}

export async function submissionDetail(id: string): Promise<SubmissionDetail | null> {
  if (!isDbConfigured()) return null;
  try {
    return await queryOne<SubmissionDetail>(
      `SELECT s.id, s.reference, s.writer_id, u.name AS writer_name, u.email AS writer_email,
              s.competition_id, c.name AS competition_name, c.slug AS competition_slug,
              c.closes_at, c.word_min, c.word_max, c.requires_guardian_consent, c.rules_version,
              c.blind_judging,
              s.title, s.synopsis, s.language, s.genre, s.themes, s.cultural_context, s.word_count,
              s.status, s.file_id, f.original_name AS file_name, f.size_bytes AS file_size,
              s.declarations, s.consent_id, gc.status AS consent_status,
              gc.guardian_email AS consent_guardian_email,
              s.anon_label, s.eligibility_note, s.submitted_at, s.reopened_until,
              s.created_at, s.updated_at, p.age_band
         FROM submissions s
         JOIN competitions c ON c.id = s.competition_id
         JOIN users u ON u.id = s.writer_id
         LEFT JOIN profiles p ON p.user_id = s.writer_id
         LEFT JOIN files f ON f.id = s.file_id
         LEFT JOIN guardian_consents gc ON gc.id = s.consent_id
        WHERE s.id = $1`,
      [id],
    );
  } catch (e) {
    console.error(`[submissions:detail] ${(e as Error).message}`);
    return null;
  }
}

export async function submissionEvents(submissionId: string) {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      from_status: string | null;
      to_status: string;
      note: string;
      created_at: string;
      actor_name: string | null;
    }>(
      `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, u.name AS actor_name
         FROM submission_events e
         LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.submission_id = $1
        ORDER BY e.created_at DESC`,
      [submissionId],
    );
  } catch {
    return [];
  }
}

export async function submissionVersions(submissionId: string) {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      version_number: number;
      change_note: string;
      word_count: number | null;
      created_at: string;
      file_id: string | null;
      file_name: string | null;
      file_size: number | null;
      created_by_name: string | null;
    }>(
      `SELECT v.id, v.version_number, v.change_note, v.word_count, v.created_at, v.file_id,
              f.original_name AS file_name, f.size_bytes AS file_size, u.name AS created_by_name
         FROM story_versions v
         LEFT JOIN files f ON f.id = v.file_id
         LEFT JOIN users u ON u.id = v.created_by
        WHERE v.submission_id = $1
        ORDER BY v.version_number DESC`,
      [submissionId],
    );
  } catch {
    return [];
  }
}

export interface FeedbackMessage {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
}

export interface FeedbackThread {
  id: string;
  subject: string;
  visibility: string;
  created_at: string;
  resolved_at: string | null;
  messages: FeedbackMessage[];
}

/**
 * Threads plus their messages. `includeInternal` must be false for the writer —
 * internal threads are where staff discuss an entry between themselves.
 */
export async function feedbackForSubmission(
  submissionId: string,
  includeInternal: boolean,
): Promise<FeedbackThread[]> {
  if (!isDbConfigured()) return [];
  try {
    const threads = await query<Omit<FeedbackThread, 'messages'>>(
      `SELECT id, subject, visibility, created_at, resolved_at
         FROM feedback_threads
        WHERE submission_id = $1 AND ($2::boolean OR visibility = 'writer')
        ORDER BY created_at DESC`,
      [submissionId, includeInternal],
    );
    if (threads.length === 0) return [];

    const messages = await query<FeedbackMessage & { thread_id: string }>(
      `SELECT fm.id, fm.thread_id, fm.body, fm.created_at, u.name AS author_name
         FROM feedback_messages fm
         LEFT JOIN users u ON u.id = fm.author_id
        WHERE fm.thread_id = ANY($1::uuid[])
        ORDER BY fm.created_at`,
      [threads.map((t) => t.id)],
    );

    return threads.map((t) => ({
      ...t,
      messages: messages.filter((m) => m.thread_id === t.id),
    }));
  } catch (e) {
    console.error(`[submissions:feedback] ${(e as Error).message}`);
    return [];
  }
}

/** Competitions a writer may still start or finish an entry for. */
export async function enterableCompetitions() {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      name: string;
      slug: string;
      tagline: string;
      closes_at: string | null;
      word_min: number;
      word_max: number;
      max_entries: number;
      min_age: number | null;
      max_age: number | null;
      themes: string[];
      languages: string[];
      requires_guardian_consent: boolean;
      rules_version: string;
    }>(
      `SELECT id, name, slug, tagline, closes_at, word_min, word_max, max_entries,
              min_age, max_age, themes, languages, requires_guardian_consent, rules_version
         FROM competitions
        WHERE status = 'open' AND (closes_at IS NULL OR closes_at > now())
        ORDER BY closes_at ASC NULLS LAST`,
    );
  } catch {
    return [];
  }
}

/** How many entries this writer already has in a competition. */
export async function entryCount(writerId: string, competitionId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM submissions
      WHERE writer_id = $1 AND competition_id = $2 AND status <> 'WITHDRAWN'`,
    [writerId, competitionId],
  );
  return Number(row?.n ?? 0);
}
