import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonLink, Card, Panel, Stat } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatNumber, relativeTime } from '@/lib/format';
import { adminKpis, recentActivity } from '@/features/dashboard/queries';
import { notificationLog } from '@/features/admin/queries';

export default async function AdminOverviewPage() {
  await requireStaff('/dashboard/admin');
  const [kpis, activity, notifications] = await Promise.all([
    adminKpis(),
    recentActivity(10),
    notificationLog(8),
  ]);

  const unsent = notifications.filter((n) => !n.sent_at);
  const coverage = kpis
    ? kpis.judgingCoverage.assigned === 0
      ? 0
      : Math.round((kpis.judgingCoverage.completed / kpis.judgingCoverage.assigned) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="Admin overview"
        lead="The state of the pipeline, from submissions through judging to the archive."
        action={
          <ButtonLink href="/dashboard/admin/competitions" variant="gold">
            Manage competitions
          </ButtonLink>
        }
      />

      {!kpis ? (
        <Alert tone="warning" title="No database connection">
          Set DATABASE_URL and run the schema to see live numbers here.
        </Alert>
      ) : (
        <div className="space-y-6">
          {unsent.length > 0 && (
            <Alert tone="error" title={`${unsent.length} email${unsent.length === 1 ? '' : 's'} did not send`}>
              Check that RESEND_API_KEY is set and the sending domain is verified. The messages are
              recorded and can be retried.
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <Stat value={formatNumber(kpis.totalSubmissions)} label="Submissions received" />
              <p className="mt-2 text-xs text-muted">{kpis.submissionsThisWeek} in the last 7 days</p>
            </Card>
            <Card className="p-5">
              <Stat value={`${coverage}%`} label="Judging complete" />
              <p className="mt-2 text-xs text-muted">
                {kpis.judgingCoverage.completed} of {kpis.judgingCoverage.assigned} assignments
              </p>
            </Card>
            <Card className="p-5">
              <Stat value={formatNumber(kpis.publishedStories)} label="Stories published" />
              <p className="mt-2 text-xs text-muted">{kpis.publicArchive} public in the archive</p>
            </Card>
            <Card className="p-5">
              <Stat value={formatNumber(kpis.adaptationReady)} label="Adaptation-ready" />
              <p className="mt-2 text-xs text-muted">in the IP catalogue</p>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Open competitions" value={kpis.openCompetitions} href="/dashboard/admin/competitions" />
            <MiniStat label="Registered writers" value={kpis.writers} href="/dashboard/admin/users" />
            <MiniStat
              label="Consents pending"
              value={kpis.pendingConsents}
              href="/dashboard/admin/submissions"
              urgent={kpis.pendingConsents > 0}
            />
            <MiniStat label="Emails not sent" value={kpis.unsentEmails} href="/dashboard/admin/audit" urgent={kpis.unsentEmails > 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Recent activity" description="Every consequential action is recorded.">
              {activity.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {activity.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-sm">
                      <code className="font-mono text-[12px] text-forest-800">{a.action}</code>
                      <span className="text-muted">{a.actor_name ?? 'System'}</span>
                      <span className="ml-auto text-xs text-muted">{relativeTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/dashboard/admin/audit" className="mt-4 inline-block text-[13px] text-gold-700 underline">
                Full audit log
              </Link>
            </Panel>

            <Panel title="Recent email" description="Written before dispatch, so failures stay visible.">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted">No email has been sent yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-forest-900">{n.subject}</p>
                        <p className="truncate text-xs text-muted">{n.to_email}</p>
                      </div>
                      <Badge tone={n.sent_at ? 'good' : 'bad'}>{n.sent_at ? 'sent' : 'failed'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function MiniStat({
  label,
  value,
  href,
  urgent,
}: {
  label: string;
  value: number;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Card className={urgent && value > 0 ? 'relative border-gold-500 p-4' : 'relative p-4'}>
      <Link href={href} className="before:absolute before:inset-0 text-sm text-forest-700">
        {label}
      </Link>
      <p className="font-display mt-1 text-2xl font-semibold text-forest-900">{formatNumber(value)}</p>
    </Card>
  );
}
