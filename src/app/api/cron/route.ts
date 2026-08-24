import { query } from '@/lib/db';
import { abs, templates } from '@/lib/email';
import { formatDate } from '@/lib/format';
import { notify } from '@/lib/notify';
import { pruneRateLimits } from '@/lib/ratelimit';
import { drainEmoworldQueue } from '@/features/emoworld/sync';

/**
 * Scheduled maintenance, called by an external scheduler.
 *
 * Authenticated with a shared secret rather than a session, because the caller
 * is a machine. Everything it does is idempotent: deadline reminders dedupe on
 * the notification key, and the Emoworld drain claims rows before sending.
 *
 *   curl -H "Authorization: Bearer $CRON_KEY" https://…/api/cron
 */
export async function GET(req: Request) {
  const key = process.env.CRON_KEY;
  if (!key) return Response.json({ error: 'CRON_KEY is not configured' }, { status: 503 });

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${key}`) return new Response('Unauthorized', { status: 401 });

  const results: Record<string, unknown> = {};

  try {
    results.deadlineReminders = await sendDeadlineReminders();
  } catch (e) {
    results.deadlineRemindersError = (e as Error).message;
  }

  try {
    results.emoworld = await drainEmoworldQueue();
  } catch (e) {
    results.emoworldError = (e as Error).message;
  }

  try {
    await pruneRateLimits();
    results.pruned = true;
  } catch (e) {
    results.pruneError = (e as Error).message;
  }

  return Response.json({ ok: true, ...results });
}

/**
 * Nudge writers whose draft is about to miss a deadline. Runs against the 72-
 * and 24-hour marks; the notification dedupe key means a daily cron cannot
 * email the same person about the same window twice.
 */
async function sendDeadlineReminders(): Promise<{ sent: number }> {
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
  return { sent };
}
