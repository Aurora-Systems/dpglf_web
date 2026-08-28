'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth';
import { query, queryOne, tx } from '@/lib/db';
import { slugify } from '@/lib/format';
import { isStaff, isSuperAdmin } from '@/lib/access';
import { sanitizeRichText, textToHtml } from '@/lib/richtext';
import { pruneRateLimits } from '@/lib/ratelimit';
import { retryUnsentNotifications } from '@/lib/notify';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, UploadError, discardFile, storeFile } from '@/lib/files';
import {
  archiveMetaSchema,
  competitionSchema,
  rightsSchema,
  roleUpdateSchema,
  toList,
} from '@/lib/validation';
import { bool, fail, invalid, nullable, ok, str, type ActionState } from '@/lib/actions';
import { drainEmoworldQueue, enqueueStoryForEmoworld } from '@/features/emoworld/sync';
import { isRole, type Role } from '@/lib/roles';

/** Staff-only mutations. Every one of them audits. */

async function staff(): Promise<{ error: ActionState } | { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> }> {
  const user = await getSessionUser();
  if (!user) return { error: fail('Please sign in again.') };
  if (!isStaff(user)) return { error: fail('You do not have permission to do that.') };
  return { user };
}

// ---- competitions ------------------------------------------------------------------

export async function saveCompetitionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const id = str(form, 'id');
  const parsed = competitionSchema.safeParse({
    name: str(form, 'name'),
    slug: str(form, 'slug') || slugify(str(form, 'name'), 'competition'),
    tagline: str(form, 'tagline'),
    description: str(form, 'description'),
    rulesHtml: str(form, 'rulesHtml'),
    eligibilityHtml: str(form, 'eligibilityHtml'),
    themes: str(form, 'themes'),
    countries: str(form, 'countries'),
    minAge: str(form, 'minAge') || undefined,
    maxAge: str(form, 'maxAge') || undefined,
    wordMin: str(form, 'wordMin') || 500,
    wordMax: str(form, 'wordMax') || 3000,
    maxEntries: str(form, 'maxEntries') || 1,
    opensAt: str(form, 'opensAt'),
    closesAt: str(form, 'closesAt'),
    resultsAt: str(form, 'resultsAt'),
    blindJudging: bool(form, 'blindJudging'),
    allowScoreRevision: bool(form, 'allowScoreRevision'),
    requiresGuardianConsent: bool(form, 'requiresGuardianConsent'),
    status: str(form, 'status') || 'draft',
    rubricId: str(form, 'rubricId'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.wordMax < d.wordMin) return fail('The maximum word count must be above the minimum.');

  // Changing the rules after entries have opened must not silently rewrite what
  // earlier entrants agreed to — bump the version instead.
  const previous = id
    ? await queryOne<{ rules_html: string; rules_version: string }>(
        `SELECT rules_html, rules_version FROM competitions WHERE id = $1`,
        [id],
      )
    : null;
  // Compare sanitised-to-sanitised. Rules seeded or imported as raw HTML are
  // not in canonical form, and comparing raw-to-sanitised would bump the version
  // on the first save that changed nothing meaningful.
  const rulesChanged = Boolean(
    previous && sanitizeRichText(previous.rules_html) !== sanitizeRichText(d.rulesHtml ?? ''),
  );
  const rulesVersion = rulesChanged
    ? `v${Number((previous!.rules_version.match(/\d+/) ?? ['1'])[0]) + 1}`
    : (previous?.rules_version ?? 'v1');

  const values = [
    d.name,
    d.slug,
    d.tagline ?? '',
    d.description ?? '',
    sanitizeRichText(d.rulesHtml ?? ''),
    sanitizeRichText(d.eligibilityHtml ?? ''),
    toList(d.themes ?? ''),
    toList(d.countries ?? '', 60),
    d.minAge ?? null,
    d.maxAge ?? null,
    d.wordMin,
    d.wordMax,
    d.maxEntries,
    nullable(d.opensAt ?? ''),
    nullable(d.closesAt ?? ''),
    nullable(d.resultsAt ?? ''),
    d.blindJudging,
    d.allowScoreRevision,
    d.requiresGuardianConsent,
    d.status,
    nullable(d.rubricId ?? ''),
    rulesVersion,
  ];

  let competitionId = id;
  try {
    if (id) {
      await query(
        `UPDATE competitions SET
            name = $2, slug = $3, tagline = $4, description = $5, rules_html = $6,
            eligibility_html = $7, themes = $8, countries = $9, min_age = $10, max_age = $11,
            word_min = $12, word_max = $13, max_entries = $14,
            opens_at = $15::timestamptz, closes_at = $16::timestamptz, results_at = $17::timestamptz,
            blind_judging = $18, allow_score_revision = $19, requires_guardian_consent = $20,
            status = $21, rubric_id = $22::uuid, rules_version = $23, updated_at = now()
          WHERE id = $1`,
        [id, ...values],
      );
    } else {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO competitions
           (name, slug, tagline, description, rules_html, eligibility_html, themes, countries,
            min_age, max_age, word_min, word_max, max_entries, opens_at, closes_at, results_at,
            blind_judging, allow_score_revision, requires_guardian_consent, status, rubric_id, rules_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz,
                 $16::timestamptz,$17,$18,$19,$20,$21::uuid,$22)
         RETURNING id`,
        values,
      );
      competitionId = row?.id ?? '';
    }
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes('competitions_slug_key')) return fail('That slug is already in use.');
    console.error(`[admin:competition] ${message}`);
    return fail('The competition could not be saved.');
  }

  await audit({
    actorId: guard.user.userId,
    action: id ? 'competition.updated' : 'competition.created',
    entityType: 'competition',
    entityId: competitionId,
    metadata: { slug: d.slug, status: d.status, rulesVersion },
  });

  revalidatePath('/dashboard/admin/competitions');
  revalidatePath(`/programmes/${d.slug}`);
  if (!id) redirect(`/dashboard/admin/competitions/${competitionId}`);
  return ok(rulesChanged ? `Saved. Rules updated to ${rulesVersion}.` : 'Competition saved.');
}

export async function saveRubricAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const name = str(form, 'name');
  if (!name) return fail('Give the rubric a name.');

  const labels = form.getAll('criterionLabel').filter((v): v is string => typeof v === 'string');
  const descriptions = form.getAll('criterionDescription').filter((v): v is string => typeof v === 'string');
  const maxScores = form.getAll('criterionMax').filter((v): v is string => typeof v === 'string');
  const weights = form.getAll('criterionWeight').filter((v): v is string => typeof v === 'string');

  const criteria = labels
    .map((label, i) => ({
      label: label.trim(),
      description: (descriptions[i] ?? '').trim(),
      max: Math.min(100, Math.max(1, Number(maxScores[i] ?? 10) || 10)),
      weight: Math.min(10, Math.max(0.1, Number(weights[i] ?? 1) || 1)),
    }))
    .filter((c) => c.label);
  if (criteria.length === 0) return fail('Add at least one criterion.');

  const rubricId = await tx(async (q) => {
    const [r] = await q<{ id: string }>(
      `INSERT INTO rubrics (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [name, str(form, 'description'), guard.user.userId],
    );
    for (const [i, c] of criteria.entries()) {
      await q(
        `INSERT INTO rubric_criteria (rubric_id, label, description, max_score, weight, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.id, c.label, c.description, c.max, c.weight, i],
      );
    }
    return r.id;
  });

  const competitionId = str(form, 'competitionId');
  if (competitionId) {
    await query(`UPDATE competitions SET rubric_id = $2 WHERE id = $1`, [competitionId, rubricId]);
  }

  await audit({
    actorId: guard.user.userId,
    action: 'rubric.created',
    entityType: 'rubric',
    entityId: rubricId,
    metadata: { criteria: criteria.length, competitionId },
  });

  revalidatePath('/dashboard/admin/competitions');
  return ok(`Rubric saved with ${criteria.length} criteria.`);
}

// ---- eligibility --------------------------------------------------------------------

export async function setEligibilityNoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const submissionId = str(form, 'submissionId');
  const note = str(form, 'note').slice(0, 1000);
  await query(`UPDATE submissions SET eligibility_note = $2, updated_at = now() WHERE id = $1`, [
    submissionId,
    note,
  ]);
  await audit({
    actorId: guard.user.userId,
    action: 'submission.note_updated',
    entityType: 'submission',
    entityId: submissionId,
  });
  revalidatePath(`/dashboard/admin/submissions/${submissionId}`);
  return ok('Note saved.');
}

// ---- stories & archive -----------------------------------------------------------------

/**
 * Promote a submission to a canonical story record.
 *
 * This is the point where an entry stops being "a thing someone submitted" and
 * becomes an asset the Foundation curates: it gets a slug, archive metadata and
 * a rights record. The manuscript text seeds the story body so an editor has
 * something to work from rather than a blank page.
 */
export async function createStoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const submissionId = str(form, 'submissionId');
  const submission = await queryOne<{
    id: string;
    title: string;
    synopsis: string;
    language: string;
    genre: string | null;
    themes: string[];
    word_count: number | null;
    writer_id: string;
    cultural_context: string;
    country: string | null;
    age_band: string | null;
  }>(
    `SELECT s.id, s.title, s.synopsis, s.language, s.genre, s.themes, s.word_count, s.writer_id,
            s.cultural_context, p.country, p.age_band
       FROM submissions s
       LEFT JOIN profiles p ON p.user_id = s.writer_id
      WHERE s.id = $1`,
    [submissionId],
  );
  if (!submission) return fail('That submission could not be found.');

  const existing = await queryOne<{ id: string }>(`SELECT id FROM stories WHERE submission_id = $1`, [
    submissionId,
  ]);
  if (existing) redirect(`/dashboard/admin/stories/${existing.id}`);

  // Latest revision wins — an editor should start from the newest draft.
  const latest = await queryOne<{ extracted_text: string | null }>(
    `SELECT extracted_text FROM story_versions
      WHERE submission_id = $1 ORDER BY version_number DESC LIMIT 1`,
    [submissionId],
  );

  const baseSlug = slugify(submission.title, 'story');
  const storyId = await tx(async (q) => {
    // Slug collisions are resolved by suffixing, not by failing the editor's save.
    let slug = baseSlug;
    for (let i = 2; i < 50; i++) {
      const clash = await q<{ id: string }>(`SELECT id FROM stories WHERE slug = $1`, [slug]);
      if (clash.length === 0) break;
      slug = `${baseSlug}-${i}`;
    }

    const [story] = await q<{ id: string }>(
      `INSERT INTO stories (slug, submission_id, author_id, title, synopsis, body_html, language,
                            genre, themes, word_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'editorial')
       RETURNING id`,
      [
        slug,
        submissionId,
        submission.writer_id,
        submission.title,
        submission.synopsis,
        latest?.extracted_text ? sanitizeRichText(textToHtml(latest.extracted_text)) : null,
        submission.language,
        submission.genre,
        submission.themes,
        submission.word_count,
      ],
    );

    await q(
      `INSERT INTO archive_metadata (story_id, country, language, genre, themes, age_band,
                                     cultural_context, visibility, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'private',$8)
       ON CONFLICT (story_id) DO NOTHING`,
      [
        story.id,
        submission.country,
        submission.language,
        submission.genre,
        submission.themes,
        submission.age_band,
        submission.cultural_context,
        guard.user.userId,
      ],
    );

    // The default rights position: the author owns their story, full stop.
    await q(
      `INSERT INTO rights_records (story_id, owner_name, ownership_note, licence_type, status)
       SELECT $1, u.name, 'Author retains copyright', 'none', 'draft' FROM users u WHERE u.id = $2`,
      [story.id, submission.writer_id],
    );

    return story.id;
  });

  await audit({
    actorId: guard.user.userId,
    action: 'story.created',
    entityType: 'story',
    entityId: storyId,
    metadata: { submissionId },
  });
  redirect(`/dashboard/admin/stories/${storyId}`);
}

export async function saveStoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const storyId = str(form, 'storyId');
  const title = str(form, 'title');
  if (!title) return fail('A story needs a title.');

  await query(
    `UPDATE stories
        SET title = $2, synopsis = $3, excerpt = $4, body_html = $5, language = $6, genre = $7,
            status = $8,
            published_at = CASE WHEN $8::text = 'published' AND published_at IS NULL THEN now()
                                WHEN $8::text <> 'published' THEN NULL ELSE published_at END,
            updated_at = now()
      WHERE id = $1`,
    [
      storyId,
      title,
      str(form, 'synopsis'),
      str(form, 'excerpt') || null,
      sanitizeRichText(str(form, 'bodyHtml')),
      str(form, 'language') || 'English',
      str(form, 'genre') || null,
      str(form, 'status') || 'editorial',
    ],
  );

  await audit({
    actorId: guard.user.userId,
    action: 'story.updated',
    entityType: 'story',
    entityId: storyId,
    metadata: { status: str(form, 'status') },
  });
  revalidatePath(`/dashboard/admin/stories/${storyId}`);
  return ok('Story saved.');
}

/** Attach or replace a story's cover image. Covers are public marketing assets. */
export async function uploadCoverAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const storyId = str(form, 'storyId');
  const file = form.get('cover');
  if (!(file instanceof File) || file.size === 0) return fail('Choose an image to upload.');
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return fail('Covers must be a JPEG, PNG or WebP image.');
  }
  if (file.size > IMAGE_MAX_BYTES) return fail('Covers must be 5 MB or smaller.');

  const story = await queryOne<{ id: string; slug: string; cover_file_id: string | null }>(
    `SELECT id, slug, cover_file_id FROM stories WHERE id = $1`,
    [storyId],
  );
  if (!story) return fail('That story could not be found.');

  let stored;
  try {
    stored = await storeFile({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      mimeType: file.type,
      ownerId: guard.user.userId,
      purpose: 'cover',
      visibility: 'public',
    });
  } catch (e) {
    return fail(e instanceof UploadError ? e.message : 'The upload failed. Please try again.');
  }

  await query(`UPDATE stories SET cover_file_id = $2, updated_at = now() WHERE id = $1`, [
    storyId,
    stored.id,
  ]);
  // The replaced cover is referenced by nothing else — clear it from R2.
  if (story.cover_file_id) await discardFile(story.cover_file_id).catch(() => {});

  await audit({
    actorId: guard.user.userId,
    action: 'story.cover_updated',
    entityType: 'story',
    entityId: storyId,
    metadata: { file: stored.original_name },
  });
  revalidatePath(`/dashboard/admin/stories/${storyId}`);
  revalidatePath(`/archive/${story.slug}`);
  revalidatePath('/archive');
  return ok('Cover updated.');
}

export async function saveArchiveMetaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const parsed = archiveMetaSchema.safeParse({
    storyId: str(form, 'storyId'),
    country: str(form, 'country'),
    region: str(form, 'region'),
    language: str(form, 'language'),
    genre: str(form, 'genre'),
    themes: str(form, 'themes'),
    keywords: str(form, 'keywords'),
    ageBand: str(form, 'ageBand'),
    culturalContext: str(form, 'culturalContext'),
    edition: str(form, 'edition'),
    year: str(form, 'year') || undefined,
    visibility: str(form, 'visibility') || 'private',
    featured: bool(form, 'featured'),
    adaptationReady: bool(form, 'adaptationReady'),
    adaptationNotes: str(form, 'adaptationNotes'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  await query(
    `INSERT INTO archive_metadata
       (story_id, country, region, language, genre, themes, keywords, age_band, cultural_context,
        edition, year, visibility, featured, adaptation_ready, adaptation_notes, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
     ON CONFLICT (story_id) DO UPDATE SET
       country = EXCLUDED.country, region = EXCLUDED.region, language = EXCLUDED.language,
       genre = EXCLUDED.genre, themes = EXCLUDED.themes, keywords = EXCLUDED.keywords,
       age_band = EXCLUDED.age_band, cultural_context = EXCLUDED.cultural_context,
       edition = EXCLUDED.edition, year = EXCLUDED.year, visibility = EXCLUDED.visibility,
       featured = EXCLUDED.featured, adaptation_ready = EXCLUDED.adaptation_ready,
       adaptation_notes = EXCLUDED.adaptation_notes, updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [
      d.storyId,
      d.country || null,
      d.region || null,
      d.language || null,
      d.genre || null,
      toList(d.themes ?? ''),
      toList(d.keywords ?? '', 40),
      d.ageBand || null,
      d.culturalContext ?? '',
      d.edition || null,
      d.year ?? null,
      d.visibility,
      d.featured,
      d.adaptationReady,
      d.adaptationNotes ?? '',
      guard.user.userId,
    ],
  );

  await audit({
    actorId: guard.user.userId,
    action: 'archive.metadata_updated',
    entityType: 'story',
    entityId: d.storyId,
    metadata: { visibility: d.visibility, adaptationReady: d.adaptationReady },
  });
  revalidatePath(`/dashboard/admin/stories/${d.storyId}`);
  revalidatePath('/archive');
  return ok('Archive record saved.');
}

export async function saveRightsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const parsed = rightsSchema.safeParse({
    storyId: str(form, 'storyId'),
    ownerName: str(form, 'ownerName'),
    ownershipNote: str(form, 'ownershipNote'),
    licenceType: str(form, 'licenceType') || 'none',
    territory: str(form, 'territory'),
    termStart: str(form, 'termStart'),
    termEnd: str(form, 'termEnd'),
    restrictions: str(form, 'restrictions'),
    status: str(form, 'status') || 'draft',
    notes: str(form, 'notes'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const id = str(form, 'rightsId');

  if (id) {
    await query(
      `UPDATE rights_records SET owner_name = $2, ownership_note = $3, licence_type = $4,
              territory = $5, term_start = NULLIF($6,'')::date, term_end = NULLIF($7,'')::date,
              restrictions = $8, status = $9, notes = $10, updated_at = now()
        WHERE id = $1`,
      [
        id,
        d.ownerName ?? '',
        d.ownershipNote ?? '',
        d.licenceType,
        d.territory ?? '',
        d.termStart ?? '',
        d.termEnd ?? '',
        d.restrictions ?? '',
        d.status,
        d.notes ?? '',
      ],
    );
  } else {
    await query(
      `INSERT INTO rights_records (story_id, owner_name, ownership_note, licence_type, territory,
                                   term_start, term_end, restrictions, status, notes)
       VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::date,NULLIF($7,'')::date,$8,$9,$10)`,
      [
        d.storyId,
        d.ownerName ?? '',
        d.ownershipNote ?? '',
        d.licenceType,
        d.territory ?? '',
        d.termStart ?? '',
        d.termEnd ?? '',
        d.restrictions ?? '',
        d.status,
        d.notes ?? '',
      ],
    );
  }

  await audit({
    actorId: guard.user.userId,
    action: 'rights.updated',
    entityType: 'story',
    entityId: d.storyId,
    metadata: { licenceType: d.licenceType, status: d.status },
  });
  revalidatePath(`/dashboard/admin/stories/${d.storyId}`);
  return ok('Rights record saved.');
}

export async function addPublicationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const storyId = str(form, 'storyId');
  const type = str(form, 'publicationType') || 'anthology';
  await query(
    `INSERT INTO publications (story_id, publication_type, title, edition, publisher, isbn,
                               publication_date, url, royalty_notes)
     VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8,$9)`,
    [
      storyId,
      type,
      str(form, 'title'),
      str(form, 'edition') || null,
      str(form, 'publisher') || null,
      str(form, 'isbn') || null,
      str(form, 'publicationDate'),
      str(form, 'url') || null,
      str(form, 'royaltyNotes'),
    ],
  );
  await audit({
    actorId: guard.user.userId,
    action: 'publication.added',
    entityType: 'story',
    entityId: storyId,
    metadata: { type },
  });
  revalidatePath(`/dashboard/admin/stories/${storyId}`);
  return ok('Publication recorded.');
}

// ---- people & roles ----------------------------------------------------------------------

export async function updateRolesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const roles = form.getAll('roles').filter((v): v is string => typeof v === 'string').filter(isRole);
  const parsed = roleUpdateSchema.safeParse({ userId: str(form, 'userId'), roles });
  if (!parsed.success) return invalid(parsed.error);

  // Only a super admin can create another one, or take the role away.
  const target = await queryOne<{ roles: Role[] | null }>(
    `SELECT array_remove(array_agg(role), NULL) AS roles FROM user_roles WHERE user_id = $1`,
    [parsed.data.userId],
  );
  const had = new Set(target?.roles ?? []);
  const wants = new Set(parsed.data.roles);
  if (
    (wants.has('super_admin') !== had.has('super_admin') || (had.has('super_admin') && !wants.has('super_admin'))) &&
    !isSuperAdmin(guard.user)
  ) {
    return fail('Only a super admin can grant or remove the super admin role.');
  }
  // Never let the last super admin remove their own access.
  if (had.has('super_admin') && !wants.has('super_admin')) {
    const remaining = await queryOne<{ n: string }>(
      `SELECT count(*)::text AS n FROM user_roles WHERE role = 'super_admin' AND user_id <> $1`,
      [parsed.data.userId],
    );
    if (Number(remaining?.n ?? 0) === 0) return fail('At least one super admin must remain.');
  }

  await tx(async (q) => {
    await q(`DELETE FROM user_roles WHERE user_id = $1`, [parsed.data.userId]);
    for (const role of parsed.data.roles) {
      await q(
        `INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [parsed.data.userId, role, guard.user.userId],
      );
    }
  });

  await audit({
    actorId: guard.user.userId,
    action: 'user.roles_updated',
    entityType: 'user',
    entityId: parsed.data.userId,
    metadata: { roles: parsed.data.roles },
  });
  revalidatePath('/dashboard/admin/users');
  return ok('Roles updated. The change takes effect when they next sign in or refresh.');
}

export async function setUserStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const userId = str(form, 'userId');
  const status = str(form, 'status');
  if (!['active', 'suspended'].includes(status)) return fail('Unknown status.');
  if (userId === guard.user.userId) return fail('You cannot suspend your own account.');

  await query(`UPDATE users SET status = $2, updated_at = now() WHERE id = $1`, [userId, status]);
  if (status === 'suspended') {
    await query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
  await audit({
    actorId: guard.user.userId,
    action: `user.${status}`,
    entityType: 'user',
    entityId: userId,
  });
  revalidatePath('/dashboard/admin/users');
  return ok(status === 'suspended' ? 'Account suspended and signed out.' : 'Account reactivated.');
}

// ---- inquiries & messages -------------------------------------------------------------------

export async function updateInquiryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const id = str(form, 'inquiryId');
  const status = str(form, 'status');
  if (!['new', 'in_review', 'approved', 'declined', 'closed'].includes(status)) {
    return fail('Unknown status.');
  }
  await query(
    `UPDATE adaptation_inquiries
        SET status = $2, response_note = $3, handled_by = $4, handled_at = now()
      WHERE id = $1`,
    [id, status, str(form, 'responseNote').slice(0, 2000), guard.user.userId],
  );
  await audit({
    actorId: guard.user.userId,
    action: 'inquiry.updated',
    entityType: 'adaptation_inquiry',
    entityId: id,
    metadata: { status },
  });
  revalidatePath('/dashboard/admin/inquiries');
  return ok('Enquiry updated.');
}

export async function updateMessageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const id = str(form, 'messageId');
  const status = str(form, 'status');
  if (!['new', 'handled', 'spam'].includes(status)) return fail('Unknown status.');
  await query(
    `UPDATE contact_messages SET status = $2, handled_by = $3, handled_at = now() WHERE id = $1`,
    [id, status, guard.user.userId],
  );
  revalidatePath('/dashboard/admin/messages');
  return ok('Message updated.');
}

// ---- content -----------------------------------------------------------------------------------

export async function saveNewsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const id = str(form, 'id');
  const title = str(form, 'title');
  if (!title) return fail('Give the post a title.');
  const slug = str(form, 'slug') || slugify(title, 'post');
  const status = str(form, 'status') === 'published' ? 'published' : 'draft';

  const values = [
    slug,
    title,
    str(form, 'excerpt').slice(0, 500),
    sanitizeRichText(str(form, 'bodyHtml')),
    toList(str(form, 'tags'), 10),
    status,
    guard.user.userId,
  ];

  try {
    if (id) {
      await query(
        `UPDATE news_posts SET slug = $2, title = $3, excerpt = $4, body_html = $5, tags = $6,
                status = $7, author_id = $8,
                published_at = CASE WHEN $7::text = 'published' AND published_at IS NULL THEN now()
                                    WHEN $7::text = 'draft' THEN NULL ELSE published_at END,
                updated_at = now()
          WHERE id = $1`,
        [id, ...values],
      );
    } else {
      await query(
        `INSERT INTO news_posts (slug, title, excerpt, body_html, tags, status, author_id, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $6::text = 'published' THEN now() ELSE NULL END)`,
        values,
      );
    }
  } catch (e) {
    if ((e as Error).message.includes('news_posts_slug_key')) return fail('That slug is already in use.');
    return fail('The post could not be saved.');
  }

  await audit({
    actorId: guard.user.userId,
    action: id ? 'news.updated' : 'news.created',
    entityType: 'news_post',
    entityId: id || slug,
    metadata: { status },
  });
  revalidatePath('/dashboard/admin/content');
  revalidatePath('/news');
  return ok(status === 'published' ? 'Published.' : 'Saved as a draft.');
}

export async function savePageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const slug = str(form, 'slug');
  const title = str(form, 'title');
  if (!slug || !title) return fail('A page needs a slug and a title.');

  // Version increments on every save so a submission can point at the exact
  // policy text its writer accepted.
  await query(
    `INSERT INTO pages (slug, title, summary, body_html, kind, status, version, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,1,$7, now())
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title, summary = EXCLUDED.summary, body_html = EXCLUDED.body_html,
       kind = EXCLUDED.kind, status = EXCLUDED.status, version = pages.version + 1,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [
      slug,
      title,
      str(form, 'summary').slice(0, 400),
      sanitizeRichText(str(form, 'bodyHtml')),
      str(form, 'kind') === 'page' ? 'page' : 'policy',
      str(form, 'status') === 'draft' ? 'draft' : 'published',
      guard.user.userId,
    ],
  );

  await audit({
    actorId: guard.user.userId,
    action: 'page.saved',
    entityType: 'page',
    entityId: slug,
  });
  revalidatePath('/dashboard/admin/content');
  revalidatePath(`/policies/${slug}`);
  return ok('Page saved.');
}

// ---- operations -----------------------------------------------------------------------------------

export async function drainEmoworldAction(): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;

  const result = await drainEmoworldQueue();
  await audit({
    actorId: guard.user.userId,
    action: 'emoworld.drain',
    entityType: 'system',
    metadata: { ...result },
  });
  revalidatePath('/dashboard/admin/stories');
  if (result.skipped) return fail(`Handoff is switched off (${result.skipped}).`);
  return ok(`${result.sent} sent, ${result.failed} failed of ${result.attempted} attempted.`);
}

export async function enqueueStoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;
  const storyId = str(form, 'storyId');
  await enqueueStoryForEmoworld(storyId);
  await audit({
    actorId: guard.user.userId,
    action: 'emoworld.enqueued',
    entityType: 'story',
    entityId: storyId,
  });
  revalidatePath(`/dashboard/admin/stories/${storyId}`);
  return ok('Queued for the Emoworld review handoff.');
}

/**
 * Site settings (super-admin only). One setting is live today —
 * `site.announcement`, the banner on the marketing homepage — and the generic
 * editor covers operational keys that arrive later. Every change is audited.
 */
export async function saveSettingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user || !isSuperAdmin(user)) return fail('Only a super admin can change settings.');

  const key = str(form, 'key').slice(0, 120);
  if (!key || !/^[a-z0-9._-]+$/i.test(key)) {
    return fail('Setting keys use letters, numbers, dots, dashes and underscores.');
  }

  const raw = str(form, 'value');
  if (!raw) {
    await query(`DELETE FROM settings WHERE key = $1`, [key]);
    await audit({ actorId: user.userId, action: 'setting.deleted', entityType: 'setting', entityId: key });
    revalidatePath('/dashboard/admin/settings');
    revalidatePath('/');
    return ok(`Setting “${key}” removed.`);
  }

  // Accept either bare text (stored as {"text": ...}) or a JSON document.
  let value: unknown;
  try {
    value = raw.trim().startsWith('{') || raw.trim().startsWith('[') ? JSON.parse(raw) : { text: raw };
  } catch {
    return fail('That is not valid JSON. Enter plain text, or a well-formed JSON document.');
  }

  await query(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), user.userId],
  );
  await audit({ actorId: user.userId, action: 'setting.saved', entityType: 'setting', entityId: key });
  revalidatePath('/dashboard/admin/settings');
  revalidatePath('/');
  return ok(`Setting “${key}” saved.`);
}

export async function retryEmailsAction(): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;
  const result = await retryUnsentNotifications(50);
  await audit({
    actorId: guard.user.userId,
    action: 'notifications.retried',
    entityType: 'system',
    metadata: { ...result },
  });
  revalidatePath('/dashboard/admin/audit');
  if (result.attempted === 0) return ok('Nothing waiting to be retried.');
  return ok(`${result.sent} sent, ${result.failed} still failing of ${result.attempted} attempted.`);
}

export async function pruneAction(): Promise<ActionState> {
  const guard = await staff();
  if ('error' in guard) return guard.error;
  await pruneRateLimits();
  return ok('Old rate-limit counters removed.');
}
