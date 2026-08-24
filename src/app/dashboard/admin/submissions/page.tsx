import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Badge, Card, EmptyState, Panel, Table, Td, Th, buttonClass, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, formatNumber } from '@/lib/format';
import { SUBMISSION_STATUSES, STATUS_LABELS } from '@/lib/workflow';
import { adminCompetitions, adminSubmissions } from '@/features/admin/queries';
import { availableJudges } from '@/features/judging/queries';
import { AssignJudgesForm } from '@/features/admin/Forms';

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; competition?: string; q?: string }>;
}) {
  await requireStaff('/dashboard/admin/submissions');
  const sp = await searchParams;

  const [rows, competitions, judges] = await Promise.all([
    adminSubmissions({ status: sp.status, competitionId: sp.competition, q: sp.q }),
    adminCompetitions(),
    availableJudges(),
  ]);

  // Only entries that have cleared eligibility can be sent to judges.
  const assignable = rows.filter((r) => r.status === 'ELIGIBLE' || r.status === 'ASSIGNED_FOR_JUDGING');

  function filterHref(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...next })) if (v) params.set(k, v);
    const qs = params.toString();
    return `/dashboard/admin/submissions${qs ? `?${qs}` : ''}`;
  }

  return (
    <>
      <PageHeader
        title="All submissions"
        lead="The operational view: eligibility, consent, judging coverage and where each entry sits."
      />

      <div className="space-y-6">
        <Card className="p-5">
          <form action="/dashboard/admin/submissions" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="q" className="block text-sm font-medium text-forest-900">
                Search
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={sp.q ?? ''}
                placeholder="Title, reference or writer"
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="competition" className="block text-sm font-medium text-forest-900">
                Competition
              </label>
              <select
                id="competition"
                name="competition"
                defaultValue={sp.competition ?? ''}
                className="mt-1.5 rounded-lg border border-line px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <button type="submit" className={buttonClass('outline', 'md')}>
              Apply
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
            <Link
              href={filterHref({ status: undefined })}
              className={cx(
                'rounded-md px-2.5 py-1 text-[13px]',
                !sp.status ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
              )}
            >
              All submitted
            </Link>
            {SUBMISSION_STATUSES.filter((s) => s !== 'DRAFT').map((s) => (
              <Link
                key={s}
                href={filterHref({ status: s })}
                className={cx(
                  'rounded-md px-2.5 py-1 text-[13px]',
                  sp.status === s ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
                )}
              >
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </Card>

        <Panel title={`${rows.length} submission${rows.length === 1 ? '' : 's'}`}>
          {rows.length === 0 ? (
            <EmptyState title="Nothing matches those filters" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Entry</Th>
                  <Th>Writer</Th>
                  <Th>Consent</Th>
                  <Th>Judging</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link
                        href={`/dashboard/admin/submissions/${row.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {row.title || 'Untitled'}
                      </Link>
                      <p className="font-mono text-[11px] text-muted">
                        {row.reference ?? '—'} · {row.competition_name}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-forest-800">{row.writer_name}</p>
                      <p className="text-xs text-muted">
                        {row.age_band?.replace(/_/g, '–') ?? '—'}
                        {row.word_count ? ` · ${formatNumber(row.word_count)} words` : ''}
                      </p>
                    </Td>
                    <Td>
                      {row.consent_status ? (
                        <Badge tone={row.consent_status === 'granted' ? 'good' : 'bad'}>
                          {row.consent_status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">n/a</span>
                      )}
                    </Td>
                    <Td className="text-muted">
                      {row.completed}/{row.assigned}
                    </Td>
                    <Td className="font-medium text-forest-900">{row.average_score ?? '—'}</Td>
                    <Td>
                      <StatusBadge status={row.status} />
                      {row.submitted_at && (
                        <p className="mt-1 text-xs text-muted">{formatDate(row.submitted_at)}</p>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Assign judges"
          description="Entries that have passed eligibility. Assignments are additive — nothing existing is removed."
        >
          <AssignJudgesForm
            submissions={assignable}
            judges={judges}
            competitionId={sp.competition}
          />
        </Panel>
      </div>
    </>
  );
}
