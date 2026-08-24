'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { pruneAction } from './actions';

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
