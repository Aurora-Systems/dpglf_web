import { isDbConfigured, query, queryOne } from '@/lib/db';

/** Read models for the judge dashboard and the admin assignment console. */

export interface JudgeAssignment {
  id: string;
  submission_id: string;
  status: string;
  due_at: string | null;
  conflict_flag: boolean;
  assigned_at: string;
  completed_at: string | null;
  /** Blind rounds surface this instead of the title's author. */
  anon_label: string | null;
  title: string;
  synopsis: string;
  language: string;
  genre: string | null;
  themes: string[];
  word_count: number | null;
  file_id: string | null;
  competition_name: string;
  blind_judging: boolean;
  writer_name: string;
  review_id: string | null;
  total_score: string | null;
  locked_at: string | null;
  rubric_id: string | null;
}

export async function myAssignments(judgeId: string): Promise<JudgeAssignment[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<JudgeAssignment>(
      `SELECT ra.id, ra.submission_id, ra.status, ra.due_at, ra.conflict_flag,
              ra.assigned_at, ra.completed_at,
              s.anon_label, s.title, s.synopsis, s.language, s.genre, s.themes,
              s.word_count, s.file_id,
              c.name AS competition_name, c.blind_judging, c.rubric_id,
              u.name AS writer_name,
              r.id AS review_id, r.total_score::text AS total_score, r.locked_at
         FROM review_assignments ra
         JOIN submissions s ON s.id = ra.submission_id
         JOIN competitions c ON c.id = s.competition_id
         JOIN users u ON u.id = s.writer_id
         LEFT JOIN reviews r ON r.assignment_id = ra.id
        WHERE ra.judge_id = $1 AND ra.status <> 'revoked'
        ORDER BY CASE ra.status WHEN 'assigned' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                 ra.due_at ASC NULLS LAST, ra.assigned_at`,
      [judgeId],
    );
  } catch (e) {
    console.error(`[judging:mine] ${(e as Error).message}`);
    return [];
  }
}

export async function assignmentForJudge(
  assignmentId: string,
  judgeId: string,
): Promise<JudgeAssignment | null> {
  if (!isDbConfigured()) return null;
  try {
    return await queryOne<JudgeAssignment>(
      `SELECT ra.id, ra.submission_id, ra.status, ra.due_at, ra.conflict_flag,
              ra.assigned_at, ra.completed_at,
              s.anon_label, s.title, s.synopsis, s.language, s.genre, s.themes,
              s.word_count, s.file_id,
              c.name AS competition_name, c.blind_judging, c.rubric_id,
              u.name AS writer_name,
              r.id AS review_id, r.total_score::text AS total_score, r.locked_at
         FROM review_assignments ra
         JOIN submissions s ON s.id = ra.submission_id
         JOIN competitions c ON c.id = s.competition_id
         JOIN users u ON u.id = s.writer_id
         LEFT JOIN reviews r ON r.assignment_id = ra.id
        WHERE ra.id = $1 AND ra.judge_id = $2`,
      [assignmentId, judgeId],
    );
  } catch {
    return null;
  }
}

export interface Criterion {
  id: string;
  label: string;
  description: string;
  max_score: number;
  weight: string;
  sort_order: number;
}

export async function rubricCriteria(rubricId: string | null): Promise<Criterion[]> {
  if (!rubricId || !isDbConfigured()) return [];
  try {
    return await query<Criterion>(
      `SELECT id, label, description, max_score, weight::text AS weight, sort_order
         FROM rubric_criteria WHERE rubric_id = $1 ORDER BY sort_order, label`,
      [rubricId],
    );
  } catch {
    return [];
  }
}

export async function existingReview(assignmentId: string) {
  if (!isDbConfigured()) return null;
  try {
    const review = await queryOne<{
      id: string;
      comments: string;
      internal_notes: string;
      recommendation: string | null;
      submitted_at: string | null;
      locked_at: string | null;
    }>(
      `SELECT id, comments, internal_notes, recommendation, submitted_at, locked_at
         FROM reviews WHERE assignment_id = $1`,
      [assignmentId],
    );
    if (!review) return null;
    const scores = await query<{ criterion_id: string; score: string; comment: string }>(
      `SELECT criterion_id, score::text AS score, comment FROM review_scores WHERE review_id = $1`,
      [review.id],
    );
    return { ...review, scores };
  } catch {
    return null;
  }
}

/** Per-submission judging progress, for the admin results screen. */
export interface JudgingRow {
  submission_id: string;
  reference: string | null;
  title: string;
  status: string;
  writer_name: string;
  assigned: number;
  completed: number;
  conflicts: number;
  average_score: string | null;
  recommendations: string[];
}

export async function judgingProgress(competitionId: string): Promise<JudgingRow[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<JudgingRow>(
      `SELECT s.id AS submission_id, s.reference, s.title, s.status, u.name AS writer_name,
              count(ra.id)::int AS assigned,
              count(ra.id) FILTER (WHERE ra.status = 'completed')::int AS completed,
              count(ra.id) FILTER (WHERE ra.conflict_flag)::int AS conflicts,
              round(avg(r.total_score) FILTER (WHERE r.submitted_at IS NOT NULL), 2)::text AS average_score,
              array_remove(array_agg(r.recommendation), NULL) AS recommendations
         FROM submissions s
         JOIN users u ON u.id = s.writer_id
         LEFT JOIN review_assignments ra ON ra.submission_id = s.id AND ra.status <> 'revoked'
         LEFT JOIN reviews r ON r.assignment_id = ra.id
        WHERE s.competition_id = $1
          AND s.status IN ('ELIGIBLE','ASSIGNED_FOR_JUDGING','JUDGED','SHORTLISTED','NOT_SELECTED',
                           'MENTORSHIP','EDITORIAL','APPROVED_FOR_PUBLICATION','PUBLISHED')
        GROUP BY s.id, u.name
        ORDER BY avg(r.total_score) DESC NULLS LAST, s.reference`,
      [competitionId],
    );
  } catch (e) {
    console.error(`[judging:progress] ${(e as Error).message}`);
    return [];
  }
}

export async function availableJudges() {
  if (!isDbConfigured()) return [];
  try {
    return await query<{ id: string; name: string; email: string; open_assignments: number }>(
      `SELECT u.id, u.name, u.email,
              count(ra.id) FILTER (WHERE ra.status IN ('assigned','in_progress'))::int AS open_assignments
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'judge'
         LEFT JOIN review_assignments ra ON ra.judge_id = u.id
        WHERE u.status = 'active'
        GROUP BY u.id
        ORDER BY open_assignments, u.name`,
    );
  } catch {
    return [];
  }
}
