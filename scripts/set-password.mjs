#!/usr/bin/env node
/**
 * Set an existing account's password from the terminal, for when the emailed
 * reset link is not an option (email not set up yet, or a locked-out
 * administrator). The password is typed at a hidden prompt, so it never lands
 * in shell history. Signs the account out everywhere, as a reset does.
 *
 *   pnpm user:password "admin@example.org"
 */
import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { neonConfig, Pool } from '@neondatabase/serverless';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = /^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ambient env only */
  }
}
loadEnv('.env.local');

const [, , email] = process.argv;
const url = process.env.DATABASE_URL;
if (!email) {
  console.error('Usage: pnpm user:password "person@example.org"');
  process.exit(1);
}
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

/** Must match src/lib/crypto.ts exactly, or the account cannot sign in. */
async function hashPassword(password) {
  const iterations = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  const b64 = (b) => Buffer.from(b).toString('base64');
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

/** Reads one line without echoing it. Ctrl+C aborts. */
function askHidden(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error('Run this in a terminal so the password can be typed privately.');
  return new Promise((resolve) => {
    let value = '';
    const finish = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      resolve(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdout.write('\nCancelled. Nothing was changed.\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdout.write(prompt);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}
const pool = new Pool({ connectionString: url, max: 1 });

async function main() {
  const {
    rows: [user],
  } = await pool.query(
    `SELECT u.id, u.status, coalesce(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
       FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE lower(u.email) = lower($1) GROUP BY u.id`,
    [email],
  );
  if (!user) throw new Error(`No account uses ${email}.`);
  if (user.status !== 'active') throw new Error(`That account is ${user.status}, so it cannot sign in.`);
  console.log(`Setting the password for ${email} (${user.roles.join(', ') || 'no roles'}).`);

  const password = await askHidden('New password (at least 10 characters): ');
  if (password.length < 10) throw new Error('Use at least 10 characters. Nothing was changed.');
  if (password.length > 200) throw new Error('That password is too long. Nothing was changed.');
  if ((await askHidden('Type it again: ')) !== password) throw new Error('The two did not match. Nothing was changed.');

  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [user.id]);
    await client.query(
      `UPDATE users SET password_hash = $2, email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
        WHERE id = $1`,
      [user.id, hash],
    );
    // As lib/auth.ts revokeAllRefreshTokens: every existing session ends.
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()), rotated_at = NULL
        WHERE user_id = $1 AND (revoked_at IS NULL OR rotated_at IS NOT NULL)`,
      [user.id],
    );
    await client.query(
      `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata)
       VALUES (NULL, 'user.password_set', 'user', $1, '{"via":"cli"}')`,
      [user.id],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log('Password set. Any existing sessions for this account have been signed out.');
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
