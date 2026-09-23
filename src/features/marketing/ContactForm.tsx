'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Field, Input, Select, Textarea } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { contactAction } from './actions';

const TOPICS = [
  ['general', 'General enquiry'],
  ['submissions', 'Submissions and competitions'],
  ['partnership', 'Partnership'],
  ['schools', 'Schools and education'],
  ['rights', 'Rights, licensing and adaptation'],
  ['media', 'Media and press'],
  ['support', 'Supporting the Foundation'],
] as const;

export function ContactForm({ defaultTopic = 'general' }: { defaultTopic?: string }) {
  const [state, action] = useActionState(contactAction, IDLE);

  if (state.ok) {
    return (
      <Alert tone="success" title="Message sent">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" required autoComplete="name" maxLength={120} />
        </Field>
        <Field label="Email" htmlFor="email" required error={state.errors?.email}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Organisation" htmlFor="organisation" hint="School, publisher, studio or funder, if relevant.">
          <Input id="organisation" name="organisation" maxLength={160} />
        </Field>
        <Field label="What is this about?" htmlFor="topic" required>
          <Select id="topic" name="topic" defaultValue={defaultTopic}>
            {TOPICS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" maxLength={200} />
      </Field>

      <Field label="Message" htmlFor="message" required error={state.errors?.message}>
        <Textarea id="message" name="message" required rows={7} minLength={20} maxLength={4000} />
      </Field>

      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
        <p className="text-[13px] text-muted">We reply to most messages within a few working days.</p>
      </div>
    </form>
  );
}
