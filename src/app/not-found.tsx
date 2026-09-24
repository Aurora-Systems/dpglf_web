import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { ButtonLink, Eyebrow } from '@/components/ui';

/** Every unmatched URL and every notFound() lands here, with a way back. */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8 lg:py-28">
          <Eyebrow>Page not found</Eyebrow>
          <h1 className="font-display mt-3 text-3xl font-semibold text-balance text-forest-900 sm:text-4xl">
            We could not find that page
          </h1>
          <p className="mt-4 leading-relaxed text-muted">The link may be old, or the address mistyped.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href="/" variant="gold" size="lg">
              Back to the Foundation
            </ButtonLink>
            <ButtonLink href="/archive" variant="outline" size="lg">
              Browse the Story Archive
            </ButtonLink>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
