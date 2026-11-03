'use client';

import { useState } from 'react';
import { teamLogo, teamName } from '@/lib/nfl/teams';
import { spreadOf, passText } from '@/lib/nfl/projections';
import { headshotUrl } from '@/lib/nfl/espn';

// The NFL page's lists (Vincent, 2026-11-01: "I just need a simple list of games and per game, players listed with their
// ladders: strong - 50+ yards (60%), lean - 60+ yards, thin 70+ yards … For touchdowns, I need first touch down, first half
// touch and 2 touch downs"): one card a game with three tabs — TDs, Receiving, Rushing —, and the same lists across every
// game (`NflList`). The figures are lib/nfl/projections.js's (`board.projections`): per player the highest round mark he
// reaches tonight at 60% (strong), 45% (lean) and 30% (thin) — his skill × tonight's matchup (PropFinder's table and the
// cheat sheet's snapshot), read off how far games really land from the projection — and his touchdown chances. No price,
// no edge, no juice.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 0) => (v == null ? '—' : Number(v).toFixed(d));
export const KINDS = [['td', 'TDs'], ['passing', 'Pass Yards'], ['receiving', 'Receiving Yards'], ['rushing', 'Rushing Yards']];
const MARKET = { passing: 'pass_yds', receiving: 'rec_yds', rushing: 'rush_yds' };
const SHOW = 40;

function Who({ r, game = false }) {
  return (
    <div className="nhlx-db-player">
      {r.espnId ? <img src={headshotUrl(r.espnId)} alt="" width="28" height="28" loading="lazy" /> : <img src={teamLogo(r.team)} alt="" width="28" height="28" loading="lazy" className="ir-nfl-logo" />}
      <span>
        <b>{r.player}{r.onSheet ? <small className="ir-sh-check" title="On the cheat sheet"> ✓</small> : null}</b>
        <small>
          {r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos}{game ? ` · ${r.venue === 'H' ? 'vs' : '@'} ${r.opp}` : ''}
          {r.health === 'DTD' ? <> · <span className="ir-health is-dtd" title={r.injury || ''}>DTD</span></> : null}
          {(r.role || []).map((x) => <span key={x.kind} className={`ir-bd-role is-${x.kind}`} title={x.why}>{x.word}</span>)}
        </small>
      </span>
    </div>
  );
}

const Got = ({ v }) => (v === undefined ? <small>—</small> : v === null ? <small>DNP</small> : <b>{v}</b>);

const hitOf = (v) => (v === undefined || v === null ? '' : v ? ' is-hit' : ' is-miss');

/** The anytime chance's arithmetic for the hover: the board's read, his red-zone looks and the points his team is expected to score (the touchdown engine). */
function tdWhy(t) {
  if (t?.board == null) return undefined;
  const parts = [`${pct(t.board)} from his touchdown rate and touches`];
  if (t.rz != null) parts.push(`${Number(t.rz).toFixed(1)} red-zone looks a game over his last 5`);
  if (t.points != null) parts.push(`his team expected to score ${t.points}`);
  return `${parts.join(' · ')} → ${pct(t.p)}`;
}

function TdTable({ rows, game }) {
  const final = rows.some((r) => r.final);
  const cols = [
    ['p', 'Anytime', 'His chance of a touchdown in the game', (t) => (t.actual == null ? undefined : t.actual > 0)],
    ['p1h', '1st half', 'His chance of a touchdown before the half', (t) => (t.actual1h == null ? undefined : t.actual1h > 0)],
    ['pFirst', 'First TD', 'His chance of scoring the game’s first touchdown', (t) => (t.actualFirst == null ? undefined : t.actualFirst > 0)],
    ['p2', '2+ TDs', 'His chance of two touchdowns or more', (t) => (t.actual == null ? undefined : t.actual >= 2)],
  ];
  return (
    <table className="nhlx-db-table nhlx-pk-table ir-ml-table">
      <thead><tr>
        <th className="ir-slate-rank">#</th><th>Player</th><th className="is-num ir-ml-proj" title="His touchdowns expected tonight">Proj</th>
        {cols.map(([k, l, t]) => <th key={k} className={`is-num${k === 'p' ? ' is-lead' : ''}`} title={t}>{l}</th>)}
        {final ? <th className="is-num">TDs</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const t = r.td;
          return (
            <tr key={r.id}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} /></td><td className="is-num ir-ml-proj"><b>{t.lambda == null ? '—' : Number(t.lambda).toFixed(2)}</b><small>TDs</small></td>
              {cols.map(([k, , , hit]) => (
                <td key={k} className={`is-num${k === 'p' ? ' is-lead' : ''}${final ? hitOf(hit(t)) : ''}`} title={k === 'p' ? tdWhy(t) : undefined}>
                  <b>{pct(t[k])}</b>{k === 'p' && t.tier ? <small className={`ir-ml-tier is-${t.tier}`}>{t.tier}</small> : null}
                </td>
              ))}
              {final ? <td className="is-num nhlx-pk-got"><Got v={t.actual} /></td> : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const UNIT = { rec_yds: 'yds', rush_yds: 'yds', pass_yds: 'yds', receptions: 'rec' };
const TIERS = [['strong', 'Strong'], ['lean', 'Lean'], ['thin', 'Thin']];
/** One rung: "50+ yds" over its chance; green / red once the game is in. */
function Rung({ y, market, tier }) {
  const t = y?.tiers?.[tier];
  if (!t) return <small className="ir-ml-none">—</small>;
  const hit = y.actual == null ? '' : y.actual >= t.mark ? ' is-hit' : ' is-miss';
  return <span className={`ir-ml-rung${hit}`}><b>{t.mark}+ {UNIT[market]}</b><small>{pct(t.p)}</small></span>;
}

function YardsTable({ rows, kind, game }) {
  const market = MARKET[kind];
  const final = rows.some((r) => r.final);
  const rec = kind === 'receiving';
  return (
    <table className="nhlx-db-table nhlx-pk-table ir-ml-table">
      <thead><tr>
        <th className="ir-slate-rank">#</th><th>Player</th><th className="is-num ir-ml-proj" title={kind === 'passing' ? 'Tonight’s projection: his starts, the game’s total and spread, the defense (hover a figure)' : 'Tonight’s projection: his skill × tonight’s matchup'}>Proj</th>
        {TIERS.map(([k, l]) => <th key={k} className={`ir-ml-th is-${k}`} title={`The highest mark he reaches tonight at ${k === 'strong' ? '60' : k === 'lean' ? '45' : '30'}% or better`}>{l}</th>)}
        {final ? <th className="is-num">Got</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const y = r.yards[market];
          const c = rec ? r.yards.receptions : null;
          return (
            <tr key={r.id}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} /></td><td className="is-num ir-ml-proj" title={y?.pass ? passText(y.pass) : undefined}><b>{y?.proj == null ? '—' : Math.round(y.proj)}</b><small>{c?.proj != null ? `${Number(c.proj).toFixed(1)} rec` : 'yds'}</small></td>
              {TIERS.map(([k]) => (
                <td key={k} className={`ir-ml-cell is-${k}`}>
                  <Rung y={y} market={market} tier={k} />
                  {c ? <Rung y={c} market="receptions" tier={k} /> : null}
                </td>
              ))}
              {final ? <td className="is-num nhlx-pk-got"><Got v={y.actual} />{rec && c?.actual != null ? <small>{c.actual} rec</small> : null}</td> : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ListOf({ pj, ids, kind, game = false, limit = false, empty }) {
  const [all, setAll] = useState(false);
  const rows = ids.map((id) => pj.rows[id]).filter(Boolean);
  if (!rows.length) return <p className="nhlx-auto-meta ir-ml-empty">{empty}</p>;
  const shown = !limit || all ? rows : rows.slice(0, SHOW);
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">{kind === 'td' ? <TdTable rows={shown} game={game} /> : <YardsTable rows={shown} kind={kind} game={game} />}</div>
      {limit && !all && rows.length > SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

const NO_DATA = 'No projection yet: the week needs a PropFinder pull.';

/** A team's spread as the book writes it on its row ("+1.5", "-1.5", "PK"), from ESPN's "NYJ -1.5". */
function spreadFor(odds, team) {
  const sp = spreadOf(odds?.spread);
  if (!sp) return null;
  if (!sp.team || !sp.pts) return 'PK';
  return sp.team === team ? `-${sp.pts}` : `+${sp.pts}`;
}
const kickoff = (iso) => (iso ? `${new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })} ${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(' ', '')} ET` : '');

/**
 * One game as a sportsbook lists it (Vincent, 2026-11-01, with a sportsbook's games page as the form): the matchup and
 * the kickoff, a row a team with its logo, its spread and the total (the line alone, no price); press it for the
 * players — TDs, Pass Yards, Receiving Yards, Rushing Yards — and the cheat sheet's read on each defense.
 */
function GameRow({ g, pj, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [kind, setKind] = useState('td');
  const live = !g.final && g.state === 'in';
  const scored = g.final || live;
  const status = g.final ? 'Final' : live ? 'Live' : kickoff(g.date);
  const total = g.odds?.total != null ? g.odds.total : null;
  const weak = [g.away, g.home].map((team) => ({ team, d: g.teams?.[team]?.defense })).filter((x) => x.d?.weak?.length);
  const team = (abbr, side) => {
    const score = side === 'away' ? g.awayScore : g.homeScore;
    const sp = spreadFor(g.odds, abbr);
    return (
      <span className="ir-gm-team">
        <img src={teamLogo(abbr)} alt="" width="34" height="34" className="ir-nfl-logo" />
        <span className="ir-gm-name">{teamName(abbr)}</span>
        {scored && score != null ? <b className="ir-gm-score">{score}</b> : <span />}
        <span className={`ir-gm-box${sp ? '' : ' is-empty'}`}>{sp || '—'}</span>
        <span className={`ir-gm-box${total != null ? '' : ' is-empty'}`}>{total != null ? `${side === 'away' ? 'O' : 'U'} ${total}` : '—'}</span>
      </span>
    );
  };
  return (
    <section className={`ir-gm${open ? ' is-open' : ''}`} aria-label={`${g.away} at ${g.home}`}>
      <button type="button" className="ir-gm-top" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="ir-gm-title">{g.away} {teamName(g.away)} @ {g.home} {teamName(g.home)}<i aria-hidden="true">›</i></span>
        <span className="ir-gm-time">{status}</span>
        {team(g.away, 'away')}
        {team(g.home, 'home')}
      </button>
      {open ? (
        <div className="ir-gm-detail">
          {weak.length ? <p className="ir-ml-def">{weak.map(({ team: t, d }) => <span key={t} title="From the cheat sheet’s defense snapshot"><b>{d.of} defense</b> gives up the most to {d.weak.slice(0, 3).map((w) => `${w.word} (#${w.rank})`).join(', ')}</span>)}</p> : null}
          <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="List">
            {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={`nhlx-tab${kind === k ? ' is-active' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <ListOf pj={pj} ids={g.lists?.[kind] || []} kind={kind} empty={NO_DATA} />
        </div>
      ) : null}
    </section>
  );
}

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    Each mark is the highest he reaches tonight at that chance: <b>strong</b> 60%+ · <b>lean</b> 45%+ · <b>thin</b> 30%+ — his skill × tonight’s matchup (PropFinder and the cheat sheet). ✓ = on the cheat sheet. <span className="ir-bd-role is-active">if active</span> a game-time decision · <span className="ir-bd-role is-role">if role confirmed</span> a teammate is out.
  </p>
);

/** The Games tab: the week's games as a sportsbook lists them, each opening on its players. */
export function NflMatchups({ board, openFirst = false }) {
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">{NO_DATA}</div>;
  return (
    <div className="ir-gm-list">
      <div className="ir-gm-cols" aria-hidden="true"><span>Spread</span><span>Total</span></div>
      {pj.games.map((g, i) => <GameRow key={g.id} g={g} pj={pj} defaultOpen={openFirst && i === 0} />)}
      {LEGEND}
    </div>
  );
}

/** One list across every game of the week: 'td' | 'passing' | 'receiving' | 'rushing'. */
export function NflList({ board, kind }) {
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">{NO_DATA}</div>;
  return (
    <div className="ir-overview">
      {LEGEND}
      <ListOf pj={pj} ids={pj.lists?.[kind] || []} kind={kind} game limit empty={NO_DATA} />
    </div>
  );
}

export default NflMatchups;

// ── Big games (Vincent, 2026-11-01: "how can I find the super matchups that result in the big wins", then "find out what
// the best cocktail is … by looking for patterns in the box scores of players that reached these"): per stat the players
// likeliest to reach 100+ / 150+ (300+ / 350+ passing) tonight, read with what predicted those games on 2024–26's box
// scores (lib/nfl/projections.js BIG; docs/audits/2026-11-01-nfl-big-games.md).
const BIG_KINDS = [['rush_yds', 'Rushing'], ['rec_yds', 'Receiving'], ['pass_yds', 'Passing']];
const BIG_SHOW = 25;
function bigWhy(market, b) {
  const c = b.ctx || {};
  if (market === 'rush_yds') return c.points != null ? `team expected ${c.points} pts` : 'no line yet';
  if (market === 'rec_yds') return c.tgtShare != null ? `${Math.round(c.tgtShare * 100)}% of the targets lately` : 'target share unknown';
  return c.total != null ? `game total ${c.total}` : 'no line yet';
}
function BigTable({ pj, ids, market, limit }) {
  const [all, setAll] = useState(false);
  const rows = ids.map((id) => pj.rows[id]).filter((r) => r?.big?.[market]);
  if (!rows.length) return <p className="nhlx-auto-meta ir-ml-empty">No big-game candidate yet: the week needs a PropFinder pull.</p>;
  const shown = all || !limit ? rows : rows.slice(0, BIG_SHOW);
  const marks = rows[0].big[market].marks;
  const final = rows.some((r) => r.final);
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-ml-table ir-big-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th><th>Player</th>
            {marks.map((mk, i) => <th key={mk} className={`is-num${i === 0 ? ' is-lead' : ''}`} title={`His chance of ${mk}+ yards tonight`}>{mk}+</th>)}
            <th className="is-num" title="Tonight’s projection">Proj</th>
            <th className="ir-big-why">Why</th>
            {final ? <th className="is-num">Got</th> : null}
          </tr></thead>
          <tbody>
            {shown.map((r, i) => {
              const b = r.big[market];
              return (
                <tr key={r.id}>
                  <td className="ir-slate-rank">{i + 1}</td>
                  <td><Who r={r} game /><small className="ir-big-why-m">{bigWhy(market, b)}</small></td>
                  {marks.map((mk, j) => <td key={mk} className={`is-num${j === 0 ? ' is-lead' : ''}${b.hits ? (b.hits[mk] ? ' is-hit' : ' is-miss') : ''}`}><b>{b.p[mk] != null && b.p[mk] < 0.005 ? '<1%' : pct(b.p[mk])}</b></td>)}
                  <td className="is-num">{b.proj == null ? '—' : Math.round(b.proj)}</td>
                  <td className="ir-big-why"><small>{bigWhy(market, b)}</small></td>
                  {final ? <td className="is-num nhlx-pk-got"><Got v={b.actual ?? undefined} /></td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {limit && !all && rows.length > BIG_SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

const BIG_LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    The players likeliest to have a <b>big game</b> tonight. Checked on 2024–26’s box scores, what predicts one is his volume, plus: for rushing, how many points his team is expected to score; for receiving, his share of the targets; for passing, the game total. The opponent’s defense did not. Checked on seasons it never saw, the week’s top five at 100+ landed about one in three. These are long shots, not safe plays.
  </p>
);

/** The Big games tab: per stat the week's likeliest big games. */
export function NflBigGames({ board }) {
  const [market, setMarket] = useState('rush_yds');
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">{NO_DATA}</div>;
  return (
    <div className="ir-overview">
      <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Stat">
        {BIG_KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-tab${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>{l}</button>)}
      </div>
      <BigTable pj={pj} ids={pj.lists?.big?.[market] || []} market={market} limit />
      {BIG_LEGEND}
    </div>
  );
}
