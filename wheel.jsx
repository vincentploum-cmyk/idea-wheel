/* ============================================================
   SPINUP — the idea wheel
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function slicePath(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function Wheel({ segments, onResult, motion = 1, style = "spectrum" }) {
  const N = segments.length;
  const seg = 360 / N;
  const C = 200, R = 196;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const rotRef = useRef(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true); setLanded(null);
    const i = Math.floor(Math.random() * N);
    const centerDeg = i * seg;                     // segment center, clockwise from top
    const targetMod = ((-centerDeg) % 360 + 360) % 360;
    const curMod = ((rotRef.current % 360) + 360) % 360;
    let delta = targetMod - curMod; if (delta < 0) delta += 360;
    const turns = 5 + Math.floor(Math.random() * 2);
    const next = rotRef.current + delta + 360 * turns;
    rotRef.current = next;
    setRotation(next);
    const dur = 4400 + (1 - motion) * 0; // duration scaled via CSS var below
    setTimeout(() => {
      setSpinning(false); setLanded(i); onResult(segments[i], i);
    }, 4600);
  };

  const spinDur = (4.6 / (0.5 + motion)).toFixed(2);

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer">
        <svg width="46" height="54" viewBox="0 0 46 54" fill="none">
          <path d="M23 50 L6 14 A20 20 0 0 1 40 14 Z" fill="#fff" stroke="#efe6f5" strokeWidth="1.5"/>
          <circle cx="23" cy="18" r="6" fill="url(#pg)"/>
          <defs><linearGradient id="pg" x1="17" y1="12" x2="29" y2="24">
            <stop stopColor="#7c3aed"/><stop offset="1" stopColor="#ff4d8d"/></linearGradient></defs>
        </svg>
      </div>

      <div className="wheel-disc-shadow" />
      <svg className="wheel-svg" viewBox="0 0 400 400"
        style={{ transform: `rotate(${rotation}deg)`,
          transition: spinning ? `transform ${spinDur}s cubic-bezier(.12,.74,.16,1)` : "none" }}>
        <defs>
          {segments.map((s, i) => (
            <linearGradient key={i} id={`seg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={lighten(s.color, 0.14)} />
              <stop offset="1" stopColor={s.color} />
            </linearGradient>
          ))}
          <radialGradient id="gloss" cx="0.5" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R + 2} fill="#fff" />
        {segments.map((s, i) => {
          const start = i * seg - seg / 2, end = i * seg + seg / 2;
          const isWin = landed === i;
          return (
            <g key={s.id} style={{ transformOrigin: `${C}px ${C}px`,
              transform: isWin ? "scale(1.012)" : "scale(1)", transition: "transform .5s var(--ease-out)" }}>
              <path d={slicePath(C, C, R, start, end)} fill={`url(#seg${i})`}
                stroke="#fff" strokeWidth="2.5" />
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R} fill="url(#gloss)" pointerEvents="none" />
        {segments.map((s, i) => {
          const centerDeg = i * seg;
          return (
            <g key={s.id} transform={`rotate(${centerDeg} ${C} ${C})`}>
              <text x={C} y={64} textAnchor="middle"
                fontFamily="Sora, sans-serif" fontWeight="700" fontSize="19"
                fill="#fff" style={{ letterSpacing: "-0.01em" }}>{s.label}</text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(80,20,110,.10)" strokeWidth="2" />
      </svg>

      <button className={`wheel-hub ${spinning ? "is-spinning" : ""}`} onClick={spin} disabled={spinning}>
        <span className="wheel-hub-inner">
          {spinning ? <span className="hub-dots"><i></i><i></i><i></i></span>
            : <><span className="hub-spark"><Icon.spark /></span><span className="hub-label">SPIN</span></>}
        </span>
      </button>
    </div>
  );
}

/* lighten a hex toward white by t (0..1) */
function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * t); g = Math.round(g + (255 - g) * t); b = Math.round(b + (255 - b) * t);
  return `rgb(${r},${g},${b})`;
}

Object.assign(window, { Wheel });
