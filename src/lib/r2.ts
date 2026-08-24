import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 (S3-compatible), bucket `aurorasystems`, everything under the
 * `dpglf/` prefix.
 *
 * The bucket is private. Brand assets are readable through the app's own
 * `/media/*` route; manuscripts, contracts and consent evidence are only ever
 * handed out as short-lived signed URLs, after a permission check.
 */

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
// The shared Aurora env spells the key id with this casing; accept both.
const KEY_ID = process.env.CLOUDFLARE_ACCESS_key_id ?? process.env.CLOUDFLARE_ACCESS_KEY_ID ?? '';
const SECRET = process.env.CLOUDFLARE_SECRET_ACCESS_KEY ?? '';
const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME ?? 'aurorasystems';
/** Set once a CDN hostname is bound to the bucket; empty means serve via /media. */
const PUBLIC_BASE = (process.env.CLOUDFLARE_PUBLIC_URL ?? '').replace(/\/$/, '');

export const R2_PREFIX = 'dpglf';

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT && KEY_ID && SECRET && BUCKET);
}

const globalForR2 = globalThis as unknown as { _dpgR2?: S3Client };

function client(): S3Client {
  if (!globalForR2._dpgR2) {
    globalForR2._dpgR2 = new S3Client({
      endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
    });
  }
  return globalForR2._dpgR2;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  cacheControl?: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string; size?: number } | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? 'application/octet-stream',
      size: res.ContentLength,
    };
  } catch {
    return null;
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * A time-limited download URL for a private object. Kept short — these end up
 * in browser history and email clients — and only ever issued after the caller
 * has passed a permission check.
 */
export async function signedDownloadUrl(
  key: string,
  opts: { expiresIn?: number; filename?: string } = {},
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: opts.filename
      ? `attachment; filename="${opts.filename.replace(/["\\]/g, '')}"`
      : undefined,
  });
  return getSignedUrl(client(), command, { expiresIn: opts.expiresIn ?? 300 });
}

/** Public URL for an asset that is safe to serve to anyone. */
export function publicUrl(key: string): string {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return PUBLIC_BASE ? `${PUBLIC_BASE}/${encoded}` : `/media/${encoded}`;
}

/** True only for URLs produced by our own pipeline (blocks arbitrary hosts). */
export function isOwnMediaUrl(url: string): boolean {
  if (url.startsWith('/media/')) return true;
  return Boolean(PUBLIC_BASE) && url.length <= 2048 && url.startsWith(`${PUBLIC_BASE}/`);
}

/**
 * Build a collision-proof object key. The random segment means re-uploading a
 * file with the same name never overwrites the earlier one — the plan requires
 * that an original submission is never destroyed by a later revision.
 */
export function buildKey(
  purpose: string,
  ownerId: string,
  originalName: string,
): string {
  const ext = (originalName.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? '').toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = Buffer.from(crypto.getRandomValues(new Uint8Array(9))).toString('base64url');
  return `${R2_PREFIX}/${purpose}/${stamp}/${ownerId.slice(0, 8)}-${rand}${ext}`;
}
