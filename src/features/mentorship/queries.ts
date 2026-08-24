import { isDbConfigured, query, queryOne } from '@/lib/db';

/** Read models for the mentor workspace, the writer's mentorship view and editorial. */

export interface MentorshipRow {
  id: string;
  status: string;
  goal: string;
  started_at: string;
  ended_at: string | null;
  writer_id: string;
  writer_name: string;
  mentor_id: string;
  mentor_name: string;
  submission_id: string | null;
  story_id: string | null;
  title: string | null;
  submission_status: string | null;
  competition_name: string | null;
  latest_version: number | null;
  open_milestones: number;
  total_milestones: number;
}

const MENTORSHIP_SELECT = `
  SELECT m.id, m.status, m.goal, m.started_at, m.ended_at,
         m.writer_id, w.name AS writer_name,
         m.mentor_id, mt.name AS mentor_name,
         m.submission_id, m.story_id,
         s.title, s.status AS submission_status, c.name AS competition_name,
         (SELECT max(version_number) FROM story_versions v WHERE v.submission_id = m.submission_id) AS latest_version,
         (SELECT count(*)::int FROM mentorship_milestones ms
           WHERE ms.mentorship_id = m.id AND ms.status IN ('pending','in_progress')) AS open_milestones,
         (SELECT count(*)::int FROM mentorship_milestones ms WHERE ms.mentorship_id = m.id) AS total_milestones
    FROM mentorships m
    JOIN users w ON w.id = m.writer_id
    JOIN users mt ON mt.id = m.mentor_id
    LEFT JOIN submissions s ON s.id = m.submission_id
    LEFT JOIN competitions c ON c.id = s.competition_id`;

export async function mentorshipsForMentor(mentorId: string): Promise<MentorshipRow[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<MentorshipRow>(
      `${MENTORSHIP_SELECT}
        WHERE m.mentor_id = $1
        ORDER BY CASE m.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, m.started_at DESC`,
      [mentorId],
    );
  } catch (e) {
    console.error(`[mentorship:mentor] ${(e as Error).message}`);
    return [];
  }
}

export async function mentorshipsForWriter(writerId: string): Promise<MentorshipRow[]> {
  if (!isDbConfigured()) return [];
  try {
    return await query<MentorshipRow>(
      `${MENTORSHIP_SELECT} WHERE m.writer_id = $1 ORDER BY m.started_at DESC`,
      [writerId],
    );
  } catch {
    return [];
  }
}

export async function mentorship(id: string): Promise<MentorshipRow | null> {
  if (!isDbConfigured()) return null;
  try {
    return await queryOne<MentorshipRow>(`${MENTORSHIP_SELECT} WHERE m.id = $1`, [id]);
  } catch {
    return null;
  }
}

export async function milestones(mentorshipId: string) {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      title: string;
      description: string;
      due_at: string | null;
      status: string;
      completed_at: string | null;
      sort_order: number;
    }>(
      `SELECT id, title, description, due_at, status, completed_at, sort_order
         FROM mentorship_milestones WHERE mentorship_id = $1 ORDER BY sort_order, due_at NULLS LAST`,
      [mentorshipId],
    );
  } catch {
    return [];
  }
}

/** Writers who have reached the development stages but have no mentor yet. */
export async function unmentoredSubmissions() {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      reference: string | null;
      title: string;
      status: string;
      writer_id: string;
      writer_name: string;
      competition_name: string;
    }>(
      `SELECT s.id, s.reference, s.title, s.status, s.writer_id, u.name AS writer_name,
              c.name AS competition_name
         FROM submissions s
         JOIN users u ON u.id = s.writer_id
         JOIN competitions c ON c.id = s.competition_id
        WHERE s.status IN ('SHORTLISTED', 'MENTORSHIP')
          AND NOT EXISTS (
            SELECT 1 FROM mentorships m
             WHERE m.submission_id = s.id AND m.status IN ('active', 'paused')
          )
        ORDER BY s.updated_at DESC`,
    );
  } catch {
    return [];
  }
}

export async function availableMentors() {
  if (!isDbConfigured()) return [];
  try {
    return await query<{ id: string; name: string; email: string; active_mentees: number }>(
      `SELECT u.id, u.name, u.email,
              count(m.id) FILTER (WHERE m.status = 'active')::int AS active_mentees
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'mentor'
         LEFT JOIN mentorships m ON m.mentor_id = u.id
        WHERE u.status = 'active'
        GROUP BY u.id
        ORDER BY active_mentees, u.name`,
    );
  } catch {
    return [];
  }
}

/** Everything sitting in the editorial stage, for editors and staff. */
export async function editorialQueue() {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      reference: string | null;
      title: string;
      status: string;
      writer_name: string;
      competition_name: string;
      updated_at: string;
      latest_version: number | null;
      story_id: string | null;
      story_slug: string | null;
    }>(
      `SELECT s.id, s.reference, s.title, s.status, u.name AS writer_name,
              c.name AS competition_name, s.updated_at,
              (SELECT max(version_number) FROM story_versions v WHERE v.submission_id = s.id) AS latest_version,
              st.id AS story_id, st.slug AS story_slug
         FROM submissions s
         JOIN users u ON u.id = s.writer_id
         JOIN competitions c ON c.id = s.competition_id
         LEFT JOIN stories st ON st.submission_id = s.id
        WHERE s.status IN ('MENTORSHIP', 'EDITORIAL', 'APPROVED_FOR_PUBLICATION')
        ORDER BY CASE s.status
                   WHEN 'EDITORIAL' THEN 0
                   WHEN 'APPROVED_FOR_PUBLICATION' THEN 1
                   ELSE 2 END,
                 s.updated_at DESC`,
    );
  } catch (e) {
    console.error(`[editorial:queue] ${(e as Error).message}`);
    return [];
  }
}
