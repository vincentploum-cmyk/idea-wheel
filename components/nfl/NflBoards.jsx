'use client';

import { useState } from 'react';
import { teamLogo } from '@/lib/nfl/teams';
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

const hitOf = (v) => (v === undefined || v === null ? '' : v ? ' is-hit' : ' is-miss');

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
        <th className="ir-slate-rank">#</th><th>Player</th>
        {cols.map(([k, l, t]) => <th key={k} className={`is-num${k === 'p' ? ' is-lead' : ''}`} title={t}>{l}</th>)}
        {final ? <th className="is-num">TDs</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const t = r.td;
          return (
            <tr key={r.id}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} /></td>
              {cols.map(([k, , , hit]) => (
                <td key={k} className={`is-num${k === 'p' ? ' is-lead' : ''}${final ? hitOf(hit(t)) : ''}`}>
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
        <th className="ir-slate-rank">#</th><th>Player</th>
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
              <td><Who r={r} game={game} /></td>
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

/** One game: its head, the defenses' weak spots off the cheat sheet, and its three lists behind tabs. */
function GameCard({ g, pj }) {
  const [kind, setKind] = useState('td');
  const status = g.final ? `final ${g.awayScore}–${g.homeScore}` : `${fmtDay(g.date)} ${fmtTip(g.date)}`;
  const weak = [g.away, g.home].map((team) => ({ team, d: g.teams?.[team]?.defense })).filter((x) => x.d?.weak?.length);
  return (
    <section className="ir-ml-game" aria-label={`${g.away} at ${g.home}`}>
      <div className="ir-ml-head">
        <span className="ir-ml-teams"><img src={teamLogo(g.away)} alt="" width="22" height="22" className="ir-nfl-logo" />{g.away}<i>@</i><img src={teamLogo(g.home)} alt="" width="22" height="22" className="ir-nfl-logo" />{g.home}</span>
        <small className="nhlx-auto-meta">{status}</small>
      </div>
      {weak.length ? <p className="ir-ml-def">{weak.map(({ team, d }) => <span key={team} title="From the cheat sheet’s defense snapshot"><b>{d.of} defense</b> gives up the most to {d.weak.slice(0, 3).map((w) => `${w.word} (#${w.rank})`).join(', ')}</span>)}</p> : null}
      <div className="nhlx-tabs nhlx-rk-tabs ir-ml-tabs" role="tablist" aria-label="List">
        {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={`nhlx-tab${kind === k ? ' is-active' : ''}`} onClick={() => setKind(k)}>{l}<i>{g.lists?.[k]?.length || 0}</i></button>)}
      </div>
      <ListOf pj={pj} ids={g.lists?.[kind] || []} kind={kind} empty={NO_DATA} />
    </section>
  );
}

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    Each mark is the highest he reaches tonight at that chance: <b>strong</b> 60%+ · <b>lean</b> 45%+ · <b>thin</b> 30%+ — his skill × tonight’s matchup (PropFinder and the cheat sheet). ✓ = on the cheat sheet. <span className="ir-bd-role is-active">if active</span> a game-time decision · <span className="ir-bd-role is-role">if role confirmed</span> a teammate is out.
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
