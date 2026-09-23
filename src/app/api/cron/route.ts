import { pruneRefreshTokens } from '@/lib/auth';
import { secretsEqual } from '@/lib/crypto';
import { query } from '@/lib/db';
import { abs, templates } from '@/lib/email';
import { formatDate } from '@/lib/format';
import { notify, retryUnsentNotifications } from '@/lib/notify';
import { pruneRateLimits } from '@/lib/ratelimit';
import { drainEmoworldQueue } from '@/features/emoworld/sync';

/**
 * Scheduled maintenance, called by an external scheduler.
 *
 * Authenticated with a shared secret rather than a session, because the caller
 * is a machine. Everything it does is idempotent: deadline reminders dedupe on
 * the notification key, and the email retry and Emoworld drain claim rows
 * before sending.
 *
 * The work shares one time budget, kept well inside a serverless function's
 * timeout: a function killed mid-loop would skip every task after it. When a
 * task runs out of budget the response says `more: true`, and the scheduler
 * (cron/ on Deno Deploy) calls again straight away to finish the backlog.
 *
 *   curl -H "Authorization: Bearer $CRON_KEY" https://…/api/cron
 */
const BUDGET_MS = 7_000;

export async function GET(req: Request) {
  const key = process.env.CRON_KEY;
  if (!key) return Response.json({ error: 'CRON_KEY is not configured' }, { status: 503 });

  const auth = req.headers.get('authorization') ?? '';
  if (!(await secretsEqual(auth, `Bearer ${key}`))) return new Response('Unauthorized', { status: 401 });

  const deadline = Date.now() + BUDGET_MS;
  const results: Record<string, unknown> = {};
  let more = false;

  // Cheap and bounded, so it always runs, and first.
  try {
    await pruneRateLimits();
    results.pruned = true;
  } catch (e) {
    results.pruneError = (e as Error).message;
  }
  try {
    results.expiredSessions = await pruneRefreshTokens();
  } catch (e) {
    results.expiredSessionsError = (e as Error).message;
  }

  try {
    const r = await sendDeadlineReminders(deadline);
    results.deadlineReminders = { sent: r.sent };
    more ||= r.more;
  } catch (e) {
    results.deadlineRemindersError = (e as Error).message;
  }

  try {
    const r = await retryUnsentNotifications(25, { deadline });
    results.emailRetry = r;
    more ||= r.more;
  } catch (e) {
    results.emailRetryError = (e as Error).message;
  }

  try {
    const r = await drainEmoworldQueue(20, { deadline });
    results.emoworld = r;
    more ||= Boolean(r.more);
  } catch (e) {
    results.emoworldError = (e as Error).message;
  }

  return Response.json({ ok: true, more, ...results });
}

/**
 * Nudge writers whose draft is about to miss a deadline. Runs against the 72-
 * and 24-hour marks; the notification dedupe key means a daily cron cannot
 * email the same person about the same window twice.
 */
async function sendDeadlineReminders(deadline: number): Promise<{ sent: number; more: boolean }> {
  const drafts = await query<{
    id: string;
    title: string;
    writer_id: string;
    writer_name: string;
    writer_email: string;
    competition_name: string;
    closes_at: string;
    window: string;
  }>(
    `SELECT s.id, s.title, s.writer_id, u.name AS writer_name, u.email AS writer_email,
            c.name AS competition_name, c.closes_at,
            CASE WHEN c.closes_at <= now() + interval '24 hours' THEN '24h' ELSE '72h' END AS window
       FROM submissions s
       JOIN users u ON u.id = s.writer_id
       JOIN competitions c ON c.id = s.competition_id
      WHERE s.status = 'DRAFT'
        AND c.status = 'open'
        AND c.closes_at IS NOT NULL
        AND c.closes_at > now()
        AND c.closes_at <= now() + interval '72 hours'`,
  );

  let sent = 0;
  for (const draft of drafts) {
    // Already-reminded drafts dedupe instantly, so the next run resumes here.
    if (Date.now() > deadline) return { sent, more: true };
    const t = templates.deadlineReminder({
      name: draft.writer_name,
      competition: draft.competition_name,
      closesAt: formatDate(draft.closes_at),
      link: abs(`/dashboard/submissions/${draft.id}/edit`),
    });
    const result = await notify({
      userId: draft.writer_id,
      toEmail: draft.writer_email,
      type: 'deadline_reminder',
      subject: t.subject,
      html: t.html,
      dedupeKey: `deadline:${draft.id}:${draft.window}`,
    });
    if (result.sent) sent++;
  }
  return { sent, more: false };
}
