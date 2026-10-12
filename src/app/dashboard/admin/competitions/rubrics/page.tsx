import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonLink, EmptyState, Panel, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { rubrics } from '@/features/admin/queries';
import { COMPETITION_TABS } from '../tabs';

export default async function AdminRubricsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await requireStaff('/dashboard/admin/competitions/rubrics');
  const { created } = await searchParams;
  const list = await rubrics();
  const createdRubric = created ? list.find((r) => r.id === created) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        title="Judging rubrics"
        lead="The criteria judges score entries against. Rubrics are versioned, never edited in place."
        action={
          <ButtonLink href="/dashboard/admin/competitions/rubrics/new" variant="gold">
            New rubric
          </ButtonLink>
        }
      />
      <SectionTabs label="Competitions" tabs={COMPETITION_TABS} />

      <div className="space-y-6">
        {createdRubric && (
          <Alert tone="success" title="Rubric created">
            Attach it to a competition by choosing it under Judging and publishing on that competition&rsquo;s page.
          </Alert>
        )}

        {list.length === 0 ? (
          <EmptyState
            title="No rubrics yet"
            action={
              <ButtonLink href="/dashboard/admin/competitions/rubrics/new" variant="gold">
                New rubric
              </ButtonLink>
            }
          >
            Judges cannot score entries until a competition has a rubric.
          </EmptyState>
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {list.map((r) => (
                <li
                  key={r.id}
                  className={cx(
                    'flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-8',
                    r.id === created ? '-mx-5 bg-gold-100/40 px-5 py-5 first:-mt-4 last:-mb-4' : 'py-5 first:pt-1 last:pb-1',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h2 className="font-display text-lg font-semibold text-forest-900">{r.name}</h2>
                      <Badge>v{r.version}</Badge>
                    </div>
                    {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                    {r.criterion_labels.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Criteria">
                        {r.criterion_labels.map((label, i) => (
                          <li
                            key={i}
                            className="rounded-md border border-line bg-parchment px-2 py-0.5 text-[13px] text-forest-800"
                          >
                            {label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 text-sm md:w-72">
                    <div>
                      <dt className="text-xs text-muted">Criteria</dt>
                      <dd className="mt-0.5 text-forest-900">{r.criteria}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Created</dt>
                      <dd className="mt-0.5 text-forest-900">{formatDate(r.created_at)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">Used by</dt>
                      <dd className="mt-0.5">
                        {r.competitions.length === 0 ? (
                          <span className="text-muted">No competition yet</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {r.competitions.map((c) => (
                              <li key={c.id}>
                                <Link
                                  href={`/dashboard/admin/competitions/${c.id}`}
                                  className="-my-1 inline-block py-1 text-forest-900 underline decoration-line underline-offset-2 hover:text-gold-700"
                                >
                                  {c.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
