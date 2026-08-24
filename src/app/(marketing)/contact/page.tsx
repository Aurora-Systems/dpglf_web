import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Eyebrow } from '@/components/ui';
import { SITE } from '@/lib/brand';
import { ContactForm } from '@/features/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Dr. Phillip Gwatidzo Literary Foundation.',
};

const ROUTES = [
  ['Writers and entrants', 'Questions about a competition, an entry or your submission status.'],
  ['Schools and educators', 'Bringing a writing programme to your students, or licensing archive material.'],
  ['Publishers and producers', 'Rights, adaptation and access to the intellectual property catalogue.'],
  ['Mentors and judges', 'Offering your time to the development or judging programmes.'],
  ['Funders and sponsors', 'Supporting a competition, an anthology edition or the archive.'],
  ['Media', 'Interviews, press material and Foundation announcements.'],
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <Eyebrow>Contact</Eyebrow>
      <h1 className="font-display mt-3 text-4xl font-semibold text-forest-900 sm:text-5xl">
        Talk to the Foundation
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
        Every message reaches a person. Tell us what you are trying to do and we will point you to
        the right part of the ecosystem.
      </p>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
        <Card className="p-7 sm:p-9">
          <ContactForm defaultTopic={topic ?? 'general'} />
        </Card>

        <aside className="space-y-8">
          <div>
            <h2 className="font-display text-lg font-semibold text-forest-900">What we can help with</h2>
            <dl className="mt-4 space-y-4">
              {ROUTES.map(([title, body]) => (
                <div key={title}>
                  <dt className="text-sm font-semibold text-forest-800">{title}</dt>
                  <dd className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{body}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl bg-parchment p-6">
            <h2 className="font-display text-base font-semibold text-forest-900">Safeguarding</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              If your message concerns the welfare of a young person, say so in the subject line and
              it will be escalated immediately. See the{' '}
              <Link href="/policies/child-safeguarding" className="text-gold-700 underline">
                child safeguarding policy
              </Link>
              .
            </p>
          </div>

          <div className="rounded-xl border border-line p-6">
            <h2 className="font-display text-base font-semibold text-forest-900">Foundation inbox</h2>
            <p className="mt-2 text-sm break-all text-muted">{SITE.inbox}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
