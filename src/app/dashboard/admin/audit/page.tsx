import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { EmptyState, FilterChip, Panel, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { auditLog } from '@/features/admin/queries';
import { describeAction, isRoutineAction } from '@/features/admin/activity';
import { entityHref, groupByDay } from './events';
import { DayHeading, EventRow } from './EventRow';
import { AUDIT_LEAD, AUDIT_TABS } from './tabs';

/** The record types worth filtering by, in the words the rest of the console uses. */
const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: 'submission', label: 'Entries' },
  { value: 'story', label: 'Stories' },
  { value: 'user', label: 'People' },
  { value: 'competition', label: 'Competitions' },
  { value: 'guardian_consent', label: 'Guardian consent' },
  { value: 'news_post', label: 'News' },
  { value: 'file', label: 'Files' },
  { value: 'setting', label: 'Settings' },
];

/** Guardians act without an account; "A guardian gave guardian consent" would say it twice. */
const GUARDIAN_VERBS: Record<string, string> = {
  'consent.granted': 'gave consent',
  'consent.revoked': 'withdrew consent',
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; routine?: string }>;
}) {
  await requireStaff('/dashboard/admin/audit');
  const { entity, routine } = await searchParams;
  const hideRoutine = routine === 'hide';

  // Routine events (sign-ins, downloads...) can outnumber everything else; fetch
  // extra when they are hidden so the page still shows a useful stretch of history.
  const fetched = await auditLog(hideRoutine ? 500 : 200, entity || undefined);
  const events = (hideRoutine ? fetched.filter((e) => !isRoutineAction(e.action)) : fetched).slice(0, 200);
  const days = groupByDay(events);

  const href = (next: { entity?: string; routine?: string }) => {
    const params = new URLSearchParams();
    const e = 'entity' in next ? next.entity : entity;
    const r = 'routine' in next ? next.routine : routine;
    if (e) params.set('entity', e);
    if (r) params.set('routine', r);
    const qs = params.toString();
    return `/dashboard/admin/audit${qs ? `?${qs}` : ''}`;
  };
  const filterLabel = ENTITY_FILTERS.find((f) => f.value === entity)?.label;

  return (
    <>
      <PageHeader eyebrow="System" title="Activity & email" lead={AUDIT_LEAD} />
      <SectionTabs label="Activity and email" tabs={AUDIT_TABS} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <nav aria-label="Show activity for" className="flex flex-wrap gap-2">
          <FilterChip href={href({ entity: undefined })} current={!entity} label="Everything" />
          {ENTITY_FILTERS.map((f) => (
            <FilterChip key={f.value} href={href({ entity: f.value })} current={entity === f.value} label={f.label} />
          ))}
        </nav>
        <Link
          href={href({ routine: hideRoutine ? undefined : 'hide' })}
          title="Sign-ins, file downloads, draft scores and Emoworld sync runs"
          className="-my-2 inline-flex min-h-10 items-center text-[13px] text-gold-700 hover:underline sm:min-h-0"
        >
          {hideRoutine ? 'Show routine events' : 'Hide routine events'}
        </Link>
      </div>

      <Panel
        title={filterLabel ? `${filterLabel}: recent activity` : 'Recent activity'}
        description={
          events.length === 0
            ? undefined
            : `The latest ${events.length} ${events.length === 1 ? 'event' : 'events'}${
                hideRoutine ? ', without sign-ins, downloads, draft scores and sync runs' : ''
              }. Times are Harare time. Nothing here can be edited or removed.`
        }
      >
        {events.length === 0 ? (
          <EmptyState title="Nothing recorded yet">
            {entity ? 'Try Everything to see activity on other records.' : undefined}
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <section key={day.key} aria-labelledby={`day-${day.key}`}>
                <DayHeading id={`day-${day.key}`}>{day.label}</DayHeading>
                <ol className="divide-y divide-line/60">
                  {day.rows.map((e) => {
                    // No actor: a guardian (who has no account) or something done to an
                    // account from the terminal. Name the person it happened to instead.
                    const aboutPerson = !e.actor_id && e.entity_type === 'user' && Boolean(e.entity_label);
                    const byGuardian = !e.actor_id && e.entity_type === 'guardian_consent';
                    const actor = aboutPerson
                      ? e.entity_label!
                      : byGuardian
                        ? 'A guardian'
                        : e.actor_name || e.actor_email || 'System';
                    const actorHref = e.actor_id
                      ? `/dashboard/admin/users/${e.actor_id}`
                      : aboutPerson
                        ? entityHref('user', e.entity_id)
                        : null;
                    const verb = (byGuardian && GUARDIAN_VERBS[e.action]) || describeAction(e.action);
                    return (
                      <EventRow
                        key={e.id}
                        event={e}
                        omitLabel={actor}
                        sentence={
                          <>
                            {actorHref ? (
                              <Link
                                href={actorHref}
                                className={cx(
                                  'font-medium hover:text-gold-700',
                                  !isRoutineAction(e.action) && 'text-forest-900',
                                )}
                              >
                                {actor}
                              </Link>
                            ) : (
                              <span className="font-medium">{actor}</span>
                            )}{' '}
                            {verb}
                          </>
                        }
                      />
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
