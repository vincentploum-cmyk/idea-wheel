'use client';

import { DEFAULTS } from '@/lib/picks/value';
import { isDefault } from './value-filters';

// The value controls over a picks board (the brief of 2026-10-31, "Controls"): the minimum EV, the juice ceiling, the
// optional chance floor, the sort and the marginal switch. The market filter sits on the Top Plays table's own tabs.
//   filters / onChange: the hook in value-filters.js; counts: { passing, all } for the note.

const JUICE_STEPS = [-110, -120, -130, -150, -175, -200, -250, -300, -400];
const fmtJuice = (o) => (o == null ? 'any' : String(o));

export default function ValueControls({ filters, onChange, onReset = null, counts = null, minMinutes = null }) {
  const f = { ...DEFAULTS, ...(filters || {}) };
  const juiceIdx = Math.max(0, JUICE_STEPS.indexOf(f.maxJuice));
  return (
    <div className="ir-vc" role="group" aria-label="Value floors">
      <label className="ir-vc-field">
        <span className="ir-vc-label">Min EV <b>{f.minEv == null ? 'any' : `+${Math.round(f.minEv * 100)}%`}</b></span>
        <input type="range" min="0" max="25" step="1" value={Math.round((f.minEv ?? 0) * 100)} onChange={(e) => onChange({ minEv: Number(e.target.value) / 100 })} aria-label="Minimum expected value" />
      </label>
      <label className="ir-vc-field">
        <span className="ir-vc-label">Max juice <b>{fmtJuice(f.maxJuice)}</b></span>
        <input type="range" min="0" max={JUICE_STEPS.length - 1} step="1" value={juiceIdx} onChange={(e) => onChange({ maxJuice: JUICE_STEPS[Number(e.target.value)] })} aria-label="Worst price allowed" title="A play priced worse than this is hidden (a positive edge at -5000 is capital-dead)" />
      </label>
      <label className="ir-vc-field">
        <span className="ir-vc-label">Min chance <b>{f.minChance == null ? 'off' : `${Math.round(f.minChance * 100)}%`}</b></span>
        <input type="range" min="0" max="80" step="5" value={f.minChance == null ? 0 : Math.round(f.minChance * 100)} onChange={(e) => { const v = Number(e.target.value); onChange({ minChance: v > 0 ? v / 100 : null }); }} aria-label="Minimum chance (optional)" title="Optional: hide plays under this chance whatever their value" />
      </label>
      <div className="ir-vc-field ir-vc-sort">
        <span className="ir-vc-label">Sort</span>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Sort">
          {[['ev', 'EV%'], ['matchup', 'Matchup'], ['chance', 'Chance']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={f.sort === k} className={`nhlx-tab${f.sort === k ? ' is-active' : ''}`} onClick={() => onChange({ sort: k })}>{l}</button>)}
        </div>
      </div>
      <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-vc-marginal" aria-pressed={!!f.marginal} onClick={() => onChange({ marginal: !f.marginal })} title="Show the rows that fail a floor: priced past the ceiling, under the minimum EV, without a price, or on thin minutes">Show marginal</button>
      {onReset && !isDefault(f) ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={onReset}>Defaults</button> : null}
      {counts ? <small className="nhlx-auto-meta ir-vc-note">{counts.passing} of {counts.all} +EV play{counts.all === 1 ? '' : 's'} clear the floors{minMinutes ? ` · players under ${minMinutes} minutes are marginal` : ''}</small> : null}
    </div>
  );
}
