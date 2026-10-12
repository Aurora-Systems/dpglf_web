import type { SectionTab } from '@/components/client';

/** Sibling views of Programmes › Competitions. Detail and /new pages show a back link instead. */
export const COMPETITION_TABS: SectionTab[] = [
  { href: '/dashboard/admin/competitions', label: 'Competitions' },
  { href: '/dashboard/admin/competitions/rubrics', label: 'Judging rubrics' },
];
