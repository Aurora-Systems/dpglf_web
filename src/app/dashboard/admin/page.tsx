import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/permissions';

/** The admin overview now lives on the dashboard home; old links land there. */
export default async function AdminOverviewPage() {
  await requireStaff('/dashboard/admin');
  redirect('/dashboard');
}
