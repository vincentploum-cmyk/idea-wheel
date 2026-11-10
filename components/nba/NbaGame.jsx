'use client';

import { useState } from 'react';
import { GameCharacteristics } from '@/components/nhl/Characteristics';
import GameProfile from './NbaProfile';
import { GroupTable, GameSummary, teamMark, expectedPill } from '@/components/picks/Board';
import CourtPair, { AllowedTable, zoneTone, envPos, windowsOf } from './NbaCourt';
import { useNbaPlayerCard } from './NbaPlayerCard';
import { fmtEv } from '@/lib/picks/value';

// One game of the NBA board, folded to a line under the slate's list (2026-10-30, Vincent: the courts made the
// matchups hard to find): the teams, the tip or the score, who is out, how many plays and the best one. Opened: the
// teams' strengths and weaknesses, then a column per team — who is out, PropFinder's table of what the opponent gives
// up to each position (the court's `AllowedTable`: every stat with its figure and rank, the window tabs, the league's
// average; the ranks-only grid drawn here on 2026-10-30 lasted a day, Vincent: "I need the propfinder data above each
// court again like how we had it"), and every active player's projection per stat tinted by the matchup at his spot, a
// play's line and chance under its figure. The courts and the five tables sit behind a switch. — Until the evening of
// 2026-10-30: Vincent, after the courts gained the shuffle bar and the projections, "I don't see the courts nor the
// shuffle bars in the best plays tab". Now an opened game shows the characteristics card and then the courts (each with
// the out lines, PropFinder's table, the bar, every player's projections and the Tonight table); the team columns and
// the five group tables sit behind the switch. — And since that night (Vincent: "too many clicks. I need the games
// listed first along with the best bets … replace the characteristics with a summary from PropFinder and cheat sheet
// data like firsthalfscore.com"): the games come before the ranked list, open by default (the board's Collapse all /
// Expand all), the game profile table (NbaProfile.jsx) stands where the characteristics card was (the card stays as
// the fallback for a game without a profile), and who is out sits under each court.

const STATS = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['pra', 'PRA']];
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

function statusOf(g) {
  if (g.final) return `Final ${g.awayScore}–${g.homeScore}`;
  if (g.state === 'in') return `Live ${g.awayScore}–${g.homeScore}`;
  return fmtTip(g.date);
}

const SPLIT_STATS = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['stl', 'STL'], ['blk', 'BLK']];
const splitWord = (sp) => (sp ? `${num(sp.avg)} (${sp.n})` : '—');

/**
 * The players under the table (Vincent, 2026-11-01: "under the tables, we just list the players"): every active player
 * with his projection per stat and the book's line under it, and for the stat picked above the table his averages at
 * tonight's venue and against tonight's opponent (`splits` on the side player, lib/picks/board.js venueSplits) — the
 * third step of the read: the matchup confirmed, how many he can actually get. A pressed row of the table picks out
 * that position; a row opens the card.
 */
function Roster({ side, final, metric, hiPos = null }) {
  const open = useNbaPlayerCard();
  const count = side.allowed?.count || 30;
  const stat = SPLIT_STATS.some(([k]) => k === metric) ? metric : 'pts';
  const players = side.players.filter((p) => !p.out && !p.idle && Object.keys(p.ranges || {}).length && (!hiPos || (p.envPos || envPos(p)) === hiPos));
  if (!players.length) return <p className="nhlx-auto-meta">{hiPos ? `No active ${hiPos} with a projection for ${side.team}.` : `No projections for ${side.team} yet: pull PropFinder.`}</p>;
  const venueWord = side.venue === 'H' ? 'Home' : 'Away';
  return (
    <div className="nhlx-pfd-wrap">
      <table className="nhlx-pfd-table ir-roster">
        <thead><tr><th>Player</th><th title="His minutes tonight">Min</th>{STATS.map(([k, l]) => <th key={k} className={k === stat ? 'is-on' : ''}>{l}</th>)}<th className="is-on" title={`His ${STAT_WORD[stat] || stat} a game ${side.venue === 'H' ? 'at home' : 'on the road'} this season, and in his last meetings with ${side.opp}`}>{STAT_WORD[stat] || stat} · {venueWord} / vs {side.opp}</th></tr></thead>
        <tbody>
          {players.map((p) => {
            const pos = p.envPos || envPos(p);
            const sp = p.splits?.[stat] || null;
            const r = p.ranges?.[stat];
            return (
              <tr key={p.key} className="is-click" onClick={() => open({ key: p.key, player: p, team: side.team, opp: side.opp, venue: side.venue, market: stat })}>
                <td><b>{p.player}</b><small className="nhlx-auto-meta"> {p.slot && p.depth ? `${p.slot}${p.depth}` : p.pos || '—'}</small>{p.health === 'DTD' ? <> <span className="ir-health is-dtd" title={`${p.injury || ''}${p.injuryDetail ? ` · ${p.injuryDetail}` : ''}`}>DTD</span></> : null}{p.thin ? <> <span className="ir-health is-thin" title={`Projected ${num(p.minutes?.tonight, 0)} minutes: under the minutes gate`}>thin</span></> : null}{p.b2b ? <> <span className="ir-health is-b2b" title="Played last night">B2B</span></> : null}</td>
                <td title={p.minutes?.lineup ? `${num(p.minutes.lineup.tonight)} minutes with RotoWire's ${String(p.minutes.lineup.status || '').toLowerCase() || 'starting'} five (${p.minutes.lineup.role === 'promoted' ? 'starts tonight, off the bench in most of his last games' : 'out of the five after starting most of his last games'}), ${num(p.minutes.lineup.before)} without it` : undefined}>{p.minutes?.tonight != null ? num(p.minutes.tonight, 0) : '—'}{p.minutes?.lineup ? (p.minutes.lineup.role === 'promoted' ? ' ↑' : ' ↓') : ''}</td>
                {STATS.map(([k]) => {
                  const rr = p.ranges?.[k];
                  const cell = pos ? side.allowed?.rows?.[pos]?.[k] : null;
                  const rank = cell?.rankBlend ?? cell?.rank ?? null;
                  const tone = zoneTone(rank, count);
                  const play = (p.plays || []).find((x) => x.market === k && x.side === 'over' && !x.steep && x.p >= (x.floor ?? 0)) || null;
                  const title = rr ? `${p.player} · ${num(rr.exp)} ${k.toUpperCase()} projected, ${rr.floor}–${rr.ceiling} half the nights${rank ? ` · ${side.opp} #${rank} of ${count} to ${pos}s` : ''}${play ? ` · o${play.line} at ${pct(play.p)}${play.ev != null ? `, EV ${fmtEv(play.ev)}` : ''}` : rr.line != null ? ` · the book’s o${rr.line}: ${pct(rr.p)}` : ''}${final && play?.actual != null ? ` · got ${play.actual}` : ''}` : '';
                  return (
                    <td key={k} className={`${rr && (tone === 'soft' || tone === 'tough') ? `is-${tone}` : ''}${play ? ' is-play' : ''}${k === stat ? ' is-on' : ''}`} title={title}>
                      {rr ? num(rr.exp) : '—'}
                      {play ? <small className="ir-roster-play">o{play.line} {pct(play.p)}{play.ev != null ? <span className={`ir-ev-${play.ev >= 0.05 ? 'good' : play.ev > 0 ? 'thin' : 'bad'}`}> {fmtEv(play.ev)}</span> : null}{final && play.hit != null ? <span className={play.hit ? 'is-hit' : 'is-miss'}> {play.hit ? 'hit' : 'miss'}</span> : null}</small> : null}
                    </td>
                  );
                })}
                <td className="is-on ir-roster-split" title={sp ? `${STAT_WORD[stat] || stat} a game: ${sp.venue ? `${num(sp.venue.avg)} over ${sp.venue.n} ${venueWord.toLowerCase()} game${sp.venue.n === 1 ? '' : 's'}` : `no ${venueWord.toLowerCase()} game logged`}${sp.h2h ? ` · ${num(sp.h2h.avg)} over his last ${sp.h2h.n} vs ${side.opp}` : ` · no game vs ${side.opp} logged`}${sp.season ? ` · ${num(sp.season.avg)} over ${sp.season.n}${sp.season.stand ? ' (last season’s, until three this season)' : ' this season'}` : ''}${r ? ` · projected ${num(r.exp)} tonight` : ''}` : 'No logs'}>
                  <b>{splitWord(sp?.venue)}</b><small className="nhlx-auto-meta"> / {splitWord(sp?.h2h)}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
const STAT_WORD = { pts: 'PTS', reb: 'REB', ast: 'AST', tpm: '3PM', pra: 'PRA', stl: 'STL', blk: 'BLK' };

/**
 * One team's column (Vincent, 2026-11-01: "put the propfinder tables back; under the tables, we just list the players",
 * his read: PropFinder's L10 per position first, the cheat sheet to confirm it, then the player's own figures): who is
 * out, PropFinder's table opening on L10 with the cheat sheet's tile marked in every cell, the stat tabs, and the
 * players under it with their projections and their venue / head-to-head averages for the picked stat.
 */
function TeamColumn({ side, sport, final, metric, onMetric, season }) {
  const windows = windowsOf(side.allowed);
  const [win, setWin] = useState(() => (windows.includes('l10') ? 'l10' : 'season'));
  const [hiPos, setHiPos] = useState(null);
  const view = windows.includes(win) ? win : 'season';
  return (
    <section className="ir-gf-team" aria-label={`${side.team} ${side.venue === 'H' ? 'vs' : 'at'} ${side.opp}`}>
      <div className="ir-gf-team-head">
        <img src={sport.teamLogo(side.team)} alt="" width="28" height="28" loading="lazy" />
        <b>{sport.teamName(side.team)}</b>
        <small className="nhlx-auto-meta">{side.venue === 'H' ? 'vs' : 'at'} {side.opp}</small>
      </div>
      <p className="ir-gf-out"><b>Out</b> {side.out?.length ? side.out.map((a) => `${a.name}${a.status && a.status !== 'Out' ? ` (${a.status})` : ''}`).join(' · ') : 'nobody listed'}</p>
      <AllowedTable side={side} win={view} metric={metric} season={season} onWin={setWin} onPos={setHiPos} hiPos={hiPos} sheetMarks />
      <div className="nhlx-pfd-head ir-roster-head">
        <b>{hiPos ? `${side.team}’s ${hiPos}s` : `${side.team}’s players`}</b>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Stat for the splits">
          {SPLIT_STATS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={metric === k} className={`nhlx-tab${metric === k ? ' is-active' : ''}`} onClick={() => onMetric?.(k)}>{l}</button>)}
        </div>
        <small className="nhlx-auto-meta">projection per stat, the book’s line and chance under it · the last column his average {side.venue === 'H' ? 'at home' : 'on the road'} / vs {side.opp} for the stat picked · press a row of the table for one position · click a player for the card</small>
      </div>
      <Roster side={side} final={final} metric={metric} hiPos={hiPos} />
    </section>
  );
}

/**
 * A game folded to one line (the brief of 2026-10-31: the matchup, the tip, the leak badge, how many +EV plays, the top one
 * with its EV, the Matchup Score; closed by default); pressed, the profile and both courts, the team columns and the tables
 * — ordered by EV, the marginal rows behind the panel's switch — behind a second switch.
 */
export default function GameFold({ g, matchup = null, best = [], sport, metric, onMetric, open: openProp = null, onToggle = null, reliability = null, filters = null }) {
  const [openOwn, setOpenOwn] = useState(false);
  const open = openProp ?? openOwn;
  const setOpen = (fn) => { const next = typeof fn === 'function' ? fn(open) : fn; if (onToggle) onToggle(next); else setOpenOwn(next); };
  const [more, setMore] = useState(false);
  const mine = best.filter((r) => r.game === g.id);
  const graded = mine.filter((r) => r.hit != null);   // the best bets graded once the game is stored
  const sides = [g.sides?.[g.away], g.sides?.[g.home]].filter(Boolean);
  const outs = sides.reduce((n, s) => n + (s.out?.length || 0), 0);
  const bodyId = `nba-game-${g.id}`;
  return (
    <article className={`ir-gf${open ? ' is-open' : ''}`} id={`game-${g.id}`}>
      <button type="button" className="ir-gf-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
        <span className="ir-gf-teams">
          <img src={sport.teamLogo(g.away)} alt="" width="24" height="24" loading="lazy" />{g.away}
          <i>@</i>
          <img src={sport.teamLogo(g.home)} alt="" width="24" height="24" loading="lazy" />{g.home}
        </span>
        <span className="ir-gf-meta">{statusOf(g)}{g.odds?.spread ? ` · ${g.odds.spread}` : ''}</span>
        <span className="ir-gf-meta">{outs ? `${outs} out` : 'nobody out'}</span>
        {g.profile?.script?.word ? <span className="ir-gf-meta" title={g.profile.script.text}>{g.profile.script.word}</span> : null}
        {graded.length ? <span className="ir-gf-meta">{graded.filter((r) => r.hit).length} of {graded.length} hit</span> : null}
        <GameSummary g={g} matchup={matchup} />
        <svg className="ir-gf-caret" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open ? (
        <div className="ir-gf-body" id={bodyId}>
          {g.profile ? <GameProfile g={g} sport={sport} /> : g.characteristics ? <GameCharacteristics game={g} renderTeam={teamMark(sport)} pill={expectedPill(g, sport)} /> : null}
          {/* PropFinder's tables first, the players under them (Vincent, 2026-11-01); the courts and the five tables behind the switch. */}
          <div className="ir-gf-cols">
            {sides.map((side) => <TeamColumn key={side.team} side={side} sport={sport} final={g.final} metric={metric} onMetric={onMetric} season={g.season || null} />)}
          </div>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? 'Hide the courts and the tables' : 'Show the courts and the tables'}</button>
          {more ? (
            <>
              <CourtPair g={g} metric={metric} onMetric={onMetric} sport={sport} reliability={reliability} />
              {g.plays ? <div className="ir-nfl-grid">{sport.groups.map(([key, label]) => <GroupTable key={key} label={label} t={g.tables[key]} final={g.final} sport={sport} filters={filters} marginal={filters ? !!filters.marginal : null} />)}</div> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
