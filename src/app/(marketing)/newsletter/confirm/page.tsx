import type { Metadata } from 'next';
import { Alert, ButtonLink, Eyebrow } from '@/components/ui';
import { confirmNewsletter } from '@/features/marketing/actions';

export const metadata: Metadata = { title: 'Newsletter', robots: { index: false } };

export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const confirmed = token ? await confirmNewsletter(token) : false;

  return (
    <div className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
      <Eyebrow>Newsletter</Eyebrow>
      <h1 className="font-display mt-3 text-3xl font-semibold text-forest-900">
        {confirmed ? 'You are subscribed' : 'That link did not work'}
      </h1>
      <div className="mt-6">
        {confirmed ? (
          <Alert tone="success" title="Confirmed">
            You will receive calls for submissions, anthology news and Foundation updates. Every
            email includes a way to unsubscribe.
          </Alert>
        ) : (
          <Alert tone="error" title="Expired or already used">
            Confirmation links work once. Subscribe again from any page on the site and we will send
            you a fresh one.
          </Alert>
        )}
      </div>
      <ButtonLink href="/" className="mt-8">
        Back to the Foundation
      </ButtonLink>
    </div>
  );
}
