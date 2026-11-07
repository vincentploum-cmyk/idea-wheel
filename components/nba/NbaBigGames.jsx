'use client';

import { useState } from 'react';
import { NBA_BIG, NBA_OUTLIERS } from '@/lib/nba/big';
import { fmtOdds } from '@/lib/nfl/odds';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

// The Big games tab (Vincent, 2026-11-01: "Do the same big games study for the NBA"; lib/nba/big.js,
// docs/audits/2026-11-01-nba-big-games.md): per stat the night's likeliest 30+ / 40+ points, 12+ / 15+ rebounds, 10+ / 12+
// assists, 5+ / 7+ threes and 40+ / 50+ PRA, the reason beside each name, cut to one game by the head's dropdown. Beside
// them the Outliers (Vincent, 2026-11-07: "build the outliers list on the big games tab"): per stat the night's likeliest to
// reach double his projection, with the book's price at that mark where its ladder has it (lib/nba/big.js nbaOutliers).
const KINDS = Object.entries(NBA_BIG).map(([k, v]) => [k, v.label]);
const OUT_KINDS = Object.entries(NBA_OUTLIERS).map(([k, v]) => [k, v.label]);
const SHOW = 25;
const pct = (v) => (v == null ? '—' : v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);
const why = (r) => (r.market === 'tpm' ? `${r.ctx.tpa5} threes attempted a game lately` : `${r.marks[0]}+ in ${r.ctx.hits[r.marks[0]]} of his last ${r.ctx.n}`);

function Rows({ board, market, game }) {
  const [all, setAll] = useState(false);
  const open = useNbaPlayerCard();
  const big = board?.big;
  const rows = (big?.lists?.[market] || []).map((id) => big.rows[id]).filter((r) => r && (!game || r.game === game));
  if (!rows.length) return <p className="nhlx-auto-meta ir-ml-empty">No big-game candidate yet: the night needs a PropFinder pull.</p>;
  const marks = rows[0].marks;
  const final = rows.some((r) => r.final);
  const shown = all ? rows : rows.slice(0, SHOW);
  const openRow = (r) => {
    const side = (board.games || []).find((g) => g.id === r.game)?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-ml-table ir-big-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th><th>Player</th>
            {marks.map((mk, i) => <th key={mk} className={`is-num${i === 0 ? ' is-lead' : ''}`} title={`His chance of ${mk}+ tonight`}>{mk}+</th>)}
            <th className="is-num" title="Tonight’s projection">Proj</th>
            <th className="ir-big-why">Why</th>
            {final ? <th className="is-num">Got</th> : null}
          </tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id}>
                <td className="ir-slate-rank">{i + 1}</td>
                <td>
                  <button type="button" className="ir-big-name" onClick={() => openRow(r)}><b>{r.player}</b></button>
                  <small className="ir-big-sub">{r.team} · {r.pos || ''} · {r.venue === 'H' ? 'vs' : '@'} {r.opp}{r.health === 'DTD' ? ' · DTD' : ''}</small>
                  <small className="ir-big-why-m">{why(r)}</small>
                </td>
                {marks.map((mk, j) => <td key={mk} className={`is-num${j === 0 ? ' is-lead' : ''}${r.got ? (r.got[mk] ? ' is-hit' : ' is-miss') : ''}`}><b>{pct(r.p[mk])}</b></td>)}
                <td className="is-num">{r.proj}</td>
                <td className="ir-big-why"><small>{why(r)}</small></td>
                {final ? <td className="is-num nhlx-pk-got">{r.actual == null ? <small>—</small> : <b>{r.actual}</b>}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && rows.length > SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

/** Why a player is on the outliers list: a start off the bench, the teammates out, his nights at the mark lately, his minutes. */
export function outlierWhy(r) {
  const parts = [];
  if (r.role === 'promoted') parts.push('Starts tonight');
  if (r.role === 'demoted') parts.push('Off the bench tonight');
  if (r.outFrom?.length) parts.push(`${r.outFrom.join(' + ')} out`);
  parts.push(`${r.mark}+ in ${r.hits} of his last ${r.n}`);
  if (r.minutes != null) parts.push(`${Math.round(r.minutes)} min`);
  return parts.join(' · ');
}

function OutlierRows({ board, market, game }) {
  const [all, setAll] = useState(false);
  const open = useNbaPlayerCard();
  const o = board?.big?.outliers;
  const rows = (o?.lists?.[market] || []).map((id) => o.rows[id]).filter((r) => r && (!game || r.game === game));
  if (!rows.length) return <p className="nhlx-auto-meta ir-ml-empty">No outlier candidate yet: the night needs a PropFinder pull.</p>;
  const final = rows.some((r) => r.final);
  const shown = all ? rows : rows.slice(0, SHOW);
  const openRow = (r) => {
    const side = (board.games || []).find((g) => g.id === r.game)?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-ml-table ir-big-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th><th>Player</th>
            <th className="is-num" title="Double his projection, and at least this much over it">Mark</th>
            <th className="is-num is-lead" title="His chance of the mark tonight">Chance</th>
            <th className="is-num" title="Tonight’s projection">Proj</th>
            <th className="is-num ir-out-line" title="The book’s main line">Line</th>
            <th className="is-num" title="The book’s price at the mark, where its ladder has the rung, and the chance over its implied one">Book</th>
            <th className="ir-big-why">Why</th>
            {final ? <th className="is-num">Got</th> : null}
          </tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id}>
                <td className="ir-slate-rank">{i + 1}</td>
                <td>
                  <button type="button" className="ir-big-name" onClick={() => openRow(r)}><b>{r.player}</b></button>
                  <small className="ir-big-sub">{r.team} · {r.pos || ''} · {r.venue === 'H' ? 'vs' : '@'} {r.opp}{r.health === 'DTD' ? ' · DTD' : ''}</small>
                  <small className="ir-big-why-m">{outlierWhy(r)}</small>
                </td>
                <td className="is-num"><b>{r.mark}+</b></td>
                <td className={`is-num is-lead${r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss'}`} title={r.raw !== r.p ? `The board's tail at ${r.mark}+: ${pct(r.raw)}, fitted to what landed at the mark over 2025-26` : `The board's tail at ${r.mark}+`}><b>{pct(r.p)}</b></td>
                <td className="is-num">{r.proj}</td>
                <td className="is-num ir-out-line">{r.line != null ? r.line : <small>—</small>}</td>
                <td className="is-num" title={r.book ? `o${r.book.line} at ${fmtOdds(r.book.odds)}: the book says ${pct(r.book.implied)}, the board ${pct(r.p)}` : 'The book’s ladder has no rung at the mark'}>{r.book ? <><b>{fmtOdds(r.book.odds)}</b><small className={`ir-out-edge${r.book.edge > 0 ? ' is-pos' : ''}`}> {r.book.edge >= 0 ? '+' : '−'}{Math.abs(Math.round(r.book.edge * 100))}</small></> : <small>—</small>}</td>
                <td className="ir-big-why"><small>{outlierWhy(r)}</small></td>
                {final ? <td className="is-num nhlx-pk-got">{r.actual == null ? <small>—</small> : <b>{r.actual}</b>}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && rows.length > SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

const OUT_LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    The players likeliest to reach <b>double their projection</b> tonight (and at least 4 rebounds or assists, 2 threes, 10 points over it): the nights the books price long. The chance is the board’s own, fitted to what landed at the mark over 2025-26; each night’s top ten landed about 8% for rebounds (4.6% for everyone), 16% for threes (9%). A start off the bench and teammates out are what move it most. Where the book’s ladder prices the mark, its price and the edge in points. Long shots: a few a night land.
  </p>
);

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    The players likeliest to have a <b>big game</b> tonight. Checked on 2025-26 and this season’s box scores, what predicts one is his projection plus how often he has done it lately (his last 20 games; for threes, the threes he takes). The matchup, pace and the line did not. Long shots, not safe plays.
  </p>
);

/** The Big games tab: per stat the night's likeliest big games; `game` cuts it to one game (the head's dropdown). */
export default function NbaBigGames({ board, game = null, initialView = 'big' }) {
  const [view, setView] = useState(initialView);
  const [market, setMarket] = useState('pts');
  const [outMarket, setOutMarket] = useState('reb');
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  const kinds = view === 'big' ? KINDS : OUT_KINDS;
  const current = view === 'big' ? market : outMarket;
  const pick = view === 'big' ? setMarket : setOutMarket;
  return (
    <NbaPlayerCardProvider date={board.date}>
      <div className="ir-overview">
        <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="List">
          {[['big', 'Big games'], ['outliers', 'Outliers']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={`nhlx-tab${view === k ? ' is-active' : ''}`} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Stat">
          {kinds.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={current === k} className={`nhlx-tab${current === k ? ' is-active' : ''}`} onClick={() => pick(k)}>{l}</button>)}
        </div>
        {view === 'big' ? <Rows board={board} market={market} game={game} /> : <OutlierRows board={board} market={outMarket} game={game} />}
        {view === 'big' ? LEGEND : OUT_LEGEND}
      </div>
    </NbaPlayerCardProvider>
  );
}
