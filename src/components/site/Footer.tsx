import Link from 'next/link';
import { ENDORSEMENTS, SITE } from '@/lib/brand';
import { NewsletterForm } from '@/features/marketing/NewsletterForm';
import { Logo } from './Logo';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Programmes',
    links: [
      { href: '/programmes/tales-from-the-baobab', label: 'Tales from the Baobab' },
      { href: '/perspectives', label: 'Perspectives anthology' },
      { href: '/how-it-works', label: 'The six stages' },
      { href: '/submit', label: 'Submit a story' },
      { href: '/login', label: 'Writer sign in' },
    ],
  },
  {
    heading: 'Explore',
    links: [
      { href: '/archive', label: 'Story Archive' },
      { href: '/authors', label: 'Authors' },
      { href: '/news', label: 'News' },
      { href: '/about', label: 'About the Foundation' },
    ],
  },
  {
    heading: 'Get involved',
    links: [
      { href: '/partners', label: 'Partner with us' },
      { href: '/support', label: 'Support DPGLF' },
      { href: '/partners#mentors', label: 'Become a mentor' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Policies',
    links: [
      { href: '/policies/privacy', label: 'Privacy notice' },
      { href: '/policies/child-safeguarding', label: 'Child safeguarding' },
      { href: '/policies/submissions', label: 'Submission rules' },
      { href: '/policies/copyright', label: 'Copyright & IP' },
      { href: '/policies/terms', label: 'Terms of use' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-forest-950 text-bone/70">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
          <div>
            <Logo tone="dark" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed">
              Building Africa’s leading youth storytelling, publishing and intellectual property
              ecosystem, so that Africa’s stories are told by Africans, owned by Africans and
              celebrated by the world.
            </p>
            <div className="mt-7 max-w-sm">
              <p className="text-[13px] font-semibold text-bone">Calls for submissions, in your inbox</p>
              <NewsletterForm className="mt-3" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="eyebrow text-gold-400">{col.heading}</p>
                <ul className="mt-2.5 space-y-0.5 text-sm sm:mt-4 sm:space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="inline-block py-1.5 transition-colors hover:text-bone sm:inline sm:py-0"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-10">
          <p className="eyebrow text-gold-400">Endorsed by</p>
          {/* Light tiles: official crests and logos are drawn for a white ground. */}
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {ENDORSEMENTS.map((body) => (
              <li
                key={body.slug}
                className="flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-xl bg-bone px-5 py-4 text-center"
              >
                {body.logo && (
                  // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
                  <img src={body.logo} alt="" className="h-14 w-auto max-w-full object-contain" />
                )}
                <span
                  className={
                    body.logo
                      ? 'text-[12px] leading-snug font-medium text-forest-800'
                      : 'font-display text-[15px] leading-snug font-semibold text-forest-900'
                  }
                >
                  {body.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-7 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <p className="text-bone/50">
            Authors retain copyright in their stories. {SITE.tagline}.
          </p>
        </div>
      </div>
    </footer>
  );
}
