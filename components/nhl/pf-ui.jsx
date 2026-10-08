'use client';

import { useMemo, useState } from 'react';
import { TeamLogo } from './media';
import { teamName } from '@/lib/nhl-data/teams';

// PropFinder's display pieces, shared by the player card and the skater tables:
// the position badge, the underlined tab row, the labelled dropdown, the dense
// table and the "Defense Allowed" panel. Tokens only (globals.css).

/** Boxed position tag (C / LW / RW / D), tinted per position. */
export function PosBadge({ pos, className = '' }) {
  if (!pos) return null;
  return <span className={`nhlx-pos is-${String(pos).toLowerCase()} ${className}`}>{pos}</span>;
}

/** Status tag PropFinder appends to a name (IR, DTD, …) or a note such as "new team". */
export function Tag({ children, tone = '' }) {
  if (!children) return null;
  return <span className={`nhlx-tag ${tone}`}>{children}</span>;
}

/** Full-width tab row with the active tab underlined. items: [key, label][] */
export function UnderlineTabs({ items, value, onChange, label }) {
  return (
    <div className="nhlx-ultabs" role="tablist" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={`nhlx-ultab${value === k ? ' is-active' : ''}`} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

/** "LABEL  value ▾" dropdown. options: [value, label][] */
export function Sel({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`nhlx-sel ${className}`}>
      <small>{label}</small>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Dense table in PropFinder's style; pass thead/tbody as children. */
export function PfTable({ children, className = '' }) {
  return (
    <div className={`nhlx-pft-wrap ${className}`}>
      <table className="nhlx-pft">{children}</table>
    </div>
  );
}

/** Sortable column header: click sorts by `k`, the sorted one carries the arrow. */
export function SortTh({ k, label, sort, onSort, title }) {
  return (
    <th className={sort === k ? 'is-sorted' : ''} title={title}>
      <button type="button" onClick={() => onSort(k)}>{label}{sort === k ? <i aria-hidden="true">↓</i> : null}</button>
    </th>
  );
}

/** PropFinder's rank thirds, read from the shooter's side: rank 1 = most allowed. */
// PropFinder's bands: ranks 1-11 green (most allowed), 12-22 yellow, 23-32 red of 32.
export const rankTone = (rank, n) => (!rank || !n ? '' : rank <= Math.ceil(n / 3) ? 'is-soft' : rank > n - Math.floor(n / 3) ? 'is-tough' : 'is-mid');

const POS_OPTS = [['All', 'All'], ['C', 'C'], ['LW', 'LW'], ['RW', 'RW'], ['D', 'D']];

/**
 * "<Team> Defense Allowed": what `abbr` gives up per game (or in total) to one position,
 * PropFinder's cells with their league rank, with Year / Range / Position dropdowns and
 * the per-game ↔ total switch. `data` is propfinderDefenseTabs() output ({ cols, tabs }).
 */
export function DefenseAllowed({ abbr, data, pos: initialPos = 'All' }) {
  const tabs = useMemo(() => data?.tabs || [], [data]);
  const seasons = useMemo(() => tabs.filter((t) => t.kind === 'season'), [tabs]);
  const windows = useMemo(() => tabs.filter((t) => t.kind !== 'season'), [tabs]);
  const [year, setYear] = useState(() => String(seasons[seasons.length - 1]?.season ?? ''));
  const [range, setRange] = useState('season');
  const [pos, setPos] = useState(POS_OPTS.some(([k]) => k === initialPos) ? initialPos : 'All');
  const [total, setTotal] = useState(false);
  const tab = useMemo(() => (range === 'season' ? seasons.find((t) => String(t.season) === year) || seasons[seasons.length - 1] : windows.find((t) => t.key === range)) || tabs[0], [tabs, seasons, windows, year, range]);
  if (!tab) return null;
  const row = tab.rows[pos] || tab.rows.All;
  const n = tab.count;
  const cols = data.cols.filter(([k]) => row?.[k] != null);
  const rangeLabel = (t) => (t.windowGames ? `Last ${t.windowGames}${t.split === 'H' ? ' home' : t.split === 'A' ? ' away' : ''}` : t.label);
  return (
    <div className="nhlx-da" aria-label={`${abbr} defense allowed, PropFinder`}>
      <div className="nhlx-da-controls">
        {seasons.length > 0 && <Sel label="Year" value={range === 'season' ? year : String(tab.season ?? year)} onChange={(v) => { setYear(v); setRange('season'); }} options={seasons.map((t) => [String(t.season), String(t.season)])} />}
        <Sel label="Range" value={range} onChange={setRange} options={[['season', 'Season'], ...windows.map((t) => [t.key, rangeLabel(t)])]} />
        <Sel label="Position" value={pos} onChange={setPos} options={POS_OPTS.filter(([k]) => tab.rows[k])} />
      </div>
      <div className="nhlx-da-head">
        <TeamLogo abbr={abbr} size={22} />
        <b>{abbr} Defense Allowed</b>
        <em>({range === 'season' ? tab.season : rangeLabel(tab)}{row?.gp ? ` · ${row.gp} GP` : ''})</em>
        <label className="nhlx-pfd-switch">
          <span className={total ? '' : 'is-on'}>Per Game</span>
          <input type="checkbox" role="switch" checked={total} aria-checked={total} aria-label="Show totals instead of per game" onChange={(e) => setTotal(e.target.checked)} />
          <i aria-hidden="true" />
          <span className={total ? 'is-on' : ''}>Total</span>
        </label>
      </div>
      <div className="nhlx-da-section">Base{pos !== 'All' ? ` · vs ${pos}` : ''}</div>
      <div className="nhlx-da-grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(96px, 1fr))` }}>
        {cols.map(([k, l]) => <div key={`h-${k}`} className="nhlx-da-th">{l.replace('/G', '')}</div>)}
        {cols.map(([k]) => {
          const v = row[k];
          const r = row.ranks?.[k];
          return (
            <div key={k} className={`nhlx-da-cell ${rankTone(r, n)}`}>
              <b>{v == null ? '—' : total ? Math.round(v * (row.gp || 0)) : Number(v).toFixed(1)}</b>
              {r ? <span className="nhlx-rank">#{r}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="nhlx-da-section">By position</div>
      <PfTable className="nhlx-da-table">
        <thead><tr><th className="is-left">Position</th><th>GP</th>{cols.map(([k, l]) => <th key={k}>{l.replace('/G', '')}</th>)}</tr></thead>
        <tbody>
          {POS_OPTS.map(([k]) => tab.rows[k] && (
            <tr key={k} className={k === pos ? 'is-active' : ''}>
              <td className="is-left"><b>{k}</b></td>
              <td>{tab.rows[k].gp ?? '—'}</td>
              {cols.map(([c]) => {
                const v = tab.rows[k][c];
                const r = tab.rows[k].ranks?.[c];
                return <td key={c} className={rankTone(r, n)}>{v == null ? '—' : total ? Math.round(v * (tab.rows[k].gp || 0)) : Number(v).toFixed(2)}{r ? <span className="nhlx-rank">#{r}</span> : null}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </PfTable>
      <div className="nhlx-da-legend">
        <span><i className="is-soft" /> Rank 1–{Math.ceil(n / 3)} (Most Allowed)</span>
        <span><i className="is-mid" /> Rank {Math.ceil(n / 3) + 1}–{n - Math.floor(n / 3)} (Ok Matchup)</span>
        <span><i className="is-tough" /> Rank {n - Math.floor(n / 3) + 1}–{n} (Least Allowed)</span>
      </div>
      <p className="nhlx-da-foot">What {teamName(abbr) || abbr} allowed {total ? 'in total' : 'per game'} · all strengths · data from PropFinder{tab.asOf ? ` · as of ${tab.asOf.slice(0, 10)}` : ''}</p>
    </div>
  );
}
