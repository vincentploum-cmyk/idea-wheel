'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { MpCell } from './MoneyPuck';
import { SKATER_COLS, TEAM_COLS, seasonLabel } from '@/lib/nhl-data/propfinder-csv';

const num = (v, d) => (v == null ? '—' : Number(v).toFixed(d));
const day = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const POS_TABS = [['', 'All'], ['C', 'C'], ['LW', 'LW'], ['RW', 'RW'], ['D', 'D']];
// Team stats come in two exports: what the team produced ("for") and what it allowed ("against").
const SIDES = [['teams', 'For'], ['opponents', 'Against']];

/** Fetches /api/nhl/data/propfinder once per mount. */
export function usePropfinder() {
  const [pf, setPf] = useState(null);
  useEffect(() => {
    let live = true;
    fetch('/api/nhl/data/propfinder', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setPf(j); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return pf;
}

function teamMeta(t, against) {
  const n = t.count || Object.keys(t.teams).length;
  return `${seasonLabel(t.season)} regular season${t.window ? ` · ${t.window}` : ''}${t.windowGames ? ' (rolling)' : ''} · rank 1 = ${against ? 'most allowed (softest defense)' : 'highest'} of ${n} · as of ${day(t.asOf)} · data from PropFinder`;
}

/**
 * Rank-tinted cell. "For" rows: green = the team is strong. "Against" rows are read
 * from the shooter's side, as on the defense cards: green = the team allows a lot.
 */
function Cell({ row, ranks, k, d, dir, n, against }) {
  return <MpCell v={row[k]} d={d} rank={ranks[k]} n={n} invert={!against && dir === 'low'} />;
}

/** One team's PropFinder season lines: what it produced and what it allowed. */
export function TeamPropfinder({ abbr, pf }) {
  if (!pf) return null;
  const rows = [
    ...SIDES.map(([key, label]) => [key, label, pf[key]]),
    ...['LW', 'C', 'RW', 'D'].map((pos) => [`opp-${pos}`, `Allows to ${pos}`, pf.opponentsByPos?.[pos]]),
  ].filter(([, , t]) => t?.teams?.[abbr]);
  if (!rows.length) return <p className="nhlx-auto-meta">No PropFinder team stats for {abbr} yet — import an nhl-team-stats CSV below.</p>;
  const first = rows[0][2];
  return (
    <div className="nhlx-defcard nhlx-defcard-wide">
      <div className="nhlx-defcard-head">
        <div>
          <b>Team season stats · PropFinder</b>
          <small>{teamMeta(first, false).replace(' · rank 1 = highest', ' · "For" rank 1 = highest, "Against" rank 1 = most allowed')}</small>
        </div>
      </div>
      <div className="nhlx-db-table-wrap" style={{ boxShadow: 'none' }}>
        <table className="nhlx-deftable">
          <thead><tr><th></th><th>GP</th>{TEAM_COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {rows.map(([key, label, t]) => {
              const row = t.teams[abbr];
              const ranks = t.ranks?.[abbr] || {};
              const n = t.count || Object.keys(t.teams).length;
              return (
                <tr key={key}>
                  <td><b>{label}</b></td>
                  <td>{row.gp ?? '—'}</td>
                  {TEAM_COLS.map(([k, , d, dir]) => <Cell key={k} row={row} ranks={ranks} k={k} d={d} dir={dir} n={n} against={key !== 'teams'} />)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** League-wide PropFinder team table, sortable, with a For / Against switch. */
export function PropfinderTeamTable({ pf }) {
  const [sort, setSort] = useState('sog');
  const [side, setSide] = useState('teams');
  const [win, setWin] = useState('season');
  const against = side !== 'teams';
  // Against views can switch to a recent-games window when such exports were imported.
  const windows = [['season', 'Season'], ...Object.keys(pf?.opponentsByWindow || pf?.opponentsByPosWindow || {}).map((k) => [k, `Last ${k.slice(1)}`])];
  const w = against && win !== 'season' ? win : null;
  const t = side.startsWith('opp-')
    ? (w ? pf?.opponentsByPosWindow?.[w]?.[side.slice(4)] : pf?.opponentsByPos?.[side.slice(4)])
    : (w && side === 'opponents' ? pf?.opponentsByWindow?.[w] : pf?.[side]);
  const rows = useMemo(() => {
    if (!t?.teams) return [];
    const col = TEAM_COLS.find(([k]) => k === sort) || TEAM_COLS[0];
    // "For": best on top (high values first, giveaways last). "Against": most allowed on top.
    const dir = !against && col[3] === 'low' ? 1 : -1;
    return Object.entries(t.teams).sort((a, b) => dir * ((a[1][sort] ?? -Infinity) - (b[1][sort] ?? -Infinity)) || a[0].localeCompare(b[0]));
  }, [t, sort, against]);
  const n = t?.count || rows.length;
  const available = [...SIDES.filter(([key]) => pf?.[key]?.teams), ...['LW', 'C', 'RW', 'D'].filter((p) => pf?.opponentsByPos?.[p]?.teams).map((p) => [`opp-${p}`, `vs ${p}`])];
  return (
    <div className="nhlx-pf">
      <div className="nhlx-mu-top-head" style={{ marginTop: 36 }}>
        <div>
          <h3>Team season stats · PropFinder</h3>
          <p className="nhlx-auto-meta">{t ? teamMeta(t, against) : 'Not loaded yet.'} · click a column to sort</p>
        </div>
        <div className="nhlx-auto-actions">
          {against && windows.length > 1 && (
            <div className="nhlx-tabs" role="tablist" aria-label="Window">
              {windows.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={win === key} className={`nhlx-tab${win === key ? ' is-active' : ''}`} onClick={() => setWin(key)}>{label}</button>
              ))}
            </div>
          )}
          {available.length > 1 && (
            <div className="nhlx-tabs" role="tablist" aria-label="Table">
              {available.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={side === key} className={`nhlx-tab${side === key ? ' is-active' : ''}`} onClick={() => setSide(key)}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {rows.length ? (
        <div className="nhlx-db-table-wrap">
          <table className="nhlx-db-table nhlx-mp-table">
            <thead>
              <tr><th>Team</th><th>GP</th>{TEAM_COLS.map(([k, l]) => <th key={k} className={sort === k ? 'is-sorted' : ''} onClick={() => setSort(k)} style={{ cursor: 'pointer' }}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(([abbr, row]) => (
                <tr key={abbr}>
                  <td><div className="nhlx-db-player"><TeamLogo abbr={abbr} size={24} /><span><b>{abbr}</b><small>{row.name}</small></span></div></td>
                  <td>{row.gp ?? '—'}</td>
                  {TEAM_COLS.map(([k, , d, dir]) => <Cell key={k} row={row} ranks={t.ranks?.[abbr] || {}} k={k} d={d} dir={dir} n={n} against={against} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="nhlx-empty">No PropFinder team stats stored yet. Import an nhl-team-stats-*.csv export on the Teams tab.</div>}
    </div>
  );
}

/** PropFinder skater season rates (the exports are slate-sized, so this is the players it named). */
export function PropfinderSkaterTable({ pf }) {
  const open = usePlayerCard();
  const [pos, setPos] = useState('');
  const [sort, setSort] = useState('sog');
  const [all, setAll] = useState(false);
  const [win, setWin] = useState('skaters');
  const s = pf?.[win];
  const windows = [['skaters', 'Season'], ['skatersL5', 'Last 5']].filter(([k]) => pf?.[k]?.players);
  const cols = SKATER_COLS.filter(([k]) => s?.players?.some((p) => p[k] != null));
  const rows = useMemo(() => {
    if (!s?.players) return [];
    return s.players.filter((p) => !pos || p.pos === pos).sort((a, b) => ((b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)) || a.name.localeCompare(b.name));
  }, [s, pos, sort]);
  const shown = all ? rows : rows.slice(0, 40);
  return (
    <div className="nhlx-pf">
      <div className="nhlx-mu-top-head" style={{ marginTop: 36 }}>
        <div>
          <h3>Skater season rates · PropFinder</h3>
          <p className="nhlx-auto-meta">
            {s ? `${s.windowGames ? `last ${s.windowGames} games` : seasonLabel(s.season)} · all strengths, per game · ${s.count} skaters (${s.matched} matched to NHL players) · as of ${day(s.asOf)} · data from PropFinder` : 'Not loaded yet.'} · click a column to sort
          </p>
        </div>
        <div className="nhlx-auto-actions">
          {windows.length > 1 && (
            <div className="nhlx-tabs" role="tablist" aria-label="Window">
              {windows.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={win === k} className={`nhlx-tab${win === k ? ' is-active' : ''}`} onClick={() => setWin(k)}>{l}</button>
              ))}
            </div>
          )}
          <div className="nhlx-tabs" role="tablist" aria-label="Position">
            {POS_TABS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={pos === k} className={`nhlx-tab${pos === k ? ' is-active' : ''}`} onClick={() => setPos(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="nhlx-db-table-wrap">
            <table className="nhlx-db-table nhlx-mp-table">
              <thead>
                <tr><th>Player</th><th>Team</th><th>Pos</th>{cols.map(([k, l]) => <th key={k} className={sort === k ? 'is-sorted' : ''} onClick={() => setSort(k)} style={{ cursor: 'pointer' }}>{l}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={`${p.name}|${p.pos}`}>
                    <td>
                      <div className={`nhlx-db-player${p.id ? ' is-click' : ''}`} onClick={p.id ? () => open({ id: p.id }) : undefined} title={p.id ? 'Open player profile' : 'No NHL player matched this name'}>
                        {p.id ? <Headshot id={p.id} size={32} /> : null}
                        <span><b>{p.name}</b>{p.status ? <small>{p.status}</small> : null}</span>
                      </div>
                    </td>
                    <td>{p.team ? <div className="nhlx-db-player"><TeamLogo abbr={p.team} size={22} /><span>{p.team}</span></div> : '—'}</td>
                    <td>{p.pos || '—'}</td>
                    {cols.map(([k, , d]) => <td key={k}>{num(p[k], d)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 40 && (
            <p className="nhlx-auto-meta" style={{ marginTop: 8 }}>
              <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setAll(!all)}>{all ? 'Show the top 40' : `Show all ${rows.length}`}</button>
            </p>
          )}
        </>
      ) : <div className="nhlx-empty">No PropFinder skater stats stored yet. Import an nhl-skater-stats-*.csv export on the Teams tab.</div>}
    </div>
  );
}
