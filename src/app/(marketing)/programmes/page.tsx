import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, ButtonLink, Card, Eyebrow, EmptyState } from '@/components/ui';
import { deadlineLabel, formatNumber } from '@/lib/format';
import { openCompetitions } from '@/features/marketing/queries';

export const metadata: Metadata = {
  title: 'Programmes',
  description: 'Competitions, mentorship and publishing programmes run by the Foundation.',
};

const STATUS_TONE = {
  open: 'good',
  judging: 'progress',
  closed: 'neutral',
  completed: 'neutral',
} as const;

export default async function ProgrammesPage() {
  const competitions = await openCompetitions();

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <Eyebrow>Programmes</Eyebrow>
      <h1 className="font-display mt-3 text-4xl font-semibold text-forest-900 sm:text-5xl">
        Ways into the ecosystem
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
        Competitions are how most writers first meet the Foundation. Everything that follows
        (mentorship, editorial, publication and the archive) flows from an entry.
      </p>

      {competitions.length > 0 ? (
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {competitions.map((c) => (
            <Card key={c.id} className="relative flex flex-col p-7 transition-colors hover:border-gold-500">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-2xl font-semibold text-forest-900">
                  <Link href={`/programmes/${c.slug}`} className="before:absolute before:inset-0">
                    {c.name}
                  </Link>
                </h2>
                <Badge tone={STATUS_TONE[c.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                  {c.status === 'open' ? 'Open for entries' : c.status}
                </Badge>
              </div>
              {c.tagline && <p className="mt-3 text-[15px] leading-relaxed text-muted">{c.tagline}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs tracking-wider text-muted uppercase">Length</dt>
                  <dd className="mt-1 text-forest-900">
                    {formatNumber(c.word_min)}–{formatNumber(c.word_max)} words
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wider text-muted uppercase">Deadline</dt>
                  <dd className="mt-1 text-forest-900">{deadlineLabel(c.closes_at)}</dd>
                </div>
              </dl>
              {c.themes.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {c.themes.slice(0, 5).map((t) => (
                    <Badge key={t} tone="gold">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No competitions are open right now"
          action={<ButtonLink href="/contact">Ask to be told when entries open</ButtonLink>}
        >
          Tales from the Baobab runs annually. Subscribe to the newsletter and we will let you know
          the moment the next call for submissions goes out.
        </EmptyState>
      )}

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {[
          {
            title: 'Tales from the Baobab',
            body: 'The flagship Afrocentric short story competition for writers under eighteen.',
            href: '/programmes/tales-from-the-baobab',
          },
          {
            title: 'Perspectives',
            body: 'The annual anthology: twenty writers, one book, one campaign.',
            href: '/perspectives',
          },
          {
            title: 'From Page to Pixel',
            body: 'The adaptation pathway that evaluates stories for animation, film and television.',
            href: '/how-it-works#adapt',
          },
        ].map((item) => (
          <Card key={item.title} className="relative p-6 transition-colors hover:border-gold-500">
            <h3 className="font-display text-lg font-semibold text-forest-900">
              <Link href={item.href} className="before:absolute before:inset-0">
                {item.title}
              </Link>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
