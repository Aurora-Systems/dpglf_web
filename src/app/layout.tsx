import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { SITE } from '@/lib/brand';
import './globals.css';

// Fraunces carries the wordmark's classical serif feel; Inter keeps dense
// dashboard tables and forms legible at small sizes.
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.tagline}`,
    template: `%s · ${SITE.shortName}`,
  },
  description: SITE.description,
  applicationName: SITE.shortName,
  keywords: [
    'African storytelling',
    'youth writers',
    'Zimbabwe literature',
    'short story competition',
    'Tales from the Baobab',
    'Perspectives anthology',
    'story archive',
    'adaptation rights',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-forest-900 focus:px-4 focus:py-2 focus:text-bone"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
