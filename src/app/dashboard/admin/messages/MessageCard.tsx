import { Badge, ButtonAnchor, Card, cx } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { MessageStatusForm } from '@/features/admin/Forms';

/** Short names for the contact form's topics (see marketing/ContactForm). */
const TOPICS: Record<string, string> = {
  general: 'General',
  submissions: 'Submissions',
  partnership: 'Partnership',
  schools: 'Schools',
  rights: 'Rights',
  media: 'Media',
  support: 'Support',
};

export interface InboxMessage {
  id: string;
  name: string;
  email: string;
  organisation: string;
  topic: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

/** One contact form message: who sent it, what they said, and its status control. */
export function MessageCard({ message: m, showNew = false }: { message: InboxMessage; showNew?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <article>
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4">
          <div className="min-w-0">
            <p className="font-medium text-forest-900">
              {m.name}
              {m.organisation && <span className="font-normal text-muted"> · {m.organisation}</span>}
            </p>
            <a
              href={`mailto:${m.email}`}
              className="-my-1 inline-block py-1 text-sm text-gold-700 underline-offset-2 wrap-anywhere hover:underline"
            >
              {m.email}
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showNew && m.status === 'new' && <Badge tone="progress">New</Badge>}
            <Badge tone={m.topic === 'rights' || m.topic === 'partnership' ? 'gold' : 'neutral'}>
              {TOPICS[m.topic] ?? m.topic}
            </Badge>
            <time dateTime={m.created_at} className="text-xs whitespace-nowrap text-muted">
              {formatDateTime(m.created_at)}
            </time>
          </div>
        </header>

        <div className="px-5 pt-3 pb-4">
          {m.subject && (
            <h2 className="font-display text-lg leading-snug font-semibold text-forest-900 wrap-anywhere">
              {m.subject}
            </h2>
          )}
          <p
            className={cx(
              'rounded-lg bg-parchment px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-forest-800 wrap-anywhere',
              m.subject && 'mt-2',
            )}
          >
            {m.message}
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <MessageStatusForm messageId={m.id} status={m.status} />
          <ButtonAnchor href={`mailto:${m.email}`} variant="outline" size="sm" className="min-h-10 sm:min-h-0">
            Reply by email
          </ButtonAnchor>
        </footer>
      </article>
    </Card>
  );
}
