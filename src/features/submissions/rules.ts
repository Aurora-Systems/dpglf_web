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

/** Inclusive age range each band covers. */
const BAND_RANGES: Record<string, [number, number]> = {
  under_13: [0, 12],
  '13_15': [13, 15],
  '16_17': [16, 17],
  '18_24': [18, 24],
  '25_plus': [25, 150],
};

/**
 * Whether a writer fits a competition's age limits.
 *
 * An exact age (from a date of birth, which is only collected when a programme
 * needs provable eligibility) decides outright. Otherwise the writer's age band
 * must at least overlap the range: a band straddling a limit is let through for
 * the eligibility review to settle, rather than turning away someone who
 * qualifies. With neither, the review decides.
 */
export function withinAgeLimits(
  writer: {
    age: number | null;
    ageBand: string | null;
    /**
     * Whole years (rounded up) since the band was recorded at sign-up. A band is
     * a snapshot: a 16–17 writer who signed up last year may be 18 now, so the
     * band's top can have moved up by this much by the closing date.
     */
    drift?: number;
  },
  minAge: number | null,
  maxAge: number | null,
): boolean {
  const lo = minAge ?? 0;
  const hi = maxAge ?? Number.POSITIVE_INFINITY;
  if (writer.age !== null) return writer.age >= lo && writer.age <= hi;
  const band = writer.ageBand ? BAND_RANGES[writer.ageBand] : undefined;
  if (!band) return true;
  // Ageing only moves a writer up, so it widens the lower-limit check alone.
  // The upper limit keeps the recorded band: a writer who has aged past it is
  // caught by the eligibility review, not waved through here.
  return band[1] + (writer.drift ?? 0) >= lo && band[0] <= hi;
}
