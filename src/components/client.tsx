'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/lib/actions';
import { Alert, buttonClass, cx } from './ui';

/** Interactive bits. Everything else in the app stays a server component. */

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ComponentProps<'button'> & {
  pendingLabel?: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
}) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      disabled={pending || props.disabled}
      className={buttonClass(variant, size, className)}
      aria-busy={pending}
    >
      {pending && (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? (pendingLabel ?? 'Working…') : children}
    </button>
  );
}

/**
 * File picker that shows the chosen file and warns before the server rejects
 * it — a writer near a deadline should not lose a submit round trip to a file
 * that was always going to be too large.
 */
export function FileField({
  name,
  accept,
  maxBytes,
  required,
  currentName,
  label = 'Choose a file',
}: {
  name: string;
  accept?: string;
  maxBytes?: number;
  required?: boolean;
  currentName?: string | null;
  label?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // React resets a form after its action runs, which empties this input. Clear
  // the label too, so it never claims a file is attached when none is.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setPicked(null);
      setError(null);
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, []);

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-start gap-2 rounded-lg border border-dashed border-forest-900/25 bg-parchment px-4 py-4 text-sm transition-colors hover:border-gold-500 hover:bg-gold-100/30 sm:flex-row sm:items-center sm:gap-3"
      >
        <span className={buttonClass('outline', 'sm')}>{label}</span>
        {/* On phones the whole name wraps under the button, so a writer can check the file. */}
        <span className="w-full min-w-0 text-muted wrap-anywhere sm:w-auto sm:flex-1 sm:truncate">
          {picked ?? currentName ?? 'No file selected'}
        </span>
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required && !currentName}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) {
            setPicked(null);
            setError(null);
            return;
          }
          if (maxBytes && file.size > maxBytes) {
            setError(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${(maxBytes / 1048576).toFixed(0)} MB.`);
            setPicked(null);
            e.target.value = '';
            return;
          }
          setError(null);
          setPicked(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
        }}
      />
      {error && (
        <p className="text-[13px] font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Live character counter for synopsis-style fields. */
export function CountedTextarea({
  name,
  max,
  min,
  defaultValue = '',
  id,
  placeholder,
  required,
  rows = 5,
}: {
  name: string;
  max: number;
  min?: number;
  defaultValue?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  const [len, setLen] = useState(defaultValue.length);
  const over = len > max;
  const under = min !== undefined && len > 0 && len < min;
  return (
    <div>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        minLength={min}
        onChange={(e) => setLen(e.target.value.length)}
        className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-base leading-relaxed sm:text-[15px] text-ink placeholder:text-muted/60 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25 focus:outline-none"
      />
      <p className={cx('mt-1 text-right text-xs', over || under ? 'text-red-700' : 'text-muted')}>
        {len.toLocaleString()} / {max.toLocaleString()}
        {under && ` · at least ${min} characters`}
      </p>
    </div>
  );
}

/** Native confirm before a destructive submit. */
export function ConfirmSubmit({
  children,
  message,
  variant = 'danger',
  size = 'sm',
  pendingLabel,
}: {
  children: React.ReactNode;
  message: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  pendingLabel?: string;
}) {
  return (
    <SubmitButton
      variant={variant}
      size={size}
      pendingLabel={pendingLabel}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </SubmitButton>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={buttonClass('outline', 'sm')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          /* clipboard blocked — the value is on screen anyway */
        }
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Mobile navigation drawer for the marketing header. */
export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-bone lg:hidden"
      >
        <span className="relative block h-3.5 w-5">
          <span
            className={cx(
              'absolute inset-x-0 top-0 h-0.5 bg-current transition-transform',
              open && 'translate-y-1.5 rotate-45',
            )}
          />
          <span className={cx('absolute inset-x-0 top-1.5 h-0.5 bg-current transition-opacity', open && 'opacity-0')} />
          <span
            className={cx(
              'absolute inset-x-0 top-3 h-0.5 bg-current transition-transform',
              open && '-translate-y-1.5 -rotate-45',
            )}
          />
        </span>
      </button>
      {open && (
        <div className="fixed inset-x-0 top-[var(--header-h,72px)] bottom-0 z-40 overflow-y-auto bg-forest-950/98 px-5 py-6 backdrop-blur lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-lg text-bone/85 hover:bg-white/6 hover:text-bone"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

/**
 * The Foundation's intro clip. Poster-first and click-to-play so a portrait
 * video never autoplays on a metered mobile connection.
 */
export function IntroVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div className={cx('relative overflow-hidden rounded-2xl bg-forest-950', className)}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        playsInline
        controls={playing}
        preload="none"
        className="h-full w-full object-cover object-top"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!playing && (
        <button
          type="button"
          aria-label="Play the Foundation’s introduction"
          onClick={() => void ref.current?.play()}
          className="absolute inset-0 grid place-items-center bg-forest-950/25 transition-colors hover:bg-forest-950/10"
        >
          <span className="grid size-16 place-items-center rounded-full bg-gold-500 text-forest-950 shadow-lg">
            <svg viewBox="0 0 24 24" className="ml-1 size-7" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * A form action's result. On a long form the message sits far above the submit
 * button, off-screen on a phone, so it scrolls itself into view when it lands.
 */
export function FormMessage({ state }: { state: ActionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.message) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [state]);
  if (!state.message) return null;
  return (
    // scroll-mt-20 clears the sticky dashboard header.
    <div ref={ref} className="scroll-mt-20">
      <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
    </div>
  );
}

export type NavIconName =
  | 'home'
  | 'trophy'
  | 'tray'
  | 'pen'
  | 'book'
  | 'key'
  | 'news'
  | 'page'
  | 'folder'
  | 'mail'
  | 'people'
  | 'clock'
  | 'sliders'
  | 'doc'
  | 'chat'
  | 'clipboard'
  | 'user'
  | 'bell';

/** Simple outline glyphs for the dashboard menu, drawn on a 20px grid. */
const NAV_ICONS: Record<NavIconName, ReactNode> = {
  home: <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z" />,
  trophy: <path d="M6 3h8v4a4 4 0 0 1-8 0zM6 5H3.5a2.5 2.5 0 0 0 2.6 3M14 5h2.5a2.5 2.5 0 0 1-2.6 3M10 11v3M7 17h6M8 14h4" />,
  tray: <path d="M3 11l2-6h10l2 6v5H3zM3 11h4l1 2h4l1-2h4" />,
  pen: <path d="M12.5 4.5l3 3L8 15H5v-3zM11 6l3 3" />,
  book: <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5zm0 12A1.5 1.5 0 0 0 5.5 18H16v-3" />,
  key: (
    <>
      <circle cx="7" cy="10" r="3" />
      <path d="M10 10h7M14 10v2.5M16.5 10v2" />
    </>
  ),
  news: <path d="M4 4h10v12H5a1 1 0 0 1-1-1zM14 7h2v8a1 1 0 0 1-2 0M7 7h4M7 10h4M7 13h2" />,
  page: <path d="M6 3h6l3 3v11H6zM12 3v3h3M8 10h5M8 13h5" />,
  folder: <path d="M3 6a1 1 0 0 1 1-1h4l1.5 2H16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  mail: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="1" />
      <path d="m3.5 5.5 6.5 5 6.5-5" />
    </>
  ),
  people: (
    <>
      <circle cx="8" cy="7" r="2.5" />
      <path d="M3.5 16a4.5 4.5 0 0 1 9 0M13 4.7a2.5 2.5 0 0 1 0 4.6M14.5 12A4.5 4.5 0 0 1 16.5 16" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h7M15 6h1M4 14h1M9 14h7" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="7" cy="14" r="2" />
    </>
  ),
  doc: <path d="M6 3h6l3 3v11H6zM12 3v3h3M8 13l1.5 1.5L13 11" />,
  chat: <path d="M4 5h9v6H8l-3 2.5V11H4zM13 8h3v6h-1v2l-2.5-2H9v-2" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="10" height="13" rx="1" />
      <path d="M8 3h4v2H8zM7.5 11l2 2 3.5-4" />
    </>
  ),
  user: (
    <>
      <circle cx="10" cy="8" r="3" />
      <path d="M4.5 16.5a6 6 0 0 1 11 0" />
    </>
  ),
  bell: <path d="M6 8a4 4 0 0 1 8 0c0 4 1.5 5.5 1.5 5.5h-11S6 12 6 8zM8.5 16a1.5 1.5 0 0 0 3 0" />,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('size-[18px] shrink-0', className)}
    >
      {NAV_ICONS[name]}
    </svg>
  );
}

export type DashboardNavItem = { href: string; label: string; icon: NavIconName; badge?: number };
export type DashboardNavGroup = { label?: string; items: DashboardNavItem[] };

/** Longest match wins: /dashboard/admin/users/42 marks "People & roles", not "Overview". */
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * The dashboard's section menu, grouped into compartments (Programmes, Website,
 * People...). A sidebar from lg up; below that, a short menu (writers, judges,
 * mentors) wraps onto a couple of rows, and the long staff menu folds into a
 * disclosure that keeps the same groups. The current section is marked everywhere.
 */
export function DashboardNav({ groups }: { groups: DashboardNavGroup[] }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const all = groups.flatMap((g) => g.items);
  const current = activeHref(
    pathname,
    all.map((i) => i.href),
  );
  const activeItem = all.find((i) => i.href === current);

  // The layout persists across navigations: fold the phone menu after each one.
  useEffect(() => {
    menu.current?.removeAttribute('open');
  }, [pathname]);

  const item = (i: DashboardNavItem, phone = false) => {
    const isCurrent = i.href === current;
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          aria-current={isCurrent ? 'page' : undefined}
          className={cx(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
            phone ? 'min-h-10' : 'whitespace-nowrap',
            isCurrent
              ? 'bg-forest-900/8 font-medium text-forest-900'
              : 'text-forest-700 transition-colors hover:bg-forest-900/6 hover:text-forest-900',
          )}
        >
          <NavIcon name={i.icon} className={isCurrent ? 'text-gold-700' : 'text-forest-700/60'} />
          <span className="min-w-0 flex-1 truncate">{i.label}</span>
          {i.badge ? (
            <span
              className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-forest-950"
              aria-label={`${i.badge} waiting`}
            >
              {i.badge}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  const heading = (label: string, phone = false) => (
    <p
      className={cx(
        'px-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase',
        phone ? 'col-span-full pt-2 pb-0.5' : 'pt-5 pb-1.5',
      )}
    >
      {label}
    </p>
  );

  return (
    <>
      {all.length > 6 ? (
        <details ref={menu} className="group rounded-xl border border-line bg-white lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-forest-900 [&::-webkit-details-marker]:hidden">
            <span className="truncate">
              Menu<span className="font-normal text-muted"> · {activeItem?.label ?? 'Dashboard'}</span>
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
              />
            </svg>
          </summary>
          <div className="border-t border-line p-2 pb-3">
            {groups.map((g, n) => (
              <div key={g.label ?? n}>
                {g.label && heading(g.label, true)}
                <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">{g.items.map((i) => item(i, true))}</ul>
              </div>
            ))}
          </div>
        </details>
      ) : (
        <ul className="-mx-3 flex flex-wrap gap-1 lg:hidden">{all.map((i) => item(i, true))}</ul>
      )}
      <div className="hidden pb-1 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
        {groups.map((g, n) => (
          <div key={g.label ?? n}>
            {g.label && heading(g.label)}
            <ul className="flex flex-col gap-0.5">{g.items.map((i) => item(i))}</ul>
          </div>
        ))}
      </div>
    </>
  );
}

export type SectionTab = { href: string; label: string; count?: number };

/**
 * Sub-pages of one dashboard section (Competitions · Judging rubrics). Each tab
 * is its own URL, so a long page becomes several short ones that can be linked
 * to directly. Wraps rather than scrolling sideways on narrow screens.
 */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  const current = activeHref(
    pathname,
    tabs.map((t) => t.href),
  );
  return (
    <nav aria-label={label} className="mb-6 border-b border-line">
      <ul className="-mb-px flex flex-wrap gap-x-6">
        {tabs.map((t) => {
          const isCurrent = t.href === current;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center gap-2 border-b-2 text-sm',
                  isCurrent
                    ? 'border-gold-500 font-medium text-forest-900'
                    : 'border-transparent text-muted hover:border-line hover:text-forest-900',
                )}
              >
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-forest-900/8 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-forest-800">
                    {t.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
