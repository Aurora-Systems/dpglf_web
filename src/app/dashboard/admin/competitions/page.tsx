import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, EmptyState, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { deadlineLabel, formatNumber } from '@/lib/format';
import { adminCompetitions, rubrics } from '@/features/admin/queries';
import { CompetitionForm, RubricForm } from '@/features/admin/Forms';

const TONE: Record<string, 'good' | 'progress' | 'neutral'> = {
  open: 'good',
  judging: 'progress',
  draft: 'neutral',
};

export default async function AdminCompetitionsPage() {
  await requireStaff('/dashboard/admin/competitions');
  const [competitions, rubricList] = await Promise.all([adminCompetitions(), rubrics()]);

  return (
    <>
      <PageHeader
        title="Competitions"
        lead="Open and close programmes, set the rules writers accept, and attach the judging rubric."
      />

      <div className="space-y-6">
        <Panel title="All competitions">
          {competitions.length === 0 ? (
            <EmptyState title="No competitions yet">
              Create the first one below — Tales from the Baobab is the flagship programme.
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Deadline</Th>
                  <Th>Entries</Th>
                  <Th>Rubric</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {competitions.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link
                        href={`/dashboard/admin/competitions/${c.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted">
                        /{c.slug} · rules {c.rules_version}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={TONE[c.status] ?? 'neutral'}>{c.status}</Badge>
                    </Td>
                    <Td className="text-xs text-muted">{deadlineLabel(c.closes_at)}</Td>
                    <Td className="text-muted">{formatNumber(c.submission_count)}</Td>
                    <Td className="text-xs text-muted">{c.rubric_id ? 'Attached' : 'None'}</Td>
                    <Td>
                      <ButtonLink href={`/programmes/${c.slug}`} variant="ghost" size="sm">
                        View public page
                      </ButtonLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="New competition">
          <CompetitionForm rubrics={rubricList} />
        </Panel>

        <Panel
          title="Judging rubrics"
          description="Rubrics are versioned, never edited in place, so historic scores stay interpretable."
        >
          {rubricList.length > 0 && (
            <ul className="mb-6 divide-y divide-line">
              {rubricList.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="font-medium text-forest-900">{r.name}</span>
                  <Badge>v{r.version}</Badge>
                  <span className="text-muted">{r.criteria} criteria</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line pt-5">
            <RubricForm />
          </div>
        </Panel>
      </div>
    </>
  );
}
