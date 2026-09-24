import type { ComponentProps, ReactNode } from 'react';
import { cx } from './ui';

/** Form field primitives. Server-safe: plain elements plus consistent styling. */

// 16px on phones: iOS Safari zooms the page into any field smaller than that.
const CONTROL =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base sm:text-[15px] text-ink placeholder:text-muted/60 ' +
  'focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25 focus:outline-none disabled:bg-parchment disabled:text-muted';

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-forest-900">
        {label}
        {required && <span className="ml-1 text-clay">*</span>}
      </label>
      {hint && <p className="text-[13px] leading-relaxed text-muted">{hint}</p>}
      {children}
      {error && (
        <p className="text-[13px] font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={cx(CONTROL, 'min-h-28 resize-y leading-relaxed', className)} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  // appearance-none removes the native arrow, so draw one: on a touch screen a
  // select without it looks like a filled-in text box.
  return (
    <div className="relative">
      <select {...props} className={cx(CONTROL, 'appearance-none pr-9', className)} />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
        />
      </svg>
    </div>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3', className)}>
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 size-4.5 shrink-0 rounded border-forest-900/30 text-forest-900 accent-forest-800 focus:ring-gold-500"
      />
      <span className="text-sm leading-relaxed text-forest-800">
        {label}
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Radio({
  label,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 hover:border-forest-900/30 has-checked:border-gold-500 has-checked:bg-gold-100/40',
        className,
      )}
    >
      <input type="radio" {...props} className="mt-0.5 size-4.5 shrink-0 accent-forest-800" />
      <span className="text-sm leading-relaxed text-forest-800">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Renders `{field: message}` errors that have no dedicated field on screen. */
export function FormErrors({ errors }: { errors?: Record<string, string> | null }) {
  const entries = Object.entries(errors ?? {});
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-red-700/25 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
      <p className="font-semibold">Please check the form</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {entries.map(([k, v]) => (
          <li key={k}>{v}</li>
        ))}
      </ul>
    </div>
  );
}
