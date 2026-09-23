import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { ButtonLink, Card, EmptyState, Panel, Table, Td, Th } from '@/components/ui';
import { requireUser } from '@/lib/permissions';
import { deadlineLabel, formatDate, formatNumber, relativeTime } from '@/lib/format';
import { STATUS_WRITER_COPY, type SubmissionStatus } from '@/lib/workflow';
import { mySubmissions } from '@/features/submissions/queries';

export default async function MySubmissionsPage() {
  const user = await requireUser('/dashboard/submissions');
  const submissions = await mySubmissions(user.userId);
  const drafts = submissions.filter((s) => s.status === 'DRAFT');

  return (
    <>
      <PageHeader
        title="My submissions"
        lead="Every entry you have started, and exactly where it is in the process."
        action={
          <ButtonLink href="/dashboard/submissions/new" variant="gold">
            Start a submission
          </ButtonLink>
        }
      />

      {submissions.length === 0 ? (
        <EmptyState
          title="You have not entered anything yet"
          action={
            <ButtonLink href="/dashboard/submissions/new" variant="gold">
              Start your first submission
            </ButtonLink>
          }
        >
          Competitions are listed on the{' '}
          <Link href="/programmes" className="text-gold-700 underline">
            programmes page
          </Link>
          . You can save a draft and finish it any time before the deadline.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {drafts.length > 0 && (
            <Card className="border-gold-500 bg-gold-100/40 p-5">
              <p className="font-display text-base font-semibold text-forest-900">
                {drafts.length === 1 ? 'You have an unfinished draft' : `You have ${drafts.length} unfinished drafts`}
              </p>
              <ul className="mt-3 space-y-2">
                {drafts.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 text-sm">
                    <Link href={`/dashboard/submissions/${d.id}/edit`} className="font-medium text-forest-900 underline">
                      {d.title || 'Untitled draft'}
                    </Link>
                    <span className="text-muted">
                      {d.competition_name} · {deadlineLabel(d.closes_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Panel title="All entries">
            <Table>
              <thead>
                <tr>
                  <Th>Story</Th>
                  <Th>Programme</Th>
                  <Th>Reference</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link
                        href={s.status === 'DRAFT' ? `/dashboard/submissions/${s.id}/edit` : `/dashboard/submissions/${s.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {s.title || 'Untitled draft'}
                      </Link>
                      <p className="mt-0.5 max-w-md text-xs text-muted">
                        {STATUS_WRITER_COPY[s.status as SubmissionStatus]}
                      </p>
                    </Td>
                    <Td className="text-muted">
                      {s.competition_name}
                      {s.word_count ? (
                        <p className="text-xs">{formatNumber(s.word_count)} words</p>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-xs text-muted">{s.reference ?? (s.status === 'DRAFT' ? 'Pending' : 'None')}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td className="text-xs text-muted">
                      {relativeTime(s.updated_at)}
                      {s.submitted_at && (
                        <p className="mt-0.5">Submitted {formatDate(s.submitted_at)}</p>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>
      )}
    </>
  );
}
