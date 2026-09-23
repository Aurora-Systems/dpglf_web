'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonClass, cx } from './ui';

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
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-forest-900/25 bg-parchment px-4 py-4 text-sm transition-colors hover:border-gold-500 hover:bg-gold-100/30"
      >
        <span className={buttonClass('outline', 'sm')}>{label}</span>
        <span className="min-w-0 flex-1 truncate text-muted">
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
        onChange={(e) => setLen(e.target.value.length)}
        className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/60 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25 focus:outline-none"
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
