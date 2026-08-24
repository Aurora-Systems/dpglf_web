import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { MobileNav } from '../client';
import { buttonClass } from '../ui';
import { Logo } from './Logo';

const NAV = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/programmes/tales-from-the-baobab', label: 'Tales from the Baobab' },
  { href: '/perspectives', label: 'Perspectives' },
  { href: '/archive', label: 'Story Archive' },
  { href: '/partners', label: 'Partners' },
  { href: '/news', label: 'News' },
];

const MOBILE_NAV = [
  ...NAV,
  { href: '/support', label: 'Support DPGLF' },
  { href: '/contact', label: 'Contact' },
];

export async function Header() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-forest-950/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Logo tone="dark" />

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-[13.5px] text-bone/75 transition-colors hover:bg-white/6 hover:text-bone"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-4">
          {user ? (
            <Link href="/dashboard" className={buttonClass('gold', 'sm')}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-md px-3 py-2 text-[13.5px] text-bone/75 hover:text-bone sm:block"
              >
                Sign in
              </Link>
              <Link href="/submit" className={buttonClass('gold', 'sm')}>
                Submit a story
              </Link>
            </>
          )}
          <MobileNav links={MOBILE_NAV} />
        </div>
      </div>
    </header>
  );
}
