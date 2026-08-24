import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, Card, EmptyState, Panel } from '@/components/ui';
import { requireRole } from '@/lib/permissions';
import { formatNumber, relativeTime } from '@/lib/format';
import { myAssignments } from '@/features/judging/queries';

export default async function JudgeQueuePage() {
  const user = await requireRole(['judge', 'admin', 'super_admin'], '/dashboard/judge');
  const assignments = await myAssignments(user.userId);

  const outstanding = assignments.filter((a) => a.status === 'assigned' || a.status === 'in_progress');
  const done = assignments.filter((a) => a.status === 'completed');
  const declined = assignments.filter((a) => a.status === 'declined');

  return (
    <>
      <PageHeader
        title="Judging queue"
        lead="Only entries assigned to you appear here. Score each one against the rubric, and declare a conflict rather than judging an entry you recognise."
      />

      {assignments.length === 0 ? (
        <EmptyState title="Nothing assigned to you yet">
          A programme administrator assigns entries once eligibility checks are complete. You will
          get an email when that happens.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {outstanding.length > 0 && (
            <Alert tone="warning" title={`${outstanding.length} entr${outstanding.length === 1 ? 'y' : 'ies'} waiting for your score`}>
              Entries are shown without the writer’s name where the competition uses blind judging.
            </Alert>
          )}

          <Panel title="To review">
            {outstanding.length === 0 ? (
              <p className="text-sm text-muted">Your queue is clear.</p>
            ) : (
              <ul className="divide-y divide-line">
                {outstanding.map((a) => (
                  <li key={a.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/judge/${a.id}`}
                          className="font-display text-lg font-semibold text-forest-900 hover:text-gold-700"
                        >
                          {a.blind_judging ? (a.anon_label ?? 'Entry') : a.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          {[
                            a.competition_name,
                            a.language,
                            a.genre,
                            a.word_count ? `${formatNumber(a.word_count)} words` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted">{a.synopsis}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge tone={a.status === 'in_progress' ? 'progress' : 'neutral'}>
                          {a.status === 'in_progress' ? 'In progress' : 'Not started'}
                        </Badge>
                        {a.due_at && <span className="text-xs text-muted">Due {relativeTime(a.due_at)}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {done.length > 0 && (
            <Panel title="Completed" description="Scores you have finalised.">
              <ul className="divide-y divide-line">
                {done.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Link href={`/dashboard/judge/${a.id}`} className="min-w-0 flex-1 text-sm font-medium text-forest-900 hover:text-gold-700">
                      {a.blind_judging ? (a.anon_label ?? 'Entry') : a.title}
                    </Link>
                    <span className="text-xs text-muted">{a.competition_name}</span>
                    {a.total_score && <Badge tone="good">Score {Number(a.total_score).toFixed(1)}</Badge>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {declined.length > 0 && (
            <Card className="p-5">
              <p className="text-sm text-muted">
                {declined.length} entr{declined.length === 1 ? 'y' : 'ies'} removed from your queue
                after you declared a conflict of interest.
              </p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
