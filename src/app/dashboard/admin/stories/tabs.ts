import type { SectionTab } from '@/components/client';

/** Sibling views of Archive & rights › Stories & archive. Story pages and /new show a back link instead. */
export const STORY_TABS: SectionTab[] = [
  { href: '/dashboard/admin/stories', label: 'Story records' },
  { href: '/dashboard/admin/stories/emoworld', label: 'Emoworld handoff' },
];
