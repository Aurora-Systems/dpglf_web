import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonAnchor, Card, EmptyState, FilterChip } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { adminInquiries, adminInquiryCounts } from '@/features/admin/queries';
import { InquiryForm } from '@/features/admin/Forms';

const STATUS: Record<string, { label: string; tone: 'good' | 'bad' | 'progress' | 'neutral' }> = {
  new: { label: 'New', tone: 'progress' },
  in_review: { label: 'In review', tone: 'progress' },
  approved: { label: 'Approved', tone: 'good' },
  declined: { label: 'Declined', tone: 'bad' },
  closed: { label: 'Closed', tone: 'neutral' },
};

/** The "format of interest" choices on the public enquiry form, as the requester saw them. */
const FORMATS: Record<string, string> = {
  animation: 'Animation',
  film: 'Feature film',
  television: 'Television series',
  audio: 'Audio drama or podcast',
  educational: 'Educational media',
  publishing: 'Publishing or translation',
  other: 'Something else',
};

/** "Open" is the default view: the enquiries still waiting on the Foundation. */
const VIEWS: { key: string; label: string; statuses?: string[] }[] = [
  { key: 'open', label: 'Open', statuses: ['new', 'in_review'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'declined', label: 'Declined', statuses: ['declined'] },
  { key: 'closed', label: 'Closed', statuses: ['closed'] },
  { key: 'all', label: 'All' },
];

type Inquiry = Awaited<ReturnType<typeof adminInquiries>>[number];

/** One enquiry: who is asking, about what, their message, and the Foundation's response. */
function InquiryCard({ inquiry: i }: { inquiry: Inquiry }) {
  const status = STATUS[i.status] ?? { label: i.status, tone: 'neutral' as const };
  return (
    <Card className="overflow-hidden">
      <article>
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4">
          <div className="min-w-0">
            <p className="font-medium text-forest-900">
              {i.requester_name}
              {i.organisation_name && <span className="font-normal text-muted"> · {i.organisation_name}</span>}
            </p>
            <p className="text-sm text-muted">
              <a
                href={`mailto:${i.requester_email}`}
                className="-my-1 inline-block py-1 text-gold-700 underline-offset-2 wrap-anywhere hover:underline"
              >
                {i.requester_email}
              </a>
              {i.requester_role && <span> · {i.requester_role}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {i.format && <Badge tone="gold">{FORMATS[i.format] ?? i.format}</Badge>}
            <time dateTime={new Date(i.created_at).toISOString()} className="text-xs whitespace-nowrap text-muted">
              {formatDateTime(i.created_at)}
            </time>
          </div>
        </header>

        <div className="space-y-2 px-5 pt-3 pb-4">
          <p className="text-sm text-muted">
            {i.story_title ? (
              <>
                About{' '}
                {i.story_id ? (
                  <Link
                    href={`/dashboard/admin/stories/${i.story_id}`}
                    className="font-medium text-gold-700 underline-offset-2 hover:underline"
                  >
                    {i.story_title}
                  </Link>
                ) : (
                  <span className="font-medium text-forest-900">{i.story_title}</span>
                )}
              </>
            ) : (
              'A general enquiry, not about one story'
            )}
          </p>
          <p className="rounded-lg bg-parchment px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-forest-800 wrap-anywhere">
            {i.message || 'No message.'}
          </p>
        </div>

        <footer className="space-y-3 border-t border-line bg-parchment/50 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Response</p>
            <ButtonAnchor
              href={`mailto:${i.requester_email}`}
              variant="ghost"
              size="sm"
              className="-mr-3 min-h-10 sm:min-h-0"
            >
              Reply by email
            </ButtonAnchor>
          </div>
          <InquiryForm inquiryId={i.id} status={i.status} responseNote={i.response_note} />
          {i.handled_at && (
            <p className="text-xs text-muted">
              Last updated {formatDateTime(i.handled_at)}
              {i.handled_by_name && ` by ${i.handled_by_name}`}
            </p>
          )}
        </footer>
      </article>
    </Card>
  );
}

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff('/dashboard/admin/inquiries');
  const { status: asked } = await searchParams;
  const view = VIEWS.find((v) => v.key === asked) ?? VIEWS[0];
  const [inquiries, counts] = await Promise.all([adminInquiries(view.statuses), adminInquiryCounts()]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const countFor = (v: (typeof VIEWS)[number]) =>
    v.statuses ? v.statuses.reduce((n, s) => n + (counts[s] ?? 0), 0) : total;
  const inView = countFor(view);

  return (
    <>
      <PageHeader
        eyebrow="Archive & rights"
        title="Rights enquiries"
        lead="Publishers, producers and researchers asking about a story. Nothing is licensed here: this is the conversation before any agreement."
      />

      {total > 0 && (
        <nav aria-label="Show enquiries" className="mb-6 flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <FilterChip
              key={v.key}
              href={v.key === 'open' ? '/dashboard/admin/inquiries' : `/dashboard/admin/inquiries?status=${v.key}`}
              current={view.key === v.key}
              label={v.label}
              count={countFor(v)}
            />
          ))}
        </nav>
      )}

      {inquiries.length === 0 ? (
        total === 0 ? (
          <EmptyState title="No enquiries yet">
            Enquiries arrive from the partners page and from adaptation-ready stories in the archive.
          </EmptyState>
        ) : view.key === 'open' ? (
          <EmptyState title="No open enquiries">
            Everything has been answered. Earlier enquiries are under Approved, Declined and Closed.
          </EmptyState>
        ) : (
          <EmptyState title={`No ${view.label.toLowerCase()} enquiries`} />
        )
      ) : (
        <div className="space-y-4">
          {inView > inquiries.length && (
            <p className="text-[13px] text-muted">
              Showing the latest {inquiries.length} of {inView}.
            </p>
          )}
          {inquiries.map((i) => (
            <InquiryCard key={i.id} inquiry={i} />
          ))}
        </div>
      )}
    </>
  );
}
