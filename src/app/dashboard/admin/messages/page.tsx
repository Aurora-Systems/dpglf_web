import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { adminMessages } from '@/features/admin/queries';
import { MessageStatusForm } from '@/features/admin/Forms';

export default async function AdminMessagesPage() {
  await requireStaff('/dashboard/admin/messages');
  const messages = await adminMessages();
  const unread = messages.filter((m) => m.status === 'new').length;

  return (
    <>
      <PageHeader
        title="Messages"
        lead="Everything sent through the contact form. Safeguarding concerns should be escalated immediately."
        action={unread > 0 ? <Badge tone="gold">{unread} new</Badge> : undefined}
      />

      {messages.length === 0 ? (
        <EmptyState title="No messages yet" />
      ) : (
        <Panel title="Inbox">
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <li key={m.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-900">
                      {m.name}
                      {m.organisation && <span className="text-muted"> · {m.organisation}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      <a href={`mailto:${m.email}`} className="underline">
                        {m.email}
                      </a>
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(m.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={m.topic === 'rights' || m.topic === 'partnership' ? 'gold' : 'neutral'}>
                      {m.topic}
                    </Badge>
                    <MessageStatusForm messageId={m.id} status={m.status} />
                  </div>
                </div>

                {m.subject && <p className="mt-3 font-medium text-forest-800">{m.subject}</p>}
                <p className="mt-2 rounded-lg bg-parchment px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-forest-800">
                  {m.message}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
