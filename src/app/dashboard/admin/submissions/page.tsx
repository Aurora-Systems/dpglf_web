import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Field, Input, Select } from '@/components/form';
import { Badge, ButtonAnchor, Card, EmptyState, Panel, Table, Td, Th, buttonClass, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, formatNumber } from '@/lib/format';
import { adminCompetitions, adminSubmissionCounts, adminSubmissions } from '@/features/admin/queries';
import { CONSENT_LABELS, STATUS_STAGES, ageBandLabel, statusLabel } from './labels';
import { submissionTabs } from './tabs';

const LIMIT = 200;

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; competition?: string; q?: string }>;
}) {
  await requireStaff('/dashboard/admin/submissions');
  const sp = await searchParams;

  const [rows, competitions, counts] = await Promise.all([
    adminSubmissions({ status: sp.status, competitionId: sp.competition, q: sp.q, limit: LIMIT }),
    adminCompetitions(),
    adminSubmissionCounts({ competitionId: sp.competition, q: sp.q }),
  ]);

  const allCount = Object.values(counts).reduce((sum, c) => sum + c.n, 0);
  const competitionName = competitions.find((c) => c.id === sp.competition)?.name;
  const filtered = Boolean(sp.status || sp.competition || sp.q);

  function filterHref(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...next })) if (v) params.set(k, v);
    const qs = params.toString();
    return `/dashboard/admin/submissions${qs ? `?${qs}` : ''}`;
  }

  const exportParams = new URLSearchParams();
  if (sp.competition) exportParams.set('competition', sp.competition);
  if (sp.status) exportParams.set('status', sp.status);
  if (sp.q) exportParams.set('q', sp.q);
  const exportQs = exportParams.toString();

  const showing = [
    sp.status ? statusLabel(sp.status) : null,
    competitionName ?? null,
    sp.q ? `matching “${sp.q}”` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        title="Submissions"
        lead="Every entry that has been sent in: where it sits, its consent and how far judging has got."
        action={
          <ButtonAnchor
            href={`/api/export/submissions${exportQs ? `?${exportQs}` : ''}`}
            variant="outline"
            size="sm"
            className="min-h-10 sm:min-h-0"
          >
            Export CSV
          </ButtonAnchor>
        }
      />
      <SectionTabs label="Submissions" tabs={submissionTabs(counts.ELIGIBLE?.total)} />

      <div className="space-y-6">
        <Card>
          <form
            action="/dashboard/admin/submissions"
            className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end"
          >
            <Field label="Search" htmlFor="q">
              <Input id="q" name="q" type="search" defaultValue={sp.q ?? ''} placeholder="Title, reference or writer" />
            </Field>
            <Field label="Competition" htmlFor="competition">
              <Select id="competition" name="competition" defaultValue={sp.competition ?? ''}>
                <option value="">All competitions</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {/*
              Phones choose the status here instead of from the chips. From sm up
              it is hidden but still submitted, so Apply keeps the chosen status.
            */}
            <Field label="Status" htmlFor="status" className="sm:hidden">
              <Select id="status" name="status" defaultValue={sp.status ?? ''}>
                <option value="">All submitted ({formatNumber(allCount)})</option>
                {STATUS_STAGES.map((stage) => (
                  <optgroup key={stage.label} label={stage.label}>
                    {stage.statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                        {counts[s]?.n ? ` (${formatNumber(counts[s].n)})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-3">
              <button type="submit" className={buttonClass('primary', 'md', 'min-h-11 flex-1 sm:flex-none')}>
                Apply
              </button>
              {filtered && (
                <Link
                  href="/dashboard/admin/submissions"
                  className="inline-flex min-h-11 items-center px-1 text-sm text-gold-700 hover:underline"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>

          <div className="hidden space-y-3 border-t border-line px-5 py-4 sm:block" role="group" aria-label="Filter by status">
            <StageRow>
              <Chip href={filterHref({ status: undefined })} active={!sp.status} count={allCount}>
                All submitted
              </Chip>
            </StageRow>
            {STATUS_STAGES.map((stage) => (
              <StageRow key={stage.label} label={stage.label}>
                {stage.statuses.map((s) => (
                  <Chip key={s} href={filterHref({ status: s })} active={sp.status === s} count={counts[s]?.n ?? 0}>
                    {statusLabel(s)}
                  </Chip>
                ))}
              </StageRow>
            ))}
          </div>
        </Card>

        <Panel
          title={`${formatNumber(rows.length)} submission${rows.length === 1 ? '' : 's'}`}
          description={
            <>
              {showing.length > 0 ? `Showing ${showing.join(' · ')}.` : 'Showing every submitted entry, newest first.'}
              {rows.length >= LIMIT && ` Only the latest ${LIMIT} are listed; narrow the filters or export to see the rest.`}
            </>
          }
        >
          {rows.length === 0 ? (
            <EmptyState
              title={filtered ? 'Nothing matches those filters' : 'No submissions yet'}
              action={
                filtered ? (
                  <Link href="/dashboard/admin/submissions" className={buttonClass('outline', 'sm')}>
                    Clear filters
                  </Link>
                ) : undefined
              }
            >
              {filtered ? 'Try another status or competition, or clear the search.' : 'Entries appear here once writers submit them.'}
            </EmptyState>
          ) : (
            // Columns drop away as the screen narrows and their facts move under the
            // entry title, so status and score never hide behind a sideways scroll.
            <Table min="min-w-0">
              <thead>
                <tr>
                  <Th>Entry</Th>
                  <Th className="hidden md:table-cell">Writer</Th>
                  <Th className="hidden xl:table-cell">Consent</Th>
                  <Th className="hidden xl:table-cell">Judging</Th>
                  <Th className="hidden md:table-cell">Score</Th>
                  <Th className="hidden sm:table-cell">Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const age = ageBandLabel(row.age_band);
                  const consentOk = !row.consent_status || row.consent_status === 'granted';
                  const consentText = row.consent_status
                    ? `Consent ${(CONSENT_LABELS[row.consent_status] ?? row.consent_status).toLowerCase()}`
                    : 'Consent not needed';
                  const judgingText =
                    row.assigned === 0 ? 'No judges' : `${row.completed} of ${row.assigned} scored`;
                  return (
                    <tr key={row.id}>
                      <Td className="min-w-0">
                        <Link
                          href={`/dashboard/admin/submissions/${row.id}`}
                          className="-my-1 inline-block py-1 font-medium text-forest-900 hover:text-gold-700"
                        >
                          {row.title || 'Untitled'}
                        </Link>
                        <p className="font-mono text-[11px] text-muted wrap-anywhere">
                          {row.reference ?? 'No reference'} · {row.competition_name}
                        </p>
                        <p className="mt-1 text-xs text-forest-800 md:hidden">
                          {row.writer_name}
                          <span className="text-muted">{age ? ` · ${age}` : ''}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-muted xl:hidden">
                          <span className={consentOk ? undefined : 'font-medium text-clay'}>{consentText}</span>
                          <span aria-hidden>·</span>
                          <span>{judgingText}</span>
                          {row.average_score && (
                            <span className="contents md:hidden">
                              <span aria-hidden>·</span>
                              <span>
                                Score <span className="font-medium text-forest-900">{row.average_score}</span>
                              </span>
                            </span>
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
                          <StatusBadge status={row.status} />
                          {row.submitted_at && <span className="text-xs text-muted">{formatDate(row.submitted_at)}</span>}
                        </div>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <p className="text-forest-800">{row.writer_name}</p>
                        <p className="text-xs text-muted">
                          {age ?? 'Age not given'}
                          {row.word_count ? ` · ${formatNumber(row.word_count)} words` : ''}
                        </p>
                      </Td>
                      <Td className="hidden xl:table-cell">
                        {row.consent_status ? (
                          <Badge tone={row.consent_status === 'granted' ? 'good' : 'bad'}>
                            {CONSENT_LABELS[row.consent_status] ?? row.consent_status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted">Not needed</span>
                        )}
                      </Td>
                      <Td className="hidden text-muted xl:table-cell">
                        {row.assigned === 0 ? (
                          <span className="text-xs">No judges</span>
                        ) : (
                          <>
                            {row.completed} of {row.assigned}
                            <span className="block text-xs">scored</span>
                          </>
                        )}
                      </Td>
                      <Td className="hidden font-medium text-forest-900 md:table-cell">
                        {row.average_score ?? <span className="text-xs font-normal text-muted">Not scored</span>}
                      </Td>
                      <Td className="hidden sm:table-cell">
                        <StatusBadge status={row.status} />
                        {row.submitted_at && (
                          <p className="mt-1 text-xs whitespace-nowrap text-muted">{formatDate(row.submitted_at)}</p>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}

function StageRow({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5 sm:gap-1">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[13px] sm:min-h-0 sm:px-2.5 sm:py-1',
        active
          ? 'bg-forest-900 text-bone'
          : count > 0
            ? 'text-forest-800 hover:bg-forest-900/8'
            : 'text-muted hover:bg-forest-900/8',
      )}
    >
      {children}
      {count > 0 && (
        <span
          className={cx(
            'rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold',
            active ? 'bg-bone/15 text-bone' : 'bg-forest-900/8 text-forest-800',
          )}
        >
          {formatNumber(count)}
        </span>
      )}
    </Link>
  );
}
