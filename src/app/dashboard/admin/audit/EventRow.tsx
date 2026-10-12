import Link from 'next/link';
import { cx } from '@/components/ui';
import { isRoutineAction } from '@/features/admin/activity';
import { entityHref, eventDetail, eventNote, isoTime, timeOfDay } from './events';

/** The audit fields a row needs; both auditLog and userActivity return them. */
export interface EventLike {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  entity_label: string | null;
  ip?: string | null;
}

/**
 * One event in a day's list: the time, a plain-English sentence, the record it
 * touched (linked while it still exists) with any useful detail, a quoted note,
 * and the raw action code small and muted for traceability. Shared by
 * Activity & email and each person's page so both read the same way.
 */
export function EventRow({
  event: e,
  sentence,
  omitLabel,
}: {
  event: EventLike;
  /** "Rutendo submitted an entry", with any links the caller wants. */
  sentence: React.ReactNode;
  /** A person's name already in the sentence, so it is not repeated as the record. */
  omitLabel?: string | null;
}) {
  // Link the record only if it still exists (its label was found).
  const target =
    e.entity_label || e.entity_type === 'adaptation_inquiry' ? entityHref(e.entity_type, e.entity_id) : null;
  const label = e.entity_type === 'file' ? (eventDetail(e.action, e.metadata) ?? null) : e.entity_label;
  const showLabel = Boolean(label) && !(e.entity_type === 'user' && label === omitLabel);
  const detail = e.entity_type === 'file' ? null : eventDetail(e.action, e.metadata);
  const note = eventNote(e.metadata);
  const raw = Object.keys(e.metadata ?? {}).length > 0 ? JSON.stringify(e.metadata) : undefined;

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 py-3">
      <time dateTime={isoTime(e.created_at)} className="pt-px text-[13px] text-muted tabular-nums">
        {timeOfDay(e.created_at)}
      </time>
      <div className="min-w-0">
        <p className={cx('text-sm leading-snug', isRoutineAction(e.action) ? 'text-muted' : 'text-forest-900')}>
          {sentence}
        </p>
        {(showLabel || detail) && (
          <p className="mt-0.5 text-[13px] text-muted wrap-anywhere">
            {showLabel &&
              (target ? (
                <Link href={target} className="text-gold-700 hover:underline">
                  {label}
                </Link>
              ) : (
                <span className="text-forest-800">{label}</span>
              ))}
            {showLabel && detail && ' · '}
            {detail}
          </p>
        )}
        {note && (
          <p className="mt-1 border-l-2 border-line pl-2.5 text-[13px] text-muted italic wrap-anywhere">{note}</p>
        )}
        <p className="mt-1 text-[11px] text-muted/80 wrap-anywhere">
          <code className="font-mono" title={raw}>
            {e.action}
          </code>
          {e.ip && <span> · {e.ip}</span>}
        </p>
      </div>
    </li>
  );
}

/** A day's heading in an activity list ("Today", "Yesterday", "28 August 2026"). */
export function DayHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="border-b border-line pb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
      {children}
    </h3>
  );
}
