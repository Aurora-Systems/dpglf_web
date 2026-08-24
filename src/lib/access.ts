import type { SessionUser } from './session';
import { STAFF_ROLES, type Role } from './roles';

/**
 * Pure authorisation predicates — no database, no request context, no imports
 * that pin them to the server. Both the server guards in `permissions.ts` and
 * client components that need to decide what to render call these, so the two
 * can never drift apart.
 */

export type Visibility = 'private' | 'internal' | 'partner' | 'public_excerpt' | 'public_full';

export function hasRole(user: SessionUser | null, ...roles: Role[]): boolean {
  if (!user) return false;
  return roles.some((r) => user.roles.includes(r));
}

export function isStaff(user: SessionUser | null): boolean {
  return hasRole(user, ...STAFF_ROLES);
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return hasRole(user, 'super_admin');
}

/**
 * A submission is editable only while it is a draft and the competition is
 * open — unless an admin has explicitly reopened it for this writer.
 */
export function canEditSubmission(
  status: string,
  closesAt: string | Date | null,
  reopenedUntil: string | Date | null,
): boolean {
  if (reopenedUntil && new Date(reopenedUntil) > new Date()) return true;
  if (status !== 'DRAFT') return false;
  if (!closesAt) return true;
  return new Date(closesAt) > new Date();
}

/**
 * Which archive visibility levels a viewer may see. Publication status is
 * deliberately not consulted: a story can be published in print and still be
 * metadata-only in the public archive, and the reverse.
 */
export function visibleLevels(user: SessionUser | null): Visibility[] {
  if (isStaff(user) || hasRole(user, 'editor')) {
    return ['private', 'internal', 'partner', 'public_excerpt', 'public_full'];
  }
  if (hasRole(user, 'partner')) return ['partner', 'public_excerpt', 'public_full'];
  return ['public_excerpt', 'public_full'];
}

/** Whether the viewer may read the full story text rather than an excerpt. */
export function canReadFullText(user: SessionUser | null, visibility: Visibility): boolean {
  if (isStaff(user) || hasRole(user, 'editor')) return true;
  if (visibility === 'public_full') return true;
  if (visibility === 'partner') return hasRole(user, 'partner');
  return false;
}

/** Adaptation-ready listings are for partners and staff only. */
export function canBrowseAdaptationCatalogue(user: SessionUser | null): boolean {
  return isStaff(user) || hasRole(user, 'partner', 'editor');
}
