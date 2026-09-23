# dpglf-cron — scheduled maintenance on Deno Deploy

The platform runs on Netlify, which gives a Next.js route no clock of its own. This tiny Deno Deploy
service is the clock. Every six hours (`17 */6 * * *`, UTC) it calls the platform's authenticated
`/api/cron` endpoint, which:

- sends 72-hour and 24-hour deadline reminders to unfinished drafts
- retries email that failed to send (5-attempt ceiling; the admin console can force past it)
- drains the Emoworld handoff queue (no-op while `EMOWORLD_SYNC_ENABLED` is off)
- prunes old rate-limit counters and dead sign-in sessions

All of that work lives in the platform. This service holds **no database credentials and no business
logic** — only the shared `CRON_KEY` — and every task behind the endpoint is idempotent, so a
duplicated or retried run is harmless.

## Files

| File          | Purpose                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `main.ts`     | Entrypoint: registers `Deno.cron`, serves the health and manual-trigger routes |
| `lib.ts`      | The logic: call the endpoint, classify failures, surface per-task errors       |
| `lib_test.ts` | Tests for `lib.ts`                                                             |
| `deno.json`   | Tasks, `unstable: ["cron"]`, import map                                        |

No runtime dependencies — `main.ts` and `lib.ts` import nothing outside this folder.

## Deploy

1. **Deno Deploy → New project → link GitHub** → `Aurora-Systems/dpglf_web`.
2. **Entrypoint:** `cron/main.ts`. There is no build step.
3. **Environment variables:**

   | Name             | Value                                                       |
   | ---------------- | ----------------------------------------------------------- |
   | `CRON_KEY`       | **Exactly** the same value as the `CRON_KEY` set on Netlify |
   | `DPGLF_CRON_URL` | Optional. Defaults to `https://gwatidzo.me/api/cron`        |

4. Deploy. The cron appears under the project's **Cron** tab once the first deployment is live.

## Verify a deploy without waiting six hours

```bash
# Health: configured must be true
curl https://<your-project>.deno.dev/

# Trigger one run now; returns the platform's report
curl -X POST -H "Authorization: Bearer $CRON_KEY" https://<your-project>.deno.dev/run
```

A healthy report looks like:

```json
{
  "ok": true,
  "status": 200,
  "body": {
    "ok": true,
    "deadlineReminders": { "sent": 0 },
    "emailRetry": { "attempted": 0, "sent": 0, "failed": 0 },
    "emoworld": { "skipped": "…" },
    "pruned": true
  }
}
```

## Reading the logs

Each pass writes one JSON line tagged `"event":"dpglf-cron"`. The platform works to a 7-second
budget so it always finishes inside Netlify's function timeout; when it stops early it answers
`"more": true` and this service calls again straight away (up to 6 passes per run), so a burst of
deadline reminders or an email backlog clears in one run. Failures to look for:

- **`status: 401`** — `CRON_KEY` here does not match Netlify's. Not retried; fix the variable.
- **`<task>: …` errors** — the endpoint returned 200 but one task failed (e.g. `emailRetry`). The
  other tasks still ran.
- **5xx / timeout** — transient. `Deno.cron` retries after 30 s, 2 min and 10 min.

## Local development

```bash
cd cron
deno task test     # unit tests
deno task check    # typecheck
CRON_KEY=… DPGLF_CRON_URL=http://localhost:3000/api/cron deno task dev
```

This folder is excluded from the Next.js `tsconfig` and ESLint — it has its own toolchain.
