import { describe, expect, it } from 'vitest';
import {
  countWords,
  deadlineLabel,
  formatBytes,
  formatDate,
  formatDateTime,
  initials,
  slugify,
  toFoundationInput,
  truncate,
} from '@/lib/format';

describe('slugify', () => {
  it('produces stable URL-safe slugs from messy titles', () => {
    expect(slugify('The Baobab Remembers!')).toBe('the-baobab-remembers');
    expect(slugify("Ngano — Dzemusha's Tale")).toBe('ngano-dzemushas-tale');
    expect(slugify('   ')).toBe('story');
    expect(slugify('', 'writer')).toBe('writer');
  });
});

describe('countWords', () => {
  it('counts prose the way a competition word limit expects', () => {
    expect(countWords("It's a one-two punch, isn't it?")).toBe(6);
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\n  ')).toBe(0);
  });
});

describe('truncate', () => {
  it('cuts at a word boundary with an ellipsis', () => {
    const out = truncate('one two three four five', 13);
    expect(out).toBe('one two three…');
    expect(truncate('short', 100)).toBe('short');
  });
});

describe('deadlineLabel', () => {
  it('reads correctly on both sides of the deadline', () => {
    expect(deadlineLabel(new Date(Date.now() + 86_400_000))).toMatch(/^Closes /);
    expect(deadlineLabel(new Date(Date.now() - 86_400_000))).toMatch(/^Closed /);
    expect(deadlineLabel(null)).toBe('No closing date set');
  });
});

describe('display helpers', () => {
  it('derives initials and human file sizes', () => {
    expect(initials('Rutendo Machingura')).toBe('RM');
    expect(initials('Cher')).toBe('C');
    expect(initials('')).toBe('·');
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});

describe('Foundation time', () => {
  it('shows deadlines in Harare time, not the server’s zone', () => {
    expect(formatDateTime('2026-09-27T21:59:00Z')).toBe('27 Sept 2026, 23:59 CAT');
    // 23:00 UTC on the 27th is already the 28th in Harare.
    expect(formatDate('2026-09-27T23:00:00Z')).toBe('28 September 2026');
  });

  it('round-trips a datetime-local value in Harare wall-clock time', () => {
    expect(toFoundationInput('2026-09-27T21:59:00Z')).toBe('2026-09-27T23:59');
    expect(toFoundationInput('2026-01-01T00:30:00Z')).toBe('2026-01-01T02:30');
    expect(toFoundationInput(null)).toBe('');
    expect(toFoundationInput('garbage')).toBe('');
  });
});
