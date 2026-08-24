import { query, queryOne } from './db';
import { clientIp } from './auth';

/**
 * Fixed-window rate limiting, held in Postgres.
 *
 * Deliberately simple: at Foundation scale (hundreds of submissions per
 * competition) a counter row per window is cheaper than operating a KV store,
 * and the limits that matter — sign-in, contact, submission, inquiry — are all
 * low-frequency by nature. Swap the storage if traffic ever outgrows it; the
 * call sites do not change.
 */

export interface Limit {
  /** Requests permitted per window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const LIMITS = {
  login: { max: 10, windowSeconds: 600 },
  signup: { max: 5, windowSeconds: 3600 },
  passwordReset: { max: 5, windowSeconds: 3600 },
  contact: { max: 5, windowSeconds: 3600 },
  newsletter: { max: 5, windowSeconds: 3600 },
  submission: { max: 30, windowSeconds: 3600 },
  upload: { max: 40, windowSeconds: 3600 },
  inquiry: { max: 5, windowSeconds: 3600 },
} satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Count one hit against `bucket` for `subject` (an IP, email or user id).
 * Fails open: if the counter itself errors we would rather serve the request
 * than take the site down.
 */
export async function rateLimit(bucket: LimitName, subject: string): Promise<LimitResult> {
  const { max, windowSeconds } = LIMITS[bucket];
  const key = subject.slice(0, 200) || 'unknown';
  try {
    const row = await queryOne<{ count: number; window_start: string }>(
      `INSERT INTO rate_limits (bucket, subject, window_start, count)
       VALUES ($1, $2, to_timestamp(floor(extract(epoch FROM now()) / $3::int) * $3::int), 1)
       ON CONFLICT (bucket, subject, window_start)
       DO UPDATE SET count = rate_limits.count + 1
       RETURNING count, window_start`,
      [bucket, key, windowSeconds],
    );
    const count = row?.count ?? 1;
    const windowEnd = new Date(row?.window_start ?? Date.now()).getTime() + windowSeconds * 1000;
    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000)),
    };
  } catch (e) {
    console.error(`[ratelimit:failed] ${bucket}: ${(e as Error).message}`);
    return { ok: true, remaining: max, retryAfterSeconds: 0 };
  }
}

/** Rate limit by caller IP. */
export async function rateLimitIp(bucket: LimitName): Promise<LimitResult> {
  return rateLimit(bucket, (await clientIp()) || 'no-ip');
}

/** Housekeeping: drop counters older than a day. Called from the admin console. */
export async function pruneRateLimits(): Promise<void> {
  await query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
