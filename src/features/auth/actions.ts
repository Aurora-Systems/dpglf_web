'use server';

import { redirect } from 'next/navigation';
import {
  clearSessionCookies,
  clientIp,
  getSessionUser,
  revokeAllRefreshTokens,
  startSession,
} from '@/lib/auth';
import { audit } from '@/lib/audit';
import { query, queryOne, tx } from '@/lib/db';
import { hashPassword, needsRehash, randomToken, sha256Hex, verifyPassword } from '@/lib/crypto';
import { abs, templates } from '@/lib/email';
import { notify } from '@/lib/notify';
import { rateLimit, rateLimitIp } from '@/lib/ratelimit';
import { slugify } from '@/lib/format';
import {
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/validation';
import { fail, invalid, ok, str, type ActionState } from '@/lib/actions';

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

/** A safe post-login destination: same-origin path only, never an open redirect. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

async function issueEmailToken(userId: string, kind: 'verify' | 'reset', hours: number): Promise<string> {
  const raw = randomToken(24);
  await query(
    `INSERT INTO email_tokens (user_id, kind, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4::text || ' hours')::interval)`,
    [userId, kind, await sha256Hex(raw), String(hours)],
  );
  return raw;
}

// ---- sign up -------------------------------------------------------------------

export async function signupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const limit = await rateLimitIp('signup');
  if (!limit.ok) return fail('Too many sign-ups from this connection. Please try again later.');

  const parsed = signupSchema.safeParse({
    name: str(form, 'name'),
    email: str(form, 'email'),
    password: str(form, 'password'),
    ageBand: str(form, 'ageBand'),
    country: str(form, 'country'),
    acceptTerms: form.get('acceptTerms') === 'on',
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const existing = await queryOne<{ id: string }>(`SELECT id FROM users WHERE lower(email) = lower($1)`, [
    d.email,
  ]);
  if (existing) {
    return fail('An account already exists with that email address. Try signing in instead.', {
      email: 'This email is already registered',
    });
  }

  const passwordHash = await hashPassword(d.password);
  const userId = await tx(async (q) => {
    const [user] = await q<{ id: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [d.email, d.name, passwordHash],
    );
    await q(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'writer')`, [user.id]);
    // A public author slug is reserved now so it stays stable if the writer
    // later opts into a public profile.
    await q(
      `INSERT INTO profiles (user_id, display_name, slug, age_band, country)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, d.name, `${slugify(d.name, 'writer')}-${user.id.slice(0, 6)}`, d.ageBand, d.country ?? ''],
    );
    return user.id;
  });

  const token = await issueEmailToken(userId, 'verify', VERIFY_TTL_HOURS);
  const t = templates.verifyEmail(d.name, abs(`/verify-email?token=${token}`));
  await notify({
    userId,
    toEmail: d.email,
    type: 'verify_email',
    subject: t.subject,
    html: t.html,
    dedupeKey: `verify:${userId}:${token.slice(0, 8)}`,
  });

  await audit({ actorId: userId, action: 'user.signup', entityType: 'user', entityId: userId });
  await startSession(userId, 'web');
  redirect('/dashboard?welcome=1');
}

// ---- sign in ---------------------------------------------------------------------

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = str(form, 'email').toLowerCase();
  const ipLimit = await rateLimitIp('login');
  const emailLimit = await rateLimit('login', `email:${email}`);
  if (!ipLimit.ok || !emailLimit.ok) {
    return fail('Too many sign-in attempts. Please wait a few minutes and try again.');
  }

  const parsed = loginSchema.safeParse({
    email,
    password: str(form, 'password'),
    next: str(form, 'next'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const user = await queryOne<{ id: string; password_hash: string | null; status: string }>(
    `SELECT id, password_hash, status FROM users WHERE lower(email) = lower($1)`,
    [parsed.data.email],
  );

  // One message for "no such account" and "wrong password" — anything else
  // turns the sign-in form into an account-existence oracle.
  const genericFailure = fail('That email and password do not match an account.');
  if (!user) return genericFailure;
  if (!(await verifyPassword(parsed.data.password, user.password_hash))) return genericFailure;
  if (user.status !== 'active') {
    return fail('This account has been suspended. Please contact the Foundation.');
  }

  // Transparently upgrade hashes made with an older cost factor.
  if (needsRehash(user.password_hash)) {
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
      user.id,
      await hashPassword(parsed.data.password),
    ]);
  }

  await startSession(user.id, 'web');
  await audit({ actorId: user.id, action: 'user.login', entityType: 'user', entityId: user.id });
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user) await revokeAllRefreshTokens(user.userId);
  await clearSessionCookies();
  redirect('/');
}

// ---- email verification ------------------------------------------------------------

export async function verifyEmailToken(token: string): Promise<'verified' | 'already' | 'invalid'> {
  const rows = await query<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND kind = 'verify' AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [await sha256Hex(token)],
  );
  if (rows.length === 0) return 'invalid';

  const updated = await query<{ id: string }>(
    `UPDATE users SET email_verified_at = now()
      WHERE id = $1 AND email_verified_at IS NULL RETURNING id`,
    [rows[0].user_id],
  );
  await audit({
    actorId: rows[0].user_id,
    action: 'user.email_verified',
    entityType: 'user',
    entityId: rows[0].user_id,
  });
  return updated.length > 0 ? 'verified' : 'already';
}

export async function resendVerificationAction(): Promise<ActionState> {
  const session = await getSessionUser();
  if (!session) return fail('Please sign in first.');
  const limit = await rateLimit('passwordReset', `verify:${session.userId}`);
  if (!limit.ok) return fail('A verification email was sent recently. Please check your inbox.');

  const user = await queryOne<{ email: string; name: string; email_verified_at: string | null }>(
    `SELECT email, name, email_verified_at FROM users WHERE id = $1`,
    [session.userId],
  );
  if (!user) return fail('Account not found.');
  if (user.email_verified_at) return ok('Your email address is already confirmed.');

  const token = await issueEmailToken(session.userId, 'verify', VERIFY_TTL_HOURS);
  const t = templates.verifyEmail(user.name, abs(`/verify-email?token=${token}`));
  await notify({
    userId: session.userId,
    toEmail: user.email,
    type: 'verify_email',
    subject: t.subject,
    html: t.html,
    dedupeKey: `verify:${session.userId}:${token.slice(0, 8)}`,
  });
  return ok('Verification email sent. Please check your inbox.');
}

// ---- password reset --------------------------------------------------------------------

export async function requestResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const limit = await rateLimitIp('passwordReset');
  if (!limit.ok) return fail('Too many requests. Please try again later.');

  const parsed = requestResetSchema.safeParse({ email: str(form, 'email') });
  if (!parsed.success) return invalid(parsed.error);

  const user = await queryOne<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM users WHERE lower(email) = lower($1) AND status = 'active'`,
    [parsed.data.email],
  );

  if (user) {
    const token = await issueEmailToken(user.id, 'reset', RESET_TTL_HOURS);
    const t = templates.resetPassword(user.name, abs(`/reset-password?token=${token}`));
    await notify({
      userId: user.id,
      toEmail: user.email,
      type: 'password_reset',
      subject: t.subject,
      html: t.html,
      dedupeKey: `reset:${user.id}:${token.slice(0, 8)}`,
    });
  }

  // Always the same answer, whether or not the address is registered.
  return ok('If that address has an account, a reset link is on its way.');
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: str(form, 'token'),
    password: str(form, 'password'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const claimed = await query<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND kind = 'reset' AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [await sha256Hex(parsed.data.token)],
  );
  if (claimed.length === 0) {
    return fail('That reset link has expired or has already been used. Please request a new one.');
  }

  const userId = claimed[0].user_id;
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
    userId,
    await hashPassword(parsed.data.password),
  ]);
  // A password change invalidates every existing session on every device.
  await revokeAllRefreshTokens(userId);
  await audit({
    actorId: userId,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: userId,
    metadata: { ip: await clientIp() },
  });

  await startSession(userId, 'web');
  redirect('/dashboard?reset=1');
}
