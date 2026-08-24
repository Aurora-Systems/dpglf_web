import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSessionUser()) redirect('/dashboard');
  const { next } = await searchParams;

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-forest-900">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        New here?{' '}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-gold-700 hover:underline">
          Create an account
        </Link>
      </p>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
    </>
  );
}
