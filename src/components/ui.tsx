import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Shared presentational primitives. Server-safe (no hooks) so they can be used
 * directly inside server components; anything needing interactivity lives in
 * `forms.tsx` behind a 'use client' boundary.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---- buttons ------------------------------------------------------------------

type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-forest-900 text-bone hover:bg-forest-700 border border-forest-900',
  gold: 'bg-gold-500 text-forest-950 hover:bg-gold-400 border border-gold-500 font-semibold',
  outline: 'border border-forest-900/25 text-forest-900 hover:border-forest-900 hover:bg-forest-900/5',
  ghost: 'text-forest-700 hover:bg-forest-900/6',
  danger: 'border border-red-700/30 text-red-800 hover:bg-red-50',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[13px] rounded-md gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-[15px] rounded-lg gap-2',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string): string {
  return cx(
    'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

// ---- surfaces -------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cx('rounded-xl border border-line bg-white', className)}
    />
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx('overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="font-display text-lg font-semibold text-forest-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

// ---- typography ---------------------------------------------------------------------

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('eyebrow text-gold-700', className)}>{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  tone = 'light',
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
}) {
  return (
    <div className={cx('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <p className={cx('eyebrow', tone === 'dark' ? 'text-gold-400' : 'text-gold-700')}>{eyebrow}</p>
      )}
      <h2
        className={cx(
          'font-display mt-3 text-3xl leading-tight font-semibold text-balance sm:text-4xl',
          tone === 'dark' ? 'text-bone' : 'text-forest-900',
        )}
      >
        {title}
      </h2>
      {lead && (
        <p className={cx('mt-4 text-[17px] leading-relaxed', tone === 'dark' ? 'text-bone/75' : 'text-muted')}>
          {lead}
        </p>
      )}
    </div>
  );
}

export function RuleDiamond({ className }: { className?: string }) {
  return <div className={cx('rule-diamond my-10', className)} aria-hidden />;
}

// ---- status ----------------------------------------------------------------------------

type Tone = 'neutral' | 'progress' | 'good' | 'bad' | 'gold';

const TONES: Record<Tone, string> = {
  neutral: 'bg-forest-900/8 text-forest-700 ring-forest-900/10',
  progress: 'bg-sky-50 text-sky-900 ring-sky-600/20',
  good: 'bg-emerald-50 text-emerald-900 ring-emerald-700/20',
  bad: 'bg-red-50 text-red-900 ring-red-700/20',
  gold: 'bg-gold-100 text-gold-700 ring-gold-500/40',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---- feedback ----------------------------------------------------------------------------

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning';
  title?: ReactNode;
  children?: ReactNode;
}) {
  const styles = {
    info: 'border-forest-900/15 bg-forest-900/4 text-forest-800',
    success: 'border-emerald-700/25 bg-emerald-50 text-emerald-900',
    error: 'border-red-700/25 bg-red-50 text-red-900',
    warning: 'border-gold-600/40 bg-gold-100/70 text-gold-700',
  }[tone];
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm', styles)} role={tone === 'error' ? 'alert' : undefined}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(Boolean(title) && 'mt-1', 'leading-relaxed')}>{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-parchment px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-forest-900">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// ---- data display --------------------------------------------------------------------------

export function Stat({ value, label, tone = 'light' }: { value: ReactNode; label: string; tone?: 'light' | 'dark' }) {
  return (
    <div>
      <div
        className={cx(
          'font-display text-3xl font-semibold sm:text-4xl',
          tone === 'dark' ? 'text-gold-400' : 'text-forest-900',
        )}
      >
        {value}
      </div>
      <div className={cx('mt-1 text-sm', tone === 'dark' ? 'text-bone/65' : 'text-muted')}>{label}</div>
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className={cx('w-full min-w-[36rem] border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        'border-b border-line pb-2 text-left text-[11px] font-semibold tracking-wider text-muted uppercase',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('border-b border-line/70 py-3 align-top', className)}>{children}</td>;
}

export function DescList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line/70">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 py-2.5 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="text-forest-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
