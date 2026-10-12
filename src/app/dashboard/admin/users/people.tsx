import { Badge } from '@/components/ui';
import { ROLE_LABELS, type Role } from '@/lib/roles';

/** Administrator roles first, then the programme roles, so staff stand out in a list. */
const ROLE_ORDER: Role[] = ['super_admin', 'admin', 'editor', 'judge', 'mentor', 'partner', 'writer'];

export function RoleBadges({ roles }: { roles: Role[] }) {
  if (roles.length === 0) return <span className="text-[13px] text-muted">No roles</span>;
  const sorted = [...roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  return (
    <>
      {sorted.map((r) => (
        <Badge key={r} tone={r === 'admin' || r === 'super_admin' ? 'gold' : 'neutral'}>
          {ROLE_LABELS[r] ?? r}
        </Badge>
      ))}
    </>
  );
}

/** Only what needs attention: a suspended (or deleted) account, an unconfirmed email. */
export function StatusFlags({ status, verified }: { status: string; verified: boolean }) {
  return (
    <>
      {status !== 'active' && <Badge tone="bad">{status === 'suspended' ? 'Suspended' : 'Deleted'}</Badge>}
      {!verified && <Badge tone="progress">Email unverified</Badge>}
    </>
  );
}
