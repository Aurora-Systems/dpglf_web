import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

/**
 * The public "Submit a story" call to action. It exists so every marketing page
 * can link to one stable URL without knowing whether the visitor has an
 * account, or which competition is currently open.
 */
export default async function SubmitEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const { competition } = await searchParams;
  const target = `/dashboard/submissions/new${competition ? `?competition=${encodeURIComponent(competition)}` : ''}`;

  if (!(await getSessionUser())) redirect(`/login?next=${encodeURIComponent(target)}`);
  redirect(target);
}
