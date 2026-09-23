import { redirect } from 'next/navigation';
import { getSessionUser } from './auth';
import type { SessionUser } from './session';
import { queryOne } from './db';
import { STAFF_ROLES, type Role } from './roles';
import { canEditSubmission, hasRole, isStaff } from './access';

/**
 * Server-side authorisation.
 *
 * Every protected page and route handler enters through one of these. The pure
 * predicates live in `access.ts` (shared with client components); everything
 * here needs the request context or the database, and therefore the server.
 *
 * The reason this is centralised is the risk the implementation plan names
 * first: many roles, plus unpublished work owned by minors. Scattering
 * `if (user.role === …)` across pages makes that impossible to review.
 */

export {
  hasRole,
  isStaff,
  isSuperAdmin,
  visibleLevels,
  canReadFullText,
  canBrowseAdaptationCatalogue,
  canEditSubmission,
  type Visibility,
} from './access';

/** Redirects to sign-in, preserving the intended destination. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return user;
}

export async function requireRole(roles: Role[], next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!hasRole(user, ...roles)) redirect('/dashboard?denied=1');
  return user;
}

export async function requireStaff(next?: string): Promise<SessionUser> {
  return requireRole(STAFF_ROLES, next);
}

/** API-shaped guard: throws a Response instead of redirecting. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  return user;
}

export async function requireApiRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!hasRole(user, ...roles)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  return user;
}

// ---- submission-level rules ---------------------------------------------------

export interface SubmissionAccess {
  view: boolean;
  /** May read the manuscript file itself, not just its metadata. */
  readManuscript: boolean;
  edit: boolean;
  /** Judge in a blind round: the writer's identity must stay hidden. */
  anonymised: boolean;
  /** Reaches the entry only as its judge (blind or not): scores, never corresponds. */
  judgeOnly: boolean;
}

const DENIED: SubmissionAccess = {
  view: false,
  readManuscript: false,
  edit: false,
  anonymised: false,
  judgeOnly: false,
};

/**
 * Resolve what `user` may do with one submission, in a single round trip — the
 * caller has an id, not a loaded graph, and every caller needs the same four
 * answers.
 */
export async function submissionAccess(
  user: SessionUser | null,
  submissionId: string,
): Promise<SubmissionAccess> {
  if (!user || !submissionId) return DENIED;

  const row = await queryOne<{
    writer_id: string;
    status: string;
    closes_at: string | null;
    reopened_until: string | null;
    blind_judging: boolean;
    is_assigned_judge: boolean;
    is_mentor: boolean;
  }>(
    `SELECT s.writer_id,
            s.status,
            c.closes_at,
            s.reopened_until,
            c.blind_judging,
            EXISTS (
              SELECT 1 FROM review_assignments ra
               WHERE ra.submission_id = s.id AND ra.judge_id = $2
                 AND ra.status IN ('assigned', 'in_progress', 'completed')
                 -- a withdrawn entry is out of the competition, scored or not
                 AND s.status <> 'WITHDRAWN'
            ) AS is_assigned_judge,
            EXISTS (
              SELECT 1 FROM mentorships m
               WHERE m.submission_id = s.id AND m.mentor_id = $2
                 AND m.status IN ('active', 'paused', 'completed')
            ) AS is_mentor
       FROM submissions s
       JOIN competitions c ON c.id = s.competition_id
      WHERE s.id = $1`,
    [submissionId, user.userId],
  ).catch(() => null);
  if (!row) return DENIED;

  const staff = isStaff(user) || hasRole(user, 'editor');
  const owner = row.writer_id === user.userId;
  const judge = row.is_assigned_judge;
  const mentor = row.is_mentor;

  if (!staff && !owner && !judge && !mentor) return DENIED;

  return {
    view: true,
    readManuscript: true,
    edit: owner && canEditSubmission(row.status, row.closes_at, row.reopened_until),
    // Blind mode applies to judges only — staff and mentors need the identity.
    // A judge later paired as the entry's mentor has been shown the writer on
    // purpose, so the mentor role lifts the blind.
    anonymised: judge && !staff && !owner && !mentor && row.blind_judging,
    judgeOnly: judge && !staff && !owner && !mentor,
  };
}
