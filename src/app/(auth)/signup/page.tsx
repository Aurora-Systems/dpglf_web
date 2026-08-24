import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { SignupForm } from '@/features/auth/SignupForm';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function SignupPage() {
  if (await getSessionUser()) redirect('/dashboard');

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-forest-900">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Already registered?{' '}
        <Link href="/login" className="text-gold-700 hover:underline">
          Sign in
        </Link>
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
    </>
  );
}
