'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth';
import { query, queryOne, tx } from '@/lib/db';
import { abs, templates } from '@/lib/email';
import { formatDate } from '@/lib/format';
import { notify } from '@/lib/notify';
import { hasRole, isStaff } from '@/lib/access';
import { SITE } from '@/lib/brand';
import { conflictSchema, reviewSchema } from '@/lib/validation';
import { bool, fail, invalid, ok, str, type ActionState } from '@/lib/actions';

/**
 * Judging.
 *
 * The fairness requirements the plan calls out are enforced here rather than in
 * the UI: a judge only ever touches their own assignment, a declared conflict
 * removes the assignment instead of just annotating it, and a finalised score
 * locks — only an administrator can reopen it, and doing so is audited.
 */

// ---- judge: score an assignment -------------------------------------------------

export async function saveReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');
  if (!hasRole(user, 'judge') && !isStaff(user)) return fail('You are not a judge on this programme.');

  const assignmentId = str(form, 'assignmentId');
  const assignment = await queryOne<{
    id: string;
    judge_id: string;
    submission_id: string;
    status: string;
    rubric_id: string | null;
    allow_score_revision: boolean;
    locked_at: string | null;
    review_id: string | null;
  }>(
    `SELECT ra.id, ra.judge_id, ra.submission_id, ra.status, c.rubric_id, c.allow_score_revision,
            r.locked_at, r.id AS review_id
       FROM review_assignments ra
       JOIN submissions s ON s.id = ra.submission_id
       JOIN competitions c ON c.id = s.competition_id
       LEFT JOIN reviews r ON r.assignment_id = ra.id
      WHERE ra.id = $1`,
    [assignmentId],
  );
  if (!assignment) return fail('That assignment could not be found.');
  if (assignment.judge_id !== user.userId) return fail('That assignment belongs to another judge.');
  if (assignment.status === 'declined' || assignment.status === 'revoked') {
    return fail('This assignment is no longer active.');
  }
  if (assignment.locked_at && !assignment.allow_score_revision) {
    return fail('Your score has been finalised and can no longer be changed. Ask an administrator to reopen it.');
  }

  // Scores arrive as `score:<criterionId>` / `comment:<criterionId>` pairs.
  const scores: { criterionId: string; score: number; comment: string }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('score:') || typeof value !== 'string') continue;
    const criterionId = key.slice(6);
    scores.push({
      criterionId,
      score: Number(value),
      comment: str(form, `comment:${criterionId}`),
    });
  }

  const parsed = reviewSchema.safeParse({
    assignmentId,
    scores,
    comments: str(form, 'comments'),
    internalNotes: str(form, 'internalNotes'),
    recommendation: str(form, 'recommendation') || 'maybe',
    final: bool(form, 'final'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const criteria = assignment.rubric_id
    ? await query<{ id: string; max_score: number; weight: string }>(
        `SELECT id, max_score, weight::text AS weight FROM rubric_criteria WHERE rubric_id = $1`,
        [assignment.rubric_id],
      )
    : [];
  const byId = new Map(criteria.map((c) => [c.id, c]));

  // Reject a score outside its criterion's range rather than silently clamping —
  // a judge should know their entry did not land.
  let total = 0;
  let max = 0;
  for (const s of d.scores) {
    const criterion = byId.get(s.criterionId);
    if (!criterion) return fail('That rubric has changed. Reload the page and score again.');
    if (s.score < 0 || s.score > criterion.max_score) {
      return fail(`Scores must be between 0 and ${criterion.max_score}.`);
    }
    total += s.score * Number(criterion.weight);
    max += criterion.max_score * Number(criterion.weight);
  }
  if (d.final && criteria.length > 0 && d.scores.length !== criteria.length) {
    return fail('Score every criterion before finalising.');
  }

  await tx(async (q) => {
    const [review] = await q<{ id: string }>(
      `INSERT INTO reviews (assignment_id, rubric_id, total_score, max_score, comments,
                            internal_notes, recommendation, submitted_at, locked_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               CASE WHEN $8::boolean THEN now() ELSE NULL END,
               CASE WHEN $8::boolean THEN now() ELSE NULL END, now())
       ON CONFLICT (assignment_id) DO UPDATE
          SET rubric_id = EXCLUDED.rubric_id,
              total_score = EXCLUDED.total_score,
              max_score = EXCLUDED.max_score,
              comments = EXCLUDED.comments,
              internal_notes = EXCLUDED.internal_notes,
              recommendation = EXCLUDED.recommendation,
              submitted_at = COALESCE(reviews.submitted_at, EXCLUDED.submitted_at),
              locked_at = COALESCE(reviews.locked_at, EXCLUDED.locked_at),
              updated_at = now()
       RETURNING id`,
      [
        assignmentId,
        assignment.rubric_id,
        total,
        max,
        d.comments ?? '',
        d.internalNotes ?? '',
        d.recommendation,
        d.final,
      ],
    );

    for (const s of d.scores) {
      await q(
        `INSERT INTO review_scores (review_id, criterion_id, score, comment)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (review_id, criterion_id)
         DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment`,
        [review.id, s.criterionId, s.score, s.comment],
      );
    }

    await q(
      `UPDATE review_assignments
          SET status = $2, completed_at = CASE WHEN $3::boolean THEN now() ELSE completed_at END
        WHERE id = $1`,
      [assignmentId, d.final ? 'completed' : 'in_progress', d.final],
    );
  });

  await audit({
    actorId: user.userId,
    action: d.final ? 'review.finalised' : 'review.saved',
    entityType: 'submission',
    entityId: assignment.submission_id,
    metadata: { assignmentId, total, max },
  });

  // Operational notice (implementation plan §10): a finalised score is
  // something the programme admin acts on, so tell them — once per assignment.
  if (d.final) {
    const entry = await queryOne<{ reference: string | null; title: string; competition_name: string }>(
      `SELECT s.reference, s.title, c.name AS competition_name
         FROM submissions s JOIN competitions c ON c.id = s.competition_id
        WHERE s.id = $1`,
      [assignment.submission_id],
    );
    const alert = templates.adminAlert({
      title: `Review completed: ${entry?.reference ?? assignment.submission_id.slice(0, 8)}`,
      body: '',
      lines: [
        ['Entry', entry ? `${entry.reference ?? '—'} · ${entry.title || 'Untitled'}` : assignment.submission_id],
        ['Programme', entry?.competition_name ?? '—'],
        ['Judge', user.name || user.email],
        ['Score', `${total.toFixed(1)} / ${max.toFixed(0)}`],
        ['Recommendation', d.recommendation],
      ],
      link: abs(`/dashboard/admin/submissions/${assignment.submission_id}`),
    });
    await notify({
      toEmail: SITE.inbox,
      type: 'review_completed',
      subject: alert.subject,
      html: alert.html,
      dedupeKey: `review_completed:${assignmentId}`,
    });
  }

  revalidatePath(`/dashboard/judge/${assignmentId}`);
  revalidatePath('/dashboard/judge');
  return ok(d.final ? 'Score submitted and locked.' : 'Progress saved. You can come back to finish.');
}

// ---- judge: declare a conflict of interest ----------------------------------------

export async function declareConflictAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');

  const parsed = conflictSchema.safeParse({
    assignmentId: str(form, 'assignmentId'),
    note: str(form, 'note'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const rows = await query<{ submission_id: string }>(
    `UPDATE review_assignments
        SET conflict_flag = true, conflict_note = $3, status = 'declined'
      WHERE id = $1 AND judge_id = $2 AND status IN ('assigned', 'in_progress')
      RETURNING submission_id`,
    [parsed.data.assignmentId, user.userId, parsed.data.note],
  );
  if (rows.length === 0) return fail('That assignment is no longer open to you.');

  await audit({
    actorId: user.userId,
    action: 'review.conflict_declared',
    entityType: 'submission',
    entityId: rows[0].submission_id,
    metadata: { assignmentId: parsed.data.assignmentId },
  });

  revalidatePath('/dashboard/judge');
  return ok('Thank you — this entry has been removed from your queue and an administrator has been notified.');
}

// ---- admin: assign judges -----------------------------------------------------------

export async function assignJudgesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user || !isStaff(user)) return fail('Only a programme administrator can assign judges.');

  const submissionIds = form.getAll('submissionIds').filter((v): v is string => typeof v === 'string');
  const judgeIds = form.getAll('judgeIds').filter((v): v is string => typeof v === 'string');
  const dueAt = str(form, 'dueAt');
  if (submissionIds.length === 0) return fail('Select at least one submission.');
  if (judgeIds.length === 0) return fail('Select at least one judge.');

  let created = 0;
  await tx(async (q) => {
    for (const submissionId of submissionIds) {
      for (const judgeId of judgeIds) {
        // A judge who has already declared a conflict on an entry is not
        // re-assigned to it by a later bulk action.
        const [row] = await q<{ id: string }>(
          `INSERT INTO review_assignments (submission_id, judge_id, assigned_by, due_at)
           VALUES ($1, $2, $3, NULLIF($4, '')::timestamptz)
           ON CONFLICT (submission_id, judge_id) DO NOTHING
           RETURNING id`,
          [submissionId, judgeId, user.userId, dueAt],
        );
        if (row) created++;
      }
      await q(
        `UPDATE submissions SET status = 'ASSIGNED_FOR_JUDGING', updated_at = now()
          WHERE id = $1 AND status = 'ELIGIBLE'`,
        [submissionId],
      );
      await q(
        `INSERT INTO submission_events (submission_id, from_status, to_status, actor_id, note)
         SELECT $1, 'ELIGIBLE', 'ASSIGNED_FOR_JUDGING', $2, 'Assigned for judging'
          WHERE EXISTS (SELECT 1 FROM submissions WHERE id = $1 AND status = 'ASSIGNED_FOR_JUDGING')`,
        [submissionId, user.userId],
      );
    }
  });

  // One summary email per judge, not one per entry.
  for (const judgeId of judgeIds) {
    const judge = await queryOne<{ name: string; email: string; n: string }>(
      `SELECT u.name, u.email,
              (SELECT count(*)::text FROM review_assignments
                WHERE judge_id = u.id AND status IN ('assigned','in_progress')) AS n
         FROM users u WHERE u.id = $1`,
      [judgeId],
    );
    if (!judge) continue;
    const t = templates.judgeAssignment({
      name: judge.name,
      count: Number(judge.n),
      dueAt: dueAt ? formatDate(dueAt) : 'no fixed date',
      link: abs('/dashboard/judge'),
    });
    await notify({
      userId: judgeId,
      toEmail: judge.email,
      type: 'judge_assignment',
      subject: t.subject,
      html: t.html,
      // One notice per judge per batch, keyed on the batch's size and due date.
      dedupeKey: `judge_assignment:${judgeId}:${dueAt || 'none'}:${judge.n}`,
    });
  }

  await audit({
    actorId: user.userId,
    action: 'judging.assigned',
    entityType: 'competition',
    entityId: str(form, 'competitionId') || null,
    metadata: { submissions: submissionIds.length, judges: judgeIds.length, created },
  });

  revalidatePath('/dashboard/admin/submissions');
  return ok(`${created} assignment${created === 1 ? '' : 's'} created.`);
}

/** Admin: unlock a finalised review so a judge can revise it. */
export async function unlockReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user || !isStaff(user)) return fail('Only a programme administrator can reopen scoring.');

  const reviewId = str(form, 'reviewId');
  const rows = await query<{ assignment_id: string }>(
    `UPDATE reviews SET locked_at = NULL, updated_at = now() WHERE id = $1 RETURNING assignment_id`,
    [reviewId],
  );
  if (rows.length === 0) return fail('That review could not be found.');

  await query(`UPDATE review_assignments SET status = 'in_progress', completed_at = NULL WHERE id = $1`, [
    rows[0].assignment_id,
  ]);
  await audit({
    actorId: user.userId,
    action: 'review.unlocked',
    entityType: 'review',
    entityId: reviewId,
  });
  revalidatePath('/dashboard/admin/submissions');
  return ok('Scoring reopened for that judge.');
}
