import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { ButtonLink, EmptyState, FilterChip, Panel, Table, Td, Th, buttonClass } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate, relativeTime } from '@/lib/format';
import type { Role } from '@/lib/roles';
import { adminUserCounts, adminUsers, type AdminUserCounts } from '@/features/admin/queries';
import { RoleBadges, StatusFlags } from './people';

/** The role chips. `staff` means anyone holding an administrator role. */
const FILTERS: { key: Exclude<keyof AdminUserCounts, 'all'>; label: string; one: string; roles: Role[] }[] = [
  { key: 'writer', label: 'Writers', one: 'writer', roles: ['writer'] },
  { key: 'judge', label: 'Judges', one: 'judge', roles: ['judge'] },
  { key: 'mentor', label: 'Mentors', one: 'mentor', roles: ['mentor'] },
  { key: 'editor', label: 'Editors', one: 'editor', roles: ['editor'] },
  { key: 'partner', label: 'Partners', one: 'partner', roles: ['partner'] },
  { key: 'staff', label: 'Staff', one: 'staff member', roles: ['admin', 'super_admin'] },
];

/** The list stops here; search to reach anyone older. Matches the LIMIT in adminUsers. */
const LIST_CAP = 300;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  await requireStaff('/dashboard/admin/users');
  const { q: rawQ, role: asked } = await searchParams;
  const q = rawQ?.trim() || undefined;
  const filter = FILTERS.find((f) => f.key === asked);
  const [users, counts] = await Promise.all([adminUsers(q, filter?.roles), adminUserCounts(q)]);

  const href = (role?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    const qs = params.toString();
    return `/dashboard/admin/users${qs ? `?${qs}` : ''}`;
  };

  const shown = filter ? counts[filter.key] : counts.all;
  const heading = filter
    ? `${shown} ${shown === 1 ? filter.one : filter.label.toLowerCase()}`
    : `${shown} ${shown === 1 ? 'person' : 'people'}`;

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="People & roles"
        lead="Everyone with an account. Open a person to change their roles or suspend their account."
      />

      <div className="mb-6 space-y-4">
        <form action="/dashboard/admin/users" role="search" className="flex flex-wrap items-end gap-3">
          {filter && <input type="hidden" name="role" value={filter.key} />}
          <div className="min-w-48 flex-1 sm:max-w-md">
            <label htmlFor="q" className="block text-sm font-medium text-forest-900">
              Search people
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Name or email"
              className="mt-1.5 min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-base focus:border-gold-500 focus:outline-none sm:text-sm"
            />
          </div>
          <button type="submit" className={buttonClass('outline', 'md')}>
            Search
          </button>
          {q && (
            <Link href={href(filter?.key)} className="inline-flex min-h-10 items-center text-sm text-gold-700 hover:underline">
              Clear search
            </Link>
          )}
        </form>

        <nav aria-label="Show people by role" className="flex flex-wrap gap-2">
          <FilterChip href={href()} current={!filter} label="All" count={counts.all} />
          {FILTERS.map((f) => (
            <FilterChip key={f.key} href={href(f.key)} current={filter?.key === f.key} label={f.label} count={counts[f.key]} />
          ))}
        </nav>
      </div>

      {users.length === 0 ? (
        <EmptyState title={q ? 'Nobody matches that search' : filter ? `No ${filter.label.toLowerCase()} yet` : 'No accounts yet'}>
          {q ? 'Search looks at names and email addresses.' : undefined}
        </EmptyState>
      ) : (
        <Panel
          title={heading}
          description={
            [q && `Matching “${q}”.`, users.length >= LIST_CAP && `Showing the newest ${LIST_CAP}. Search to find anyone else.`]
              .filter(Boolean)
              .join(' ') || 'Newest accounts first.'
          }
        >
          <Table min="min-w-0">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th className="hidden md:table-cell">Roles</Th>
                <Th className="hidden lg:table-cell">Account</Th>
                <Th className="hidden xl:table-cell">Joined</Th>
                <Th className="hidden lg:table-cell">Last seen</Th>
                <Th className="text-right">
                  <span className="sr-only">Manage</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roles = (u.roles ?? []) as Role[];
                const name = u.name || 'No name';
                const detail = `/dashboard/admin/users/${u.id}`;
                return (
                  <tr key={u.id}>
                    <Td className="min-w-0">
                      <Link href={detail} className="font-medium text-forest-900 hover:text-gold-700">
                        {name}
                      </Link>
                      <p className="text-[13px] text-muted wrap-anywhere md:wrap-break-word">{u.email}</p>
                      {/* Columns hidden on narrow screens fold in under the name. */}
                      <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
                        <span className="contents md:hidden">
                          <RoleBadges roles={roles} />
                        </span>
                        <StatusFlags status={u.status} verified={Boolean(u.email_verified_at)} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted lg:hidden">
                        Joined {formatDate(u.created_at)} ·{' '}
                        {u.last_login_at ? `last seen ${relativeTime(u.last_login_at)}` : 'never signed in'}
                      </p>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        <RoleBadges roles={roles} />
                      </div>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusFlags status={u.status} verified={Boolean(u.email_verified_at)} />
                        {u.status === 'active' && u.email_verified_at && <span className="text-[13px] text-muted">Active</span>}
                      </div>
                    </Td>
                    <Td className="hidden text-[13px] whitespace-nowrap text-muted xl:table-cell">{formatDate(u.created_at)}</Td>
                    <Td className="hidden text-[13px] whitespace-nowrap text-muted lg:table-cell">
                      {u.last_login_at ? relativeTime(u.last_login_at) : 'Never'}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={detail}
                        variant="outline"
                        size="sm"
                        className="min-h-10 sm:min-h-0"
                        aria-label={`Manage ${name}`}
                      >
                        Manage
                      </ButtonLink>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      )}
    </>
  );
}
