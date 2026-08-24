'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Radio } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { deadlineLabel } from '@/lib/format';
import { startSubmissionAction } from './actions';

export function StartSubmission({
  competitions,
  defaultId,
}: {
  competitions: { id: string; name: string; tagline: string; closes_at: string | null }[];
  defaultId: string;
}) {
  const [state, action] = useActionState(startSubmissionAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-forest-900">Which programme are you entering?</legend>
        {competitions.map((c) => (
          <Radio
            key={c.id}
            name="competitionId"
            value={c.id}
            defaultChecked={c.id === defaultId}
            label={c.name}
            hint={`${c.tagline ? `${c.tagline} · ` : ''}${deadlineLabel(c.closes_at)}`}
          />
        ))}
      </fieldset>

      <SubmitButton size="lg" variant="gold" pendingLabel="Creating your draft…">
        Start my entry
      </SubmitButton>
    </form>
  );
}
