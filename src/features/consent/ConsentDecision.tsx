'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { decideConsentAction } from './actions';

export function ConsentDecision({ token, alreadyGranted }: { token: string; alreadyGranted: boolean }) {
  const [state, action] = useActionState(decideConsentAction, IDLE);

  if (state.ok) {
    return (
      <Alert tone="success" title="Recorded">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton
          name="decision"
          value="grant"
          size="lg"
          variant="gold"
          pendingLabel="Recording…"
          disabled={alreadyGranted}
        >
          {alreadyGranted ? 'Consent already given' : 'I give consent'}
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="decline"
          size="lg"
          variant="outline"
          pendingLabel="Recording…"
          onClick={(e) => {
            if (
              !window.confirm(
                'Declining withdraws this entry from the competition. Are you sure?',
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          {alreadyGranted ? 'Withdraw my consent' : 'I do not give consent'}
        </SubmitButton>
      </div>
    </form>
  );
}
