import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/redirect';

const SITE = 'https://gwatidzo.me';

describe('safeRedirectPath', () => {
  it('keeps same-origin paths, with their query and hash', () => {
    expect(safeRedirectPath('/dashboard/submissions?tab=1#top', SITE)).toBe('/dashboard/submissions?tab=1#top');
    expect(safeRedirectPath('/submit', SITE)).toBe('/submit');
  });

  it('falls back when there is nothing usable', () => {
    expect(safeRedirectPath(undefined, SITE)).toBe('/dashboard');
    expect(safeRedirectPath('', SITE)).toBe('/dashboard');
    expect(safeRedirectPath('dashboard', SITE)).toBe('/dashboard');
    expect(safeRedirectPath('https://evil.com', SITE)).toBe('/dashboard');
  });

  it('refuses every way of spelling another host', () => {
    for (const next of [
      '//evil.com',
      '/\\evil.com',
      '/\t/evil.com',
      '/.//evil.com',
      '/..//evil.com',
      '/a/..//evil.com',
      '/%2e%2e//evil.com/x?y=1',
    ]) {
      expect(safeRedirectPath(next, SITE), next).toBe('/dashboard');
    }
  });
});
