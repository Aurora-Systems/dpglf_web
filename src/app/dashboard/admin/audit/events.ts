import { FOUNDATION_TZ, formatDate } from '@/lib/format';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { STATUS_LABELS, STORY_STATUS_LABELS, VISIBILITY_LABELS, type SubmissionStatus } from '@/lib/workflow';

/**
 * Helpers for reading the audit trail as a diary: grouped by Harare day, with
 * a plain-English detail and a link to the record where that is easy. Used by
 * Activity & email and by each person's page.
 */

const DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: FOUNDATION_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: FOUNDATION_TZ, hour: '2-digit', minute: '2-digit' });

/** `YYYY-MM-DD` in Harare, so an event at 01:00 CAT lands on the right day whatever the server's zone. */
function dayKey(value: string | Date): string {
  return DAY_KEY.format(new Date(value));
}

/** "14:05", Harare time. */
export function timeOfDay(value: string | Date): string {
  return TIME.format(new Date(value));
}

export function isoTime(value: string | Date): string {
  return new Date(value).toISOString();
}

/** Consecutive rows (newest first) gathered under "Today", "Yesterday" or the date. */
export function groupByDay<T extends { created_at: string | Date }>(rows: T[]) {
  const now = Date.now();
  const today = dayKey(new Date(now));
  const yesterday = dayKey(new Date(now - 86_400_000));
  const groups: { key: string; label: string; rows: T[] }[] = [];
  for (const row of rows) {
    const key = dayKey(row.created_at);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : formatDate(row.created_at);
      group = { key, label, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** Where an event's record lives in the console, for record types that have a page of their own. */
export function entityHref(type: string, id: string | null): string | null {
  if (!id) return null;
  switch (type) {
    case 'submission':
      return `/dashboard/admin/submissions/${id}`;
    case 'story':
      return `/dashboard/admin/stories/${id}`;
    case 'user':
      return `/dashboard/admin/users/${id}`;
    case 'competition':
      return `/dashboard/admin/competitions/${id}`;
    case 'news_post':
      return `/dashboard/admin/content/news/${id}`;
    case 'adaptation_inquiry':
      return '/dashboard/admin/inquiries';
    default:
      return null;
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);

/**
 * A short plain-English detail for the events whose metadata says something a
 * reader wants ("from Eligible to Judged"). Null when there is nothing useful;
 * the raw metadata stays available on the action code's tooltip.
 */
export function eventDetail(action: string, metadata: Record<string, unknown> | null | undefined): string | null {
  const m = metadata ?? {};
  switch (action) {
    case 'submission.status_changed': {
      const from = str(m.from);
      const to = str(m.to);
      if (!to) return null;
      const label = (s: string) => STATUS_LABELS[s as SubmissionStatus] ?? s;
      return from ? `From ${label(from)} to ${label(to)}` : `Now ${label(to)}`;
    }
    case 'user.roles_updated': {
      const roles = Array.isArray(m.roles) ? (m.roles as string[]) : null;
      if (!roles) return null;
      return roles.length ? `Now ${roles.map((r) => ROLE_LABELS[r as Role] ?? r).join(', ')}` : 'Now holds no roles';
    }
    case 'review.finalised':
    case 'review.saved':
      return str(m.total) && str(m.max) ? `Scored ${str(m.total)} out of ${str(m.max)}` : null;
    case 'file.downloaded':
      return str(m.name);
    case 'story.cover_updated':
      return str(m.file);
    case 'story.updated':
      return str(m.status) ? `Status: ${STORY_STATUS_LABELS[str(m.status)!] ?? str(m.status)}` : null;
    case 'archive.metadata_updated':
      return str(m.visibility) ? `Visibility: ${VISIBILITY_LABELS[str(m.visibility)!] ?? str(m.visibility)}` : null;
    case 'news.created':
    case 'news.updated':
    case 'inquiry.updated':
    case 'competition.updated':
    case 'competition.created': {
      const status = str(m.status)?.replace(/_/g, ' ');
      return status ? `Status: ${status.charAt(0).toUpperCase()}${status.slice(1)}` : null;
    }
    case 'judging.assigned':
      return str(m.judges) && str(m.submissions)
        ? `${str(m.judges)} judge${m.judges === 1 ? '' : 's'}, ${str(m.submissions)} ${m.submissions === 1 ? 'entry' : 'entries'}`
        : null;
    case 'export.submissions':
      return str(m.rows) ? `${str(m.rows)} ${m.rows === 1 ? 'row' : 'rows'}` : null;
    case 'notifications.retried':
      return str(m.attempted) ? `${str(m.sent) ?? 0} sent, ${str(m.failed) ?? 0} still failing` : null;
    default:
      return null;
  }
}

/** The free-text note some events carry (a status change's reason). */
export function eventNote(metadata: Record<string, unknown> | null | undefined): string | null {
  return str(metadata?.note);
}
