import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { query, queryOne, tx } from './db';
import { randomToken, sha256Hex } from './crypto';
import type { Role } from './roles';
import type { SessionUser } from './session';

export type { SessionUser };

// A missing AUTH_SECRET in production means every token is signed with a public
// constant — anyone could mint a super-admin session. Fail fast at boot.
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('AUTH_SECRET must be set in production');
}
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-insecure-secret');
const ACCESS_TTL = Number(process.env.ACCESS_TTL ?? 900); // 15 minutes
const REFRESH_TTL = Number(process.env.REFRESH_TTL ?? 2_592_000); // 30 days

export const ACCESS_COOKIE = 'dpg_session';
export const REFRESH_COOKIE = 'dpg_refresh';
/**
 * Carries no identity and grants nothing — it only lets the client tell a
 * signed-in visitor from an anonymous one without a round trip. Deliberately
 * not httpOnly; tracks the refresh lifetime so it never outlives its session.
 */
export const AUTH_HINT_COOKIE = 'dpg_auth';

// ---- JWT --------------------------------------------------------------------

export async function signAccessToken(u: SessionUser): Promise<string> {
  return new SignJWT({ email: u.email, name: u.name, roles: u.roles })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      userId: String(payload.sub),
      email: (payload.email as string) ?? '',
      name: (payload.name as string) ?? '',
      roles: Array.isArray(payload.roles) ? (payload.roles as Role[]) : [],
    };
  } catch {
    return null;
  }
}

// ---- refresh tokens (opaque, hashed at rest) ---------------------------------

export async function issueRefreshToken(userId: string, deviceInfo = ''): Promise<string> {
  const raw = randomToken(32);
  const expires = new Date(Date.now() + REFRESH_TTL * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info)
     VALUES ($1, $2, $3, $4)`,
    [userId, await sha256Hex(raw), expires.toISOString(), deviceInfo],
  );
  return raw;
}

/** How long a just-rotated refresh token still vouches for its user. */
const ROTATION_GRACE_SECONDS = 30;

/**
 * Spend a refresh token and issue its successor.
 *
 * A token is spent once: the first request to present it marks it rotated.
 *
 * Grace window: a page fires several requests at once (navigation, prefetches,
 * a form post), they can all carry the same expired access token, and only one
 * wins the rotation. For a short while after that win the spent token still
 * proves who the user is, and the losers get their own successor too. Whichever
 * response the browser keeps, its refresh cookie is live; without this, a
 * winning response the browser aborted (a second click, a cancelled prefetch)
 * would strand the user on a spent token. Logout clears `rotated_at`, closing
 * the window, so signing out still signs out.
 */
export async function rotateRefreshToken(
  raw: string,
): Promise<{ userId: string; newRaw: string } | null> {
  const hash = await sha256Hex(raw);
  const newRaw = randomToken(32);
  const newHash = await sha256Hex(newRaw);
  const expires = new Date(Date.now() + REFRESH_TTL * 1000).toISOString();

  // One transaction, holding the user row, the same row revokeAllRefreshTokens
  // (logout, password reset, suspension) locks FOR UPDATE; KEY SHARE conflicts
  // with that and nothing else, so ordinary writes to users are not blocked.
  // Either the revoke goes first, and the re-check finds the window closed; or
  // this commits first, and the revoke then sees and revokes the successor.
  // Spending the token inside the transaction means a failure (a dropped
  // WebSocket, say) rolls the spend back instead of burning the credential.
  const userId = await tx(async (q) => {
    // A suspended account cannot refresh; combined with the 15-minute access
    // TTL that logs them out shortly after the suspension lands.
    const [owner] = await q<{ id: string }>(
      `SELECT u.id FROM users u
        WHERE u.id = (SELECT user_id FROM refresh_tokens WHERE token_hash = $1)
          AND u.status = 'active'
        FOR KEY SHARE`,
      [hash],
    );
    if (!owner) return null;
    // Spend the token if it is still live. A parallel request that already
    // spent it holds the row until it commits; this then updates nothing and
    // falls through to the grace check.
    await q(
      `UPDATE refresh_tokens SET revoked_at = now(), rotated_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [hash],
    );
    // A separate statement, so it reads data committed after the lock was
    // granted (a join in the locking SELECT would re-check only the user row).
    const [open] = await q(
      `SELECT 1 FROM refresh_tokens
        WHERE token_hash = $1 AND rotated_at > now() - ($2::int * interval '1 second')`,
      [hash, ROTATION_GRACE_SECONDS],
    );
    if (!open) return null;
    await q(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [
      owner.id,
      newHash,
      expires,
    ]);
    return owner.id;
  });
  return userId ? { userId, newRaw } : null;
}

/**
 * Drop refresh tokens nobody can use any more: expired, or revoked (by logout,
 * or spent by rotation) more than a day ago. Run by the maintenance cron.
 */
export async function pruneRefreshTokens(): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM refresh_tokens
      WHERE expires_at < now() - interval '1 day' OR revoked_at < now() - interval '1 day'
      RETURNING id`,
  );
  return rows.length;
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked_at = now(), rotated_at = NULL WHERE token_hash = $1`, [
    await sha256Hex(raw),
  ]);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await tx(async (q) => {
    // Serialises with rotateRefreshToken's mint (see there). The UPDATE is a
    // separate statement so it also catches a successor committed while this
    // waited for the lock.
    await q(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    // Clearing rotated_at also shuts the rotation grace window on spent tokens.
    await q(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()), rotated_at = NULL
        WHERE user_id = $1 AND (revoked_at IS NULL OR rotated_at IS NOT NULL)`,
      [userId],
    );
  });
}

// ---- cookie session ----------------------------------------------------------

export async function setSessionCookies(access: string, refresh: string): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  jar.set(ACCESS_COOKIE, access, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: ACCESS_TTL });
  jar.set(REFRESH_COOKIE, refresh, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: REFRESH_TTL });
  jar.set(AUTH_HINT_COOKIE, '1', { httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: REFRESH_TTL });
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(AUTH_HINT_COOKIE);
}

/** Load a user plus their roles, shaped for a session claim. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const row = await queryOne<{ id: string; email: string; name: string; status: string; roles: Role[] | null }>(
    `SELECT u.id, u.email, u.name, u.status,
            array_remove(array_agg(r.role), NULL) AS roles
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId],
  );
  if (!row || row.status !== 'active') return null;
  return { userId: row.id, email: row.email, name: row.name, roles: row.roles ?? [] };
}

/**
 * Resolve the current user from the session cookie, or from a Bearer token when
 * a future mobile/partner client calls the API. Returns null if unauthenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const hdrs = await headers();
  const auth = hdrs.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const u = await verifyAccessToken(auth.slice(7));
    if (u) return u;
  }
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/** Establish a fresh session for a user id (login, signup, verification). */
export async function startSession(userId: string, deviceInfo = ''): Promise<SessionUser | null> {
  const user = await loadSessionUser(userId);
  if (!user) return null;
  const access = await signAccessToken(user);
  const refresh = await issueRefreshToken(userId, deviceInfo);
  await setSessionCookies(access, refresh);
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
  return user;
}

/**
 * The caller's IP, for rate limits and consent records. Netlify's own header
 * comes first: it is set by the edge and cannot be supplied by the client. The
 * left-most X-Forwarded-For entry is whatever the client sent, so it is only a
 * fallback for hosts without such a header (and local development).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const netlify = h.get('x-nf-client-connection-ip');
  if (netlify) return netlify.trim();
  const fwd = h.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim();
}
