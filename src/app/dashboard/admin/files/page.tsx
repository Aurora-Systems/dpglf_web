import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonAnchor, Card, EmptyState, Panel, Table, Td, Th, cx } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatBytes, formatDateTime } from '@/lib/format';
import { adminFiles } from '@/features/admin/queries';

const PURPOSES = [
  'manuscript',
  'revision',
  'cover',
  'avatar',
  'contract',
  'consent_evidence',
  'partner_logo',
  'editorial',
  'other',
];

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string }>;
}) {
  await requireStaff('/dashboard/admin/files');
  const { purpose } = await searchParams;
  const files = await adminFiles(purpose);

  return (
    <>
      <PageHeader
        title="File library"
        lead="Every object registered in R2: manuscripts, revisions, covers and evidence. Downloads go through the permission-checked file gate and are audited."
      />

      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-wrap gap-2 sm:gap-1.5">
            <Link
              href="/dashboard/admin/files"
              className={cx(
                'rounded-md px-3 py-1.5 text-[13px] sm:px-2.5 sm:py-1',
                !purpose ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
              )}
            >
              All
            </Link>
            {PURPOSES.map((p) => (
              <Link
                key={p}
                href={`/dashboard/admin/files?purpose=${p}`}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[13px] sm:px-2.5 sm:py-1',
                  purpose === p ? 'bg-forest-900 text-bone' : 'text-muted hover:bg-forest-900/8',
                )}
              >
                {p.replace('_', ' ')}
              </Link>
            ))}
          </div>
        </Card>

        <Panel title={`${files.length} file${files.length === 1 ? '' : 's'}`}>
          {files.length === 0 ? (
            <EmptyState title="No files match" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>Purpose</Th>
                  <Th>Belongs to</Th>
                  <Th>Owner</Th>
                  <Th>Uploaded</Th>
                  <Th className="sticky right-0 bg-white pl-3 after:absolute after:inset-y-0 after:left-full after:w-5 after:bg-white" />
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <Td>
                      <p className="max-w-56 truncate font-medium text-forest-900">{f.original_name}</p>
                      <p className="text-xs text-muted [overflow-wrap:anywhere]">
                        {f.mime_type} · {formatBytes(f.size_bytes)}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={f.visibility === 'public' ? 'gold' : 'neutral'}>
                        {f.purpose.replace('_', ' ')}
                        {f.visibility === 'public' ? ' · public' : ''}
                      </Badge>
                    </Td>
                    <Td className="max-w-52 truncate text-xs text-muted">{f.linked_to ?? 'Unlinked'}</Td>
                    <Td className="text-xs text-muted">{f.owner_name ?? 'Unknown'}</Td>
                    <Td className="text-xs whitespace-nowrap text-muted">{formatDateTime(f.created_at)}</Td>
                    <Td className="sticky right-0 bg-white pl-3 after:absolute after:inset-y-0 after:left-full after:w-5 after:bg-white">
                      <ButtonAnchor href={`/api/files/${f.id}`} variant="outline" size="sm">
                        Download
                      </ButtonAnchor>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
