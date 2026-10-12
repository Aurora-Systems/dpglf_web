import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, EmptyState, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { deadlineLabel, formatDate, formatNumber } from '@/lib/format';
import { adminCompetitions, type AdminCompetition } from '@/features/admin/queries';
import { COMPETITION_TABS } from './tabs';
import { closingDatePassed, competitionStatus } from './status';

const GROUPS: { title: string; description?: string; statuses: string[] }[] = [
  { title: 'Open for entries', description: 'Writers can enter until the closing time.', statuses: ['open'] },
  { title: 'Judging', description: 'Entries are with the judges.', statuses: ['judging'] },
  { title: 'Drafts', description: 'Hidden from the website until you open them.', statuses: ['draft'] },
  { title: 'Closed and past', statuses: ['closed', 'completed', 'archived'] },
];

export default async function AdminCompetitionsPage() {
  await requireStaff('/dashboard/admin/competitions');
  const competitions = await adminCompetitions();

  const known = new Set(GROUPS.flatMap((g) => g.statuses));
  const groups = GROUPS.map((g, i) => ({
    ...g,
    // Anything with an unexpected status still shows, in the last group.
    items: competitions.filter(
      (c) => g.statuses.includes(c.status) || (i === GROUPS.length - 1 && !known.has(c.status)),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        title="Competitions"
        lead="Open and close programmes, set the rules writers accept, and attach the judging rubric."
        action={
          <ButtonLink href="/dashboard/admin/competitions/new" variant="gold">
            New competition
          </ButtonLink>
        }
      />
      <SectionTabs label="Competitions" tabs={COMPETITION_TABS} />

      {competitions.length === 0 ? (
        <EmptyState
          title="No competitions yet"
          action={
            <ButtonLink href="/dashboard/admin/competitions/new" variant="gold">
              New competition
            </ButtonLink>
          }
        >
          Start with a draft. Nothing is public until you open it.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <Panel
              key={g.title}
              title={
                <>
                  {g.title}
                  <span className="ml-2 font-sans text-sm font-normal text-muted">{g.items.length}</span>
                </>
              }
              description={g.description}
            >
              <ul className="divide-y divide-line">
                {g.items.map((c) => (
                  <CompetitionRow key={c.id} c={c} />
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

function CompetitionRow({ c }: { c: AdminCompetition }) {
  const status = competitionStatus(c.status);
  const href = `/dashboard/admin/competitions/${c.id}`;
  return (
    <li className="flex flex-col gap-4 py-5 first:pt-1 last:pb-1 md:flex-row md:items-start md:justify-between md:gap-8">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Link href={href} className="font-display text-lg font-semibold text-forest-900 hover:text-gold-700">
            {c.name}
          </Link>
          <Badge tone={status.tone}>{status.label}</Badge>
          {c.is_featured && <Badge tone="gold">Featured</Badge>}
        </div>
        {c.tagline && <p className="mt-1 text-sm text-muted">{c.tagline}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,1.3fr)]">
          <div>
            <dt className="text-xs text-muted">Opens</dt>
            <dd className="mt-0.5 text-forest-900">{c.opens_at ? formatDate(c.opens_at) : 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Deadline</dt>
            <dd className="mt-0.5 text-forest-900">{deadlineLabel(c.closes_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Entries</dt>
            <dd className="mt-0.5 text-forest-900">{formatNumber(c.submission_count)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Rubric</dt>
            <dd className="mt-0.5">
              {c.rubric_id ? (
                <span className="text-forest-900">
                  {c.rubric_name} <span className="text-muted">v{c.rubric_version}</span>
                </span>
              ) : (
                <Badge tone="bad">No rubric</Badge>
              )}
            </dd>
          </div>
        </dl>

        {closingDatePassed(c) && (
          <p className="mt-3 text-[13px] text-gold-700">
            The closing date has passed, so entries are shut. Move it to Judging when you are ready.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 md:shrink-0 md:flex-col md:items-stretch">
        <ButtonLink href={href} variant="outline" size="sm" className="min-h-10">
          Manage
        </ButtonLink>
        {c.status === 'draft' ? (
          <span className="inline-flex min-h-10 items-center px-3 text-[13px] text-muted">Not public yet</span>
        ) : (
          <ButtonLink href={`/programmes/${c.slug}`} variant="ghost" size="sm" className="min-h-10">
            View public page
          </ButtonLink>
        )}
      </div>
    </li>
  );
}
