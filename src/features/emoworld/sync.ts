import { query, queryOne, type TxQuery } from '@/lib/db';
import { publicUrl } from '@/lib/r2';
import { htmlToParagraphs } from '@/lib/richtext';
import {
  absoluteHttpsUrl,
  classifyEmoworldResponse,
  describeRejection,
  isMinorAgeBand,
  remoteIdFrom,
  responseDetail,
  type QueueAction,
} from './wire';

/**
 * Handoff to Emoworld Publishers.
 *
 * A DPGLF story that has been approved for publication becomes a candidate for
 * review inside the Emoworld platform. The two systems are deliberately coupled
 * through a queue rather than a direct call: the Foundation's publication
 * decision must never fail, or wait, because a remote service is down or slow.
 *
 * Each story has one live queue row. Its `action` says what Emoworld should be
 * told: 'send' (take the story for review, or update it) or 'withdraw' (take it
 * back, because the entry was withdrawn or a guardian withdrew consent). The
 * same row moves between the two, so the console shows one line per story.
 *
 * The queue is populated automatically; draining it stays switched off until
 * EMOWORLD_SYNC_ENABLED is set.
 */

export function isEmoworldSyncEnabled(): boolean {
  return (
    process.env.EMOWORLD_SYNC_ENABLED === 'true' &&
    Boolean(process.env.EMOWORLD_API_BASE) &&
    Boolean(process.env.EMOWORLD_SYNC_SECRET)
  );
}

/** The contract sent to Emoworld. Additive changes only: this is a wire format. */
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
    /** DPGLF's age band ('under_13', '13_15', '16_17', '18_24', '25_plus'), or null. */
    ageBand: string | null;
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
  /** Absolute https URL of the story's cover image, or null when there is none. */
  coverUrl: string | null;
}

/**
 * A 'sending' row whose claim is younger than the claim window: a drain run is
 * waiting on Emoworld for it right now. Expects the queue row aliased as `q`.
 * Such a row keeps its claim when its instruction changes; the run hands it
 * back as pending when the request settles (see `settle`).
 */
const IN_FLIGHT = `(q.status = 'sending' AND q.claimed_at IS NOT NULL
                    AND q.claimed_at >= now() - interval '15 minutes')`;

export type EnqueueResult = 'queued' | 'unchanged' | 'not_sendable' | 'error';

/**
 * Queue a story to be sent. Idempotent: the partial unique index on `story_id`
 * means a story already waiting (or already sent) is not enqueued twice, so
 * re-approving after an edit does not create duplicates.
 *
 * An existing row is revived when it is not doing its job: one that used up its
 * attempts ('failed'), one stuck 'sending' by a run that died, one that was
 * withdrawn (the story has been approved again), or one still waiting to be
 * withdrawn. Re-queueing from the admin console is how an operator retries.
 *
 * 'not_sendable' means the story may not go to Emoworld at all (withdrawn,
 * consent withdrawn, or removed); nothing is queued.
 */
export async function enqueueStoryForEmoworld(storyId: string): Promise<EnqueueResult> {
  try {
    const payload = await buildPayload(storyId);
    if (!payload) return 'not_sendable';
    const rows = await query<{ id: string }>(
      `INSERT INTO emoworld_sync_queue AS q (story_id, payload)
       VALUES ($1, $2)
       ON CONFLICT (story_id) WHERE status <> 'cancelled'
       DO UPDATE SET action = 'send', payload = EXCLUDED.payload, last_error = NULL,
                     withdrawn_at = NULL,
                     status     = CASE WHEN ${IN_FLIGHT} THEN 'sending' ELSE 'pending' END,
                     attempts   = CASE WHEN ${IN_FLIGHT} THEN q.attempts ELSE 0 END,
                     claimed_at = CASE WHEN ${IN_FLIGHT} THEN q.claimed_at ELSE NULL END
        WHERE q.status IN ('failed', 'withdrawn')
           OR (q.status = 'pending' AND q.action = 'withdraw')
           OR (q.status = 'sending' AND (q.action = 'withdraw' OR NOT ${IN_FLIGHT}))
       RETURNING id`,
      [storyId, JSON.stringify(payload)],
    );
    return rows.length > 0 ? 'queued' : 'unchanged';
  } catch (e) {
    // A failure here must not roll back the publication decision.
    console.error(`[emoworld:enqueue] ${(e as Error).message}`);
    return 'error';
  }
}

export type WithdrawResult = 'withdrawing' | 'cancelled' | 'unchanged';

/**
 * Point a story's queue row at taking it back. Throws on a database error; the
 * exported wrappers below decide how a failure is contained.
 *
 * A row Emoworld cannot have seen (never attempted, never sent) is cancelled.
 * Anything else becomes a pending withdrawal: a sent story, and also a send
 * that failed or was cut off, because its request may have reached Emoworld
 * even though no answer came back. Withdrawing a story Emoworld never received
 * costs one request, answered 404, which counts as done.
 */
async function markForWithdrawal(q: TxQuery, storyId: string): Promise<WithdrawResult> {
  const cancelled = await q<{ id: string }>(
    `UPDATE emoworld_sync_queue
        SET status = 'cancelled', claimed_at = NULL, last_error = 'withdrawn before it was sent'
      WHERE story_id = $1 AND action = 'send' AND status = 'pending'
        AND attempts = 0 AND sent_at IS NULL
      RETURNING id`,
    [storyId],
  );
  const withdrawing = await q<{ id: string }>(
    `UPDATE emoworld_sync_queue AS q
        SET action = 'withdraw', last_error = NULL,
            status     = CASE WHEN ${IN_FLIGHT} THEN 'sending' ELSE 'pending' END,
            attempts   = CASE WHEN ${IN_FLIGHT} THEN q.attempts ELSE 0 END,
            claimed_at = CASE WHEN ${IN_FLIGHT} THEN q.claimed_at ELSE NULL END
      WHERE q.story_id = $1
        AND q.status NOT IN ('cancelled', 'withdrawn')
        AND NOT (q.action = 'withdraw' AND q.status IN ('pending', 'sending'))
      RETURNING q.id`,
    [storyId],
  );
  if (withdrawing.length > 0) return 'withdrawing';
  return cancelled.length > 0 ? 'cancelled' : 'unchanged';
}

/**
 * Take a story back from Emoworld: called when a story record is withdrawn
 * outside the entry workflow (the story form), and when an operator retries a
 * withdrawal. Never throws: like enqueueing, a failure is logged and must not
 * fail the action that called it.
 */
export async function withdrawStoryFromEmoworld(storyId: string): Promise<WithdrawResult | 'error'> {
  try {
    return await markForWithdrawal(query, storyId);
  } catch (e) {
    console.error(`[emoworld:withdraw] ${(e as Error).message}`);
    return 'error';
  }
}

/**
 * The same for an entry, inside the caller's transaction, so the withdrawal
 * and the instruction to Emoworld commit together. It runs under a savepoint:
 * if it fails (the queue table not yet migrated, say), only this part is
 * undone and logged, and the withdrawal itself still goes through.
 */
export async function withdrawSubmissionFromEmoworld(q: TxQuery, submissionId: string): Promise<void> {
  await q('SAVEPOINT emoworld_withdraw');
  try {
    const stories = await q<{ id: string }>(`SELECT id FROM stories WHERE submission_id = $1`, [
      submissionId,
    ]);
    for (const story of stories) await markForWithdrawal(q, story.id);
    await q('RELEASE SAVEPOINT emoworld_withdraw');
  } catch (e) {
    console.error(`[emoworld:withdraw] ${(e as Error).message}`);
    await q('ROLLBACK TO SAVEPOINT emoworld_withdraw');
  }
}

/**
 * The wire payload for a story, or null when there is nothing that may be sent:
 * no such story, one whose entry was withdrawn, or one whose guardian withdrew
 * consent (a published entry stays on DPGLF's archive, but is not offered to
 * another publisher without consent). Null must stop a send, never fall back to
 * an older snapshot.
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
    cover_key: string | null;
  }>(
    `SELECT s.id, s.slug, s.title, s.synopsis, s.body_html, s.language, s.genre, s.themes,
            s.word_count, s.author_id, u.name AS author_name, u.email AS author_email,
            p.pen_name, p.display_name, p.country, p.bio, p.age_band,
            c.name AS competition_name,
            COALESCE(s.published_at, s.updated_at) AS approved_at,
            r.ownership_note, r.licence_type, r.territory, r.restrictions,
            f.storage_key AS cover_key
       FROM stories s
       JOIN users u ON u.id = s.author_id
       LEFT JOIN profiles p ON p.user_id = s.author_id
       LEFT JOIN submissions sub ON sub.id = s.submission_id
       LEFT JOIN competitions c ON c.id = sub.competition_id
       LEFT JOIN guardian_consents gc ON gc.id = sub.consent_id
       -- Only a cover uploaded as public has a public URL.
       LEFT JOIN files f ON f.id = s.cover_file_id AND f.visibility = 'public'
       LEFT JOIN LATERAL (
         SELECT ownership_note, licence_type, territory, restrictions
           FROM rights_records WHERE story_id = s.id ORDER BY created_at DESC LIMIT 1
       ) r ON true
      WHERE s.id = $1
        AND s.status <> 'withdrawn'
        AND (sub.id IS NULL OR sub.status <> 'WITHDRAWN')
        AND (gc.id IS NULL OR gc.status <> 'revoked')`,
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
      isMinor: isMinorAgeBand(row.age_band),
      ageBand: row.age_band,
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
    // Read per call: env is not settled at module load everywhere this runs.
    coverUrl: row.cover_key
      ? absoluteHttpsUrl(publicUrl(row.cover_key), process.env.NEXT_PUBLIC_SITE_URL)
      : null,
  };
}

export interface DrainResult {
  attempted: number;
  sent: number;
  withdrawn: number;
  failed: number;
  skipped?: string;
  more?: boolean;
}

/** Per-request limit on the Emoworld call, well inside a function timeout. */
const SEND_TIMEOUT_MS = 8_000;

/** One call to Emoworld. Throws on a network error or timeout; any HTTP status is returned. */
async function callEmoworld(
  method: 'POST' | 'DELETE',
  url: string,
  body: string | undefined,
  deadline: number | undefined,
): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${process.env.EMOWORLD_SYNC_SECRET}`,
    },
    body,
    // Never past the caller's deadline: a request that outlives the function
    // is killed with it, and the unsent rows would not be released.
    signal: AbortSignal.timeout(
      Math.max(1_000, Math.min(SEND_TIMEOUT_MS, (deadline ?? Infinity) - Date.now())),
    ),
  });
  return { status: res.status, text: await res.text().catch(() => '') };
}

/**
 * Record how a claimed row ended, but only while this run still owns it: the
 * row is still 'sending' for the action that was claimed. If a withdrawal (or
 * a re-queue) changed the action while the request was out, the row is handed
 * back as pending instead, so the next run carries out the newer instruction.
 * `accepted` notes that Emoworld took the send, so the withdrawal that follows
 * is known to have something to take down.
 *
 * `set` is always a literal from this file; its own parameters start at $3.
 */
async function settle(
  rowId: string,
  action: QueueAction,
  set: string,
  params: unknown[] = [],
  accepted?: { remoteId: string | null },
): Promise<void> {
  const owned = await query<{ id: string }>(
    `UPDATE emoworld_sync_queue SET ${set}
      WHERE id = $1 AND status = 'sending' AND action = $2
      RETURNING id`,
    [rowId, action, ...params],
  );
  if (owned.length > 0) return;
  await query(
    `UPDATE emoworld_sync_queue
        SET status = 'pending', attempts = 0, claimed_at = NULL,
            sent_at = CASE WHEN $3::boolean THEN now() ELSE sent_at END,
            remote_id = COALESCE($4::text, remote_id)
      WHERE id = $1 AND status = 'sending' AND action <> $2`,
    [rowId, action, Boolean(accepted), accepted?.remoteId ?? null],
  );
}

/**
 * Work through the queue. Called from the admin console and the cron route.
 * Each row is attempted independently so one bad story cannot block the rest.
 *
 * A 'send' row POSTs the story, rebuilt fresh; a 'withdraw' row DELETEs it.
 * A send that may no longer go out (the entry was withdrawn since) is
 * cancelled if Emoworld never saw it, and turned into a withdrawal if it might
 * have.
 *
 * Rows are claimed as 'sending'. A 'sending' row whose claim is over fifteen
 * minutes old belonged to a run that was killed mid-loop (a function timeout),
 * and is claimed again rather than stuck forever. A 'failed' row also waits out
 * those fifteen minutes before its next attempt: the scheduler calls again at
 * once when a run stops early, and without the wait one outage would spend all
 * five attempts inside a single run. A refusal from Emoworld (a 4xx other than
 * 408, 425 and 429) is not retried at all: the row is marked failed with its
 * attempts used up, and an operator re-queues it once the cause is fixed.
 * `deadline` (epoch ms) stops the loop early and releases the unsent rest.
 */
export async function drainEmoworldQueue(
  limit = 20,
  options: { deadline?: number } = {},
): Promise<DrainResult> {
  if (!isEmoworldSyncEnabled()) {
    return {
      attempted: 0,
      sent: 0,
      withdrawn: 0,
      failed: 0,
      skipped: 'EMOWORLD_SYNC_ENABLED is not set',
    };
  }

  const base = `${process.env.EMOWORLD_API_BASE!.replace(/\/$/, '')}/api/partners/dpglf/stories`;

  // Out of time already (earlier tasks used the budget): claim nothing.
  if (options.deadline && Date.now() > options.deadline) {
    return { attempted: 0, sent: 0, withdrawn: 0, failed: 0, more: true };
  }

  // A run killed mid-send on a row's last attempt leaves it 'sending' with no
  // attempts left, which the claim below would never pick up again. Settle it
  // as failed, so it shows as such and can be re-queued.
  await query(
    `UPDATE emoworld_sync_queue SET status = 'failed', last_error = 'run ended mid-send'
      WHERE status = 'sending' AND attempts >= 5 AND claimed_at < now() - interval '15 minutes'`,
  );

  const pending = await query<{
    id: string;
    story_id: string;
    action: QueueAction;
    attempts: number;
    sent_at: string | null;
  }>(
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
      RETURNING id, story_id, action, attempts, sent_at`,
    [limit],
  );

  let sent = 0;
  let withdrawn = 0;
  let failed = 0;
  let attempted = 0;
  for (const [i, row] of pending.entries()) {
    if (options.deadline && Date.now() > options.deadline) {
      await query(
        `UPDATE emoworld_sync_queue
            SET status = 'pending', attempts = attempts - 1, claimed_at = NULL
          WHERE id = ANY($1::uuid[]) AND status = 'sending'`,
        [pending.slice(i).map((r) => r.id)],
      );
      return { attempted, sent, withdrawn, failed, more: true };
    }
    attempted++;
    let action = row.action;
    try {
      let payload: EmoworldStoryPayload | null = null;
      if (action === 'send') {
        // Rebuild rather than trusting a payload snapshot that may be weeks old.
        // No payload means the story may no longer be sent (withdrawn, consent
        // withdrawn, or deleted). Sending the old snapshot instead would ship a
        // withdrawn minor's story after their guardian said no.
        payload = await buildPayload(row.story_id);
        if (!payload) {
          if (!row.sent_at && row.attempts <= 1) {
            // Emoworld has never seen it: nothing to take back.
            await settle(
              row.id,
              'send',
              `status = 'cancelled', claimed_at = NULL, last_error = 'entry withdrawn or story removed'`,
            );
            continue;
          }
          // Emoworld took it earlier, or may have: withdraw it instead.
          const switched = await query<{ id: string }>(
            `UPDATE emoworld_sync_queue SET action = 'withdraw'
              WHERE id = $1 AND status = 'sending' AND action = 'send'
              RETURNING id`,
            [row.id],
          );
          if (switched.length === 0) continue; // changed under us; the next run follows the change
          action = 'withdraw';
        }
      }

      const res =
        action === 'send'
          ? await callEmoworld('POST', base, JSON.stringify(payload), options.deadline)
          : await callEmoworld(
              'DELETE',
              `${base}/${encodeURIComponent(row.story_id)}`,
              undefined,
              options.deadline,
            );

      const outcome = classifyEmoworldResponse(res.status, action);
      if (outcome === 'success' && action === 'send') {
        const remoteId = remoteIdFrom(res.text);
        await settle(
          row.id,
          action,
          `status = 'sent', sent_at = now(), remote_id = $3, last_error = NULL, payload = $4,
           withdrawn_at = NULL`,
          [remoteId, JSON.stringify(payload)],
          { remoteId },
        );
        sent++;
      } else if (outcome === 'success') {
        // sent_at stays: it is when Emoworld first took the story.
        await settle(row.id, action, `status = 'withdrawn', withdrawn_at = now(), last_error = NULL`);
        withdrawn++;
      } else if (outcome === 'permanent') {
        failed++;
        await settle(row.id, action, `status = 'failed', attempts = 5, last_error = $3`, [
          describeRejection(res.status, res.text),
        ]);
      } else {
        failed++;
        await settle(row.id, action, `status = 'failed', last_error = $3`, [
          `Emoworld answered ${res.status}: ${responseDetail(res.text)}`.slice(0, 500),
        ]);
      }
    } catch (e) {
      // Network error or timeout: the request may or may not have arrived.
      failed++;
      await settle(row.id, action, `status = 'failed', last_error = $3`, [
        (e as Error).message.slice(0, 500),
      ]);
    }
  }

  return { attempted, sent, withdrawn, failed, more: pending.length === limit };
}

export async function emoworldQueueRows(limit = 50) {
  try {
    return await query<{
      id: string;
      story_id: string;
      action: QueueAction;
      status: string;
      attempts: number;
      remote_id: string | null;
      last_error: string | null;
      created_at: string;
      sent_at: string | null;
      withdrawn_at: string | null;
      title: string;
    }>(
      `SELECT q.id, q.story_id, q.action, q.status, q.attempts, q.remote_id, q.last_error,
              q.created_at, q.sent_at, q.withdrawn_at, s.title
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
