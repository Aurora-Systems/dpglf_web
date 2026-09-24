import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestResetForm } from '@/features/auth/ResetForms';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-forest-900">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the email address on your account and we will send you a link.
      </p>
      <div className="mt-8">
        <RequestResetForm />
      </div>
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="-my-2 inline-block py-2 text-gold-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
