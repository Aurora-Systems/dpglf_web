import type { Role } from './roles';

/**
 * The session claim shape, in its own module with no runtime dependencies.
 *
 * `auth.ts` reaches for `next/headers`, so anything importing it is pinned to
 * the server. Client components legitimately need the *type* (and the pure
 * predicates in `access.ts`), and importing it from here keeps that free.
 */
export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  roles: Role[];
}
