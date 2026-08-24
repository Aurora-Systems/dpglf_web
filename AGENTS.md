<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DPGLF platform — working notes

**Where things live.** `src/features/<domain>/queries.ts` reads, `actions.ts` writes (server
actions), `*.tsx` in the same folder are that domain's client forms. `src/lib/` holds the shared
primitives. Components import from features; features never import components.

**Never bypass these.**

- `lib/permissions.ts` / `lib/access.ts` — the only place authorisation is decided. Hiding a link
  is not access control; every page re-checks.
- `features/workflow/actions.ts` — the only writer of `submissions.status`. Legal transitions are
  declared in `lib/workflow.ts`.
- `lib/notify.ts` — the only sender of email, so every message is recorded and deduplicated.
- `lib/files.ts` + `app/api/files/[id]/route.ts` — the only path a private R2 object takes to a
  browser, always through a permission check and a short-lived signed URL.

**Client/server boundary.** `lib/auth.ts` imports `next/headers`, so anything reaching it is
server-only. Pure predicates live in `lib/access.ts` and the session type in `lib/session.ts` so
client components can use them without dragging the server in.

**Database.** Raw SQL, no ORM. Parameters arrive as untyped text over the Neon HTTP driver — cast
them (`$1::boolean`, `$2::int`) wherever the surrounding expression is boolean or arithmetic.
Schema changes go in `db/schema.sql`, which is idempotent; apply with `pnpm db:push`.

**Brand assets** live in Cloudflare R2 (`aurorasystems` bucket, `dpglf/` prefix), never in the repo.
Keys are stable; `src/lib/brand.ts` maps them.
