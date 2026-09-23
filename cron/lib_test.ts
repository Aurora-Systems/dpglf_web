import { assert, assertEquals, assertRejects } from '@std/assert';
import { isRetryable, runMaintenance, taskErrors, timingSafeEqual } from './lib.ts';

/** A fetch stand-in that records the request and replies with a fixed response. */
function stubFetch(status: number, body: string) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(new Response(body, { status }));
  }) as typeof fetch;
  return { impl, calls };
}

Deno.test('calls the endpoint with the bearer key and parses the JSON report', async () => {
  const { impl, calls } = stubFetch(200, JSON.stringify({ ok: true, pruned: true }));
  const result = await runMaintenance({
    target: 'https://example.org/api/cron',
    key: 'secret',
    fetchImpl: impl,
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, 'https://example.org/api/cron');
  const headers = new Headers(calls[0].init?.headers);
  assertEquals(headers.get('authorization'), 'Bearer secret');
  assertEquals(result.ok, true);
  assertEquals(result.status, 200);
  assertEquals(result.body, { ok: true, pruned: true });
});

Deno.test('keeps a truncated body when the host answers with HTML instead of JSON', async () => {
  const { impl } = stubFetch(502, `<html>${'x'.repeat(2000)}</html>`);
  const result = await runMaintenance({ target: 'https://example.org', key: 'k', fetchImpl: impl });
  assertEquals(result.ok, false);
  assertEquals(result.status, 502);
  assertEquals(typeof result.body, 'string');
  assertEquals((result.body as string).length, 500);
});

Deno.test('rejects when the platform hangs past the timeout', async () => {
  // Never answers, but honours the abort signal like a real fetch.
  const hang = ((_input: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as typeof fetch;
  await assertRejects(() =>
    runMaintenance({ target: 'https://example.org', key: 'k', fetchImpl: hang, timeoutMs: 20 })
  );
});

Deno.test('retries transient failures but not configuration errors', () => {
  for (const status of [0, 408, 429, 500, 502, 503, 504]) assert(isRetryable(status), `${status}`);
  for (const status of [200, 400, 401, 403, 404]) assert(!isRetryable(status), `${status}`);
});

Deno.test('surfaces per-task failures reported inside a 200', () => {
  assertEquals(
    taskErrors({ ok: true, emailRetryError: 'resend down', emoworld: { sent: 0 }, pruned: true }),
    ['emailRetry: resend down'],
  );
  assertEquals(taskErrors({ ok: true, pruned: true }), []);
  assertEquals(taskErrors('not json'), []);
  assertEquals(taskErrors(null), []);
  assertEquals(taskErrors(['emailRetryError']), []);
});

Deno.test('compares bearer tokens exactly, whatever their lengths', () => {
  assert(timingSafeEqual('Bearer abc', 'Bearer abc'));
  assert(!timingSafeEqual('Bearer abc', 'Bearer abd'));
  assert(!timingSafeEqual('Bearer abc', 'Bearer abcd'));
  assert(!timingSafeEqual('', 'Bearer abc'));
});
