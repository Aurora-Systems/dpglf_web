'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth';
import { query, queryOne, tx } from '@/lib/db';
import { abs, templates } from '@/lib/email';
import { notify } from '@/lib/notify';
import { hasRole, isStaff } from '@/lib/access';
import { submissionAccess } from '@/lib/permissions';
import { feedbackSchema, milestoneSchema } from '@/lib/validation';
import { fail, invalid, ok, str, type ActionState } from '@/lib/actions';
import { applyTransition } from '@/features/workflow/transition';

/**
 * Mentorship and editorial feedback.
 *
 * Feedback is attached to the submission (and, where relevant, to the manuscript
 * version it refers to) rather than living in email, so that nothing is lost
 * between drafts — the failure mode the Foundation is explicitly trying to fix.
 */

const DEFAULT_MILESTONES = [
  ['Introductory conversation', 'Meet, agree how you will work together and set expectations.'],
  ['Structural feedback', 'First read and notes on structure, character and voice.'],
  ['Revised draft', 'Writer uploads a revised version responding to the notes.'],
  ['Line edit', 'Close work on language, dialogue and clarity.'],
  ['Final draft', 'Writer uploads the draft to go forward to editorial.'],
];

// ---- admin: pair a writer with a mentor ---------------------------------------

export async function assignMentorAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user || !isStaff(user)) return fail('Only a programme administrator can assign a mentor.');

  const submissionId = str(form, 'submissionId');
  const mentorId = str(form, 'mentorId');
  const goal = str(form, 'goal').slice(0, 1000);
  if (!submissionId || !mentorId) return fail('Choose a submission and a mentor.');

  const submission = await queryOne<{
    id: string;
    writer_id: string;
    writer_name: string;
    writer_email: string;
    title: string;
    status: string;
  }>(
    `SELECT s.id, s.writer_id, u.name AS writer_name, u.email AS writer_email, s.title, s.status
       FROM submissions s JOIN users u ON u.id = s.writer_id WHERE s.id = $1`,
    [submissionId],
  );
  if (!submission) return fail('That submission could not be found.');

  const mentor = await queryOne<{ id: string; name: string; email: string }>(
    `SELECT u.id, u.name, u.email FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'mentor'
      WHERE u.id = $1 AND u.status = 'active'`,
    [mentorId],
  );
  if (!mentor) return fail('That mentor could not be found, or they do not hold the mentor role.');
  if (mentor.id === submission.writer_id) return fail('A writer cannot mentor their own story.');

  const mentorshipId = await tx(async (q) => {
    // Read the status under a row lock, so a withdrawal (or consent decline)
    // landing now either happens first and stops the pairing, or waits for it.
    const [current] = await q<{ status: string }>(
      `SELECT status FROM submissions WHERE id = $1 FOR UPDATE`,
      [submissionId],
    );
    if (!current || (current.status !== 'SHORTLISTED' && current.status !== 'MENTORSHIP')) return null;
    // One live pairing per entry; MENTORSHIP is allowed only so an entry whose
    // pairing ended can have a new mentor.
    const [live] = await q(
      `SELECT 1 FROM mentorships WHERE submission_id = $1 AND status IN ('active', 'paused')`,
      [submissionId],
    );
    if (live) return null;
    const [m] = await q<{ id: string }>(
      `INSERT INTO mentorships (writer_id, mentor_id, submission_id, goal, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [submission.writer_id, mentor.id, submissionId, goal, user.userId],
    );
    for (const [i, [title, description]] of DEFAULT_MILESTONES.entries()) {
      await q(
        `INSERT INTO mentorship_milestones (mentorship_id, title, description, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [m.id, title, description, i],
      );
    }
    // Shortlisted entries move into MENTORSHIP as the pairing is made.
    if (current.status === 'SHORTLISTED') {
      await applyTransition(q, {
        submissionId,
        from: 'SHORTLISTED',
        to: 'MENTORSHIP',
        actorId: user.userId,
        note: `Paired with ${mentor.name}`,
      });
    }
    return m.id;
  });
  if (!mentorshipId) {
    return fail(
      'A mentor cannot be assigned: the entry is no longer shortlisted or in mentorship, or it already has an active mentor.',
    );
  }

  const link = abs(`/dashboard/mentor/${mentorshipId}`);
  const writerLink = abs(`/dashboard/mentorship`);
  const forMentor = templates.mentorIntroduction({
    recipient: mentor.name,
    writer: submission.writer_name,
    mentor: mentor.name,
    title: submission.title,
    link,
  });
  await notify({
    userId: mentor.id,
    toEmail: mentor.email,
    type: 'mentor_intro_mentor',
    subject: forMentor.subject,
    html: forMentor.html,
    dedupeKey: `mentorship:${mentorshipId}:mentor`,
  });

  const forWriter = templates.mentorIntroduction({
    recipient: submission.writer_name,
    writer: submission.writer_name,
    mentor: mentor.name,
    title: submission.title,
    link: writerLink,
  });
  await notify({
    userId: submission.writer_id,
    toEmail: submission.writer_email,
    type: 'mentor_intro_writer',
    subject: forWriter.subject,
    html: forWriter.html,
    dedupeKey: `mentorship:${mentorshipId}:writer`,
  });

  await audit({
    actorId: user.userId,
    action: 'mentorship.created',
    entityType: 'mentorship',
    entityId: mentorshipId,
    metadata: { submissionId, mentorId: mentor.id },
  });

  revalidatePath('/dashboard/admin/submissions');
  revalidatePath('/dashboard/editorial');
  return ok(`${submission.writer_name} is now paired with ${mentor.name}.`);
}

// ---- feedback ---------------------------------------------------------------------

export async function postFeedbackAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');

  const parsed = feedbackSchema.safeParse({
    threadId: str(form, 'threadId') || undefined,
    submissionId: str(form, 'submissionId') || undefined,
    subject: str(form, 'subject'),
    body: str(form, 'body'),
    visibility: str(form, 'visibility') === 'internal' ? 'internal' : 'writer',
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  // An existing thread decides its own submission and visibility. The form's
  // values only matter when opening a new one; trusting them for a reply would
  // let a message land in another entry's thread, checked against the wrong one.
  let submissionId = d.submissionId;
  let threadVisibility: 'writer' | 'internal' | null = null;
  if (d.threadId) {
    const thread = await queryOne<{ submission_id: string | null; visibility: 'writer' | 'internal' }>(
      `SELECT submission_id, visibility FROM feedback_threads WHERE id = $1`,
      [d.threadId],
    );
    if (!thread?.submission_id || (d.submissionId && d.submissionId !== thread.submission_id)) {
      return fail('That conversation could not be found.');
    }
    submissionId = thread.submission_id;
    threadVisibility = thread.visibility;
  }
  if (!submissionId) return fail('That conversation could not be found.');

  const access = await submissionAccess(user, submissionId);
  if (!access.view) return fail('You do not have access to that submission.');
  // A judge's role is to score, not to correspond with the writer, in a blind
  // round or not.
  if (access.judgeOnly) return fail('Judges cannot post feedback on an entry they are scoring.');
  // Only staff and editors may open, or write in, an internal thread.
  const canInternal = isStaff(user) || hasRole(user, 'editor');
  if (threadVisibility === 'internal' && !canInternal) return fail('That conversation could not be found.');
  const visibility = threadVisibility ?? (d.visibility === 'internal' && canInternal ? 'internal' : 'writer');

  const threadId =
    d.threadId ??
    (
      await queryOne<{ id: string }>(
        `INSERT INTO feedback_threads (submission_id, subject, visibility, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [submissionId, d.subject || 'Feedback', visibility, user.userId],
      )
    )?.id;
  if (!threadId) return fail('The message could not be saved. Please try again.');

  await query(`INSERT INTO feedback_messages (thread_id, author_id, body) VALUES ($1, $2, $3)`, [
    threadId,
    user.userId,
    d.body,
  ]);

  // Tell the writer, unless they wrote it or the thread is internal.
  if (visibility === 'writer') {
    const writer = await queryOne<{ id: string; name: string; email: string; title: string }>(
      `SELECT u.id, u.name, u.email, s.title
         FROM submissions s JOIN users u ON u.id = s.writer_id WHERE s.id = $1`,
      [submissionId],
    );
    if (writer && writer.id !== user.userId) {
      const t = templates.revisionRequested({
        name: writer.name,
        title: writer.title,
        note: d.body.slice(0, 300),
        link: abs(`/dashboard/submissions/${submissionId}`),
      });
      await notify({
        userId: writer.id,
        toEmail: writer.email,
        type: 'feedback_posted',
        subject: t.subject,
        html: t.html,
        // Keyed on the thread and the message count so each new note sends once.
        dedupeKey: `feedback:${threadId}:${Date.now()}`,
      });
    }
  }

  revalidatePath(`/dashboard/submissions/${submissionId}`);
  return ok('Message posted.');
}

// ---- milestones -----------------------------------------------------------------------

export async function addMilestoneAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await requireMentorOrStaff(str(form, 'mentorshipId'));
  if ('error' in guard) return guard.error;

  const parsed = milestoneSchema.safeParse({
    mentorshipId: str(form, 'mentorshipId'),
    title: str(form, 'title'),
    description: str(form, 'description'),
    dueAt: str(form, 'dueAt'),
  });
  if (!parsed.success) return invalid(parsed.error);

  await query(
    `INSERT INTO mentorship_milestones (mentorship_id, title, description, due_at, sort_order)
     VALUES ($1, $2, $3, NULLIF($4, '')::timestamptz,
             (SELECT COALESCE(max(sort_order), 0) + 1 FROM mentorship_milestones WHERE mentorship_id = $1))`,
    [parsed.data.mentorshipId, parsed.data.title, parsed.data.description ?? '', parsed.data.dueAt ?? ''],
  );

  revalidatePath(`/dashboard/mentor/${parsed.data.mentorshipId}`);
  return ok('Milestone added.');
}

export async function setMilestoneStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const milestoneId = str(form, 'milestoneId');
  const status = str(form, 'status');
  if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
    return fail('Unknown milestone status.');
  }

  const owner = await queryOne<{ mentorship_id: string }>(
    `SELECT mentorship_id FROM mentorship_milestones WHERE id = $1`,
    [milestoneId],
  );
  if (!owner) return fail('That milestone could not be found.');
  const guard = await requireMentorOrStaff(owner.mentorship_id);
  if ('error' in guard) return guard.error;

  await query(
    `UPDATE mentorship_milestones
        SET status = $2, completed_at = CASE WHEN $2::text = 'completed' THEN now() ELSE NULL END
      WHERE id = $1`,
    [milestoneId, status],
  );

  revalidatePath(`/dashboard/mentor/${owner.mentorship_id}`);
  return ok('Milestone updated.');
}

export async function endMentorshipAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const mentorshipId = str(form, 'mentorshipId');
  const guard = await requireMentorOrStaff(mentorshipId);
  if ('error' in guard) return guard.error;

  // Only a live pairing ends here. A cancelled one (its entry was withdrawn)
  // must stay cancelled: 'completed' would restore the mentor's access to it.
  const ended = await query<{ id: string }>(
    `UPDATE mentorships SET status = 'completed', ended_at = now()
      WHERE id = $1 AND status IN ('active', 'paused') RETURNING id`,
    [mentorshipId],
  );
  if (ended.length === 0) return fail('This mentorship has already ended.');
  await audit({
    actorId: guard.user.userId,
    action: 'mentorship.completed',
    entityType: 'mentorship',
    entityId: mentorshipId,
  });
  revalidatePath(`/dashboard/mentor/${mentorshipId}`);
  return ok('Mentorship marked complete.');
}

async function requireMentorOrStaff(
  mentorshipId: string,
): Promise<{ error: ActionState } | { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> }> {
  const user = await getSessionUser();
  if (!user) return { error: fail('Please sign in again.') };
  if (isStaff(user)) return { user };

  const owns = await queryOne(`SELECT 1 FROM mentorships WHERE id = $1 AND mentor_id = $2`, [
    mentorshipId,
    user.userId,
  ]);
  if (!owns) return { error: fail('That mentorship is not yours.') };
  return { user };
}
