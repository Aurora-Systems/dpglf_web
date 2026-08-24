import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, Card, EmptyState, Panel, buttonClass } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, relativeTime } from '@/lib/format';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { adminUsers } from '@/features/admin/queries';
import { RolesForm } from '@/features/admin/Forms';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff('/dashboard/admin/users');
  const { q } = await searchParams;
  const users = await adminUsers(q);

  return (
    <>
      <PageHeader
        title="People & roles"
        lead="Roles are additive — one person can judge, mentor and write. Changes take effect when they next sign in or refresh."
      />

      <div className="space-y-6">
        <Card className="p-5">
          <form action="/dashboard/admin/users" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="q" className="block text-sm font-medium text-forest-900">
                Search people
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q ?? ''}
                placeholder="Name or email"
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
              />
            </div>
            <button type="submit" className={buttonClass('outline', 'md')}>
              Search
            </button>
          </form>
        </Card>

        {users.length === 0 ? (
          <EmptyState title="Nobody matches that search" />
        ) : (
          <Panel title={`${users.length} account${users.length === 1 ? '' : 's'}`}>
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_1.2fr]">
                  <div>
                    <p className="font-medium text-forest-900">{u.name || 'No name'}</p>
                    <p className="text-sm text-muted">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {u.status !== 'active' && <Badge tone="bad">{u.status}</Badge>}
                      {!u.email_verified_at && <Badge tone="bad">Email unverified</Badge>}
                      {(u.roles ?? []).map((r) => (
                        <Badge key={r} tone="gold">
                          {ROLE_LABELS[r as Role] ?? r}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Joined {formatDate(u.created_at)}
                      {u.last_login_at && ` · last seen ${relativeTime(u.last_login_at)}`}
                      {u.submissions > 0 && ` · ${u.submissions} submission${u.submissions === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-parchment p-4">
                    <RolesForm userId={u.id} roles={(u.roles ?? []) as Role[]} status={u.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
