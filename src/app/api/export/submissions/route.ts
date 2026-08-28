import { audit } from '@/lib/audit';
import { requireApiRole } from '@/lib/permissions';
import { adminSubmissions } from '@/features/admin/queries';

/**
 * CSV export of the submissions register (Phase 4's "shortlist export").
 *
 * Staff-only; the download includes writer contact details, which is exactly
 * what an admin needs to run a results mail-merge — and exactly why the export
 * itself is audited.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireApiRole(['admin', 'super_admin']);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const url = new URL(req.url);
  const competitionId = url.searchParams.get('competition') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;

  const rows = await adminSubmissions({ competitionId, status, q, limit: 5000 });

  const header = [
    'reference',
    'title',
    'status',
    'writer',
    'writer_email',
    'age_band',
    'competition',
    'words',
    'submitted_at',
    'consent',
    'reviews_completed',
    'reviews_assigned',
    'average_score',
  ];
  const csv = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.reference ?? '',
        r.title,
        r.status,
        r.writer_name,
        r.writer_email,
        r.age_band ?? '',
        r.competition_name,
        r.word_count ?? '',
        r.submitted_at ?? '',
        r.consent_status ?? '',
        r.completed,
        r.assigned,
        r.average_score ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    ),
  ].join('\r\n');

  await audit({
    actorId: user.userId,
    action: 'export.submissions',
    entityType: 'system',
    metadata: { rows: rows.length, competitionId, status },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dpglf-submissions-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function escapeCsv(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
