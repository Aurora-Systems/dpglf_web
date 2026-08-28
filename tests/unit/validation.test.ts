import { describe, expect, it } from 'vitest';
import {
  competitionSchema,
  contactSchema,
  fieldErrors,
  signupSchema,
  submissionMetaSchema,
  toList,
} from '@/lib/validation';

describe('signupSchema', () => {
  const valid = {
    name: 'Rutendo',
    email: 'RUTENDO@Example.org ',
    password: 'longenough1',
    ageBand: '16_17',
    country: 'Zimbabwe',
    acceptTerms: true,
  };

  it('accepts a valid signup and normalises the email', () => {
    const parsed = signupSchema.parse(valid);
    expect(parsed.email).toBe('rutendo@example.org');
  });

  it('enforces the password floor and the terms checkbox', () => {
    expect(signupSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it('only accepts known age bands', () => {
    expect(signupSchema.safeParse({ ...valid, ageBand: '30_40' }).success).toBe(false);
  });
});

describe('contactSchema honeypot', () => {
  const valid = {
    name: 'A Person',
    email: 'a@example.org',
    topic: 'general',
    message: 'A message long enough to pass the minimum length check.',
  };

  it('rejects anything a bot typed into the hidden field', () => {
    expect(contactSchema.safeParse({ ...valid, website: '' }).success).toBe(true);
    expect(contactSchema.safeParse({ ...valid, website: 'https://spam' }).success).toBe(false);
  });
});

describe('submissionMetaSchema', () => {
  it('requires a substantive synopsis', () => {
    const base = { title: 'T1', language: 'English' };
    expect(submissionMetaSchema.safeParse({ ...base, synopsis: 'Too short.' }).success).toBe(false);
    expect(
      submissionMetaSchema.safeParse({
        ...base,
        synopsis: 'A synopsis with enough substance to tell a judge what actually happens.',
      }).success,
    ).toBe(true);
  });
});

describe('competitionSchema', () => {
  it('holds slugs to URL-safe characters', () => {
    const base = { name: 'Test', wordMin: 500, wordMax: 3000, maxEntries: 1, status: 'draft' };
    expect(competitionSchema.safeParse({ ...base, slug: 'tales-2026' }).success).toBe(true);
    expect(competitionSchema.safeParse({ ...base, slug: 'Bad Slug!' }).success).toBe(false);
  });
});

describe('helpers', () => {
  it('toList splits on commas and newlines and trims', () => {
    expect(toList(' a, b ,,c\nd ')).toEqual(['a', 'b', 'c', 'd']);
    expect(toList('a,b,c', 2)).toEqual(['a', 'b']);
  });

  it('fieldErrors keeps the first message per field', () => {
    const result = signupSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.email).toBeTruthy();
      expect(errors.name).toBeTruthy();
    }
  });
});
