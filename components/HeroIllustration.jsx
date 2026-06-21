/**
 * Retro pop-art / comic-book illustration for the landing page hero.
 * Colors: #FFE000 (yellow), #111 (near-black), #FF3B3B (red accent).
 * Style: neobrutalist panel — bold border, offset shadow, halftone dots,
 * radiating action lines, simplified hero silhouette.
 */
export default function HeroIllustration({ className, style }) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        border: '3px solid #111',
        boxShadow: '6px 6px 0 #111',
        borderRadius: 3,
        overflow: 'hidden',
        width: 248,
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 248 292"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', width: '100%' }}
      >
        <defs>
          {/* Ben-Day halftone dots */}
          <pattern id="ir-dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="6" r="1.7" fill="#111" opacity="0.13" />
          </pattern>
          <clipPath id="ir-panel">
            <rect width="248" height="292" />
          </clipPath>
        </defs>

        {/* Yellow background */}
        <rect width="248" height="292" fill="#FFE000" />
        {/* Halftone overlay */}
        <rect width="248" height="292" fill="url(#ir-dots)" />

        {/* Radiating action lines from starburst center (174, 78) */}
        <g stroke="#111" strokeWidth="1" opacity="0.18" clipPath="url(#ir-panel)">
          <line x1="174" y1="78" x2="248" y2="0" />
          <line x1="174" y1="78" x2="248" y2="55" />
          <line x1="174" y1="78" x2="248" y2="125" />
          <line x1="174" y1="78" x2="248" y2="210" />
          <line x1="174" y1="78" x2="200" y2="292" />
          <line x1="174" y1="78" x2="140" y2="292" />
          <line x1="174" y1="78" x2="60" y2="292" />
          <line x1="174" y1="78" x2="0" y2="240" />
          <line x1="174" y1="78" x2="0" y2="130" />
          <line x1="174" y1="78" x2="0" y2="20" />
          <line x1="174" y1="78" x2="80" y2="0" />
          <line x1="174" y1="78" x2="174" y2="0" />
        </g>

        {/* ── Hero silhouette ────────────────────────────── */}

        {/* Cape (behind body) */}
        <path d="M80,178 C48,205 32,260 50,283 L100,265 Z" fill="#111" />

        {/* Body */}
        <rect x="62" y="178" width="38" height="64" rx="3" fill="#111" />

        {/* Head */}
        <circle cx="81" cy="156" r="21" fill="#111" />

        {/* Visor — yellow stripe across the face */}
        <rect x="68" y="150" width="26" height="9" rx="4" fill="#FFE000" />

        {/* Right arm raised toward the starburst */}
        <line x1="100" y1="192" x2="145" y2="150" stroke="#111" strokeWidth="10" strokeLinecap="round" />
        {/* Fist */}
        <circle cx="148" cy="147" r="9" fill="#111" />

        {/* Left arm */}
        <line x1="62" y1="192" x2="26" y2="218" stroke="#111" strokeWidth="9" strokeLinecap="round" />

        {/* Legs */}
        <rect x="65" y="240" width="15" height="38" rx="3" fill="#111" />
        <rect x="84" y="240" width="15" height="38" rx="3" fill="#111" />

        {/* Boots */}
        <rect x="59" y="272" width="23" height="11" rx="3" fill="#111" />
        <rect x="83" y="272" width="23" height="11" rx="3" fill="#111" />

        {/* Speed lines (left, near the hero's body) */}
        <g stroke="#111" strokeWidth="2" strokeLinecap="round" opacity="0.4">
          <line x1="12" y1="168" x2="38" y2="175" />
          <line x1="8"  y1="183" x2="37" y2="186" />
          <line x1="12" y1="198" x2="37" y2="198" />
        </g>

        {/* ── 8-point red starburst ─────────────────────── */}
        {/*
          Center (174, 78), outer r=66, inner r=30.
          Outer points every 45° starting at 0° (right):
            0°:   (240, 78)
            45°:  (220.7, 124.7)
            90°:  (174, 144)
            135°: (127.3, 124.7)
            180°: (108, 78)
            225°: (127.3, 31.3)
            270°: (174, 12)
            315°: (220.7, 31.3)
          Inner points every 45° offset 22.5°:
            22.5°: (201.8, 89.4)
            67.5°: (195.4, 113.4)
            112.5°: (152.6, 113.4)
            157.5°: (146.2, 89.4)
            202.5°: (146.2, 66.6)
            247.5°: (152.6, 42.6)
            292.5°: (195.4, 42.6)
            337.5°: (201.8, 66.6)
        */}
        <polygon
          points="240,78 201.8,89.4 220.7,124.7 195.4,113.4 174,144 152.6,113.4 127.3,124.7 146.2,89.4 108,78 146.2,66.6 127.3,31.3 152.6,42.6 174,12 195.4,42.6 220.7,31.3 201.8,66.6"
          fill="#FF3B3B"
          stroke="#111"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Text inside the starburst */}
        <text x="174" y="68" textAnchor="middle" fill="white" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize="14" letterSpacing="0.06em">IDEA</text>
        <text x="174" y="86" textAnchor="middle" fill="white" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize="14" letterSpacing="0.06em">REELS</text>

        {/* ── Decorative stars ──────────────────────────── */}
        <text x="18" y="82" fill="#111" fontSize="18" fontFamily="serif" opacity="0.5">★</text>
        <text x="222" y="194" fill="#111" fontSize="12" fontFamily="serif" opacity="0.4">★</text>
        <text x="14" y="242" fill="#111" fontSize="11" fontFamily="serif" opacity="0.4">✦</text>

        {/* ── "VALIDATED!" bottom banner ────────────────── */}
        <rect x="26" y="256" width="196" height="27" rx="2" fill="#111" />
        <text
          x="124"
          y="275"
          textAnchor="middle"
          fill="#FFE000"
          fontFamily="Nunito, sans-serif"
          fontWeight="900"
          fontSize="13"
          letterSpacing="0.12em"
        >
          VALIDATED!
        </text>

        {/* Inner comic-panel hairline border */}
        <rect x="6" y="6" width="236" height="280" fill="none" stroke="#111" strokeWidth="1.2" opacity="0.22" />
      </svg>
    </div>
  );
}
