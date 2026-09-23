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
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // A router prefetch is not a download: sign nothing and record nothing.
  if (req.headers.has('next-router-prefetch')) return new Response(null, { status: 204 });

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

  const decision = await mayRead(user, file);
  if (!decision.allowed) return new Response('Forbidden', { status: 403 });

  const url = await downloadUrlForFile(file.id, decision.filename);
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

/**
 * `filename` is set when the reader must not learn who wrote the file: a blind
 * judge gets the entry's anonymous label, because an original filename such as
 * "Chipo_Moyo_Baobab.docx" would undo the blind round.
 */
async function mayRead(
  user: { userId: string; roles: string[]; email: string; name: string },
  file: { id: string; owner_id: string | null; purpose: string; visibility: string; original_name: string },
): Promise<{ allowed: boolean; filename?: string }> {
  if (file.visibility === 'public') return { allowed: true };
  if (isStaff(user as never) || hasRole(user as never, 'editor')) return { allowed: true };
  if (file.owner_id === user.userId) return { allowed: true };

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
  if (!link) return { allowed: false };

  const access = await submissionAccess(user as never, link.submission_id);
  if (!access.readManuscript) return { allowed: false };
  if (!access.anonymised) return { allowed: true };

  const entry = await queryOne<{ anon_label: string | null }>(
    `SELECT anon_label FROM submissions WHERE id = $1`,
    [link.submission_id],
  );
  const ext = /\.[a-z0-9]{1,5}$/i.exec(file.original_name)?.[0] ?? '';
  return { allowed: true, filename: `${entry?.anon_label || 'Entry'}${ext}` };
}
