/* ============================================================
   SPINUP — shared components
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---- brand mark: a gradient pinwheel ---- */
function BrandMark({ size = 34, spin = false }) {
  const gid = useMemo(() => "bm" + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" fill="none"
      style={{ animation: spin ? "markspin 9s linear infinite" : "none" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#7c3aed" /><stop offset="0.5" stopColor="#c026d3" /><stop offset="1" stopColor="#ff4d8d" />
        </linearGradient>
      </defs>
      <path d="M24 24V3a21 21 0 0 1 18.2 10.5L24 24Z" fill={`url(#${gid})`} opacity="0.95" />
      <path d="M24 24h21a21 21 0 0 1-10.5 18.2L24 24Z" fill={`url(#${gid})`} opacity="0.78" />
      <path d="M24 24V45A21 21 0 0 1 5.8 34.5L24 24Z" fill={`url(#${gid})`} opacity="0.6" />
      <path d="M24 24H3A21 21 0 0 1 13.5 5.8L24 24Z" fill={`url(#${gid})`} opacity="0.82" />
      <circle cx="24" cy="24" r="5.4" fill="#fff" />
      <circle cx="24" cy="24" r="2.6" fill={`url(#${gid})`} />
    </svg>
  );
}

function Logo({ onClick, spin }) {
  return (
    <div className="brand" onClick={onClick}>
      <BrandMark spin={spin} />
      <span className="brand-name">Spinup</span>
    </div>
  );
}

/* ---- tiny icon set ---- */
const Icon = {
  arrow: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  spark: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor"/></svg>,
  product: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="3" width="8" height="8" rx="2.2" stroke="currentColor" strokeWidth="2"/><rect x="13" y="3" width="8" height="8" rx="2.2" stroke="currentColor" strokeWidth="2"/><rect x="3" y="13" width="8" height="8" rx="2.2" stroke="currentColor" strokeWidth="2"/><rect x="13" y="13" width="8" height="8" rx="2.2" stroke="currentColor" strokeWidth="2"/></svg>,
  gtm: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><path d="M3 11l18-7-7 18-2.5-8L3 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
  infra: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="4" width="18" height="5" rx="1.6" stroke="currentColor" strokeWidth="2"/><rect x="3" y="15" width="18" height="5" rx="1.6" stroke="currentColor" strokeWidth="2"/><path d="M7 6.5h0M7 17.5h0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>,
  proto: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><rect x="6" y="2.5" width="12" height="19" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  check: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  refresh: (p) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" {...p}><path d="M20 11a8 8 0 1 0-.5 4M20 4v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  trend: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M3 17l6-6 4 4 8-8M21 7v5h-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pulse: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M3 12h4l2-6 4 12 2-6h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ---- stage rail ---- */
const STAGES = [
  { key: "wheel", label: "Spin" },
  { key: "validate", label: "Validate" },
  { key: "blueprint", label: "Build" },
];
function StageRail({ current, maxReached, onJump }) {
  const order = ["landing", "wheel", "validate", "blueprint"];
  const ci = order.indexOf(current);
  return (
    <div className="rail glass" style={{ padding: 5, borderRadius: 999 }}>
      {STAGES.map((s, i) => {
        const si = order.indexOf(s.key);
        const state = ci === si ? "active" : ci > si ? "done" : "todo";
        const reachable = order.indexOf(maxReached) >= si;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && <span className="rail-sep" />}
            <button className={`rail-step ${state}`} onClick={() => reachable && onJump(s.key)}
              style={{ cursor: reachable ? "pointer" : "default", border: "none" }}>
              <span className="dot">{state === "done" ? <Icon.check /> : i + 1}</span>
              {s.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---- top bar ---- */
function TopBar({ screen, maxReached, onHome, onJump }) {
  return (
    <header className="topbar">
      <Logo onClick={onHome} spin={screen === "landing"} />
      {screen !== "landing" && <StageRail current={screen} maxReached={maxReached} onJump={onJump} />}
      <div style={{ minWidth: 132, display: "flex", justifyContent: "flex-end" }}>
        {screen !== "landing"
          ? <button className="btn btn-ghost btn-sm" onClick={onHome}><Icon.refresh /> Restart</button>
          : <span className="chip" style={{ background: "rgba(255,255,255,.6)" }}><span style={{width:7,height:7,borderRadius:9,background:"var(--good)"}}></span> Free to try</span>}
      </div>
    </header>
  );
}

/* ---- animated meter bar ---- */
function Meter({ value, delay = 0, color = "var(--grad-brand)" }) {
  const [w, setW] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    const t2 = setTimeout(() => setDone(true), delay + 1300);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [value, delay]);
  return (
    <div style={{ height: 8, borderRadius: 8, background: "var(--bg-2)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: w + "%", background: color, borderRadius: 8,
        transition: done ? "none" : "width 1.1s var(--ease-out)" }} />
    </div>
  );
}

/* ---- radial score ring ---- */
function ScoreRing({ value, size = 132, label }) {
  const [v, setV] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 250);
    const t2 = setTimeout(() => setDone(true), 1700);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [value]);
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  const gid = useMemo(() => "sr" + Math.random().toString(36).slice(2, 7), []);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2={size} y2={size}>
          <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#ff4d8d" /></linearGradient></defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--bg-2)" strokeWidth="11" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={`url(#${gid})`} strokeWidth="11" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: done ? "none" : "stroke-dashoffset 1.3s var(--ease-out)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div className="display grad-text" style={{ fontSize: 34 }}>{Math.round(v)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginTop: -2 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ---- failsafe: force reveals visible if CSS animations never progress
   (background tabs / throttled compositors / headless capture pause them,
   which would otherwise leave opacity:0 entrance states stuck hidden) ---- */
function useReveals(ready) {
  const [forced, setForced] = useState(false);
  useEffect(() => {
    setForced(false);
    if (!ready) return;
    const t = setTimeout(() => setForced(true), 1500);
    return () => clearTimeout(t);
  }, [ready]);
  return forced ? "reveals-forced" : "";
}

Object.assign(window, { BrandMark, Logo, Icon, StageRail, TopBar, Meter, ScoreRing, STAGES, useReveals });
