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
        To slow down abuse, the site counts sign-ins, sign-ups, form posts and uploads in windows of up to an hour.
        This clears counters older than a day. It does not change anyone&apos;s limits, emails or activity. The
        scheduled maintenance job does the same automatically.
      </p>
      <SubmitButton variant="outline" size="sm" pendingLabel="Clearing…" className="min-h-10 sm:min-h-0">
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
      <SubmitButton variant="outline" size="sm" pendingLabel="Retrying…" className="min-h-10 sm:min-h-0">
        Retry failed emails
      </SubmitButton>
    </form>
  );
}
