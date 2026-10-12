import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { PageForm } from '@/features/admin/Forms';

export default async function AdminNewPolicyPage() {
  await requireStaff('/dashboard/admin/content/pages/new');

  // Once saved, PageForm opens the page in its own editor, where the address is fixed.
  return (
    <>
      <PageHeader
        eyebrow="Website"
        back={{ href: '/dashboard/admin/content/pages', label: 'Policy pages' }}
        title="Add a page"
        lead="For wording the five standard policies do not cover, such as an accessibility statement. Pages of the kind Policy are also listed on the site's policies page."
      />

      <Card className="p-5 sm:p-7">
        <PageForm />
      </Card>
    </>
  );
}
