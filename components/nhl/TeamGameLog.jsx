'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './player-card-context';
import { PfTable, PosBadge, Sel, Tag } from './pf-ui';
import { DEF_SLOTS } from '@/lib/nhl-data/defense';

// The team page's game log, as PropFinder's "RW vs TOR": every skater-game against the
// team, filtered by line slot (LW1 … RW4, D1 … D3), venue and result, with the shots or
// goals column coloured against a line: green over, red under. The player card draws the
// same log under the opponent's Defense Allowed panel (`compact`): opened on the player's
// position and tonight's venue, the stat and line following the card's market tab
// (`stat` / `line` controlled), his own games against that team marked.

const STATS = { sog: { label: 'Shots', lines: [0.5, 1.5, 2.5, 3.5, 4.5], def: 2.5 }, g: { label: 'Goals', lines: [0.5, 1.5], def: 0.5 } };
const SLOT_OPTS = [['', 'All slots'], ...DEF_SLOTS.map((s) => [s, s]), ['LW', 'All LW'], ['C', 'All C'], ['RW', 'All RW'], ['D', 'All D'], ['box', 'No line (box score)']];
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const mdy = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(2, 4)}` : '');
const seasonOf = (date) => { const y = Number(date.slice(0, 4)); return Number(date.slice(5, 7)) >= 7 ? y : y - 1; };
const seasonLabel = (y) => `${y}-${String(y + 1).slice(2)}`;
const PAGE = 60;

/** Over / under share of the last N games (distinct games, newest first) for the active stat and line. */
function window(rows, n, key, line) {
  const ids = [...new Set(rows.map((r) => r.gameId))].slice(0, n);
  const inWin = rows.filter((r) => ids.includes(r.gameId));
  if (!inWin.length) return null;
  const over = inWin.filter((r) => r[key] > line).length;
  return { n: inWin.length, games: ids.length, over: Math.round((over / inWin.length) * 100), under: Math.round(((inWin.length - over) / inWin.length) * 100) };
}

function Seg({ items, value, onChange, label }) {
  return (
    <div className="nhlx-seg" role="group" aria-label={label}>
      {items.map(([k, l]) => <button key={k} type="button" className={`nhlx-seg-btn${value === k ? ' is-active' : ''}`} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export default function TeamGameLog({ abbr, compact = false, initial = {}, stat: statProp = null, line: lineProp = null, highlightId = null }) {
  const open = usePlayerCard();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [slot, setSlot] = useState(initial.slot || '');
  const [venue, setVenue] = useState(initial.venue || '');
  const [result, setResult] = useState('');
  const [ownStat, setStat] = useState('sog');
  const [lines, setLines] = useState({ sog: STATS.sog.def, g: STATS.g.def });
  // Inside the player card the stat and line are the card's (its market tab and Line select).
  const stat = statProp || ownStat;
  const [season, setSeason] = useState('');
  const [all, setAll] = useState(false);

  // Keyed by team in the parent, so a new team mounts a fresh log.
  useEffect(() => {
    let live = true;
    fetch(`/api/nhl/data/defense/log?team=${abbr}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => { if (live) setData(j); })
      .catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [abbr]);

  const seasons = useMemo(() => [...new Set((data?.rows || []).map((r) => seasonOf(r.date)))].sort((a, b) => b - a), [data]);
  // The newest season with rows by default; 'all' lifts the filter.
  const picked = season === 'all' ? '' : season || (seasons[0] != null ? String(seasons[0]) : '');
  const rows = useMemo(() => (data?.rows || []).filter((r) => (
    (!picked || seasonOf(r.date) === Number(picked))
    && (!slot || (slot === 'box' ? !r.line : slot.length <= 2 ? r.pos === slot : r.slot === slot))
    && (!venue || r.venue === venue)
    // The player's result is the team's inverse: a loss for him is a win for `abbr`.
    && (!result || (result === 'W' ? r.result === 'L' : r.result === 'W'))
  )), [data, picked, slot, venue, result]);
  const line = lineProp ?? lines[stat];
  const l5 = window(rows, 5, stat, line);
  const l10 = window(rows, 10, stat, line);
  const games = new Set(rows.map((r) => r.gameId)).size;
  const avg = rows.length ? rows.reduce((s, r) => s + r[stat], 0) / rows.length : null;
  const shown = all ? rows : rows.slice(0, PAGE);
  const who = slot ? (slot === 'box' ? 'Box-score positions' : slot.length <= 2 ? `${slot}s` : slot) : 'Skaters';
  const title = `${who} vs ${abbr}`;
  const tone = (r) => (r[stat] > line ? 'is-over' : 'is-under');
  const counts = data ? `${games} games, ${rows.length} skater-games${avg != null ? ` · ${num(avg, 2)} ${STATS[stat].label.toLowerCase()} per skater` : ''}` : '';

  return (
    <div className={`nhlx-gl${compact ? ' is-compact' : ''}`}>
      <div className="nhlx-gl-head">
        <h4>{title}</h4>
        <p className="nhlx-auto-meta">
          {compact ? `Box scores of every skater at the position who faced ${abbr}, by line slot${counts ? ` · ${counts}` : ''}` : `Box scores of every skater who faced ${abbr}, by his line slot in that game${counts ? ` · ${counts}` : ''}`}
        </p>
        <div className="nhlx-gl-windows">
          {[['L5', l5], ['L10', l10]].map(([k, w]) => (
            <span key={k} className="nhlx-gl-win"><small>{k}:</small>{w ? <><i className="is-over">{w.over}% Over</i><i className="is-under">{w.under}% Under</i></> : <i>—</i>}</span>
          ))}
        </div>
      </div>
      <div className="nhlx-gl-controls">
        {!statProp && <Seg label="Stat" items={[['sog', 'Shots'], ['g', 'Goals']]} value={stat} onChange={setStat} />}
        {lineProp == null && <Sel label="Line" value={line} onChange={(v) => setLines({ ...lines, [stat]: Number(v) })} options={STATS[stat].lines.map((l) => [l, `${l}`])} />}
        <Sel label="Slot" value={slot} onChange={setSlot} options={SLOT_OPTS} />
        <Seg label="Venue" items={[['', 'All'], ['A', `@ ${abbr}`], ['H', `vs ${abbr}`]]} value={venue} onChange={setVenue} />
        <Seg label="Result" items={[['', 'All'], ['W', `${abbr} win`], ['L', `${abbr} loss`]]} value={result} onChange={setResult} />
        {seasons.length > 1 && <Sel label="Season" value={season || picked} onChange={(v) => setSeason(v)} options={[...seasons.map((y) => [String(y), seasonLabel(y)]), ['all', 'All seasons']]} />}
      </div>
      {err && <div className="nhlx-alert">⚠ Couldn’t load the game log: {err}</div>}
      {!data && !err && <p className="nhlx-auto-meta">Loading game log…</p>}
      {data && !rows.length && <div className="nhlx-empty">No stored skater-games against {abbr} match these filters.</div>}
      {rows.length > 0 && (
        <>
          <PfTable className="nhlx-gl-table">
            <thead>
              <tr>
                <th className="is-left">Date</th><th>W/L</th><th>H/A</th><th className="is-left">Player</th><th className="nhlx-gl-line">Line</th><th>TOI</th>
                <th className={stat === 'g' ? 'is-sorted' : ''}>Goals</th>{!compact && <><th>Ast</th><th>Pts</th></>}
                <th className={stat === 'sog' ? 'is-sorted' : ''}>Shots</th>{!compact && <><th>Hits</th><th>Blk</th></>}<th>iCF</th><th>iSCF</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.gameId}-${r.playerId}`} className={`${r.playerId ? 'is-click' : ''}${highlightId != null && r.playerId === highlightId ? ' is-mine' : ''}`} onClick={() => r.playerId && open({ id: r.playerId, opp: abbr, venue: r.venue })}>
                  <td className="is-left">{mdy(r.date)}</td>
                  <td className={r.result === 'W' ? 'is-win' : r.result === 'L' ? 'is-loss' : ''}>{r.result || '—'}</td>
                  <td>{r.venue}</td>
                  {/* On phones the Line column is hidden and the slot sits under the name (`.nhlx-gl-tags`). */}
                  <td className="is-left">
                    <div className="nhlx-pft-player">
                      <TeamLogo abbr={r.team} size={20} /><Headshot id={r.playerId} size={26} />
                      <span className="nhlx-gl-who"><b>{r.name}</b><span className="nhlx-gl-tags"><PosBadge pos={r.pos} />{r.slot ? <Tag>{r.slot}</Tag> : null}</span></span>
                    </div>
                  </td>
                  <td className="nhlx-gl-line">{r.slot ? <Tag>{r.slot}</Tag> : <span className="nhlx-auto-meta">—</span>}</td>
                  <td>{num(r.toi)}</td>
                  <td className={stat === 'g' ? tone(r) : ''}>{r.g}</td>
                  {!compact && <><td>{r.a}</td><td>{r.pts}</td></>}
                  <td className={stat === 'sog' ? tone(r) : ''}>{r.sog}</td>
                  {!compact && <><td>{r.hits}</td><td>{r.blk}</td></>}
                  <td>{r.icf}</td>
                  <td>{r.iscf}</td>
                </tr>
              ))}
            </tbody>
          </PfTable>
          {rows.length > PAGE && (
            <p className="nhlx-auto-meta" style={{ marginTop: 8 }}>
              <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setAll(!all)}>{all ? `Show the latest ${PAGE}` : `Show all ${rows.length}`}</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
