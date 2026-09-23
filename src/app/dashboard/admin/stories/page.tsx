import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, EmptyState, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { STORY_STATUS_LABELS, VISIBILITY_LABELS } from '@/lib/workflow';
import { adminStories, publishableSubmissions } from '@/features/admin/queries';
import { CreateStoryForm, EmoworldControls } from '@/features/admin/Forms';
import { emoworldQueueRows, isEmoworldSyncEnabled } from '@/features/emoworld/sync';

export default async function AdminStoriesPage() {
  await requireStaff('/dashboard/admin/stories');
  const [stories, publishable, queue] = await Promise.all([
    adminStories(),
    publishableSubmissions(),
    emoworldQueueRows(20),
  ]);

  return (
    <>
      <PageHeader
        title="Stories & archive"
        lead="The canonical record for each selected story: its text, its archive metadata, its rights and where it has been published."
      />

      <div className="space-y-6">
        {publishable.length > 0 && (
          <Panel
            title="Ready for a story record"
            description="Entries in editorial or approved for publication that do not have one yet."
          >
            <CreateStoryForm submissions={publishable} />
          </Panel>
        )}

        <Panel title={`${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}`}>
          {stories.length === 0 ? (
            <EmptyState title="No story records yet">
              A story record is created from an entry once it reaches editorial.
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Story</Th>
                  <Th>Author</Th>
                  <Th>Status</Th>
                  <Th>Archive visibility</Th>
                  <Th>Flags</Th>
                  <Th>Published</Th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link
                        href={`/dashboard/admin/stories/${s.id}`}
                        className="font-medium text-forest-900 hover:text-gold-700"
                      >
                        {s.title}
                      </Link>
                      <p className="text-xs text-muted">/{s.slug}</p>
                    </Td>
                    <Td className="text-muted">{s.author_name}</Td>
                    <Td>
                      <Badge tone={s.status === 'published' ? 'good' : 'neutral'}>
                        {STORY_STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-muted">
                      {s.visibility ? VISIBILITY_LABELS[s.visibility] : 'No archive record'}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {s.featured && <Badge tone="gold">Featured</Badge>}
                        {s.adaptation_ready && <Badge tone="gold">Adaptation</Badge>}
                        {s.sync_status && (
                          <Badge tone={s.sync_status === 'sent' ? 'good' : s.sync_status === 'failed' ? 'bad' : 'neutral'}>
                            Emoworld {s.sync_status}
                          </Badge>
                        )}
                      </span>
                    </Td>
                    <Td className="text-xs text-muted">{s.published_at ? formatDate(s.published_at) : 'Not yet'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Emoworld handoff"
          description="Stories approved for publication are queued for review inside the Emoworld platform."
        >
          <EmoworldControls enabled={isEmoworldSyncEnabled()} />
          {queue.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-t border-line pt-3">
              {queue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-forest-900">{q.title}</span>
                  <Badge tone={q.status === 'sent' ? 'good' : q.status === 'failed' ? 'bad' : 'neutral'}>
                    {q.status}
                  </Badge>
                  <span className="text-xs text-muted">
                    {q.attempts} attempt{q.attempts === 1 ? '' : 's'}
                    {q.sent_at ? ` · sent ${formatDate(q.sent_at)}` : ''}
                  </span>
                  {q.last_error && (
                    <span className="w-full text-xs text-red-700">{q.last_error}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
