import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { query, queryOne } from './db';
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

/**
 * Single-use rotation. The revoke IS the guard: only the caller whose UPDATE
 * actually flips revoked_at proceeds, so two concurrent refreshes with the same
 * token can never both succeed.
 */
export async function rotateRefreshToken(
  raw: string,
): Promise<{ userId: string; newRaw: string } | null> {
  const claimed = await query<{ user_id: string }>(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [await sha256Hex(raw)],
  );
  if (claimed.length === 0) return null;
  const userId = claimed[0].user_id;
  const u = await queryOne<{ status: string }>(`SELECT status FROM users WHERE id = $1`, [userId]);
  // A suspended account cannot refresh; combined with the 15-minute access TTL
  // that logs them out shortly after the suspension lands.
  if (!u || u.status !== 'active') return null;
  return { userId, newRaw: await issueRefreshToken(userId) };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [
    await sha256Hex(raw),
  ]);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
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

export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim();
}
