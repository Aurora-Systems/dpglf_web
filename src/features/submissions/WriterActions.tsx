'use client';

import { useActionState } from 'react';
import { ConfirmSubmit, FileField, SubmitButton } from '@/components/client';
import { Field, Input } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { MANUSCRIPT_ACCEPT, MANUSCRIPT_LIMIT } from './rules';
import { uploadRevisionAction, withdrawAction } from './actions';

export function WithdrawButton({ submissionId }: { submissionId: string }) {
  const [state, action] = useActionState(withdrawAction, IDLE);

  if (state.ok) return <Alert tone="info">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <ConfirmSubmit
        message="Withdrawing removes this entry from the competition. This cannot be undone by you. Continue?"
        pendingLabel="Withdrawing…"
      >
        Withdraw this entry
      </ConfirmSubmit>
    </form>
  );
}

export function RevisionUpload({ submissionId }: { submissionId: string }) {
  const [state, action] = useActionState(uploadRevisionAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <input type="hidden" name="submissionId" value={submissionId} />

      <FileField
        name="manuscript"
        accept={MANUSCRIPT_ACCEPT}
        maxBytes={MANUSCRIPT_LIMIT}
        required
        label="Choose revised file"
      />

      <Field
        label="What changed?"
        htmlFor="changeNote"
        hint="A one-line note helps your mentor see what to look at."
      >
        <Input id="changeNote" name="changeNote" maxLength={500} placeholder="Rewrote the ending…" />
      </Field>

      <SubmitButton pendingLabel="Uploading…">Upload new version</SubmitButton>
      <p className="text-[13px] text-muted">
        Earlier versions are always kept. Nothing you upload here replaces your original submission.
      </p>
    </form>
  );
}
