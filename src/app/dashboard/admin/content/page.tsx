import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/permissions';

/** The Website compartment has no landing page of its own: News is the first thing in it. */
export default async function AdminContentPage() {
  await requireStaff('/dashboard/admin/content');
  redirect('/dashboard/admin/content/news');
}
