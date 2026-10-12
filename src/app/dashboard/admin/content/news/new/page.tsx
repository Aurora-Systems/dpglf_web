import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { NewsForm } from '@/features/admin/Forms';

export default async function AdminNewPostPage() {
  await requireStaff('/dashboard/admin/content/news/new');

  // Creating the post opens it in its own editor (saveNewsAction redirects to
  // /dashboard/admin/content/news/<id>?created=1), so the picture and article
  // can be checked before it is published.
  return (
    <>
      <PageHeader
        eyebrow="Website"
        back={{ href: '/dashboard/admin/content/news', label: 'News' }}
        title="Write a post"
        lead="Drafts are only seen by staff. Set the status to Published when the post is ready for the site."
      />

      <Card className="p-5 sm:p-7">
        <NewsForm />
      </Card>
    </>
  );
}
