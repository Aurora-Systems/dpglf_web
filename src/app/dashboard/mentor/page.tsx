import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { requireRole } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { mentorshipsForMentor } from '@/features/mentorship/queries';

export default async function MentorPage() {
  const user = await requireRole(['mentor', 'admin', 'super_admin'], '/dashboard/mentor');
  const rows = await mentorshipsForMentor(user.userId);
  const active = rows.filter((r) => r.status === 'active' || r.status === 'paused');
  const past = rows.filter((r) => r.status === 'completed' || r.status === 'cancelled');

  return (
    <>
      <PageHeader
        title="My mentees"
        lead="Only the writers assigned to you are visible here. Feedback stays attached to the draft it refers to, so nothing is lost between versions."
      />

      {rows.length === 0 ? (
        <EmptyState title="No mentees assigned yet">
          A programme administrator pairs mentors with shortlisted writers. You will get an email
          when a pairing is made.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <Panel title="Active mentorships">
            {active.length === 0 ? (
              <p className="text-sm text-muted">Nothing active right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {active.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                    <div className="min-w-0 sm:flex-1">
                      <Link
                        href={`/dashboard/mentor/${m.id}`}
                        className="font-display text-lg font-semibold text-forest-900 hover:text-gold-700"
                      >
                        {m.writer_name}
                      </Link>
                      <p className="mt-0.5 text-sm text-muted">
                        {m.title || 'Untitled story'}
                        {m.competition_name && ` · ${m.competition_name}`}
                      </p>
                      {m.goal && <p className="mt-2 max-w-xl text-[13px] text-muted">{m.goal}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-col sm:items-end sm:text-right">
                      <Badge tone={m.status === 'active' ? 'good' : 'neutral'}>{m.status}</Badge>
                      <span className="text-xs text-muted">
                        {m.total_milestones - m.open_milestones}/{m.total_milestones} milestones
                      </span>
                      {m.latest_version && (
                        <span className="text-xs text-muted">v{m.latest_version} latest</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {past.length > 0 && (
            <Panel title="Completed">
              <ul className="divide-y divide-line">
                {past.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <Link href={`/dashboard/mentor/${m.id}`} className="flex-1 font-medium text-forest-900">
                      {m.writer_name} · {m.title || 'Untitled'}
                    </Link>
                    <span className="text-xs text-muted">
                      {m.ended_at ? `Ended ${formatDate(m.ended_at)}` : m.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
