'use client';

// The Teammates out tab (Vincent, 2026-11-23: "I don't see the badge. I need a separate view with all players that have an
// advantage bc another player is out"): every active player whose teammate is out tonight, his season with and without
// that teammate (the player card's "With and without each teammate" figures, lib/picks/out-boosts.js on the board as
// `outBoosts`), the biggest gain first, tonight's projection and the book's line beside it. A row opens the player's card.
import { useMemo, useState } from 'react';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

const STATS = [['min', 'MIN'], ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['pra', 'PRA']];
const SORTS = [['min', 'Minutes'], ['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['pra', 'PRA']];
const SHOW = 40;
const num = (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : Number(v).toFixed(1));
const signed = (v) => (v == null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${num(Math.abs(v))}`);
const LIMIT = { min: 3, pts: 2, reb: 1, ast: 1, tpm: 1, pra: 3 };   // the card's tint: a move this big is coloured

function Rows({ board, game }) {
  const open = useNbaPlayerCard();
  const [sort, setSort] = useState('min');
  const [gains, setGains] = useState(true);
  const [two, setTwo] = useState(true);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => (board?.outBoosts || [])
    .filter((r) => !game || r.game === game)
    .filter((r) => !two || r.gpWithout >= 2)
    .filter((r) => !gains || (r.stats[sort]?.gap ?? 0) > 0)
    .sort((a, b) => (b.stats[sort]?.gap ?? -99) - (a.stats[sort]?.gap ?? -99)), [board, game, sort, gains, two]);
  const openRow = (r) => {
    const g = (board.games || []).find((x) => x.id === r.game); const side = g?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: side?.venue, market: sort === 'min' ? 'pts' : sort });
  };
  const outCount = new Set((board?.outBoosts || []).filter((r) => !game || r.game === game).map((r) => `${r.team}|${r.out.key}`)).size;
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <>
      <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Sort by the gain in">
        {SORTS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={sort === k} className={`nhlx-tab${sort === k ? ' is-active' : ''}`} onClick={() => setSort(k)}>{l}</button>)}
      </div>
      <div className="ir-ob-filters">
        <label className="nhlx-pc-check"><input type="checkbox" checked={gains} onChange={(e) => setGains(e.target.checked)} /> Gains only</label>
        <label className="nhlx-pc-check"><input type="checkbox" checked={two} onChange={(e) => setTwo(e.target.checked)} /> 2+ games without him</label>
        <small className="nhlx-auto-meta">{outCount} player{outCount === 1 ? '' : 's'} out · {rows.length} teammate{rows.length === 1 ? '' : 's'} listed</small>
      </div>
      {!rows.length ? <p className="nhlx-auto-meta ir-ml-empty">{(board?.outBoosts || []).length ? 'Nobody under these filters.' : 'Nobody out tonight has played beside a listed teammate this season, or the night has no PropFinder pull yet.'}</p> : (
        <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
          <table className="nhlx-db-table nhlx-pk-table ir-ob-table">
            <thead><tr>
              <th className="ir-slate-rank">#</th>
              <th title="The teammate out tonight and his games this season without him, with him under the name">Player</th>
              {STATS.map(([k, l]) => <th key={k} className={`is-num${k === sort ? ' is-lead' : ''}`} title={`${l} a game: with him → without him, the gap under it`}>{l}</th>)}
              <th className="is-num" title="Tonight: the board’s projection and the book’s main line for the sorted stat (points under minutes)">Tonight</th>
            </tr></thead>
            <tbody>
              {shown.map((r, i) => {
                const tk = sort === 'min' ? 'pts' : sort; const t = r.proj?.[tk];
                return (
                  <tr key={`${r.team}|${r.key}|${r.out.key}`}>
                    <td className="ir-slate-rank">{i + 1}</td>
                    <td className="ir-ob-player">
                      <button type="button" className="ir-big-name" onClick={() => openRow(r)}><b>{r.player}</b></button>
                      <small>{r.team} · {r.pos || ''} · vs {r.opp}</small>
                      <small className="ir-ob-out" title={`${r.out.name}${r.out.pos ? ` (${r.out.pos})` : ''}: ${r.out.status || 'Out'}${r.out.detail ? `, ${r.out.detail}` : ''}. His games this season with him: ${r.gpWith}, without him: ${r.gpWithout}.`}>w/o <b>{r.out.name}</b> · {r.gpWithout} game{r.gpWithout === 1 ? '' : 's'} without, {r.gpWith} with</small>
                    </td>
                    {STATS.map(([k]) => {
                      const s = r.stats[k];
                      if (!s) return <td key={k} className="is-num"><small>—</small></td>;
                      const tone = Math.abs(s.gap) >= LIMIT[k] ? (s.gap > 0 ? ' is-soft' : ' is-tough') : '';
                      return <td key={k} className={`is-num ir-ob-cell${tone}${k === sort ? ' is-lead' : ''}`}><span>{num(s.with)} → <b>{num(s.without)}</b></span><small>{signed(s.gap)}</small></td>;
                    })}
                    <td className="is-num">{t?.exp != null ? <><b>{num(t.exp)}</b><small>{t.line != null ? `line ${t.line}` : 'no line'} · {tk.toUpperCase()}</small></> : <small>—</small>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!all && rows.length > SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
      <p className="nhlx-auto-meta ir-bd-legend">
        Every player whose teammate is out tonight: his averages this season in the games they played together and in the games the teammate sat (the same figures as the player card’s <b>With and without each teammate</b>), the biggest gain first. <b>Tonight</b> is the board’s projection, which already lifts him for the absence. Tested on 2024-25 to now, splits this big land near the board’s projection, not the without average: a split of +8 points or more said 18–22 and landed about 15 (docs/audits/2026-11-23-nba-own-without.md). Read the gap as who gets the minutes; bet against the projection and the line.
      </p>
    </>
  );
}

/** The Teammates out tab; `game` cuts it to one game (the head's dropdown). */
export default function NbaOutBoosts({ board, game = null }) {
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  return (
    <NbaPlayerCardProvider date={board.date}>
      <div className="ir-overview"><Rows board={board} game={game} /></div>
    </NbaPlayerCardProvider>
  );
}
