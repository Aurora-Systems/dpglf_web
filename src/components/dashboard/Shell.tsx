import Link from 'next/link';
import { Logo } from '@/components/site/Logo';
import { cx } from '@/components/ui';
import type { SessionUser } from '@/lib/auth';
import { initials } from '@/lib/format';
import { hasRole, isStaff } from '@/lib/permissions';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { logoutAction } from '@/features/auth/actions';

export interface NavItem {
  href: string;
  label: string;
  /** Shown only if the user holds one of these roles; omit for everyone. */
  roles?: Role[];
  staffOnly?: boolean;
  badge?: number;
}

/**
 * Dashboard chrome. The navigation is derived from the roles in the session,
 * but it is only a convenience — every page behind it independently calls the
 * permission helpers. Hiding a link is never the access control.
 */
export function DashboardShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const visible = nav.filter((item) => {
    if (item.staffOnly) return isStaff(user);
    if (item.roles) return hasRole(user, ...item.roles);
    return true;
  });

  const roleLabels = user.roles
    .filter((r) => r !== 'writer' || user.roles.length === 1)
    .map((r) => ROLE_LABELS[r])
    .join(' · ');

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-forest-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Logo tone="dark" size="sm" href="/dashboard" />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/" className="hidden text-[13px] text-bone/60 hover:text-bone sm:block">
              Foundation site
            </Link>
            <div className="flex items-center gap-2.5 border-l border-white/10 pl-3">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-gold-500 text-xs font-semibold text-forest-950"
              >
                {initials(user.name || user.email)}
              </span>
              <div className="hidden sm:block">
                <p className="text-[13px] leading-tight font-medium text-bone">{user.name || user.email}</p>
                {roleLabels && <p className="text-[11px] text-gold-400">{roleLabels}</p>}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-[13px] text-bone/60 hover:bg-white/6 hover:text-bone"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:gap-12">
        <nav aria-label="Dashboard" className="lg:w-56 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
            {visible.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap',
                    'text-forest-700 transition-colors hover:bg-forest-900/6 hover:text-forest-900',
                  )}
                >
                  {item.label}
                  {item.badge ? (
                    <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[11px] font-semibold text-forest-950">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  lead,
  action,
  back,
}: {
  title: string;
  lead?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="text-sm text-gold-700 hover:underline">
          ← {back.label}
        </Link>
      )}
      <div className={cx('flex flex-wrap items-start justify-between gap-4', back && 'mt-3')}>
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest-900">{title}</h1>
          {lead && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{lead}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
