import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Card, Panel } from '@/components/ui';
import { requireUser } from '@/lib/permissions';
import { queryOne } from '@/lib/db';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { ResendVerification } from '@/features/auth/ResetForms';

export default async function ProfilePage() {
  const user = await requireUser('/dashboard/profile');

  const profile = await queryOne<{
    display_name: string;
    slug: string | null;
    pen_name: string | null;
    bio: string;
    country: string | null;
    city: string | null;
    school: string | null;
    languages: string[];
    website: string | null;
    achievements: string;
    is_public: boolean;
    age_band: string | null;
    email_verified_at: string | null;
  }>(
    `SELECT p.display_name, p.slug, p.pen_name, p.bio, p.country, p.city, p.school, p.languages,
            p.website, p.achievements, p.is_public, p.age_band, u.email_verified_at
       FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1`,
    [user.userId],
  ).catch(() => null);

  return (
    <>
      <PageHeader
        title="My profile"
        lead="Your public author page is separate from your account. Nothing here is published until you choose to make it public."
      />

      <div className="space-y-6">
        {!profile?.email_verified_at && (
          <Alert tone="warning" title="Confirm your email address">
            <p>Submissions cannot be finalised until {user.email} is confirmed.</p>
            <div className="mt-3">
              <ResendVerification />
            </div>
          </Alert>
        )}

        <Panel title="Author profile">
          <ProfileForm
            profile={{
              displayName: profile?.display_name ?? user.name,
              penName: profile?.pen_name ?? '',
              bio: profile?.bio ?? '',
              country: profile?.country ?? '',
              city: profile?.city ?? '',
              school: profile?.school ?? '',
              languages: (profile?.languages ?? []).join(', '),
              website: profile?.website ?? '',
              achievements: profile?.achievements ?? '',
              isPublic: profile?.is_public ?? false,
              slug: profile?.slug ?? null,
            }}
          />
        </Panel>

        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-forest-900">Account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="text-forest-900">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Age group</dt>
              <dd className="text-forest-900">{profile?.age_band?.replace(/_/g, '–') ?? 'Not recorded'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Roles</dt>
              <dd className="text-forest-900">{user.roles.join(', ') || 'None'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] text-muted">
            To change your email address or have your data removed, contact the Foundation.
          </p>
        </Card>
      </div>
    </>
  );
}
