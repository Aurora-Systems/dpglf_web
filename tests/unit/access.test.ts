import { describe, expect, it } from 'vitest';
import {
  canBrowseAdaptationCatalogue,
  canEditSubmission,
  canReadFullText,
  hasRole,
  isStaff,
  isSuperAdmin,
  visibleLevels,
} from '@/lib/access';
import type { SessionUser } from '@/lib/session';

const user = (...roles: SessionUser['roles']): SessionUser => ({
  userId: 'u1',
  email: 'x@example.org',
  name: 'X',
  roles,
});

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

describe('role predicates', () => {
  it('treats roles as additive claims', () => {
    expect(hasRole(user('writer', 'judge'), 'judge')).toBe(true);
    expect(hasRole(user('writer'), 'judge')).toBe(false);
    expect(hasRole(null, 'admin')).toBe(false);
  });

  it('staff means admin or super admin, nothing looser', () => {
    expect(isStaff(user('admin'))).toBe(true);
    expect(isStaff(user('super_admin'))).toBe(true);
    expect(isStaff(user('editor'))).toBe(false);
    expect(isStaff(user('judge', 'mentor', 'writer', 'partner'))).toBe(false);
    expect(isSuperAdmin(user('admin'))).toBe(false);
  });
});

describe('canEditSubmission', () => {
  it('drafts are editable while the competition is open', () => {
    expect(canEditSubmission('DRAFT', FUTURE, null)).toBe(true);
    expect(canEditSubmission('DRAFT', null, null)).toBe(true);
  });

  it('the deadline closes editing', () => {
    expect(canEditSubmission('DRAFT', PAST, null)).toBe(false);
  });

  it('submission locks the entry regardless of the deadline', () => {
    expect(canEditSubmission('SUBMITTED', FUTURE, null)).toBe(false);
  });

  it('an admin reopen window overrides both, and expires', () => {
    expect(canEditSubmission('SUBMITTED', PAST, FUTURE)).toBe(true);
    expect(canEditSubmission('DRAFT', PAST, FUTURE)).toBe(true);
    expect(canEditSubmission('SUBMITTED', PAST, PAST)).toBe(false);
  });
});

describe('archive visibility', () => {
  it('the public sees only the public levels', () => {
    expect(visibleLevels(null)).toEqual(['public_excerpt', 'public_full']);
    expect(visibleLevels(user('writer'))).toEqual(['public_excerpt', 'public_full']);
  });

  it('partners additionally see partner-only records', () => {
    expect(visibleLevels(user('partner'))).toEqual(['partner', 'public_excerpt', 'public_full']);
  });

  it('staff and editors see everything', () => {
    for (const u of [user('admin'), user('super_admin'), user('editor')]) {
      expect(visibleLevels(u)).toHaveLength(5);
    }
  });

  it('full text follows the level, not the login', () => {
    expect(canReadFullText(null, 'public_full')).toBe(true);
    expect(canReadFullText(null, 'public_excerpt')).toBe(false);
    expect(canReadFullText(user('writer'), 'partner')).toBe(false);
    expect(canReadFullText(user('partner'), 'partner')).toBe(true);
    expect(canReadFullText(user('editor'), 'private')).toBe(true);
  });

  it('the adaptation catalogue is for partners and staff only', () => {
    expect(canBrowseAdaptationCatalogue(null)).toBe(false);
    expect(canBrowseAdaptationCatalogue(user('writer'))).toBe(false);
    expect(canBrowseAdaptationCatalogue(user('partner'))).toBe(true);
    expect(canBrowseAdaptationCatalogue(user('admin'))).toBe(true);
  });
});
