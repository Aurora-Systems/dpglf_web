'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { Checkbox, Field, Input, Textarea } from '@/components/form';
import { Alert } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { saveProfileAction } from './actions';

export function ProfileForm({
  profile,
}: {
  profile: {
    displayName: string;
    penName: string;
    bio: string;
    country: string;
    city: string;
    school: string;
    languages: string;
    website: string;
    achievements: string;
    isPublic: boolean;
    slug: string | null;
  };
}) {
  const [state, action] = useActionState(saveProfileAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Display name" htmlFor="displayName" required error={state.errors?.displayName}>
          <Input id="displayName" name="displayName" required maxLength={120} defaultValue={profile.displayName} />
        </Field>
        <Field label="Pen name" htmlFor="penName" hint="Optional. Used instead of your name on published work.">
          <Input id="penName" name="penName" maxLength={120} defaultValue={profile.penName} />
        </Field>
      </div>

      <Field label="About you" htmlFor="bio" hint="A short biography for your author page.">
        <Textarea id="bio" name="bio" rows={5} maxLength={2000} defaultValue={profile.bio} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Country" htmlFor="country">
          <Input id="country" name="country" maxLength={80} defaultValue={profile.country} />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" maxLength={80} defaultValue={profile.city} />
        </Field>
        <Field label="School" htmlFor="school" hint="Not shown publicly.">
          <Input id="school" name="school" maxLength={160} defaultValue={profile.school} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Languages you write in" htmlFor="languages" hint="Comma separated.">
          <Input id="languages" name="languages" maxLength={200} defaultValue={profile.languages} />
        </Field>
        <Field label="Website" htmlFor="website" error={state.errors?.website}>
          <Input id="website" name="website" type="url" maxLength={300} defaultValue={profile.website} />
        </Field>
      </div>

      <Field label="Achievements" htmlFor="achievements" hint="Prizes, publications, anything you are proud of.">
        <Textarea id="achievements" name="achievements" rows={3} maxLength={2000} defaultValue={profile.achievements} />
      </Field>

      <div className="rounded-lg bg-parchment p-4">
        <Checkbox
          name="isPublic"
          defaultChecked={profile.isPublic}
          label="Publish my author page"
          hint={
            profile.slug
              ? `Your page would be at /authors/${profile.slug}. Only the fields above appear, never your email, school or account details.`
              : 'Only the fields above appear, never your email, school or account details.'
          }
        />
        {profile.isPublic && profile.slug && (
          <Link href={`/authors/${profile.slug}`} className="mt-3 inline-block text-[13px] text-gold-700 underline">
            View my public page
          </Link>
        )}
      </div>

      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
