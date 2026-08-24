import { getObject, R2_PREFIX } from '@/lib/r2';

/**
 * Serves public brand media out of the private R2 bucket.
 *
 * The bucket has no public hostname bound to it, and making it public just to
 * show a logo would also expose every manuscript key that shares it. Instead
 * this route proxies a strictly limited slice — `dpglf/brand/**` and
 * `dpglf/media/**` — and nothing else. Manuscripts, contracts and consent
 * evidence are never reachable here; they only come out through a signed URL
 * after a permission check.
 *
 * Once a CDN hostname is bound to the bucket, set CLOUDFLARE_PUBLIC_URL and the
 * app links straight at it instead — no code change.
 */

const SERVABLE = [`${R2_PREFIX}/brand/`, `${R2_PREFIX}/media/`];

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const objectKey = key.map(decodeURIComponent).join('/');

  if (objectKey.includes('..') || !SERVABLE.some((prefix) => objectKey.startsWith(prefix))) {
    return new Response('Not found', { status: 404 });
  }

  const object = await getObject(objectKey);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.contentType,
      ...(object.size ? { 'Content-Length': String(object.size) } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
