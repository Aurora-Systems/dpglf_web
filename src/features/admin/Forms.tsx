'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/components/client';
import { Checkbox, Field, FormSection, Input, Select, Textarea } from '@/components/form';
import { Alert, Badge, cx } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/lib/roles';
import { STORY_STATUS_LABELS, VISIBILITY_HELP, VISIBILITY_LABELS } from '@/lib/workflow';
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
    rules_version?: string;
  };
  rubrics: { id: string; name: string; version: number; criteria: number }[];
}) {
  const [state, action] = useActionState(saveCompetitionAction, IDLE);
  // React resets the form after the action. After a failed save, what was typed
  // (captured on submit) becomes the defaults, so a long form is not wiped.
  const [typed, setTyped] = useState<Record<string, string> | null>(null);
  const echo = state.ok === false ? typed : null;
  const v = (field: string, stored: string | number | null | undefined) => (echo ? (echo[field] ?? '') : (stored ?? ''));
  const on = (field: string, stored: boolean) => (echo ? echo[field] === 'on' : stored);
  const c = competition;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const entries = [...new FormData(e.currentTarget)].filter((p): p is [string, string] => typeof p[1] === 'string');
        setTyped(Object.fromEntries(entries));
      }}
      className="space-y-8"
    >
      {/* Wrapped so the first section is a first child: React puts hidden action inputs at the top of the form. */}
      <div className="space-y-8">
        <FormSection title="The basics" description="How the competition is named and introduced on the website.">
          <Field label="Name" htmlFor="name" required error={state.errors?.name}>
            <Input id="name" name="name" required maxLength={160} defaultValue={v('name', c?.name)} />
          </Field>
          <Field
            label="Slug"
            htmlFor="slug"
            hint="Used in the public URL. Leave blank to generate one."
            error={state.errors?.slug}
            className="sm:max-w-[calc(50%-0.625rem)]"
          >
            <Input id="slug" name="slug" maxLength={80} defaultValue={v('slug', c?.slug)} pattern="[a-z0-9\-]+" />
          </Field>
          <Field label="Tagline" htmlFor="tagline">
            <Input id="tagline" name="tagline" maxLength={200} defaultValue={v('tagline', c?.tagline)} />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" rows={3} maxLength={4000} defaultValue={v('description', c?.description)} />
          </Field>
        </FormSection>

        <FormSection title="Dates" description="All times are Harare time. Writers cannot submit after the closing time.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Opens" htmlFor="opensAt">
              <Input id="opensAt" name="opensAt" type="datetime-local" defaultValue={v('opensAt', dtLocal(c?.opens_at))} />
            </Field>
            <Field label="Closes" htmlFor="closesAt">
              <Input id="closesAt" name="closesAt" type="datetime-local" defaultValue={v('closesAt', dtLocal(c?.closes_at))} />
            </Field>
            <Field label="Results announced" htmlFor="resultsAt">
              <Input id="resultsAt" name="resultsAt" type="datetime-local" defaultValue={v('resultsAt', dtLocal(c?.results_at))} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Who can enter" description="Leave an age or country limit blank to have no limit.">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Minimum age" htmlFor="minAge">
              <Input id="minAge" name="minAge" type="number" min={0} max={120} defaultValue={v('minAge', c?.min_age)} />
            </Field>
            <Field label="Maximum age" htmlFor="maxAge">
              <Input id="maxAge" name="maxAge" type="number" min={0} max={120} defaultValue={v('maxAge', c?.max_age)} />
            </Field>
          </div>
          <Field label="Eligible countries" htmlFor="countries" hint="Comma separated.">
            <Input id="countries" name="countries" defaultValue={v('countries', c?.countries?.join(', '))} />
          </Field>
          <Field label="Entries per writer" htmlFor="maxEntries" required className="sm:max-w-[calc(50%-0.625rem)]">
            <Input
              id="maxEntries"
              name="maxEntries"
              type="number"
              min={1}
              max={20}
              required
              defaultValue={v('maxEntries', c?.max_entries ?? 1)}
            />
          </Field>
          <Field label="Eligibility (HTML)" htmlFor="eligibilityHtml" hint="Shown on the public page.">
            <Textarea
              id="eligibilityHtml"
              name="eligibilityHtml"
              rows={5}
              defaultValue={v('eligibilityHtml', c?.eligibility_html)}
              className="font-mono"
            />
          </Field>
        </FormSection>

        <FormSection title="Entries" description="The limits and themes writers see when they enter.">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Minimum words" htmlFor="wordMin" required>
              <Input id="wordMin" name="wordMin" type="number" min={0} required defaultValue={v('wordMin', c?.word_min ?? 500)} />
            </Field>
            <Field label="Maximum words" htmlFor="wordMax" required>
              <Input id="wordMax" name="wordMax" type="number" min={1} required defaultValue={v('wordMax', c?.word_max ?? 3000)} />
            </Field>
          </div>
          <Field label="Themes" htmlFor="themes" hint="Comma separated. These become the checkboxes writers see.">
            <Textarea id="themes" name="themes" rows={2} defaultValue={v('themes', c?.themes?.join(', '))} />
          </Field>
        </FormSection>

        <FormSection
          title="Rules"
          description={
            c?.rules_version
              ? `Writers accept these when they enter. Current version: ${c.rules_version}.`
              : 'Writers accept these when they enter.'
          }
        >
          <Field
            label="Rules (HTML)"
            htmlFor="rulesHtml"
            hint="Editing the rules later creates a new version, so earlier entrants stay bound to the rules they accepted."
          >
            <Textarea id="rulesHtml" name="rulesHtml" rows={8} defaultValue={v('rulesHtml', c?.rules_html)} className="font-mono" />
          </Field>
        </FormSection>

        <FormSection title="Judging and publishing" description="Who can see the competition, and how judges score it.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Status"
              htmlFor="status"
              required
              hint="Only Open accepts entries."
            >
              {/* A select ignores a new defaultValue after mounting, and React resets the form after
                  every save. Keyed on the value it should show, it remounts with the saved (or, after
                  a failed save, the typed) choice instead of snapping back to the first render's. */}
              <Select
                key={`status:${v('status', c?.status ?? 'draft')}`}
                id="status"
                name="status"
                defaultValue={v('status', c?.status ?? 'draft')}
              >
                {COMPETITION_STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Judging rubric" htmlFor="rubricId" hint="Add new rubrics on the Judging rubrics tab.">
              <Select
                key={`rubric:${v('rubricId', c?.rubric_id)}`}
                id="rubricId"
                name="rubricId"
                defaultValue={v('rubricId', c?.rubric_id)}
              >
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
              defaultChecked={on('blindJudging', c?.blind_judging ?? true)}
              label="Blind judging"
              hint="Judges see an anonymous label instead of the writer’s name."
            />
            <Checkbox
              name="allowScoreRevision"
              defaultChecked={on('allowScoreRevision', c?.allow_score_revision ?? false)}
              label="Judges may revise a submitted score"
              hint="Off means scoring locks on submission and only an admin can reopen it."
            />
            <Checkbox
              name="requiresGuardianConsent"
              defaultChecked={on('requiresGuardianConsent', c?.requires_guardian_consent ?? true)}
              label="Require guardian consent for under-18 entrants"
            />
          </div>
        </FormSection>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">{c ? 'Save competition' : 'Create competition'}</SubmitButton>
      </div>
      {c && <input type="hidden" name="id" value={c.id} />}
    </form>
  );
}

const COMPETITION_STATUSES: [string, string][] = [
  ['draft', 'Draft, hidden from the website'],
  ['open', 'Open for entries'],
  ['closed', 'Closed to entries'],
  ['judging', 'Judging'],
  ['completed', 'Completed'],
  ['archived', 'Archived'],
];

export function RubricForm({ competitionId }: { competitionId?: string }) {
  const [state, action] = useActionState(saveRubricAction, IDLE);
  const [rows, setRows] = useState(4);
  // As in CompetitionForm: React resets the form after the action, so after a failed
  // save what was typed (captured on submit, per field and row) becomes the defaults.
  const [typed, setTyped] = useState<Record<string, string[]> | null>(null);
  const echo = state.ok === false ? typed : null;
  const t = (field: string, i: number, fallback: string | number = '') => echo?.[field]?.[i] ?? fallback;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const values: Record<string, string[]> = {};
        for (const [key, value] of new FormData(e.currentTarget)) {
          if (typeof value === 'string') (values[key] ??= []).push(value);
        }
        setTyped(values);
      }}
      className="space-y-8"
    >
      <div className="space-y-8">
        <FormSection
          title="About the rubric"
          description="Name it after the competition and year, so judges know which one they are using."
        >
          <Field label="Rubric name" htmlFor="rubricName" required>
            <Input
              id="rubricName"
              name="name"
              required
              maxLength={160}
              placeholder="e.g. Tales from the Baobab 2026"
              defaultValue={t('name', 0)}
            />
          </Field>
          <Field label="Description" htmlFor="rubricDescription">
            <Input id="rubricDescription" name="description" maxLength={400} defaultValue={t('description', 0)} />
          </Field>
        </FormSection>

        <FormSection
          title="Criteria"
          description="Judges score each criterion out of its maximum, and the weight scales it in the total. Leave a row blank to skip it."
        >
          <ol className="space-y-3">
            {Array.from({ length: rows }, (_, i) => (
              <li
                key={i}
                className="grid grid-cols-2 gap-3 rounded-lg border border-line p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5.5rem_5.5rem]"
              >
                <Field label={`Criterion ${i + 1}`} htmlFor={`criterionLabel-${i}`} className="col-span-2 sm:col-span-1">
                  <Input
                    id={`criterionLabel-${i}`}
                    name="criterionLabel"
                    maxLength={120}
                    placeholder={DEFAULT_CRITERIA[i] ? `e.g. ${DEFAULT_CRITERIA[i][0]}` : ''}
                    defaultValue={t('criterionLabel', i)}
                  />
                </Field>
                <Field label="What judges look for" htmlFor={`criterionDescription-${i}`} className="col-span-2 sm:col-span-1">
                  <Input
                    id={`criterionDescription-${i}`}
                    name="criterionDescription"
                    maxLength={300}
                    placeholder={DEFAULT_CRITERIA[i] ? `e.g. ${DEFAULT_CRITERIA[i][1]}` : ''}
                    defaultValue={t('criterionDescription', i)}
                  />
                </Field>
                <Field label="Max score" htmlFor={`criterionMax-${i}`}>
                  <Input
                    id={`criterionMax-${i}`}
                    name="criterionMax"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={t('criterionMax', i, 10)}
                  />
                </Field>
                <Field label="Weight" htmlFor={`criterionWeight-${i}`}>
                  <Input
                    id={`criterionWeight-${i}`}
                    name="criterionWeight"
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    defaultValue={t('criterionWeight', i, 1)}
                  />
                </Field>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setRows((r) => r + 1)}
            className="inline-flex min-h-10 items-center rounded-lg border border-dashed border-forest-900/25 px-4 text-sm font-medium text-forest-800 hover:border-gold-500 hover:text-forest-900"
          >
            + Add another criterion
          </button>
        </FormSection>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">Create rubric</SubmitButton>
        <p className="text-[13px] text-muted">
          A saved rubric cannot be edited. To change one, create a new rubric and attach it instead, so
          scores already given keep their meaning.
        </p>
      </div>
      {competitionId && <input type="hidden" name="competitionId" value={competitionId} />}
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

type AssignableEntry = {
  id: string;
  title: string;
  reference: string | null;
  writer_name: string;
  competition_name?: string;
  assigned?: number;
  completed?: number;
};

export function AssignJudgesForm({
  waiting,
  withJudges,
  judges,
  competitionId,
  empty,
}: {
  /** Eligible entries with no judges yet. */
  waiting: AssignableEntry[];
  /** Entries already in judging, which can be given more judges. */
  withJudges: AssignableEntry[];
  judges: { id: string; name: string; open_assignments: number }[];
  competitionId?: string;
  /** Shown in place of the entry lists when nothing can be assigned, e.g. a link to entries awaiting a check. */
  empty?: React.ReactNode;
}) {
  const [state, action] = useActionState(assignJudgesAction, IDLE);
  const none = waiting.length === 0 && withJudges.length === 0;
  // Nothing to pair: the button stays visible, so the flow reads the same, but cannot be pressed.
  const blocked = none || judges.length === 0;

  return (
    <form action={action} className="space-y-6">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {competitionId && <input type="hidden" name="competitionId" value={competitionId} />}

      {/* React puts hidden action inputs first in the form, so the sections need a box of their own. */}
      <div className="space-y-6">
        <FormSection
          title="1. Entries"
          description="Only entries that have passed the eligibility check can go to judges."
        >
          {none ? (
            <div className="rounded-lg border border-dashed border-line bg-parchment px-4 py-6 text-center text-sm text-muted">
              {empty ?? 'Nothing is ready for judging. Entries appear here once they are marked eligible.'}
            </div>
          ) : (
            <>
              <EntryChoices
                title="Waiting for judges"
                entries={waiting}
                empty="None waiting. Every eligible entry already has judges."
              />
              {withJudges.length > 0 && (
                <EntryChoices
                  title="Already with judges"
                  hint="Tick one to add another judge to it."
                  entries={withJudges}
                />
              )}
            </>
          )}
        </FormSection>

        <FormSection title="2. Judges" description="Fewest unfinished entries first, so the reading is shared out.">
          {judges.length === 0 ? (
            <p className="text-sm text-muted">No accounts hold the judge role yet. Grant it under People &amp; roles.</p>
          ) : (
            <div className="space-y-0.5 rounded-lg border border-line p-1.5">
              {judges.map((j) => (
                <Checkbox
                  key={j.id}
                  name="judgeIds"
                  value={j.id}
                  label={j.name}
                  hint={j.open_assignments === 0 ? 'Nothing unfinished' : `${j.open_assignments} unfinished`}
                  className="rounded-md px-2.5 py-2 hover:bg-parchment"
                />
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="3. Deadline" description="Optional. Judges see it in their email and in their queue.">
          <Field label="Due date" htmlFor="dueAt">
            <Input id="dueAt" name="dueAt" type="date" className="sm:max-w-56" />
          </Field>
        </FormSection>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:gap-4">
        <SubmitButton pendingLabel="Assigning…" disabled={blocked}>
          Assign judges
        </SubmitButton>
        <p className="text-[13px] text-muted">
          {blocked
            ? none
              ? 'Nothing to assign yet.'
              : 'Give someone the judge role first.'
            : 'Each judge receives one summary email, not one per entry. Existing pairings are left alone.'}
        </p>
      </div>
    </form>
  );
}

/** One group of entry checkboxes in AssignJudgesForm, with select all and none. */
function EntryChoices({
  title,
  hint,
  entries,
  empty,
}: {
  title: string;
  hint?: string;
  entries: AssignableEntry[];
  empty?: string;
}) {
  function tickAll(e: React.MouseEvent<HTMLButtonElement>, checked: boolean) {
    e.currentTarget
      .closest('[role="group"]')
      ?.querySelectorAll<HTMLInputElement>('input[name="submissionIds"]')
      .forEach((c) => {
        c.checked = checked;
      });
  }

  return (
    <div role="group" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <p className="text-sm font-medium text-forest-900">
          {title} <span className="font-normal text-muted">({entries.length})</span>
        </p>
        {entries.length > 1 && (
          <span className="flex gap-4 text-[13px]">
            <button type="button" onClick={(e) => tickAll(e, true)} className="py-2 text-gold-700 hover:underline">
              Select all
            </button>
            <button type="button" onClick={(e) => tickAll(e, false)} className="py-2 text-gold-700 hover:underline">
              Clear
            </button>
          </span>
        )}
      </div>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      {entries.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted">{empty}</p>
      ) : (
        <div className="mt-2 max-h-80 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1.5">
          {entries.map((s) => (
            <Checkbox
              key={s.id}
              name="submissionIds"
              value={s.id}
              label={
                <>
                  <span className="font-medium text-forest-900">{s.title || 'Untitled'}</span>{' '}
                  <span className="font-mono text-[11px] text-muted">{s.reference ?? 'No reference'}</span>
                </>
              }
              hint={[
                s.writer_name,
                s.competition_name,
                s.assigned ? `${s.completed ?? 0} of ${s.assigned} judges scored` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              className="rounded-md px-2.5 py-2 hover:bg-parchment"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function UnlockReviewForm({ reviewId }: { reviewId: string }) {
  const [state, action] = useActionState(unlockReviewAction, IDLE);
  if (state.ok) return <Badge tone="good">{state.message}</Badge>;
  return (
    <form action={action}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Reopening…" className="min-h-10 sm:min-h-0">
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
      <Field label="Days the writer gets" htmlFor="days">
        <Input id="days" name="days" type="number" min={1} max={30} defaultValue={3} className="w-24" />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Reopening…">
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
        label="Note on the writer’s page"
        htmlFor="note"
        hint="Shown on the writer’s submission page. Use it to explain an eligibility decision."
      >
        <Textarea id="note" name="note" rows={3} maxLength={1000} defaultValue={note} />
      </Field>
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…" className="min-h-10 sm:min-h-0">
        Save note
      </SubmitButton>
    </form>
  );
}

// ---- stories ---------------------------------------------------------------------------

export function CreateStoryForm({
  submissions,
}: {
  submissions: {
    id: string;
    title: string;
    writer_name: string;
    reference: string | null;
    competition_name?: string;
  }[];
}) {
  const [state, action] = useActionState(createStoryAction, IDLE);
  return (
    <form action={action} className="space-y-8">
      {/* Sections sit in their own wrapper: React puts hidden inputs first in a form
          with a server action, and FormSection drops its top rule only as a first child. */}
      <div className="space-y-8">
        <FormSection
          title="Entry"
          description="Entries in editorial or approved for publication that do not have a story record yet."
        >
          <Field label="Create a story record from" htmlFor="submissionId" required>
            <Select id="submissionId" name="submissionId" required defaultValue="">
              <option value="" disabled>
                Choose an entry
              </option>
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.reference ?? 'No reference'} · {s.title || 'Untitled'} · {s.writer_name}
                  {s.competition_name ? ` · ${s.competition_name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </FormSection>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Creating…">Create story record</SubmitButton>
      </div>
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
    <form action={action} className="space-y-8">
      <input type="hidden" name="storyId" value={story.id} />

      <div className="space-y-8">
        <FormSection title="Text" description="What readers see. The story text is cleaned of unsafe HTML when you save.">
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

          <Field label="Story text (HTML)" htmlFor="bodyHtml" hint="Seeded from the latest manuscript.">
            <Textarea
              id="bodyHtml"
              name="bodyHtml"
              rows={16}
              defaultValue={story.body_html ?? ''}
              className="font-mono"
            />
          </Field>
        </FormSection>

        <FormSection
          title="Details"
          description="Status tracks the story through publishing. Who can read it is set under archive visibility."
        >
          <div className="@container">
            <div className="grid gap-5 @xs:grid-cols-2 @lg:grid-cols-3">
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
                      {STORY_STATUS_LABELS[s] ?? s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </FormSection>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">Save story</SubmitButton>
      </div>
    </form>
  );
}

/** Age bands as stored, with readable labels (values are what the database expects). */
const AGE_BANDS: [string, string][] = [
  ['under_13', 'Under 13'],
  ['13_15', '13 to 15'],
  ['16_17', '16 to 17'],
  ['18_24', '18 to 24'],
  ['25_plus', '25 and over'],
];

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
    <form action={action} className="space-y-8">
      <input type="hidden" name="storyId" value={storyId} />

      <div className="space-y-8">
        <FormSection
          title="Who can see it"
          description="Who can read the story in the archive. It appears only once the story is approved, published or archived."
        >
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
        </FormSection>

        <FormSection title="Place and language" description="Where the story comes from and who it was written for.">
          <div className="@container space-y-5">
            <div className="grid gap-5 @xs:grid-cols-2">
              <Field label="Country" htmlFor="country">
                <Input id="country" name="country" maxLength={80} defaultValue={meta.country ?? ''} />
              </Field>
              <Field label="Region" htmlFor="region">
                <Input id="region" name="region" maxLength={80} defaultValue={meta.region ?? ''} />
              </Field>
            </div>

            <div className="grid gap-5 @xs:grid-cols-2 @lg:grid-cols-3">
              <Field label="Language" htmlFor="am-language">
                <Input id="am-language" name="language" maxLength={60} defaultValue={meta.am_language ?? ''} />
              </Field>
              <Field label="Genre" htmlFor="am-genre">
                <Input id="am-genre" name="genre" maxLength={60} defaultValue={meta.am_genre ?? ''} />
              </Field>
              <Field label="Age band" htmlFor="ageBand">
                <Select id="ageBand" name="ageBand" defaultValue={meta.age_band ?? ''}>
                  <option value="">Not recorded</option>
                  {AGE_BANDS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection title="Finding it" description="How readers find the story in the archive.">
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
        </FormSection>

        <FormSection title="Edition" description="The collection and year the story belongs to.">
          <div className="@container">
            <div className="grid gap-5 @xs:grid-cols-2">
              <Field label="Edition" htmlFor="edition">
                <Input id="edition" name="edition" maxLength={80} defaultValue={meta.edition ?? ''} placeholder="Perspectives 2026" />
              </Field>
              <Field label="Year" htmlFor="year">
                <Input id="year" name="year" type="number" min={1900} max={2200} defaultValue={meta.year ?? ''} />
              </Field>
            </div>
          </div>
        </FormSection>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">Save archive record</SubmitButton>
      </div>
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
        label={coverUrl ? 'Choose a new image' : 'Choose cover image'}
      />
      <p className="text-[12px] text-muted">
        JPEG, PNG or WebP up to 4 MB. Shown on the public archive card and story page.
      </p>
      <SubmitButton variant="outline" size="sm" pendingLabel="Uploading…" className="min-h-10 sm:min-h-0">
        {coverUrl ? 'Replace cover' : 'Upload cover'}
      </SubmitButton>
    </form>
  );
}

/** A small heading for one group of fields in a narrow column, where FormSection would be too wide. */
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</legend>
      {children}
    </fieldset>
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
    <form action={action} className="@container space-y-6">
      <input type="hidden" name="storyId" value={storyId} />
      {record && <input type="hidden" name="rightsId" value={record.id} />}

      <FieldGroup title="Ownership">
        <div className="grid gap-4 @md:grid-cols-2">
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
      </FieldGroup>

      <FieldGroup title="Licence">
        <div className="grid gap-4 @md:grid-cols-2">
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

        <div className="grid gap-4 @xs:grid-cols-2 @lg:grid-cols-3">
          <Field label="Term starts" htmlFor="termStart">
            <Input id="termStart" name="termStart" type="date" defaultValue={record?.term_start?.slice(0, 10) ?? ''} />
          </Field>
          <Field label="Term ends" htmlFor="termEnd">
            <Input id="termEnd" name="termEnd" type="date" defaultValue={record?.term_end?.slice(0, 10) ?? ''} />
          </Field>
          <Field label="Status" htmlFor="rightsStatus">
            <Select id="rightsStatus" name="status" defaultValue={record?.status ?? 'draft'}>
              {[
                ['draft', 'Draft'],
                ['active', 'Active'],
                ['expired', 'Expired'],
                ['terminated', 'Terminated'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Notes">
        <Field label="Restrictions" htmlFor="restrictions">
          <Textarea id="restrictions" name="restrictions" rows={2} maxLength={2000} defaultValue={record?.restrictions} />
        </Field>

        <Field label="Internal notes" htmlFor="rightsNotes">
          <Textarea id="rightsNotes" name="notes" rows={2} maxLength={2000} defaultValue={record?.notes} />
        </Field>
      </FieldGroup>

      <div className="space-y-4 border-t border-line pt-5">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">{record ? 'Update rights record' : 'Add rights record'}</SubmitButton>
      </div>
    </form>
  );
}

export function PublicationForm({ storyId }: { storyId: string }) {
  const [state, action] = useActionState(addPublicationAction, IDLE);
  return (
    <form action={action} className="@container space-y-4">
      <input type="hidden" name="storyId" value={storyId} />

      <div className="grid gap-4 @md:grid-cols-2">
        <Field label="Type" htmlFor="publicationType" required>
          <Select id="publicationType" name="publicationType" defaultValue="anthology">
            {[
              ['anthology', 'Anthology'],
              ['digital', 'Digital'],
              ['print', 'Print'],
              ['audio', 'Audio'],
              ['educational', 'Educational'],
              ['other', 'Other'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="pubTitle">
          <Input id="pubTitle" name="title" maxLength={200} placeholder="Perspectives: A Collection of Short Stories" />
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2 @2xl:grid-cols-3">
        {/* Not "edition": the archive form on the same page already uses that id. */}
        <Field label="Edition" htmlFor="pubEdition">
          <Input id="pubEdition" name="edition" maxLength={80} />
        </Field>
        <Field label="Publisher" htmlFor="publisher">
          <Input id="publisher" name="publisher" maxLength={160} defaultValue="Emoworld Publishers" />
        </Field>
        <Field label="Date" htmlFor="publicationDate">
          <Input id="publicationDate" name="publicationDate" type="date" />
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field label="ISBN or reference" htmlFor="isbn">
          <Input id="isbn" name="isbn" maxLength={60} />
        </Field>
        <Field label="Web address" htmlFor="url">
          <Input id="url" name="url" type="url" maxLength={400} />
        </Field>
      </div>

      <Field label="Royalty notes" htmlFor="royaltyNotes">
        <Textarea id="royaltyNotes" name="royaltyNotes" rows={2} maxLength={1000} />
      </Field>

      <div className="space-y-4 pt-1">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Record publication
        </SubmitButton>
      </div>
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
            <SubmitButton variant="outline" size="sm" pendingLabel="Queueing…" className="min-h-10 sm:min-h-0">
              Queue for Emoworld review
            </SubmitButton>
          </form>
        )}
        <form action={drain}>
          <SubmitButton
            variant="outline"
            size="sm"
            pendingLabel="Sending…"
            disabled={!enabled}
            className="min-h-10 sm:min-h-0"
          >
            Send queued stories now
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

// ---- people ----------------------------------------------------------------------------------

const PROGRAMME_ROLES: Role[] = ['writer', 'mentor', 'judge', 'editor', 'partner'];
const ADMIN_ROLES: Role[] = ['admin', 'super_admin'];

/** Roles, each with what it grants. Account status lives in AccountStatusForm. */
export function RolesForm({ userId, roles }: { userId: string; roles: Role[] }) {
  const [state, action] = useActionState(updateRolesAction, IDLE);
  const group = (title: string, list: Role[], note?: string) => (
    <fieldset>
      <legend className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</legend>
      {note && <p className="mt-1 text-[13px] text-muted">{note}</p>}
      <div className="mt-3 grid gap-x-6 gap-y-4 @lg:grid-cols-2">
        {list.map((role) => (
          <Checkbox
            key={role}
            name="roles"
            value={role}
            defaultChecked={roles.includes(role)}
            label={<span className="font-medium text-forest-900">{ROLE_LABELS[role]}</span>}
            hint={ROLE_DESCRIPTIONS[role]}
          />
        ))}
      </div>
    </fieldset>
  );

  return (
    <form action={action} className="@container space-y-6">
      <input type="hidden" name="userId" value={userId} />
      {group('Programme roles', PROGRAMME_ROLES)}
      {group('Administrator roles', ADMIN_ROLES, 'Only a super admin can grant or remove these.')}
      {/* Any role ROLES gains later still gets a checkbox. */}
      {ROLES.some((r) => !PROGRAMME_ROLES.includes(r) && !ADMIN_ROLES.includes(r)) &&
        group(
          'Other roles',
          ROLES.filter((r) => !PROGRAMME_ROLES.includes(r) && !ADMIN_ROLES.includes(r)),
        )}
      <div className="space-y-4 border-t border-line pt-5">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">Save roles</SubmitButton>
      </div>
    </form>
  );
}

/** Suspend or reactivate an account. The server re-checks every guard; `self` only spares a doomed click. */
export function AccountStatusForm({ userId, status, self }: { userId: string; status: string; self?: boolean }) {
  const [state, action] = useActionState(setUserStatusAction, IDLE);
  const active = status === 'active';

  if (self) {
    return <p className="text-sm text-muted">This is your own account. Another administrator would have to suspend it.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={active ? 'suspended' : 'active'} />
      <p className="text-sm text-muted">
        {active
          ? 'Suspending stops them signing in and ends their open sessions within 15 minutes. Their entries and records are kept.'
          : 'Reactivating lets them sign in again with their existing password.'}
      </p>
      <SubmitButton
        variant={active ? 'danger' : 'outline'}
        pendingLabel="Saving…"
        onClick={(e) => {
          if (active && !window.confirm('Suspend this account and sign them out?')) {
            e.preventDefault();
          }
        }}
      >
        {active ? 'Suspend account' : 'Reactivate account'}
      </SubmitButton>
    </form>
  );
}

// ---- inquiries & messages ------------------------------------------------------------------------

const INQUIRY_STATUSES: [string, string][] = [
  ['new', 'New'],
  ['in_review', 'In review'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['closed', 'Closed'],
];

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
    <form action={action} className="@container space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <div className="grid gap-3 @xl:grid-cols-[11rem_minmax(0,1fr)_auto] @xl:items-end">
        <Field label="Status" htmlFor={`status-${inquiryId}`}>
          <Select id={`status-${inquiryId}`} name="status" defaultValue={status}>
            {INQUIRY_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Internal note" htmlFor={`note-${inquiryId}`}>
          <Input
            id={`note-${inquiryId}`}
            name="responseNote"
            maxLength={2000}
            defaultValue={responseNote}
            placeholder="Only staff see this"
          />
        </Field>
        <SubmitButton variant="outline" pendingLabel="Saving…" className="justify-self-start">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

export function MessageStatusForm({ messageId, status }: { messageId: string; status: string }) {
  const [state, action] = useActionState(updateMessageAction, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <input type="hidden" name="messageId" value={messageId} />
      <span className="text-[13px] text-muted">Mark as</span>
      <div role="group" aria-label="Message status" className="inline-flex rounded-lg border border-line bg-white p-0.5">
        {(
          [
            ['new', 'New'],
            ['handled', 'Handled'],
            ['spam', 'Spam'],
          ] as const
        ).map(([s, label]) => (
          <button
            key={s}
            type="submit"
            name="status"
            value={s}
            aria-pressed={status === s}
            className={cx(
              'min-h-10 rounded-md px-3.5 text-[13px] transition-colors sm:min-h-8 sm:px-3',
              status === s
                ? 'bg-forest-900 font-medium text-bone'
                : 'text-muted hover:bg-forest-900/8 hover:text-forest-900',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {state.ok === false && state.message && (
        <p className="text-[13px] font-medium text-red-700" role="alert">
          {state.message}
        </p>
      )}
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
    <form action={action} className="space-y-6">
      {state === IDLE && notice && <Alert tone="success">{notice}</Alert>}
      {post && <input type="hidden" name="id" value={post.id} />}

      <div className="space-y-6">
        <FormSection title="The post" description="The headline and the short summary readers see first.">
          <Field label="Title" htmlFor="newsTitle" required>
            <Input id="newsTitle" name="title" required maxLength={200} defaultValue={v('title', post?.title)} />
          </Field>
          <Field label="Slug" htmlFor="newsSlug" hint="The web address. Leave empty to make one from the title.">
            <Input id="newsSlug" name="slug" maxLength={90} defaultValue={v('slug', post?.slug)} />
          </Field>
          <Field
            label="Summary"
            htmlFor="newsExcerpt"
            hint="One or two sentences. Shown under the picture on the news page and the homepage."
          >
            <Textarea
              id="newsExcerpt"
              name="excerpt"
              rows={2}
              maxLength={500}
              defaultValue={v('excerpt', post?.excerpt)}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Picture"
          description="Optional. Shown at the top of the post and on its news card."
        >
          {post?.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
            <img
              src={post.coverUrl}
              alt={post.coverAlt || 'Current picture'}
              className="aspect-[16/9] w-full max-w-md rounded-lg border border-line object-cover"
            />
          )}
          <div className="space-y-2">
            <FileField
              name="cover"
              accept="image/jpeg,image/png,image/webp"
              maxBytes={PICTURE_MAX_BYTES}
              label={post?.coverUrl ? 'Replace picture' : 'Choose a picture'}
            />
            <p className="text-[12px] text-muted">
              JPEG, PNG or WebP up to 4 MB. Landscape pictures work best: news cards crop to 16:9.
            </p>
          </div>
          <Field
            label="Picture description"
            htmlFor="newsCoverAlt"
            hint="What the picture shows, for readers using screen readers. For example: “Young writers at the 2026 awards evening in Harare.”"
          >
            <Input id="newsCoverAlt" name="coverAlt" maxLength={200} defaultValue={v('coverAlt', post?.coverAlt)} />
          </Field>
          {post?.coverUrl && <Checkbox name="removeCover" label="Remove the picture from this post" />}
        </FormSection>

        <FormSection title="Article" description="The full text of the post.">
          <Field
            label="Article text"
            htmlFor="newsBody"
            hint="Write normally and leave a blank line between paragraphs. If you want headings, links or lists, basic HTML works too."
          >
            <Textarea id="newsBody" name="body" rows={16} defaultValue={v('body', post?.body)} />
          </Field>
        </FormSection>

        <FormSection
          title="Publishing"
          description="Drafts are only visible to staff. Published posts appear on the news page and the homepage."
        >
          <div className="grid gap-5 xl:grid-cols-2 xl:items-end">
            <Field label="Tags" htmlFor="newsTags" hint="Comma separated, e.g. Competition, Results.">
              <Input id="newsTags" name="tags" maxLength={300} defaultValue={v('tags', post?.tags.join(', '))} />
            </Field>
            <Field label="Status" htmlFor="newsStatus">
              <Select id="newsStatus" name="status" defaultValue={v('status', post?.status) || 'draft'}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </Field>
          </div>
        </FormSection>
      </div>

      {/* Beside the button, where the eye is after pressing it. */}
      <div className="space-y-4 border-t border-line pt-6 md:pl-56">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">{post ? 'Save post' : 'Create post'}</SubmitButton>
      </div>
    </form>
  );
}

export function PageForm({
  page,
  notice,
}: {
  /** The outcome of the save that led here (from the URL); hidden once the form is used again. */
  notice?: string;
  /**
   * The page being edited; its address is then fixed. A policy not written yet
   * comes with its placeholder title and no version. Omit it to add a page at a
   * new address.
   */
  page?: {
    slug: string;
    title: string;
    summary: string;
    bodyHtml: string;
    kind: string;
    status: string;
    version: number | null;
  };
}) {
  const router = useRouter();
  const [state, action] = useActionState(async (prev: typeof IDLE, form: FormData) => {
    const result = await savePageAction(prev, form);
    // A new page carries on in its own editor, where the address is fixed.
    if (result.ok && !page) {
      router.push(`/dashboard/admin/content/pages/${encodeURIComponent(String(form.get('slug') ?? '').trim())}?saved=1`);
    }
    return result;
  }, IDLE);
  return (
    <form action={action} className="space-y-6">
      {state === IDLE && notice && <Alert tone="success">{notice}</Alert>}

      <div className="space-y-6">
        <FormSection title="The page" description="The title and summary readers see at the top of the page.">
          {page ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-forest-900">Address</p>
              <p className="text-[15px] text-forest-800 wrap-anywhere">/policies/{page.slug}</p>
              <input type="hidden" name="slug" value={page.slug} />
            </div>
          ) : (
            <Field
              label="Address"
              htmlFor="pageSlug"
              required
              hint="Lower case words joined by hyphens, e.g. accessibility. The page appears at /policies/ followed by this. An address already in use replaces that page."
            >
              <Input id="pageSlug" name="slug" required maxLength={80} />
            </Field>
          )}
          <Field label="Title" htmlFor="pageTitle" required>
            <Input id="pageTitle" name="title" required maxLength={200} defaultValue={page?.title} />
          </Field>
          <Field label="Summary" htmlFor="pageSummary" hint="One sentence shown under the title.">
            <Textarea id="pageSummary" name="summary" rows={2} maxLength={400} defaultValue={page?.summary} />
          </Field>
        </FormSection>

        <FormSection title="Wording" description="The approved text, written as basic HTML.">
          <Field
            label="Body (HTML)"
            htmlFor="pageBody"
            required
            hint="Use <p> for paragraphs, <h2> for headings, <ul> and <li> for lists and <a> for links. Scripts, styles and other unsafe code are removed when you save."
          >
            <Textarea
              id="pageBody"
              name="bodyHtml"
              rows={16}
              required
              className="font-mono"
              defaultValue={page?.bodyHtml}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Publishing"
          description="Drafts stay off the site. Until a policy is published, its public page shows the interim description."
        >
          <div className="grid gap-5 xl:grid-cols-2">
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
          <p className="text-[13px] leading-relaxed text-muted">
            {page?.version
              ? `This is version ${page.version}. Saving publishes version ${page.version + 1}.`
              : 'Saving publishes version 1.'}{' '}
            Earlier entries keep pointing at the version their writer accepted.
          </p>
        </FormSection>
      </div>

      {/* Beside the button, where the eye is after pressing it. */}
      <div className="space-y-4 border-t border-line pt-6 md:pl-56">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <SubmitButton pendingLabel="Saving…">Save page</SubmitButton>
      </div>
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
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…" className="min-h-10 sm:min-h-0">
        Save
      </SubmitButton>
    </form>
  );
}

export function NewSettingForm() {
  const [state, action] = useActionState(saveSettingAction, IDLE);

  return (
    <form action={action} className="@container space-y-3">
      <div className="grid gap-3 @xl:grid-cols-[14rem_minmax(0,1fr)]">
        <Field label="Key" htmlFor="new-setting-key" hint="For example archive.featured_limit">
          <Input id="new-setting-key" name="key" maxLength={120} pattern="[A-Za-z0-9._\-]+" required />
        </Field>
        <Field label="Value" htmlFor="new-setting-value" hint="Plain text, or a JSON document.">
          <Input id="new-setting-value" name="value" maxLength={2000} required />
        </Field>
      </div>
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…" className="min-h-10 sm:min-h-0">
        Add setting
      </SubmitButton>
    </form>
  );
}

