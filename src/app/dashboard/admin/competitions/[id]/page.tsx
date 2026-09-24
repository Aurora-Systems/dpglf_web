import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, Card, DescList, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { deadlineLabel, formatDate, formatNumber } from '@/lib/format';
import { adminCompetition, rubrics } from '@/features/admin/queries';
import { judgingProgress } from '@/features/judging/queries';
import { CompetitionForm, RubricForm } from '@/features/admin/Forms';

export default async function AdminCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaff(`/dashboard/admin/competitions/${id}`);

  const competition = await adminCompetition(id);
  if (!competition) notFound();

  const [rubricList, progress] = await Promise.all([rubrics(), judgingProgress(id)]);
  const scored = progress.filter((p) => p.completed > 0);

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/admin/competitions', label: 'Competitions' }}
        title={competition.name}
        lead={deadlineLabel(competition.closes_at)}
        action={
          <ButtonLink href={`/programmes/${competition.slug}`} variant="outline" size="sm">
            View public page
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted">Entries</p>
            <p className="font-display text-2xl font-semibold text-forest-900">
              {formatNumber(competition.submission_count)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted">Scored</p>
            <p className="font-display text-2xl font-semibold text-forest-900">{scored.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted">Status</p>
            <p className="mt-1">
              <Badge tone={competition.status === 'open' ? 'good' : 'neutral'}>{competition.status}</Badge>
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted">Rules version</p>
            <p className="font-display text-2xl font-semibold text-forest-900">{competition.rules_version}</p>
          </Card>
        </div>

        <Panel title="Results" description="Ranked by average score across completed reviews.">
          {progress.length === 0 ? (
            <p className="text-sm text-muted">No entries have reached judging yet.</p>
          ) : (
            <Table>
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
                            {r}
                          </Badge>
                        ))}
                      </span>
                    </Td>
                    <Td className="text-xs text-muted">{row.status.replace(/_/g, ' ').toLowerCase()}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="Settings">
          <CompetitionForm competition={competition} rubrics={rubricList} />
        </Panel>

        <Panel title="Dates and eligibility at a glance">
          <DescList
            rows={[
              ['Opens', competition.opens_at ? formatDate(competition.opens_at) : 'Not set'],
              ['Closes', competition.closes_at ? formatDate(competition.closes_at) : 'Not set'],
              ['Results', competition.results_at ? formatDate(competition.results_at) : 'Not set'],
              [
                'Age',
                competition.max_age
                  ? `${competition.min_age ?? 0}–${competition.max_age}`
                  : 'No limit set',
              ],
              ['Words', `${formatNumber(competition.word_min)}–${formatNumber(competition.word_max)}`],
              ['Entries per writer', String(competition.max_entries)],
              ['Blind judging', competition.blind_judging ? 'Yes' : 'No'],
              ['Score revision', competition.allow_score_revision ? 'Allowed' : 'Locks on submit'],
              ['Guardian consent', competition.requires_guardian_consent ? 'Required for under-18s' : 'Not required'],
            ]}
          />
        </Panel>

        {!competition.rubric_id && (
          <Panel title="Create a rubric for this competition">
            <RubricForm competitionId={competition.id} />
          </Panel>
        )}
      </div>
    </>
  );
}
