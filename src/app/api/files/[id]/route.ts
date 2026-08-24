import { getSessionUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { queryOne } from '@/lib/db';
import { downloadUrlForFile } from '@/lib/files';
import { isStaff, hasRole, submissionAccess } from '@/lib/permissions';

/**
 * The only way a private file leaves R2.
 *
 * The caller never learns the object key: we resolve the file, decide whether
 * this user may read it, and then redirect to a signed URL that expires in five
 * minutes. Manuscripts by minors and unpublished work are exactly what this
 * gate exists for, so the default is deny.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const file = await queryOne<{
    id: string;
    owner_id: string | null;
    purpose: string;
    visibility: string;
    original_name: string;
  }>(`SELECT id, owner_id, purpose, visibility, original_name FROM files WHERE id = $1`, [id]);
  if (!file) return new Response('Not found', { status: 404 });

  const allowed = await mayRead(user, file);
  if (!allowed) return new Response('Forbidden', { status: 403 });

  const url = await downloadUrlForFile(file.id);
  if (!url) return new Response('Not found', { status: 404 });

  await audit({
    actorId: user.userId,
    action: 'file.downloaded',
    entityType: 'file',
    entityId: file.id,
    metadata: { purpose: file.purpose, name: file.original_name },
  });

  return Response.redirect(url, 302);
}

async function mayRead(
  user: { userId: string; roles: string[]; email: string; name: string },
  file: { id: string; owner_id: string | null; purpose: string; visibility: string },
): Promise<boolean> {
  if (file.visibility === 'public') return true;
  if (isStaff(user as never) || hasRole(user as never, 'editor')) return true;
  if (file.owner_id === user.userId) return true;

  // Otherwise the file must belong to a submission this user can already reach —
  // as its assigned judge or mentor.
  const link = await queryOne<{ submission_id: string }>(
    `SELECT s.id AS submission_id
       FROM submissions s
      WHERE s.file_id = $1
      UNION
     SELECT v.submission_id
       FROM story_versions v
      WHERE v.file_id = $1 AND v.submission_id IS NOT NULL
      LIMIT 1`,
    [file.id],
  );
  if (!link) return false;

  const access = await submissionAccess(user as never, link.submission_id);
  return access.readManuscript;
}
