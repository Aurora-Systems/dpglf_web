import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, Card, EmptyState, Panel, Table, Td, Th, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { auditLog, notificationLog } from '@/features/admin/queries';
import { PruneButton } from '@/features/admin/Ops';

const ENTITY_FILTERS = ['submission', 'story', 'user', 'competition', 'guardian_consent', 'file'];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requireStaff('/dashboard/admin/audit');
  const { entity } = await searchParams;
  const [events, notifications] = await Promise.all([auditLog(200, entity), notificationLog(60)]);
  const failed = notifications.filter((n) => !n.sent_at);

  return (
    <>
      <PageHeader
        title="Audit log"
        lead="Admin actions, judging changes, publication decisions and rights changes. Append-only."
      />

      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/dashboard/admin/audit"
              className={cx(
                'rounded-md px-2.5 py-1 text-[13px]',
                !entity ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
              )}
            >
              Everything
            </Link>
            {ENTITY_FILTERS.map((e) => (
              <Link
                key={e}
                href={`/dashboard/admin/audit?entity=${e}`}
                className={cx(
                  'rounded-md px-2.5 py-1 text-[13px]',
                  entity === e ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
                )}
              >
                {e.replace('_', ' ')}
              </Link>
            ))}
          </div>
        </Card>

        <Panel title={`${events.length} event${events.length === 1 ? '' : 's'}`}>
          {events.length === 0 ? (
            <EmptyState title="Nothing recorded yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Who</Th>
                  <Th>Entity</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <Td className="text-xs whitespace-nowrap text-muted">{formatDateTime(e.created_at)}</Td>
                    <Td>
                      <code className="font-mono text-[12px] text-forest-800">{e.action}</code>
                    </Td>
                    <Td className="text-muted">
                      {e.actor_name ?? 'System'}
                      {e.ip && <p className="text-[11px]">{e.ip}</p>}
                    </Td>
                    <Td className="text-xs text-muted">
                      {e.entity_type}
                      {e.entity_id && <p className="font-mono text-[10px]">{e.entity_id.slice(0, 8)}</p>}
                    </Td>
                    <Td className="max-w-xs text-[12px] break-words text-muted">
                      {Object.keys(e.metadata ?? {}).length > 0 ? JSON.stringify(e.metadata) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Email delivery"
          description="Every message the platform intended to send, whether or not it left the building."
          action={failed.length > 0 ? <Badge tone="bad">{failed.length} failed</Badge> : undefined}
        >
          {notifications.length === 0 ? (
            <p className="text-sm text-muted">No email has been sent yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>To</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <Td className="text-xs whitespace-nowrap text-muted">{formatDateTime(n.created_at)}</Td>
                    <Td>
                      <code className="font-mono text-[12px] text-forest-800">{n.type}</code>
                      <p className="text-xs text-muted">{n.subject}</p>
                    </Td>
                    <Td className="text-xs text-muted">{n.to_email}</Td>
                    <Td>
                      <Badge tone={n.sent_at ? 'good' : 'bad'}>{n.sent_at ? 'sent' : 'not sent'}</Badge>
                      {n.last_error && <p className="mt-1 text-[11px] text-red-700">{n.last_error}</p>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="Housekeeping">
          <PruneButton />
        </Panel>
      </div>
    </>
  );
}
