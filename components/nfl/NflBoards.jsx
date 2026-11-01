'use client';

import { useState } from 'react';
import { teamLogo } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';
import { SHOWN, PER_GAME } from '@/lib/nfl/projections';
import { spotTone } from '@/components/picks/SlateList';

// The Boards tab (Vincent, 2026-11-01: "I don't care about edge … the data from propfinder and the cheat sheet … the
// projected yards / TD candidates per game"): the week's projections (lib/nfl/projections.js, `board.projections`) as
// his six boards — Top TD, first-half TD, the receiving / rushing / passing projections with the heights each clears,
// three TE touchdowns — then every game with each side's projected leaders and touchdown candidates. No price, no edge:
// the figures are the board's own, the book's and the cheat sheet's lines beside the yards for reference.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 0) => (v == null ? '—' : Number(v).toFixed(d));
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) : '');
const TONE_WORD = { soft: 'soft', mid: 'even', tough: 'tough' };
const MARKET = { receiving: 'rec_yds', rushing: 'rush_yds', passing: 'pass_yds' };
const UNIT = { rec_yds: 'rec yds', rush_yds: 'rush yds', pass_yds: 'pass yds' };

export const BOARDS = [
  ['td', 'Top TD board', 'Every skill player’s chance of an anytime touchdown: his team’s touchdowns tonight (its own rate through the defense it faces and the book’s total and spread), his share of them (his touchdowns a game, pulled toward his carries and targets tonight) and where the defense gives them up.'],
  ['firstHalfTd', 'Best first-half TD board', 'The same read for the first half: half of his expected touchdowns, 1 − e^(−λ/2).'],
  ['receiving', 'Best receiving projections', 'Projected receiving yards: his rate from PropFinder’s logs × the defense at his slot (the cheat sheet’s tile beside it), with the heights he clears at 60 / 45 / 30%.'],
  ['rushing', 'Best rushing projections', 'Projected rushing yards, quarterbacks included.'],
  ['passing', 'Best passing projections', 'Projected passing yards.'],
  ['teTd', 'TE touchdowns across the slate', 'The tight ends’ touchdown chances, with the volume and the matchup behind each.'],
];

function RoleWords({ r }) {
  if (!r.role?.length) return null;
  return r.role.map((x) => <span key={x.kind} className={`ir-bd-role is-${x.kind}`} title={x.why}>{x.word}</span>);
}

function Who({ r }) {
  return (
    <div className="nhlx-db-player">
      {r.espnId ? <img src={headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
      <span>
        <b>{r.player}{r.onSheet ? <small className="ir-sh-check" title="On the cheat sheet"> ✓</small> : null}<RoleWords r={r} /></b>
        <small>{r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos}{r.health === 'DTD' ? <> · <span className="ir-health is-dtd" title={r.injury || ''}>DTD</span></> : null}</small>
      </span>
    </div>
  );
}

const Game = ({ r }) => <><b>{r.venue === 'H' ? 'vs' : 'at'} {r.opp}</b><small className="ir-slate-sub">{r.final ? 'final' : `${fmtDay(r.start)} ${fmtTip(r.start)}`}</small></>;

function Spot({ spot, opp, unit }) {
  if (!spot?.rank) return <span className="ir-spot is-none">no table</span>;
  const tone = spotTone(spot);
  return <span className={`ir-spot is-${tone}`} title={`${opp} gives up ${spot.value != null ? `${num(spot.value, 1)} ${unit} a game` : `the #${spot.rank} most`} to ${spot.pos}s, #${spot.rank} of ${spot.count}`}>#{spot.rank} {spot.pos} · {TONE_WORD[tone] || ''}</span>;
}

function tdWhy(r, half) {
  const t = r.td;
  return `${half ? 'First half' : 'Anytime'}: ${pct(half ? t.p1h : t.p)} · ${num(t.lambda, 2)} touchdowns expected = his own ${num(t.own, 2)} a game (${t.rate != null ? `${num(t.rate, 2)} a game over ${t.n} game${t.n === 1 ? '' : 's'} this season` : 'no touchdown record'}${t.prior != null ? `, pulled toward ${num(t.prior, 2)} from ${num(t.touches, 1)} touches tonight` : ''}) × ${t.teamFactor} his team's touchdowns tonight against its usual × ${t.posShift} where the defense gives them up`;
}

function TdTable({ rows, half, shown }) {
  const [all, setAll] = useState(false);
  const list = all ? rows : rows.slice(0, shown);
  const final = rows.some((r) => r.final);
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-slate-table ir-bd-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th><th>Player</th><th>Game</th>
            <th className="is-num is-lead" title="The board's chance of a touchdown">{half ? '1st half' : 'Anytime'}</th>
            <th className="is-num" title={half ? 'His anytime chance' : 'His first-half chance'}>{half ? 'Anytime' : '1st half'}</th>
            <th className="is-num" title="Touchdowns expected tonight (λ)">Exp. TD</th>
            <th title="His projected carries and targets tonight, and his touchdowns a game this season">Volume</th>
            <th title="The opponent's touchdowns allowed at his spot, 1 = the most">Matchup</th>
            {final ? <th className="is-num">Got</th> : null}
          </tr></thead>
          <tbody>
            {list.length ? list.map((r, i) => {
              const a = half ? r.td.actual1h : r.td.actual;
              const grade = a == null ? '' : a > 0 ? ' is-hit' : ' is-miss';
              return (
                <tr key={r.id} className={grade}>
                  <td className="ir-slate-rank ir-sl-rank">{i + 1}</td>
                  <td className="ir-sl-player"><Who r={r} /></td>
                  <td className="ir-sl-game"><Game r={r} /></td>
                  <td className="is-num is-lead ir-sl-chance" title={tdWhy(r, half)}><b>{pct(half ? r.td.p1h : r.td.p)}</b><small>{r.pos === 'QB' ? 'rushing TD' : 'TD'}</small></td>
                  <td className="is-num ir-sl-price"><b>{pct(half ? r.td.p : r.td.p1h)}</b></td>
                  <td className="is-num ir-sl-ev"><b>{num(r.td.lambda, 2)}</b></td>
                  <td className="ir-sl-proj"><small className="ir-slate-sub">{[r.td.carries > 0 ? `${num(r.td.carries)} car` : null, r.td.targets > 0 ? `${num(r.td.targets)} tgt` : null, r.td.season != null ? `${num(r.td.season, 2)} TD/g` : null].filter(Boolean).join(' · ') || '—'}</small></td>
                  <td className="ir-sl-spot"><Spot spot={r.td.spot} opp={r.opp} unit="TD" /></td>
                  {final ? <td className="is-num nhlx-pk-got ir-sl-got">{a === undefined ? <small>—</small> : a === null ? <small>DNP</small> : <b>{a}</b>}</td> : null}
                </tr>
              );
            }) : <tr><td colSpan={final ? 9 : 8}><small className="ir-nfl-none">No projection yet: the week needs a PropFinder pull.</small></td></tr>}
          </tbody>
        </table>
      </div>
      {!all && rows.length > shown ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

function YardsTable({ rows, market, shown }) {
  const [all, setAll] = useState(false);
  const list = all ? rows : rows.slice(0, shown);
  const final = rows.some((r) => r.final);
  const unit = UNIT[market];
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-slate-table ir-bd-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th><th>Player</th><th>Game</th>
            <th className="is-num is-lead" title="The board's projection, the quartiles of his range under it (he lands between them half his games)">Projected</th>
            <th title="The highest height he clears at 60%, 45% and 30% off his ladder">Heights</th>
            <th className="is-num" title="The book's main line, and the cheat sheet's line when the sheet lists him">Line</th>
            <th title="The opponent's yards allowed at his spot, 1 = the most">Matchup</th>
            {final ? <th className="is-num">Got</th> : null}
          </tr></thead>
          <tbody>
            {list.length ? list.map((r, i) => {
              const y = r.yards[market];
              return (
                <tr key={r.id}>
                  <td className="ir-slate-rank ir-sl-rank">{i + 1}</td>
                  <td className="ir-sl-player"><Who r={r} /></td>
                  <td className="ir-sl-game"><Game r={r} /></td>
                  <td className="is-num is-lead ir-sl-chance" title={`${num(y.rate, 1)} his rate × ${y.matchup ?? 1} the matchup${y.matchupFrom ? ` (${y.matchupFrom === 'blend' ? 'the cheat sheet and PropFinder' : y.matchupFrom === 'sheet' ? 'the cheat sheet' : 'PropFinder'})` : ''}`}><b>{num(y.exp)}</b><small>{y.floor}–{y.ceiling}</small></td>
                  <td className="ir-sl-play"><span className="ir-bd-rungs">{y.marks.length ? y.marks.map((m) => <span key={m.line} className={`ir-bd-rung${m.hit == null ? '' : m.hit ? ' is-hit' : ' is-miss'}`} title={`o${m.line}: ${pct(m.p)} · read at ${pct(m.at)}${m.hit == null ? '' : m.hit ? ' · HIT' : ' · MISS'}`}><b>{m.mark}</b><i>{pct(m.p)}</i></span>) : <small className="ir-slate-sub">no ladder</small>}</span></td>
                  <td className="is-num ir-sl-price"><b>{y.line != null ? y.line : '—'}</b><small>{y.sheetLine != null && y.sheetLine !== y.line ? `sheet ${y.sheetLine}` : y.sheetLine != null ? 'on the sheet' : y.line != null ? 'book' : ''}</small></td>
                  <td className="ir-sl-spot"><Spot spot={y.spot} opp={r.opp} unit="yds" /></td>
                  {final ? <td className="is-num nhlx-pk-got ir-sl-got">{y.actual === undefined ? <small>—</small> : y.actual === null ? <small>DNP</small> : <b>{y.actual}</b>}</td> : null}
                </tr>
              );
            }) : <tr><td colSpan={final ? 8 : 7}><small className="ir-nfl-none">No projection yet: the week needs a PropFinder pull.</small></td></tr>}
          </tbody>
        </table>
      </div>
      {!all && rows.length > shown ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

/** One game: each side's team touchdowns tonight, its projected passer, runners, receivers and touchdown candidates. */
function GameCard({ g, rows }) {
  const total = g.odds?.total != null ? `total ${g.odds.total}` : null;
  const score = g.final ? `final ${g.awayScore}–${g.homeScore}` : `${fmtDay(g.date)} ${fmtTip(g.date)}`;
  const list = (ids, item) => (ids.length ? <ul>{ids.map(item)}</ul> : <span className="ir-slate-sub">—</span>);
  const line = (id, market) => { const r = rows[id]; const y = r.yards[market]; return <li key={id}><span>{r.player}{y.actual != null ? <small> · got {y.actual}</small> : null}</span><b>{num(y.exp)}</b></li>; };
  return (
    <section className="ir-pj-game" aria-label={`${g.away} at ${g.home}`}>
      <div className="ir-pj-head"><b>{g.away} @ {g.home}</b><small className="nhlx-auto-meta">{[score, total, g.odds?.spread || null].filter(Boolean).join(' · ')}</small></div>
      <div className="ir-pj-cols">
        {[g.away, g.home].map((team) => {
          const t = g.teams[team];
          if (!t) return <div key={team} className="ir-pj-team"><b>{team}</b><small className="nhlx-auto-meta">No PropFinder players for this side.</small></div>;
          const tt = t.teamTd;
          return (
            <div key={team} className="ir-pj-team">
              <div className="ir-pj-team-head">
                <img src={teamLogo(team)} alt="" width="22" height="22" loading="lazy" className="ir-nfl-logo" /><b>{team}</b>
                <small className="nhlx-auto-meta" title={`Its own ${num(tt.own, 2)} touchdowns a game${tt.fromTable != null ? `, ${num(tt.fromTable, 2)} through ${t.opp}'s defense` : ''}${tt.fromLine != null ? `, ${num(tt.fromLine, 2)} off ${num(tt.points, 1)} implied points` : ''}`}>{tt.tonight != null ? `${num(tt.tonight, 1)} TDs expected` : 'no team read'}{tt.points != null ? ` · ${num(tt.points, 1)} pts implied` : ''}</small>
              </div>
              <dl className="ir-pj-list">
                <dt>Passing</dt><dd>{list(t.passing, (id) => line(id, 'pass_yds'))}</dd>
                <dt>Rushing</dt><dd>{list(t.rushing, (id) => line(id, 'rush_yds'))}</dd>
                <dt>Receiving</dt><dd>{list(t.receiving, (id) => line(id, 'rec_yds'))}</dd>
                <dt>TD</dt><dd>{list(t.td, (id) => { const r = rows[id]; const a = r.td.actual; return <li key={id} className={a == null ? '' : a > 0 ? 'is-hit' : 'is-miss'}><span>{r.player}<RoleWords r={r} /></span><b title={tdWhy(r, false)}>{pct(r.td.p)}</b></li>; })}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function NflBoards({ board }) {
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">No projections for this week yet: reload once the week has a PropFinder pull.</div>;
  const rowsOf = (key) => (pj.boards[key] || []).map((id) => pj.rows[id]).filter(Boolean);
  return (
    <div className="ir-overview">
      <p className="nhlx-auto-meta ir-bd-legend">The board’s own projections from PropFinder’s logs and tables and the cheat sheets (✓ = on the sheet); the book’s prices play no part. <span className="ir-bd-role is-active">if active</span> a game-time decision · <span className="ir-bd-role is-role">if role confirmed</span> his read leans on a teammate out, hover for who. Hover a figure for its arithmetic.</p>
      {BOARDS.map(([key, title, note]) => (
        <section key={key} className="ir-slate ir-bd" aria-label={title}>
          <div className="nhlx-pfd-head"><b>{title}</b><small className="nhlx-auto-meta">{note}</small></div>
          {MARKET[key] ? <YardsTable rows={rowsOf(key)} market={MARKET[key]} shown={SHOWN[key]} /> : <TdTable rows={rowsOf(key)} half={key === 'firstHalfTd'} shown={SHOWN[key]} />}
        </section>
      ))}
      <section className="ir-pj" aria-label="By game">
        <div className="nhlx-pfd-head"><b>By game</b><small className="nhlx-auto-meta">each side’s team touchdowns tonight, its projected passer, top {PER_GAME.rushing} runners and {PER_GAME.receiving} receivers, and its {PER_GAME.td} likeliest scorers</small></div>
        <div className="ir-pj-grid">{pj.games.map((g) => <GameCard key={g.id} g={g} rows={pj.rows} />)}</div>
      </section>
    </div>
  );
}
