export default function BrandLogo({ size = 26 }) {
  const fontSize = Math.round(size * 0.9);
  const paddingV = Math.round(size * 0.28);
  const paddingH = Math.round(size * 0.65);
  const borderRadius = size * 1.2;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: '#FFE000',
      border: '2.5px solid #141414',
      borderRadius,
      padding: `${paddingV}px ${paddingH}px`,
      boxShadow: '2px 2px 0 #141414',
      lineHeight: 1,
    }}>
      <span style={{
        fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
        fontWeight: 900,
        fontSize,
        color: '#141414',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}>
        Idea ★ Reels
      </span>
    </span>
  );
}
