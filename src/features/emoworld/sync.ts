import { query, queryOne } from '@/lib/db';
import { htmlToText } from '@/lib/richtext';

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
  bodyText: string;
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
 * twice, so re-approving after an edit does not create duplicates.
 */
export async function enqueueStoryForEmoworld(storyId: string): Promise<void> {
  try {
    const payload = await buildPayload(storyId);
    if (!payload) return;
    await query(
      `INSERT INTO emoworld_sync_queue (story_id, payload)
       VALUES ($1, $2)
       ON CONFLICT (story_id) WHERE status <> 'cancelled' DO NOTHING`,
      [storyId, JSON.stringify(payload)],
    );
  } catch (e) {
    // A failure here must not roll back the publication decision.
    console.error(`[emoworld:enqueue] ${(e as Error).message}`);
  }
}

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
      WHERE s.id = $1`,
    [storyId],
  );
  if (!row) return null;

  return {
    source: 'dpglf',
    externalId: row.id,
    slug: row.slug,
    title: row.title,
    synopsis: row.synopsis,
    bodyText: row.body_html ? htmlToText(row.body_html) : '',
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
}

/**
 * Send everything pending. Called from the admin console (and, later, a cron
 * route). Each row is attempted independently so one bad story cannot block the
 * rest of the queue.
 */
export async function drainEmoworldQueue(limit = 20): Promise<DrainResult> {
  if (!isEmoworldSyncEnabled()) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 'EMOWORLD_SYNC_ENABLED is not set' };
  }

  const base = process.env.EMOWORLD_API_BASE!.replace(/\/$/, '');
  const secret = process.env.EMOWORLD_SYNC_SECRET!;

  const pending = await query<{ id: string; story_id: string; payload: EmoworldStoryPayload }>(
    `UPDATE emoworld_sync_queue
        SET status = 'sending', attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM emoworld_sync_queue
         WHERE status IN ('pending', 'failed') AND attempts < 5
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id, story_id, payload`,
    [limit],
  );

  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      // Rebuild rather than trusting a payload snapshot that may be weeks old.
      const payload = (await buildPayload(row.story_id)) ?? row.payload;
      const res = await fetch(`${base}/api/partners/dpglf/stories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(payload),
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

  return { attempted: pending.length, sent, failed };
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
