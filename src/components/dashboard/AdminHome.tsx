import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavIcon, type NavIconName } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, Card, cx } from '@/components/ui';
import type { SessionUser } from '@/lib/session';
import { hasRole } from '@/lib/access';
import { formatDate, formatNumber, relativeTime } from '@/lib/format';
import { POLICY_STUBS } from '@/features/marketing/policies';
import { describeAction, isRoutineAction } from '@/features/admin/activity';
import {
  adminAttention,
  adminKpis,
  recentActivity,
  type AdminAttention,
  type Counts,
} from '@/features/dashboard/queries';

/**
 * The staff home at /dashboard: what is waiting on the team, how the programme
 * is doing, what just happened, and the jobs people come here to start. The
 * page that renders it has already confirmed the viewer is staff.
 */
export async function AdminHome({
  user,
  counts,
  notices,
}: {
  user: SessionUser;
  counts: Counts;
  /** Account notices (welcome, reset, unverified email) shown under the header. */
  notices?: ReactNode;
}) {
  const [kpis, attention, activity] = await Promise.all([
    adminKpis(),
    adminAttention(),
    // Over-fetch, then drop sign-ins and downloads so the decisions show.
    recentActivity(60),
  ]);

  const firstName = greetingName(user.name);
  const events = groupRepeats(activity.filter((a) => !isRoutineAction(a.action))).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={firstName ? `Welcome, ${firstName}` : 'Welcome back'}
        lead="What is waiting on the team, and how the programme is doing."
      />

      {notices}

      {!kpis || !attention ? (
        <Alert tone="warning" title="No database connection">
          Set DATABASE_URL and run the schema to see live numbers here.
        </Alert>
      ) : (
        // A container, so the columns follow the space beside the menu, not the window.
        <div className="@container space-y-10">
          <NeedsAttention attention={attention} />

          <HomeSection title="At a glance" description="Totals across the platform. Each one opens its section.">
            <div className="grid gap-4 @4xl:grid-cols-3">
              <StatList
                label="Programmes"
                icon="trophy"
                stats={[
                  {
                    label: 'Open competitions',
                    value: formatNumber(kpis.openCompetitions),
                    hint: kpis.nextClosingAt
                      ? `Next closes ${formatDate(kpis.nextClosingAt)}`
                      : kpis.openCompetitions === 0
                        ? 'None open right now'
                        : attention.pastClosing >= kpis.openCompetitions
                          ? kpis.openCompetitions === 1
                            ? 'Closing date has passed'
                            : 'Closing dates have passed'
                          : 'No upcoming closing date',
                    href: '/dashboard/admin/competitions',
                  },
                  {
                    label: 'Submissions received',
                    value: formatNumber(kpis.totalSubmissions),
                    hint: `${formatNumber(kpis.submissionsThisWeek)} in the last 7 days`,
                    href: '/dashboard/admin/submissions',
                  },
                  {
                    label: 'Judging complete',
                    value: `${percent(kpis.judgingCoverage.completed, kpis.judgingCoverage.assigned)}%`,
                    hint:
                      kpis.judgingCoverage.assigned === 0
                        ? 'No judges assigned yet'
                        : `${formatNumber(kpis.judgingCoverage.completed)} of ${formatNumber(kpis.judgingCoverage.assigned)} ${kpis.judgingCoverage.assigned === 1 ? 'assignment' : 'assignments'} scored`,
                    href: '/dashboard/admin/submissions',
                  },
                ]}
              />
              <StatList
                label="Archive & rights"
                icon="book"
                stats={[
                  {
                    label: 'Stories published',
                    value: formatNumber(kpis.publishedStories),
                    hint: 'Including archived stories',
                    href: '/dashboard/admin/stories',
                  },
                  {
                    label: 'Public in the archive',
                    value: formatNumber(kpis.publicArchive),
                    hint: 'Excerpt or full text online',
                    href: '/dashboard/admin/stories',
                  },
                  {
                    label: 'Adaptation-ready',
                    value: formatNumber(kpis.adaptationReady),
                    hint: 'Offered to partners',
                    href: '/dashboard/admin/stories',
                  },
                ]}
              />
              <StatList
                label="People"
                icon="people"
                stats={[
                  {
                    label: 'Registered writers',
                    value: formatNumber(kpis.writers),
                    hint: 'Accounts that can submit',
                    href: '/dashboard/admin/users',
                  },
                  {
                    label: 'Judges',
                    value: formatNumber(kpis.judges),
                    hint: 'Can score entries',
                    href: '/dashboard/admin/users',
                  },
                  {
                    label: 'Mentors',
                    value: formatNumber(kpis.mentors),
                    hint: 'Can guide writers',
                    href: '/dashboard/admin/users',
                  },
                ]}
              />
            </div>
          </HomeSection>

          <div className="grid gap-10 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:gap-6">
            {/* First on phones, where it matters most; second column on wide screens. */}
            <HomeSection
              title="Quick actions"
              description="The jobs people most often come here to start."
              className="@4xl:order-last"
            >
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {QUICK_ACTIONS.map((q) => (
                    <li key={q.href}>
                      <Link href={q.href} className="group flex items-center gap-3.5 px-5 py-3 hover:bg-parchment">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-forest-900/6 text-forest-700 group-hover:bg-gold-100 group-hover:text-gold-700">
                          <NavIcon name={q.icon} className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-forest-900 group-hover:text-gold-700">
                            {q.label}
                          </span>
                          <span className="block text-xs text-muted">{q.hint}</span>
                        </span>
                        <span aria-hidden className="shrink-0 text-gold-700">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </HomeSection>

            <HomeSection title="Recent activity" description="Decisions and changes, newest first.">
              <Card className="overflow-hidden">
                {events.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted">Nothing has happened yet beyond sign-ins.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {events.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-0.5 px-5 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <p className="min-w-0 text-forest-800">
                          <span className="font-medium text-forest-900">{a.who}</span> {describeAction(a.action)}
                          {a.times > 1 && (
                            <>
                              {' '}
                              <span className="whitespace-nowrap text-muted">({a.times} times)</span>
                            </>
                          )}
                        </p>
                        <time
                          dateTime={new Date(a.created_at).toISOString()}
                          className="shrink-0 text-xs whitespace-nowrap text-muted"
                        >
                          {relativeTime(a.created_at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-line px-5 py-1.5">
                  <Link
                    href="/dashboard/admin/audit"
                    className="inline-flex min-h-10 items-center text-sm font-medium text-gold-700 hover:underline"
                  >
                    Open the activity log →
                  </Link>
                </div>
              </Card>
            </HomeSection>
          </div>

          <OwnWork user={user} counts={counts} />
        </div>
      )}
    </>
  );
}

// ---- needs attention -----------------------------------------------------------

type Compartment = 'Programmes' | 'Archive & rights' | 'Website' | 'System';

interface AttentionItem {
  key: string;
  count: number;
  sentence: string;
  hint?: string;
  href: string;
  compartment: Compartment;
  /** Short name for the "up to date" line when there is nothing waiting. */
  clear: string;
  tone?: 'bad';
}

function attentionItems(a: AdminAttention): AttentionItem[] {
  const published = new Set(a.publishedPolicies);
  const missingPolicies = POLICY_STUBS.filter((p) => !published.has(p.slug)).length;
  const one = (n: number) => n === 1;

  return [
    {
      key: 'submitted',
      count: a.submitted,
      sentence: `${formatNumber(a.submitted)} new ${one(a.submitted) ? 'entry is' : 'entries are'} waiting for an eligibility check`,
      hint: 'Check each one against the competition rules.',
      href: '/dashboard/admin/submissions?status=SUBMITTED',
      compartment: 'Programmes',
      clear: 'eligibility checks',
    },
    {
      key: 'eligibility-review',
      count: a.eligibilityReview,
      sentence: `${formatNumber(a.eligibilityReview)} ${one(a.eligibilityReview) ? 'entry is' : 'entries are'} part-way through an eligibility check`,
      hint: 'Finish the check so eligible entries can go to judges.',
      href: '/dashboard/admin/submissions?status=ELIGIBILITY_REVIEW',
      compartment: 'Programmes',
      clear: 'eligibility checks',
    },
    {
      key: 'consents',
      count: a.consentsPending,
      sentence: `${formatNumber(a.consentsPending)} ${one(a.consentsPending) ? 'entry is' : 'entries are'} waiting for a guardian's consent`,
      hint: 'Consent is shown against each entry in the submissions list.',
      href: '/dashboard/admin/submissions',
      compartment: 'Programmes',
      clear: 'guardian consents',
    },
    {
      key: 'overdue',
      count: a.overdueReviews,
      sentence: `${formatNumber(a.overdueReviews)} judging ${one(a.overdueReviews) ? 'assignment is' : 'assignments are'} past the due date`,
      hint: 'Remind the judge, or assign the entry to someone else.',
      href: '/dashboard/admin/submissions?status=ASSIGNED_FOR_JUDGING',
      compartment: 'Programmes',
      clear: 'judging deadlines',
    },
    {
      key: 'past-closing',
      count: a.pastClosing,
      sentence: `${formatNumber(a.pastClosing)} ${one(a.pastClosing) ? 'competition is' : 'competitions are'} still open after the closing date`,
      hint: one(a.pastClosing) ? 'Close it, or move it on to judging.' : 'Close them, or move them on to judging.',
      href: a.pastClosingId ? `/dashboard/admin/competitions/${a.pastClosingId}` : '/dashboard/admin/competitions',
      compartment: 'Programmes',
      clear: 'competition dates',
    },
    {
      key: 'editorial',
      count: a.editorialQueue,
      sentence: `${formatNumber(a.editorialQueue)} ${one(a.editorialQueue) ? 'story is' : 'stories are'} in the editorial queue`,
      hint: 'Prepare them for publication.',
      href: '/dashboard/editorial',
      compartment: 'Programmes',
      clear: 'editorial queue',
    },
    {
      key: 'inquiries',
      count: a.newInquiries,
      sentence: `${formatNumber(a.newInquiries)} new rights ${one(a.newInquiries) ? 'enquiry has' : 'enquiries have'} not been answered`,
      href: '/dashboard/admin/inquiries',
      compartment: 'Archive & rights',
      clear: 'rights enquiries',
    },
    {
      key: 'messages',
      count: a.newMessages,
      sentence: `${formatNumber(a.newMessages)} new ${one(a.newMessages) ? 'message has' : 'messages have'} come in through the contact form`,
      href: '/dashboard/admin/messages',
      compartment: 'Website',
      clear: 'messages',
    },
    {
      key: 'policies',
      count: missingPolicies,
      sentence: `${formatNumber(missingPolicies)} ${one(missingPolicies) ? 'policy is' : 'policies are'} not yet published`,
      hint: 'Until then the site shows interim wording.',
      href: '/dashboard/admin/content/pages',
      compartment: 'Website',
      clear: 'policies',
    },
    {
      key: 'emails',
      count: a.failedEmails,
      sentence: `${formatNumber(a.failedEmails)} ${one(a.failedEmails) ? 'email' : 'emails'} could not be sent`,
      hint: 'Check the email settings, then retry them.',
      href: '/dashboard/admin/audit/emails',
      compartment: 'System',
      clear: 'email delivery',
      tone: 'bad',
    },
  ];
}

function NeedsAttention({ attention }: { attention: AdminAttention }) {
  const items = attentionItems(attention);
  const waiting = items.filter((i) => i.count > 0);
  const clear = [...new Set(items.filter((i) => i.count === 0).map((i) => i.clear))].filter(
    (label) => !waiting.some((w) => w.clear === label),
  );

  return (
    <HomeSection
      title="Needs attention"
      description="Work waiting on the team, with a link straight to it."
      action={waiting.length > 0 ? <Badge tone="gold">{waiting.length} to look at</Badge> : undefined}
    >
      <Card className={cx('overflow-hidden', waiting.length > 0 && 'border-gold-500/60')}>
        {waiting.length === 0 ? (
          <div className="flex items-start gap-4 px-5 py-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-700/20 ring-inset">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
                <path d="m5 10.5 3.2 3L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-forest-900">Nothing is waiting on you</p>
              <p className="mt-0.5 text-sm text-muted">
                Entries, judging, enquiries, messages, policies and email are all up to date.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {waiting.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-parchment sm:gap-4 sm:px-5">
                    <span
                      className={cx(
                        'font-display grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-2 text-base font-semibold tabular-nums ring-1 ring-inset',
                        item.tone === 'bad'
                          ? 'bg-red-50 text-red-800 ring-red-700/20'
                          : 'bg-gold-100 text-gold-700 ring-gold-500/40',
                      )}
                    >
                      {formatNumber(item.count)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-forest-900 group-hover:text-gold-700">
                        {item.sentence}
                      </span>
                      {item.hint && <span className="mt-0.5 block text-[13px] text-muted">{item.hint}</span>}
                    </span>
                    <span className="hidden shrink-0 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted uppercase sm:block">
                      {item.compartment}
                    </span>
                    <span aria-hidden className="shrink-0 text-gold-700">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {clear.length > 0 && (
              <p className="border-t border-line bg-parchment px-5 py-3 text-[13px] text-muted">
                <span className="font-medium text-forest-800">Up to date:</span> {joinList(clear)}.
              </p>
            )}
          </>
        )}
      </Card>
    </HomeSection>
  );
}

// ---- your own work ---------------------------------------------------------------

function OwnWork({ user, counts }: { user: SessionUser; counts: Counts }) {
  const stats: StatRow[] = [];
  if (hasRole(user, 'writer')) {
    stats.push({
      label: 'My submissions',
      value: formatNumber(counts.activeSubmissions),
      hint:
        counts.drafts > 0
          ? `${formatNumber(counts.drafts)} unfinished ${counts.drafts === 1 ? 'draft' : 'drafts'}`
          : 'In progress',
      href: '/dashboard/submissions',
    });
  }
  if (hasRole(user, 'judge')) {
    stats.push({
      label: 'Entries to score',
      value: formatNumber(counts.judgeOutstanding),
      hint: 'Assigned to you',
      href: '/dashboard/judge',
    });
  }
  if (hasRole(user, 'mentor')) {
    stats.push({
      label: 'Active mentees',
      value: formatNumber(counts.mentorActive),
      hint: 'Writers you are guiding',
      href: '/dashboard/mentor',
    });
  }
  if (stats.length === 0) return null;

  return (
    <HomeSection title="Your own work" description="Your own writing, judging and mentoring.">
      <div className={cx('grid gap-4', stats.length > 1 && 'sm:grid-cols-2', stats.length > 2 && 'lg:grid-cols-3')}>
        {stats.map((s) => (
          <StatList key={s.href} stats={[s]} />
        ))}
      </div>
    </HomeSection>
  );
}

// ---- building blocks -------------------------------------------------------------

/** One compartment of the home page: a heading, a line of guidance, then its content. */
export function HomeSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = `home-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className={cx('min-w-0', className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-xl font-semibold text-forest-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface StatRow {
  label: string;
  value: string;
  hint?: string;
  href: string;
}

/**
 * A labelled group of figures. Where the group sits in a narrow column the
 * figures stack as rows; where it spans a wide space (tablets, or the page
 * beside the menu on a small laptop) they sit side by side, figure on top.
 */
function StatList({ label, icon, stats }: { label?: string; icon?: NavIconName; stats: StatRow[] }) {
  const across = stats.length > 1;
  return (
    <Card className={cx('overflow-hidden', across && '@container')}>
      {label && (
        <div className="flex items-center gap-2 border-b border-line bg-parchment px-5 py-2.5">
          {icon && <NavIcon name={icon} className="size-4 text-gold-700" />}
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-forest-700 uppercase">{label}</h3>
        </div>
      )}
      <ul
        className={cx(
          'divide-y divide-line',
          across && '@md:grid @md:grid-cols-3 @md:divide-x @md:divide-y-0',
        )}
      >
        {stats.map((s) => (
          <li key={s.label} className="min-w-0">
            <Link
              href={s.href}
              className={cx(
                'group flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-parchment',
                across && '@md:h-full @md:flex-col-reverse @md:items-start @md:justify-end @md:gap-2 @md:py-4',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-forest-900 group-hover:text-gold-700">
                  {s.label}
                  <span aria-hidden className="ml-1.5 text-gold-700 opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </span>
                {s.hint && <span className="block text-xs text-muted">{s.hint}</span>}
              </span>
              <span className="font-display shrink-0 text-[28px] leading-none font-semibold text-forest-900 tabular-nums">
                {s.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const QUICK_ACTIONS: { href: string; label: string; hint: string; icon: NavIconName }[] = [
  { href: '/dashboard/admin/competitions/new', label: 'New competition', hint: 'Set the dates, rules and judging.', icon: 'trophy' },
  { href: '/dashboard/admin/submissions/assign', label: 'Assign judges', hint: 'Send eligible entries to judges.', icon: 'clipboard' },
  { href: '/dashboard/admin/content/news/new', label: 'Write a news post', hint: 'Share an update on the site.', icon: 'news' },
  { href: '/dashboard/admin/users', label: 'Manage people and roles', hint: 'Change roles and account access.', icon: 'people' },
  { href: '/', label: 'View the public site', hint: 'See what visitors see.', icon: 'home' },
];

/**
 * The first name to greet, or null when the account name is a role rather than
 * a person ("Foundation Administrator" would otherwise read "Welcome, Foundation").
 */
function greetingName(name: string | null | undefined): string | null {
  const clean = (name || '').trim();
  if (!clean || /\b(admin|administrator)\b/i.test(clean)) return null;
  return clean.split(/\s+/)[0];
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** "a, b and c" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

type ActivityRow = Awaited<ReturnType<typeof recentActivity>>[number];

/**
 * Folds runs of the same person doing the same thing ("created a news post"
 * three times in a row) into one line with a count, so the list stays varied.
 * Keeps the newest time of each run.
 */
function groupRepeats(rows: ActivityRow[]): (ActivityRow & { who: string; times: number })[] {
  const out: (ActivityRow & { who: string; times: number })[] = [];
  for (const row of rows) {
    const name = who(row);
    const last = out[out.length - 1];
    if (last && last.who === name && last.action === row.action) last.times += 1;
    else out.push({ ...row, who: name, times: 1 });
  }
  return out;
}

/**
 * Who did it. Events with no actor came from the system, except those about a
 * person's own account ("had their password set"), which read better with
 * that person's name.
 */
function who(a: { action: string; actor_name: string | null; subject_name: string | null }): string {
  if (a.actor_name) return a.actor_name;
  if (a.subject_name && describeAction(a.action).includes('their')) return a.subject_name;
  return 'System';
}
