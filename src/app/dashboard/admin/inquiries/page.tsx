import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { adminInquiries } from '@/features/admin/queries';
import { InquiryForm } from '@/features/admin/Forms';

const TONE: Record<string, 'good' | 'bad' | 'progress' | 'neutral'> = {
  new: 'progress',
  in_review: 'progress',
  approved: 'good',
  declined: 'bad',
  closed: 'neutral',
};

export default async function AdminInquiriesPage() {
  await requireStaff('/dashboard/admin/inquiries');
  const inquiries = await adminInquiries();

  return (
    <>
      <PageHeader
        title="Rights enquiries"
        lead="Publishers, producers and researchers registering interest. Nothing is licensed here — this is the conversation that precedes an agreement."
      />

      {inquiries.length === 0 ? (
        <EmptyState title="No enquiries yet">
          Enquiries arrive from the partners page and from adaptation-ready stories in the archive.
        </EmptyState>
      ) : (
        <Panel title={`${inquiries.length} enquir${inquiries.length === 1 ? 'y' : 'ies'}`}>
          <ul className="divide-y divide-line">
            {inquiries.map((i) => (
              <li key={i.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-900">
                      {i.requester_name}
                      {i.organisation_name && <span className="text-muted"> · {i.organisation_name}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      <a href={`mailto:${i.requester_email}`} className="underline">
                        {i.requester_email}
                      </a>
                      {i.requester_role && ` · ${i.requester_role}`}
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(i.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {i.format && <Badge tone="gold">{i.format}</Badge>}
                    <Badge tone={TONE[i.status] ?? 'neutral'}>{i.status.replace('_', ' ')}</Badge>
                  </div>
                </div>

                {i.story_title && (
                  <p className="mt-3 text-sm">
                    About{' '}
                    <Link href={`/archive/${i.story_slug}`} className="text-gold-700 underline">
                      {i.story_title}
                    </Link>
                  </p>
                )}

                <p className="mt-3 rounded-lg bg-parchment px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-forest-800">
                  {i.message}
                </p>

                <div className="mt-4">
                  <InquiryForm inquiryId={i.id} status={i.status} responseNote={i.response_note} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
