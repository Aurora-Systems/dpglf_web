#!/usr/bin/env node
/**
 * Upload the Foundation's brand assets to the Cloudflare R2 `aurorasystems`
 * bucket under the `dpglf/` prefix. Re-runnable: PutObject overwrites in place,
 * so the published keys (and therefore every URL in the app) stay stable.
 *
 *   node scripts/upload-assets.mjs <source-dir>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ENV = loadEnv('.env.local');
const ACCOUNT = ENV.CLOUDFLARE_ACCOUNT_ID;
const KEY_ID = ENV.CLOUDFLARE_ACCESS_key_id ?? ENV.CLOUDFLARE_ACCESS_KEY_ID;
const SECRET = ENV.CLOUDFLARE_SECRET_ACCESS_KEY;
const BUCKET = ENV.CLOUDFLARE_BUCKET_NAME;

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
};

/** Where each source filename lands in the bucket. */
const KEYS = {
  'logo-mark-1024.png': 'dpglf/brand/logo-mark-1024.png',
  'logo-mark-512.png': 'dpglf/brand/logo-mark-512.png',
  'logo-mark-256.png': 'dpglf/brand/logo-mark-256.png',
  'logo-mark-128.png': 'dpglf/brand/logo-mark-128.png',
  'logo-lockup-1600.jpg': 'dpglf/brand/logo-lockup-1600.jpg',
  'logo-lockup-800.jpg': 'dpglf/brand/logo-lockup-800.jpg',
  'founder-portrait-720.jpg': 'dpglf/brand/founder-portrait-720.jpg',
  'founder-portrait-480.jpg': 'dpglf/brand/founder-portrait-480.jpg',
  'intro-poster.jpg': 'dpglf/media/intro-poster.jpg',
  'intro.mp4': 'dpglf/media/intro.mp4',
};

function loadEnv(path) {
  const out = {};
  let raw = '';
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const m = /^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: node scripts/upload-assets.mjs <source-dir>');
  if (!ACCOUNT || !KEY_ID || !SECRET || !BUCKET) {
    throw new Error('Missing CLOUDFLARE_* credentials in .env.local');
  }

  const s3 = new S3Client({
    endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
  });

  for (const name of readdirSync(dir)) {
    const src = join(dir, name);
    if (!statSync(src).isFile()) continue;
    const key = KEYS[basename(name)];
    if (!key) {
      console.log(`skip   ${name} (not in the publish manifest)`);
      continue;
    }
    const body = readFileSync(src);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: MIME[extname(name).toLowerCase()] ?? 'application/octet-stream',
        // Immutable content-addressed-ish brand assets: cache hard at the edge.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    console.log(`upload ${key}  (${(body.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
