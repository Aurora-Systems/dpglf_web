import type { Metadata } from 'next';
import { DashboardShell, type NavGroup } from '@/components/dashboard/Shell';
import { requireUser } from '@/lib/permissions';
import { dashboardCounts } from '@/features/dashboard/queries';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

/**
 * The menu, in compartments. Every page behind it re-checks access; filtering
 * here only decides what each person is shown.
 */
const NAV: NavGroup[] = [
  { items: [{ href: '/dashboard', label: 'Overview', icon: 'home' }] },
  {
    label: 'My work',
    items: [
      { href: '/dashboard/submissions', label: 'My submissions', icon: 'doc', roles: ['writer'] },
      { href: '/dashboard/mentorship', label: 'My mentorship', icon: 'chat', roles: ['writer'] },
      { href: '/dashboard/judge', label: 'Judging queue', icon: 'clipboard', roles: ['judge'], badge: 'judgeOutstanding' },
      { href: '/dashboard/mentor', label: 'My mentees', icon: 'people', roles: ['mentor'] },
    ],
  },
  {
    label: 'Programmes',
    items: [
      { href: '/dashboard/admin/competitions', label: 'Competitions', icon: 'trophy', staffOnly: true },
      { href: '/dashboard/admin/submissions', label: 'Submissions', icon: 'tray', staffOnly: true, badge: 'eligibilityQueue' },
      { href: '/dashboard/editorial', label: 'Editorial', icon: 'pen', roles: ['editor', 'admin', 'super_admin'], badge: 'editorialQueue' },
    ],
  },
  {
    label: 'Archive & rights',
    items: [
      { href: '/dashboard/admin/stories', label: 'Stories & archive', icon: 'book', staffOnly: true },
      { href: '/dashboard/admin/inquiries', label: 'Rights enquiries', icon: 'key', staffOnly: true, badge: 'newInquiries' },
    ],
  },
  {
    label: 'Website',
    items: [
      { href: '/dashboard/admin/content/news', label: 'News', icon: 'news', staffOnly: true },
      { href: '/dashboard/admin/content/pages', label: 'Policy pages', icon: 'page', staffOnly: true },
      { href: '/dashboard/admin/files', label: 'File library', icon: 'folder', staffOnly: true },
      { href: '/dashboard/admin/messages', label: 'Messages', icon: 'mail', staffOnly: true, badge: 'newMessages' },
    ],
  },
  {
    label: 'People',
    items: [{ href: '/dashboard/admin/users', label: 'People & roles', icon: 'people', staffOnly: true }],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/admin/audit', label: 'Activity & email', icon: 'clock', staffOnly: true },
      { href: '/dashboard/admin/settings', label: 'Settings', icon: 'sliders', roles: ['super_admin'] },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/profile', label: 'My profile', icon: 'user' },
      { href: '/dashboard/notifications', label: 'Notifications', icon: 'bell' },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/dashboard');
  const counts = await dashboardCounts(user);
  return (
    <DashboardShell user={user} nav={NAV} counts={counts}>
      {children}
    </DashboardShell>
  );
}
