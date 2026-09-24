'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client';
import { cx } from '@/components/ui';
import { IDLE } from '@/lib/actions';
import { subscribeAction } from './actions';

export function NewsletterForm({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const [state, action] = useActionState(subscribeAction, IDLE);

  if (state.ok) {
    return (
      <p className={cx('text-sm', tone === 'dark' ? 'text-gold-300' : 'text-forest-700', className)}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={cx('space-y-2', className)}>
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={cx(
            'w-0 min-w-0 flex-1 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:ring-2 focus:ring-gold-500/40 focus:outline-none',
            tone === 'dark'
              ? 'border border-white/15 bg-white/8 text-bone placeholder:text-bone/40'
              : 'border border-line bg-white text-ink placeholder:text-muted/60',
          )}
        />
        {/* Honeypot — hidden from people, irresistible to bots. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <SubmitButton variant="gold" size="md" pendingLabel="Sending…">
          Subscribe
        </SubmitButton>
      </div>
      {state.message && !state.ok && (
        <p className="text-[13px] text-red-300" role="alert">
          {state.message}
        </p>
      )}
      <p className={cx('text-[11.5px]', tone === 'dark' ? 'text-bone/45' : 'text-muted')}>
        We send calls for submissions and Foundation news. Unsubscribe at any time.
      </p>
    </form>
  );
}
