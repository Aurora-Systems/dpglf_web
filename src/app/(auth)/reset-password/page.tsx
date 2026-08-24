import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui';
import { ResetPasswordForm } from '@/features/auth/ResetForms';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold text-forest-900">Link not valid</h1>
        <div className="mt-6">
          <Alert tone="error">
            This reset link is missing its token. Request a new one and use the most recent email.
          </Alert>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/forgot-password" className="text-gold-700 hover:underline">
            Request a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-forest-900">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">
        For your security this link works once, and only for an hour after it was sent.
      </p>
      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </>
  );
}
