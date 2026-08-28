import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUSES,
  NOTIFIABLE_STATUSES,
  STATUS_LABELS,
  STATUS_TONE,
  STATUS_WRITER_COPY,
  SUBMISSION_STATUSES,
  TRANSITIONS,
  allowedTransitions,
  canTransition,
} from '@/lib/workflow';

/**
 * The state machine is the implementation plan's central risk item: "a story
 * changes meaning and visibility across stages". These tests pin the declared
 * transition table so a UI change can never quietly widen it.
 */
describe('submission state machine', () => {
  const writer = { roles: [] as never[], isOwner: true };
  const judge = { roles: ['judge' as const], isOwner: false };
  const mentor = { roles: ['mentor' as const], isOwner: false };
  const admin = { roles: ['admin' as const], isOwner: false };
  const editor = { roles: ['editor' as const], isOwner: false };

  it('declares a transition table that only targets known statuses', () => {
    for (const [from, transitions] of Object.entries(TRANSITIONS)) {
      expect(SUBMISSION_STATUSES).toContain(from);
      for (const t of transitions) expect(SUBMISSION_STATUSES).toContain(t.to);
    }
  });

  it('has writer-facing copy, a label and a tone for every status', () => {
    for (const status of SUBMISSION_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_WRITER_COPY[status]).toBeTruthy();
      expect(STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('lets the writer submit and withdraw their own draft, and nothing else', () => {
    expect(canTransition('DRAFT', 'SUBMITTED', writer)).toBe(true);
    expect(canTransition('DRAFT', 'WITHDRAWN', writer)).toBe(true);
    expect(canTransition('DRAFT', 'SHORTLISTED', writer)).toBe(false);
    expect(canTransition('JUDGED', 'SHORTLISTED', writer)).toBe(false);
    expect(canTransition('EDITORIAL', 'APPROVED_FOR_PUBLICATION', writer)).toBe(false);
  });

  it('a non-owner writer cannot move someone else’s draft', () => {
    expect(canTransition('DRAFT', 'SUBMITTED', { roles: [], isOwner: false })).toBe(false);
    expect(canTransition('SUBMITTED', 'WITHDRAWN', { roles: [], isOwner: false })).toBe(false);
  });

  it('judges score; they never transition anything', () => {
    for (const status of SUBMISSION_STATUSES) {
      expect(allowedTransitions(status, judge)).toHaveLength(0);
    }
  });

  it('mentors may only hand a mentorship story to editorial', () => {
    const moves = SUBMISSION_STATUSES.flatMap((status) =>
      allowedTransitions(status, mentor).map((t) => `${status}->${t.to}`),
    );
    expect(moves).toEqual(['MENTORSHIP->EDITORIAL']);
  });

  it('editors work the development stages but cannot approve publication', () => {
    expect(canTransition('SHORTLISTED', 'EDITORIAL', editor)).toBe(true);
    expect(canTransition('EDITORIAL', 'MENTORSHIP', editor)).toBe(true);
    expect(canTransition('EDITORIAL', 'APPROVED_FOR_PUBLICATION', editor)).toBe(false);
  });

  it('admins run the pipeline end to end', () => {
    const path: [string, string][] = [
      ['SUBMITTED', 'ELIGIBILITY_REVIEW'],
      ['ELIGIBILITY_REVIEW', 'ELIGIBLE'],
      ['ELIGIBLE', 'ASSIGNED_FOR_JUDGING'],
      ['ASSIGNED_FOR_JUDGING', 'JUDGED'],
      ['JUDGED', 'SHORTLISTED'],
      ['SHORTLISTED', 'MENTORSHIP'],
      ['MENTORSHIP', 'EDITORIAL'],
      ['EDITORIAL', 'APPROVED_FOR_PUBLICATION'],
      ['APPROVED_FOR_PUBLICATION', 'PUBLISHED'],
    ];
    for (const [from, to] of path) {
      expect(canTransition(from as never, to as never, admin)).toBe(true);
    }
  });

  it('PUBLISHED is terminal', () => {
    expect(TRANSITIONS.PUBLISHED).toHaveLength(0);
  });

  it('skipping stages is not possible even for admins', () => {
    expect(canTransition('SUBMITTED', 'SHORTLISTED', admin)).toBe(false);
    expect(canTransition('ELIGIBLE', 'PUBLISHED', admin)).toBe(false);
    expect(canTransition('DRAFT', 'PUBLISHED', admin)).toBe(false);
  });

  it('keeps the notification and active lists consistent with the statuses', () => {
    for (const s of NOTIFIABLE_STATUSES) expect(SUBMISSION_STATUSES).toContain(s);
    for (const s of ACTIVE_STATUSES) expect(SUBMISSION_STATUSES).toContain(s);
    expect(ACTIVE_STATUSES).not.toContain('DRAFT');
    expect(ACTIVE_STATUSES).not.toContain('WITHDRAWN');
  });
});
