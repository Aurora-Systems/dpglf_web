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
  // Manuscript uploads go through server actions; the default 1 MB body limit
  // would reject almost every .docx.
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
