'use client';

// The Soft spots list on the Best plays tab (Vincent, 2026-11-10, of the NHL's list on Best bets: "We should do the same
// with nba"): every regular whose opponent tonight is among the five most permissive in the league at his position for
// points, rebounds, assists or threes (the season table the board reads), with the board's projection, the book's main
// line, the board's chance of the over, the break-even price and the edge; graded once the game is final. Read off the
// board the page holds (lib/nba/soft-spots.js softSpots); a row opens the player's card.
import { useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { reliableTone } from '@/lib/picks/reliability';
import { softSpots, topSpotText, statShort, SOFT_TOP, SOFT_SHOWN, REGULAR_MIN } from '@/lib/nba/soft-spots';
import { ordinal } from '@/lib/nba/sheet-matchups';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const pts = (e) => (e == null ? '—' : `${e >= 0 ? '+' : '−'}${Math.abs(Math.round(e * 100))}`);
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

/**
 * `board` = the board the slate shows (one game when the head's dropdown picked one); `sport` = { headshotUrl, teamLogo }.
 * `plain` (the Games tab, Vincent's rule of 2026-11-01 for the NBA and NFL pages: "Remove the edge, implies, juice"): no
 * Edge column, no prices, no break-even; the line, the chance and the result stay.
 */
export default function NbaSoftSpots({ board, sport, onOpen = null, plain = false }) {
  // Plain: the lines by the board's chance (no edge to order by), then the projections alone by the projection.
  const rows = useMemo(() => {
    const list = softSpots(board);
    return plain ? [...list].sort((x, y) => (x.p == null) - (y.p == null) || (y.p ?? 0) - (x.p ?? 0) || (y.exp ?? 0) - (x.exp ?? 0)) : list;
  }, [board, plain]);
  const [all, setAll] = useState(false);
  if (!board?.games?.length) return null;
  const shown = all ? rows : rows.slice(0, SOFT_SHOWN);
  const final = rows.some((r) => r.final);
  const reliability = board.reliability || null;
  const graded = rows.filter((r) => r.hit != null);
  const cols = (final ? 9 : 8) - (plain ? 1 : 0);
  return (
    <section className="ir-slate ir-ss" aria-label="Soft spots">
      <div className="nhlx-pfd-head">
        <b>Soft spots</b>
        <small className="nhlx-auto-meta">
          {rows.length} spot{rows.length === 1 ? '' : 's'}: a regular against one of the {SOFT_TOP} defenses that give up the most to his position for points, rebounds, assists or threes (this season’s table, #1 = the most) · regulars = projected {REGULAR_MIN}+ minutes tonight · {plain ? 'the lines with the best chance first, then the projection alone' : 'the priced lines by edge, then the chance, then the projection alone'}{graded.length ? ` · ${graded.filter((r) => r.hit).length} of ${graded.length} over the line` : ''}{onOpen ? ' · click a row for the card' : ''}
        </small>
      </div>
      {!rows.length ? <p className="nhlx-auto-meta">No regular faces a defense in the top {SOFT_TOP} at his position tonight{board.games.length === 1 ? ' in this game' : ''}.</p> : (
        <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
          <table className="nhlx-db-table nhlx-pk-table ir-ss-table">
            <thead>
              <tr>
                <th className="ir-slate-rank">#</th>
                <th>Player</th>
                <th>Game</th>
                <th title="The opponent’s rank at his spot for the stat on this season’s table the board reads (PropFinder’s), 1 = gives up the most, and its figure a game">Soft spot</th>
                <th className="is-num" title="The board’s projection for the stat, the quartiles of his range under it">Proj</th>
                <th className="is-num" title={plain ? 'The book’s main line on the over' : 'The book’s main line on the over and its price'}>Line</th>
                <th className="is-num" title={plain ? 'The board’s chance of the over at the main line' : 'The board’s chance of the over at the main line, the break-even price of that chance under it'}>Chance</th>
                {plain ? null : <th className="is-num" title="The chance over the price’s implied chance, in points">Edge</th>}
                {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const grade = r.hit == null ? (r.final && r.actual === null ? ' is-dnp' : '') : r.hit ? ' is-hit' : ' is-miss';
                const tone = r.p != null ? reliableTone(reliability, r.market, r.p, r.raw) : null;
                const why = topSpotText(r, r.opp);
                return (
                  <tr key={r.id} className={`${onOpen ? 'is-click' : ''}${grade}`} onClick={onOpen ? () => onOpen(r) : undefined}>
                    <td className="ir-slate-rank ir-ss-n">{i + 1}</td>
                    <td className="ir-ss-player">
                      <div className="nhlx-db-player">
                        {r.espnId ? <img src={sport.headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={sport.teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
                        <span><b>{r.player}</b><small>{r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos}{r.minutes != null ? ` · ${num(r.minutes, 0)} min` : ''}{r.health && r.health !== 'In' ? ` · ${r.health}` : ''}{r.bet ? <> · <span className="ir-ss-bet" title={`A best bet tonight: ${r.bet.side === 'under' ? 'u' : 'o'}${r.bet.line}${plain ? '' : ` at ${fmtOdds(r.bet.odds)}`}, ${pct(r.bet.p)}`}>best bet</span></> : null}</small></span>
                      </div>
                    </td>
                    <td className="ir-ss-game"><b>{r.venue === 'H' ? 'vs' : 'at'} {r.opp}</b><small className="ir-slate-sub">{r.final ? 'final' : fmtTip(r.start)}</small></td>
                    <td className="ir-ss-spot" title={why}>
                      <span className="ir-spot is-soft">{r.opp} #{r.rank}</span>
                      <small className="ir-slate-sub">{ordinal(r.rank)} most {statShort(r.stat)} to {r.pos}{r.value != null ? ` · ${num(r.value)} a game` : ''}{r.held ? ' · last season' : ''}</small>
                    </td>
                    <td className="is-num ir-ss-proj" title={`Projected ${num(r.exp)} ${statShort(r.stat)} tonight, between ${r.floor ?? '—'} and ${r.ceiling ?? '—'} half the nights`}><b>{num(r.exp)}</b><small>{r.floor != null && r.ceiling != null ? `${r.floor}–${r.ceiling}` : statShort(r.stat)}</small></td>
                    <td className="is-num ir-ss-line">{r.line != null ? <><b>o{r.line} {statShort(r.stat)}</b>{plain ? null : <small>{r.odds != null ? fmtOdds(r.odds) : 'no price'}</small>}</> : <small>no line</small>}</td>
                    <td className={`is-num ir-ss-chance${tone ? ` ir-rel-${tone}` : ''}`} title={r.p != null ? (plain ? `The board gives the over ${pct(r.p)}` : `The board gives the over ${pct(r.p)}; it breaks even at ${r.fair}${r.implied != null ? `, the book’s price implies ${pct(r.implied)}` : ''}`) : 'No line: the projection alone'}>{r.p != null ? <><b>{pct(r.p)}</b>{plain ? null : <small>{r.fair}</small>}</> : <small>—</small>}</td>
                    {plain ? null : <td className={`is-num ir-ss-edge${r.edge != null ? (r.edge > 0 ? ' is-up' : ' is-down') : ''}`}>{r.edge != null ? <b>{pts(r.edge)}</b> : <small>—</small>}</td>}
                    {final ? <td className="is-num nhlx-pk-got ir-ss-got">{r.actual === undefined ? <small>—</small> : r.actual === null ? <small>DNP</small> : <><b>{r.actual}</b><small>{r.hit == null ? statShort(r.stat) : r.hit ? 'over' : 'under'}</small></>}</td> : null}
                  </tr>
                );
              })}
              {!shown.length ? <tr><td colSpan={cols}><small className="ir-nfl-none">No soft spot tonight.</small></td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > SOFT_SHOWN ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll((v) => !v)}>{all ? `Show the top ${SOFT_SHOWN}` : `Show all ${rows.length}`}</button> : null}
    </section>
  );
}
