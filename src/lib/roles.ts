export const ROLES = [
  'writer',
  'mentor',
  'editor',
  'judge',
  'partner',
  'admin',
  'super_admin',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  writer: 'Writer',
  mentor: 'Mentor',
  editor: 'Editor',
  judge: 'Judge',
  partner: 'Partner',
  admin: 'Programme admin',
  super_admin: 'Super admin',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  writer: 'Submits stories, tracks status, receives feedback and manages consent.',
  mentor: 'Guides assigned writers through revisions, feedback and milestones.',
  editor: 'Prepares selected stories for publication and maintains story records.',
  judge: 'Scores assigned submissions against the competition rubric.',
  partner: 'Publisher, producer or researcher browsing permitted archive content.',
  admin: 'Runs competitions, assignments, publication and the archive.',
  super_admin: 'Manages users, roles, policies, settings and audit access.',
};

/** Roles that reach the staff console. */
export const STAFF_ROLES: Role[] = ['admin', 'super_admin'];

/** Roles that grant a dashboard of their own, in the order we route people to. */
export const DASHBOARD_ORDER: Role[] = ['super_admin', 'admin', 'editor', 'mentor', 'judge', 'writer'];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
