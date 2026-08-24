'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth';
import { queryOne, tx } from '@/lib/db';
import { abs, templates } from '@/lib/email';
import { notify } from '@/lib/notify';
import { hasRole, isStaff } from '@/lib/access';
import {
  NOTIFIABLE_STATUSES,
  STATUS_LABELS,
  canTransition,
  type SubmissionStatus,
} from '@/lib/workflow';
import { fail, ok, str, type ActionState } from '@/lib/actions';
import { enqueueStoryForEmoworld } from '@/features/emoworld/sync';

/**
 * The single entry point for moving a submission between states.
 *
 * Admin screens, the editorial queue and the mentor workspace all call this
 * rather than issuing their own UPDATE. That way the transition table in
 * `lib/workflow.ts` is genuinely authoritative, every move writes an event and
 * an audit record, and the writer is told about the changes that matter to them
 * — exactly once, because the notification is deduplicated on the transition.
 */
export async function advanceSubmissionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');

  const submissionId = str(form, 'submissionId');
  const to = str(form, 'to') as SubmissionStatus;
  const note = str(form, 'note').slice(0, 1000);

  const submission = await queryOne<{
    id: string;
    status: SubmissionStatus;
    writer_id: string;
    writer_name: string;
    writer_email: string;
    title: string;
    reference: string | null;
    guardian_email: string | null;
    story_id: string | null;
  }>(
    `SELECT s.id, s.status, s.writer_id, u.name AS writer_name, u.email AS writer_email,
            s.title, s.reference, gc.guardian_email, st.id AS story_id
       FROM submissions s
       JOIN users u ON u.id = s.writer_id
       LEFT JOIN guardian_consents gc ON gc.id = s.consent_id AND gc.status = 'granted'
       LEFT JOIN stories st ON st.submission_id = s.id
      WHERE s.id = $1`,
    [submissionId],
  );
  if (!submission) return fail('That submission could not be found.');

  const isMentorHere = hasRole(user, 'mentor')
    ? Boolean(
        await queryOne(
          `SELECT 1 FROM mentorships WHERE submission_id = $1 AND mentor_id = $2 AND status = 'active'`,
          [submissionId, user.userId],
        ),
      )
    : false;

  const ctx = {
    roles: isMentorHere ? user.roles : user.roles.filter((r) => r !== 'mentor'),
    isOwner: submission.writer_id === user.userId,
  };
  if (!canTransition(submission.status, to, ctx)) {
    return fail(
      `You cannot move this entry from ${STATUS_LABELS[submission.status]} to ${STATUS_LABELS[to] ?? to}.`,
    );
  }

  await tx(async (q) => {
    await q(`UPDATE submissions SET status = $2, updated_at = now() WHERE id = $1`, [submissionId, to]);
    await q(
      `INSERT INTO submission_events (submission_id, from_status, to_status, actor_id, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [submissionId, submission.status, to, user.userId, note],
    );
    if (to === 'INELIGIBLE' && note) {
      await q(`UPDATE submissions SET eligibility_note = $2 WHERE id = $1`, [submissionId, note]);
    }
  });

  await audit({
    actorId: user.userId,
    action: 'submission.status_changed',
    entityType: 'submission',
    entityId: submissionId,
    metadata: { from: submission.status, to, note },
  });

  // ---- tell the writer, where it matters to them -------------------------------
  if (NOTIFIABLE_STATUSES.includes(to)) {
    const link = abs(`/dashboard/submissions/${submissionId}`);
    const dedupe = `status:${submissionId}:${to}`;

    if (to === 'SHORTLISTED' || to === 'NOT_SELECTED') {
      const t = templates.shortlistDecision({
        name: submission.writer_name,
        title: submission.title,
        selected: to === 'SHORTLISTED',
        note,
        link,
      });
      await notify({
        userId: submission.writer_id,
        toEmail: submission.writer_email,
        type: 'shortlist_decision',
        subject: t.subject,
        html: t.html,
        dedupeKey: dedupe,
      });
      if (submission.guardian_email) {
        await notify({
          toEmail: submission.guardian_email,
          type: 'shortlist_decision_guardian',
          subject: t.subject,
          html: t.html,
          dedupeKey: `${dedupe}:guardian`,
        });
      }
    } else if (to === 'APPROVED_FOR_PUBLICATION') {
      const t = templates.publicationApproved({
        name: submission.writer_name,
        title: submission.title,
        link,
      });
      await notify({
        userId: submission.writer_id,
        toEmail: submission.writer_email,
        type: 'publication_approved',
        subject: t.subject,
        html: t.html,
        dedupeKey: dedupe,
      });
      if (submission.guardian_email) {
        await notify({
          toEmail: submission.guardian_email,
          type: 'publication_approved_guardian',
          subject: t.subject,
          html: t.html,
          dedupeKey: `${dedupe}:guardian`,
        });
      }
      // Approval is what makes a story a candidate for the Emoworld review
      // pipeline. Enqueued, never called inline — the publication decision must
      // not depend on a remote service being up.
      if (submission.story_id) await enqueueStoryForEmoworld(submission.story_id);
    } else {
      const t = templates.statusChange({
        name: submission.writer_name,
        title: submission.title,
        reference: submission.reference ?? '—',
        status: STATUS_LABELS[to],
        note,
        link,
      });
      await notify({
        userId: submission.writer_id,
        toEmail: submission.writer_email,
        type: 'status_change',
        subject: t.subject,
        html: t.html,
        dedupeKey: dedupe,
      });
    }
  }

  revalidatePath(`/dashboard/submissions/${submissionId}`);
  revalidatePath('/dashboard/admin/submissions');
  revalidatePath('/dashboard/editorial');
  return ok(`Moved to ${STATUS_LABELS[to] ?? to}.`);
}

/** Admin: reopen a closed submission for editing by its writer. */
export async function reopenSubmissionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user || !isStaff(user)) return fail('Only a programme administrator can reopen an entry.');

  const submissionId = str(form, 'submissionId');
  const days = Math.min(30, Math.max(1, Number(str(form, 'days') || 3)));

  const row = await queryOne<{ id: string }>(
    `UPDATE submissions
        SET reopened_until = now() + ($2::text || ' days')::interval, updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [submissionId, String(days)],
  );
  if (!row) return fail('That submission could not be found.');

  await audit({
    actorId: user.userId,
    action: 'submission.reopened',
    entityType: 'submission',
    entityId: submissionId,
    metadata: { days },
  });
  revalidatePath(`/dashboard/admin/submissions/${submissionId}`);
  return ok(`Reopened for editing for ${days} day${days === 1 ? '' : 's'}.`);
}
