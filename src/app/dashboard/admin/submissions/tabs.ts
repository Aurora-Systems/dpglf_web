import type { SectionTab } from '@/components/client';

/**
 * Sibling views of the Submissions section. `waiting` is the number of
 * eligible entries with no judges yet, shown on the Assign judges tab.
 */
export function submissionTabs(waiting?: number): SectionTab[] {
  return [
    { href: '/dashboard/admin/submissions', label: 'All submissions' },
    { href: '/dashboard/admin/submissions/assign', label: 'Assign judges', count: waiting },
  ];
}
