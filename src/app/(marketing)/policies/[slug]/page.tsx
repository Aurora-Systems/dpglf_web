import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { policyStub } from '@/features/marketing/policies';
import { publicPage } from '@/features/marketing/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await publicPage(slug);
  const stub = policyStub(slug);
  const title = page?.title ?? stub?.title;
  if (!title) return {};
  return { title, description: page?.summary || stub?.summary };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const [page, stub] = [await publicPage(slug), policyStub(slug)];
  if (!page && !stub) notFound();

  const title = page?.title ?? stub!.title;
  const summary = page?.summary || stub?.summary;

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
      <Link href="/policies" className="text-sm text-gold-700 hover:underline">
        ← All policies
      </Link>
      <h1 className="font-display mt-8 text-4xl leading-tight font-semibold text-forest-900">{title}</h1>
      {summary && <p className="mt-4 text-lg leading-relaxed text-muted">{summary}</p>}
      <p className="mt-3 text-xs text-muted">
        {page
          ? `Version ${page.version} · last updated ${formatDate(page.updated_at)}`
          : 'Interim description, pending Foundation approval'}
      </p>
      <div className="rule-diamond my-10" aria-hidden />

      {page ? (
        <div className="prose-dpg" dangerouslySetInnerHTML={{ __html: page.body_html }} />
      ) : (
        <>
          <Alert tone="warning" title="This policy has not been formally adopted yet">
            The Foundation is finalising the approved wording with its advisers. Until then, the
            points below describe exactly what the platform does today, so you can see what you are
            agreeing to.
          </Alert>
          <ul className="prose-dpg mt-8 list-disc space-y-3 pl-5">
            {stub!.interim.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-muted">
            Questions about any of this?{' '}
            <Link href="/contact" className="text-gold-700 underline">
              Contact the Foundation
            </Link>
            .
          </p>
        </>
      )}
    </article>
  );
}
