import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/brand';
import { getObjectBuffer } from '@/lib/r2';

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social card. The emblem is pulled from R2 at build/request time and inlined
 * as a data URI — Satori cannot fetch from a private bucket, and the brand
 * assets deliberately do not live in the repo.
 */
export default async function OpengraphImage() {
  const mark = await getObjectBuffer('dpglf/brand/logo-mark-512.png').catch(() => null);
  const markSrc = mark ? `data:image/png;base64,${mark.toString('base64')}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0c1c16 0%, #16342a 55%, #214a3c 100%)',
          padding: '68px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {markSrc ? (
            <img src={markSrc} width={104} height={104} alt="" style={{ borderRadius: 52 }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#f6f1e7', fontSize: 30, fontWeight: 600 }}>
              Dr. Phillip Gwatidzo
            </span>
            <span style={{ color: '#c9a063', fontSize: 18, letterSpacing: 4, textTransform: 'uppercase' }}>
              Literature Foundation
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#f6f1e7', fontSize: 62, lineHeight: 1.1, fontWeight: 600, maxWidth: 940 }}>
            From Grassroots Narratives to Global Screens
          </span>
          <span style={{ color: 'rgba(246,241,231,0.7)', fontSize: 26, marginTop: 22, maxWidth: 900 }}>
            Discover · Develop · Publish · Archive · Adapt · Commercialize
          </span>
        </div>

        <div style={{ display: 'flex', height: 6, width: 200, background: '#c9a063' }} />
      </div>
    ),
    size,
  );
}
