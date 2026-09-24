'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Field, Input } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { loginAction } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}

      <Field label="Email" htmlFor="email" required error={state.errors?.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.errors?.password}
        hint={
          <Link href="/forgot-password" className="-my-1.5 inline-block py-1.5 text-gold-700 hover:underline">
            Forgotten your password?
          </Link>
        }
      >
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
