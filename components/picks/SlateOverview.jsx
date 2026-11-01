'use client';

import { useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { rankGames, topPlays, passes, orderBy, fmtEv, DEFAULTS } from '@/lib/picks/value';
import { playLabel } from './Board';
import SlateList from './SlateList';
import ValueControls from './ValueControls';

// The slate overview (the brief of 2026-10-31, level 1: "the top of the page answers two questions in under five
// seconds, no scrolling: which games are the best matchups to attack, which plays are the most +EV"): the value
// controls, then Top Matchups — the games by their Matchup Score, a compact card each: the matchup, the tip, the
// leak badge, how many +EV plays, the top play with its EV, the heat on the score — and Top Plays, every +EV play
// across the slate in one table, the best value first. Everything below the overview is drill-down.
//   board: the picks board (lib/picks/board.js, `best` and `matchup` on every game)
//   filters / onFilters / onReset: the user's floors (value-filters.js); the overview re-ranks with them
//   onGame(id): a card pressed (the NBA's dropdown pick, the NFL's scroll to the game); onOpen(row): the player's card

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) : '');

function statusOf(g, withDay) {
  if (g.final) return `Final ${g.awayScore}–${g.homeScore}`;
  if (g.state === 'in') return `Live ${g.awayScore}–${g.homeScore}`;
  return `${withDay ? `${fmtDay(g.date)} ` : ''}${fmtTip(g.date)}`;
}

/** The heat of a score against the slate's best: 'hot' (the top third of the best), 'warm', 'cool', 'none' (no +EV play). */
export function heatOf(score, max) {
  if (!(score > 0) || !(max > 0)) return 'none';
  const r = score / max;
  return r >= 0.67 ? 'hot' : r >= 0.34 ? 'warm' : 'cool';
}

/** The games ranked, each with the user's matchup read and the plays passing the floors. */
export function useRanked(board, filters) {
  return useMemo(() => {
    const ranked = rankGames(board, filters);
    const max = Math.max(0, ...ranked.map((r) => r.matchup.score));
    return { ranked, max };
  }, [board, filters]);
}

/** The cards shown before "Show all": two rows at 1440 (the brief: the top three games in under five seconds, no scroll). */
const CARDS = 8;

export function MatchupCards({ board, sport, filters, onGame = null, withDay = false, picked = null }) {
  const { ranked, max } = useRanked(board, filters);
  const [all, setAll] = useState(false);
  if (!ranked.length) return null;
  // The games with a play clearing the floors lead; the rest fold to a line until "Show all".
  const scored = ranked.filter((r) => r.matchup.score > 0);
  const shown = all ? ranked : scored.slice(0, CARDS);
  const rest = ranked.filter((r) => !shown.includes(r));
  return (
    <section className="ir-tm" aria-label="Top matchups">
      <div className="nhlx-pfd-head">
        <b>Top matchups</b>
        <small className="nhlx-auto-meta">the games by their Matchup Score: the top three plays’ EV in points, half a point a +EV play, × 1.15 a leak tier of the softer defense{sport.totalStat ? ', the pace and total folded in, damped on a big spread' : ''} · hover a score for its parts · press a game to open it</small>
        {rest.length || all ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-all" onClick={() => setAll((v) => !v)}>{all ? `Top ${Math.min(CARDS, scored.length) || 'games'}` : `Show all ${ranked.length}`}</button> : null}
      </div>
      {!shown.length ? <p className="nhlx-auto-meta">No game has a play clearing the floors{filters.marginal ? '' : ' · "Show marginal" lists the rest'}.</p> : null}
      <div className="ir-tm-grid">
        {shown.map(({ game: g, matchup: m }, i) => {
          const heat = heatOf(m.score, max);
          const top = m.topPlay;
          const leak = m.leak || {};
          const why = [
            `Matchup Score ${m.score}: (${m.base >= 0 ? '+' : ''}${(m.base * 100).toFixed(1)}% the top ${Math.min(3, m.breadth)} plays’ EV + 0.5 × ${m.breadth} +EV play${m.breadth === 1 ? '' : 's'}) × ${m.leakMult} (leak tier ${leak.tier ?? 0}${leak.defense != null ? `: defense ${leak.defense}${leak.pace ? `, pace / total ${leak.pace > 0 ? '+' : ''}${leak.pace}` : ''}` : ''})${m.blowout !== 1 ? ` × ${m.blowout} (spread ${m.spread}: starters benched late)` : ''}`,
            ...Object.values(leak.teams || {}).map((t) => `${t.word === 'Average' ? 'an average' : `a ${t.word.toLowerCase()}`} defense${t.from?.allows || t.from?.spots ? ` (${[t.from.allows, t.from.spots ? `soft spots ${t.from.spots.toLowerCase()}` : null].filter(Boolean).join(', ')})` : ''}`),
            leak.script ? `game script: ${leak.script}` : null,
          ].filter(Boolean).join(' · ');
          const El = onGame ? 'button' : 'div';
          return (
            <El key={g.id} {...(onGame ? { type: 'button', onClick: () => onGame(g.id) } : {})} className={`ir-tm-card is-${heat}${picked === g.id ? ' is-picked' : ''}`} title={why}>
              <span className="ir-tm-rank">{i + 1}</span>
              <span className="ir-tm-teams">
                <img src={sport.teamLogo(g.away)} alt="" width="22" height="22" loading="lazy" />{g.away}
                <i>@</i>
                <img src={sport.teamLogo(g.home)} alt="" width="22" height="22" loading="lazy" />{g.home}
              </span>
              <span className="ir-tm-meta">{statusOf(g, withDay)}{g.odds?.spread ? ` · ${g.odds.spread}` : ''}</span>
              <span className="ir-tm-badges">
                {Object.values(leak.teams || {}).filter((t) => t.tier > 0).map((t, k) => <span key={k} className={`nhlx-edge is-soft`}>{Object.keys(leak.teams).find((a) => leak.teams[a] === t)} {t.word.toLowerCase()}</span>)}
                {leak.pace > 0 ? <span className="nhlx-edge is-soft" title={leak.script || ''}>fast · high</span> : leak.pace < 0 ? <span className="nhlx-edge is-tough" title={leak.script || ''}>slow · low</span> : null}
                {m.blowout !== 1 ? <span className="nhlx-edge is-tough" title={`Spread ${m.spread}: the score × ${m.blowout}`}>blowout risk</span> : null}
              </span>
              <span className="ir-tm-count"><b>{m.breadth}</b> +EV play{m.breadth === 1 ? '' : 's'}</span>
              <span className="ir-tm-top">{top ? <><b>{top.player}</b> {playLabel(top)} · <em className={`ir-ev-${top.ev >= DEFAULTS.minEv ? 'good' : 'thin'}`}>{fmtEv(top.ev)}</em> at {fmtOdds(top.odds)}</> : <span className="nhlx-auto-meta">no play clears the floors</span>}</span>
              <span className="ir-tm-score" aria-label="Matchup score"><b>{m.score}</b><small>score</small></span>
            </El>
          );
        })}
      </div>
      {!all && rest.length ? <p className="ir-tm-rest nhlx-auto-meta">{rest.filter((r) => r.matchup.score > 0).length ? `${rest.filter((r) => r.matchup.score > 0).length} more with a play, ` : ''}{rest.filter((r) => !(r.matchup.score > 0)).length ? `${rest.filter((r) => !(r.matchup.score > 0)).length} without one clearing the floors` : ''}: {rest.map((r) => <button key={r.game.id} type="button" className="ir-tm-link" onClick={() => onGame?.(r.game.id)}>{r.game.away} @ {r.game.home}</button>)}</p> : null}
    </section>
  );
}

/** The whole overview: the controls, Top Matchups, Top Plays. */
export default function SlateOverview({ board, sport, filters, onFilters, onReset = null, onGame = null, onOpen = null, withDay = false, picked = null, title = 'Top plays' }) {
  const f = useMemo(() => ({ ...DEFAULTS, ...(filters || {}) }), [filters]);
  const rows = useMemo(() => {
    const top = topPlays(board, f);
    if (!f.marginal) return top;
    // The marginal rows after the ones that pass, in the same order (a failing row never outranks a passing one).
    const rest = (board?.best || []).filter((x) => !passes(x, f)).sort(orderBy(f.sort === 'chance' ? 'chance' : 'ev'));
    return [...top, ...rest];
  }, [board, f]);
  const all = board?.best?.length || 0;
  const passing = useMemo(() => (board?.best || []).filter((x) => passes(x, f)).length, [board, f]);
  if (!board?.games?.length) return null;
  return (
    <div className="ir-overview">
      <ValueControls filters={f} onChange={onFilters} onReset={onReset} counts={{ passing, all }} minMinutes={board.value?.minMinutes || null} />
      <MatchupCards board={board} sport={sport} filters={f} onGame={onGame} withDay={withDay} picked={picked} />
      <SlateList board={board} sport={sport} rows={rows} filters={f} onFilters={onFilters} onOpen={onOpen} title={title} />
    </div>
  );
}

