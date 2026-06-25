export default function TrustBar({ items }) {
  return (
    <div style={{
      background: '#FFE000',
      borderTop: '3px solid #111',
      borderBottom: '3px solid #111',
      padding: '16px 0',
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          gap: 32,
          justifyContent: 'center',
          flexWrap: 'wrap',
          textAlign: 'center',
        }}>
          {items.map(({ label, sub }) => (
            <div key={label}>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, color: '#111' }}>{label}</div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#111', opacity: 0.6 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
