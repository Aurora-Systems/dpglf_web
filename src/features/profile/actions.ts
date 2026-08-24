'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { slugify } from '@/lib/format';
import { profileSchema, toList } from '@/lib/validation';
import { bool, fail, invalid, ok, str, type ActionState } from '@/lib/actions';

/**
 * The writer's own profile.
 *
 * Public author fields are kept separate from account data, and the public page
 * is opt-in — a fifteen-year-old should not become searchable because they
 * entered a competition.
 */
export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.');

  const parsed = profileSchema.safeParse({
    displayName: str(form, 'displayName'),
    penName: str(form, 'penName'),
    bio: str(form, 'bio'),
    country: str(form, 'country'),
    city: str(form, 'city'),
    school: str(form, 'school'),
    languages: str(form, 'languages'),
    website: str(form, 'website'),
    achievements: str(form, 'achievements'),
    isPublic: bool(form, 'isPublic'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  // The slug is allocated once and then held, so a public author URL never
  // breaks because someone edited their display name.
  const existing = await queryOne<{ slug: string | null }>(
    `SELECT slug FROM profiles WHERE user_id = $1`,
    [user.userId],
  );
  let slug = existing?.slug ?? null;
  if (!slug) {
    const base = slugify(d.penName || d.displayName, 'writer');
    slug = base;
    for (let i = 2; i < 40; i++) {
      const clash = await queryOne(`SELECT 1 FROM profiles WHERE slug = $1`, [slug]);
      if (!clash) break;
      slug = `${base}-${i}`;
    }
  }

  await query(
    `INSERT INTO profiles (user_id, display_name, slug, pen_name, bio, country, city, school,
                           languages, website, achievements, is_public, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name, slug = COALESCE(profiles.slug, EXCLUDED.slug),
       pen_name = EXCLUDED.pen_name, bio = EXCLUDED.bio, country = EXCLUDED.country,
       city = EXCLUDED.city, school = EXCLUDED.school, languages = EXCLUDED.languages,
       website = EXCLUDED.website, achievements = EXCLUDED.achievements,
       is_public = EXCLUDED.is_public, updated_at = now()`,
    [
      user.userId,
      d.displayName,
      slug,
      d.penName || null,
      d.bio ?? '',
      d.country || null,
      d.city || null,
      d.school || null,
      toList(d.languages ?? '', 12),
      d.website || null,
      d.achievements ?? '',
      d.isPublic,
    ],
  );

  // Keep the account name in step with the display name.
  await query(`UPDATE users SET name = $2, updated_at = now() WHERE id = $1`, [user.userId, d.displayName]);

  await audit({
    actorId: user.userId,
    action: 'profile.updated',
    entityType: 'user',
    entityId: user.userId,
    metadata: { isPublic: d.isPublic },
  });

  revalidatePath('/dashboard/profile');
  if (slug) revalidatePath(`/authors/${slug}`);
  return ok(
    d.isPublic
      ? `Saved. Your public page is at /authors/${slug}.`
      : 'Saved. Your profile is private — only the Foundation can see it.',
  );
}
