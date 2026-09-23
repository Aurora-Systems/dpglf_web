import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonLink, Card, DescList, Panel } from '@/components/ui';
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

export default async function AdminStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(`/dashboard/admin/stories/${id}`);

  const story = await adminStory(id);
  if (!story) notFound();

  const [rights, publications] = await Promise.all([rightsForStory(id), publicationsForStory(id)]);
  const isPublic = story.visibility === 'public_excerpt' || story.visibility === 'public_full';

  return (
    <>
      <PageHeader
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
            <ButtonLink href={`/archive/${story.slug}`} variant="outline" size="sm">
              View public page
            </ButtonLink>
          ) : (
            <Badge>{STORY_STATUS_LABELS[story.status] ?? story.status}</Badge>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Story record">
            <StoryForm story={story} />
          </Panel>

          <Panel
            title="Archive record"
            description="Metadata quality is what makes the archive worth having. Visibility here is independent of publication status."
          >
            <ArchiveMetaForm storyId={id} meta={story} />
          </Panel>

          <Panel
            title="Rights"
            description="Publication never changes ownership on its own. Record the licence separately."
          >
            {rights.length > 0 && (
              <ul className="mb-6 space-y-3">
                {rights.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.status === 'active' ? 'good' : 'neutral'}>{r.status}</Badge>
                      <span className="font-medium text-forest-900">{r.licence_type ?? 'none'}</span>
                      {r.territory && <span className="text-muted">· {r.territory}</span>}
                    </div>
                    <p className="mt-1.5 text-muted">{r.ownership_note}</p>
                    {r.restrictions && <p className="mt-1 text-[13px] text-muted">{r.restrictions}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line pt-5">
              <RightsForm storyId={id} record={rights[0]} />
            </div>
          </Panel>

          <Panel title="Publications">
            {publications.length > 0 && (
              <ul className="mb-6 divide-y divide-line">
                {publications.map((p) => (
                  <li key={p.id} className="py-3 text-sm">
                    <p className="font-medium text-forest-900">
                      {p.title || p.edition || p.publication_type}
                    </p>
                    <p className="text-muted">
                      {[p.publisher, p.edition, p.publication_date && formatDate(p.publication_date), p.isbn && `ISBN ${p.isbn}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line pt-5">
              <PublicationForm storyId={id} />
            </div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">At a glance</h2>
            <DescList
              rows={[
                ['Slug', story.slug],
                ['Status', STORY_STATUS_LABELS[story.status] ?? story.status],
                [
                  'Archive visibility',
                  story.visibility ? VISIBILITY_LABELS[story.visibility] : 'No archive record',
                ],
                ['Words', story.word_count ? formatNumber(story.word_count) : 'Not counted'],
                ['Published', story.published_at ? formatDate(story.published_at) : 'Not yet'],
                ['Reference', story.reference ?? 'None'],
              ]}
            />
            {story.submission_id && (
              <Link
                href={`/dashboard/admin/submissions/${story.submission_id}`}
                className="mt-3 inline-block text-[13px] text-gold-700 underline"
              >
                Open the original entry
              </Link>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Cover image</h2>
            <div className="mt-3">
              <CoverForm storyId={id} coverUrl={story.cover_key ? publicUrl(story.cover_key) : null} />
            </div>
          </Card>

          {story.adaptation_ready && (
            <Alert tone="warning" title="Listed as adaptation-ready">
              Partners and staff can see this story in the IP catalogue and enquire about it.
            </Alert>
          )}

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Emoworld handoff</h2>
            <p className="mt-1.5 text-[13px] text-muted">
              Send this story to Emoworld Publishers for review. Queued automatically on approval.
            </p>
            <div className="mt-4">
              <EmoworldControls storyId={id} enabled={isEmoworldSyncEnabled()} />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
