import { neon, neonConfig, Pool, type NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Neon Postgres access.
 *
 * Two transports, per Neon's own guidance:
 *
 *  - `query`/`queryOne` go over **HTTP** (`neon()`). One-shot, stateless, no
 *    connection setup — the right fit for serverless request handlers, and the
 *    only transport that also works unchanged on Cloudflare Workers if the
 *    Foundation later moves off Node hosting.
 *  - `tx()` opens a real **WebSocket** session, which is the only way to get an
 *    interactive BEGIN/…/COMMIT where later statements depend on earlier
 *    results. Used sparingly: submission finalisation, judging locks,
 *    publication approval — anything that must be all-or-nothing.
 */

function connectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. Add the Neon connection string to .env.local (see README).',
    );
  }
  return raw;
}

const globalForDb = globalThis as unknown as {
  _neonSql?: NeonQueryFunction<false, false>;
  _neonPool?: Pool;
};

function http(): NeonQueryFunction<false, false> {
  return (globalForDb._neonSql ??= neon(connectionString()));
}

function pool(): Pool {
  if (!globalForDb._neonPool) {
    // Node 22+ and Workers expose a standards-compliant global WebSocket (Node
    // 20 does not, unflagged); the driver leaves this unset by default.
    if (!neonConfig.webSocketConstructor) {
      if (typeof globalThis.WebSocket === 'undefined') {
        throw new Error(
          'No global WebSocket: database transactions need Node 22 or later (check NODE_VERSION).',
        );
      }
      neonConfig.webSocketConstructor = globalThis.WebSocket as never;
    }
    globalForDb._neonPool = new Pool({ connectionString: connectionString(), max: 5 });
  }
  return globalForDb._neonPool;
}

export type Row = Record<string, unknown>;

/** Run a parameterised statement and return its rows. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await http().query(text, params as never[]);
  return rows as T[];
}

/** Convenience: first row or null. */
export async function queryOne<T = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** A query fn bound to one transaction's connection. */
export type TxQuery = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;

/**
 * Run `fn` inside a single BEGIN/COMMIT on one connection, rolling back on any
 * thrown error. The bare `query()` helper is autocommit-per-statement and gives
 * no atomicity, so multi-statement state changes must go through here.
 */
export async function tx<T>(fn: (q: TxQuery) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  const q: TxQuery = async (text, params = []) =>
    (await client.query(text, params as never[])).rows as never[];
  try {
    await client.query('BEGIN');
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken — nothing to roll back onto */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** True when a database is configured at all — lets pages degrade instead of 500. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
