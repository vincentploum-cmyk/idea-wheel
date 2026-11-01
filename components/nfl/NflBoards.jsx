'use client';

import { useState } from 'react';
import { teamLogo } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';
import { TD_TIERS } from '@/lib/nfl/projections';

// The NFL projections as plain lists (Vincent, 2026-11-01: "Why am I not seeing a simple list of players and their
// projected yards / receptions per game … Player - yards (strong) yards (lean) yards (thin) … In case of touch down:
// Player - chance% of td"): the Matchups tab, one card a game with three tabs — TDs, Receiving, Rushing —, and the same
// three lists across every game (`NflList`). The figures are lib/nfl/projections.js's (`board.projections`): tonight's
// projection = his skill (his rate) × the matchup (the defense at his slot, PropFinder's table and the cheat sheet's
// snapshot) × the game script (the book's total and spread), with his floor and ceiling around it (Vincent, 2026-11-01:
// "based on today's matchup and the player's skill, and today's script, this is the floor and this is the ceiling"); a
// touchdown chance is strong from 45%, lean from 30%, thin under that. No price anywhere.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 0) => (v == null ? '—' : Number(v).toFixed(d));
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) : '');
export const KINDS = [['td', 'TDs'], ['receiving', 'Receiving'], ['rushing', 'Rushing']];
const MARKET = { receiving: 'rec_yds', rushing: 'rush_yds' };
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

function TdTable({ rows, game }) {
  const final = rows.some((r) => r.final);
  return (
    <table className="nhlx-db-table nhlx-pk-table ir-ml-table">
      <thead><tr>
        <th className="ir-slate-rank">#</th><th>Player</th>
        <th className="is-num is-lead" title="His chance of an anytime touchdown">TD chance</th>
        <th title={`Strong from ${pct(TD_TIERS.strong)}, lean from ${pct(TD_TIERS.lean)}, thin under that`}>Read</th>
        <th className="is-num" title="His chance of a touchdown in the first half">1st half</th>
        {final ? <th className="is-num">TDs</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const t = r.td;
          const grade = t.actual == null ? '' : t.actual > 0 ? ' is-hit' : ' is-miss';
          return (
            <tr key={r.id} className={grade}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} /></td>
              <td className="is-num is-lead" title={`${num(t.lambda, 2)} touchdowns expected: his ${num(t.own, 2)} a game (his rate pulled toward ${num(t.touches, 1)} touches tonight) × ${t.teamFactor} his team's touchdowns tonight × ${t.posShift} where the defense gives them up`}><b>{pct(t.p)}</b>{r.pos === 'QB' ? <small>rushing</small> : null}</td>
              <td><span className={`ir-ml-tier is-${t.tier}`}>{t.tier}</span></td>
              <td className="is-num">{pct(t.p1h)}</td>
              {final ? <td className="is-num nhlx-pk-got"><Got v={t.actual} /></td> : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const pctile = 80;   // the ceiling's percentile (lib/nfl/projections.js RANGE_Z), the floor's 20th
/** How tonight's figure is built, for the hover. */
function why(y, unit) {
  const parts = [`${num(y.rate, 1)} ${unit} his rate`, `× ${y.matchup ?? 1} the matchup${y.matchupFrom ? ` (${y.matchupFrom === 'blend' ? 'PropFinder and the cheat sheet' : y.matchupFrom === 'sheet' ? 'the cheat sheet' : 'PropFinder'})` : ''}`, `× ${y.script} the game script`];
  return `${parts.join(' ')} = ${num(y.proj, 1)} tonight · floor ${y.floor} and ceiling ${y.ceiling}: a bad day and a good day (his ${100 - pctile}th and ${pctile}th percentile)${y.line != null ? ` · the book's line ${y.line}` : ''}${y.sheetLine != null ? ` · the cheat sheet's ${y.sheetLine}` : ''}`;
}
const gradeOf = (y) => (y?.grade === 'over' ? ' is-hit' : y?.grade === 'under' ? ' is-miss' : '');

function YardsTable({ rows, kind, game }) {
  const market = MARKET[kind];
  const final = rows.some((r) => r.final);
  const rec = kind === 'receiving';
  const cols = [['floor', 'Floor', 'A bad day tonight'], ['proj', 'Projected', 'His skill × tonight’s matchup × tonight’s game script'], ['ceiling', 'Ceiling', 'A good day tonight']];
  return (
    <table className="nhlx-db-table nhlx-pk-table ir-ml-table">
      <thead><tr>
        <th className="ir-slate-rank">#</th><th>Player</th>
        {cols.map(([k, l, t]) => <th key={k} className={`is-num ir-ml-th is-${k}`} title={`${t}${rec ? '; his receptions under it' : ''}`}>{l}</th>)}
        {final ? <th className="is-num">Got</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const y = r.yards[market];
          const c = rec ? r.yards.receptions : null;
          return (
            <tr key={r.id}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} /></td>
              {cols.map(([k]) => (
                <td key={k} className={`is-num ir-ml-cell is-${k}`} title={why(y, 'yds')}>
                  <b>{y[k] == null ? '—' : num(y[k])}</b>
                  {c ? <small>{c[k] == null ? '—' : num(c[k], k === 'proj' ? 1 : 0)} rec</small> : null}
                </td>
              ))}
              {final ? <td className={`is-num nhlx-pk-got${gradeOf(y)}`} title={y.grade ? `${y.grade === 'over' ? 'Over his ceiling' : y.grade === 'under' ? 'Under his floor' : 'Between his floor and ceiling'}` : undefined}><Got v={y.actual} />{rec && c?.actual != null ? <small>{c.actual} rec</small> : null}</td> : null}
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

/** One game: its head, the defenses' weak spots off the cheat sheet, and its three lists behind tabs. */
function GameCard({ g, pj }) {
  const [kind, setKind] = useState('td');
  const status = g.final ? `final ${g.awayScore}–${g.homeScore}` : `${fmtDay(g.date)} ${fmtTip(g.date)}`;
  const weak = [g.away, g.home].map((team) => ({ team, d: g.teams?.[team]?.defense })).filter((x) => x.d?.weak?.length);
  const tds = [g.away, g.home].map((team) => ({ team, tt: g.teams?.[team]?.teamTd })).filter((x) => x.tt?.tonight != null);
  return (
    <section className="ir-ml-game" aria-label={`${g.away} at ${g.home}`}>
      <div className="ir-ml-head">
        <span className="ir-ml-teams"><img src={teamLogo(g.away)} alt="" width="22" height="22" className="ir-nfl-logo" />{g.away}<i>@</i><img src={teamLogo(g.home)} alt="" width="22" height="22" className="ir-nfl-logo" />{g.home}</span>
        <small className="nhlx-auto-meta">{[status, g.odds?.total != null ? `total ${g.odds.total}` : null, g.odds?.spread || null, tds.length ? tds.map((x) => `${x.team} ${num(x.tt.tonight, 1)} TDs expected`).join(' · ') : null].filter(Boolean).join(' · ')}</small>
      </div>
      {[g.away, g.home].some((t) => g.teams?.[t]?.script?.words?.length) ? <p className="ir-ml-def">{[g.away, g.home].filter((t) => g.teams?.[t]?.script?.words?.length).map((t) => <span key={t} title={`On ${t}'s yards: volume × ${g.teams[t].script.volume}, the run × ${g.teams[t].script.rush}, the pass × ${g.teams[t].script.pass}`}><b>{t} script</b> {g.teams[t].script.words.join(' · ')}</span>)}</p> : null}
      {weak.length ? <p className="ir-ml-def">{weak.map(({ team, d }) => <span key={team}><b>{d.of} defense</b> gives up the most to {d.weak.slice(0, 3).map((w) => `${w.word} (#${w.rank})`).join(', ')}</span>)}</p> : null}
      <div className="nhlx-tabs nhlx-rk-tabs ir-ml-tabs" role="tablist" aria-label="List">
        {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={`nhlx-tab${kind === k ? ' is-active' : ''}`} onClick={() => setKind(k)}>{l}<i>{g.lists?.[k]?.length || 0}</i></button>)}
      </div>
      <ListOf pj={pj} ids={g.lists?.[kind] || []} kind={kind} empty={NO_DATA} />
    </section>
  );
}

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    Yards: tonight’s <b>projection</b> = his skill × tonight’s matchup (PropFinder and the cheat sheet’s defense snapshot) × tonight’s game script (the book’s total and spread), with his <b>floor</b> (a bad day) and <b>ceiling</b> (a good day) around it; hover a figure for its parts. Touchdowns: <span className="ir-ml-tier is-strong">strong</span> from 45% · <span className="ir-ml-tier is-lean">lean</span> from 30% · <span className="ir-ml-tier is-thin">thin</span> under. ✓ = on the cheat sheet; no price. <span className="ir-bd-role is-active">if active</span> a game-time decision · <span className="ir-bd-role is-role">if role confirmed</span> his read leans on a teammate out.
  </p>
);

/** The Matchups tab: every game with its TDs, Receiving and Rushing lists. */
export function NflMatchups({ board }) {
  const pj = board?.projections;
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  if (!pj) return <div className="nhlx-empty">{NO_DATA}</div>;
  return (
    <div className="ir-overview">
      {LEGEND}
      <div className="ir-ml-grid">{pj.games.map((g) => <GameCard key={g.id} g={g} pj={pj} />)}</div>
    </div>
  );
}

/** One list across every game of the week: 'td' | 'receiving' | 'rushing'. */
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
