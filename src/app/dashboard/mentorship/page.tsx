import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, Card, EmptyState, Panel } from '@/components/ui';
import { requireUser } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { mentorshipsForWriter, milestones } from '@/features/mentorship/queries';

/** The writer's side of mentorship: who they are working with and what is next. */
export default async function MyMentorshipPage() {
  const user = await requireUser('/dashboard/mentorship');
  const rows = await mentorshipsForWriter(user.userId);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="My mentorship" />
        <EmptyState
          title="You are not in a mentorship yet"
          action={
            <ButtonLink href="/dashboard/submissions" variant="outline">
              See my submissions
            </ButtonLink>
          }
        >
          Writers are paired with a mentor after being shortlisted. If your story is still in
          judging, there is nothing to do yet.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My mentorship"
        lead="Your mentor’s notes, your milestones and every draft you have uploaded."
      />

      <div className="space-y-6">
        {await Promise.all(
          rows.map(async (m) => {
            const steps = await milestones(m.id);
            return (
              <Panel
                key={m.id}
                title={m.title || 'Your story'}
                description={`With ${m.mentor_name}${m.competition_name ? ` · ${m.competition_name}` : ''}`}
                action={<Badge tone={m.status === 'active' ? 'good' : 'neutral'}>{m.status}</Badge>}
              >
                {m.goal && (
                  <Card className="mb-5 bg-parchment p-4">
                    <p className="eyebrow text-gold-700">What you are working towards</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-forest-800">{m.goal}</p>
                  </Card>
                )}

                {steps.length > 0 && (
                  <ol className="space-y-2.5">
                    {steps.map((s) => (
                      <li key={s.id} className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={
                            s.status === 'completed'
                              ? 'mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-700 text-[10px] text-white'
                              : 'mt-1 size-4 shrink-0 rounded-full border border-line'
                          }
                        >
                          {s.status === 'completed' ? '✓' : ''}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-forest-900">{s.title}</p>
                          {s.description && (
                            <p className="text-[13px] leading-relaxed text-muted">{s.description}</p>
                          )}
                          {s.due_at && s.status !== 'completed' && (
                            <p className="text-xs text-muted">Due {formatDate(s.due_at)}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {m.submission_id && (
                  <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
                    <ButtonLink href={`/dashboard/submissions/${m.submission_id}`} size="sm">
                      Read feedback and upload a revision
                    </ButtonLink>
                    <Link
                      href={`/dashboard/submissions/${m.submission_id}`}
                      className="self-center text-[13px] text-muted"
                    >
                      {m.latest_version ? `Latest draft: v${m.latest_version}` : 'No draft uploaded yet'}
                    </Link>
                  </div>
                )}
              </Panel>
            );
          }),
        )}
      </div>
    </>
  );
}
