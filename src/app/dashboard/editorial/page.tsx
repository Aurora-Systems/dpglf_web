import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, Card, EmptyState, Panel, Table, Td, Th, cx } from '@/components/ui';
import { isStaff, requireRole } from '@/lib/permissions';
import { relativeTime } from '@/lib/format';
import { editorialQueue, availableMentors, unmentoredSubmissions } from '@/features/mentorship/queries';
import { AssignMentorForm } from '@/features/mentorship/Forms';

type QueueRow = Awaited<ReturnType<typeof editorialQueue>>[number];

/** The stages a story passes through here, in order. */
const STAGES = [
  {
    id: 'mentorship',
    status: 'MENTORSHIP',
    title: 'In mentorship',
    description: 'Paired with a mentor and reworking the draft.',
  },
  {
    id: 'editorial',
    status: 'EDITORIAL',
    title: 'In editorial',
    description: 'Mentorship is done. The story is being edited for publication.',
  },
  {
    id: 'approved',
    status: 'APPROVED_FOR_PUBLICATION',
    title: 'Approved, not yet published',
    description: 'Signed off and waiting to be published to the archive.',
  },
] as const;

export default async function EditorialPage() {
  const user = await requireRole(['editor', 'admin', 'super_admin'], '/dashboard/editorial');
  // The story record is a staff page; editors without a staff role open the entry instead.
  const staff = isStaff(user);
  const [queue, unmentored, mentors] = await Promise.all([
    editorialQueue(),
    unmentoredSubmissions(),
    availableMentors(),
  ]);

  const byStage = Object.fromEntries(STAGES.map((s) => [s.id, queue.filter((r) => r.status === s.status)])) as Record<
    (typeof STAGES)[number]['id'],
    QueueRow[]
  >;

  const summary = [
    { href: '#mentor', label: 'Waiting for a mentor', count: unmentored.length },
    ...STAGES.map((s) => ({ href: `#${s.id}`, label: s.title, count: byStage[s.id].length })),
  ];
  // Like the Competitions list, only stages with something in them get a panel;
  // the summary above still shows every stage, empty ones included.
  const stages = STAGES.filter((s) => byStage[s.id].length > 0);
  const nothing = unmentored.length === 0 && stages.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        title="Editorial"
        lead="Stories between shortlisting and publication. Pair each writer with a mentor, then follow the story through editorial to approval."
      />

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <ul className="grid grid-cols-2 sm:grid-cols-4">
            {summary.map((s, i) => (
              <li
                key={s.href}
                className={cx(
                  'border-line',
                  i % 2 === 1 && 'border-l',
                  i >= 2 && 'border-t sm:border-t-0',
                  i === 2 && 'sm:border-l',
                )}
              >
                {s.count > 0 ? (
                  <a href={s.href} className="block h-full px-4 py-4 hover:bg-parchment sm:px-5">
                    <span className="font-display block text-2xl font-semibold text-forest-900">{s.count}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-forest-800">{s.label}</span>
                  </a>
                ) : (
                  <div className="h-full px-4 py-4 sm:px-5">
                    <span className="font-display block text-2xl font-semibold text-muted/60">0</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{s.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {nothing && (
          <EmptyState title="Nothing in editorial right now">
            Stories arrive here once they are shortlisted, and leave when they are published.
          </EmptyState>
        )}

        {unmentored.length > 0 && (
          <section id="mentor" className="scroll-mt-24">
            <Panel title="Waiting for a mentor" description="Shortlisted writers who have not been paired yet.">
              <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                <ul className="divide-y divide-line">
                  {unmentored.map((s) => (
                    <li key={s.id} className="py-2.5 first:pt-0">
                      <Link
                        href={`/dashboard/submissions/${s.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {s.title || 'Untitled'}
                      </Link>
                      <p className="text-[13px] text-muted">
                        {s.writer_name} · {s.competition_name}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-line pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                  <h3 className="mb-4 text-sm font-semibold text-forest-900">Pair a writer with a mentor</h3>
                  {mentors.length === 0 ? (
                    <Card className="border-dashed p-4 text-sm text-muted">
                      No accounts hold the mentor role yet. Grant it under{' '}
                      <Link href="/dashboard/admin/users" className="text-gold-700 underline">
                        People &amp; roles
                      </Link>
                      .
                    </Card>
                  ) : (
                    <AssignMentorForm submissions={unmentored} mentors={mentors} />
                  )}
                </div>
              </div>
            </Panel>
          </section>
        )}

        {stages.map((stage) => (
          <section key={stage.id} id={stage.id} className="scroll-mt-24">
            <Panel
              title={
                <>
                  {stage.title}
                  <span className="ml-2 font-sans text-sm font-normal text-muted">{byStage[stage.id].length}</span>
                </>
              }
              description={stage.description}
            >
              <QueueTable rows={byStage[stage.id]} staff={staff} />
            </Panel>
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * One stage's stories. On narrow screens the writer, programme and draft move
 * under the title, so the row stays readable and its Open button stays in view.
 */
function QueueTable({ rows, staff }: { rows: QueueRow[]; staff: boolean }) {
  return (
    <Table min="min-w-0">
      <thead>
        <tr>
          <Th>Story</Th>
          <Th className="hidden sm:table-cell">Writer</Th>
          <Th className="hidden xl:table-cell">Programme</Th>
          <Th className="hidden md:table-cell">Draft</Th>
          <Th className="hidden md:table-cell">Last change</Th>
          <Th>
            <span className="sr-only">Open</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const record = staff && row.story_id;
          return (
            <tr key={row.id}>
              <Td className="min-w-0">
                <Link
                  href={`/dashboard/submissions/${row.id}`}
                  className="-my-1 inline-block py-1 font-medium text-forest-900 hover:text-gold-700"
                >
                  {row.title || 'Untitled'}
                </Link>
                {row.reference && <p className="font-mono text-[11px] text-muted wrap-anywhere">{row.reference}</p>}
                <p className="mt-1 text-xs text-muted xl:hidden">
                  <span className="text-forest-800 sm:hidden">{row.writer_name} · </span>
                  {row.competition_name}
                </p>
                <p className="mt-0.5 text-xs text-muted md:hidden">
                  {row.latest_version ? `Draft v${row.latest_version}` : 'No draft yet'} · changed{' '}
                  {relativeTime(row.updated_at)}
                </p>
              </Td>
              <Td className="hidden text-muted sm:table-cell">{row.writer_name}</Td>
              <Td className="hidden text-muted xl:table-cell">{row.competition_name}</Td>
              <Td className="hidden md:table-cell">
                {row.latest_version ? <Badge>v{row.latest_version}</Badge> : <span className="text-muted">None</span>}
              </Td>
              <Td className="hidden whitespace-nowrap text-muted md:table-cell">{relativeTime(row.updated_at)}</Td>
              <Td className="w-px text-right">
                <ButtonLink
                  href={record ? `/dashboard/admin/stories/${row.story_id}` : `/dashboard/submissions/${row.id}`}
                  variant="outline"
                  size="sm"
                  className="min-h-10 whitespace-nowrap sm:min-h-0"
                >
                  {record ? 'Story record' : 'Open'}
                </ButtonLink>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
