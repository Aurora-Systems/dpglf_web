import { describe, expect, it } from 'vitest';
import {
  REJECTED_PREFIX,
  absoluteHttpsUrl,
  classifyEmoworldResponse,
  describeRejection,
  isMinorAgeBand,
  remoteIdFrom,
  responseDetail,
} from '@/features/emoworld/wire';

/**
 * The Emoworld contract as DPGLF reads it. Emoworld answers 201/200 with
 * {id, status, reviewStatus} on success, 404 to a DELETE for a story it never
 * received, and 401/413/422 (or 400) when it refuses the request itself.
 */
describe('Emoworld response handling', () => {
  it('treats every 2xx as success, for both actions', () => {
    for (const status of [200, 201, 204]) {
      expect(classifyEmoworldResponse(status, 'send')).toBe('success');
      expect(classifyEmoworldResponse(status, 'withdraw')).toBe('success');
    }
  });

  it('counts a 404 as done only for a withdrawal', () => {
    expect(classifyEmoworldResponse(404, 'withdraw')).toBe('success');
    expect(classifyEmoworldResponse(404, 'send')).toBe('permanent');
  });

  it('does not retry a refusal', () => {
    for (const status of [400, 401, 403, 409, 413, 422]) {
      expect(classifyEmoworldResponse(status, 'send')).toBe('permanent');
      expect(classifyEmoworldResponse(status, 'withdraw')).toBe('permanent');
    }
  });

  it('retries 408, 425, 429 and every 5xx', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(classifyEmoworldResponse(status, 'send')).toBe('retryable');
      expect(classifyEmoworldResponse(status, 'withdraw')).toBe('retryable');
    }
  });

  it("reads Emoworld's id from a success body", () => {
    expect(remoteIdFrom('{"id":"7a1f","status":"created","reviewStatus":"submitted"}')).toBe('7a1f');
    expect(remoteIdFrom('{"id":"7a1f","status":"withdrawn"}')).toBe('7a1f');
    expect(remoteIdFrom('{"status":"unchanged"}')).toBeNull();
    expect(remoteIdFrom('')).toBeNull();
    expect(remoteIdFrom('not json')).toBeNull();
  });

  it("summarises Emoworld's {error, fields} for the console", () => {
    const body = JSON.stringify({ error: 'Invalid story', fields: { title: 'Required', 'author.isMinor': 'Must be true or false' } });
    expect(responseDetail(body)).toBe('Invalid story (title: Required; author.isMinor: Must be true or false)');
    expect(responseDetail('{"error":"Unauthorized"}')).toBe('Unauthorized');
    expect(responseDetail('  plain\n text ')).toBe('plain text');
    expect(responseDetail('')).toBe('no details given');
    expect(describeRejection(401, '{"error":"Unauthorized"}')).toBe(`${REJECTED_PREFIX} (401): Unauthorized`);
  });
});

describe('Emoworld payload helpers', () => {
  it('flags the three under-18 bands as minors', () => {
    for (const band of ['under_13', '13_15', '16_17']) expect(isMinorAgeBand(band)).toBe(true);
    for (const band of ['18_24', '25_plus', '', null, undefined]) expect(isMinorAgeBand(band)).toBe(false);
  });

  it('sends only absolute https cover URLs', () => {
    expect(absoluteHttpsUrl('https://cdn.example.org/covers/a.jpg', null)).toBe('https://cdn.example.org/covers/a.jpg');
    expect(absoluteHttpsUrl('/media/covers/a.jpg', 'https://gwatidzo.me/')).toBe('https://gwatidzo.me/media/covers/a.jpg');
    expect(absoluteHttpsUrl('/media/covers/a.jpg', 'http://localhost:3000')).toBeNull();
    expect(absoluteHttpsUrl('/media/covers/a.jpg', '')).toBeNull();
    expect(absoluteHttpsUrl('http://cdn.example.org/a.jpg', null)).toBeNull();
    expect(absoluteHttpsUrl('not a url', null)).toBeNull();
  });
});
