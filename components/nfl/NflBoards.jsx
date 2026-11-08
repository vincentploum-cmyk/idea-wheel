'use client';

import { useState } from 'react';
import { teamLogo, teamName } from '@/lib/nfl/teams';
import { spreadOf, passText, shareText, NFL_OUTLIERS } from '@/lib/nfl/projections';
import { fmtOdds } from '@/lib/nfl/odds';
import { sortOutliers, nextSort, SortHead, recordText } from '@/components/picks/OutlierSort';
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
        <th className="ir-slate-rank">#</th><th>Player</th><th className="is-num ir-ml-proj" title={kind === 'passing' ? 'Tonight’s projection: his starts, the game’s total and spread, the defense (hover a figure)' : kind === 'receiving' ? 'Tonight’s projection: his skill × tonight’s matchup, with his share of the team’s targets (hover a figure)' : 'Tonight’s projection: his skill × tonight’s matchup'}>Proj</th>
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
              <td><Who r={r} game={game} /></td><td className="is-num ir-ml-proj" title={y?.pass ? passText(y.pass) : y?.tgtShare != null ? shareText(y) : undefined}><b>{y?.proj == null ? '—' : Math.round(y.proj)}</b><small>{c?.proj != null ? `${Number(c.proj).toFixed(1)} rec` : 'yds'}</small></td>
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
          {weak.length ? <p className="ir-ml-def">{weak.map(({ team: t, d }) => <span key={t} title={d.from === 'sheet' ? 'From the cheat sheet’s defense snapshot' : `PropFinder’s table: what ${d.of} gives up per game at each position and slot this season, #1 = the most of ${d.count || 32}`}><b>{d.of} defense</b> gives up the most to {d.weak.slice(0, 3).map((w) => `${w.word} (#${w.rank})`).join(', ')}</span>)}</p> : null}
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
    Each mark is the highest he reaches tonight at that chance: <b>strong</b> 60%+ · <b>lean</b> 45%+ · <b>thin</b> 30%+ — his skill × tonight’s matchup (PropFinder’s defense table). <span className="ir-bd-role is-active">if active</span> a game-time decision · <span className="ir-bd-role is-role">if role confirmed</span> a teammate is out.
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

// ── Tight ends (Vincent, 2026-11-03: "We should also have a tight end tab … the books price these nicely"): the week's tight
// ends alone, their receiving ladders and their touchdown chances, the same reads as the other tabs. Checked on 2026's weeks
// 1–7 (docs/audits/2026-11-03-nfl-engines.md, "tight ends"): no tight-end fit of its own read closer than the shipped one
// (within 10 yards 43.8% of 409 games against 41.3–42.8%), and its rungs land as said (strong 66 → 65%, lean 50 → 51%).
const TE_KINDS = [['receiving', 'Receiving Yards'], ['td', 'TDs']];
export function NflTightEnds({ board }) {
  const [kind, setKind] = useState('receiving');
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">{NO_DATA}</div>;
  const ids = (pj.lists?.[kind] || []).filter((id) => pj.rows[id]?.pos === 'TE');
  return (
    <div className="ir-overview">
      <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Tight ends">
        {TE_KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={`nhlx-tab${kind === k ? ' is-active' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {LEGEND}
      <ListOf key={kind} pj={pj} ids={ids} kind={kind} game limit empty={NO_DATA} />
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

// ── Outliers (Vincent, 2026-11-08: "Build the same outlier functionality for NFL"; the NBA's Big games → Outliers): per stat
// the week's likeliest to reach about double his projection (lib/nfl/projections.js NFL_OUTLIERS), with his floor and ceiling,
// the book's price at that mark when its ladder has the line, and his games at the mark this season and last.
const OUT_KINDS = Object.entries(NFL_OUTLIERS).map(([k, v]) => [k, v.label]);
/** Why a player is on the outliers list: his games at the mark this season, then last season's. */
export const nflOutlierWhy = (o) => recordText(o) || '—';
function OutlierTable({ pj, market }) {
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState({ key: 'p', dir: 'desc' });
  const listed = (pj.lists?.outliers?.[market] || []).map((id) => pj.rows[id]).filter((r) => r?.outliers?.[market]).map((r) => ({ ...r.outliers[market], player: r.player, r }));
  if (!listed.length) return <p className="nhlx-auto-meta ir-ml-empty">No outlier candidate yet: the week needs a PropFinder pull.</p>;
  const rows = sortOutliers(listed, sort);
  const onSort = (k) => setSort((cur) => nextSort(cur, k));
  const final = rows.some((o) => o.r.final);
  const shown = all ? rows : rows.slice(0, BIG_SHOW);
  const head = { sort, onSort };
  const unit = market === 'receptions' ? 'receptions' : 'yards';
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-ml-table ir-big-table ir-out-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th>
            <SortHead k="player" label="Player" {...head} />
            <SortHead k="proj" label={<><span className="ir-out-full">Projected</span><span className="ir-out-short">Proj</span></>} className="is-num" title="This week’s projection" {...head} />
            <SortHead k="floor" label="Floor" className="is-num" title="A bad day: he lands under it one game in five" {...head} />
            <SortHead k="ceiling" label="Ceiling" className="is-num" title="A good day: he lands over it one game in five" {...head} />
            <SortHead k="mark" label="Outlier" className="is-num" title={`About double his projection (at least ${NFL_OUTLIERS[market].add} ${unit} over it)`} {...head} />
            <SortHead k="p" label="Chance" className="is-num is-lead" title="His chance of the outlier this week" {...head} />
            <SortHead k="book" label="Book" className="is-num" title="The book’s price at the outlier, where its ladder has the line, and the chance over its implied one (sorts by that edge)" {...head} />
            <SortHead k="season" label="Why" className="ir-big-why" title="Sorts by how often he reached the mark this season" {...head} />
            {final ? <SortHead k="got" label="Got" className="is-num" {...head} /> : null}
          </tr></thead>
          <tbody>
            {shown.map((o, i) => (
              <tr key={o.r.id}>
                <td className="ir-slate-rank">{i + 1}</td>
                <td><Who r={o.r} game /><small className="ir-big-why-m">{nflOutlierWhy(o)}</small></td>
                <td className="is-num">{market === 'receptions' ? o.proj : Math.round(o.proj)}</td>
                <td className="is-num">{o.floor ?? <small>—</small>}</td>
                <td className="is-num">{o.ceiling ?? <small>—</small>}</td>
                <td className="is-num"><b>{o.mark}+</b></td>
                <td className={`is-num is-lead${o.hit == null ? '' : o.hit ? ' is-hit' : ' is-miss'}`} title={`Half his own spread (${pct(o.raw)}), half the spread usual for a ${market === 'receptions' ? o.proj : Math.round(o.proj)} projection (${pct(o.typical)})`}><b>{pct(o.p)}</b></td>
                <td className="is-num" title={o.book ? `o${o.book.line} at ${fmtOdds(o.book.odds)}: the book says ${pct(o.book.implied)}, the board ${pct(o.p)}` : 'The book’s ladder has no line at the outlier'}>{o.book ? <><b>{fmtOdds(o.book.odds)}</b><small className={`ir-out-edge${o.book.edge > 0 ? ' is-pos' : ''}`}> {o.book.edge >= 0 ? '+' : '−'}{Math.abs(Math.round(o.book.edge * 100))}</small></> : <small>—</small>}</td>
                <td className="ir-big-why"><small>{nflOutlierWhy(o)}</small></td>
                {final ? <td className="is-num nhlx-pk-got"><Got v={o.actual ?? undefined} /></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && rows.length > BIG_SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

const OUT_LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    The players likeliest to have an <b>outlier</b> game: about double their projection (at least 40 more receiving or rushing yards, 3 more receptions). He lands between his floor and ceiling three games in five; the outlier is well past the ceiling. In the NFL these are mostly luck: the week’s top ten land about one in six, against one in ten for everyone. The book’s price beside it when its ladder has the line. Click a column to sort.
  </p>
);

/** The Big games tab: per stat the week's likeliest big games, and beside them the outliers. */
export function NflBigGames({ board, initialView = 'big' }) {
  const [view, setView] = useState(initialView);
  const [market, setMarket] = useState('rush_yds');
  const [outMarket, setOutMarket] = useState('rec_yds');
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">{NO_DATA}</div>;
  const kinds = view === 'big' ? BIG_KINDS : OUT_KINDS;
  const current = view === 'big' ? market : outMarket;
  const pick = view === 'big' ? setMarket : setOutMarket;
  return (
    <div className="ir-overview">
      <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="List">
        {[['big', 'Big games'], ['outliers', 'Outliers']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={`nhlx-tab${view === k ? ' is-active' : ''}`} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Stat">
        {kinds.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={current === k} className={`nhlx-tab${current === k ? ' is-active' : ''}`} onClick={() => pick(k)}>{l}</button>)}
      </div>
      {view === 'big' ? <BigTable pj={pj} ids={pj.lists?.big?.[market] || []} market={market} limit /> : <OutlierTable pj={pj} market={outMarket} />}
      {view === 'big' ? BIG_LEGEND : OUT_LEGEND}
    </div>
  );
}
