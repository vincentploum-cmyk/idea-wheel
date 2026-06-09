export default function CloudBackground() {
  return (
    <>
      <div style={baseWash} aria-hidden="true" />
      <div style={topGlow} aria-hidden="true" />
      <div style={sideGlow} aria-hidden="true" />
      <div style={grain} aria-hidden="true" />
    </>
  );
}

const sharedLayer = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 0,
};

const baseWash = {
  ...sharedLayer,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(245,245,247,0.3) 32%, rgba(245,245,247,0.9) 100%)',
};

const topGlow = {
  ...sharedLayer,
  inset: '-12% 8% auto 8%',
  height: 420,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 50% 50%, rgba(79,70,229,0.12) 0%, rgba(79,70,229,0.06) 32%, rgba(79,70,229,0) 72%)',
  filter: 'blur(22px)',
};

const sideGlow = {
  ...sharedLayer,
  inset: '18% auto auto -12%',
  width: 520,
  height: 520,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 50% 50%, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.04) 38%, rgba(37,99,235,0) 72%)',
  filter: 'blur(26px)',
};

const grain = {
  ...sharedLayer,
  opacity: 0.18,
  backgroundImage:
    'radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.6px)',
  backgroundSize: '8px 8px',
  mixBlendMode: 'soft-light',
};
