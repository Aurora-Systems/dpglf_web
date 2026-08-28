import { describe, expect, it } from 'vitest';
import { MINOR_BANDS, submissionBlockers, type BlockerInput } from '@/features/submissions/rules';

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
