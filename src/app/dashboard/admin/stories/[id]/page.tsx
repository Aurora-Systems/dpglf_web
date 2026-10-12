import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonLink, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, formatNumber } from '@/lib/format';
import { STORY_STATUS_LABELS, VISIBILITY_LABELS } from '@/lib/workflow';
import { adminStory, rightsForStory } from '@/features/admin/queries';
import { publicationsForStory } from '@/features/archive/queries';
import { isEmoworldSyncEnabled } from '@/features/emoworld/sync';
import {
  ArchiveMetaForm,
  CoverForm,
  EmoworldControls,
  PublicationForm,
  RightsForm,
  StoryForm,
} from '@/features/admin/Forms';
import { publicUrl } from '@/lib/r2';

const LICENCES: Record<string, string> = {
  none: 'No licence',
  anthology: 'Anthology publication',
  non_exclusive: 'Non-exclusive',
  exclusive: 'Exclusive',
  option: 'Option',
  educational: 'Educational',
};

/** A disclosure for a form that is not needed on every visit. */
function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-forest-900 [&::-webkit-details-marker]:hidden">
        {summary}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
          />
        </svg>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export default async function AdminStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(`/dashboard/admin/stories/${id}`);

  const story = await adminStory(id);
  if (!story) notFound();

  const [rights, publications] = await Promise.all([rightsForStory(id), publicationsForStory(id)]);
  const isPublic = story.visibility === 'public_excerpt' || story.visibility === 'public_full';
  const current = rights[0];

  const facts: [string, React.ReactNode][] = [
    ['Status', STORY_STATUS_LABELS[story.status] ?? story.status],
    ['Archive', story.visibility ? (VISIBILITY_LABELS[story.visibility] ?? story.visibility).split(':')[0] : 'No record'],
    ['Words', story.word_count ? formatNumber(story.word_count) : 'Not counted'],
    ['Published', story.published_at ? formatDate(story.published_at) : 'Not yet'],
    [
      'Entry',
      story.submission_id ? (
        <Link
          href={`/dashboard/admin/submissions/${story.submission_id}`}
          className="text-gold-700 underline-offset-2 hover:underline"
        >
          {story.reference ?? 'Open the entry'}
        </Link>
      ) : (
        'None'
      ),
    ],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Archive & rights"
        back={{ href: '/dashboard/admin/stories', label: 'Stories & archive' }}
        title={story.title}
        lead={
          <>
            by {story.author_name}
            {story.competition_name && ` · ${story.competition_name}`}
          </>
        }
        action={
          isPublic ? (
            <ButtonLink href={`/archive/${story.slug}`} variant="outline" size="sm" className="min-h-10 sm:min-h-0">
              View public page
            </ButtonLink>
          ) : undefined
        }
      />

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0 bg-white px-4 py-3">
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-forest-900 wrap-anywhere">{value}</dd>
          </div>
        ))}
        {/* Five facts leave a hole in a two or three column grid; fill it so no grey cell shows. */}
        <div className="bg-white lg:hidden" aria-hidden />
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Beside the side column the forms have about 560px: too narrow for a section's
            label column plus its fields, so from xl each section's heading sits above them,
            as it does on a phone. The descendant selector outranks FormSection's own grid. */}
        <div className="min-w-0 space-y-6">
          <Panel title="Story details" description={`/${story.slug}`}>
            <StoryForm story={story} />
          </Panel>

          <Panel
            title="Archive record"
            description="Good metadata is what makes the archive worth having: it drives search, filters and who can read the story."
          >
            <ArchiveMetaForm storyId={id} meta={story} />
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Cover, rights and publications">
          <Panel title="Cover image">
            <CoverForm storyId={id} coverUrl={story.cover_key ? publicUrl(story.cover_key) : null} />
          </Panel>

          <Panel title="Rights" description="Publication never changes ownership on its own. Record the licence here.">
            <div className="space-y-4">
              {story.adaptation_ready && (
                <Alert tone="warning" title="Listed as adaptation-ready">
                  Partners and staff can see this story in the IP catalogue and enquire about it.
                </Alert>
              )}
              {rights.length > 0 ? (
                <ul className="space-y-2">
                  {rights.map((r) => (
                    <li key={r.id} className="rounded-lg bg-parchment px-3.5 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={r.status === 'active' ? 'good' : 'neutral'}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </Badge>
                        <span className="font-medium text-forest-900">
                          {LICENCES[r.licence_type ?? 'none'] ?? r.licence_type}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted">
                        {[r.owner_name, r.ownership_note, r.territory].filter(Boolean).join(' · ')}
                      </p>
                      {r.restrictions && <p className="mt-1 text-[13px] text-muted">{r.restrictions}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No rights record yet.</p>
              )}
              <Disclosure summary={current ? 'Edit the current rights record' : 'Add a rights record'}>
                <RightsForm storyId={id} record={current} />
              </Disclosure>
            </div>
          </Panel>

          <Panel title="Publications" description="Anthologies, editions and other places the story has appeared.">
            <div className="space-y-4">
              {publications.length > 0 ? (
                <ul className="divide-y divide-line">
                  {publications.map((p) => (
                    <li key={p.id} className="py-2.5 text-sm first:pt-0">
                      <p className="font-medium text-forest-900">{p.title || p.edition || p.publication_type}</p>
                      <p className="text-[13px] text-muted">
                        {[
                          p.publisher,
                          p.edition,
                          p.publication_date && formatDate(p.publication_date),
                          p.isbn && `ISBN ${p.isbn}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Not published anywhere yet.</p>
              )}
              <Disclosure summary="Record a publication">
                <PublicationForm storyId={id} />
              </Disclosure>
            </div>
          </Panel>

          <Panel
            title="Emoworld handoff"
            description="Send this story to Emoworld Publishers for review. It is queued automatically on approval."
          >
            <EmoworldControls storyId={id} enabled={isEmoworldSyncEnabled()} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
