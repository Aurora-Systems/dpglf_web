'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/client';
import { Checkbox, Field, Input, Select } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { signupAction } from './actions';

const AGE_BANDS = [
  ['13_15', '13 to 15'],
  ['16_17', '16 to 17'],
  ['18_24', '18 to 24'],
  ['25_plus', '25 or older'],
  ['under_13', 'Under 13'],
] as const;

const MINOR_BANDS = new Set(['under_13', '13_15', '16_17']);

export function SignupForm() {
  const [state, action] = useActionState(signupAction, IDLE);
  const [ageBand, setAgeBand] = useState('16_17');
  const isMinor = MINOR_BANDS.has(ageBand);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <Field label="Your name" htmlFor="name" required error={state.errors?.name}>
        <Input id="name" name="name" required autoComplete="name" maxLength={120} autoFocus />
      </Field>

      <Field
        label="Email"
        htmlFor="email"
        required
        error={state.errors?.email}
        hint="We send your submission receipt and status updates here."
      >
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.errors?.password}
        hint="At least 10 characters."
      >
        <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={10} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Age group"
          htmlFor="ageBand"
          required
          error={state.errors?.ageBand}
          hint="Programmes have age rules."
        >
          <Select
            id="ageBand"
            name="ageBand"
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value)}
          >
            {AGE_BANDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country" htmlFor="country" hint="Some programmes are country-specific.">
          <Input id="country" name="country" maxLength={80} autoComplete="country-name" />
        </Field>
      </div>

      {isMinor && (
        <Alert tone="info" title="You will need a parent or guardian">
          Because you are under eighteen, a parent or guardian has to give consent before your entry
          can be judged. We ask for their details during the submission, not now.
        </Alert>
      )}

      <Checkbox
        name="acceptTerms"
        required
        label={
          <>
            I accept the{' '}
            <Link href="/policies/terms" className="text-gold-700 underline" target="_blank">
              terms of use
            </Link>{' '}
            and the{' '}
            <Link href="/policies/privacy" className="text-gold-700 underline" target="_blank">
              privacy notice
            </Link>
            .
          </>
        }
      />
      {state.errors?.acceptTerms && (
        <p className="text-[13px] font-medium text-red-700">{state.errors.acceptTerms}</p>
      )}

      <SubmitButton className="w-full" size="lg" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
