import { MANUSCRIPT_MAX_BYTES, MANUSCRIPT_TYPES } from '@/lib/files';
import { canEditSubmission } from '@/lib/access';

/** Age bands that trigger the guardian-consent requirement. */
export const MINOR_BANDS = new Set(['under_13', '13_15', '16_17']);

export const MANUSCRIPT_ACCEPT = [...Object.keys(MANUSCRIPT_TYPES), '.docx', '.pdf', '.rtf', '.txt'].join(',');
export const MANUSCRIPT_LIMIT = MANUSCRIPT_MAX_BYTES;

export interface BlockerInput {
  title: string;
  synopsis: string;
  file_id: string | null;
  requires_guardian_consent: boolean;
  age_band: string | null;
  consent_status: string | null;
  closes_at: string | null;
  status: string;
  reopened_until: string | null;
}

/**
 * Everything still standing between a draft and a valid submission.
 *
 * Shared by the wizard (which shows them as a checklist) and by `submitAction`
 * (which enforces them). Keeping one list means the button and the server can
 * never disagree about whether an entry is ready.
 */
export function submissionBlockers(s: BlockerInput): string[] {
  const problems: string[] = [];
  if (!s.title.trim()) problems.push('Add a title for your story.');
  if (s.synopsis.trim().length < 40) problems.push('Write a synopsis of at least a couple of sentences.');
  if (!s.file_id) problems.push('Upload your manuscript.');
  if (s.requires_guardian_consent && MINOR_BANDS.has(s.age_band ?? '') && s.consent_status !== 'granted') {
    problems.push(
      s.consent_status
        ? 'Your guardian has not given consent yet. They received a link by email.'
        : 'Add your parent or guardian’s details so we can request consent.',
    );
  }
  if (!canEditSubmission(s.status, s.closes_at, s.reopened_until)) {
    problems.push('This competition has closed.');
  }
  return problems;
}
