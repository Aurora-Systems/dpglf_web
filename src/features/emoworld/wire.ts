import { MINOR_BANDS } from '@/features/submissions/rules';

/**
 * The pure parts of the Emoworld handoff: no database, no network. Kept apart
 * from `sync.ts` so the rules that decide what happens to a queue row can be
 * tested on their own.
 */

/** What a queue row asks Emoworld to do: take the story, or take it back. */
export type QueueAction = 'send' | 'withdraw';

export type ResponseOutcome = 'success' | 'permanent' | 'retryable';

/** 4xx statuses that mean "not now" rather than "no". */
const RETRYABLE_4XX = new Set([408, 425, 429]);

/**
 * How to treat an Emoworld response.
 *
 * 2xx is success. A withdrawal answered 404 is success too: Emoworld holds
 * nothing to take down. Any other 4xx is Emoworld refusing the request itself
 * (bad secret, invalid payload, too large), and sending the same request again
 * cannot change the answer, so it is permanent. Everything else (5xx, a
 * timeout, rate limiting) is worth another try.
 */
export function classifyEmoworldResponse(status: number, action: QueueAction): ResponseOutcome {
  if (status >= 200 && status < 300) return 'success';
  if (action === 'withdraw' && status === 404) return 'success';
  if (status >= 400 && status < 500 && !RETRYABLE_4XX.has(status)) return 'permanent';
  return 'retryable';
}

/** Emoworld applies its own safeguarding rules to a minor's story on arrival. */
export function isMinorAgeBand(ageBand: string | null | undefined): boolean {
  return MINOR_BANDS.has(ageBand ?? '');
}

/**
 * An absolute https URL Emoworld can fetch, or null.
 *
 * `publicUrl()` gives either a CDN URL or a site-relative `/media/...` path.
 * Emoworld fetches the image from its own servers, so a relative path is
 * prefixed with the site URL, and anything that is not https (a localhost site
 * URL, an unset one) is dropped rather than sent.
 */
export function absoluteHttpsUrl(url: string, siteUrl: string | null | undefined): string | null {
  let candidate = url.trim();
  if (candidate.startsWith('/')) {
    const site = (siteUrl ?? '').trim().replace(/\/+$/, '');
    if (!site) return null;
    candidate = `${site}${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' && parsed.hostname ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Every permanent failure's `last_error` starts with this, so the console can tell it apart. */
export const REJECTED_PREFIX = 'Emoworld rejected this';

/** The `last_error` for a refusal, e.g. "Emoworld rejected this (422): Invalid story (title: Required)". */
export function describeRejection(status: number, body: string): string {
  return `${REJECTED_PREFIX} (${status}): ${responseDetail(body)}`.slice(0, 500);
}

/** The useful part of an error body: Emoworld's `{error, fields}` when present, else the text. */
export function responseDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; fields?: unknown };
    if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
      const fields =
        parsed.fields && typeof parsed.fields === 'object'
          ? Object.entries(parsed.fields as Record<string, unknown>)
              .map(([field, problem]) => `${field}: ${String(problem)}`)
              .join('; ')
          : '';
      return (fields ? `${parsed.error} (${fields})` : parsed.error).slice(0, 400);
    }
  } catch {
    /* not JSON: fall back to the text */
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 300) || 'no details given';
}

/** Emoworld's id for the story, from a success body (`{id, status, reviewStatus}`). */
export function remoteIdFrom(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { id?: unknown };
    if (typeof parsed?.id === 'string' && parsed.id) return parsed.id;
    if (typeof parsed?.id === 'number') return String(parsed.id);
  } catch {
    /* no body, or not JSON */
  }
  return null;
}
