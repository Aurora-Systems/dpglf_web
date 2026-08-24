import type { Metadata } from 'next';
import { DashboardShell, type NavItem } from '@/components/dashboard/Shell';
import { requireUser } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/submissions', label: 'My submissions', roles: ['writer'] },
  { href: '/dashboard/mentorship', label: 'My mentorship', roles: ['writer'] },
  { href: '/dashboard/judge', label: 'Judging queue', roles: ['judge'] },
  { href: '/dashboard/mentor', label: 'My mentees', roles: ['mentor'] },
  { href: '/dashboard/editorial', label: 'Editorial', roles: ['editor', 'admin', 'super_admin'] },
  { href: '/dashboard/admin', label: 'Admin overview', staffOnly: true },
  { href: '/dashboard/admin/competitions', label: 'Competitions', staffOnly: true },
  { href: '/dashboard/admin/submissions', label: 'All submissions', staffOnly: true },
  { href: '/dashboard/admin/stories', label: 'Stories & archive', staffOnly: true },
  { href: '/dashboard/admin/inquiries', label: 'Rights enquiries', staffOnly: true },
  { href: '/dashboard/admin/messages', label: 'Messages', staffOnly: true },
  { href: '/dashboard/admin/content', label: 'Site content', staffOnly: true },
  { href: '/dashboard/admin/users', label: 'People & roles', staffOnly: true },
  { href: '/dashboard/admin/audit', label: 'Audit log', staffOnly: true },
  { href: '/dashboard/profile', label: 'My profile' },
  { href: '/dashboard/notifications', label: 'Notifications' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/dashboard');
  return (
    <DashboardShell user={user} nav={NAV}>
      {children}
    </DashboardShell>
  );
}
