import { queryOne } from './db';
import { buildKey, deleteObject, putObject, signedDownloadUrl } from './r2';

/**
 * Manuscript and asset intake.
 *
 * Every accepted upload does four things: validate the declared type against
 * the actual bytes, extract plain text (for word counts and, where permitted,
 * search), record a checksum, and register the object in `files`. The bytes go
 * to R2; only the pointer goes to Postgres.
 */

export const MANUSCRIPT_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/rtf': '.rtf',
  'text/rtf': '.rtf',
} as const;

// 4 MB, for both. Uploads travel as a server-action body, and Netlify caps a
// function request at 6 MB after base64-encoding binary bodies (a third larger),
// so 4 MB plus form overhead is the most that reliably arrives. A 3,000-word
// manuscript is well under 1 MB in any accepted format.
export const MANUSCRIPT_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface StoredFile {
  id: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export class UploadError extends Error {}

/**
 * Magic-number check. A browser's declared Content-Type is attacker-controlled,
 * so a ".docx" that is really a script must not reach the mentor who downloads
 * it. This is a sanity gate, not antivirus — see the README for the production
 * scanning recommendation.
 */
function sniff(buf: Buffer): 'zip' | 'pdf' | 'rtf' | 'text' | 'image' | 'unknown' {
  if (buf.length < 4) return 'unknown';
  const b = buf.subarray(0, 8);
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'zip';
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (b.subarray(0, 5).toString('latin1') === '{\\rtf') return 'rtf';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image';
  if (b.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') return 'image';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF') return 'image';
  // Plain text: no NUL bytes and almost no control characters in the first block.
  const sample = buf.subarray(0, 1024);
  let control = 0;
  for (const byte of sample) {
    if (byte === 0) return 'unknown';
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) control++;
  }
  return control / sample.length < 0.02 ? 'text' : 'unknown';
}

export function validateManuscript(file: { type: string; size: number; name: string }): void {
  if (!(file.type in MANUSCRIPT_TYPES)) {
    throw new UploadError('Manuscripts must be a Word (.docx), PDF, RTF or plain text file.');
  }
  if (file.size > MANUSCRIPT_MAX_BYTES) {
    throw new UploadError('That file is larger than the 4 MB limit.');
  }
  if (file.size === 0) throw new UploadError('That file appears to be empty.');
}

/** Pull readable text out of a manuscript so we can count words and index it. */
export async function extractText(buf: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join('\n') : String(text ?? '');
    }
    if (mimeType.includes('wordprocessingml')) {
      const mammoth = (await import('mammoth')).default;
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return value;
    }
    if (mimeType.startsWith('text/') || mimeType.includes('rtf')) {
      const raw = buf.toString('utf8');
      // Strip RTF control words so the word count reflects prose, not markup.
      return mimeType.includes('rtf')
        ? raw.replace(/\\'[0-9a-f]{2}|\\[a-z]+-?\d* ?|[{}]/gi, ' ')
        : raw;
    }
  } catch (e) {
    console.error(`[extract:failed] ${mimeType}: ${(e as Error).message}`);
  }
  return '';
}

async function checksum(buf: Buffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buf));
  return Buffer.from(digest).toString('hex');
}

/** Upload bytes to R2 and register them in `files`. Returns the DB record. */
export async function storeFile(opts: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  ownerId: string;
  purpose:
    | 'manuscript'
    | 'revision'
    | 'avatar'
    | 'cover'
    | 'contract'
    | 'consent_evidence'
    | 'partner_logo'
    | 'editorial'
    | 'other';
  visibility?: 'private' | 'public';
}): Promise<StoredFile> {
  const kind = sniff(opts.buffer);
  const expectingDoc = opts.purpose === 'manuscript' || opts.purpose === 'revision';
  if (expectingDoc && !['zip', 'pdf', 'rtf', 'text'].includes(kind)) {
    throw new UploadError('That file does not look like a document. Please upload a .docx, PDF, RTF or .txt file.');
  }
  if (!expectingDoc && ['avatar', 'cover', 'partner_logo'].includes(opts.purpose) && kind !== 'image') {
    throw new UploadError('Please upload a JPEG, PNG or WebP image.');
  }

  const key = buildKey(opts.purpose, opts.ownerId, opts.originalName);
  await putObject(
    key,
    opts.buffer,
    opts.mimeType,
    opts.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, max-age=0',
  );

  const row = await queryOne<StoredFile>(
    `INSERT INTO files (storage_key, original_name, mime_type, size_bytes, checksum, owner_id, purpose, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, storage_key, original_name, mime_type, size_bytes`,
    [
      key,
      opts.originalName.slice(0, 250),
      opts.mimeType,
      opts.buffer.length,
      await checksum(opts.buffer),
      opts.ownerId,
      opts.purpose,
      opts.visibility ?? 'private',
    ],
  );
  if (!row) throw new UploadError('The file could not be registered. Please try again.');
  return row;
}

/**
 * A short-lived download link for a private file. Callers MUST have already run
 * the relevant permission check — this function deliberately does not know who
 * is asking.
 */
export async function downloadUrlForFile(fileId: string, filename?: string): Promise<string | null> {
  const row = await queryOne<{ storage_key: string; original_name: string }>(
    `SELECT storage_key, original_name FROM files WHERE id = $1`,
    [fileId],
  );
  if (!row) return null;
  return signedDownloadUrl(row.storage_key, { filename: filename ?? row.original_name, expiresIn: 300 });
}

/**
 * Remove a just-registered file after the write it belonged to failed.
 *
 * `storeFile()` commits its `files` row outside the caller's transaction (the
 * R2 PUT cannot be rolled back), so a failure downstream would otherwise leave
 * an object nothing references. Best effort: an orphan is untidy, not unsafe.
 */
export async function discardFile(fileId: string): Promise<void> {
  const row = await queryOne<{ storage_key: string }>(
    `DELETE FROM files WHERE id = $1 RETURNING storage_key`,
    [fileId],
  );
  if (row) await deleteObject(row.storage_key);
}
