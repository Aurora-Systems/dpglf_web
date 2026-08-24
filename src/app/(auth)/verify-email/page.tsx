import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, ButtonLink } from '@/components/ui';
import { verifyEmailToken } from '@/features/auth/actions';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : 'invalid';

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-forest-900">
        {result === 'invalid' ? 'That link did not work' : 'Email confirmed'}
      </h1>

      <div className="mt-6">
        {result === 'verified' && (
          <Alert tone="success" title="Your email address is confirmed">
            Your account is fully active. You can now start a submission.
          </Alert>
        )}
        {result === 'already' && (
          <Alert tone="info" title="Already confirmed">
            This address was confirmed previously — nothing more to do.
          </Alert>
        )}
        {result === 'invalid' && (
          <Alert tone="error" title="Expired or already used">
            Verification links last 24 hours and work once. Sign in and request a new one from your
            dashboard.
          </Alert>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/dashboard">Go to my dashboard</ButtonLink>
        <ButtonLink href="/submit" variant="outline">
          Start a submission
        </ButtonLink>
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link href="/contact" className="text-gold-700 hover:underline">
          Need help? Contact the Foundation
        </Link>
      </p>
    </>
  );
}
