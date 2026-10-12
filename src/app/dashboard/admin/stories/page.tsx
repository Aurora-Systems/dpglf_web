import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonLink, EmptyState, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { STORY_STATUS_LABELS, VISIBILITY_LABELS } from '@/lib/workflow';
import { adminStories, publishableSubmissions } from '@/features/admin/queries';
import { STORY_TABS } from './tabs';

/** "Public: full text" reads well in a form; a table column only needs the part before the colon. */
function shortVisibility(v: string | null): string {
  if (!v) return 'No archive record';
  return (VISIBILITY_LABELS[v] ?? v).split(':')[0];
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={status === 'published' ? 'good' : status === 'withdrawn' ? 'bad' : 'neutral'}>
      {STORY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export default async function AdminStoriesPage() {
  await requireStaff('/dashboard/admin/stories');
  const [stories, publishable] = await Promise.all([adminStories(), publishableSubmissions()]);

  return (
    <>
      <PageHeader
        eyebrow="Archive & rights"
        title="Stories & archive"
        lead="The Foundation's record of each selected story: its text, archive details, rights and where it has been published."
        action={
          <ButtonLink href="/dashboard/admin/stories/new" variant="gold">
            New story record
          </ButtonLink>
        }
      />
      <SectionTabs label="Stories and archive" tabs={STORY_TABS} />

      <div className="space-y-6">
        {publishable.length > 0 && (
          <Alert tone="info">
            {publishable.length === 1
              ? '1 entry is ready for a story record. '
              : `${publishable.length} entries are ready for a story record. `}
            <Link href="/dashboard/admin/stories/new" className="font-medium underline underline-offset-2">
              Create a record
            </Link>
          </Alert>
        )}

        <Panel
          title={`${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`}
          description="Most recently updated first. Open a story to edit its text, archive details and rights."
        >
          {stories.length === 0 ? (
            <EmptyState
              title="No story records yet"
              action={
                <ButtonLink href="/dashboard/admin/stories/new" variant="outline" size="sm">
                  New story record
                </ButtonLink>
              }
            >
              A story record is created from an entry once it reaches editorial.
            </EmptyState>
          ) : (
            <Table min="min-w-0">
              <thead>
                <tr>
                  <Th>Story</Th>
                  <Th className="hidden md:table-cell">Author</Th>
                  <Th className="hidden sm:table-cell">Status</Th>
                  <Th className="hidden lg:table-cell">Archive</Th>
                  <Th className="hidden xl:table-cell">Flags</Th>
                  <Th className="hidden lg:table-cell">Published</Th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id}>
                    <Td className="min-w-0 md:min-w-52">
                      <Link
                        href={`/dashboard/admin/stories/${s.id}`}
                        className="-my-1 inline-block py-1 font-medium text-forest-900 hover:text-gold-700"
                      >
                        {s.title}
                      </Link>
                      <p className="text-xs text-muted wrap-anywhere">
                        /{s.slug}
                        <span className="md:hidden"> · {s.author_name}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted lg:hidden">
                        {shortVisibility(s.visibility)}
                        {s.published_at ? ` · published ${formatDate(s.published_at)}` : ''}
                      </p>
                      {(s.featured || s.adaptation_ready || (s.sync_status && SYNC[s.sync_status])) && (
                        <div className="mt-1.5 flex flex-wrap gap-1 xl:hidden">
                          <Flags {...s} />
                        </div>
                      )}
                    </Td>
                    <Td className="hidden text-muted md:table-cell">{s.author_name}</Td>
                    <Td className="hidden sm:table-cell">
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td className="hidden text-[13px] text-muted lg:table-cell">{shortVisibility(s.visibility)}</Td>
                    <Td className="hidden xl:table-cell">
                      <span className="flex flex-wrap gap-1">
                        <Flags {...s} />
                      </span>
                    </Td>
                    <Td className="hidden text-[13px] whitespace-nowrap text-muted lg:table-cell">
                      {s.published_at ? formatDate(s.published_at) : 'Not yet'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}

/** The latest Emoworld handoff, in the words the Emoworld handoff tab uses. Cancelled ones are history. */
const SYNC: Record<string, { label: string; tone: 'good' | 'bad' | 'neutral' | 'progress' }> = {
  pending: { label: 'Waiting for Emoworld', tone: 'neutral' },
  sending: { label: 'Sending to Emoworld', tone: 'progress' },
  sent: { label: 'Sent to Emoworld', tone: 'good' },
  failed: { label: 'Emoworld send failed', tone: 'bad' },
  withdrawn: { label: 'Withdrawn from Emoworld', tone: 'neutral' },
};

function Flags({
  featured,
  adaptation_ready,
  sync_status,
}: {
  featured: boolean | null;
  adaptation_ready: boolean | null;
  sync_status: string | null;
}) {
  return (
    <>
      {featured && <Badge tone="gold">Featured</Badge>}
      {adaptation_ready && <Badge tone="gold">Adaptation-ready</Badge>}
      {sync_status && SYNC[sync_status] && <Badge tone={SYNC[sync_status].tone}>{SYNC[sync_status].label}</Badge>}
    </>
  );
}
