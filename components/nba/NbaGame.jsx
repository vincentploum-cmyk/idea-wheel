'use client';

import { useState } from 'react';
import { GameCharacteristics } from '@/components/nhl/Characteristics';
import GameProfile from './NbaProfile';
import { GroupTable, teamMark, expectedPill, playLabel } from '@/components/picks/Board';
import CourtPair, { AllowedTable, zoneTone, envPos, windowsOf } from './NbaCourt';
import { useNbaPlayerCard } from './NbaPlayerCard';

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

/** Every active player's projection per stat, the cell tinted by the matchup at his spot (soft or tough), a play's line and chance under the figure. */
function Roster({ side, final }) {
  const open = useNbaPlayerCard();
  const count = side.allowed?.count || 30;
  const players = side.players.filter((p) => !p.out && Object.keys(p.ranges || {}).length);
  if (!players.length) return <p className="nhlx-auto-meta">No projections for {side.team} yet: pull PropFinder.</p>;
  return (
    <div className="nhlx-pfd-wrap">
      <table className="nhlx-pfd-table ir-roster">
        <thead><tr><th>Player</th><th title="His minutes tonight">Min</th>{STATS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
        <tbody>
          {players.map((p) => {
            const pos = p.envPos || envPos(p);
            return (
              <tr key={p.key} className="is-click" onClick={() => open({ key: p.key, player: p, team: side.team, opp: side.opp, venue: side.venue })}>
                <td><b>{p.player}</b><small className="nhlx-auto-meta"> {p.slot && p.depth ? `${p.slot}${p.depth}` : p.pos || '—'}</small>{p.health === 'DTD' ? <> <span className="ir-health is-dtd" title={`${p.injury || ''}${p.injuryDetail ? ` · ${p.injuryDetail}` : ''}`}>DTD</span></> : null}</td>
                <td>{p.minutes?.tonight != null ? num(p.minutes.tonight, 0) : '—'}</td>
                {STATS.map(([k]) => {
                  const r = p.ranges?.[k];
                  const cell = pos ? side.allowed?.rows?.[pos]?.[k] : null;
                  const rank = cell?.rankBlend ?? cell?.rank ?? null;
                  const tone = zoneTone(rank, count);
                  const play = (p.plays || []).find((x) => x.market === k && x.side === 'over' && !x.steep && x.p >= (x.floor ?? 0)) || null;
                  const title = r ? `${p.player} · ${num(r.exp)} ${k.toUpperCase()} projected, ${r.floor}–${r.ceiling} half the nights${rank ? ` · ${side.opp} #${rank} of ${count} to ${pos}s` : ''}${play ? ` · o${play.line} at ${pct(play.p)}` : r.line != null ? ` · the book’s o${r.line}: ${pct(r.p)}` : ''}${final && play?.actual != null ? ` · got ${play.actual}` : ''}` : '';
                  return (
                    <td key={k} className={`${r && (tone === 'soft' || tone === 'tough') ? `is-${tone}` : ''}${play ? ' is-play' : ''}`} title={title}>
                      {r ? num(r.exp) : '—'}
                      {play ? <small className="ir-roster-play">o{play.line} {pct(play.p)}{final && play.hit != null ? <span className={play.hit ? 'is-hit' : 'is-miss'}> {play.hit ? 'hit' : 'miss'}</span> : null}</small> : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamColumn({ side, sport, final, metric, season }) {
  const [win, setWin] = useState('season');
  const view = windowsOf(side.allowed).includes(win) ? win : 'season';
  return (
    <section className="ir-gf-team" aria-label={`${side.team} ${side.venue === 'H' ? 'vs' : 'at'} ${side.opp}`}>
      <div className="ir-gf-team-head">
        <img src={sport.teamLogo(side.team)} alt="" width="28" height="28" loading="lazy" />
        <b>{sport.teamName(side.team)}</b>
        <small className="nhlx-auto-meta">{side.venue === 'H' ? 'vs' : 'at'} {side.opp}</small>
      </div>
      <p className="ir-gf-out"><b>Out</b> {side.out?.length ? side.out.map((a) => `${a.name}${a.status && a.status !== 'Out' ? ` (${a.status})` : ''}`).join(' · ') : 'nobody listed'}</p>
      <AllowedTable side={side} win={view} metric={metric} season={season} onWin={setWin} />
      <div className="nhlx-pfd-head"><b>Projected tonight</b><small className="nhlx-auto-meta">tinted by the matchup at his spot · a play’s line and chance under the figure · click a row for the card</small></div>
      <Roster side={side} final={final} />
    </section>
  );
}

/** A game folded to one line; pressed, the characteristics and both courts, the team columns and the tables behind a switch. */
export default function GameFold({ g, best = [], sport, metric, onMetric, open: openProp = null, onToggle = null, profileView = null, onProfileView = null }) {
  const [openOwn, setOpenOwn] = useState(false);
  const open = openProp ?? openOwn;
  const setOpen = (fn) => { const next = typeof fn === 'function' ? fn(open) : fn; if (onToggle) onToggle(next); else setOpenOwn(next); };
  const [more, setMore] = useState(false);
  const mine = best.filter((r) => r.game === g.id);
  const top = mine[0] || null;
  const graded = mine.filter((r) => r.hit != null);   // the best bets graded once the game is stored
  const sides = [g.sides?.[g.away], g.sides?.[g.home]].filter(Boolean);
  const outs = sides.reduce((n, s) => n + (s.out?.length || 0), 0);
  const bodyId = `nba-game-${g.id}`;
  return (
    <article className={`ir-gf${open ? ' is-open' : ''}`}>
      <button type="button" className="ir-gf-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
        <span className="ir-gf-teams">
          <img src={sport.teamLogo(g.away)} alt="" width="24" height="24" loading="lazy" />{g.away}
          <i>@</i>
          <img src={sport.teamLogo(g.home)} alt="" width="24" height="24" loading="lazy" />{g.home}
        </span>
        <span className="ir-gf-meta">{statusOf(g)}</span>
        <span className="ir-gf-meta">{outs ? `${outs} out` : 'nobody out'}</span>
        <span className="ir-gf-meta">{mine.length} play{mine.length === 1 ? '' : 's'}{graded.length ? ` · ${graded.filter((r) => r.hit).length} of ${graded.length} hit` : ''}</span>
        <span className="ir-gf-best">{top ? <>Best: <b>{top.player}</b> {playLabel(top)} · {pct(top.p)}</> : 'No play over the floor'}</span>
        <svg className="ir-gf-caret" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open ? (
        <div className="ir-gf-body" id={bodyId}>
          {g.profile ? <GameProfile g={g} sport={sport} view={profileView} onView={onProfileView} /> : g.characteristics ? <GameCharacteristics game={g} renderTeam={teamMark(sport)} pill={expectedPill(g, sport)} /> : null}
          <CourtPair g={g} metric={metric} onMetric={onMetric} sport={sport} />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? 'Hide the team columns and the tables' : 'Show the team columns and the tables'}</button>
          {more ? (
            <>
              <div className="ir-gf-cols">
                {sides.map((side) => <TeamColumn key={side.team} side={side} sport={sport} final={g.final} metric={metric} season={g.season || null} />)}
              </div>
              {g.plays ? <div className="ir-nfl-grid">{sport.groups.map(([key, label]) => <GroupTable key={key} label={label} t={g.tables[key]} final={g.final} sport={sport} />)}</div> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
