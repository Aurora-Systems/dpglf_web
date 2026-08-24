'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Field, Input, Select, Textarea } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { inquiryAction } from './actions';

const FORMATS = [
  ['animation', 'Animation'],
  ['film', 'Feature film'],
  ['television', 'Television series'],
  ['audio', 'Audio drama or podcast'],
  ['educational', 'Educational media'],
  ['publishing', 'Publishing or translation'],
  ['other', 'Something else'],
] as const;

/**
 * Expression of interest from a publisher, producer or researcher. The MVP is
 * deliberately an inquiry workflow rather than a rights marketplace — contract
 * rules have to be validated operationally before any of that is automated.
 */
export function InquiryForm({ storyId, storyTitle }: { storyId?: string; storyTitle?: string }) {
  const [state, action] = useActionState(inquiryAction, IDLE);

  if (state.ok) {
    return (
      <Alert tone="success" title="Enquiry received">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      {storyId && <input type="hidden" name="storyId" value={storyId} />}
      {storyTitle && (
        <p className="rounded-lg bg-parchment px-4 py-3 text-sm text-forest-800">
          Enquiry about <strong>{storyTitle}</strong>
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="requesterName" required error={state.errors?.requesterName}>
          <Input id="requesterName" name="requesterName" required autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="requesterEmail" required error={state.errors?.requesterEmail}>
          <Input id="requesterEmail" name="requesterEmail" type="email" required autoComplete="email" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Organisation" htmlFor="organisation">
          <Input id="organisation" name="organisation" maxLength={160} />
        </Field>
        <Field label="Your role" htmlFor="requesterRole">
          <Input id="requesterRole" name="requesterRole" maxLength={120} placeholder="Producer, commissioning editor…" />
        </Field>
      </div>

      <Field label="Format of interest" htmlFor="format" required>
        <Select id="format" name="format" defaultValue="animation">
          {FORMATS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Tell us about your interest"
        htmlFor="message"
        required
        hint="What you have in mind, your organisation’s track record, and the rights you would be seeking."
        error={state.errors?.message}
      >
        <Textarea id="message" name="message" required rows={6} minLength={20} maxLength={3000} />
      </Field>

      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel="Sending…">Send enquiry</SubmitButton>
        <p className="max-w-md text-[13px] text-muted">
          Authors retain copyright. Any licence is negotiated with the Foundation and agreed with
          the author before it takes effect.
        </p>
      </div>
    </form>
  );
}
