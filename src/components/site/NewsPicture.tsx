import { cx } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { publicUrl } from '@/lib/r2';

/**
 * A news post's picture, cropped to 16:9 so a grid of cards lines up. A post
 * without one gets the Foundation's emblem on forest green instead of a hole,
 * which keeps mixed grids even. Full width unless `className` says otherwise:
 * pass the width there (two competing width utilities resolve by stylesheet
 * order, not class order).
 */
export function NewsPicture({
  coverKey,
  alt,
  className,
}: {
  coverKey: string | null;
  alt: string;
  className?: string;
}) {
  if (coverKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
      <img
        src={publicUrl(coverKey)}
        alt={alt}
        loading="lazy"
        className={cx('aspect-[16/9] bg-forest-900/5 object-cover', className ?? 'w-full')}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cx('grid aspect-[16/9] place-items-center bg-forest-900', className ?? 'w-full')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy */}
      <img src={BRAND.markSm} alt="" className="size-14 opacity-40" />
    </div>
  );
}
