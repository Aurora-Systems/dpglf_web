import type { Role } from './roles';

/**
 * The submission state machine.
 *
 * A story changes meaning and visibility as it moves through the ecosystem, so
 * the states are persisted and the legal moves between them are declared here
 * rather than implied by whichever button happens to exist on a screen. Every
 * applied transition also writes a `submission_events` row.
 */

export const SUBMISSION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ELIGIBILITY_REVIEW',
  'ELIGIBLE',
  'INELIGIBLE',
  'ASSIGNED_FOR_JUDGING',
  'JUDGED',
  'SHORTLISTED',
  'NOT_SELECTED',
  'MENTORSHIP',
  'EDITORIAL',
  'APPROVED_FOR_PUBLICATION',
  'PUBLISHED',
  'WITHDRAWN',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ELIGIBILITY_REVIEW: 'Checking eligibility',
  ELIGIBLE: 'Eligible',
  INELIGIBLE: 'Not eligible',
  ASSIGNED_FOR_JUDGING: 'With judges',
  JUDGED: 'Judged',
  SHORTLISTED: 'Shortlisted',
  NOT_SELECTED: 'Not selected',
  MENTORSHIP: 'In mentorship',
  EDITORIAL: 'In editorial',
  APPROVED_FOR_PUBLICATION: 'Approved for publication',
  PUBLISHED: 'Published',
  WITHDRAWN: 'Withdrawn',
};

/** What the writer is told each status means, in plain language. */
export const STATUS_WRITER_COPY: Record<SubmissionStatus, string> = {
  DRAFT: 'Not submitted yet. Finish and submit before the competition closes.',
  SUBMITTED: 'Received. The Foundation will check it against the entry rules.',
  ELIGIBILITY_REVIEW: 'A programme administrator is checking your entry against the rules.',
  ELIGIBLE: 'Your entry has passed the eligibility check and is waiting to be assigned to judges.',
  INELIGIBLE: 'Your entry did not meet the entry rules for this programme.',
  ASSIGNED_FOR_JUDGING: 'Judges are reading your story.',
  JUDGED: 'Scoring is complete. Results are being finalised.',
  SHORTLISTED: 'Your story has been shortlisted for the next stage.',
  NOT_SELECTED: 'Your story was not selected this time.',
  MENTORSHIP: 'You are working with a mentor on this story.',
  EDITORIAL: 'The Foundation’s editors are preparing your story.',
  APPROVED_FOR_PUBLICATION: 'Approved for publication. The Foundation will be in touch.',
  PUBLISHED: 'Published.',
  WITHDRAWN: 'Withdrawn.',
};

export type StatusTone = 'neutral' | 'progress' | 'good' | 'bad';

export const STATUS_TONE: Record<SubmissionStatus, StatusTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'progress',
  ELIGIBILITY_REVIEW: 'progress',
  ELIGIBLE: 'progress',
  INELIGIBLE: 'bad',
  ASSIGNED_FOR_JUDGING: 'progress',
  JUDGED: 'progress',
  SHORTLISTED: 'good',
  NOT_SELECTED: 'bad',
  MENTORSHIP: 'progress',
  EDITORIAL: 'progress',
  APPROVED_FOR_PUBLICATION: 'good',
  PUBLISHED: 'good',
  WITHDRAWN: 'neutral',
};

/**
 * Legal transitions. Anything absent here cannot happen, whatever the UI does.
 * `roles` is who may apply the move; `writer` means the submitting writer.
 */
type Actor = Role | 'writer_owner' | 'system';

interface Transition {
  to: SubmissionStatus;
  actors: Actor[];
  label: string;
}

export const TRANSITIONS: Record<SubmissionStatus, Transition[]> = {
  DRAFT: [
    { to: 'SUBMITTED', actors: ['writer_owner'], label: 'Submit entry' },
    { to: 'WITHDRAWN', actors: ['writer_owner', 'admin', 'super_admin'], label: 'Withdraw' },
  ],
  SUBMITTED: [
    { to: 'ELIGIBILITY_REVIEW', actors: ['admin', 'super_admin', 'system'], label: 'Start eligibility check' },
    { to: 'WITHDRAWN', actors: ['writer_owner', 'admin', 'super_admin'], label: 'Withdraw' },
  ],
  ELIGIBILITY_REVIEW: [
    { to: 'ELIGIBLE', actors: ['admin', 'super_admin'], label: 'Mark eligible' },
    { to: 'INELIGIBLE', actors: ['admin', 'super_admin'], label: 'Mark not eligible' },
    { to: 'WITHDRAWN', actors: ['writer_owner', 'admin', 'super_admin'], label: 'Withdraw' },
  ],
  ELIGIBLE: [
    { to: 'ASSIGNED_FOR_JUDGING', actors: ['admin', 'super_admin', 'system'], label: 'Send to judging' },
    { to: 'INELIGIBLE', actors: ['admin', 'super_admin'], label: 'Mark not eligible' },
    { to: 'WITHDRAWN', actors: ['writer_owner', 'admin', 'super_admin'], label: 'Withdraw' },
  ],
  INELIGIBLE: [
    { to: 'ELIGIBILITY_REVIEW', actors: ['admin', 'super_admin'], label: 'Reopen eligibility check' },
  ],
  ASSIGNED_FOR_JUDGING: [
    { to: 'JUDGED', actors: ['admin', 'super_admin', 'system'], label: 'Close scoring' },
    { to: 'ELIGIBLE', actors: ['admin', 'super_admin'], label: 'Return to pool' },
    { to: 'WITHDRAWN', actors: ['admin', 'super_admin'], label: 'Withdraw' },
  ],
  JUDGED: [
    { to: 'SHORTLISTED', actors: ['admin', 'super_admin'], label: 'Shortlist' },
    { to: 'NOT_SELECTED', actors: ['admin', 'super_admin'], label: 'Not selected' },
    { to: 'ASSIGNED_FOR_JUDGING', actors: ['admin', 'super_admin'], label: 'Reopen scoring' },
  ],
  SHORTLISTED: [
    { to: 'MENTORSHIP', actors: ['admin', 'super_admin'], label: 'Begin mentorship' },
    { to: 'EDITORIAL', actors: ['admin', 'super_admin', 'editor'], label: 'Send straight to editorial' },
    { to: 'NOT_SELECTED', actors: ['admin', 'super_admin'], label: 'Not selected' },
  ],
  NOT_SELECTED: [{ to: 'SHORTLISTED', actors: ['admin', 'super_admin'], label: 'Reinstate to shortlist' }],
  MENTORSHIP: [
    { to: 'EDITORIAL', actors: ['admin', 'super_admin', 'editor', 'mentor'], label: 'Ready for editorial' },
    { to: 'NOT_SELECTED', actors: ['admin', 'super_admin'], label: 'End without publication' },
  ],
  EDITORIAL: [
    { to: 'APPROVED_FOR_PUBLICATION', actors: ['admin', 'super_admin'], label: 'Approve for publication' },
    { to: 'MENTORSHIP', actors: ['admin', 'super_admin', 'editor'], label: 'Return to mentorship' },
  ],
  APPROVED_FOR_PUBLICATION: [
    { to: 'PUBLISHED', actors: ['admin', 'super_admin'], label: 'Mark published' },
    { to: 'EDITORIAL', actors: ['admin', 'super_admin'], label: 'Return to editorial' },
  ],
  PUBLISHED: [],
  WITHDRAWN: [{ to: 'DRAFT', actors: ['admin', 'super_admin'], label: 'Restore to draft' }],
};

export interface ActorContext {
  roles: Role[];
  isOwner: boolean;
  isSystem?: boolean;
}

export function allowedTransitions(from: SubmissionStatus, ctx: ActorContext): Transition[] {
  return (TRANSITIONS[from] ?? []).filter((t) => actorMatches(t.actors, ctx));
}

export function canTransition(from: SubmissionStatus, to: SubmissionStatus, ctx: ActorContext): boolean {
  return allowedTransitions(from, ctx).some((t) => t.to === to);
}

function actorMatches(actors: Actor[], ctx: ActorContext): boolean {
  return actors.some((a) => {
    if (a === 'writer_owner') return ctx.isOwner;
    if (a === 'system') return Boolean(ctx.isSystem);
    return ctx.roles.includes(a);
  });
}

/** Statuses the writer is emailed about. */
export const NOTIFIABLE_STATUSES: SubmissionStatus[] = [
  'INELIGIBLE',
  'SHORTLISTED',
  'NOT_SELECTED',
  'MENTORSHIP',
  'EDITORIAL',
  'APPROVED_FOR_PUBLICATION',
  'PUBLISHED',
];

/** Statuses that mean the entry is still live in the competition pipeline. */
export const ACTIVE_STATUSES: SubmissionStatus[] = [
  'SUBMITTED',
  'ELIGIBILITY_REVIEW',
  'ELIGIBLE',
  'ASSIGNED_FOR_JUDGING',
  'JUDGED',
  'SHORTLISTED',
  'MENTORSHIP',
  'EDITORIAL',
  'APPROVED_FOR_PUBLICATION',
];

// ---- archive visibility ------------------------------------------------------

export const VISIBILITY_LABELS: Record<string, string> = {
  private: 'Private — Foundation only',
  internal: 'Internal — staff and editors',
  partner: 'Partner — approved publishers and producers',
  public_excerpt: 'Public — metadata and excerpt',
  public_full: 'Public — full text',
};

export const VISIBILITY_HELP: Record<string, string> = {
  private: 'Nobody outside the Foundation can see this record.',
  internal: 'Visible to staff and editors. Not listed in the public archive.',
  partner: 'Listed to signed-in partners with full text. Public users see nothing.',
  public_excerpt: 'Listed publicly with metadata and a short excerpt only.',
  public_full: 'Listed publicly with the complete story text.',
};

export const STORY_STATUS_LABELS: Record<string, string> = {
  editorial: 'In editorial',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
};
