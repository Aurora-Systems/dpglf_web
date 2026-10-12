import { PageHeader } from '@/components/dashboard/Shell';
import { Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { RubricForm } from '@/features/admin/Forms';

export default async function NewRubricPage() {
  await requireStaff('/dashboard/admin/competitions/rubrics/new');

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        back={{ href: '/dashboard/admin/competitions/rubrics', label: 'Judging rubrics' }}
        title="New rubric"
        lead="Set out what judges score and how much each part counts. After saving, attach it to a competition from that competition's page."
      />
      <Panel>
        <RubricForm />
      </Panel>
    </>
  );
}
