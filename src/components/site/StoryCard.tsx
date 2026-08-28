import Link from 'next/link';
import { truncate } from '@/lib/format';
import { publicUrl } from '@/lib/r2';
import { Badge, cx } from '../ui';
import type { StoryCard as Story } from '@/features/marketing/queries';

export function StoryCard({ story, className }: { story: Story; className?: string }) {
  const meta = [story.country, story.language, story.genre].filter(Boolean).join(' · ');
  return (
    <article
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-gold-500',
        className,
      )}
    >
      {story.cover_key && (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy; the optimiser adds nothing here
        <img
          src={publicUrl(story.cover_key)}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col p-6">
      {meta && <p className="eyebrow text-gold-700">{meta}</p>}
      <h3 className="font-display mt-2.5 text-xl leading-snug font-semibold text-forest-900">
        <Link href={`/archive/${story.slug}`} className="before:absolute before:inset-0">
          {story.title}
        </Link>
      </h3>
      {story.author_name && (
        <p className="mt-1 text-sm text-muted">
          by <span className="text-forest-700">{story.author_name}</span>
        </p>
      )}
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{truncate(story.synopsis, 165)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {story.themes.slice(0, 3).map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
        {story.visibility === 'public_excerpt' && <Badge tone="gold">Excerpt</Badge>}
      </div>
      </div>
    </article>
  );
}
