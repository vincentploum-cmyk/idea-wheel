'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { MpCell } from './MoneyPuck';
import { PfTable, PosBadge, Sel, SortTh, Tag, UnderlineTabs } from './pf-ui';
import { TeamLink } from './links';
import { SKATER_COLS, TEAM_COLS, seasonLabel, defaultDefenseTab } from '@/lib/nhl-data/propfinder-csv';
import { teamName } from '@/lib/nhl-data/teams';

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
  const winLabel = (k) => `Last ${k.match(/\d+/)[0]}${k.endsWith('home') ? ' home' : k.endsWith('away') ? ' away' : ''}`;
  const windows = [['season', 'Season'], ...[...new Set([...Object.keys(pf?.opponentsByWindow || {}), ...Object.keys(pf?.opponentsByPosWindow || {})])].map((k) => [k, winLabel(k)])];
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

/** PropFinder skater rates, laid out as its Skaters table: window tabs, position dropdown, sortable columns. */
export function PropfinderSkaterTable({ pf }) {
  const open = usePlayerCard();
  const [pos, setPos] = useState('All');
  const [sort, setSort] = useState('sog');
  const [all, setAll] = useState(false);
  const [win, setWin] = useState('skaters');
  const s = pf?.[win];
  const windows = [['skaters', seasonLabel(pf?.skaters?.season) || 'Season'], ['skatersL5', 'Last 5'], ['skatersL5Home', 'Last 5 Home'], ['skatersL5Away', 'Last 5 Away']].filter(([k]) => pf?.[k]?.players);
  const cols = SKATER_COLS.filter(([k]) => s?.players?.some((p) => p[k] != null));
  const rows = useMemo(() => {
    if (!s?.players) return [];
    return s.players.filter((p) => pos === 'All' || p.pos === pos).sort((a, b) => ((b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)) || a.name.localeCompare(b.name));
  }, [s, pos, sort]);
  const shown = all ? rows : rows.slice(0, 40);
  const label = (l) => ({ 'G/G': 'Goals/G', 'A/G': 'Ast/G', 'SOG/G': 'S/G', 'PTS/G': 'Pts/G' })[l] || l;
  return (
    <div className="nhlx-pf nhlx-pf-skaters" style={{ marginTop: 36 }}>
      {windows.length > 1 && <UnderlineTabs items={windows} value={win} onChange={setWin} label="Window" />}
      <div className="nhlx-pf-bar">
        <h3>Skaters</h3>
        <p className="nhlx-auto-meta">
          {s ? `${s.windowGames ? `last ${s.windowGames}${s.split === 'H' ? ' home' : s.split === 'A' ? ' away' : ''} games` : seasonLabel(s.season)} · all strengths, per game · ${s.count} skaters · as of ${day(s.asOf)} · PropFinder` : 'Not loaded yet.'}
        </p>
        <Sel label="Position" value={pos} onChange={setPos} options={POS_TABS.map(([k, l]) => [k || 'All', l])} />
      </div>
      {rows.length ? (
        <>
          <PfTable>
            <thead>
              <tr>
                <th className="is-left">Player</th>
                <th>Team</th>
                {cols.map(([k, l]) => <SortTh key={k} k={k} label={label(l)} sort={sort} onSort={setSort} />)}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={`${p.name}|${p.pos}`} className={p.id ? 'is-click' : ''} onClick={p.id ? () => open({ id: p.id }) : undefined} title={p.id ? 'Open player profile' : 'No NHL player matched this name'}>
                  <td className="is-left">
                    <div className="nhlx-pft-player">
                      {p.id ? <Headshot id={p.id} size={30} /> : null}
                      <b>{p.name}</b>
                      <PosBadge pos={p.pos} />
                      <Tag tone="is-bad">{p.status}</Tag>
                    </div>
                  </td>
                  <td>{p.team ? <span className="nhlx-pft-team"><TeamLogo abbr={p.team} size={20} /> {p.team}</span> : '—'}</td>
                  {cols.map(([k, , d]) => <td key={k} className={sort === k ? 'is-sorted' : ''}>{num(p[k], d)}</td>)}
                </tr>
              ))}
            </tbody>
          </PfTable>
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

/** PropFinder's own colouring, read from the shooter's side: rank 1 = most allowed. */
const defTone = (rank, n) => (!rank || !n ? '' : rank <= Math.ceil(n / 3) ? 'is-soft' : rank > n - Math.ceil(n / 3) ? 'is-tough' : 'is-mid');
const DEF_POS = ['All', 'C', 'LW', 'RW', 'D'];

/**
 * The defense table above a rink, in PropFinder's format: what `abbr` allowed per game
 * (or in total) to every position, one tab per season / recent-games window (L10 selected,
 * else the current season), each cell carrying PropFinder's league rank; a column header sorts
 * the position rows (All stays on top). `data` is a slate side's `propfinder`.
 * With `tabKey` / `onTabChange` the rink owns the selected tab (when the table tints the ice);
 * `drivesRink` says so in the head.
 */
export function PropfinderDefense({ abbr, data, posFilter = '', tabKey: controlledKey = undefined, onTabChange = null, drivesRink = false }) {
  const tabs = data?.tabs || [];
  const [ownKey, setOwnKey] = useState(null);
  const [total, setTotal] = useState(false);
  const [sort, setSort] = useState(null);
  const tabKey = controlledKey === undefined ? ownKey : controlledKey;
  const setTabKey = (k) => { setOwnKey(k); if (onTabChange) onTabChange(k); };
  // Last 10 games by default (the window that reads a defense's current form), then the latest season.
  const tab = tabs.find((t) => t.key === tabKey) || defaultDefenseTab(tabs);
  if (!tab) return null;
  const cols = data.cols.filter(([k]) => DEF_POS.some((pos) => tab.rows[pos]?.[k] != null));
  const n = tab.count;
  const order = sort ? ['All', ...DEF_POS.slice(1).filter((p) => tab.rows[p]).sort((a, b) => (tab.rows[b][sort] ?? -Infinity) - (tab.rows[a][sort] ?? -Infinity))] : DEF_POS;
  const cell = (row, k) => {
    const v = row[k];
    if (v == null) return <td key={k}><span className="nhlx-pfd-val">—</span></td>;
    const r = row.ranks?.[k];
    return (
      <td key={k} className={defTone(r, n)}>
        <span className="nhlx-pfd-val">{total ? Math.round(v * (row.gp || 0)) : Number(v).toFixed(2)}</span>
        {r ? <span className="nhlx-pfd-rank">#{r}</span> : null}
      </td>
    );
  };
  const when = tab.kind === 'season' ? `${tab.label} season` : `last ${tab.windowGames}${tab.split === 'H' ? ' home' : tab.split === 'A' ? ' away' : ''} games`;
  return (
    <div className="nhlx-pfd" aria-label={`${abbr} defense, PropFinder`}>
      <div className="nhlx-pfd-head" title={`What ${teamName(abbr) || abbr} allowed ${total ? 'in total' : 'per game'} to each position · ${when}${tab.rows.All?.gp ? ` · ${tab.rows.All.gp} GP` : ''} · rank 1 = most allowed of ${n} · data from PropFinder`}>
        <TeamLink abbr={abbr} logo={22}><b>{teamName(abbr) || abbr} defense</b></TeamLink>
        {drivesRink ? <span className="nhlx-chip nhlx-chip-blue" title="The selected tab tints the rink below">tints the rink</span> : null}
        <label className="nhlx-pfd-switch">
          <span className={total ? '' : 'is-on'}>Per game</span>
          <input type="checkbox" role="switch" checked={total} aria-checked={total} aria-label="Show totals instead of per game" onChange={(e) => setTotal(e.target.checked)} />
          <i aria-hidden="true" />
          <span className={total ? 'is-on' : ''}>Total</span>
        </label>
      </div>
      {tabs.length > 1 && (
        <div className="nhlx-tabs nhlx-rk-tabs nhlx-pfd-tabs" role="tablist" aria-label={`Window of ${abbr}'s PropFinder table`}>
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab.key === t.key} className={`nhlx-tab${tab.key === t.key ? ' is-active' : ''}`} onClick={() => setTabKey(t.key)}>{t.label}</button>
          ))}
        </div>
      )}
      <div className="nhlx-pfd-wrap">
        <table className="nhlx-pfd-table">
          <thead>
            <tr>
              <th>Position</th>
              {cols.map(([k, l]) => (
                <th key={k} className={sort === k ? 'is-sorted' : ''}>
                  <button type="button" onClick={() => setSort(sort === k ? null : k)} title={sort === k ? 'Back to position order' : `Sort positions by ${l}`}>{total ? l.replace('/G', '') : l}{sort === k ? <i aria-hidden="true">↓</i> : null}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((pos) => {
              const row = tab.rows[pos];
              if (!row) return null;
              return (
                <tr key={pos} className={posFilter && pos !== 'All' && pos !== posFilter ? 'is-muted' : ''}>
                  <td><b>{pos}</b></td>
                  {cols.map(([k]) => cell(row, k))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
