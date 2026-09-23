'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getSessionUser, type SessionUser } from '@/lib/auth';
import { SITE } from '@/lib/brand';
import { randomToken, referenceCode, sha256Hex } from '@/lib/crypto';
import { query, queryOne, tx } from '@/lib/db';
import { abs, templates } from '@/lib/email';
import { countWords, formatDateTime } from '@/lib/format';
import { UploadError, discardFile, extractText, storeFile, validateManuscript } from '@/lib/files';
import { notify } from '@/lib/notify';
import { hasRole, isStaff, submissionAccess } from '@/lib/permissions';
import { rateLimit } from '@/lib/ratelimit';
import { declarationsSchema, guardianConsentSchema, submissionMetaSchema } from '@/lib/validation';
import { bool, fail, invalid, ok, str, strList, type ActionState } from '@/lib/actions';
import { submissionDetail, type SubmissionDetail } from './queries';
import { submissionBlockers, withinAgeLimits } from './rules';
import { applyTransition } from '@/features/workflow/transition';
import { canTransition } from '@/lib/workflow';

/**
 * The submission wizard's server side.
 *
 * Each step is a separate action against a persisted DRAFT, so a writer can
 * leave and come back — losing a nearly-finished entry to a closed laptop is
 * exactly the failure the Foundation is trying to design out. The final
 * `submitAction` is the only one that changes status, and it re-checks every
 * precondition rather than trusting the wizard's own progress.
 */

type Loaded =
  | { ok: false; error: ActionState }
  | { ok: true; user: SessionUser; submission: SubmissionDetail };

async function loadEditable(submissionId: string): Promise<Loaded> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: fail('Please sign in again.') };
  const access = await submissionAccess(user, submissionId);
  if (!access.view) return { ok: false, error: fail('That submission could not be found.') };
  if (!access.edit) {
    return {
      ok: false,
      error: fail('This entry can no longer be edited. Contact the Foundation if you need it reopened.'),
    };
  }
  const submission = await submissionDetail(submissionId);
  if (!submission) return { ok: false, error: fail('That submission could not be found.') };
  return { ok: true, user, submission };
}

// ---- step 1: choose a competition ---------------------------------------------

export async function startSubmissionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');

  const competitionId = str(form, 'competitionId');
  if (!competitionId) return fail('Choose a competition to enter.');

  const limit = await rateLimit('submission', user.userId);
  if (!limit.ok) return fail('Too many attempts. Please wait a few minutes.');

  const competition = await queryOne<{
    id: string;
    name: string;
    status: string;
    closes_at: string | null;
    max_entries: number;
    rules_version: string;
    min_age: number | null;
    max_age: number | null;
  }>(
    `SELECT id, name, status, closes_at, max_entries, rules_version, min_age, max_age
       FROM competitions WHERE id = $1`,
    [competitionId],
  );
  if (!competition) return fail('That competition could not be found.');
  if (competition.status !== 'open') return fail('That competition is not open for entries.');
  if (competition.closes_at && new Date(competition.closes_at) < new Date()) {
    return fail('That competition has closed.');
  }

  if (competition.min_age !== null || competition.max_age !== null) {
    // Age on the closing date: the limit applies to the edition, not the day
    // the draft happened to be started.
    const writer = await queryOne<{ age_band: string | null; age: number | null; drift: number }>(
      `SELECT age_band,
              date_part('year', age(COALESCE($2::timestamptz, now()), date_of_birth))::int AS age,
              GREATEST(0, ceil(extract(epoch FROM (COALESCE($2::timestamptz, now()) - created_at)) / 31557600))::int AS drift
         FROM profiles WHERE user_id = $1`,
      [user.userId, competition.closes_at],
    );
    const fits = withinAgeLimits(
      { age: writer?.age ?? null, ageBand: writer?.age_band ?? null, drift: writer?.drift ?? 0 },
      competition.min_age,
      competition.max_age,
    );
    if (!fits) {
      const range =
        competition.min_age !== null && competition.max_age !== null
          ? `aged ${competition.min_age}–${competition.max_age}`
          : competition.max_age !== null
            ? `aged ${competition.max_age} or under`
            : `aged ${competition.min_age} or over`;
      return fail(
        `${competition.name} is for writers ${range}. If the age group on your account is wrong, contact the Foundation and we will correct it.`,
      );
    }
  }

  const existing = await queryOne<{ n: string; draft_id: string | null }>(
    `SELECT count(*)::text AS n,
            (SELECT id::text FROM submissions
              WHERE writer_id = $1 AND competition_id = $2 AND status = 'DRAFT'
              ORDER BY created_at DESC LIMIT 1) AS draft_id
       FROM submissions
      WHERE writer_id = $1 AND competition_id = $2 AND status <> 'WITHDRAWN'`,
    [user.userId, competition.id],
  );
  // Send the writer back to the draft they already have rather than making a second one.
  if (existing?.draft_id) redirect(`/dashboard/submissions/${existing.draft_id}/edit`);
  if (Number(existing?.n ?? 0) >= competition.max_entries) {
    return fail(
      `You have already used your ${competition.max_entries} entr${competition.max_entries === 1 ? 'y' : 'ies'} for ${competition.name}.`,
    );
  }

  const created = await queryOne<{ id: string }>(
    `INSERT INTO submissions (writer_id, competition_id, rules_version) VALUES ($1, $2, $3) RETURNING id`,
    [user.userId, competition.id, competition.rules_version],
  );
  if (!created) return fail('The entry could not be started. Please try again.');

  await audit({
    actorId: user.userId,
    action: 'submission.draft_created',
    entityType: 'submission',
    entityId: created.id,
    metadata: { competition: competition.name },
  });
  redirect(`/dashboard/submissions/${created.id}/edit`);
}

// ---- step 2: story metadata ------------------------------------------------------

export async function saveMetaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const loaded = await loadEditable(str(form, 'submissionId'));
  if (!loaded.ok) return loaded.error;

  const parsed = submissionMetaSchema.safeParse({
    title: str(form, 'title'),
    synopsis: str(form, 'synopsis'),
    language: str(form, 'language') || 'English',
    genre: str(form, 'genre'),
    themes: strList(form, 'themes'),
    culturalContext: str(form, 'culturalContext'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  await query(
    `UPDATE submissions
        SET title = $2, synopsis = $3, language = $4, genre = $5, themes = $6,
            cultural_context = $7, updated_at = now()
      WHERE id = $1`,
    [loaded.submission.id, d.title, d.synopsis, d.language, d.genre || null, d.themes ?? [], d.culturalContext ?? ''],
  );

  revalidatePath(`/dashboard/submissions/${loaded.submission.id}/edit`);
  return ok('Story details saved.');
}

// ---- step 3: manuscript upload -----------------------------------------------------

export async function uploadManuscriptAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const loaded = await loadEditable(str(form, 'submissionId'));
  if (!loaded.ok) return loaded.error;
  const { user, submission } = loaded;

  const limit = await rateLimit('upload', user.userId);
  if (!limit.ok) return fail('Too many uploads. Please wait a few minutes.');

  const file = form.get('manuscript');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a manuscript file to upload.');

  try {
    validateManuscript({ type: file.type, size: file.size, name: file.name });
  } catch (e) {
    return fail((e as UploadError).message);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buffer, file.type);
  const words = countWords(text);

  // A word count of zero means we could not read the file — a scanned PDF, for
  // example. Accept it rather than blocking the entry, but say so plainly so an
  // administrator checks it during the eligibility review.
  if (words > 0 && (words < submission.word_min || words > submission.word_max)) {
    return fail(
      `That manuscript is ${words.toLocaleString()} words. ${submission.competition_name} accepts ${submission.word_min.toLocaleString()}–${submission.word_max.toLocaleString()} words.`,
    );
  }

  let stored;
  try {
    stored = await storeFile({
      buffer,
      originalName: file.name,
      mimeType: file.type,
      ownerId: user.userId,
      purpose: 'manuscript',
    });
  } catch (e) {
    console.error(`[submission:upload] ${(e as Error).message}`);
    return fail(
      e instanceof UploadError ? e.message : 'The upload failed. Please check your connection and try again.',
    );
  }

  try {
    await tx(async (q) => {
      await q(
        `UPDATE submissions
            SET file_id = $2, extracted_text = $3, word_count = $4, updated_at = now()
          WHERE id = $1`,
        [submission.id, stored.id, text.slice(0, 500_000), words || null],
      );
      // Version 1 is the manuscript as submitted. Later revisions add rows; this
      // one is never overwritten.
      await q(
        `INSERT INTO story_versions (submission_id, version_number, file_id, extracted_text, word_count, change_note, created_by)
         VALUES ($1, 1, $2, $3, $4, 'Original submission', $5)
         -- The unique index is partial (WHERE submission_id IS NOT NULL), so the
         -- predicate has to be repeated here for Postgres to infer it.
         ON CONFLICT (submission_id, version_number) WHERE submission_id IS NOT NULL
         DO UPDATE SET file_id = EXCLUDED.file_id,
                       extracted_text = EXCLUDED.extracted_text,
                       word_count = EXCLUDED.word_count,
                       created_at = now()`,
        [submission.id, stored.id, text.slice(0, 500_000), words || null, user.userId],
      );
    });
  } catch (e) {
    // The object is already in R2 and registered in `files`, but nothing now
    // points at it. Clean both up rather than accumulating orphans.
    console.error(`[submission:upload:tx] ${(e as Error).message}`);
    await discardFile(stored.id).catch(() => {});
    return fail('The upload could not be saved. Please try again.');
  }

  revalidatePath(`/dashboard/submissions/${submission.id}/edit`);
  return ok(
    words > 0
      ? `Manuscript uploaded: ${words.toLocaleString()} words.`
      : 'Manuscript uploaded. We could not read the text automatically, so an administrator will check the length.',
  );
}

// ---- step 4: guardian consent -------------------------------------------------------

export async function requestConsentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const loaded = await loadEditable(str(form, 'submissionId'));
  if (!loaded.ok) return loaded.error;
  const { user, submission } = loaded;

  // Each request emails an address the writer typed in, so it is capped like
  // any other outbound form.
  const limit = await rateLimit('consent', user.userId);
  if (!limit.ok) return fail('Too many consent requests. Please wait a while before sending another.');

  const parsed = guardianConsentSchema.safeParse({
    guardianName: str(form, 'guardianName'),
    guardianEmail: str(form, 'guardianEmail'),
    guardianPhone: str(form, 'guardianPhone'),
    relationship: str(form, 'relationship'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const token = randomToken(24);
  const consent = await queryOne<{ id: string }>(
    `INSERT INTO guardian_consents
       (user_id, guardian_name, guardian_email, guardian_phone, relationship, consent_version, token_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      user.userId,
      d.guardianName,
      d.guardianEmail,
      d.guardianPhone ?? '',
      d.relationship,
      submission.rules_version,
      await sha256Hex(token),
    ],
  );
  if (!consent) return fail('The consent request could not be created. Please try again.');

  await query(`UPDATE submissions SET consent_id = $2, updated_at = now() WHERE id = $1`, [
    submission.id,
    consent.id,
  ]);

  const t = templates.guardianConsent({
    guardian: d.guardianName,
    writer: user.name || 'A young writer',
    competition: submission.competition_name,
    link: abs(`/consent/${token}`),
  });
  await notify({
    toEmail: d.guardianEmail,
    type: 'guardian_consent_request',
    subject: t.subject,
    html: t.html,
    dedupeKey: `consent:${consent.id}`,
  });

  await audit({
    actorId: user.userId,
    action: 'consent.requested',
    entityType: 'guardian_consent',
    entityId: consent.id,
    metadata: { submissionId: submission.id },
  });

  revalidatePath(`/dashboard/submissions/${submission.id}/edit`);
  return ok(`Consent request sent to ${d.guardianEmail}.`);
}

// ---- step 5: declarations and submit ---------------------------------------------------

export async function submitAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const loaded = await loadEditable(str(form, 'submissionId'));
  if (!loaded.ok) return loaded.error;
  const { user, submission } = loaded;

  const parsed = declarationsSchema.safeParse({
    original: bool(form, 'original'),
    ownsCopyright: bool(form, 'ownsCopyright'),
    permissions: bool(form, 'permissions'),
    acceptsRules: bool(form, 'acceptsRules'),
  });
  if (!parsed.success) return invalid(parsed.error);

  // Re-check every precondition here. The wizard's step indicators are a guide
  // for the writer; this is the gate.
  const problems = submissionBlockers(submission);
  if (problems.length > 0) return fail(problems[0]);

  const verified = await queryOne<{ email_verified_at: string | null }>(
    `SELECT email_verified_at FROM users WHERE id = $1`,
    [user.userId],
  );
  if (!verified?.email_verified_at) {
    return fail('Please confirm your email address before submitting. Check your inbox for the link.');
  }

  const year = new Date().getFullYear();
  const prefix = submission.competition_slug
    .split('-')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'DPG';

  const result = await tx(async (q) => {
    // Reference generation retries on the (astronomically unlikely) collision
    // rather than failing the writer's submission.
    let reference = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = referenceCode(prefix, year);
      const clash = await q<{ id: string }>(`SELECT id FROM submissions WHERE reference = $1`, [candidate]);
      if (clash.length === 0) {
        reference = candidate;
        break;
      }
    }
    if (!reference) throw new Error('could not allocate a submission reference');

    const [row] = await q<{ id: string; submitted_at: string }>(
      `UPDATE submissions
          SET status = 'SUBMITTED',
              reference = $2,
              declarations = $3,
              anon_label = $4,
              submitted_at = now(),
              updated_at = now()
        WHERE id = $1 AND status = 'DRAFT'
        RETURNING id, submitted_at`,
      [
        submission.id,
        reference,
        JSON.stringify({
          ...parsed.data,
          rulesVersion: submission.rules_version,
          acceptedAt: new Date().toISOString(),
        }),
        // Judges in a blind round see this instead of the writer's name.
        `Entry ${reference.split('-').pop()}`,
      ],
    );
    if (!row) throw new Error('this entry has already been submitted');

    await q(
      `INSERT INTO submission_events (submission_id, from_status, to_status, actor_id, note)
       VALUES ($1, 'DRAFT', 'SUBMITTED', $2, 'Submitted by the writer')`,
      [submission.id, user.userId],
    );
    return { reference, submittedAt: row.submitted_at };
  }).catch((e: Error) => ({ error: e.message }) as const);

  if ('error' in result) {
    return fail(
      result.error === 'this entry has already been submitted'
        ? 'This entry has already been submitted.'
        : 'The submission could not be completed. Please try again.',
    );
  }

  const receipt = templates.submissionReceipt({
    name: user.name,
    title: submission.title,
    reference: result.reference,
    competition: submission.competition_name,
    submittedAt: formatDateTime(result.submittedAt),
    link: abs(`/dashboard/submissions/${submission.id}`),
  });
  await notify({
    userId: user.userId,
    toEmail: submission.writer_email,
    type: 'submission_receipt',
    subject: receipt.subject,
    html: receipt.html,
    dedupeKey: `submission_receipt:${submission.id}`,
  });
  // The guardian gets a copy of the receipt for a minor's entry.
  if (submission.consent_guardian_email) {
    await notify({
      toEmail: submission.consent_guardian_email,
      type: 'submission_receipt_guardian',
      subject: receipt.subject,
      html: receipt.html,
      dedupeKey: `submission_receipt_guardian:${submission.id}`,
    });
  }

  const alert = templates.adminAlert({
    title: `New submission: ${submission.title}`,
    body: '',
    lines: [
      ['Reference', result.reference],
      ['Programme', submission.competition_name],
      ['Writer', submission.writer_name],
      ['Words', submission.word_count ? String(submission.word_count) : 'not counted'],
    ],
    link: abs(`/dashboard/admin/submissions/${submission.id}`),
  });
  await notify({
    toEmail: SITE.inbox,
    type: 'submission_admin_alert',
    subject: alert.subject,
    html: alert.html,
    dedupeKey: `submission_admin:${submission.id}`,
  });

  await audit({
    actorId: user.userId,
    action: 'submission.submitted',
    entityType: 'submission',
    entityId: submission.id,
    metadata: { reference: result.reference },
  });

  redirect(`/dashboard/submissions/${submission.id}?submitted=1`);
}

// ---- withdraw --------------------------------------------------------------------------

export async function withdrawAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');
  const submissionId = str(form, 'submissionId');

  const access = await submissionAccess(user, submissionId);
  if (!access.view) return fail('That submission could not be found.');

  const submission = await submissionDetail(submissionId);
  if (!submission) return fail('That submission could not be found.');
  if (submission.writer_id !== user.userId) return fail('Only the writer can withdraw their entry.');
  // The transition table decides, as the writer (not as any staff role they may
  // also hold): once judging has begun, withdrawal goes through the Foundation.
  if (!canTransition(submission.status, 'WITHDRAWN', { roles: [], isOwner: true })) {
    return fail('This entry can no longer be withdrawn here. Please contact the Foundation.');
  }

  const moved = await tx((q) =>
    applyTransition(q, {
      submissionId,
      from: submission.status,
      to: 'WITHDRAWN',
      actorId: user.userId,
      note: 'Withdrawn by the writer',
    }),
  );
  if (!moved) return fail('This entry changed while you were working. Reload the page and try again.');

  await audit({
    actorId: user.userId,
    action: 'submission.withdrawn',
    entityType: 'submission',
    entityId: submissionId,
  });
  revalidatePath(`/dashboard/submissions/${submissionId}`);
  return ok('Your entry has been withdrawn.');
}

/** Upload a revised manuscript during mentorship or editorial. */
export async function uploadRevisionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');
  const submissionId = str(form, 'submissionId');

  const access = await submissionAccess(user, submissionId);
  if (!access.view) return fail('That submission could not be found.');

  const submission = await submissionDetail(submissionId);
  if (!submission) return fail('That submission could not be found.');
  // The writer and the Foundation's staff revise; judges and mentors read.
  if (submission.writer_id !== user.userId && !isStaff(user) && !hasRole(user, 'editor')) {
    return fail('Only the writer or the Foundation can upload a revision.');
  }
  // Revisions belong to the development stages, not to an entry still in judging.
  if (!['SHORTLISTED', 'MENTORSHIP', 'EDITORIAL'].includes(submission.status)) {
    return fail('Revisions can only be uploaded once a story has reached mentorship or editorial.');
  }

  const file = form.get('manuscript');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a file to upload.');
  try {
    validateManuscript({ type: file.type, size: file.size, name: file.name });
  } catch (e) {
    return fail((e as UploadError).message);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buffer, file.type);
  const stored = await storeFile({
    buffer,
    originalName: file.name,
    mimeType: file.type,
    ownerId: user.userId,
    purpose: 'revision',
  }).catch((e: Error) => {
    console.error(`[revision:upload] ${e.message}`);
    return null;
  });
  if (!stored) return fail('The upload failed. Please try again.');

  let version: number;
  try {
    version = await tx(async (q) => {
      // Lock the submission row so two simultaneous uploads number their
      // versions one after the other instead of both claiming the same number.
      await q(`SELECT id FROM submissions WHERE id = $1 FOR UPDATE`, [submissionId]);
      const [row] = await q<{ n: number }>(
        `INSERT INTO story_versions
           (submission_id, version_number, file_id, extracted_text, word_count, change_note, created_by)
         SELECT $1, COALESCE(max(version_number), 0) + 1, $2, $3, $4, $5, $6
           FROM story_versions WHERE submission_id = $1
         RETURNING version_number AS n`,
        [
          submissionId,
          stored.id,
          text.slice(0, 500_000),
          countWords(text) || null,
          str(form, 'changeNote').slice(0, 500),
          user.userId,
        ],
      );
      return row.n;
    });
  } catch (e) {
    console.error(`[revision:upload:tx] ${(e as Error).message}`);
    await discardFile(stored.id).catch(() => {});
    return fail('The revision could not be saved. Please try again.');
  }

  await audit({
    actorId: user.userId,
    action: 'submission.revision_uploaded',
    entityType: 'submission',
    entityId: submissionId,
    metadata: { version },
  });
  revalidatePath(`/dashboard/submissions/${submissionId}`);
  return ok(`Version ${version} uploaded.`);
}
