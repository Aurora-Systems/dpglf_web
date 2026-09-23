import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { requireUser } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { myNotifications } from '@/features/dashboard/queries';

export default async function NotificationsPage() {
  const user = await requireUser('/dashboard/notifications');
  const rows = await myNotifications(user.userId);

  return (
    <>
      <PageHeader
        title="Notifications"
        lead="Every message the Foundation has sent you, so nothing important is lost in a spam folder."
      />

      {rows.length === 0 ? (
        <EmptyState title="Nothing yet">
          Submission receipts, judging outcomes and mentorship updates appear here as they are sent.
        </EmptyState>
      ) : (
        <Panel title="Your messages">
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-forest-900">{n.subject}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(n.created_at)} · {n.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <Badge tone={n.sent_at ? 'good' : 'bad'}>{n.sent_at ? 'Sent' : 'Not delivered'}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-muted">
            If a message shows as not delivered, check the address on your account and contact the
            Foundation so we can resend it.
          </p>
        </Panel>
      )}
    </>
  );
}
