import type { SectionTab } from '@/components/client';

/** Sibling views of System › Activity & email. */
export const AUDIT_TABS: SectionTab[] = [
  { href: '/dashboard/admin/audit', label: 'Activity' },
  { href: '/dashboard/admin/audit/emails', label: 'Email delivery' },
];

/** The header lead both tabs share, so it has to describe both. */
export const AUDIT_LEAD =
  'A permanent record of who did what and when, and whether the emails the platform sent reached people.';
