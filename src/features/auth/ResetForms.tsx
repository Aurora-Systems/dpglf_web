'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Field, Input } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { requestResetAction, resendVerificationAction, resetPasswordAction } from './actions';

export function RequestResetForm() {
  const [state, action] = useActionState(requestResetAction, IDLE);

  if (state.ok) {
    return (
      <Alert tone="success" title="Check your inbox">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <Field label="Email" htmlFor="email" required error={state.errors?.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        htmlFor="password"
        required
        error={state.errors?.password}
        hint="At least 10 characters. Signing in again on your other devices will be required."
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          autoFocus
        />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}

/** Shown in the dashboard when an account still has an unverified email. */
export function ResendVerification() {
  const [state, action] = useActionState(
    async () => resendVerificationAction(),
    IDLE,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
        Resend verification email
      </SubmitButton>
      {state.message && (
        <span className={state.ok ? 'text-[13px] text-emerald-800' : 'text-[13px] text-red-700'}>
          {state.message}
        </span>
      )}
    </form>
  );
}
