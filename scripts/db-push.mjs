#!/usr/bin/env node
/**
 * Apply db/schema.sql to DATABASE_URL.
 *
 * The schema is written to be idempotent (CREATE TABLE IF NOT EXISTS, CREATE OR
 * REPLACE FUNCTION, DROP TRIGGER IF EXISTS), so re-running it is the migration
 * story for now: edit schema.sql, run this, done. Introduce numbered migrations
 * once the Foundation has production data that needs transforming rather than
 * just structure that needs to exist.
 *
 *   node scripts/db-push.mjs
 */
import { readFileSync } from 'node:fs';
import { neonConfig, Pool } from '@neondatabase/serverless';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = /^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

loadEnv('.env.local');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Add it to .env.local first.');
  process.exit(1);
}

if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const sql = readFileSync('db/schema.sql', 'utf8');
const pool = new Pool({ connectionString: url, max: 1 });

try {
  const client = await pool.connect();
  try {
    // One simple-protocol call: the file is a single script with $$ bodies that
    // must not be split on semicolons.
    await client.query(sql);
    console.log('Schema applied.');

    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    console.log(`${rows[0].n} tables in public.`);
  } finally {
    client.release();
  }
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
