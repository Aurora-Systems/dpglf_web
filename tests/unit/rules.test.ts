import { describe, expect, it } from 'vitest';
import { MINOR_BANDS, submissionBlockers, withinAgeLimits, type BlockerInput } from '@/features/submissions/rules';

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

/** A draft that is genuinely ready to submit. */
const ready: BlockerInput = {
  title: 'The Baobab Remembers',
  synopsis: 'A drought empties the village and the old baobab starts giving its stories back to anyone who listens.',
  file_id: 'file-1',
  requires_guardian_consent: true,
  age_band: '16_17',
  consent_status: 'granted',
  closes_at: FUTURE,
  status: 'DRAFT',
  reopened_until: null,
};

describe('submissionBlockers', () => {
  it('passes a complete entry', () => {
    expect(submissionBlockers(ready)).toEqual([]);
  });

  it('requires a title, a real synopsis and a manuscript', () => {
    expect(submissionBlockers({ ...ready, title: '  ' })).toHaveLength(1);
    expect(submissionBlockers({ ...ready, synopsis: 'Too short.' })).toHaveLength(1);
    expect(submissionBlockers({ ...ready, file_id: null })).toHaveLength(1);
  });

  it('blocks a minor without granted consent, with the right message per state', () => {
    const noConsent = submissionBlockers({ ...ready, consent_status: null });
    expect(noConsent[0]).toMatch(/parent or guardian/i);
    const pending = submissionBlockers({ ...ready, consent_status: 'pending' });
    expect(pending[0]).toMatch(/has not given consent/i);
    const revoked = submissionBlockers({ ...ready, consent_status: 'revoked' });
    expect(revoked).toHaveLength(1);
  });

  it('does not demand consent from adults or consent-free competitions', () => {
    expect(submissionBlockers({ ...ready, age_band: '25_plus', consent_status: null })).toEqual([]);
    expect(
      submissionBlockers({ ...ready, requires_guardian_consent: false, consent_status: null }),
    ).toEqual([]);
  });

  it('blocks entries to a closed competition unless an admin reopened it', () => {
    expect(submissionBlockers({ ...ready, closes_at: PAST })).toHaveLength(1);
    expect(submissionBlockers({ ...ready, closes_at: PAST, reopened_until: FUTURE })).toEqual([]);
  });

  it('agrees with the signup form about who counts as a minor', () => {
    expect([...MINOR_BANDS].sort()).toEqual(['13_15', '16_17', 'under_13']);
  });
});

describe('withinAgeLimits', () => {
  const band = (ageBand: string | null) => ({ age: null, ageBand });

  it('keeps adults out of an under-18 competition', () => {
    expect(withinAgeLimits(band('16_17'), null, 17)).toBe(true);
    expect(withinAgeLimits(band('under_13'), null, 17)).toBe(true);
    expect(withinAgeLimits(band('18_24'), null, 17)).toBe(false);
    expect(withinAgeLimits(band('25_plus'), null, 17)).toBe(false);
  });

  it('lets a band that straddles a limit through to the eligibility review', () => {
    expect(withinAgeLimits(band('13_15'), 14, 17)).toBe(true);
    expect(withinAgeLimits(band('under_13'), 13, 17)).toBe(false);
  });

  it('decides on an exact age when there is one', () => {
    expect(withinAgeLimits({ age: 17, ageBand: '16_17' }, null, 17)).toBe(true);
    expect(withinAgeLimits({ age: 18, ageBand: '16_17' }, null, 17)).toBe(false);
    expect(withinAgeLimits({ age: 12, ageBand: null }, 13, null)).toBe(false);
  });

  it('allows for the years since a band was recorded, on the lower limit only', () => {
    // Signed up at 16–17 a year ago: may be 18 now.
    expect(withinAgeLimits({ age: null, ageBand: '16_17', drift: 1 }, 18, null)).toBe(true);
    expect(withinAgeLimits({ age: null, ageBand: '16_17', drift: 0 }, 18, null)).toBe(false);
    // Ageing never lets an adult band into an under-18 competition.
    expect(withinAgeLimits({ age: null, ageBand: '18_24', drift: 3 }, null, 17)).toBe(false);
  });

  it('leaves unknown ages and unlimited competitions to the review', () => {
    expect(withinAgeLimits(band(null), null, 17)).toBe(true);
    expect(withinAgeLimits(band('25_plus'), null, null)).toBe(true);
  });
});
