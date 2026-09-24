import Link from 'next/link';
import { Logo } from '@/components/site/Logo';
import { SITE } from '@/lib/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* Brand panel — hidden on small screens so the form is the whole view. */}
      <aside className="texture-weave relative hidden bg-forest-950 lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:p-12">
        <Logo tone="dark" />
        <div>
          <p className="eyebrow text-gold-400">{SITE.shortName}</p>
          <p className="font-display mt-4 max-w-md text-3xl leading-snug font-semibold text-bone">
            {SITE.tagline}
          </p>
          <p className="mt-5 max-w-md leading-relaxed text-bone/65">
            Create an account to enter a competition, follow your submission through judging and
            mentorship, and build a public author profile.
          </p>
        </div>
        <p className="text-xs text-bone/45">
          © {new Date().getFullYear()} {SITE.name}
        </p>
      </aside>

      <main id="main" className="flex flex-1 flex-col">
        <div className="border-b border-line px-5 py-4 lg:hidden">
          <Logo tone="light" size="sm" />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <div className="px-5 pb-8 text-center text-xs text-muted">
          <Link href="/" className="-my-2 inline-block py-2 hover:text-forest-800">
            Back to the Foundation site
          </Link>
        </div>
      </main>
    </div>
  );
}
