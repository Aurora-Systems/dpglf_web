import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, Card, EmptyState, Panel, Table, Td, Th, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDateTime, formatNumber } from '@/lib/format';
import { notificationLog, notificationSummary } from '@/features/admin/queries';
import { PruneButton, RetryEmailsButton } from '@/features/admin/Ops';
import { AUDIT_LEAD, AUDIT_TABS } from '../tabs';

const LOG_LIMIT = 100;

function SummaryCard({ value, label, note, alert }: { value: number; label: string; note?: string; alert?: boolean }) {
  return (
    <Card className="min-w-0 p-3.5 sm:p-5">
      <p className={cx('font-display text-2xl font-semibold sm:text-3xl', alert ? 'text-red-800' : 'text-forest-900')}>
        {formatNumber(value)}
      </p>
      <p className="mt-1 text-sm font-medium text-forest-900">{label}</p>
      {/* Three across even on a phone; the explanation joins them from sm up. */}
      {note && <p className="mt-0.5 hidden text-[13px] text-muted sm:block">{note}</p>}
    </Card>
  );
}

/** The error most unsent messages share, if any: shown once, not on every row. */
function commonError(rows: { sent_at: string | null; last_error: string | null }[]): string | null {
  const tally = new Map<string, number>();
  for (const r of rows) if (!r.sent_at && r.last_error) tally.set(r.last_error, (tally.get(r.last_error) ?? 0) + 1);
  let best: string | null = null;
  let most = 1; // A one-off error stays on its own row.
  for (const [error, n] of tally) if (n > most) [best, most] = [error, n];
  return best;
}

export default async function AdminEmailsPage() {
  await requireStaff('/dashboard/admin/audit/emails');
  const [summary, log] = await Promise.all([notificationSummary(), notificationLog(LOG_LIMIT)]);
  const total = summary.sent + summary.unsent;
  const shared = commonError(log);

  return (
    <>
      <PageHeader eyebrow="System" title="Activity & email" lead={AUDIT_LEAD} />
      <SectionTabs label="Activity and email" tabs={AUDIT_TABS} />

      <div className="space-y-6">
        <section aria-label="Delivery summary" className="grid grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard value={summary.sent} label="Sent" note="Since records began" />
          <SummaryCard
            value={summary.unsent}
            label="Not sent"
            note={summary.unsent > 0 ? 'Failed, or still waiting to go out' : 'Nothing outstanding'}
            alert={summary.unsent > 0}
          />
          <SummaryCard
            value={summary.week_sent + summary.week_unsent}
            label="Last 7 days"
            note={`${formatNumber(summary.week_sent)} sent, ${formatNumber(summary.week_unsent)} not sent`}
          />
        </section>

        {summary.unsent > 0 && (
          <Panel
            title="Failed emails"
            description="The scheduled maintenance job retries each message up to five times. Retry now once the cause is fixed."
          >
            <div className="space-y-4">
              {shared && (
                <div className="rounded-lg border border-red-700/20 bg-red-50 px-4 py-3 text-sm">
                  <p className="font-medium text-red-900">Most of them failed with this error</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-red-800 wrap-anywhere">{shared}</p>
                </div>
              )}
              {summary.retryable > 0 ? (
                <>
                  <p className="text-sm text-muted">
                    {summary.retryable === summary.unsent
                      ? `All ${formatNumber(summary.retryable)} can be retried.`
                      : `${formatNumber(summary.retryable)} of the ${formatNumber(summary.unsent)} can be retried. The others were recorded before message content was stored, so they cannot be sent again.`}{' '}
                    Each press sends up to 50.
                  </p>
                  <RetryEmailsButton />
                </>
              ) : (
                <p className="text-sm text-muted">
                  None of these can be retried: they were recorded before message content was stored.
                </p>
              )}
            </div>
          </Panel>
        )}

        <Panel
          title="Delivery log"
          description={
            total > log.length
              ? `The latest ${log.length} of ${formatNumber(total)} messages, newest first. Times are Harare time.`
              : 'Every message the platform meant to send, newest first. Times are Harare time.'
          }
        >
          {log.length === 0 ? (
            <EmptyState title="No email yet">Messages appear here as the platform sends them.</EmptyState>
          ) : (
            <Table min="min-w-0">
              <thead>
                <tr>
                  <Th>Message</Th>
                  <Th className="hidden xl:table-cell">To</Th>
                  <Th className="hidden sm:table-cell">When</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {log.map((n) => {
                  const ownError = !n.sent_at && n.last_error && n.last_error !== shared ? n.last_error : null;
                  return (
                    <tr key={n.id}>
                      <Td className="min-w-0">
                        <p className="text-forest-900 wrap-anywhere">{n.subject || 'No subject'}</p>
                        <p className="mt-0.5 text-xs text-muted wrap-anywhere xl:hidden">{n.to_email ?? 'No address'}</p>
                        <p className="mt-0.5 text-xs text-muted sm:hidden">{formatDateTime(n.created_at)}</p>
                        <p className="mt-0.5">
                          <code className="font-mono text-[11px] text-muted/80">{n.type}</code>
                        </p>
                      </Td>
                      {/* Break only where an address must, not mid-domain at every chance. */}
                      <Td className="hidden text-[13px] text-muted xl:table-cell">
                        <span className="wrap-break-word">{n.to_email ?? 'No address'}</span>
                      </Td>
                      <Td className="hidden text-[13px] whitespace-nowrap text-muted sm:table-cell">
                        {formatDateTime(n.created_at)}
                      </Td>
                      <Td className="w-32 sm:w-40">
                        <Badge tone={n.sent_at ? 'good' : 'bad'}>{n.sent_at ? 'Sent' : 'Not sent'}</Badge>
                        {!n.sent_at && (
                          <p
                            className="mt-1 text-[11px] text-muted"
                            title={n.last_error && !ownError ? n.last_error : undefined}
                          >
                            {n.attempts} {n.attempts === 1 ? 'attempt' : 'attempts'}
                            {!n.retryable && ', cannot be retried'}
                          </p>
                        )}
                        {ownError && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-red-700 wrap-anywhere" title={ownError}>
                            {ownError}
                          </p>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="Maintenance" className="max-w-2xl">
          <PruneButton />
        </Panel>
      </div>
    </>
  );
}
