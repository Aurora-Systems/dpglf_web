# DPGLF Platform

The web platform for the **Dr. Phillip Gwatidzo Literary Foundation** — a multi-role storytelling
system, not a foundation brochure with a contact form.

It implements the six-stage ecosystem from the business plan end to end:

```
Discover → Develop → Publish → Archive → Adapt → Commercialize
```

Public marketing site, competition submissions, blind judging, mentorship, editorial, a
permission-aware Story Archive, and a rights/adaptation registry — plus the queue that hands
publish-approved stories to **Emoworld Publishers** for review.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | One codebase for the marketing site and the app |
| Styling | Tailwind v4 | Brand tokens sampled from the Foundation logo |
| Database | Neon Postgres via `@neondatabase/serverless` | HTTP for one-shot queries, WebSocket only for real transactions |
| Files | Cloudflare R2 (`aurorasystems` bucket, `dpglf/` prefix) | Private by default; binaries never touch Postgres |
| Email | Resend | Recorded before dispatch so failures are visible |
| Auth | `jose` JWT + PBKDF2 over Web Crypto | Runtime-neutral: works on Node, Netlify and Workers |
| Search | Postgres full-text | Sufficient for the first thousands of stories; one moving part |

No ORM. Queries are SQL in `src/features/*/queries.ts`, typed at the call site.

---

## Getting started

Needs Node 22 or later: database transactions use the global `WebSocket`, which Node 20 lacks.
Deadlines are entered and shown in Harare time (CAT); uploads are capped at 4 MB to fit Netlify's
6 MB request limit.

```bash
pnpm install
cp .env.example .env.local     # fill in DATABASE_URL, AUTH_SECRET, R2 and Resend keys
pnpm db:push                   # apply db/schema.sql
pnpm db:seed "you@dpglf.org" "a-strong-password"
pnpm dev
```

Run the checks the same way CI would:

```bash
pnpm test        # unit tests: state machine, access rules, blockers, crypto, sanitiser
pnpm typecheck
pnpm lint
```

`db:seed` creates the super-admin account and the Foundation's launch content: Tales from the
Baobab (as a draft), a five-criterion judging rubric, the partner organisations named in the
business plan, and policy page shells.

### Brand assets

Every brand asset lives in R2, not the repo. To re-upload after a design change:

```bash
node scripts/upload-assets.mjs ./path-to-assets
```

Keys are stable (`dpglf/brand/logo-mark-512.png`, `dpglf/media/intro.mp4`, …), so refreshing an
asset never means touching code. The only images in the repo are the favicons, which Next.js
requires as local files.

---

## Repository shape

```
db/schema.sql                 Full schema — idempotent, re-runnable
scripts/                      db-push, seed, asset upload
cron/                         Deno Deploy service that calls /api/cron every six hours
src/app/
  (marketing)/                Public site: home, about, how-it-works, programmes,
                              perspectives, archive, authors, partners, support,
                              news, contact, policies
  (auth)/                     Sign in, sign up, verification, password reset
  consent/[token]/            Guardian consent — public, token-addressed
  dashboard/                  Writer, judge, mentor, editorial and admin consoles
  api/files/[id]/             The only way a private file leaves R2
  api/cron/                   Deadline reminders, Emoworld drain, housekeeping
  media/[...key]/             Public brand media proxied out of the private bucket
src/features/                 One folder per domain: queries.ts, actions.ts, forms
src/lib/                      db, auth, access, permissions, r2, email, notify,
                              audit, workflow, validation, ratelimit
```

`features/*/queries.ts` reads. `features/*/actions.ts` writes (server actions). Components import
from both; neither imports a component.

---

## The decisions worth knowing

**Authorisation is centralised.** `lib/access.ts` holds pure predicates (shared with client
components); `lib/permissions.ts` holds the server guards and `submissionAccess()`, which answers
in one query whether a user may view, download, edit or must-see-anonymised a given submission.
Hiding a nav link is never the access control — every page re-checks.

**The state machine is data.** `lib/workflow.ts` declares every legal transition and who may make
it. `features/workflow/actions.ts` is the only writer of `submissions.status`, and it writes a
`submission_events` row plus an audit record every time. A screen cannot invent a transition.

**Originals are never overwritten.** The submitted manuscript is `story_versions` version 1.
Revisions add rows pointing at new R2 objects.

**Publication and visibility are independent.** A story can be published in print and still be
metadata-only in the public archive, or vice versa. `archive_metadata.visibility` decides what the
world sees; `stories.status` decides what the Foundation has done.

**Rights never change by side effect.** Publishing a story does not touch `rights_records`.
Ownership defaults to the author and is edited deliberately.

**Notifications are recorded before dispatch.** Every intended message is a row with a
`dedupe_key`, so a replayed trigger conflicts instead of emailing a fifteen-year-old twice, and an
undelivered message is visible in the admin console rather than lost. The rendered body is stored
with the record, so `/api/cron` (and the admin console's retry button) can re-send anything that
failed — for example everything queued while the Resend domain was unverified.

**Sessions refresh silently.** Access tokens last 15 minutes; `src/proxy.ts` rotates the single-use
refresh token on document navigations and server-action submits, so a writer who leaves the
submission wizard open for an hour does not lose their session — or their form post.

**Policies degrade honestly.** The business plan does not define legal wording. Until the
Foundation publishes an approved policy, each policy page states exactly what the platform actually
does. Nobody is asked to consent to something undocumented.

---

## Guardian consent

Writers in an under-18 age band cannot submit until a named guardian has consented. The flow:

1. The writer adds guardian details in the submission wizard.
2. The guardian receives a tokenised link to `/consent/<token>` — no account needed.
3. Granting or declining is recorded with the consent wording version, timestamp and IP.
4. Declining (or later withdrawing) **withdraws the entry** — consent is the basis on which it is
   considered, so an entry cannot sit in the pipeline without it.

---

## Emoworld handoff

Approving a story for publication enqueues it in `emoworld_sync_queue`. Draining the queue POSTs to:

```
POST {EMOWORLD_API_BASE}/api/partners/dpglf/stories
Authorization: Bearer {EMOWORLD_SYNC_SECRET}
```

with the payload defined by `EmoworldStoryPayload` in `src/features/emoworld/sync.ts` — story text,
metadata, author (including an `isMinor` flag so Emoworld can apply its own safeguarding rules) and
the rights position. Emoworld should upsert on `externalId` and may return `{ "id": "..." }`, which
is stored as `remote_id`.

It is a queue, not a direct call, on purpose: the Foundation's publication decision must never fail
or wait because a remote service is down. **Nothing is sent until `EMOWORLD_SYNC_ENABLED=true`** —
until then stories accumulate safely and the admin console shows the backlog.

The matching receiver on the Emoworld side is not built yet; this is the last stage of the
integration.

---

## Scheduled work

`/api/cron` sends 72-hour and 24-hour deadline reminders to unfinished drafts, retries unsent email,
drains the Emoworld queue and prunes old rate-limit counters. Everything it does is idempotent.

Netlify gives the route no clock, so a separate **Deno Deploy** service in [`cron/`](cron/README.md)
calls it every six hours with the shared `CRON_KEY`. That service holds no database credentials and
no business logic — see its README to deploy and verify it. To run the tasks by hand:

```bash
curl -H "Authorization: Bearer $CRON_KEY" https://gwatidzo.me/api/cron
```

---

## Deployment

**Netlify (default).** `netlify.toml` is committed and already carries the public identity
(`NEXT_PUBLIC_SITE_URL=https://gwatidzo.me`); set the secrets in the Netlify UI. The runtime is Node,
which is what the AWS SDK and the manuscript parsers expect. Note the R2 key id is read as
`CLOUDFLARE_ACCESS_key_id` — that exact mixed casing. Scheduled work runs from the Deno Deploy
service in `cron/`.

**Cloudflare Workers (the implementation plan's suggestion)** is a supported path but is not
configured here. The code was written to keep it open — Web Crypto instead of `node:crypto`, the
Neon HTTP driver instead of a TCP pool, no Node-only middleware. Adopting it means adding the
OpenNext adapter and verifying `@aws-sdk/client-s3`, `mammoth` and `unpdf` in a Workers preview
before committing to it. Do that in a spike, not on the launch path.

---

## Launch checklist

- [ ] Production domain and DNS on Cloudflare
- [ ] Neon production database created; `pnpm db:push` run; backup/restore documented
- [ ] R2 bucket private; lifecycle/retention agreed
- [ ] Resend domain verified (SPF/DKIM); `EMAIL_FROM` and reply-to agreed
- [ ] `AUTH_SECRET` and `CRON_KEY` set to real random values
- [ ] Super-admin account created; extra admins granted deliberately
- [ ] Competition rules, privacy, safeguarding, copyright and consent wording **approved and
      published** via the admin console (until then the interim text shows)
- [ ] Seed competition and rubric configured; test submissions removed
- [ ] Load test the submission path near deadline conditions
- [ ] Accessibility and mobile-browser QA
- [ ] Escalation contacts for safeguarding concerns documented

### Known gaps, deliberately

- **Malware scanning.** Uploads are checked by magic number, extension, size and word count, which
  stops the obvious cases. A real scanner (ClamAV or an API) belongs in front of `storeFile()`
  before mentors start downloading strangers' files at volume.
- **Payments.** Memberships and donations are post-MVP per the plan; `/support` routes to a
  conversation instead.
- **Partner self-service portal.** Partners get archive visibility and an enquiry workflow, not a
  marketplace. That is the plan's post-MVP priority 1.
