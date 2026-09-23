import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Card, DescList } from '@/components/ui';
import { Logo } from '@/components/site/Logo';
import { SITE } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { ConsentDecision } from '@/features/consent/ConsentDecision';
import { consentByToken } from '@/features/consent/actions';

export const metadata: Metadata = { title: 'Guardian consent', robots: { index: false } };

/**
 * Public, token-addressed page. The guardian has no account — the link in their
 * email is the credential, so the page shows only what that one request covers.
 */
export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await consentByToken(token);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-parchment">
      <header className="border-b border-line bg-forest-950 px-5 py-4 sm:px-8">
        <Logo tone="dark" />
      </header>

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-14 sm:px-8">
        {!record ? (
          <Card className="p-8">
            <h1 className="font-display text-2xl font-semibold text-forest-900">
              This consent link is not valid
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              It may have been mistyped, or the entry it belonged to may have been removed. Ask the
              writer to resend the request from their dashboard, or{' '}
              <Link href="/contact" className="text-gold-700 underline">
                contact the Foundation
              </Link>
              .
            </p>
          </Card>
        ) : (
          <>
            <p className="eyebrow text-gold-700">Guardian consent</p>
            <h1 className="font-display mt-3 text-3xl leading-tight font-semibold text-forest-900">
              {record.writer_name} would like to enter{' '}
              {record.competition_name ?? 'a Foundation programme'}
            </h1>
            <p className="mt-4 leading-relaxed text-muted">
              Hello {record.guardian_name}. Because {record.writer_name.split(' ')[0]} is under
              eighteen, the {SITE.shortName} needs your consent before their story can be
              considered. Please read what this covers, then choose below.
            </p>

            {record.status === 'granted' && (
              <div className="mt-6">
                <Alert tone="success" title="Consent already recorded">
                  Given on {formatDate(record.granted_at)}. You can withdraw it below at any time.
                </Alert>
              </div>
            )}
            {record.status === 'revoked' && (
              <div className="mt-6">
                <Alert tone="warning" title="Consent was declined or withdrawn">
                  {record.submission_status === 'WITHDRAWN'
                    ? 'The entry has been withdrawn. If that was a mistake, you can give consent below, then ask the writer to contact the Foundation to have the entry restored.'
                    : 'You can give consent below if that was a mistake.'}
                </Alert>
              </div>
            )}

            <Card className="mt-8 p-6">
              <h2 className="font-display text-lg font-semibold text-forest-900">The entry</h2>
              <DescList
                rows={[
                  ['Writer', record.writer_name],
                  ['Age group', record.writer_age_band?.replace(/_/g, '–') ?? 'Under 18'],
                  ['Story', record.submission_title || 'Not yet titled'],
                  ['Programme', record.competition_name ?? 'Not specified'],
                  ['You are their', record.relationship],
                  ['Requested', formatDate(record.requested_at)],
                  ['Consent wording', <Badge key="v">{record.consent_version}</Badge>],
                ]}
              />
            </Card>

            <Card className="mt-6 p-6">
              <h2 className="font-display text-lg font-semibold text-forest-900">
                What you are consenting to
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">
                {[
                  'That this young person may enter their own original story into the programme named above.',
                  'That the Foundation may store the story privately and share it with the programme’s judges, mentors and editors, and nobody else.',
                  'That the Foundation may contact you and the writer by email about the entry.',
                  'That if the story is selected, the Foundation will seek separate, specific consent before publishing it or making it public.',
                  'That the writer keeps copyright in their story. Entering does not transfer ownership.',
                  'That you can withdraw this consent at any time, which removes the entry from consideration.',
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-gold-500" />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-muted">
                We record your name, email, relationship to the writer, the time you responded and
                the address you responded from. See the{' '}
                <Link href="/policies/child-safeguarding" className="text-gold-700 underline">
                  child safeguarding policy
                </Link>{' '}
                and the{' '}
                <Link href="/policies/privacy" className="text-gold-700 underline">
                  privacy notice
                </Link>
                .
              </p>
            </Card>

            <div className="mt-8">
              <ConsentDecision token={token} alreadyGranted={record.status === 'granted'} />
            </div>
          </>
        )}
      </main>

      <footer className="px-5 py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} {SITE.name} ·{' '}
        <Link href="/" className="hover:text-forest-800">
          dpglf.org
        </Link>
      </footer>
    </div>
  );
}
