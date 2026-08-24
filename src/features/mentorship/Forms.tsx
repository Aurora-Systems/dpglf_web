'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/form';
import { Alert, cx } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import {
  addMilestoneAction,
  assignMentorAction,
  endMentorshipAction,
  postFeedbackAction,
  setMilestoneStatusAction,
} from './actions';
import { advanceSubmissionAction } from '@/features/workflow/actions';

export function FeedbackForm({
  submissionId,
  threadId,
  canPostInternal,
}: {
  submissionId: string;
  threadId?: string;
  canPostInternal: boolean;
}) {
  const [s, formAction] = useActionState(postFeedbackAction, IDLE);

  return (
    <form action={formAction} className="space-y-4">
      {s.message && <Alert tone={s.ok ? 'success' : 'error'}>{s.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />
      {threadId && <input type="hidden" name="threadId" value={threadId} />}

      {!threadId && (
        <Field label="Subject" htmlFor="subject">
          <Input id="subject" name="subject" maxLength={160} placeholder="Notes on the second draft" />
        </Field>
      )}

      <Field label="Message" htmlFor="body" required error={s.errors?.body}>
        <Textarea id="body" name="body" rows={5} required minLength={2} maxLength={6000} />
      </Field>

      {canPostInternal && (
        <Checkbox
          name="visibility"
          value="internal"
          label="Internal only"
          hint="Visible to Foundation staff and editors. The writer will not see this."
        />
      )}

      <SubmitButton pendingLabel="Posting…">Post feedback</SubmitButton>
    </form>
  );
}

export function AssignMentorForm({
  submissions,
  mentors,
}: {
  submissions: { id: string; title: string; writer_name: string; competition_name: string }[];
  mentors: { id: string; name: string; active_mentees: number }[];
}) {
  const [state, action] = useActionState(assignMentorAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <Field label="Writer and story" htmlFor="submissionId" required>
        <Select id="submissionId" name="submissionId" required defaultValue="">
          <option value="" disabled>
            Choose a shortlisted entry
          </option>
          {submissions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.writer_name} — {s.title || 'Untitled'} ({s.competition_name})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Mentor" htmlFor="mentorId" required hint="Ordered by how many mentees they already have.">
        <Select id="mentorId" name="mentorId" required defaultValue="">
          <option value="" disabled>
            Choose a mentor
          </option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.active_mentees} active
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Goal for this mentorship"
        htmlFor="goal"
        hint="What should be different about the story by the end?"
      >
        <Textarea id="goal" name="goal" rows={3} maxLength={1000} />
      </Field>

      <SubmitButton pendingLabel="Pairing…">Create the pairing</SubmitButton>
    </form>
  );
}

export function MilestoneControls({
  milestoneId,
  status,
}: {
  milestoneId: string;
  status: string;
}) {
  const [, action] = useActionState(setMilestoneStatusAction, IDLE);

  return (
    <form action={action} className="flex gap-1">
      <input type="hidden" name="milestoneId" value={milestoneId} />
      {(
        [
          ['pending', 'To do'],
          ['in_progress', 'Doing'],
          ['completed', 'Done'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="submit"
          name="status"
          value={value}
          className={cx(
            'rounded-md px-2.5 py-1 text-[12px] transition-colors',
            status === value
              ? 'bg-forest-900 text-bone'
              : 'text-muted hover:bg-forest-900/8 hover:text-forest-900',
          )}
        >
          {label}
        </button>
      ))}
    </form>
  );
}

export function AddMilestoneForm({ mentorshipId }: { mentorshipId: string }) {
  const [state, action] = useActionState(addMilestoneAction, IDLE);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
      {state.message && (
        <div className="sm:col-span-3">
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <input type="hidden" name="mentorshipId" value={mentorshipId} />
      <Field label="New milestone" htmlFor="title">
        <Input id="title" name="title" required maxLength={160} placeholder="Second draft due" />
      </Field>
      <Field label="Due" htmlFor="dueAt">
        <Input id="dueAt" name="dueAt" type="date" />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Adding…">
        Add
      </SubmitButton>
    </form>
  );
}

export function EndMentorshipForm({ mentorshipId }: { mentorshipId: string }) {
  const [state, action] = useActionState(endMentorshipAction, IDLE);
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action}>
      <input type="hidden" name="mentorshipId" value={mentorshipId} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
        Mark mentorship complete
      </SubmitButton>
    </form>
  );
}

/** Shared control for moving a submission along the pipeline. */
export function AdvanceForm({
  submissionId,
  options,
  label = 'Move to',
  requireNote,
}: {
  submissionId: string;
  options: { to: string; label: string }[];
  label?: string;
  requireNote?: boolean;
}) {
  const [state, action] = useActionState(advanceSubmissionAction, IDLE);

  if (options.length === 0) {
    return <p className="text-[13px] text-muted">No further moves are available from here.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />

      <Field label={label} htmlFor={`to-${submissionId}`}>
        <Select id={`to-${submissionId}`} name="to" defaultValue={options[0].to}>
          {options.map((o) => (
            <option key={o.to} value={o.to}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Note"
        htmlFor={`note-${submissionId}`}
        hint="Included in the writer’s email where one is sent, and kept in the entry’s history."
      >
        <Textarea
          id={`note-${submissionId}`}
          name="note"
          rows={2}
          maxLength={1000}
          required={requireNote}
        />
      </Field>

      <SubmitButton size="sm" pendingLabel="Updating…">
        Apply
      </SubmitButton>
    </form>
  );
}
