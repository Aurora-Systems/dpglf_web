'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/client';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/form';
import { Alert, Badge, cx } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/roles';
import { VISIBILITY_HELP, VISIBILITY_LABELS } from '@/lib/workflow';
import { FileField } from '@/components/client';
import {
  addPublicationAction,
  createStoryAction,
  uploadCoverAction,
  drainEmoworldAction,
  enqueueStoryAction,
  saveArchiveMetaAction,
  saveCompetitionAction,
  saveNewsAction,
  savePageAction,
  saveRightsAction,
  saveRubricAction,
  saveStoryAction,
  saveSettingAction,
  setEligibilityNoteAction,
  setUserStatusAction,
  updateInquiryAction,
  updateMessageAction,
  updateRolesAction,
} from './actions';
import { assignJudgesAction, unlockReviewAction } from '@/features/judging/actions';
import { toFoundationInput } from '@/lib/format';
import { reopenSubmissionAction } from '@/features/workflow/actions';

/** A timestamptz as an `<input type="datetime-local">` value, in Harare time wherever this renders. */
const dtLocal = toFoundationInput;

// ---- competitions ---------------------------------------------------------------

export function CompetitionForm({
  competition,
  rubrics,
}: {
  competition?: {
    id: string;
    name: string;
    slug: string;
    tagline: string;
    description: string;
    rules_html: string;
    eligibility_html: string;
    themes: string[];
    countries: string[];
    min_age: number | null;
    max_age: number | null;
    word_min: number;
    word_max: number;
    max_entries: number;
    opens_at: string | null;
    closes_at: string | null;
    results_at: string | null;
    blind_judging: boolean;
    allow_score_revision: boolean;
    requires_guardian_consent: boolean;
    status: string;
    rubric_id: string | null;
  };
  rubrics: { id: string; name: string; version: number; criteria: number }[];
}) {
  const [state, action] = useActionState(saveCompetitionAction, IDLE);
  const c = competition;

  return (
    <form action={action} className="space-y-6">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {c && <input type="hidden" name="id" value={c.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" required maxLength={160} defaultValue={c?.name} />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="Used in the public URL. Leave blank to generate one." error={state.errors?.slug}>
          <Input id="slug" name="slug" maxLength={80} defaultValue={c?.slug} pattern="[a-z0-9\-]+" />
        </Field>
      </div>

      <Field label="Tagline" htmlFor="tagline">
        <Input id="tagline" name="tagline" maxLength={200} defaultValue={c?.tagline} />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} maxLength={4000} defaultValue={c?.description} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Opens (Harare time)" htmlFor="opensAt">
          <Input id="opensAt" name="opensAt" type="datetime-local" defaultValue={dtLocal(c?.opens_at)} />
        </Field>
        <Field label="Closes (Harare time)" htmlFor="closesAt">
          <Input id="closesAt" name="closesAt" type="datetime-local" defaultValue={dtLocal(c?.closes_at)} />
        </Field>
        <Field label="Results (Harare time)" htmlFor="resultsAt">
          <Input id="resultsAt" name="resultsAt" type="datetime-local" defaultValue={dtLocal(c?.results_at)} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Minimum words" htmlFor="wordMin" required>
          <Input id="wordMin" name="wordMin" type="number" min={0} required defaultValue={c?.word_min ?? 500} />
        </Field>
        <Field label="Maximum words" htmlFor="wordMax" required>
          <Input id="wordMax" name="wordMax" type="number" min={1} required defaultValue={c?.word_max ?? 3000} />
        </Field>
        <Field label="Entries per writer" htmlFor="maxEntries" required>
          <Input id="maxEntries" name="maxEntries" type="number" min={1} max={20} required defaultValue={c?.max_entries ?? 1} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Minimum age" htmlFor="minAge">
          <Input id="minAge" name="minAge" type="number" min={0} max={120} defaultValue={c?.min_age ?? ''} />
        </Field>
        <Field label="Maximum age" htmlFor="maxAge" hint="Leave blank for no upper limit.">
          <Input id="maxAge" name="maxAge" type="number" min={0} max={120} defaultValue={c?.max_age ?? ''} />
        </Field>
      </div>

      <Field label="Themes" htmlFor="themes" hint="Comma separated. These become the checkboxes writers see.">
        <Textarea id="themes" name="themes" rows={2} defaultValue={c?.themes?.join(', ')} />
      </Field>

      <Field label="Eligible countries" htmlFor="countries" hint="Comma separated. Leave blank for open entry.">
        <Input id="countries" name="countries" defaultValue={c?.countries?.join(', ')} />
      </Field>

      <Field label="Eligibility (HTML)" htmlFor="eligibilityHtml">
        <Textarea id="eligibilityHtml" name="eligibilityHtml" rows={5} defaultValue={c?.eligibility_html} className="font-mono" />
      </Field>

      <Field
        label="Rules (HTML)"
        htmlFor="rulesHtml"
        hint="Changing this after entries open bumps the rules version, so earlier entrants stay bound to what they actually accepted."
      >
        <Textarea id="rulesHtml" name="rulesHtml" rows={8} defaultValue={c?.rules_html} className="font-mono" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status" htmlFor="status" required>
          <Select id="status" name="status" defaultValue={c?.status ?? 'draft'}>
            {['draft', 'open', 'closed', 'judging', 'completed', 'archived'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Judging rubric" htmlFor="rubricId">
          <Select id="rubricId" name="rubricId" defaultValue={c?.rubric_id ?? ''}>
            <option value="">No rubric</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} v{r.version} · {r.criteria} criteria
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-3 rounded-lg bg-parchment p-4">
        <Checkbox
          name="blindJudging"
          defaultChecked={c?.blind_judging ?? true}
          label="Blind judging"
          hint="Judges see an anonymous label instead of the writer’s name."
        />
        <Checkbox
          name="allowScoreRevision"
          defaultChecked={c?.allow_score_revision ?? false}
          label="Judges may revise a submitted score"
          hint="Off means scoring locks on submission and only an admin can reopen it."
        />
        <Checkbox
          name="requiresGuardianConsent"
          defaultChecked={c?.requires_guardian_consent ?? true}
          label="Require guardian consent for under-18 entrants"
        />
      </div>

      <SubmitButton pendingLabel="Saving…">{c ? 'Save competition' : 'Create competition'}</SubmitButton>
    </form>
  );
}

export function RubricForm({ competitionId }: { competitionId?: string }) {
  const [state, action] = useActionState(saveRubricAction, IDLE);
  const [rows, setRows] = useState(4);

  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {competitionId && <input type="hidden" name="competitionId" value={competitionId} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rubric name" htmlFor="rubricName" required>
          <Input id="rubricName" name="name" required maxLength={160} placeholder="Tales from the Baobab 2026" />
        </Field>
        <Field label="Description" htmlFor="rubricDescription">
          <Input id="rubricDescription" name="description" maxLength={400} />
        </Field>
      </div>

      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[1fr_1fr_6rem_6rem]">
            <Field label={`Criterion ${i + 1}`} htmlFor={`criterionLabel-${i}`}>
              <Input
                id={`criterionLabel-${i}`}
                name="criterionLabel"
                maxLength={120}
                placeholder={DEFAULT_CRITERIA[i]?.[0] ?? ''}
              />
            </Field>
            <Field label="What judges look for" htmlFor={`criterionDescription-${i}`}>
              <Input
                id={`criterionDescription-${i}`}
                name="criterionDescription"
                maxLength={300}
                placeholder={DEFAULT_CRITERIA[i]?.[1] ?? ''}
              />
            </Field>
            <Field label="Max" htmlFor={`criterionMax-${i}`}>
              <Input id={`criterionMax-${i}`} name="criterionMax" type="number" min={1} max={100} defaultValue={10} />
            </Field>
            <Field label="Weight" htmlFor={`criterionWeight-${i}`}>
              <Input id={`criterionWeight-${i}`} name="criterionWeight" type="number" min={0.1} max={10} step={0.1} defaultValue={1} />
            </Field>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setRows((r) => r + 1)} className="text-sm text-gold-700 underline">
          Add another criterion
        </button>
      </div>

      <SubmitButton pendingLabel="Saving…">Create rubric</SubmitButton>
      <p className="text-[13px] text-muted">
        Rubrics are versioned rather than edited, so creating a new one leaves historic scores
        interpretable.
      </p>
    </form>
  );
}

const DEFAULT_CRITERIA: [string, string][] = [
  ['Story and structure', 'Does it hold together, and does something happen that matters?'],
  ['Voice and originality', 'Does this sound like someone, and like nobody else?'],
  ['Cultural authenticity', 'Is the world of the story lived-in and true?'],
  ['Craft', 'Language, dialogue, pacing and control.'],
];

// ---- judging assignment -----------------------------------------------------------

export function AssignJudgesForm({
  submissions,
  judges,
  competitionId,
}: {
  submissions: { id: string; title: string; reference: string | null; writer_name: string }[];
  judges: { id: string; name: string; open_assignments: number }[];
  competitionId?: string;
}) {
  const [state, action] = useActionState(assignJudgesAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {competitionId && <input type="hidden" name="competitionId" value={competitionId} />}

      <fieldset>
        <legend className="text-sm font-medium text-forest-900">Entries</legend>
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-line p-3">
          {submissions.length === 0 ? (
            <p className="text-sm text-muted">Nothing eligible to assign.</p>
          ) : (
            submissions.map((s) => (
              <Checkbox
                key={s.id}
                name="submissionIds"
                value={s.id}
                label={`${s.reference ?? 'No reference'} · ${s.title || 'Untitled'}`}
                hint={s.writer_name}
              />
            ))
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-forest-900">Judges</legend>
        <div className="mt-2 space-y-1.5 rounded-lg border border-line p-3">
          {judges.length === 0 ? (
            <p className="text-sm text-muted">No accounts hold the judge role yet.</p>
          ) : (
            judges.map((j) => (
              <Checkbox
                key={j.id}
                name="judgeIds"
                value={j.id}
                label={j.name}
                hint={`${j.open_assignments} open`}
              />
            ))
          )}
        </div>
      </fieldset>

      <Field label="Due date" htmlFor="dueAt">
        <Input id="dueAt" name="dueAt" type="date" />
      </Field>

      <SubmitButton pendingLabel="Assigning…">Assign</SubmitButton>
      <p className="text-[13px] text-muted">
        Each judge receives one summary email, not one per entry. Existing pairings are left alone.
      </p>
    </form>
  );
}

export function UnlockReviewForm({ reviewId }: { reviewId: string }) {
  const [state, action] = useActionState(unlockReviewAction, IDLE);
  if (state.ok) return <Badge tone="good">{state.message}</Badge>;
  return (
    <form action={action}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Reopening…">
        Reopen scoring
      </SubmitButton>
    </form>
  );
}

export function ReopenSubmissionForm({ submissionId }: { submissionId: string }) {
  const [state, action] = useActionState(reopenSubmissionAction, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {state.message && (
        <div className="w-full">
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <input type="hidden" name="submissionId" value={submissionId} />
      <Field label="Reopen for editing" htmlFor="days" hint="Days the writer gets to make changes.">
        <Input id="days" name="days" type="number" min={1} max={30} defaultValue={3} className="w-24" />
      </Field>
      <SubmitButton variant="outline" size="sm" pendingLabel="Reopening…">
        Reopen
      </SubmitButton>
    </form>
  );
}

export function EligibilityNoteForm({ submissionId, note }: { submissionId: string; note: string }) {
  const [state, action] = useActionState(setEligibilityNoteAction, IDLE);
  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />
      <Field
        label="Note to the writer"
        htmlFor="note"
        hint="Shown on the writer’s submission page. Use it to explain an eligibility decision."
      >
        <Textarea id="note" name="note" rows={3} maxLength={1000} defaultValue={note} />
      </Field>
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
        Save note
      </SubmitButton>
    </form>
  );
}

// ---- stories ---------------------------------------------------------------------------

export function CreateStoryForm({
  submissions,
}: {
  submissions: { id: string; title: string; writer_name: string; reference: string | null }[];
}) {
  const [state, action] = useActionState(createStoryAction, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {state.message && (
        <div className="w-full">
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <Field label="Create a story record from" htmlFor="submissionId" className="min-w-64 flex-1">
        <Select id="submissionId" name="submissionId" required defaultValue="">
          <option value="" disabled>
            Choose an approved entry
          </option>
          {submissions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.reference ?? 'No reference'} · {s.title || 'Untitled'} · {s.writer_name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pendingLabel="Creating…">Create story record</SubmitButton>
    </form>
  );
}

export function StoryForm({
  story,
}: {
  story: {
    id: string;
    title: string;
    synopsis: string;
    excerpt: string | null;
    body_html: string | null;
    language: string;
    genre: string | null;
    status: string;
  };
}) {
  const [state, action] = useActionState(saveStoryAction, IDLE);
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="storyId" value={story.id} />

      <Field label="Title" htmlFor="title" required>
        <Input id="title" name="title" required maxLength={180} defaultValue={story.title} />
      </Field>

      <Field label="Synopsis" htmlFor="synopsis">
        <Textarea id="synopsis" name="synopsis" rows={3} maxLength={1500} defaultValue={story.synopsis} />
      </Field>

      <Field
        label="Public excerpt"
        htmlFor="excerpt"
        hint="Shown when the archive record is set to excerpt-only. Leave blank to use the opening of the story."
      >
        <Textarea id="excerpt" name="excerpt" rows={4} maxLength={2000} defaultValue={story.excerpt ?? ''} />
      </Field>

      <Field
        label="Story text (HTML)"
        htmlFor="bodyHtml"
        hint="Seeded from the latest manuscript. Sanitised on save."
      >
        <Textarea
          id="bodyHtml"
          name="bodyHtml"
          rows={16}
          defaultValue={story.body_html ?? ''}
          className="font-mono"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Language" htmlFor="language">
          <Input id="language" name="language" maxLength={60} defaultValue={story.language} />
        </Field>
        <Field label="Genre" htmlFor="genre">
          <Input id="genre" name="genre" maxLength={60} defaultValue={story.genre ?? ''} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={story.status}>
            {['editorial', 'approved', 'published', 'archived', 'withdrawn'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SubmitButton pendingLabel="Saving…">Save story</SubmitButton>
    </form>
  );
}

export function ArchiveMetaForm({
  storyId,
  meta,
}: {
  storyId: string;
  meta: {
    country: string | null;
    region: string | null;
    am_language: string | null;
    am_genre: string | null;
    am_themes: string[] | null;
    keywords: string[] | null;
    age_band: string | null;
    cultural_context: string | null;
    edition: string | null;
    year: number | null;
    visibility: string | null;
    featured: boolean | null;
    adaptation_ready: boolean | null;
    adaptation_notes: string | null;
  };
}) {
  const [state, action] = useActionState(saveArchiveMetaAction, IDLE);
  const [visibility, setVisibility] = useState(meta.visibility ?? 'private');

  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="storyId" value={storyId} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country" htmlFor="country">
          <Input id="country" name="country" maxLength={80} defaultValue={meta.country ?? ''} />
        </Field>
        <Field label="Region" htmlFor="region">
          <Input id="region" name="region" maxLength={80} defaultValue={meta.region ?? ''} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Language" htmlFor="am-language">
          <Input id="am-language" name="language" maxLength={60} defaultValue={meta.am_language ?? ''} />
        </Field>
        <Field label="Genre" htmlFor="am-genre">
          <Input id="am-genre" name="genre" maxLength={60} defaultValue={meta.am_genre ?? ''} />
        </Field>
        <Field label="Age band" htmlFor="ageBand">
          <Select id="ageBand" name="ageBand" defaultValue={meta.age_band ?? ''}>
            <option value="">Not recorded</option>
            {['under_13', '13_15', '16_17', '18_24', '25_plus'].map((b) => (
              <option key={b} value={b}>
                {b.replace(/_/g, '–')}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Themes" htmlFor="am-themes" hint="Comma separated. Drives the archive filters.">
        <Input id="am-themes" name="themes" defaultValue={meta.am_themes?.join(', ') ?? ''} />
      </Field>

      <Field label="Keywords" htmlFor="keywords" hint="Comma separated. Weighted highly in search.">
        <Input id="keywords" name="keywords" defaultValue={meta.keywords?.join(', ') ?? ''} />
      </Field>

      <Field
        label="Cultural context"
        htmlFor="culturalContext"
        hint="The tradition, place or history a reader needs. Preserved with the story."
      >
        <Textarea id="culturalContext" name="culturalContext" rows={3} maxLength={1500} defaultValue={meta.cultural_context ?? ''} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Edition" htmlFor="edition">
          <Input id="edition" name="edition" maxLength={80} defaultValue={meta.edition ?? ''} placeholder="Perspectives 2026" />
        </Field>
        <Field label="Year" htmlFor="year">
          <Input id="year" name="year" type="number" min={1900} max={2200} defaultValue={meta.year ?? ''} />
        </Field>
      </div>

      <Field label="Visibility" htmlFor="visibility" required hint={VISIBILITY_HELP[visibility]}>
        <Select id="visibility" name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3 rounded-lg bg-parchment p-4">
        <Checkbox name="featured" defaultChecked={meta.featured ?? false} label="Feature in the archive" />
        <Checkbox
          name="adaptationReady"
          defaultChecked={meta.adaptation_ready ?? false}
          label="Adaptation-ready"
          hint="Lists the story in the catalogue partners and staff can browse."
        />
      </div>

      <Field label="Adaptation notes" htmlFor="adaptationNotes">
        <Textarea id="adaptationNotes" name="adaptationNotes" rows={3} maxLength={2000} defaultValue={meta.adaptation_notes ?? ''} />
      </Field>

      <SubmitButton pendingLabel="Saving…">Save archive record</SubmitButton>
    </form>
  );
}

export function CoverForm({ storyId, coverUrl }: { storyId: string; coverUrl: string | null }) {
  const [state, action] = useActionState(uploadCoverAction, IDLE);

  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="storyId" value={storyId} />
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
        <img src={coverUrl} alt="Current cover" className="w-full rounded-lg border border-line object-cover" />
      )}
      <FileField
        name="cover"
        accept="image/jpeg,image/png,image/webp"
        maxBytes={PICTURE_MAX_BYTES}
        required={!coverUrl}
        label={coverUrl ? 'Replace cover' : 'Choose cover image'}
      />
      <SubmitButton variant="outline" size="sm" pendingLabel="Uploading…">
        {coverUrl ? 'Replace cover' : 'Upload cover'}
      </SubmitButton>
      <p className="text-[12px] text-muted">
        JPEG, PNG or WebP up to 4 MB. Shown on the public archive card and story page.
      </p>
    </form>
  );
}

export function RightsForm({
  storyId,
  record,
}: {
  storyId: string;
  record?: {
    id: string;
    owner_name: string;
    ownership_note: string;
    licence_type: string | null;
    territory: string | null;
    term_start: string | null;
    term_end: string | null;
    restrictions: string;
    status: string;
    notes: string;
  };
}) {
  const [state, action] = useActionState(saveRightsAction, IDLE);
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="storyId" value={storyId} />
      {record && <input type="hidden" name="rightsId" value={record.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rights owner" htmlFor="ownerName">
          <Input id="ownerName" name="ownerName" maxLength={160} defaultValue={record?.owner_name} />
        </Field>
        <Field label="Ownership note" htmlFor="ownershipNote">
          <Input
            id="ownershipNote"
            name="ownershipNote"
            maxLength={400}
            defaultValue={record?.ownership_note ?? 'Author retains copyright'}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Licence held by DPGLF" htmlFor="licenceType">
          <Select id="licenceType" name="licenceType" defaultValue={record?.licence_type ?? 'none'}>
            {[
              ['none', 'None'],
              ['anthology', 'Anthology publication'],
              ['non_exclusive', 'Non-exclusive'],
              ['exclusive', 'Exclusive'],
              ['option', 'Option'],
              ['educational', 'Educational'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Territory" htmlFor="territory">
          <Input id="territory" name="territory" maxLength={160} defaultValue={record?.territory ?? ''} placeholder="Worldwide" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Term starts" htmlFor="termStart">
          <Input id="termStart" name="termStart" type="date" defaultValue={record?.term_start?.slice(0, 10) ?? ''} />
        </Field>
        <Field label="Term ends" htmlFor="termEnd">
          <Input id="termEnd" name="termEnd" type="date" defaultValue={record?.term_end?.slice(0, 10) ?? ''} />
        </Field>
        <Field label="Status" htmlFor="rightsStatus">
          <Select id="rightsStatus" name="status" defaultValue={record?.status ?? 'draft'}>
            {['draft', 'active', 'expired', 'terminated'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Restrictions" htmlFor="restrictions">
        <Textarea id="restrictions" name="restrictions" rows={2} maxLength={2000} defaultValue={record?.restrictions} />
      </Field>

      <Field label="Internal notes" htmlFor="rightsNotes">
        <Textarea id="rightsNotes" name="notes" rows={2} maxLength={2000} defaultValue={record?.notes} />
      </Field>

      <SubmitButton pendingLabel="Saving…">{record ? 'Update rights record' : 'Add rights record'}</SubmitButton>
    </form>
  );
}

export function PublicationForm({ storyId }: { storyId: string }) {
  const [state, action] = useActionState(addPublicationAction, IDLE);
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="storyId" value={storyId} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type" htmlFor="publicationType" required>
          <Select id="publicationType" name="publicationType" defaultValue="anthology">
            {['anthology', 'digital', 'print', 'audio', 'educational', 'other'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="pubTitle">
          <Input id="pubTitle" name="title" maxLength={200} placeholder="Perspectives: A Collection of Short Stories" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Edition" htmlFor="edition">
          <Input id="edition" name="edition" maxLength={80} />
        </Field>
        <Field label="Publisher" htmlFor="publisher">
          <Input id="publisher" name="publisher" maxLength={160} defaultValue="Emoworld Publishers" />
        </Field>
        <Field label="Date" htmlFor="publicationDate">
          <Input id="publicationDate" name="publicationDate" type="date" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="ISBN / reference" htmlFor="isbn">
          <Input id="isbn" name="isbn" maxLength={60} />
        </Field>
        <Field label="URL" htmlFor="url">
          <Input id="url" name="url" type="url" maxLength={400} />
        </Field>
      </div>

      <Field label="Royalty notes" htmlFor="royaltyNotes">
        <Textarea id="royaltyNotes" name="royaltyNotes" rows={2} maxLength={1000} />
      </Field>

      <SubmitButton variant="outline" pendingLabel="Saving…">
        Record publication
      </SubmitButton>
    </form>
  );
}

// ---- emoworld handoff ---------------------------------------------------------------------

export function EmoworldControls({ storyId, enabled }: { storyId?: string; enabled: boolean }) {
  const [drainState, drain] = useActionState(async () => drainEmoworldAction(), IDLE);
  const [queueState, enqueue] = useActionState(enqueueStoryAction, IDLE);

  return (
    <div className="space-y-3">
      {!enabled && (
        <Alert tone="warning" title="Handoff is switched off">
          Stories still queue up. Set EMOWORLD_SYNC_ENABLED, EMOWORLD_API_BASE and
          EMOWORLD_SYNC_SECRET to start sending them.
        </Alert>
      )}
      {drainState.message && <Alert tone={drainState.ok ? 'success' : 'error'}>{drainState.message}</Alert>}
      {queueState.message && <Alert tone={queueState.ok ? 'success' : 'error'}>{queueState.message}</Alert>}

      <div className="flex flex-wrap gap-3">
        {storyId && (
          <form action={enqueue}>
            <input type="hidden" name="storyId" value={storyId} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Queueing…">
              Queue for Emoworld review
            </SubmitButton>
          </form>
        )}
        <form action={drain}>
          <SubmitButton variant="outline" size="sm" pendingLabel="Sending…" disabled={!enabled}>
            Send queued stories now
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

// ---- people ----------------------------------------------------------------------------------

export function RolesForm({
  userId,
  roles,
  status,
}: {
  userId: string;
  roles: Role[];
  status: string;
}) {
  const [state, action] = useActionState(updateRolesAction, IDLE);
  const [statusState, statusAction] = useActionState(setUserStatusAction, IDLE);

  return (
    <div className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <form action={action} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ROLES.map((role) => (
            <Checkbox
              key={role}
              name="roles"
              value={role}
              defaultChecked={roles.includes(role)}
              label={ROLE_LABELS[role]}
            />
          ))}
        </div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          Save roles
        </SubmitButton>
      </form>

      {statusState.message && <Alert tone={statusState.ok ? 'success' : 'error'}>{statusState.message}</Alert>}
      <form action={statusAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="status" value={status === 'active' ? 'suspended' : 'active'} />
        <SubmitButton
          variant={status === 'active' ? 'danger' : 'outline'}
          size="sm"
          pendingLabel="Saving…"
          onClick={(e) => {
            if (status === 'active' && !window.confirm('Suspend this account and sign them out?')) {
              e.preventDefault();
            }
          }}
        >
          {status === 'active' ? 'Suspend account' : 'Reactivate account'}
        </SubmitButton>
      </form>
    </div>
  );
}

// ---- inquiries & messages ------------------------------------------------------------------------

export function InquiryForm({
  inquiryId,
  status,
  responseNote,
}: {
  inquiryId: string;
  status: string;
  responseNote: string;
}) {
  const [state, action] = useActionState(updateInquiryAction, IDLE);
  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Status" htmlFor={`status-${inquiryId}`}>
          <Select id={`status-${inquiryId}`} name="status" defaultValue={status}>
            {['new', 'in_review', 'approved', 'declined', 'closed'].map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Internal note" htmlFor={`note-${inquiryId}`} className="min-w-64 flex-1">
          <Input id={`note-${inquiryId}`} name="responseNote" maxLength={2000} defaultValue={responseNote} />
        </Field>
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          Update
        </SubmitButton>
      </div>
    </form>
  );
}

export function MessageStatusForm({ messageId, status }: { messageId: string; status: string }) {
  const [, action] = useActionState(updateMessageAction, IDLE);
  return (
    <form action={action} className="flex gap-2 sm:gap-1">
      <input type="hidden" name="messageId" value={messageId} />
      {(['new', 'handled', 'spam'] as const).map((s) => (
        <button
          key={s}
          type="submit"
          name="status"
          value={s}
          className={cx(
            'rounded-md px-3 py-2 text-[13px] transition-colors sm:px-2.5 sm:py-1 sm:text-[12px]',
            status === s ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
          )}
        >
          {s}
        </button>
      ))}
    </form>
  );
}

// ---- content ------------------------------------------------------------------------------------------

/** Matches IMAGE_MAX_BYTES in lib/files (a server module, so not imported here). */
const PICTURE_MAX_BYTES = 4 * 1024 * 1024;

export function NewsForm({
  post,
  notice,
}: {
  /** The outcome of the save that led here (from the URL); hidden once the form is used again. */
  notice?: string;
  post?: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    /** Plain text for an article written without HTML (see htmlToArticle), otherwise HTML. */
    body: string;
    tags: string[];
    status: string;
    coverUrl: string | null;
    coverAlt: string;
  };
}) {
  const [state, action] = useActionState(saveNewsAction, IDLE);
  // After a failed save, what was typed (echoed by the action) wins over the
  // stored post, because React resets the form to its defaults.
  const typed = (state.ok === false ? state.data : undefined) as Record<string, string> | undefined;
  const v = (field: string, stored: string | undefined) => typed?.[field] ?? stored;
  return (
    <form action={action} className="space-y-5">
      {state === IDLE && notice && <Alert tone="success">{notice}</Alert>}
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {post && <input type="hidden" name="id" value={post.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title" htmlFor="newsTitle" required>
          <Input id="newsTitle" name="title" required maxLength={200} defaultValue={v('title', post?.title)} />
        </Field>
        <Field label="Slug" htmlFor="newsSlug" hint="The web address. Leave empty to make one from the title.">
          <Input id="newsSlug" name="slug" maxLength={90} defaultValue={v('slug', post?.slug)} />
        </Field>
      </div>

      <Field
        label="Summary"
        htmlFor="newsExcerpt"
        hint="One or two sentences. Shown under the picture on the news page and the homepage."
      >
        <Textarea id="newsExcerpt" name="excerpt" rows={2} maxLength={500} defaultValue={v('excerpt', post?.excerpt)} />
      </Field>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <p className="text-sm font-medium text-forest-900">Picture</p>
        {post?.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
          <img
            src={post.coverUrl}
            alt={post.coverAlt || 'Current picture'}
            className="aspect-[16/9] w-full max-w-md rounded-lg border border-line object-cover"
          />
        )}
        <FileField
          name="cover"
          accept="image/jpeg,image/png,image/webp"
          maxBytes={PICTURE_MAX_BYTES}
          label={post?.coverUrl ? 'Replace picture' : 'Choose a picture'}
        />
        <p className="text-[12px] text-muted">
          JPEG, PNG or WebP up to 4 MB. Landscape pictures work best: news cards crop to 16:9.
        </p>
        <Field
          label="Picture description"
          htmlFor="newsCoverAlt"
          hint="What the picture shows, for readers using screen readers. For example: “Young writers at the 2026 awards evening in Harare.”"
        >
          <Input id="newsCoverAlt" name="coverAlt" maxLength={200} defaultValue={v('coverAlt', post?.coverAlt)} />
        </Field>
        {post?.coverUrl && <Checkbox name="removeCover" label="Remove the picture from this post" />}
      </div>

      <Field
        label="Article"
        htmlFor="newsBody"
        hint="Write normally and leave a blank line between paragraphs. If you want headings, links or lists, basic HTML works too."
      >
        <Textarea id="newsBody" name="body" rows={16} defaultValue={v('body', post?.body)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tags" htmlFor="newsTags" hint="Comma separated, e.g. Competition, Results.">
          <Input id="newsTags" name="tags" maxLength={300} defaultValue={v('tags', post?.tags.join(', '))} />
        </Field>
        <Field label="Status" htmlFor="newsStatus">
          <Select id="newsStatus" name="status" defaultValue={v('status', post?.status) || 'draft'}>
            <option value="draft">Draft (only staff can see it)</option>
            <option value="published">Published</option>
          </Select>
        </Field>
      </div>

      <SubmitButton pendingLabel="Saving…">{post ? 'Save post' : 'Create post'}</SubmitButton>
    </form>
  );
}

export function PageForm({
  page,
}: {
  page?: { slug: string; title: string; kind: string; status: string; version: number };
}) {
  const [state, action] = useActionState(savePageAction, IDLE);
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Slug" htmlFor="pageSlug" required hint="privacy, child-safeguarding, submissions, copyright, terms">
          <Input id="pageSlug" name="slug" required maxLength={80} defaultValue={page?.slug} />
        </Field>
        <Field label="Title" htmlFor="pageTitle" required>
          <Input id="pageTitle" name="title" required maxLength={200} defaultValue={page?.title} />
        </Field>
      </div>

      <Field label="Summary" htmlFor="pageSummary">
        <Input id="pageSummary" name="summary" maxLength={400} />
      </Field>

      <Field label="Body (HTML)" htmlFor="pageBody" required>
        <Textarea id="pageBody" name="bodyHtml" rows={16} required className="font-mono" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kind" htmlFor="pageKind">
          <Select id="pageKind" name="kind" defaultValue={page?.kind ?? 'policy'}>
            <option value="policy">Policy</option>
            <option value="page">Page</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor="pageStatus">
          <Select id="pageStatus" name="status" defaultValue={page?.status ?? 'published'}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>
      </div>

      {page && (
        <p className="text-[13px] text-muted">
          Currently version {page.version}. Saving publishes version {page.version + 1}. Earlier
          submissions keep pointing at the version their writer accepted.
        </p>
      )}

      <SubmitButton pendingLabel="Saving…">Save page</SubmitButton>
    </form>
  );
}

// ---- settings -----------------------------------------------------------------------

export function SettingForm({
  settingKey,
  currentValue,
  label,
  hint,
  multiline,
}: {
  settingKey: string;
  currentValue: string;
  label: string;
  hint?: string;
  multiline?: boolean;
}) {
  const [state, action] = useActionState(saveSettingAction, IDLE);

  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="key" value={settingKey} />
      <Field label={label} htmlFor={`setting-${settingKey}`} hint={hint}>
        {multiline ? (
          <Textarea
            id={`setting-${settingKey}`}
            name="value"
            rows={3}
            maxLength={2000}
            defaultValue={currentValue}
          />
        ) : (
          <Input id={`setting-${settingKey}`} name="value" maxLength={2000} defaultValue={currentValue} />
        )}
      </Field>
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}

export function NewSettingForm() {
  const [state, action] = useActionState(saveSettingAction, IDLE);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
      {state.message && (
        <div className="sm:col-span-3">
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <Field label="Key" htmlFor="new-setting-key" hint="e.g. archive.featured_limit">
        <Input id="new-setting-key" name="key" maxLength={120} pattern="[A-Za-z0-9._\-]+" required />
      </Field>
      <Field label="Value" htmlFor="new-setting-value" hint="Plain text, or a JSON document.">
        <Input id="new-setting-value" name="value" maxLength={2000} required />
      </Field>
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
        Add
      </SubmitButton>
    </form>
  );
}
