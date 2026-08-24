import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Badge, ButtonLink, Card, EmptyState, Panel, Table, Td, Th } from '@/components/ui';
import { requireRole } from '@/lib/permissions';
import { relativeTime } from '@/lib/format';
import { editorialQueue, availableMentors, unmentoredSubmissions } from '@/features/mentorship/queries';
import { AssignMentorForm } from '@/features/mentorship/Forms';

export default async function EditorialPage() {
  await requireRole(['editor', 'admin', 'super_admin'], '/dashboard/editorial');
  const [queue, unmentored, mentors] = await Promise.all([
    editorialQueue(),
    unmentoredSubmissions(),
    availableMentors(),
  ]);

  return (
    <>
      <PageHeader
        title="Editorial"
        lead="Stories between shortlisting and publication — in mentorship, in editorial, or approved and waiting to be published."
      />

      <div className="space-y-6">
        {unmentored.length > 0 && (
          <Panel
            title="Waiting for a mentor"
            description="Shortlisted writers who have not been paired yet."
          >
            <ul className="mb-6 divide-y divide-line">
              {unmentored.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <Link href={`/dashboard/submissions/${s.id}`} className="font-medium text-forest-900 hover:text-gold-700">
                    {s.title || 'Untitled'}
                  </Link>
                  <span className="text-muted">{s.writer_name}</span>
                  <span className="ml-auto text-xs text-muted">{s.competition_name}</span>
                </li>
              ))}
            </ul>

            {mentors.length === 0 ? (
              <Card className="border-dashed p-4 text-sm text-muted">
                No accounts hold the mentor role yet. Grant it under{' '}
                <Link href="/dashboard/admin/users" className="text-gold-700 underline">
                  People &amp; roles
                </Link>
                .
              </Card>
            ) : (
              <div className="border-t border-line pt-5">
                <AssignMentorForm submissions={unmentored} mentors={mentors} />
              </div>
            )}
          </Panel>
        )}

        <Panel title="Editorial queue">
          {queue.length === 0 ? (
            <EmptyState title="Nothing in editorial">
              Stories arrive here once they are shortlisted and move through mentorship.
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Story</Th>
                  <Th>Writer</Th>
                  <Th>Programme</Th>
                  <Th>Draft</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link
                        href={`/dashboard/submissions/${row.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {row.title || 'Untitled'}
                      </Link>
                      {row.reference && (
                        <p className="font-mono text-[11px] text-muted">{row.reference}</p>
                      )}
                    </Td>
                    <Td className="text-muted">{row.writer_name}</Td>
                    <Td className="text-muted">{row.competition_name}</Td>
                    <Td>
                      {row.latest_version ? <Badge>v{row.latest_version}</Badge> : <span className="text-muted">—</span>}
                    </Td>
                    <Td>
                      <StatusBadge status={row.status} />
                      <p className="mt-1 text-xs text-muted">{relativeTime(row.updated_at)}</p>
                    </Td>
                    <Td>
                      <ButtonLink
                        href={row.story_id ? `/dashboard/admin/stories/${row.story_id}` : `/dashboard/submissions/${row.id}`}
                        variant="outline"
                        size="sm"
                      >
                        {row.story_id ? 'Story record' : 'Open'}
                      </ButtonLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
