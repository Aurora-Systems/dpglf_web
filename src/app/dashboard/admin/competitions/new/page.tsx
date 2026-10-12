import { PageHeader } from '@/components/dashboard/Shell';
import { Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { rubrics } from '@/features/admin/queries';
import { CompetitionForm } from '@/features/admin/Forms';

export default async function NewCompetitionPage() {
  await requireStaff('/dashboard/admin/competitions/new');
  const rubricList = await rubrics();

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        back={{ href: '/dashboard/admin/competitions', label: 'Competitions' }}
        title="New competition"
        lead="Save it as a draft first. Drafts stay hidden from the website until you set the status to Open."
      />
      <Panel>
        <CompetitionForm rubrics={rubricList} />
      </Panel>
    </>
  );
}
