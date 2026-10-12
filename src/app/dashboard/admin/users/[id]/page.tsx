import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, EmptyState, Panel, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, formatDateTime, relativeTime } from '@/lib/format';
import type { Role } from '@/lib/roles';
import { adminUser, userActivity } from '@/features/admin/queries';
import { describeAction, isRoutineAction } from '@/features/admin/activity';
import { AccountStatusForm, RolesForm } from '@/features/admin/Forms';
import { groupByDay } from '../../audit/events';
import { DayHeading, EventRow } from '../../audit/EventRow';
import { RoleBadges, StatusFlags } from '../people';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many events the page shows; everything else is under Activity & email. */
const ACTIVITY_LIMIT = 25;

/** Staff actions on this person's account, phrased about them rather than "someone". */
const DONE_TO_THEM: Record<string, string> = {
  'user.roles_updated': 'changed their roles',
  'user.suspended': 'suspended their account',
  'user.active': 'reactivated their account',
  'user.deleted': 'deleted their account',
};

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaff(`/dashboard/admin/users/${id}`);
  if (!UUID.test(id)) notFound();

  const [person, activity] = await Promise.all([adminUser(id), userActivity(id, ACTIVITY_LIMIT)]);
  if (!person) notFound();

  const roles = (person.roles ?? []) as Role[];
  const name = person.name || person.email;
  const verified = Boolean(person.email_verified_at);
  const days = groupByDay(activity);

  // On a phone, name and email take a row each (they run long) and the short facts pair up.
  const facts: [string, React.ReactNode, string?][] = [
    ['Name', person.name || <span className="text-muted">Not given</span>, 'col-span-2 sm:col-span-1'],
    [
      'Email',
      <a key="email" href={`mailto:${person.email}`} className="text-gold-700 underline-offset-2 hover:underline">
        {person.email}
      </a>,
      'col-span-2 sm:col-span-1',
    ],
    [
      'Email confirmed',
      verified ? (
        `Yes, ${formatDate(person.email_verified_at)}`
      ) : (
        <span className="text-red-800">Not yet</span>
      ),
    ],
    ['Joined', formatDate(person.created_at)],
    [
      'Last seen',
      person.last_login_at ? (
        <span title={formatDateTime(person.last_login_at)}>{relativeTime(person.last_login_at)}</span>
      ) : (
        'Never signed in'
      ),
    ],
    [
      'Submissions',
      person.submissions > 0 || person.drafts > 0 ? (
        <>
          {person.submissions > 0 && person.name ? (
            <Link
              href={`/dashboard/admin/submissions?q=${encodeURIComponent(person.name)}`}
              className="text-gold-700 underline-offset-2 hover:underline"
            >
              {person.submissions} entered
            </Link>
          ) : (
            `${person.submissions} entered`
          )}
          {person.drafts > 0 && <span className="text-muted">, plus {person.drafts} in draft</span>}
        </>
      ) : (
        'None'
      ),
    ],
  ];

  return (
    <>
      <PageHeader
        eyebrow="People"
        back={{ href: '/dashboard/admin/users', label: 'People & roles' }}
        title={name}
        lead={
          <span className="flex flex-wrap items-center gap-1.5">
            <RoleBadges roles={roles} />
            <StatusFlags status={person.status} verified={verified} />
          </span>
        }
      />

      <div className="space-y-6">
        <Panel title="Profile">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-8 xl:grid-cols-3">
            {facts.map(([label, value, span]) => (
              <div key={label} className={cx('min-w-0', span)}>
                <dt className="text-[13px] text-muted">{label}</dt>
                <dd className="mt-0.5 text-sm text-forest-900 wrap-anywhere">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Panel
            title="Roles"
            description="Roles add up: one person can write, judge and mentor. Changes take effect when they next sign in or refresh."
          >
            <RolesForm userId={person.id} roles={roles} />
          </Panel>

          <Panel
            title="Account"
            action={
              <Badge tone={person.status === 'active' ? 'good' : 'bad'}>
                {person.status === 'active' ? 'Active' : person.status === 'suspended' ? 'Suspended' : 'Deleted'}
              </Badge>
            }
          >
            <AccountStatusForm userId={person.id} status={person.status} self={viewer.userId === person.id} />
          </Panel>
        </div>

        <Panel
          title="Recent activity"
          description={
            <>
              {activity.length >= ACTIVITY_LIMIT ? `The latest ${ACTIVITY_LIMIT} events: ` : 'Events: '}
              what they did, and changes staff made to their account. Times are Harare time. Everyone&apos;s
              activity is under{' '}
              <Link href="/dashboard/admin/audit" className="text-gold-700 hover:underline">
                Activity &amp; email
              </Link>
              .
            </>
          }
        >
          {activity.length === 0 ? (
            <EmptyState title="Nothing recorded yet" />
          ) : (
            <div className="space-y-5">
              {days.map((day) => (
                <section key={day.key} aria-labelledby={`day-${day.key}`}>
                  <DayHeading id={`day-${day.key}`}>{day.label}</DayHeading>
                  <ol className="divide-y divide-line/60">
                    {day.rows.map((e) => {
                      // Their own actions read as a list ("Submitted an entry"): the page
                      // is about them, so their name on every row would only be noise.
                      // Staff actions on the account name the member of staff.
                      const byStaff = e.about_them && Boolean(e.actor_id);
                      const actor = e.actor_name || e.actor_email || 'A member of staff';
                      const sentence = byStaff ? (
                        <>
                          <Link
                            href={`/dashboard/admin/users/${e.actor_id}`}
                            className={cx('font-medium hover:text-gold-700', !isRoutineAction(e.action) && 'text-forest-900')}
                          >
                            {actor}
                          </Link>{' '}
                          {DONE_TO_THEM[e.action] ?? describeAction(e.action)}
                        </>
                      ) : (
                        sentenceCase(describeAction(e.action))
                      );
                      return <EventRow key={e.id} event={e} sentence={sentence} omitLabel={name} />;
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
