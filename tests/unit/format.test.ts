import { describe, expect, it } from 'vitest';
import {
  countWords,
  deadlineLabel,
  formatBytes,
  initials,
  slugify,
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
