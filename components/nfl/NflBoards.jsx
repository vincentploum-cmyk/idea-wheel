'use client';

import { useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { fmtEv, DEFAULTS } from '@/lib/picks/value';
import { weekBoards, BOARDS } from '@/lib/nfl/boards';
import { teamLogo } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';
import { asStated } from '@/lib/picks/calibration';
import { ICON } from '@/components/nhl/flags';
import ValueControls from '@/components/picks/ValueControls';
import { RowBadges } from '@/components/picks/badges';
import { spotTone, evTone } from '@/components/picks/SlateList';
import { useValueFilters } from '@/components/picks/value-filters';

// The Boards tab (Vincent, 2026-11-01, the structure the NFL week should follow): six boards in his order — Top TD, the
// first-half TD board, the receiving, rushing and passing ladders, three TE touchdowns across the slate — each a ranked
// table built by lib/nfl/boards.js off the week's board at the user's own floors (the same sliders as Best plays, the
// same localStorage), the rows that fail a floor behind "Show marginal". A name carries the words Vincent writes beside
// it: "if active" for a game-time decision, "if role confirmed" when his read leans on a teammate out (hover for who).

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) : '');
const FAIL_WORD = { price: 'no price', juice: 'past the juice ceiling', ev: 'under the EV floor', chance: 'under the chance floor', thin: 'thin', out: 'out' };
const TONE_WORD = { soft: 'soft', mid: 'even', tough: 'tough' };

function RoleWords({ r }) {
  if (!r.role?.length) return null;
  return r.role.map((x) => <span key={x.kind} className={`ir-bd-role is-${x.kind}`} title={x.why}>{x.word}</span>);
}

function FormFlag({ r }) {
  if (r.form !== 'hot' && r.form !== 'cold') return null;
  const t = r.form === 'hot' ? `Hot: ${pct(r.rates?.l5)} of his last ${r.rates?.l5N ?? 5} scored (colour only; the chance already carries the rate)` : `Cold: ${pct(r.rates?.l5)} of his last ${r.rates?.l5N ?? 5} scored`;
  return <span className="nhlx-pk-flags"><i className={`nhlx-pk-flag is-${r.form}`} title={t} aria-label={t}>{ICON[r.form]}</i></span>;
}

/** The play cell: the touchdown market's word, or a ladder's rungs worth playing. */
function PlayCell({ r }) {
  if (r.rungs) {
    return (
      <>
        <span className="ir-bd-rungs">
          {r.rungs.map((x) => {
            const tone = x.ev == null ? 'none' : x.ev >= DEFAULTS.minEv ? 'good' : x.ev > 0 ? 'thin' : 'bad';
            const grade = x.hit == null ? '' : x.hit ? ' is-hit' : ' is-miss';
            return (
              <span key={x.line} className={`ir-bd-rung is-${tone}${x.best ? ' is-best' : ''}${x.main ? ' is-main' : ''}${grade}`} title={`o${x.line} ${r.unit}: ${pct(x.p)} chance at ${fmtOdds(x.odds)} · EV ${fmtEv(x.ev)} a unit · edge ${x.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(x.edge * 100))} pts${x.main ? ' · the book’s main line' : ''}${x.best ? ' · the best value on his ladder' : ''}${x.hit == null ? '' : x.hit ? ' · HIT' : ' · MISS'}`}>
                <b>{x.mark}</b><i>{pct(x.p)}</i><small>{fmtOdds(x.odds)}</small><em>{fmtEv(x.ev)}</em>
              </span>
            );
          })}
        </span>
        <small className="ir-slate-sub">{r.rungsPassing} of {r.rungsPriced} priced rung{r.rungsPriced === 1 ? '' : 's'} clear the floors{r.mainLine != null ? ` · main o${r.mainLine}` : ''}</small>
      </>
    );
  }
  const qb = r.pos === 'QB' && r.market !== 'pass_td';
  return (
    <>
      <b>{r.label}{qb ? ' · rushing' : ''}</b>
      {r.derived ? <small className="ir-slate-sub" title={`Read off his ${r.derived.label} chance of ${pct(r.derived.p)}${r.derived.odds != null ? ` at ${fmtOdds(r.derived.odds)}` : ''}: a touchdown count with half its rate in the first half, 1 − √(1 − p)${r.synthetic ? ' · no first-half line in the pull yet: the fair price stands alone' : ''}`}>off anytime {pct(r.derived.p)}</small> : null}
    </>
  );
}

export function BoardTable({ b, filters }) {
  const [all, setAll] = useState(false);
  const f = { ...DEFAULTS, ...(filters || {}) };
  const rows = useMemo(() => (f.marginal ? b.rows : b.rows.filter((r) => !r.fails)), [b, f.marginal]);
  const shown = all ? rows : rows.slice(0, b.shown);
  const final = rows.some((r) => r.final);
  const ladder = !!b.market && /_yds$/.test(b.market);
  const cols = 9 + (final ? 1 : 0);
  return (
    <section className="ir-slate ir-bd" aria-label={b.title}>
      <div className="nhlx-pfd-head">
        <b>{b.title}</b>
        <small className="nhlx-auto-meta">{b.note} · {b.passing} clear{b.passing === 1 ? 's' : ''} the floors{b.rows.length > b.passing ? `, ${b.rows.length - b.passing} marginal` : ''}</small>
      </div>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-slate-table ir-bd-table">
          <thead>
            <tr>
              <th className="ir-slate-rank">#</th>
              <th>Player</th>
              <th>Game</th>
              <th>{ladder ? 'Rungs worth playing' : 'Play'}</th>
              <th className="is-num is-lead" title="Expected value: the return a unit staked at the book’s price on the board’s chance; the probability edge under it">EV</th>
              <th className="is-num" title="The book’s price, and the chance it implies under it">Price</th>
              <th className="is-num" title="The board’s chance of the hit, and the break-even price under it">Chance</th>
              <th title={ladder ? 'His projection for the game, its gap to the best rung and the quartiles of his range under it' :  'His projected volume behind the touchdown chance'}>{ladder ? 'Projection' : 'Volume'}</th>
              <th title="The opponent’s rank at his spot for the stat, 1 = gives up the most">Matchup</th>
              {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((r, i) => {
              const tone = spotTone(r.spot);
              const grade = r.hit == null ? (r.final && r.actual === null ? ' is-dnp' : '') : r.hit ? ' is-hit' : ' is-miss';
              const price = r.odds != null ? fmtOdds(r.odds) : r.synthetic ? 'no line' : '—';
              return (
                <tr key={r.id} className={`${grade}${r.fails ? ' is-marginal' : ''}`}>
                  <td className="ir-slate-rank ir-sl-rank">{i + 1}</td>
                  <td className="ir-sl-player">
                    <div className="nhlx-db-player">
                      {r.espnId ? <img src={headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
                      <span>
                        <b>{r.player}{r.confirmed ? <small className="ir-sh-check" title="On the cheat sheet"> ✓</small> : null}<FormFlag r={r} /><RoleWords r={r} /></b>
                        <small>{r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos || '—'}<RowBadges r={r} />{r.sheetOnly ? ' · sheet only' : ''}{r.fails ? <> · <span className="ir-fails" title="Fails a floor: shown because “Show marginal” is on">{FAIL_WORD[r.fails] || r.fails}</span></> : null}</small>
                        {r.why ? <small className="ir-bd-why">{r.why}</small> : null}
                      </span>
                    </div>
                  </td>
                  <td className="ir-sl-game"><b>{r.venue === 'H' ? 'vs' : 'at'} {r.opp}</b><small className="ir-slate-sub">{r.final ? 'final' : `${fmtDay(r.start)} ${fmtTip(r.start)}`}</small></td>
                  <td className="ir-nfl-play ir-sl-play"><PlayCell r={r} /></td>
                  <td className={`is-num is-lead ir-sl-ev ir-ev-${evTone(r.ev)}`} title={r.ev != null ? `${fmtEv(r.ev)} a unit staked at ${fmtOdds(r.odds)} on a ${pct(r.p)} chance · edge ${r.edge >= 0 ? '+' : '−'}${Math.abs(Math.round((r.edge || 0) * 100))} points over the book’s ${pct(r.implied)}` : 'No price: no value to read'}><b>{fmtEv(r.ev)}</b><small>{r.edge == null ? '—' : `${r.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(r.edge * 100))} pts`}</small></td>
                  <td className="is-num ir-sl-price"><b>{price}</b><small>{r.odds == null ? (r.synthetic ? `fair ${r.fair}` : r.book || '—') : `implies ${pct(r.implied)}`}</small></td>
                  <td className="is-num ir-sl-chance" title={r.raw != null ? `${pct(r.p)} calibrated to what this season's ${r.label} plays have landed${asStated(r.raw)}` : undefined}><b>{pct(r.p)}</b><small>{r.fair}</small></td>
                  <td className="ir-sl-proj">
                    {ladder ? (r.proj ? (
                      <div className="ir-slate-proj ir-bd-proj" title={`Projected ${num(r.proj.exp)} ${r.unit}, between ${r.proj.floor} and ${r.proj.ceiling} half the games`}>
                        <span><b>{num(r.proj.exp)}</b><small className="ir-slate-sub">{r.gap != null ? <span className={r.gap > 0 ? 'ir-slate-gap is-up' : 'ir-slate-gap'} title={`The projection ${num(Math.abs(r.gap))} ${r.unit} ${r.gap >= 0 ? 'over' : 'under'} the best rung`}>{r.gap >= 0 ? '+' : '−'}{num(Math.abs(r.gap))} vs rung · </span> : null}{r.proj.floor}–{r.proj.ceiling}</small></span>
                      </div>
                    ) : <small className="ir-slate-sub">no projection</small>) : (
                      <small className="ir-slate-sub" title="His projected volume for the game (the board’s ranges)">{[r.volume?.rushAtt != null ? `${num(r.volume.rushAtt, 0)} car` : null, r.volume?.rushYds != null ? `${num(r.volume.rushYds, 0)} rush yds` : null, r.volume?.targets != null ? `${num(r.volume.targets, 0)} tgt` : null, r.volume?.recYds != null ? `${num(r.volume.recYds, 0)} rec yds` : null].filter(Boolean).join(' · ') || '—'}</small>
                    )}
                  </td>
                  <td className="ir-sl-spot">{r.spot?.rank ? <span className={`ir-spot is-${tone}`} title={`${r.opp} gives up ${r.spot.value != null ? `${num(r.spot.value)} ${r.unit} a game` : `the #${r.spot.rank} most`} to ${r.spot.pos}s, #${r.spot.rank} of ${r.spot.count}`}>#{r.spot.rank} {r.spot.pos} · {TONE_WORD[tone] || ''}</span> : <span className="ir-spot is-none">no table</span>}</td>
                  {final ? <td className="is-num nhlx-pk-got ir-sl-got">{r.actual === undefined ? <small>—</small> : r.actual === null ? <small>DNP</small> : <><b>{r.actual}</b><small>{r.unit}</small></>}</td> : null}
                </tr>
              );
            }) : <tr><td colSpan={cols}><small className="ir-nfl-none">No row clears the floors{f.marginal ? '' : ' · "Show marginal" lists the rest'}.</small></td></tr>}
          </tbody>
        </table>
      </div>
      {!all && rows.length > b.shown ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </section>
  );
}

export default function NflBoards({ board }) {
  const [filters, setFilters, reset] = useValueFilters('nfl');
  const boards = useMemo(() => weekBoards(board, filters), [board, filters]);
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  // Every row once across the boards (a TE's touchdown row sits on two of them).
  const rows = new Map();
  for (const b of Object.values(boards)) for (const r of b.rows) rows.set(r.id, r);
  const all = rows.size;
  const passing = [...rows.values()].filter((r) => !r.fails).length;
  return (
    <div className="ir-overview">
      <ValueControls filters={filters} onChange={setFilters} onReset={reset} counts={{ passing, all, noun: 'board row' }} />
      <p className="nhlx-auto-meta ir-bd-legend">Ranked by the value at the book’s price, the chance breaking ties; the floors above apply to every board (the first-half rows without a book line keep their place on the chance). <span className="ir-bd-role is-active">if active</span> a game-time decision · <span className="ir-bd-role is-role">if role confirmed</span> his read leans on a teammate out, hover for who.</p>
      {BOARDS.map(([key]) => <BoardTable key={key} b={boards[key]} filters={filters} />)}
    </div>
  );
}
