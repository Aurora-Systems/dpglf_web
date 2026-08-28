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
    `INSERT INTO notifications (user_id, to_email, type, channel, subject, payload, dedupe_key)
     VALUES ($1, $2, $3, 'email', $4, $5, $6)
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

/**
 * Re-send recorded messages that never went out — typically because Resend was
 * unconfigured or the sending domain was unverified at the time. Runs from the
 * cron route and the admin console. Rows without a stored body (written before
 * bodies were recorded) are skipped rather than guessed at, and five attempts
 * is the ceiling so a permanently bad address cannot retry forever.
 */
export async function retryUnsentNotifications(
  limit = 25,
): Promise<{ attempted: number; sent: number; failed: number }> {
  const rows = await query<{
    id: string;
    to_email: string | null;
    subject: string;
    payload: { html?: string; replyTo?: string | null };
  }>(
    `SELECT id, to_email, subject, payload
       FROM notifications
      WHERE sent_at IS NULL AND channel = 'email' AND attempts < 5 AND payload ? 'html'
      ORDER BY created_at
      LIMIT $1`,
    [limit],
  );

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
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
              attempts = attempts + 1,
              last_error = $3
        WHERE id = $1`,
      [row.id, result.ok, result.ok ? null : (result.error ?? (result.skipped ? 'email not configured' : 'unknown'))],
    );
  }
  return { attempted: rows.length, sent, failed };
}
