import type { TxQuery } from '@/lib/db';
import type { SubmissionStatus } from '@/lib/workflow';

/**
 * Write one status change inside the caller's transaction.
 *
 * Callers decide whether the move is *allowed* (`canTransition`); this decides
 * whether it still *applies*. The UPDATE is guarded on the status the caller
 * read, so two people acting on the same entry at once cannot both win and
 * leave a history that contradicts the final state. Returns false when the row
 * had already moved on, and writes nothing in that case.
 *
 * Kept out of `actions.ts` because a 'use server' module may only export
 * actions, and this must never be callable from a browser.
 */
export async function applyTransition(
  q: TxQuery,
  t: {
    submissionId: string;
    from: SubmissionStatus;
    to: SubmissionStatus;
    actorId: string | null;
    note: string;
  },
): Promise<boolean> {
  const moved = await q(
    `UPDATE submissions
        SET status = $3::text,
            withdrawn_at = CASE WHEN $3::text = 'WITHDRAWN' THEN now() ELSE withdrawn_at END,
            updated_at = now()
      WHERE id = $1 AND status = $2::text
      RETURNING id`,
    [t.submissionId, t.from, t.to],
  );
  if (moved.length === 0) return false;

  await q(
    `INSERT INTO submission_events (submission_id, from_status, to_status, actor_id, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [t.submissionId, t.from, t.to, t.actorId, t.note],
  );

  // A withdrawn entry leaves every queue it was in: judges stop seeing it (and
  // lose the manuscript with it), any mentorship ends, its story record is
  // withdrawn, and a pending Emoworld handoff is cancelled (the drain also
  // re-checks, for a row that was mid-send at this moment).
  if (t.to === 'WITHDRAWN') {
    await q(
      `UPDATE review_assignments SET status = 'revoked'
        WHERE submission_id = $1 AND status IN ('assigned', 'in_progress')`,
      [t.submissionId],
    );
    await q(
      `UPDATE mentorships SET status = 'cancelled', ended_at = now()
        WHERE submission_id = $1 AND status IN ('active', 'paused')`,
      [t.submissionId],
    );
    // Whatever its status: a story can be marked published through the story
    // form before its entry is, and a withdrawn entry must not stay on the
    // public archive. (A PUBLISHED entry can never be withdrawn.)
    await q(
      `UPDATE stories SET status = 'withdrawn', updated_at = now()
        WHERE submission_id = $1 AND status <> 'withdrawn'`,
      [t.submissionId],
    );
    await q(
      `UPDATE emoworld_sync_queue SET status = 'cancelled', claimed_at = NULL,
              last_error = 'entry withdrawn'
        WHERE status IN ('pending', 'failed')
          AND story_id IN (SELECT id FROM stories WHERE submission_id = $1)`,
      [t.submissionId],
    );
  }

  // Restoring the entry (the only way out of WITHDRAWN) brings its story back to
  // editorial, so re-approval can queue it and publication can list it again.
  if (t.from === 'WITHDRAWN') {
    await q(
      `UPDATE stories SET status = 'editorial', updated_at = now()
        WHERE submission_id = $1 AND status = 'withdrawn'`,
      [t.submissionId],
    );
  }
  return true;
}
