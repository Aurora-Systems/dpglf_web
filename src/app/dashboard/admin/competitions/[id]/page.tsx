import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Alert, Badge, ButtonLink, Card, Panel, Table, Td, Th, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, formatNumber } from '@/lib/format';
import { adminCompetition, rubrics } from '@/features/admin/queries';
import { judgingProgress } from '@/features/judging/queries';
import { CompetitionForm, RubricForm } from '@/features/admin/Forms';
import { RECOMMENDATION_LABELS } from '../../submissions/labels';
import { closingDatePassed, competitionStatus } from '../status';

export default async function AdminCompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireStaff(`/dashboard/admin/competitions/${id}`);
  const { created } = await searchParams;

  const competition = await adminCompetition(id);
  if (!competition) notFound();

  const [rubricList, progress] = await Promise.all([rubrics(), judgingProgress(id)]);
  const scored = progress.filter((p) => p.completed > 0);
  const status = competitionStatus(competition.status);
  const isDraft = competition.status === 'draft';

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        back={{ href: '/dashboard/admin/competitions', label: 'Competitions' }}
        title={competition.name}
        lead={competition.tagline || undefined}
        action={
          isDraft ? undefined : (
            <ButtonLink href={`/programmes/${competition.slug}`} variant="outline" size="sm" className="min-h-10">
              View public page
            </ButtonLink>
          )
        }
      />

      <div className="space-y-6">
        {created && (
          <Alert tone="success" title="Competition created">
            {[
              isDraft ? 'It stays hidden from the website until you set the status to Open.' : null,
              competition.rubric_id ? null : 'Attach a rubric before judging starts.',
            ]
              .filter(Boolean)
              .join(' ') || 'Check the settings below.'}
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <SummaryCard label="Status">
            <p className="flex flex-wrap items-center gap-1.5">
              <Badge tone={status.tone}>{status.label}</Badge>
              {competition.is_featured && <Badge tone="gold">Featured</Badge>}
            </p>
            <p className="mt-2 text-[13px] text-muted">Rules {competition.rules_version}</p>
            {closingDatePassed(competition) && (
              <p className="mt-1 text-[13px] text-gold-700">Closing date has passed</p>
            )}
          </SummaryCard>

          <SummaryCard label="Entries">
            <p className="font-display text-2xl leading-tight font-semibold text-forest-900">
              {formatNumber(competition.submission_count)}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {scored.length} scored
              {progress.length > 0 && (
                <>
                  {' · '}
                  <a href="#results" className="text-gold-700 hover:underline">
                    See results
                  </a>
                </>
              )}
            </p>
          </SummaryCard>

          <SummaryCard label="Dates" className="col-span-2 md:col-span-1">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-muted">Opens</dt>
              <dd className="text-forest-900">{dateOrNotSet(competition.opens_at)}</dd>
              <dt className="text-muted">Closes</dt>
              <dd className="text-forest-900">{dateOrNotSet(competition.closes_at)}</dd>
              <dt className="text-muted">Results</dt>
              <dd className="text-forest-900">{dateOrNotSet(competition.results_at)}</dd>
            </dl>
          </SummaryCard>

          <SummaryCard label="Rubric" className="col-span-2 md:col-span-1">
            {competition.rubric_id ? (
              <>
                <p className="text-sm font-medium text-forest-900">
                  {competition.rubric_name} <span className="font-normal text-muted">v{competition.rubric_version}</span>
                </p>
                <p className="mt-1 text-[13px] text-muted">{competition.rubric_criteria} criteria</p>
              </>
            ) : (
              <>
                <Badge tone="bad">No rubric</Badge>
                <p className="mt-2 text-[13px] text-muted">
                  Judges cannot score without one.{' '}
                  <a href="#rubric" className="text-gold-700 hover:underline">
                    Create one
                  </a>{' '}
                  or pick one in the settings.
                </p>
              </>
            )}
          </SummaryCard>
        </div>

        <Panel title="Settings" description="Changes apply as soon as you save.">
          <CompetitionForm competition={competition} rubrics={rubricList} />
        </Panel>

        <div id="results" className="scroll-mt-24">
          <Panel title="Results" description="Ranked by average score across completed reviews.">
            {progress.length === 0 ? (
              <p className="text-sm text-muted">No entries have reached judging yet.</p>
            ) : (
              <Table min="min-w-[44rem]">
                <thead>
                  <tr>
                    <Th>Entry</Th>
                    <Th>Writer</Th>
                    <Th>Reviews</Th>
                    <Th>Average</Th>
                    <Th>Recommendations</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((row) => (
                    <tr key={row.submission_id}>
                      <Td>
                        <Link
                          href={`/dashboard/admin/submissions/${row.submission_id}`}
                          className="font-medium text-forest-900 hover:text-gold-700"
                        >
                          {row.title || 'Untitled'}
                        </Link>
                        {row.reference && <p className="font-mono text-[11px] text-muted">{row.reference}</p>}
                      </Td>
                      <Td className="text-muted">{row.writer_name}</Td>
                      <Td className="text-muted">
                        {row.completed}/{row.assigned}
                        {row.conflicts > 0 && <span className="text-clay"> · {row.conflicts} conflict</span>}
                      </Td>
                      <Td className="font-medium text-forest-900">{row.average_score ?? 'Not scored'}</Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {row.recommendations.map((r, i) => (
                            <Badge key={i} tone={r === 'shortlist' ? 'good' : r === 'reject' ? 'bad' : 'neutral'}>
                              {RECOMMENDATION_LABELS[r] ?? r}
                            </Badge>
                          ))}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge status={row.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>

        {!competition.rubric_id && (
          <div id="rubric" className="scroll-mt-24">
            <Panel
              title="Create a rubric for this competition"
              description="It is attached to this competition as soon as you save it."
            >
              <RubricForm competitionId={competition.id} />
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cx('min-w-0 p-4', className)}>
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      {children}
    </Card>
  );
}

function dateOrNotSet(value: string | null): string {
  return value ? formatDate(value) : 'Not set';
}
