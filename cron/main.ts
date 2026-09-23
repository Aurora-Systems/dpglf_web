/**
 * DPGLF scheduled maintenance, hosted on Deno Deploy.
 *
 * The platform runs on Netlify, which gives a Next.js route no clock of its
 * own. This service is the clock: every six hours it calls the platform's
 * authenticated /api/cron endpoint, which sends deadline reminders, retries
 * unsent email, drains the Emoworld handoff queue and prunes rate-limit
 * counters.
 *
 * All of that work lives in the platform, not here. This service holds no
 * database credentials and no business logic — only the shared CRON_KEY — and
 * every task behind the endpoint is idempotent, so a duplicated or retried run
 * is harmless.
 *
 * Environment:
 *   CRON_KEY        required — must equal the platform's CRON_KEY
 *   DPGLF_CRON_URL  optional — defaults to https://gwatidzo.me/api/cron
 */

import {
  DEFAULT_TARGET,
  isRetryable,
  runMaintenance,
  type RunResult,
  SCHEDULE,
  taskErrors,
  timingSafeEqual,
} from './lib.ts';

const TARGET = Deno.env.get('DPGLF_CRON_URL') ?? DEFAULT_TARGET;
const KEY = Deno.env.get('CRON_KEY') ?? '';

async function run(trigger: 'schedule' | 'manual'): Promise<RunResult> {
  if (!KEY) throw new Error('CRON_KEY is not set on this Deno Deploy project');

  let result: RunResult;
  try {
    result = await runMaintenance({ target: TARGET, key: KEY });
  } catch (e) {
    console.error(
      JSON.stringify({ event: 'dpglf-cron', trigger, ok: false, error: (e as Error).message }),
    );
    throw e;
  }

  // One structured line per run — the Deno Deploy log view is the dashboard.
  console.log(JSON.stringify({ event: 'dpglf-cron', trigger, ...result }));

  for (const failure of taskErrors(result.body)) {
    console.error(`dpglf-cron task failed — ${failure}`);
  }
  if (result.status === 401) {
    console.error('dpglf-cron: 401 from the platform — CRON_KEY here does not match Netlify’s.');
  }
  return result;
}

// Registered at module top level: Deno Deploy discovers crons while evaluating
// the entrypoint. A throw hands the run to the backoff schedule below.
Deno.cron(
  'dpglf-maintenance',
  SCHEDULE,
  { backoffSchedule: [30_000, 120_000, 600_000] },
  async () => {
    const result = await run('schedule');
    if (!result.ok && isRetryable(result.status)) {
      throw new Error(`platform returned HTTP ${result.status}`);
    }
  },
);

/**
 * GET  /     — health check: confirms the service is up and configured.
 * POST /run  — trigger a run on demand (Authorization: Bearer <CRON_KEY>),
 *              for verifying a fresh deploy without waiting six hours.
 */
Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);

  if (req.method === 'GET' && pathname === '/') {
    return Response.json({
      service: 'dpglf-cron',
      schedule: `${SCHEDULE} (UTC)`,
      target: TARGET,
      configured: Boolean(KEY),
    });
  }

  if (req.method === 'POST' && pathname === '/run') {
    const auth = req.headers.get('authorization') ?? '';
    if (!KEY || !timingSafeEqual(auth, `Bearer ${KEY}`)) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      const result = await run('manual');
      return Response.json(result, { status: result.ok ? 200 : 502 });
    } catch (e) {
      return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
  }

  return new Response('Not found', { status: 404 });
});
