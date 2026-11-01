'use client';

import { useState } from 'react';
import { NBA_BIG } from '@/lib/nba/big';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

// The Big games tab (Vincent, 2026-11-01: "Do the same big games study for the NBA"; lib/nba/big.js,
// docs/audits/2026-11-01-nba-big-games.md): per stat the night's likeliest 30+ / 40+ points, 12+ / 15+ rebounds, 10+ / 12+
// assists, 5+ / 7+ threes and 40+ / 50+ PRA, the reason beside each name, cut to one game by the head's dropdown.
const KINDS = Object.entries(NBA_BIG).map(([k, v]) => [k, v.label]);
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

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    The players likeliest to have a <b>big game</b> tonight. Checked on 2025-26 and this season’s box scores, what predicts one is his projection plus how often he has done it lately (his last 20 games; for threes, the threes he takes). The matchup, pace and the line did not. Long shots, not safe plays.
  </p>
);

/** The Big games tab: per stat the night's likeliest big games; `game` cuts it to one game (the head's dropdown). */
export default function NbaBigGames({ board, game = null }) {
  const [market, setMarket] = useState('pts');
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  return (
    <NbaPlayerCardProvider date={board.date}>
      <div className="ir-overview">
        <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Stat">
          {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-tab${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>{l}</button>)}
        </div>
        <Rows board={board} market={market} game={game} />
        {LEGEND}
      </div>
    </NbaPlayerCardProvider>
  );
}
