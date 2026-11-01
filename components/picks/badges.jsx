'use client';

// The small badges a play's row wears on every board (the brief of 2026-10-31, the NBA's availability flags): a
// game-time decision (DTD), thin minutes (under the gate, a marginal play), a back-to-back (load management a risk).

const num = (v, d = 0) => (v == null ? '—' : Number(v).toFixed(d));

export function RowBadges({ r }) {
  return (
    <>
      {r.health === 'DTD' ? <> · <span className="ir-health is-dtd" title={`${r.injury || 'listed'}: a game-time decision`}>DTD</span></> : null}
      {r.thin ? <> · <span className="ir-health is-thin" title={`Projected ${num(r.minutes)} minutes tonight: under the minutes gate, a marginal play`}>thin</span></> : null}
      {r.b2b ? <> · <span className="ir-health is-b2b" title="Played last night: a back-to-back, load management a risk">B2B</span></> : null}
    </>
  );
}
