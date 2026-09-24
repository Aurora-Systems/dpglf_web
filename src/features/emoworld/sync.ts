import { query, queryOne } from '@/lib/db';
import { htmlToParagraphs } from '@/lib/richtext';

/**
 * Handoff to Emoworld Publishers.
 *
 * A DPGLF story that has been approved for publication becomes a candidate for
 * review inside the Emoworld platform. The two systems are deliberately coupled
 * through a queue rather than a direct call: the Foundation's publication
 * decision must never fail, or wait, because a remote service is down or slow.
 *
 * The queue is populated automatically; draining it is the last stage of the
 * integration and stays switched off until EMOWORLD_SYNC_ENABLED is set.
 */

export function isEmoworldSyncEnabled(): boolean {
  return (
    process.env.EMOWORLD_SYNC_ENABLED === 'true' &&
    Boolean(process.env.EMOWORLD_API_BASE) &&
    Boolean(process.env.EMOWORLD_SYNC_SECRET)
  );
}

/** The contract sent to Emoworld. Additive changes only — this is a wire format. */
export interface EmoworldStoryPayload {
  source: 'dpglf';
  /** Stable id on our side; Emoworld should upsert on it. */
  externalId: string;
  slug: string;
  title: string;
  synopsis: string;
  /** The story as plain text; paragraphs are separated by a blank line. */
  bodyText: string;
  /** The same story as DPGLF's sanitised HTML (p, h2–h4, lists, emphasis, links). */
  bodyHtml: string;
  language: string;
  genre: string | null;
  themes: string[];
  wordCount: number | null;
  author: {
    externalId: string;
    displayName: string;
    penName: string | null;
    email: string;
    country: string | null;
    bio: string;
    isMinor: boolean;
  };
  programme: string | null;
  approvedAt: string;
  /** What DPGLF is asking Emoworld to do with it. */
  intent: 'review_for_publication';
  rights: {
    ownership: string;
    licenceType: string | null;
    territory: string | null;
    restrictions: string;
  };
}

/**
 * Queue a story for the handoff. Idempotent: the partial unique index on
 * `story_id` means a story already waiting (or already sent) is not enqueued
 * twice, so re-approving after an edit does not create duplicates. A row that
 * used up its attempts ('failed') is revived instead, so re-queueing from the
 * admin console is how an operator retries after a long outage.
 */
export async function enqueueStoryForEmoworld(storyId: string): Promise<boolean> {
  try {
    const payload = await buildPayload(storyId);
    if (!payload) return false;
    // A 'sending' row whose claim went stale belonged to a run that died; it
    // is revived like a failed one rather than left holding the story's slot.
    const rows = await query<{ id: string }>(
      `INSERT INTO emoworld_sync_queue (story_id, payload)
       VALUES ($1, $2)
       ON CONFLICT (story_id) WHERE status <> 'cancelled'
       DO UPDATE SET status = 'pending', attempts = 0, claimed_at = NULL, last_error = NULL,
                     payload = EXCLUDED.payload
        WHERE emoworld_sync_queue.status = 'failed'
           OR (emoworld_sync_queue.status = 'sending'
               AND emoworld_sync_queue.claimed_at < now() - interval '15 minutes')
       RETURNING id`,
      [storyId, JSON.stringify(payload)],
    );
    return rows.length > 0;
  } catch (e) {
    // A failure here must not roll back the publication decision.
    console.error(`[emoworld:enqueue] ${(e as Error).message}`);
    return false;
  }
}

/**
 * The wire payload for a story, or null when there is nothing that may be sent:
 * no such story, or one whose entry was withdrawn (for a minor, possibly because
 * a guardian declined consent). Null must stop a send, never fall back to an
 * older snapshot.
 */
export async function buildPayload(storyId: string): Promise<EmoworldStoryPayload | null> {
  const row = await queryOne<{
    id: string;
    slug: string;
    title: string;
    synopsis: string;
    body_html: string | null;
    language: string;
    genre: string | null;
    themes: string[];
    word_count: number | null;
    author_id: string;
    author_name: string;
    author_email: string;
    pen_name: string | null;
    display_name: string | null;
    country: string | null;
    bio: string | null;
    age_band: string | null;
    competition_name: string | null;
    approved_at: string;
    ownership_note: string | null;
    licence_type: string | null;
    territory: string | null;
    restrictions: string | null;
  }>(
    `SELECT s.id, s.slug, s.title, s.synopsis, s.body_html, s.language, s.genre, s.themes,
            s.word_count, s.author_id, u.name AS author_name, u.email AS author_email,
            p.pen_name, p.display_name, p.country, p.bio, p.age_band,
            c.name AS competition_name,
            COALESCE(s.published_at, s.updated_at) AS approved_at,
            r.ownership_note, r.licence_type, r.territory, r.restrictions
       FROM stories s
       JOIN users u ON u.id = s.author_id
       LEFT JOIN profiles p ON p.user_id = s.author_id
       LEFT JOIN submissions sub ON sub.id = s.submission_id
       LEFT JOIN competitions c ON c.id = sub.competition_id
       LEFT JOIN LATERAL (
         SELECT ownership_note, licence_type, territory, restrictions
           FROM rights_records WHERE story_id = s.id ORDER BY created_at DESC LIMIT 1
       ) r ON true
      WHERE s.id = $1
        AND s.status <> 'withdrawn'
        AND (sub.id IS NULL OR sub.status <> 'WITHDRAWN')`,
    [storyId],
  );
  if (!row) return null;

  return {
    source: 'dpglf',
    externalId: row.id,
    slug: row.slug,
    title: row.title,
    synopsis: row.synopsis,
    bodyText: row.body_html ? htmlToParagraphs(row.body_html) : '',
    bodyHtml: row.body_html ?? '',
    language: row.language,
    genre: row.genre,
    themes: row.themes ?? [],
    wordCount: row.word_count,
    author: {
      externalId: row.author_id,
      displayName: row.display_name || row.author_name,
      penName: row.pen_name,
      email: row.author_email,
      country: row.country,
      bio: row.bio ?? '',
      // Emoworld needs this to apply its own safeguarding rules on arrival.
      isMinor: ['under_13', '13_15', '16_17'].includes(row.age_band ?? ''),
    },
    programme: row.competition_name,
    approvedAt: new Date(row.approved_at).toISOString(),
    intent: 'review_for_publication',
    rights: {
      ownership: row.ownership_note ?? 'Author retains copyright',
      licenceType: row.licence_type,
      territory: row.territory,
      restrictions: row.restrictions ?? '',
    },
  };
}

export interface DrainResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped?: string;
  more?: boolean;
}

/** Per-request limit on the Emoworld call, well inside a function timeout. */
const SEND_TIMEOUT_MS = 8_000;

/**
 * Send everything pending. Called from the admin console (and, later, a cron
 * route). Each row is attempted independently so one bad story cannot block the
 * rest of the queue.
 *
 * Rows are claimed as 'sending'. A 'sending' row whose claim is over fifteen
 * minutes old belonged to a run that was killed mid-loop (a function timeout),
 * and is claimed again rather than stuck forever. A 'failed' row also waits out
 * those fifteen minutes before its next attempt: the scheduler calls again at
 * once when a run stops early, and without the wait one outage would spend all
 * five attempts inside a single run. `deadline` (epoch ms) stops the loop early
 * and releases the unsent rest.
 */
export async function drainEmoworldQueue(
  limit = 20,
  options: { deadline?: number } = {},
): Promise<DrainResult> {
  if (!isEmoworldSyncEnabled()) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 'EMOWORLD_SYNC_ENABLED is not set' };
  }

  const base = process.env.EMOWORLD_API_BASE!.replace(/\/$/, '');
  const secret = process.env.EMOWORLD_SYNC_SECRET!;

  // Out of time already (earlier tasks used the budget): claim nothing.
  if (options.deadline && Date.now() > options.deadline) {
    return { attempted: 0, sent: 0, failed: 0, more: true };
  }

  // A run killed mid-send on a row's last attempt leaves it 'sending' with no
  // attempts left, which the claim below would never pick up again. Settle it
  // as failed, so it shows as such and can be re-queued.
  await query(
    `UPDATE emoworld_sync_queue SET status = 'failed', last_error = 'run ended mid-send'
      WHERE status = 'sending' AND attempts >= 5 AND claimed_at < now() - interval '15 minutes'`,
  );

  const pending = await query<{ id: string; story_id: string; payload: EmoworldStoryPayload }>(
    `UPDATE emoworld_sync_queue
        SET status = 'sending', attempts = attempts + 1, claimed_at = now()
      WHERE id IN (
        SELECT id FROM emoworld_sync_queue
         WHERE attempts < 5
           AND (status = 'pending'
                OR (status IN ('failed', 'sending')
                    AND (claimed_at IS NULL OR claimed_at < now() - interval '15 minutes')))
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id, story_id, payload`,
    [limit],
  );

  let sent = 0;
  let failed = 0;
  let attempted = 0;
  for (const [i, row] of pending.entries()) {
    if (options.deadline && Date.now() > options.deadline) {
      await query(
        `UPDATE emoworld_sync_queue
            SET status = 'pending', attempts = attempts - 1, claimed_at = NULL
          WHERE id = ANY($1::uuid[])`,
        [pending.slice(i).map((r) => r.id)],
      );
      return { attempted, sent, failed, more: true };
    }
    attempted++;
    try {
      // Rebuild rather than trusting a payload snapshot that may be weeks old. No
      // payload means the story may no longer be sent (withdrawn, or deleted):
      // cancel the row. Sending the old snapshot instead would ship a withdrawn
      // minor's story after their guardian said no.
      const payload = await buildPayload(row.story_id);
      if (!payload) {
        await query(
          `UPDATE emoworld_sync_queue
              SET status = 'cancelled', claimed_at = NULL, last_error = 'entry withdrawn or story removed'
            WHERE id = $1`,
          [row.id],
        );
        continue;
      }
      const res = await fetch(`${base}/api/partners/dpglf/stories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(payload),
        // Never past the caller's deadline: a request that outlives the function
        // is killed with it, and the unsent rows would not be released.
        signal: AbortSignal.timeout(
          Math.max(1_000, Math.min(SEND_TIMEOUT_MS, (options.deadline ?? Infinity) - Date.now())),
        ),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      await query(
        `UPDATE emoworld_sync_queue
            SET status = 'sent', sent_at = now(), remote_id = $2, last_error = NULL, payload = $3
          WHERE id = $1`,
        [row.id, body.id ?? null, JSON.stringify(payload)],
      );
      sent++;
    } catch (e) {
      failed++;
      await query(`UPDATE emoworld_sync_queue SET status = 'failed', last_error = $2 WHERE id = $1`, [
        row.id,
        (e as Error).message.slice(0, 500),
      ]);
    }
  }

  return { attempted, sent, failed, more: pending.length === limit };
}

export async function emoworldQueueRows(limit = 50) {
  try {
    return await query<{
      id: string;
      story_id: string;
      status: string;
      attempts: number;
      remote_id: string | null;
      last_error: string | null;
      created_at: string;
      sent_at: string | null;
      title: string;
    }>(
      `SELECT q.id, q.story_id, q.status, q.attempts, q.remote_id, q.last_error,
              q.created_at, q.sent_at, s.title
         FROM emoworld_sync_queue q
         JOIN stories s ON s.id = q.story_id
        ORDER BY q.created_at DESC
        LIMIT $1`,
      [limit],
    );
  } catch {
    return [];
  }
}
