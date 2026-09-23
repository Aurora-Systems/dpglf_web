import type { Metadata } from 'next';
import Link from 'next/link';
import { StoryCard } from '@/components/site/StoryCard';
import { Badge, ButtonLink, Card, EmptyState, Eyebrow, buttonClass, cx } from '@/components/ui';
import { getSessionUser } from '@/lib/auth';
import { formatNumber } from '@/lib/format';
import { canBrowseAdaptationCatalogue } from '@/lib/permissions';
import { archiveFacets, searchArchive, PAGE_SIZE, type ArchiveFilters } from '@/features/archive/queries';

export const metadata: Metadata = {
  title: 'Story Archive',
  description:
    'A permanent, searchable repository of contemporary African youth narratives, preserved with the cultural and language metadata that makes them findable.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

/** Build a link that keeps the current filters and changes one of them. */
function withParam(
  current: Record<string, string | undefined>,
  key: string,
  value: string | undefined,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, [key]: value, page: undefined })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return `/archive${qs ? `?${qs}` : ''}`;
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await getSessionUser();

  const current = {
    q: one(sp.q),
    country: one(sp.country),
    language: one(sp.language),
    genre: one(sp.genre),
    theme: one(sp.theme),
    year: one(sp.year),
    edition: one(sp.edition),
    age: one(sp.age),
    adaptation: one(sp.adaptation),
  };
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);

  const filters: ArchiveFilters = {
    ...current,
    adaptationReady: current.adaptation === '1' && canBrowseAdaptationCatalogue(user),
    page,
  };

  const [{ rows, total }, facets] = await Promise.all([
    searchArchive(user, filters),
    archiveFacets(user),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = Object.entries(current).filter(([, v]) => v);

  // [heading, query param, values, optional display formatter]
  const facetGroups: [string, string, string[], ((v: string) => string)?][] = [
    ['Country', 'country', facets.countries],
    ['Language', 'language', facets.languages],
    ['Genre', 'genre', facets.genres],
    ['Theme', 'theme', facets.themes],
    ['Year', 'year', facets.years.map(String)],
    ['Edition', 'edition', facets.editions],
    ['Age band', 'age', facets.ageBands, (v) => v.replace(/_/g, '–')],
  ];

  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <Eyebrow className="text-gold-400">Story Archive</Eyebrow>
          <h1 className="font-display mt-4 text-4xl font-semibold text-bone sm:text-5xl">
            Africa’s contemporary youth narratives, preserved
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone/75">
            A cultural preservation platform, a research resource, a talent discovery tool and a
            structured catalogue of adaptation-ready intellectual property, all in one place.
          </p>

          <form action="/archive" className="mt-9 flex max-w-xl gap-2">
            <label htmlFor="q" className="sr-only">
              Search the archive
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={current.q ?? ''}
              placeholder="Search titles, authors, themes and keywords"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-bone placeholder:text-bone/40 focus:ring-2 focus:ring-gold-500/40 focus:outline-none"
            />
            {/* Preserve active facets when searching again. */}
            {Object.entries(current).map(([k, v]) =>
              k === 'q' || !v ? null : <input key={k} type="hidden" name={k} value={v} />,
            )}
            <button type="submit" className={buttonClass('gold', 'md')}>
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[16rem_1fr] lg:gap-14">
        {/* ---- facets ---------------------------------------------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-forest-900">Filter</h2>
            {activeFilters.length > 0 && (
              <Link href="/archive" className="text-[13px] text-gold-700 hover:underline">
                Clear all
              </Link>
            )}
          </div>

          {canBrowseAdaptationCatalogue(user) && (
            <Link
              href={withParam(current, 'adaptation', current.adaptation === '1' ? undefined : '1')}
              className={cx(
                'mt-4 flex items-center justify-between rounded-lg border px-4 py-3 text-sm',
                current.adaptation === '1'
                  ? 'border-gold-500 bg-gold-100/60 text-gold-700'
                  : 'border-line text-forest-800 hover:border-forest-900/30',
              )}
            >
              Adaptation-ready only
              <span aria-hidden>{current.adaptation === '1' ? '✓' : '+'}</span>
            </Link>
          )}

          <div className="mt-6 space-y-7">
            {facetGroups.map(([label, key, values, fmt]) =>
              values.length === 0 ? null : (
                <div key={key}>
                  <p className="eyebrow text-muted">{label}</p>
                  <ul className="mt-2.5 space-y-1">
                    {values.slice(0, 12).map((value) => {
                      const active = current[key as keyof typeof current] === value;
                      return (
                        <li key={value}>
                          <Link
                            href={withParam(current, key, active ? undefined : value)}
                            className={cx(
                              'block rounded-md px-2.5 py-1.5 text-sm transition-colors',
                              active
                                ? 'bg-forest-900 text-bone'
                                : 'text-forest-700 hover:bg-forest-900/6',
                            )}
                          >
                            {fmt ? fmt(value) : value}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )}
          </div>

          {facets.countries.length === 0 && (
            <p className="mt-6 text-[13px] leading-relaxed text-muted">
              Filters appear as stories are added to the archive.
            </p>
          )}
        </aside>

        {/* ---- results ------------------------------------------------------ */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total > 0
                ? `${formatNumber(total)} ${total === 1 ? 'story' : 'stories'}`
                : 'No stories match yet'}
              {current.q && <> for “{current.q}”</>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.map(([k, v]) => (
                <Link key={k} href={withParam(current, k, undefined)}>
                  <Badge tone="gold">
                    {v} <span aria-hidden className="ml-1">×</span>
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title={total === 0 && activeFilters.length > 0 ? 'Nothing matched those filters' : 'The archive is being built'}
                action={
                  activeFilters.length > 0 ? (
                    <ButtonLink href="/archive" variant="outline">
                      Clear filters
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/submit" variant="gold">
                      Submit a story
                    </ButtonLink>
                  )
                }
              >
                {activeFilters.length > 0
                  ? 'Try removing a filter, or search for a broader term.'
                  : 'Stories appear here once they have been approved for publication and given archive metadata. The first cohort is on its way.'}
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>

              {pages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
                    const params = new URLSearchParams();
                    for (const [k, v] of Object.entries(current)) if (v) params.set(k, v);
                    if (n > 1) params.set('page', String(n));
                    const qs = params.toString();
                    return (
                      <Link
                        key={n}
                        href={`/archive${qs ? `?${qs}` : ''}`}
                        aria-current={n === page ? 'page' : undefined}
                        className={cx(
                          'min-w-9 rounded-md px-3 py-1.5 text-center text-sm',
                          n === page ? 'bg-forest-900 text-bone' : 'text-forest-700 hover:bg-forest-900/6',
                        )}
                      >
                        {n}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </>
          )}

          {!user && (
            <Card className="mt-14 bg-parchment p-6">
              <p className="text-sm leading-relaxed text-muted">
                Publishers, producers and researchers can see more of the archive.{' '}
                <Link href="/partners" className="text-gold-700 underline">
                  Apply for partner access
                </Link>{' '}
                to reach partner-only records and the adaptation-ready catalogue.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
