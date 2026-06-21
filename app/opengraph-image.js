import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'IdeaReels — AI Market Research & MVP Blueprints from $3.99';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#111111',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top: logo wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Icon block */}
          <div
            style={{
              width: 52,
              height: 52,
              background: '#FFE000',
              border: '3px solid #FFE000',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 28, color: '#111111', fontWeight: 900, lineHeight: 1 }}>
              IR
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#FFE000', letterSpacing: '-0.5px' }}>
            IdeaReels
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, justifyContent: 'center' }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              maxWidth: 900,
            }}
          >
            AI market research + MVP blueprint in under 5 minutes.
          </div>
          <div style={{ fontSize: 28, color: '#aaaaaa', fontWeight: 400, letterSpacing: '-0.3px' }}>
            Built for vibe coders, indie hackers, and solo founders.
          </div>
        </div>

        {/* Bottom: price badge + URL */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div
            style={{
              background: '#FFE000',
              color: '#111111',
              fontSize: 22,
              fontWeight: 900,
              padding: '12px 28px',
              borderRadius: 8,
              letterSpacing: '-0.2px',
            }}
          >
            From $3.99 · Credits never expire
          </div>
          <div style={{ fontSize: 22, color: '#555555', fontWeight: 600 }}>
            ideareels.io
          </div>
        </div>

        {/* Decorative yellow bar — top right corner */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 8,
            height: '100%',
            background: '#FFE000',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
