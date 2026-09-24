import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Card, Eyebrow } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { POLICY_STUBS } from '@/features/marketing/policies';
import { policyPages } from '@/features/marketing/queries';

export const metadata: Metadata = {
  title: 'Policies',
  description: 'Privacy, child safeguarding, submission rules, copyright and terms of use.',
};

export default async function PoliciesPage() {
  const published = await policyPages();
  const bySlug = new Map(published.map((p) => [p.slug, p]));

  const rows = POLICY_STUBS.map((stub) => ({
    slug: stub.slug,
    title: bySlug.get(stub.slug)?.title ?? stub.title,
    summary: bySlug.get(stub.slug)?.summary || stub.summary,
    updatedAt: bySlug.get(stub.slug)?.updated_at ?? null,
    approved: bySlug.has(stub.slug),
  }));

  const anyPending = rows.some((r) => !r.approved);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-20">
      <Eyebrow>Policies</Eyebrow>
      <h1 className="font-display mt-3 text-4xl font-semibold text-forest-900 sm:text-5xl">
        How we handle your work and your data
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        This platform holds work by young people, unpublished manuscripts and commercially sensitive
        intellectual property. These policies set out what we collect, who can see it and what
        rights you keep.
      </p>

      {anyPending && (
        <div className="mt-6">
          <Alert tone="warning" title="Some policies are awaiting Foundation approval">
            Where a policy has not yet been formally adopted, the page describes exactly what the
            platform does today. Legal wording is supplied and approved by the Foundation before
            launch.
          </Alert>
        </div>
      )}

      <ul className="mt-10 space-y-4">
        {rows.map((row) => (
          <li key={row.slug}>
            <Card className="relative p-6 transition-colors hover:border-gold-500">
              <h2 className="font-display text-xl font-semibold text-forest-900">
                <Link href={`/policies/${row.slug}`} className="before:absolute before:inset-0">
                  {row.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{row.summary}</p>
              <p className="mt-3 text-xs text-muted">
                {row.approved ? `Last updated ${formatDate(row.updatedAt)}` : 'Draft, pending Foundation approval'}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
