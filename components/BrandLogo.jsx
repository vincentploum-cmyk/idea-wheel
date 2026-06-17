// Shared brand mark: the lightbulb logo + two-tone "IdeaReels" wordmark.
// Presentational only (no hooks), so it works in both server and client
// components. Inline styles + global CSS vars keep it identical on every page.
export default function BrandLogo({ size = 26 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
        <defs>
          <linearGradient id="brand-bulb-grad" x1="14" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a855f7" /><stop offset="1" stopColor="#9333ea" />
          </linearGradient>
        </defs>
        {/* rays */}
        <g stroke="#9333ea" strokeWidth="2.4" strokeLinecap="round">
          <path d="M24 3v3.6" /><path d="M13.8 6.2l1.8 3.1" /><path d="M34.2 6.2l-1.8 3.1" />
        </g>
        {/* bulb */}
        <path d="M24 8c-6.6 0-12 5-12 11.5 0 4.5 2.6 7.6 4.6 9.6 1 1 1.6 2.2 1.8 3.6h11.2c.2-1.4.8-2.6 1.8-3.6 2-2 4.6-5.1 4.6-9.6C36 13 30.6 8 24 8Z" fill="url(#brand-bulb-grad)" />
        {/* filament */}
        <g stroke="#f3e8ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          <path d="M24 15v17" /><path d="M21 18v14" /><path d="M27 18v14" />
        </g>
        {/* screw base */}
        <rect x="18.4" y="34" width="11.2" height="3.1" rx="1.55" fill="#7c3aed" />
        <rect x="20" y="38.2" width="8" height="2.8" rx="1.4" fill="#7c3aed" />
      </svg>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: Math.round(size * 0.69), fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
        <span style={{ color: 'var(--ink)' }}>Idea</span>
        <span style={{ background: 'var(--grad-brand)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>Reels</span>
      </span>
    </span>
  );
}
