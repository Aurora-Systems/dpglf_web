/**
 * Plain-English wording for audit actions, so the overview and the activity log
 * read as sentences ("Rutendo submitted an entry") rather than codes
 * ("submission.submitted"). Pure: safe for server and client components.
 */

const LABELS: Record<string, string> = {
  'user.signup': 'created an account',
  'user.login': 'signed in',
  'user.email_verified': 'confirmed their email address',
  'user.password_reset': 'reset their password',
  'user.password_set': 'had their password set from the terminal',
  'user.roles_updated': "changed someone's roles",
  'user.suspended': 'suspended an account',
  'user.active': 'reactivated an account',
  'user.deleted': 'deleted an account',
  'profile.updated': 'updated their profile',

  'competition.created': 'created a competition',
  'competition.updated': 'updated a competition',
  'rubric.created': 'created a judging rubric',

  'submission.draft_created': 'started an entry',
  'submission.submitted': 'submitted an entry',
  'submission.revision_uploaded': 'uploaded a revised manuscript',
  'submission.withdrawn': 'withdrew an entry',
  'submission.status_changed': 'moved an entry to a new stage',
  'submission.reopened': 'reopened an entry for editing',
  'submission.note_updated': 'updated an eligibility note',
  'export.submissions': 'exported the submissions list',

  'consent.requested': 'asked a guardian for consent',
  'consent.granted': 'gave guardian consent',
  'consent.revoked': 'withdrew guardian consent',

  'judging.assigned': 'assigned judges',
  'review.saved': 'saved a score',
  'review.finalised': 'submitted a final score',
  'review.unlocked': 'unlocked a score for revision',
  'review.conflict_declared': 'declared a conflict of interest',

  'mentorship.created': 'paired a writer with a mentor',
  'mentorship.completed': 'completed a mentorship',

  'story.created': 'created a story record',
  'story.updated': 'updated a story',
  'story.cover_updated': "changed a story's cover",
  'archive.metadata_updated': 'updated archive details',
  'rights.updated': 'updated rights for a story',
  'publication.added': 'recorded a publication',
  'emoworld.enqueued': 'queued a story for Emoworld',
  'emoworld.drain': 'synced stories to Emoworld',
  'inquiry.updated': 'updated a rights enquiry',

  'news.created': 'created a news post',
  'news.updated': 'updated a news post',
  'page.saved': 'saved a policy page',
  'file.downloaded': 'downloaded a private file',

  'setting.saved': 'changed a setting',
  'setting.deleted': 'removed a setting',
  'notifications.retried': 'retried failed emails',
};

/** Routine events that would bury the decisions on a summary view. */
const ROUTINE = new Set(['user.login', 'file.downloaded', 'emoworld.drain', 'review.saved']);

export function describeAction(action: string): string {
  return LABELS[action] ?? action.replace(/[._]/g, ' ');
}

export function isRoutineAction(action: string): boolean {
  return ROUTINE.has(action);
}
