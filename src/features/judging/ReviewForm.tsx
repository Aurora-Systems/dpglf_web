'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/client';
import { Field, Radio, Textarea } from '@/components/form';
import { Alert, cx } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import type { Criterion } from './queries';
import { declareConflictAction, saveReviewAction } from './actions';

interface ExistingScore {
  criterion_id: string;
  score: string;
  comment: string;
}

export function ReviewForm({
  assignmentId,
  criteria,
  existing,
  locked,
  allowRevision,
}: {
  assignmentId: string;
  criteria: Criterion[];
  existing: { comments: string; internal_notes: string; recommendation: string | null; scores: ExistingScore[] } | null;
  locked: boolean;
  allowRevision: boolean;
}) {
  const [state, action] = useActionState(saveReviewAction, IDLE);
  const byId = new Map((existing?.scores ?? []).map((s) => [s.criterion_id, s]));
  const readOnly = locked && !allowRevision;

  return (
    <form action={action} className="space-y-7">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {readOnly && (
        <Alert tone="info" title="This score is final">
          Scoring locks when a judge submits it. Ask a programme administrator if it needs to change.
        </Alert>
      )}
      <input type="hidden" name="assignmentId" value={assignmentId} />

      {criteria.length === 0 ? (
        <Alert tone="warning" title="No rubric has been set for this competition">
          You can still leave written comments and a recommendation. Ask an administrator to attach a
          rubric if scoring is expected.
        </Alert>
      ) : (
        <ol className="space-y-6">
          {criteria.map((c, i) => (
            <li key={c.id}>
              <ScoreRow
                index={i + 1}
                criterion={c}
                defaultScore={byId.get(c.id)?.score ?? ''}
                defaultComment={byId.get(c.id)?.comment ?? ''}
                disabled={readOnly}
              />
            </li>
          ))}
        </ol>
      )}

      <Field
        label="Comments for the Foundation"
        htmlFor="comments"
        hint="What worked, what did not, and why. These may be summarised back to the writer."
      >
        <Textarea
          id="comments"
          name="comments"
          rows={6}
          maxLength={4000}
          disabled={readOnly}
          defaultValue={existing?.comments ?? ''}
        />
      </Field>

      <Field
        label="Internal notes"
        htmlFor="internalNotes"
        hint="Never shown to the writer. Use for concerns, comparisons or flags."
      >
        <Textarea
          id="internalNotes"
          name="internalNotes"
          rows={3}
          maxLength={4000}
          disabled={readOnly}
          defaultValue={existing?.internal_notes ?? ''}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-forest-900">Your recommendation</legend>
        {[
          ['shortlist', 'Shortlist', 'Should go through to the next stage.'],
          ['maybe', 'Borderline', 'Has merit; depends on the rest of the field.'],
          ['reject', 'Not this time', 'Not ready for the next stage.'],
        ].map(([value, label, hint]) => (
          <Radio
            key={value}
            name="recommendation"
            value={value}
            label={label}
            hint={hint}
            disabled={readOnly}
            defaultChecked={(existing?.recommendation ?? 'maybe') === value}
          />
        ))}
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <SubmitButton variant="outline" pendingLabel="Saving…">
            Save progress
          </SubmitButton>
          <SubmitButton
            name="final"
            value="true"
            variant="gold"
            pendingLabel="Submitting…"
            onClick={(e) => {
              if (!window.confirm('Submitting locks your score. Continue?')) e.preventDefault();
            }}
          >
            Submit final score
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

function ScoreRow({
  index,
  criterion,
  defaultScore,
  defaultComment,
  disabled,
}: {
  index: number;
  criterion: Criterion;
  defaultScore: string;
  defaultComment: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(defaultScore);
  const steps = Array.from({ length: criterion.max_score + 1 }, (_, i) => i);

  return (
    <div className="rounded-xl border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-forest-900">
          {index}. {criterion.label}
        </h3>
        <span className="text-xs text-muted">
          0–{criterion.max_score}
          {Number(criterion.weight) !== 1 && ` · weight ×${criterion.weight}`}
        </span>
      </div>
      {criterion.description && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{criterion.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label={`Score for ${criterion.label}`}>
        {steps.map((n) => (
          <label
            key={n}
            className={cx(
              'cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors',
              value === String(n)
                ? 'border-forest-900 bg-forest-900 text-bone'
                : 'border-line text-forest-700 hover:border-forest-900/40',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={`score:${criterion.id}`}
              value={n}
              className="sr-only"
              disabled={disabled}
              checked={value === String(n)}
              onChange={() => setValue(String(n))}
            />
            {n}
          </label>
        ))}
      </div>

      <div className="mt-3">
        <label htmlFor={`comment-${criterion.id}`} className="sr-only">
          Comment on {criterion.label}
        </label>
        <Textarea
          id={`comment-${criterion.id}`}
          name={`comment:${criterion.id}`}
          rows={2}
          maxLength={1000}
          disabled={disabled}
          defaultValue={defaultComment}
          placeholder="Optional note on this criterion"
        />
      </div>
    </div>
  );
}

export function ConflictForm({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(declareConflictAction, IDLE);
  const [open, setOpen] = useState(false);

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-clay underline hover:no-underline"
      >
        I have a conflict of interest with this entry
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-clay/30 bg-clay/5 p-4">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Field
        label="Declare a conflict of interest"
        htmlFor="note"
        required
        hint="Recognising the writer, having taught them, or any other reason you cannot judge this entry impartially."
      >
        <Textarea id="note" name="note" rows={3} required minLength={5} maxLength={600} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton variant="danger" size="sm" pendingLabel="Sending…">
          Declare conflict and remove this entry
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
