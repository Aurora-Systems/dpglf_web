import { PageHeader } from '@/components/dashboard/Shell';
import { ButtonLink, Card, EmptyState, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { publishableSubmissions } from '@/features/admin/queries';
import { CreateStoryForm } from '@/features/admin/Forms';

export default async function NewStoryPage() {
  await requireStaff('/dashboard/admin/stories/new');
  const publishable = await publishableSubmissions();

  return (
    <>
      <PageHeader
        eyebrow="Archive & rights"
        back={{ href: '/dashboard/admin/stories', label: 'Stories & archive' }}
        title="New story record"
        lead="Turn a selected entry into the Foundation's record of the story, ready for editing, archiving and publication."
      />

      {publishable.length === 0 ? (
        <EmptyState
          title="No entries are ready"
          action={
            <ButtonLink href="/dashboard/editorial" variant="outline" size="sm">
              Go to editorial
            </ButtonLink>
          }
        >
          An entry can have a story record once it reaches editorial or is approved for publication. Entries that
          already have one are not listed.
        </EmptyState>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <Panel title="Choose the entry">
            <CreateStoryForm submissions={publishable} />
          </Panel>

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">What the record starts with</h2>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted marker:text-gold-600">
              <li>The text of the latest manuscript, ready to edit.</li>
              <li>Archive details copied from the entry and the writer&apos;s profile.</li>
              <li>A draft rights record naming the author as the owner.</li>
              <li>Private visibility. Nobody outside the Foundation sees it until you change that.</li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
