import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, EmptyState, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, formatDateTime } from '@/lib/format';
import { EmoworldControls } from '@/features/admin/Forms';
import { emoworldQueueRows, isEmoworldSyncEnabled } from '@/features/emoworld/sync';
import { STORY_TABS } from '../tabs';

const QUEUE_LIMIT = 50;

const STATUS: Record<string, { label: string; tone: 'good' | 'bad' | 'neutral' | 'progress' }> = {
  pending: { label: 'Waiting', tone: 'neutral' },
  sending: { label: 'Sending', tone: 'progress' },
  sent: { label: 'Sent', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

/** A row still working on a withdrawal says so, rather than looking like a send. */
const WITHDRAWING: Record<string, { label: string; tone: 'good' | 'bad' | 'neutral' | 'progress' }> = {
  pending: { label: 'Withdrawal waiting', tone: 'neutral' },
  sending: { label: 'Withdrawing', tone: 'progress' },
  failed: { label: 'Withdrawal failed', tone: 'bad' },
};

export default async function EmoworldHandoffPage() {
  await requireStaff('/dashboard/admin/stories/emoworld');
  const queue = await emoworldQueueRows(QUEUE_LIMIT);
  const enabled = isEmoworldSyncEnabled();

  return (
    <>
      <PageHeader
        eyebrow="Archive & rights"
        title="Stories & archive"
        lead="The Foundation's record of each selected story: its text, archive details, rights and where it has been published."
        action={
          <ButtonLink href="/dashboard/admin/stories/new" variant="gold">
            New story record
          </ButtonLink>
        }
      />
      <SectionTabs label="Stories and archive" tabs={STORY_TABS} />

      <div className="space-y-6">
        <Panel
          title="Send to Emoworld"
          description="Stories approved for publication are queued automatically for review inside the Emoworld platform. Queue one by hand from its story page."
        >
          <EmoworldControls enabled={enabled} />
        </Panel>

        <Panel
          title="Handoff queue"
          description={
            queue.length >= QUEUE_LIMIT
              ? `The latest ${QUEUE_LIMIT} handoffs, newest first.`
              : 'Every handoff, newest first. Cancelled rows stay as history.'
          }
        >
          {queue.length === 0 ? (
            <EmptyState title="Nothing queued yet">
              A story joins the queue when it is approved for publication.
            </EmptyState>
          ) : (
            <Table min="min-w-0">
              <thead>
                <tr>
                  <Th>Story</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Queued</Th>
                  <Th className="hidden sm:table-cell">Attempts</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => {
                  const s = (q.action === 'withdraw' ? WITHDRAWING[q.status] : undefined) ??
                    STATUS[q.status] ?? { label: q.status, tone: 'neutral' as const };
                  return (
                    <tr key={q.id}>
                      <Td className="min-w-0">
                        <Link
                          href={`/dashboard/admin/stories/${q.story_id}`}
                          className="-my-1 inline-block py-1 font-medium text-forest-900 hover:text-gold-700"
                        >
                          {q.title}
                        </Link>
                        <p className="text-xs text-muted md:hidden">Queued {formatDate(q.created_at)}</p>
                        {q.last_error && q.status !== 'sent' && (
                          <p className="mt-1 text-xs text-red-700 wrap-anywhere">{q.last_error}</p>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {q.sent_at && <p className="mt-1 text-xs text-muted">{formatDate(q.sent_at)}</p>}
                      </Td>
                      <Td className="hidden text-[13px] whitespace-nowrap text-muted md:table-cell">
                        {formatDateTime(q.created_at)}
                      </Td>
                      <Td className="hidden text-[13px] text-muted sm:table-cell">{q.attempts}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
