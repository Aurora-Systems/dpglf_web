import Image from 'next/image';
import Link from 'next/link';
import { BRAND, SITE } from '@/lib/brand';
import { cx } from '../ui';

/**
 * The lockup: circular leopard emblem plus a two-line wordmark. On dark grounds
 * the wordmark is bone; on parchment it is forest. The emblem itself already
 * carries its own dark disc, so it reads on either.
 */
export function Logo({
  tone = 'dark',
  size = 'md',
  href = '/',
  showWordmark = true,
}: {
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md';
  href?: string | null;
  showWordmark?: boolean;
}) {
  const px = size === 'sm' ? 34 : 44;
  const content = (
    <span className="flex items-center gap-3">
      <Image
        src={BRAND.markSm}
        alt=""
        width={px}
        height={px}
        priority
        className="shrink-0 rounded-full"
        style={{ width: px, height: px }}
      />
      {showWordmark && (
        <span className="hidden sm:block">
          <span
            className={cx(
              'font-display block leading-tight font-semibold',
              size === 'sm' ? 'text-[13px]' : 'text-[15px]',
              tone === 'dark' ? 'text-bone' : 'text-forest-900',
            )}
          >
            Dr. Phillip Gwatidzo
          </span>
          <span
            className={cx(
              'block text-[10px] tracking-[0.16em] uppercase',
              tone === 'dark' ? 'text-gold-400' : 'text-gold-700',
            )}
          >
            Literature Foundation
          </span>
        </span>
      )}
      <span className="sr-only">{SITE.name}</span>
    </span>
  );

  return href ? (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  ) : (
    content
  );
}
