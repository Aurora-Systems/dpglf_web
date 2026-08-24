'use client';

import { useActionState } from 'react';
import { CountedTextarea, FileField, SubmitButton } from '@/components/client';
import { Checkbox, Field, Input, Select } from '@/components/form';
import { Alert, Badge } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { MANUSCRIPT_ACCEPT, MANUSCRIPT_LIMIT } from './rules';
import {
  requestConsentAction,
  saveMetaAction,
  submitAction,
  uploadManuscriptAction,
} from './actions';

const LANGUAGES = [
  'English',
  'Shona',
  'Ndebele',
  'Swahili',
  'Yoruba',
  'Igbo',
  'Zulu',
  'Amharic',
  'French',
  'Portuguese',
  'Arabic',
];

const GENRES = [
  'Historical fiction',
  'Contemporary fiction',
  'Folklore and myth',
  'Speculative / Afrofuturism',
  'Adventure',
  'Mystery',
  'Coming of age',
  'Humour',
  'Drama',
  'Other',
];

// ---- step: story details ------------------------------------------------------

export function MetaForm({
  submissionId,
  defaults,
  competitionThemes,
}: {
  submissionId: string;
  defaults: {
    title: string;
    synopsis: string;
    language: string;
    genre: string | null;
    themes: string[];
    culturalContext: string;
  };
  competitionThemes: string[];
}) {
  const [state, action] = useActionState(saveMetaAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />

      <Field label="Story title" htmlFor="title" required error={state.errors?.title}>
        <Input id="title" name="title" required maxLength={180} defaultValue={defaults.title} />
      </Field>

      <Field
        label="Synopsis"
        htmlFor="synopsis"
        required
        hint="A short summary for the judges — what happens, and why it matters."
        error={state.errors?.synopsis}
      >
        <CountedTextarea
          id="synopsis"
          name="synopsis"
          required
          min={40}
          max={1500}
          rows={5}
          defaultValue={defaults.synopsis}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Language" htmlFor="language" required>
          <Select id="language" name="language" defaultValue={defaults.language || 'English'}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Genre" htmlFor="genre">
          <Select id="genre" name="genre" defaultValue={defaults.genre ?? ''}>
            <option value="">Choose a genre</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {competitionThemes.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-forest-900">Themes</legend>
          <p className="mt-1 text-[13px] text-muted">
            Choose up to six. These help the archive stay findable years from now.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {competitionThemes.map((theme) => (
              <Checkbox
                key={theme}
                name="themes"
                value={theme}
                label={theme}
                defaultChecked={defaults.themes.includes(theme)}
              />
            ))}
          </div>
        </fieldset>
      )}

      <Field
        label="Cultural context"
        htmlFor="culturalContext"
        hint="Optional. The tradition, place, language or history a reader should know about. This is preserved with the story."
      >
        <CountedTextarea
          id="culturalContext"
          name="culturalContext"
          max={1000}
          rows={4}
          defaultValue={defaults.culturalContext}
        />
      </Field>

      <SubmitButton pendingLabel="Saving…">Save story details</SubmitButton>
    </form>
  );
}

// ---- step: manuscript --------------------------------------------------------------

export function ManuscriptForm({
  submissionId,
  currentName,
  wordMin,
  wordMax,
}: {
  submissionId: string;
  currentName: string | null;
  wordMin: number;
  wordMax: number;
}) {
  const [state, action] = useActionState(uploadManuscriptAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />

      <p className="text-sm text-muted">
        Word (.docx), PDF, RTF or plain text, up to 10 MB. This competition accepts{' '}
        <strong className="text-forest-900">
          {wordMin.toLocaleString()}–{wordMax.toLocaleString()} words
        </strong>
        , which we check from your file.
      </p>

      <FileField
        name="manuscript"
        accept={MANUSCRIPT_ACCEPT}
        maxBytes={MANUSCRIPT_LIMIT}
        currentName={currentName}
        required={!currentName}
        label="Choose manuscript"
      />

      <SubmitButton pendingLabel="Uploading…">
        {currentName ? 'Replace manuscript' : 'Upload manuscript'}
      </SubmitButton>

      {currentName && (
        <p className="text-[13px] text-muted">
          Replacing the file before you submit is fine. After submission, the original is kept
          permanently and any changes become new versions.
        </p>
      )}
    </form>
  );
}

// ---- step: guardian consent ----------------------------------------------------------

export function ConsentForm({
  submissionId,
  consentStatus,
  guardianEmail,
}: {
  submissionId: string;
  consentStatus: string | null;
  guardianEmail: string | null;
}) {
  const [state, action] = useActionState(requestConsentAction, IDLE);

  return (
    <div className="space-y-4">
      {consentStatus === 'granted' && (
        <Alert tone="success" title="Consent given">
          {guardianEmail} has given consent for this entry.
        </Alert>
      )}
      {consentStatus === 'pending' && (
        <Alert tone="warning" title="Waiting for your guardian">
          We emailed {guardianEmail}. Ask them to check their inbox — including the spam folder.
        </Alert>
      )}
      {consentStatus === 'revoked' && (
        <Alert tone="error" title="Consent was declined">
          Send the request again below if this was a mistake.
        </Alert>
      )}

      <form action={action} className="space-y-5">
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
        <input type="hidden" name="submissionId" value={submissionId} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Guardian’s name" htmlFor="guardianName" required error={state.errors?.guardianName}>
            <Input id="guardianName" name="guardianName" required maxLength={120} />
          </Field>
          <Field
            label="Guardian’s email"
            htmlFor="guardianEmail"
            required
            error={state.errors?.guardianEmail}
            hint="We send the consent link here."
          >
            <Input id="guardianEmail" name="guardianEmail" type="email" required />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="They are your" htmlFor="relationship" required error={state.errors?.relationship}>
            <Input id="relationship" name="relationship" required placeholder="Mother, father, guardian…" maxLength={60} />
          </Field>
          <Field label="Phone (optional)" htmlFor="guardianPhone">
            <Input id="guardianPhone" name="guardianPhone" type="tel" maxLength={40} />
          </Field>
        </div>

        <SubmitButton pendingLabel="Sending…" variant={consentStatus ? 'outline' : 'primary'}>
          {consentStatus ? 'Send the request again' : 'Send consent request'}
        </SubmitButton>
      </form>
    </div>
  );
}

// ---- step: declarations and submit ---------------------------------------------------------

export function SubmitForm({
  submissionId,
  blockers,
  rulesVersion,
  competitionSlug,
}: {
  submissionId: string;
  blockers: string[];
  rulesVersion: string;
  competitionSlug: string;
}) {
  const [state, action] = useActionState(submitAction, IDLE);
  const blocked = blockers.length > 0;

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />

      {blocked && (
        <Alert tone="warning" title="Not quite ready">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="space-y-3.5">
        <Checkbox
          name="original"
          required
          label="This story is my own original work."
          hint="Written by me, not copied, and not generated by someone or something else."
        />
        <Checkbox name="ownsCopyright" required label="I own the copyright in this story." />
        <Checkbox
          name="permissions"
          required
          label="I have permission for anything in the story that is not mine."
          hint="Quotations, real people’s words, images or material from other sources."
        />
        <Checkbox
          name="acceptsRules"
          required
          label={
            <>
              I have read and accept the competition rules{' '}
              <Badge tone="gold">{rulesVersion}</Badge> and the{' '}
              <a href="/policies/submissions" target="_blank" className="text-gold-700 underline">
                submission policy
              </a>
              .
            </>
          }
          hint={`The version you accept is recorded with your entry. Full rules are on the ${competitionSlug} programme page.`}
        />
      </div>

      <div className="rounded-lg bg-parchment px-4 py-3 text-[13px] leading-relaxed text-muted">
        Once submitted, your entry is locked and given a permanent reference number. You will get a
        receipt by email. You keep copyright in your story.
      </div>

      <SubmitButton size="lg" variant="gold" disabled={blocked} pendingLabel="Submitting…">
        Submit my entry
      </SubmitButton>
    </form>
  );
}
