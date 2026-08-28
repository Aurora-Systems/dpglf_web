'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { pruneAction, retryEmailsAction } from './actions';

/** Small operational controls that do not belong to any one record. */
export function PruneButton() {
  const [state, action] = useActionState(async () => pruneAction(), IDLE);

  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <p className="text-sm text-muted">
        Rate-limit counters older than a day serve no purpose. Clearing them keeps the table small.
      </p>
      <SubmitButton variant="outline" size="sm" pendingLabel="Clearing…">
        Clear old rate-limit counters
      </SubmitButton>
    </form>
  );
}

/** Re-send recorded email that never went out (e.g. domain unverified at the time). */
export function RetryEmailsButton() {
  const [state, action] = useActionState(async () => retryEmailsAction(), IDLE);

  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <SubmitButton variant="outline" size="sm" pendingLabel="Retrying…">
        Retry unsent email now
      </SubmitButton>
    </form>
  );
}
