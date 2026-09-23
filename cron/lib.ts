/**
 * The testable core of the DPGLF cron service: call the platform's maintenance
 * endpoint, classify the outcome, surface per-task failures. No Deno-only APIs
 * here, so the tests can import it without registering a cron or a server.
 */

/** Every six hours, at :17 past (UTC) — off the top of the hour. */
export const SCHEDULE = '17 */6 * * *';

export const DEFAULT_TARGET = 'https://gwatidzo.me/api/cron';

export interface RunResult {
  ok: boolean;
  status: number;
  body: unknown;
  durationMs: number;
}

export interface RunOptions {
  target: string;
  key: string;
  fetchImpl?: typeof fetch;
  /** Client-side ceiling. The platform's own function limit is shorter; this only guards a hung socket. */
  timeoutMs?: number;
}

/**
 * Call the platform's authenticated /api/cron endpoint once.
 *
 * Throws on network failure or timeout (the caller treats that as retryable);
 * otherwise resolves with whatever the platform said, including error statuses.
 */
export async function runMaintenance(options: RunOptions): Promise<RunResult> {
  const { target, key, fetchImpl = fetch, timeoutMs = 60_000 } = options;
  const started = performance.now();

  const response = await fetchImpl(target, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${key}`,
      'user-agent': 'dpglf-cron (Deno Deploy)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // An HTML error page from the host, say — keep enough to debug from the logs.
    body = text.slice(0, 500);
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
    durationMs: Math.round(performance.now() - started),
  };
}

/**
 * Whether a failed run is worth retrying.
 *
 * A 4xx means the service is misconfigured (wrong CRON_KEY, wrong URL) and a
 * retry in ten minutes will fail identically — those are logged, not retried.
 * Timeouts, rate limits and 5xx are transient.
 */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * The endpoint runs each task independently and reports a task's failure as a
 * `<task>Error` key inside an otherwise-200 response, so one broken task never
 * stops the others. Pull those out so they show up as errors in the logs.
 */
export function taskErrors(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.entries(body as Record<string, unknown>)
    .filter(([key, value]) => key.endsWith('Error') && typeof value === 'string')
    .map(([key, value]) => `${key.slice(0, -'Error'.length)}: ${value}`);
}

/** Constant-time string comparison for the manual-trigger bearer token. */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/**
 * True when the platform stopped early to stay inside its function time budget
 * and has more work queued (`"more": true` in the report).
 */
export function hasMore(body: unknown): boolean {
  return typeof body === 'object' && body !== null && !Array.isArray(body) &&
    (body as Record<string, unknown>).more === true;
}
