import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, ButtonLink, Card, EmptyState } from '@/components/ui';
import { requireUser } from '@/lib/permissions';
import { deadlineLabel, formatNumber } from '@/lib/format';
import { enterableCompetitions } from '@/features/submissions/queries';
import { StartSubmission } from '@/features/submissions/StartSubmission';

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  await requireUser('/dashboard/submissions/new');
  const { competition: preferredSlug } = await searchParams;
  const competitions = await enterableCompetitions();

  if (competitions.length === 0) {
    return (
      <>
        <PageHeader back={{ href: '/dashboard', label: 'Dashboard' }} title="Start a submission" />
        <EmptyState
          title="No competitions are open right now"
          action={
            <ButtonLink href="/programmes" variant="outline">
              See the programmes
            </ButtonLink>
          }
        >
          Tales from the Baobab runs annually. Subscribe to the newsletter from the Foundation site
          and we will tell you the moment the next call for submissions opens.
        </EmptyState>
      </>
    );
  }

  const preferred = competitions.find((c) => c.slug === preferredSlug) ?? competitions[0];

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard', label: 'Dashboard' }}
        title="Start a submission"
        lead="Choose the programme you are entering. You can save and come back at any point before the deadline."
      />

      <div className="space-y-6">
        <Card className="p-6">
          <StartSubmission competitions={competitions} defaultId={preferred.id} />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {competitions.map((c) => (
            <Card key={c.id} className="p-5">
              <h2 className="font-display text-lg font-semibold text-forest-900">{c.name}</h2>
              {c.tagline && <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.tagline}</p>}
              <dl className="mt-4 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Deadline</dt>
                  <dd className="text-forest-900">{deadlineLabel(c.closes_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Length</dt>
                  <dd className="text-forest-900">
                    {formatNumber(c.word_min)}–{formatNumber(c.word_max)} words
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Entries allowed</dt>
                  <dd className="text-forest-900">{c.max_entries}</dd>
                </div>
              </dl>
              <Link
                href={`/programmes/${c.slug}`}
                className="mt-4 inline-block text-[13px] text-gold-700 hover:underline"
              >
                Full rules and eligibility →
              </Link>
            </Card>
          ))}
        </div>

        <Alert tone="info" title="Before you start">
          Have your manuscript ready as a Word (.docx), PDF, RTF or plain text file. If you are under
          eighteen you will also need a parent or guardian’s email address so we can request their
          consent.
        </Alert>
      </div>
    </>
  );
}
