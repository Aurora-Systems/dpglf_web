import type { NextConfig } from 'next';

/**
 * Brand media lives in the private R2 bucket. By default it is served through
 * this app's own `/media/*` route (a same-origin path, so no remote pattern is
 * needed). If a CDN hostname is later bound to the bucket and set as
 * CLOUDFLARE_PUBLIC_URL, allow that host for the image optimiser too.
 */
function cdnPattern(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  const raw = process.env.CLOUDFLARE_PUBLIC_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [{ protocol: url.protocol === 'http:' ? 'http' : 'https', hostname: url.hostname }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: cdnPattern(),
    formats: ['image/avif', 'image/webp'],
  },
  // Manuscript and cover uploads go through server actions. The default 1 MB
  // limit would reject many files; 5 MB fits the 4 MB file cap (lib/files.ts)
  // plus form fields, and stays inside Netlify's 6 MB request ceiling.
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
