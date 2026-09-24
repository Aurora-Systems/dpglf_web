import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonLink, Card, Panel, Stat } from '@/components/ui';
import { requireUser } from '@/lib/permissions';
import { hasRole, isStaff } from '@/lib/permissions';
import { formatNumber, relativeTime } from '@/lib/format';
import { ROLE_DESCRIPTIONS } from '@/lib/roles';
import { dashboardCounts } from '@/features/dashboard/queries';
import { mySubmissions } from '@/features/submissions/queries';
import { ResendVerification } from '@/features/auth/ResetForms';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; denied?: string; reset?: string }>;
}) {
  const user = await requireUser();
  const flags = await searchParams;
  const [counts, submissions] = await Promise.all([
    dashboardCounts(user),
    hasRole(user, 'writer') ? mySubmissions(user.userId, 5) : Promise.resolve([]),
  ]);

  const firstName = (user.name || '').split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : 'Your dashboard'}
        lead="Everything you are involved in across the Foundation, in one place."
      />

      <div className="space-y-6">
        {flags.welcome && (
          <Alert tone="success" title="Your account is ready">
            We have sent a confirmation link to {user.email}. Confirm it when you can. It is
            required before an entry can be submitted.
          </Alert>
        )}
        {flags.reset && <Alert tone="success">Your password has been changed.</Alert>}
        {flags.denied && (
          <Alert tone="error" title="You do not have access to that page">
            If you believe you should, ask a programme administrator to grant you the role.
          </Alert>
        )}
        {counts.unverifiedEmail && !flags.welcome && (
          <Alert tone="warning" title="Confirm your email address">
            <p>
              Submissions cannot be finalised until {user.email} is confirmed. Check your inbox, or
              send a new link.
            </p>
            <div className="mt-3">
              <ResendVerification />
            </div>
          </Alert>
        )}

        {/* ---- role queues ------------------------------------------------ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hasRole(user, 'writer') && (
            <QueueCard
              href="/dashboard/submissions"
              label="My submissions"
              value={counts.activeSubmissions}
              hint={counts.drafts > 0 ? `${counts.drafts} unfinished draft${counts.drafts === 1 ? '' : 's'}` : 'in progress'}
              urgent={counts.drafts > 0}
            />
          )}
          {hasRole(user, 'judge') && (
            <QueueCard
              href="/dashboard/judge"
              label="To review"
              value={counts.judgeOutstanding}
              hint="assigned to you"
              urgent={counts.judgeOutstanding > 0}
            />
          )}
          {hasRole(user, 'mentor') && (
            <QueueCard href="/dashboard/mentor" label="Active mentees" value={counts.mentorActive} hint="in mentorship" />
          )}
          {(isStaff(user) || hasRole(user, 'editor')) && (
            <QueueCard
              href="/dashboard/editorial"
              label="Editorial queue"
              value={counts.editorialQueue}
              hint="stories being prepared"
            />
          )}
          {isStaff(user) && (
            <>
              <QueueCard
                href="/dashboard/admin/submissions?status=SUBMITTED"
                label="Eligibility queue"
                value={counts.eligibilityQueue}
                hint="awaiting a check"
                urgent={counts.eligibilityQueue > 0}
              />
              <QueueCard
                href="/dashboard/admin/inquiries"
                label="Rights enquiries"
                value={counts.newInquiries}
                hint="unanswered"
                urgent={counts.newInquiries > 0}
              />
              <QueueCard
                href="/dashboard/admin/messages"
                label="Messages"
                value={counts.newMessages}
                hint="from the contact form"
                urgent={counts.newMessages > 0}
              />
            </>
          )}
        </div>

        {/* ---- writer submissions ----------------------------------------- */}
        {hasRole(user, 'writer') && (
          <Panel
            title="Your recent submissions"
            action={
              <ButtonLink href="/dashboard/submissions/new" size="sm" variant="gold">
                Start a submission
              </ButtonLink>
            }
          >
            {submissions.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  You have not started an entry yet. Competitions are listed on the{' '}
                  <Link href="/programmes" className="text-gold-700 underline">
                    programmes page
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {submissions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-[1_1_14rem]">
                      <Link
                        href={`/dashboard/submissions/${s.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {s.title || 'Untitled draft'}
                      </Link>
                      <p className="text-xs text-muted">
                        {s.competition_name}
                        {s.reference && ` · ${s.reference}`} · updated {relativeTime(s.updated_at)}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {/* ---- what your roles allow --------------------------------------- */}
        <Panel title="Your roles" description="What each role lets you do on the platform.">
          <ul className="space-y-3">
            {user.roles.map((role) => (
              <li key={role} className="flex flex-wrap items-baseline gap-3">
                <Badge tone="gold">{role.replace('_', ' ')}</Badge>
                <span className="flex-1 text-sm text-muted">{ROLE_DESCRIPTIONS[role]}</span>
              </li>
            ))}
            {user.roles.length === 0 && (
              <li className="text-sm text-muted">
                No roles assigned yet. Contact the Foundation if you were expecting access.
              </li>
            )}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function QueueCard({
  href,
  label,
  value,
  hint,
  urgent,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  urgent?: boolean;
}) {
  return (
    <Card className={urgent && value > 0 ? 'relative border-gold-500 p-5' : 'relative p-5'}>
      <Link href={href} className="before:absolute before:inset-0">
        <p className="text-sm font-medium text-forest-700">{label}</p>
      </Link>
      <div className="mt-2">
        <Stat value={formatNumber(value)} label={hint} />
      </div>
    </Card>
  );
}
