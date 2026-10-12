/** How a competition's status reads on the staff pages. Values match the CHECK on competitions.status. */

type Tone = 'neutral' | 'progress' | 'good' | 'bad' | 'gold';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  open: { label: 'Open', tone: 'good' },
  closed: { label: 'Closed', tone: 'neutral' },
  judging: { label: 'Judging', tone: 'progress' },
  completed: { label: 'Completed', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export function competitionStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status.charAt(0).toUpperCase() + status.slice(1), tone: 'neutral' };
}

/** Status is still "open" but the closing time has gone by, so entries are already shut. */
export function closingDatePassed(c: { status: string; closes_at: string | null }): boolean {
  return c.status === 'open' && Boolean(c.closes_at) && new Date(c.closes_at!).getTime() < Date.now();
}
