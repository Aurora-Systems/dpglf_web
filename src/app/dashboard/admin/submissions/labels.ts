import { STATUS_LABELS, type SubmissionStatus } from '@/lib/workflow';

/** Plain-English wording for the codes the Submissions pages display. */

/** The filter chips, grouped by where an entry is in its journey. */
export const STATUS_STAGES: { label: string; statuses: SubmissionStatus[] }[] = [
  { label: 'Intake', statuses: ['SUBMITTED', 'ELIGIBILITY_REVIEW', 'ELIGIBLE', 'INELIGIBLE'] },
  { label: 'Judging', statuses: ['ASSIGNED_FOR_JUDGING', 'JUDGED', 'SHORTLISTED', 'NOT_SELECTED'] },
  { label: 'After judging', statuses: ['MENTORSHIP', 'EDITORIAL', 'APPROVED_FOR_PUBLICATION', 'PUBLISHED'] },
  { label: 'Other', statuses: ['WITHDRAWN'] },
];

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as SubmissionStatus] ?? status;
}

const AGE_BANDS: Record<string, string> = {
  under_13: 'Under 13',
  '13_15': '13 to 15',
  '16_17': '16 to 17',
  '18_24': '18 to 24',
  '25_plus': '25 or older',
};

export function ageBandLabel(band: string | null | undefined): string | null {
  if (!band) return null;
  return AGE_BANDS[band] ?? band.replace(/_/g, ' ');
}

export const CONSENT_LABELS: Record<string, string> = {
  pending: 'Waiting',
  granted: 'Granted',
  revoked: 'Withdrawn',
};

export const CONSENT_METHODS: Record<string, string> = {
  guardian_email: 'Confirmed by the guardian by email',
  countersigned_form: 'Countersigned form',
  in_person: 'Given in person',
};

export const ASSIGNMENT_LABELS: Record<string, string> = {
  assigned: 'Not started',
  in_progress: 'In progress',
  completed: 'Scored',
  declined: 'Declined',
  revoked: 'Removed',
};

export const RECOMMENDATION_LABELS: Record<string, string> = {
  shortlist: 'Shortlist',
  maybe: 'Borderline',
  reject: 'Not this time',
};
