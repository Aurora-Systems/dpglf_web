-- =============================================================================
-- DPGLF platform schema (Neon Postgres)
--
-- Design notes
--   * The STORY is the central asset. A story's history is persisted as
--     explicit statuses plus an append-only event log, never inferred from UI
--     labels, so the Foundation can report on the Discover -> Develop ->
--     Publish -> Archive -> Adapt -> Commercialize pipeline later.
--   * Status columns are TEXT + CHECK rather than PG enums: adding a state to a
--     CHECK is a cheap DDL, adding an enum value is not reversible.
--   * File binaries never live in Postgres. `files` records the R2 object key,
--     size and checksum; the bytes sit in the private aurorasystems bucket.
--   * Adapt/Commercialize are modelled from day one (rights_records,
--     adaptation_inquiries) even though their MVP UI is admin-only.
--
-- Idempotent: safe to re-run. Apply with `pnpm db:push`.
-- =============================================================================

-- ---- identity ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  name            text NOT NULL DEFAULT '',
  password_hash   text,
  email_verified_at timestamptz,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- Roles are additive: one person can be both a mentor and a judge, and an admin
-- can also submit. Authorisation therefore always asks "does this user hold
-- role X", never "is this user's role X".
CREATE TABLE IF NOT EXISTS user_roles (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN
              ('writer', 'mentor', 'editor', 'judge', 'partner', 'admin', 'super_admin')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  -- Set (with revoked_at) when the token was spent by rotation rather than
  -- revoked by logout; opens a short grace window for racing requests.
  rotated_at  timestamptz,
  device_info text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Single-use email tokens: verification and password reset.
CREATE TABLE IF NOT EXISTS email_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_tokens_user_kind_idx ON email_tokens (user_id, kind);

-- ---- files (R2 object registry) ---------------------------------------------

CREATE TABLE IF NOT EXISTS files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key   text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  checksum      text,
  owner_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  purpose       text NOT NULL CHECK (purpose IN
                  ('manuscript', 'revision', 'avatar', 'cover', 'contract',
                   'consent_evidence', 'partner_logo', 'editorial', 'other')),
  -- 'private' objects are only ever reachable through a short-lived signed URL
  -- issued after a server-side permission check.
  visibility    text NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('private', 'public')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_owner_idx ON files (owner_id);

-- ---- profiles & consent ------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  text NOT NULL DEFAULT '',
  slug          text UNIQUE,
  pen_name      text,
  bio           text NOT NULL DEFAULT '',
  country       text,
  city          text,
  school        text,
  -- Age band is the default; an exact DOB is only stored when a programme's
  -- rules require provable eligibility (minimise child personal data).
  age_band      text CHECK (age_band IN ('under_13', '13_15', '16_17', '18_24', '25_plus')),
  date_of_birth date,
  languages     text[] NOT NULL DEFAULT '{}',
  avatar_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  website       text,
  socials       jsonb NOT NULL DEFAULT '{}'::jsonb,
  achievements  text NOT NULL DEFAULT '',
  -- Public author page is opt-in and separate from the account record.
  is_public     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guardian_consents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guardian_name    text NOT NULL,
  guardian_email   text NOT NULL,
  guardian_phone   text,
  relationship     text NOT NULL,
  consent_version  text NOT NULL,
  scope            text NOT NULL DEFAULT 'submission'
                     CHECK (scope IN ('submission', 'publication', 'media')),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'granted', 'revoked')),
  -- How consent was captured, for safeguarding audits.
  method           text NOT NULL DEFAULT 'guardian_email'
                     CHECK (method IN ('guardian_email', 'countersigned_form', 'in_person')),
  evidence_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  token_hash       text,
  requested_at     timestamptz NOT NULL DEFAULT now(),
  granted_at       timestamptz,
  revoked_at       timestamptz,
  ip               text
);
CREATE INDEX IF NOT EXISTS guardian_consents_user_idx ON guardian_consents (user_id, status);

-- ---- organisations -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS organisations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  type          text NOT NULL CHECK (type IN
                  ('publisher', 'production', 'school', 'university', 'cultural',
                   'ngo', 'corporate', 'funder', 'other')),
  website       text,
  country       text,
  contact_name  text,
  contact_email text,
  description   text NOT NULL DEFAULT '',
  logo_file_id  uuid REFERENCES files(id) ON DELETE SET NULL,
  partner_status text NOT NULL DEFAULT 'prospect'
                  CHECK (partner_status IN ('prospect', 'active', 'former')),
  is_public     boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    text NOT NULL DEFAULT 'member',
  PRIMARY KEY (org_id, user_id)
);

-- ---- competitions & rubrics ---------------------------------------------------

CREATE TABLE IF NOT EXISTS rubrics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  version       integer NOT NULL DEFAULT 1,
  description   text NOT NULL DEFAULT '',
  -- Once scoring has started the rubric is frozen; edits create a new version
  -- so historic scores stay interpretable.
  is_locked     boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id   uuid NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  label       text NOT NULL,
  description text NOT NULL DEFAULT '',
  max_score   integer NOT NULL DEFAULT 10 CHECK (max_score > 0),
  weight      numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rubric_criteria_rubric_idx ON rubric_criteria (rubric_id, sort_order);

CREATE TABLE IF NOT EXISTS competitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  tagline          text NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT '',
  rules_html       text NOT NULL DEFAULT '',
  eligibility_html text NOT NULL DEFAULT '',
  faq              jsonb NOT NULL DEFAULT '[]'::jsonb,
  themes           text[] NOT NULL DEFAULT '{}',
  languages        text[] NOT NULL DEFAULT '{English}',
  countries        text[] NOT NULL DEFAULT '{}',
  min_age          integer,
  max_age          integer,
  word_min         integer NOT NULL DEFAULT 500,
  word_max         integer NOT NULL DEFAULT 3000,
  max_entries      integer NOT NULL DEFAULT 1,
  opens_at         timestamptz,
  closes_at        timestamptz,
  results_at       timestamptz,
  rubric_id        uuid REFERENCES rubrics(id) ON DELETE SET NULL,
  -- Judges see an anonymised label instead of the writer's identity.
  blind_judging    boolean NOT NULL DEFAULT true,
  allow_score_revision boolean NOT NULL DEFAULT false,
  requires_guardian_consent boolean NOT NULL DEFAULT true,
  rules_version    text NOT NULL DEFAULT 'v1',
  hero_file_id     uuid REFERENCES files(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'open', 'closed', 'judging', 'completed', 'archived')),
  is_featured      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS competitions_status_idx ON competitions (status, closes_at DESC);

-- ---- submissions --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-quotable, immutable once issued (e.g. TFB-2026-0A7C3D).
  reference      text UNIQUE,
  writer_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  title          text NOT NULL DEFAULT '',
  synopsis       text NOT NULL DEFAULT '',
  language       text NOT NULL DEFAULT 'English',
  genre          text,
  themes         text[] NOT NULL DEFAULT '{}',
  cultural_context text NOT NULL DEFAULT '',
  word_count     integer,
  file_id        uuid REFERENCES files(id) ON DELETE SET NULL,
  -- Extracted plain text, used for word counts and (with permission) search.
  extracted_text text,
  consent_id     uuid REFERENCES guardian_consents(id) ON DELETE SET NULL,
  declarations   jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules_version  text,
  status         text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                   'DRAFT', 'SUBMITTED', 'ELIGIBILITY_REVIEW', 'ELIGIBLE', 'INELIGIBLE',
                   'ASSIGNED_FOR_JUDGING', 'JUDGED', 'SHORTLISTED', 'NOT_SELECTED',
                   'MENTORSHIP', 'EDITORIAL', 'APPROVED_FOR_PUBLICATION',
                   'PUBLISHED', 'WITHDRAWN')),
  eligibility_note text NOT NULL DEFAULT '',
  -- Judge-facing pseudonym for blind rounds.
  anon_label     text,
  submitted_at   timestamptz,
  -- Set by an admin to let a writer edit after the deadline.
  reopened_until timestamptz,
  withdrawn_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submissions_writer_idx ON submissions (writer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_comp_status_idx ON submissions (competition_id, status);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status, submitted_at DESC);

-- Append-only lifecycle log. Every status transition writes one row.
CREATE TABLE IF NOT EXISTS submission_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  from_status   text,
  to_status     text NOT NULL,
  actor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  note          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submission_events_sub_idx ON submission_events (submission_id, created_at);

-- ---- stories (canonical record) -------------------------------------------------

CREATE TABLE IF NOT EXISTS stories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  submission_id uuid UNIQUE REFERENCES submissions(id) ON DELETE SET NULL,
  author_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title         text NOT NULL,
  synopsis      text NOT NULL DEFAULT '',
  -- Sanitised HTML of the final text. Only served where visibility allows.
  body_html     text,
  excerpt       text,
  language      text NOT NULL DEFAULT 'English',
  genre         text,
  themes        text[] NOT NULL DEFAULT '{}',
  word_count    integer,
  cover_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'editorial'
                  CHECK (status IN ('editorial', 'approved', 'published', 'archived', 'withdrawn')),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stories_author_idx ON stories (author_id);
CREATE INDEX IF NOT EXISTS stories_status_idx ON stories (status, published_at DESC);

-- Manuscript revisions. The original submission file is version 1 and is never
-- overwritten — every revision is a new row pointing at a new R2 object.
CREATE TABLE IF NOT EXISTS story_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid REFERENCES submissions(id) ON DELETE CASCADE,
  story_id       uuid REFERENCES stories(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  file_id        uuid REFERENCES files(id) ON DELETE SET NULL,
  extracted_text text,
  word_count     integer,
  change_note    text NOT NULL DEFAULT '',
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (submission_id IS NOT NULL OR story_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS story_versions_sub_no_key
  ON story_versions (submission_id, version_number) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS story_versions_story_idx ON story_versions (story_id, version_number);

-- ---- judging -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS review_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  judge_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  due_at        timestamptz,
  status        text NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned', 'in_progress', 'completed', 'declined', 'revoked')),
  conflict_flag boolean NOT NULL DEFAULT false,
  conflict_note text NOT NULL DEFAULT '',
  completed_at  timestamptz,
  UNIQUE (submission_id, judge_id)
);
CREATE INDEX IF NOT EXISTS review_assignments_judge_idx ON review_assignments (judge_id, status);

CREATE TABLE IF NOT EXISTS reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  uuid NOT NULL UNIQUE REFERENCES review_assignments(id) ON DELETE CASCADE,
  rubric_id      uuid REFERENCES rubrics(id) ON DELETE SET NULL,
  total_score    numeric(7,2),
  max_score      numeric(7,2),
  comments       text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  recommendation text CHECK (recommendation IN ('shortlist', 'maybe', 'reject')),
  submitted_at   timestamptz,
  -- Scoring locks on final submission; only an admin may unlock.
  locked_at      timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  score        numeric(6,2) NOT NULL,
  comment      text NOT NULL DEFAULT '',
  UNIQUE (review_id, criterion_id)
);

-- ---- mentorship & editorial ------------------------------------------------------

CREATE TABLE IF NOT EXISTS mentorships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  story_id      uuid REFERENCES stories(id) ON DELETE SET NULL,
  goal          text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS mentorships_mentor_idx ON mentorships (mentor_id, status);
CREATE INDEX IF NOT EXISTS mentorships_writer_idx ON mentorships (writer_id, status);

CREATE TABLE IF NOT EXISTS mentorship_milestones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id uuid NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  due_at        timestamptz,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  completed_at  timestamptz,
  sort_order    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS milestones_mentorship_idx ON mentorship_milestones (mentorship_id, sort_order);

CREATE TABLE IF NOT EXISTS feedback_threads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    uuid REFERENCES submissions(id) ON DELETE CASCADE,
  story_id         uuid REFERENCES stories(id) ON DELETE CASCADE,
  story_version_id uuid REFERENCES story_versions(id) ON DELETE SET NULL,
  subject          text NOT NULL DEFAULT '',
  -- 'internal' threads are never shown to the writer.
  visibility       text NOT NULL DEFAULT 'writer'
                     CHECK (visibility IN ('writer', 'internal')),
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_threads_sub_idx ON feedback_threads (submission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES feedback_threads(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_messages_thread_idx ON feedback_messages (thread_id, created_at);

-- ---- publication, archive, rights -------------------------------------------------

CREATE TABLE IF NOT EXISTS publications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  publication_type text NOT NULL CHECK (publication_type IN
                     ('anthology', 'digital', 'print', 'audio', 'educational', 'other')),
  title            text NOT NULL DEFAULT '',
  edition          text,
  publisher        text,
  isbn             text,
  reference        text,
  publication_date date,
  url              text,
  royalty_notes    text NOT NULL DEFAULT '',
  cover_file_id    uuid REFERENCES files(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publications_story_idx ON publications (story_id);

CREATE TABLE IF NOT EXISTS archive_metadata (
  story_id         uuid PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  country          text,
  region           text,
  language         text,
  genre            text,
  themes           text[] NOT NULL DEFAULT '{}',
  keywords         text[] NOT NULL DEFAULT '{}',
  age_band         text,
  cultural_context text NOT NULL DEFAULT '',
  edition          text,
  year             integer,
  -- Publication status and archive visibility are deliberately independent: a
  -- published story can still be metadata-only in the public archive.
  visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN
                     ('private', 'internal', 'partner', 'public_excerpt', 'public_full')),
  featured         boolean NOT NULL DEFAULT false,
  adaptation_ready boolean NOT NULL DEFAULT false,
  adaptation_notes text NOT NULL DEFAULT '',
  search_vector    tsvector,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS archive_search_idx ON archive_metadata USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS archive_visibility_idx ON archive_metadata (visibility, featured);
CREATE INDEX IF NOT EXISTS archive_facets_idx ON archive_metadata (country, language, genre, year);
CREATE INDEX IF NOT EXISTS archive_themes_idx ON archive_metadata USING GIN (themes);

CREATE TABLE IF NOT EXISTS rights_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  -- Ownership stays with the creator by default; DPGLF records the licence it
  -- holds. Publication never mutates this on its own.
  owner_name       text NOT NULL DEFAULT '',
  ownership_note   text NOT NULL DEFAULT 'Author retains copyright',
  licence_type     text CHECK (licence_type IN
                     ('none', 'anthology', 'non_exclusive', 'exclusive', 'option', 'educational')),
  territory        text,
  term_start       date,
  term_end         date,
  restrictions     text NOT NULL DEFAULT '',
  document_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  notes            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rights_story_idx ON rights_records (story_id, status);

CREATE TABLE IF NOT EXISTS adaptation_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id        uuid REFERENCES stories(id) ON DELETE SET NULL,
  organisation_id uuid REFERENCES organisations(id) ON DELETE SET NULL,
  requester_name  text NOT NULL,
  requester_email text NOT NULL,
  requester_role  text,
  format          text,
  message         text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'in_review', 'approved', 'declined', 'closed')),
  response_note   text NOT NULL DEFAULT '',
  handled_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  handled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON adaptation_inquiries (status, created_at DESC);

-- ---- notifications ---------------------------------------------------------------

-- One row per intended message, written BEFORE dispatch. `dedupe_key` makes
-- retries idempotent: a replayed trigger conflicts instead of double-sending.
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  to_email   text,
  type       text NOT NULL,
  channel    text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),
  subject    text NOT NULL DEFAULT '',
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz,
  read_at    timestamptz,
  attempts   integer NOT NULL DEFAULT 0,
  last_error text,
  -- When a sender last took the row; stops the retry pass re-sending a message
  -- another request is still delivering.
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unsent_idx ON notifications (sent_at) WHERE sent_at IS NULL;

-- ---- audit -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (entity_type, entity_id);

-- ---- content (CMS-lite) -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS news_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  excerpt       text NOT NULL DEFAULT '',
  body_html     text NOT NULL DEFAULT '',
  cover_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  -- Describes the picture for screen readers (and shows if it fails to load).
  cover_alt     text NOT NULL DEFAULT '',
  tags          text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at  timestamptz,
  author_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_published_idx ON news_posts (status, published_at DESC);

-- Policies and other editable static pages. `version` increments on every save
-- so a submission can record which rules text the writer actually accepted.
CREATE TABLE IF NOT EXISTS pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  title      text NOT NULL,
  summary    text NOT NULL DEFAULT '',
  body_html  text NOT NULL DEFAULT '',
  kind       text NOT NULL DEFAULT 'policy' CHECK (kind IN ('policy', 'page')),
  status     text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  version    integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  name           text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  source         text NOT NULL DEFAULT 'site',
  token_hash     text,
  confirmed_at   timestamptz,
  unsubscribed_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_email_key ON newsletter_subscribers (lower(email));

CREATE TABLE IF NOT EXISTS contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text NOT NULL,
  organisation text NOT NULL DEFAULT '',
  topic        text NOT NULL DEFAULT 'general',
  subject      text NOT NULL DEFAULT '',
  message      text NOT NULL,
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled', 'spam')),
  handled_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  handled_at   timestamptz,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_status_idx ON contact_messages (status, created_at DESC);

-- ---- infrastructure ----------------------------------------------------------------

-- Fixed-window counters for auth/contact/submission endpoints. Cheap and
-- adequate at Foundation scale; swap for a KV store if traffic outgrows it.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       text NOT NULL,
  subject      text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Outbound queue for the Emoworld Publishers handoff. A story approved for
-- publication is enqueued here; a worker drains it. Kept as a queue rather than
-- a direct call so the publication decision never depends on a remote service.
CREATE TABLE IF NOT EXISTS emoworld_sync_queue (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  remote_id  text,
  attempts   integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz,
  -- When the drain took the row; a 'sending' row older than the claim window
  -- belonged to a run that died, and is picked up again.
  claimed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS emoworld_sync_story_key
  ON emoworld_sync_queue (story_id) WHERE status <> 'cancelled';

-- ---- search vector maintenance --------------------------------------------------------

-- Keeps archive_metadata.search_vector in step with the story it describes.
-- Weighted so a title match outranks a keyword match, which outranks body text.
CREATE OR REPLACE FUNCTION archive_refresh_search(p_story_id uuid) RETURNS void AS $$
BEGIN
  UPDATE archive_metadata am
     SET search_vector =
           setweight(to_tsvector('english', coalesce(s.title, '')), 'A') ||
           -- The byline the archive shows: a pen name must not be searchable
           -- by the real name it stands in for.
           setweight(to_tsvector('english',
             coalesce(NULLIF(p.pen_name, ''), NULLIF(p.display_name, ''), '')), 'B') ||
           setweight(to_tsvector('english', array_to_string(am.keywords, ' ')), 'B') ||
           setweight(to_tsvector('english', array_to_string(am.themes, ' ')), 'C') ||
           setweight(to_tsvector('english', coalesce(s.synopsis, '')), 'C') ||
           setweight(to_tsvector('english',
             CASE WHEN am.visibility = 'public_full'
                  THEN left(regexp_replace(coalesce(s.body_html, ''), '<[^>]+>', ' ', 'g'), 200000)
                  ELSE '' END), 'D'),
         updated_at = now()
   FROM stories s
   LEFT JOIN profiles p ON p.user_id = s.author_id
  WHERE am.story_id = p_story_id AND s.id = p_story_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION archive_search_trigger() RETURNS trigger AS $$
BEGIN
  PERFORM archive_refresh_search(NEW.story_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS archive_metadata_search ON archive_metadata;
CREATE TRIGGER archive_metadata_search
  AFTER INSERT OR UPDATE OF keywords, themes, visibility ON archive_metadata
  FOR EACH ROW EXECUTE FUNCTION archive_search_trigger();

CREATE OR REPLACE FUNCTION stories_search_trigger() RETURNS trigger AS $$
BEGIN
  PERFORM archive_refresh_search(NEW.id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stories_search ON stories;
CREATE TRIGGER stories_search
  AFTER UPDATE OF title, synopsis, body_html ON stories
  FOR EACH ROW EXECUTE FUNCTION stories_search_trigger();

-- A byline change (pen name added, display name edited) re-indexes that author's stories.
CREATE OR REPLACE FUNCTION profiles_search_trigger() RETURNS trigger AS $$
BEGIN
  PERFORM archive_refresh_search(s.id) FROM stories s WHERE s.author_id = NEW.user_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_search ON profiles;
CREATE TRIGGER profiles_search
  AFTER UPDATE OF display_name, pen_name ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_search_trigger();

-- Backfill for the pen-name change above: stories whose byline is a pen name
-- were indexed under the real display name. Only pen-name stories are
-- re-indexed (a handful), so repeating this on every db:push stays cheap.
SELECT archive_refresh_search(am.story_id)
  FROM archive_metadata am
  JOIN stories s  ON s.id = am.story_id
  JOIN profiles p ON p.user_id = s.author_id
 WHERE NULLIF(p.pen_name, '') IS NOT NULL
   AND p.pen_name IS DISTINCT FROM p.display_name;

-- ---- additive columns --------------------------------------------------------------------
-- Columns added after first deploy. The CREATE TABLE definitions above already
-- include them for a fresh database; these bring an existing one level.

ALTER TABLE refresh_tokens      ADD COLUMN IF NOT EXISTS rotated_at timestamptz;
ALTER TABLE notifications       ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE emoworld_sync_queue ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE news_posts          ADD COLUMN IF NOT EXISTS cover_alt text NOT NULL DEFAULT '';
