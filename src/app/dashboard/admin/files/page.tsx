import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonAnchor, EmptyState, FilterChip, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatBytes, formatDateTime } from '@/lib/format';
import { adminFileCounts, adminFiles } from '@/features/admin/queries';

/** Every purpose a file can be registered under (files.purpose), in reading order. */
const PURPOSES: { key: string; label: string; one: string }[] = [
  { key: 'manuscript', label: 'Manuscripts', one: 'Manuscript' },
  { key: 'revision', label: 'Revisions', one: 'Revision' },
  { key: 'editorial', label: 'Editorial', one: 'Editorial' },
  { key: 'cover', label: 'Covers', one: 'Cover' },
  { key: 'avatar', label: 'Profile pictures', one: 'Profile picture' },
  { key: 'partner_logo', label: 'Partner logos', one: 'Partner logo' },
  { key: 'contract', label: 'Contracts', one: 'Contract' },
  { key: 'consent_evidence', label: 'Consent evidence', one: 'Consent evidence' },
  { key: 'other', label: 'Other', one: 'Other' },
];

/** "Word document" rather than application/vnd.openxmlformats-officedocument.wordprocessingml.document. */
function fileKind(mime: string): string {
  if (mime.includes('wordprocessingml') || mime === 'application/msword') return 'Word document';
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'application/rtf' || mime === 'text/rtf') return 'Rich text';
  if (mime === 'text/plain') return 'Plain text';
  if (mime.startsWith('image/')) return `${mime.slice(6).toUpperCase()} image`;
  return mime;
}

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string }>;
}) {
  await requireStaff('/dashboard/admin/files');
  const { purpose: asked } = await searchParams;
  const selected = PURPOSES.find((p) => p.key === asked);
  const [files, counts] = await Promise.all([adminFiles(selected?.key), adminFileCounts()]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const shownTotal = selected ? (counts[selected.key] ?? 0) : total;
  // Only purposes that hold something, so the filter is not a wall of zeros.
  const filters = PURPOSES.filter((p) => (counts[p.key] ?? 0) > 0 || p.key === selected?.key);

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="File library"
        lead="Every file the platform stores: manuscripts, revisions, pictures and evidence. Downloads are permission checked and recorded."
      />

      <nav aria-label="Show files by purpose" className="mb-6 flex flex-wrap gap-2">
        <FilterChip href="/dashboard/admin/files" current={!selected} label="All files" count={total} />
        {filters.map((p) => (
          <FilterChip
            key={p.key}
            href={`/dashboard/admin/files?purpose=${p.key}`}
            current={selected?.key === p.key}
            label={p.label}
            count={counts[p.key] ?? 0}
          />
        ))}
      </nav>

      <Panel
        title={selected ? selected.label : 'All files'}
        description={
          shownTotal > files.length
            ? `The latest ${files.length} of ${shownTotal} files.`
            : `${files.length} ${files.length === 1 ? 'file' : 'files'}, newest first.`
        }
      >
        {files.length === 0 ? (
          <EmptyState title={selected ? `No ${selected.label.toLowerCase()} yet` : 'No files yet'}>
            Files appear here as people upload manuscripts, covers and evidence.
          </EmptyState>
        ) : (
          // Below xl (phones, tablets, small laptops with the menu beside) there is
          // no room for five columns: the file's details stack under its name, next
          // to Download. Wide screens get the full table.
          <Table min="min-w-0 xl:min-w-[44rem]">
            <thead>
              <tr>
                <Th>File</Th>
                <Th className="hidden xl:table-cell">Purpose</Th>
                <Th className="hidden xl:table-cell">Belongs to</Th>
                <Th className="hidden xl:table-cell">Owner</Th>
                <Th className="hidden xl:table-cell">Uploaded</Th>
                <Th>
                  <span className="sr-only">Download</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const purpose = PURPOSES.find((p) => p.key === f.purpose)?.one ?? f.purpose.replace('_', ' ');
                const badges = (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{purpose}</Badge>
                    {f.visibility === 'public' && <Badge tone="gold">Public</Badge>}
                  </div>
                );
                return (
                  <tr key={f.id}>
                    <Td>
                      <p
                        className="font-medium text-forest-900 wrap-anywhere xl:max-w-56 xl:truncate"
                        title={f.original_name}
                      >
                        {f.original_name}
                      </p>
                      <p className="text-xs text-muted" title={f.mime_type}>
                        {fileKind(f.mime_type)} · {formatBytes(f.size_bytes)}
                      </p>
                      <div className="mt-2 space-y-1.5 xl:hidden">
                        {badges}
                        <p className="text-xs text-muted wrap-anywhere">{f.linked_to ?? 'Not linked'}</p>
                        <p className="text-xs text-muted">
                          {f.owner_name ?? 'Unknown owner'} · {formatDateTime(f.created_at)}
                        </p>
                      </div>
                    </Td>
                    <Td className="hidden xl:table-cell">{badges}</Td>
                    <Td className="hidden text-xs text-muted xl:table-cell">
                      <p className="line-clamp-2 max-w-64" title={f.linked_to ?? undefined}>
                        {f.linked_to ?? 'Not linked'}
                      </p>
                    </Td>
                    <Td className="hidden text-xs text-muted xl:table-cell">{f.owner_name ?? 'Unknown'}</Td>
                    <Td className="hidden text-xs whitespace-nowrap text-muted xl:table-cell">
                      {formatDateTime(f.created_at)}
                    </Td>
                    <Td className="text-right">
                      <ButtonAnchor href={`/api/files/${f.id}`} variant="outline" size="sm" className="min-h-10 sm:min-h-0">
                        Download
                      </ButtonAnchor>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
