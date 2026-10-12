import { PageHeader } from '@/components/dashboard/Shell';
import { EmptyState, FilterChip } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { adminMessageCounts, adminMessages } from '@/features/admin/queries';
import { MessageCard } from './MessageCard';

/** The inbox views. "New" is the default: what still needs someone's attention. */
const VIEWS = [
  { key: 'new', label: 'New' },
  { key: 'handled', label: 'Handled' },
  { key: 'spam', label: 'Spam' },
  { key: 'all', label: 'All' },
] as const;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff('/dashboard/admin/messages');
  const { status: asked } = await searchParams;
  const view = VIEWS.find((v) => v.key === asked)?.key ?? 'new';
  const [messages, counts] = await Promise.all([
    adminMessages(view === 'all' ? undefined : view),
    adminMessageCounts(),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const countFor = (key: string) => (key === 'all' ? total : (counts[key] ?? 0));
  const inView = countFor(view);

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Messages"
        lead="Everything sent through the contact form. Escalate safeguarding concerns straight away."
      />

      {total > 0 && (
        <nav aria-label="Show messages" className="mb-6 flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <FilterChip
              key={v.key}
              href={v.key === 'new' ? '/dashboard/admin/messages' : `/dashboard/admin/messages?status=${v.key}`}
              current={view === v.key}
              label={v.label}
              count={countFor(v.key)}
            />
          ))}
        </nav>
      )}

      {messages.length === 0 ? (
        total === 0 ? (
          <EmptyState title="No messages yet">
            Messages sent through the contact form on the site arrive here.
          </EmptyState>
        ) : view === 'new' ? (
          <EmptyState title="No new messages">
            You are all caught up. Handled messages are kept under Handled.
          </EmptyState>
        ) : (
          <EmptyState title={`No ${view === 'spam' ? 'spam' : 'handled messages'}`} />
        )
      ) : (
        <div className="space-y-4">
          {inView > messages.length && (
            <p className="text-[13px] text-muted">
              Showing the latest {messages.length} of {inView}.
            </p>
          )}

          {messages.map((m) => (
            <MessageCard key={m.id} message={m} showNew={view === 'all'} />
          ))}
        </div>
      )}
    </>
  );
}
