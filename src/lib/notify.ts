import { query, queryOne } from './db';
import { sendEmail } from './email';

/**
 * Notification dispatch.
 *
 * The record is written BEFORE the send. Two things follow from that: an
 * operator can see every message the platform intended to deliver (including
 * ones Resend rejected), and a replayed trigger with the same `dedupeKey`
 * conflicts on the unique index instead of emailing someone twice.
 */

export interface NotifyInput {
  userId?: string | null;
  toEmail: string;
  type: string;
  subject: string;
  html: string;
  /** Stable per logical event, e.g. `submission_receipt:<submissionId>`. */
  dedupeKey?: string;
  payload?: Record<string, unknown>;
  replyTo?: string;
}

export async function notify(input: NotifyInput): Promise<{ sent: boolean; duplicate?: boolean }> {
  if (!input.toEmail) return { sent: false };

  const row = await queryOne<{ id: string }>(
    // claimed_at marks the row as in flight, so the retry pass leaves it alone
    // while this request is still delivering it.
    `INSERT INTO notifications (user_id, to_email, type, channel, subject, payload, dedupe_key, claimed_at)
     VALUES ($1, $2, $3, 'email', $4, $5, $6, now())
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [
      input.userId ?? null,
      input.toEmail,
      input.type,
      input.subject,
      // The rendered body is stored with the record so a failed send can be
      // retried later without re-deriving the template's inputs.
      JSON.stringify({ ...(input.payload ?? {}), html: input.html, replyTo: input.replyTo ?? null }),
      input.dedupeKey ?? null,
    ],
  );
  // No row means the dedupe key already exists — this event was handled.
  if (!row) return { sent: false, duplicate: true };

  const result = await sendEmail({
    to: input.toEmail,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
  });

  await query(
    `UPDATE notifications
        SET sent_at = CASE WHEN $2::boolean THEN now() ELSE NULL END,
            attempts = attempts + 1,
            last_error = $3
      WHERE id = $1`,
    [row.id, result.ok, result.ok ? null : (result.error ?? (result.skipped ? 'email not configured' : 'unknown'))],
  );

  return { sent: result.ok };
}

/** Re-attempt everything that never left the building. Used by the admin retry action. */
export async function pendingNotificationCount(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications WHERE sent_at IS NULL AND channel = 'email'`,
  );
  return Number(row?.n ?? 0);
}

/** Retryable messages that were tried within the last minute (a forced retry skips them). */
export async function recentlyTriedCount(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications
      WHERE sent_at IS NULL AND channel = 'email' AND payload ? 'html'
        AND claimed_at >= now() - interval '1 minute'`,
  );
  return Number(row?.n ?? 0);
}

/**
 * Re-send recorded messages that never went out — typically because Resend was
 * unconfigured or the sending domain was unverified at the time. Runs from the
 * cron route and the admin console. Rows without a stored body (written before
 * bodies were recorded) are skipped rather than guessed at.
 *
 * The scheduled pass stops at five attempts so a permanently bad address
 * cannot retry forever. `force` lifts that ceiling for the admin button: a
 * scheduler running every few hours exhausts five attempts within a day, so
 * after a longer outage (an unverified domain, say) the scheduled pass has
 * already given up — and an operator deciding to try again must still be able
 * to.
 *
 * Rows are claimed before sending (attempt counted, claimed_at stamped) and a
 * row claimed in the last ten minutes is skipped, so a run that overlaps another
 * run, or a notify() still in flight, cannot send the same message twice.
 * `deadline` (epoch ms) stops the loop early; the unsent rest is released for
 * the next run.
 */
export async function retryUnsentNotifications(
  limit = 25,
  options: { force?: boolean; deadline?: number } = {},
): Promise<{ attempted: number; sent: number; failed: number; more: boolean }> {
  const rows = await query<{
    id: string;
    to_email: string | null;
    subject: string;
    payload: { html?: string; replyTo?: string | null };
  }>(
    `UPDATE notifications
        SET claimed_at = now(), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM notifications
         WHERE sent_at IS NULL AND channel = 'email' AND payload ? 'html'
           AND ($2::boolean OR attempts < 5)
           -- In flight, or just tried by the scheduler: leave it. An operator's
           -- forced retry only steps round a send that is genuinely under way.
           AND (claimed_at IS NULL
                OR claimed_at < now() - CASE WHEN $2::boolean THEN interval '1 minute'
                                             ELSE interval '10 minutes' END)
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id, to_email, subject, payload`,
    [limit, options.force ?? false],
  );

  let sent = 0;
  let failed = 0;
  let attempted = 0;
  for (const [i, row] of rows.entries()) {
    if (options.deadline && Date.now() > options.deadline) {
      // Out of time: hand the untouched rows back, attempt uncounted.
      await query(
        `UPDATE notifications SET claimed_at = NULL, attempts = attempts - 1 WHERE id = ANY($1::uuid[])`,
        [rows.slice(i).map((r) => r.id)],
      );
      return { attempted, sent, failed, more: true };
    }
    attempted++;
    if (!row.to_email || !row.payload?.html) continue;
    const result = await sendEmail({
      to: row.to_email,
      subject: row.subject,
      html: row.payload.html,
      replyTo: row.payload.replyTo ?? undefined,
    });
    if (result.ok) sent++;
    else failed++;
    await query(
      `UPDATE notifications
          SET sent_at = CASE WHEN $2::boolean THEN now() ELSE NULL END,
              last_error = $3
        WHERE id = $1`,
      [row.id, result.ok, result.ok ? null : (result.error ?? (result.skipped ? 'email not configured' : 'unknown'))],
    );
  }
  return { attempted, sent, failed, more: rows.length === limit };
}
