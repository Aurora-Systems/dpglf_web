import { isDbConfigured, queryOne, query } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';
import { hasRole, isStaff } from '@/lib/permissions';

/** Counters for the dashboard overview, scoped to what each role may see. */

export interface Counts {
  drafts: number;
  activeSubmissions: number;
  unreadFeedback: number;
  judgeOutstanding: number;
  mentorActive: number;
  editorialQueue: number;
  eligibilityQueue: number;
  newInquiries: number;
  newMessages: number;
  unverifiedEmail: boolean;
}

const EMPTY: Counts = {
  drafts: 0,
  activeSubmissions: 0,
  unreadFeedback: 0,
  judgeOutstanding: 0,
  mentorActive: 0,
  editorialQueue: 0,
  eligibilityQueue: 0,
  newInquiries: 0,
  newMessages: 0,
  unverifiedEmail: false,
};

export async function dashboardCounts(user: SessionUser): Promise<Counts> {
  if (!isDbConfigured()) return EMPTY;
  try {
    const staff = isStaff(user);
    const row = await queryOne<Record<string, string | boolean | null>>(
      `SELECT
         (SELECT count(*) FROM submissions WHERE writer_id = $1 AND status = 'DRAFT') AS drafts,
         (SELECT count(*) FROM submissions
           WHERE writer_id = $1
             AND status NOT IN ('DRAFT','WITHDRAWN','NOT_SELECTED','INELIGIBLE')) AS active_submissions,
         (SELECT count(*) FROM feedback_messages fm
            JOIN feedback_threads ft ON ft.id = fm.thread_id
            JOIN submissions s ON s.id = ft.submission_id
           WHERE s.writer_id = $1 AND ft.visibility = 'writer' AND fm.author_id <> $1
             AND fm.created_at > now() - interval '30 days') AS unread_feedback,
         (SELECT count(*) FROM review_assignments
           WHERE judge_id = $1 AND status IN ('assigned','in_progress')) AS judge_outstanding,
         (SELECT count(*) FROM mentorships WHERE mentor_id = $1 AND status = 'active') AS mentor_active,
         (SELECT count(*) FROM submissions WHERE status = 'EDITORIAL') AS editorial_queue,
         (SELECT count(*) FROM submissions WHERE status IN ('SUBMITTED','ELIGIBILITY_REVIEW')) AS eligibility_queue,
         (SELECT count(*) FROM adaptation_inquiries WHERE status = 'new') AS new_inquiries,
         (SELECT count(*) FROM contact_messages WHERE status = 'new') AS new_messages,
         (SELECT email_verified_at IS NULL FROM users WHERE id = $1) AS unverified_email`,
      [user.userId],
    );
    return {
      drafts: Number(row?.drafts ?? 0),
      activeSubmissions: Number(row?.active_submissions ?? 0),
      unreadFeedback: Number(row?.unread_feedback ?? 0),
      judgeOutstanding: hasRole(user, 'judge') ? Number(row?.judge_outstanding ?? 0) : 0,
      mentorActive: hasRole(user, 'mentor') ? Number(row?.mentor_active ?? 0) : 0,
      editorialQueue: staff || hasRole(user, 'editor') ? Number(row?.editorial_queue ?? 0) : 0,
      eligibilityQueue: staff ? Number(row?.eligibility_queue ?? 0) : 0,
      newInquiries: staff ? Number(row?.new_inquiries ?? 0) : 0,
      newMessages: staff ? Number(row?.new_messages ?? 0) : 0,
      unverifiedEmail: row?.unverified_email === true,
    };
  } catch (e) {
    console.error(`[dashboard:counts] ${(e as Error).message}`);
    return EMPTY;
  }
}

export interface AdminKpis {
  totalSubmissions: number;
  submissionsThisWeek: number;
  openCompetitions: number;
  judgingCoverage: { assigned: number; completed: number };
  publishedStories: number;
  publicArchive: number;
  adaptationReady: number;
  pendingConsents: number;
  unsentEmails: number;
  writers: number;
}

export async function adminKpis(): Promise<AdminKpis | null> {
  if (!isDbConfigured()) return null;
  try {
    const row = await queryOne<Record<string, string>>(
      `SELECT
        (SELECT count(*) FROM submissions WHERE status <> 'DRAFT') AS total_submissions,
        (SELECT count(*) FROM submissions WHERE submitted_at > now() - interval '7 days') AS week_submissions,
        (SELECT count(*) FROM competitions WHERE status = 'open') AS open_competitions,
        (SELECT count(*) FROM review_assignments) AS assigned,
        (SELECT count(*) FROM review_assignments WHERE status = 'completed') AS completed,
        (SELECT count(*) FROM stories WHERE status IN ('published','archived')) AS published_stories,
        (SELECT count(*) FROM archive_metadata WHERE visibility IN ('public_excerpt','public_full')) AS public_archive,
        (SELECT count(*) FROM archive_metadata WHERE adaptation_ready) AS adaptation_ready,
        (SELECT count(*) FROM guardian_consents WHERE status = 'pending') AS pending_consents,
        (SELECT count(*) FROM notifications WHERE sent_at IS NULL) AS unsent_emails,
        (SELECT count(*) FROM user_roles WHERE role = 'writer') AS writers`,
    );
    return {
      totalSubmissions: Number(row?.total_submissions ?? 0),
      submissionsThisWeek: Number(row?.week_submissions ?? 0),
      openCompetitions: Number(row?.open_competitions ?? 0),
      judgingCoverage: { assigned: Number(row?.assigned ?? 0), completed: Number(row?.completed ?? 0) },
      publishedStories: Number(row?.published_stories ?? 0),
      publicArchive: Number(row?.public_archive ?? 0),
      adaptationReady: Number(row?.adaptation_ready ?? 0),
      pendingConsents: Number(row?.pending_consents ?? 0),
      unsentEmails: Number(row?.unsent_emails ?? 0),
      writers: Number(row?.writers ?? 0),
    };
  } catch (e) {
    console.error(`[dashboard:kpis] ${(e as Error).message}`);
    return null;
  }
}

export async function recentActivity(limit = 12) {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
      actor_name: string | null;
    }>(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.name AS actor_name
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.actor_id
        ORDER BY a.created_at DESC
        LIMIT $1`,
      [limit],
    );
  } catch {
    return [];
  }
}

export async function myNotifications(userId: string, limit = 40) {
  if (!isDbConfigured()) return [];
  try {
    return await query<{
      id: string;
      type: string;
      subject: string;
      created_at: string;
      sent_at: string | null;
      read_at: string | null;
    }>(
      `SELECT id, type, subject, created_at, sent_at, read_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
  } catch {
    return [];
  }
}
