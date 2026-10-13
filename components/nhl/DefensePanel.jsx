'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamLogo } from './media';
import { PfTable, SortTh, Sel, UnderlineTabs, rankTone } from './pf-ui';
import { TeamLink } from './links';
import { todayET } from '@/lib/nhl-data/util';
import { GROUPS, OVERVIEW_COLS, boardTables, overviewRows, matchupReads } from '@/lib/nhl-data/defense-board';

// The Defense tab: ShotPropz-style cheat sheets from the stored box scores. What every
// team gives up to each position group, ranked softest first (1 = the most allowed),
// tonight's matchups read off the same tables, and a team overview with MoneyPuck's rates.

const METRICS = [['sog', 'Shots'], ['g', 'Goals']];
const SPANS = [['season', 'Season'], ['l10', 'Last 10'], ['l5', 'Last 5']];
const VENUES = [['ALL', 'All'], ['H', 'Home'], ['A', 'Away']];
const VIEWS = [['all', 'All teams'], ['tonight', 'Playing tonight']];
const GROUP_OPTS = Object.entries(GROUPS).map(([k, g]) => [k, g.label]);
const fmt = (v, d) => (v == null ? '—' : Number(v).toFixed(d));

function RankChip({ rank, n }) {
  return rank ? <span className="nhlx-rank" title={`Rank ${rank} of ${n}: 1 allows the most`}>#{rank}</span> : null;
}

/** One cheat-sheet table: Rk · Team · GP · value, tinted by rank thirds, the league mean at the foot. */
function RankTable({ title, table, digits, playing, view, active, onPick }) {
  const rows = table?.rows || [];
  return (
    <div className="nhlx-df-table">
      <h4>{title}</h4>
      <PfTable className="nhlx-da-table">
        <thead><tr><th>Rk</th><th className="is-left">Team</th><th>GP</th><th>{digits === 1 ? 'SA / GP' : 'GA / GP'}</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const dim = view === 'tonight' && playing.size && !playing.has(r.abbr);
            if (dim) return null;
            return (
              <tr key={r.abbr} className={active === r.abbr ? 'is-active' : ''}>
                <td className="is-rk">{r.rank}</td>
                <td className="is-left"><button type="button" className="nhlx-df-team" onClick={() => onPick(r.abbr)} title={`Highlight ${r.abbr} in every table`}><TeamLogo abbr={r.abbr} size={20} />{r.abbr}</button></td>
                <td>{r.gp}</td>
                <td className={`is-val ${rankTone(r.rank, table.n)}`}><b>{fmt(r.value, digits)}</b></td>
              </tr>
            );
          })}
          {table?.league != null && <tr className="is-league"><td /><td className="is-left">League</td><td /><td>{fmt(table.league, digits)}</td></tr>}
        </tbody>
      </PfTable>
    </div>
  );
}

/** Tonight's shooting sides, softest spot first: the defender's figure and rank per group. */
function Reads({ reads, keys, digits, metric, active, onPick }) {
  if (!reads.length) return <p className="nhlx-auto-meta">No games on this date.</p>;
  return (
    <div className="nhlx-df-table nhlx-df-reads">
      <PfTable className="nhlx-da-table">
        <thead>
          <tr>
            <th className="is-left">Shooters</th>
            <th className="is-left">Against</th>
            {keys.map((k) => <th key={k}>{k}</th>)}
            <th className="is-left">Softest spot</th>
          </tr>
        </thead>
        <tbody>
          {reads.map((m) => (
            <tr key={`${m.gameId}-${m.team}`} className={active === m.team || active === m.opp ? 'is-active' : ''}>
              <td className="is-left"><TeamLink abbr={m.team} logo={22}><b>{m.team}</b></TeamLink> <small>{m.venue === 'H' ? 'home' : 'away'}</small></td>
              <td className="is-left"><button type="button" className="nhlx-df-team" onClick={() => onPick(m.opp)}><TeamLogo abbr={m.opp} size={20} />{m.opp}</button></td>
              {keys.map((k) => {
                const c = m.cells[k];
                return (
                  <td key={k} className={`${c ? rankTone(c.rank, c.n) : ''}${m.best?.key === k ? ' is-best' : ''}`}>
                    {c ? <span className="nhlx-df-cell"><b>{fmt(c.value, digits)}</b><RankChip rank={c.rank} n={c.n} /></span> : <small>—</small>}
                  </td>
                );
              })}
              <td className="is-left">{m.best ? <><b>{m.best.key}</b> <small>#{m.best.rank} for {metric === 'g' ? 'goals' : 'shots'}{m.cells[m.best.key]?.gp != null ? ` · ${m.cells[m.best.key].gp} gp` : ''}</small></> : <small>no games stored</small>}</td>
            </tr>
          ))}
        </tbody>
      </PfTable>
    </div>
  );
}

/** Every team's defensive figures with a rank per column; sortable. */
function Overview({ rows, playing, view, active, onPick }) {
  const [sort, setSort] = useState('sog');
  const list = useMemo(() => {
    const l = view === 'tonight' && playing.size ? rows.filter((r) => playing.has(r.abbr)) : rows;
    return [...l].sort((a, b) => (a.rank[sort] ?? 99) - (b.rank[sort] ?? 99) || a.abbr.localeCompare(b.abbr));
  }, [rows, sort, view, playing]);
  const n = Object.fromEntries(OVERVIEW_COLS.map((c) => [c.key, rows.filter((r) => r.rank[c.key]).length]));
  return (
    <div className="nhlx-df-table">
      <PfTable className="nhlx-da-table">
        <thead>
          <tr>
            <th className="is-left">Team</th>
            <th>GP</th>
            {OVERVIEW_COLS.map((c) => <SortTh key={c.key} k={c.key} label={c.label} sort={sort} onSort={setSort} title={c.title} />)}
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.abbr} className={active === r.abbr ? 'is-active' : ''}>
              <td className="is-left"><button type="button" className="nhlx-df-team" onClick={() => onPick(r.abbr)}><TeamLogo abbr={r.abbr} size={20} />{r.abbr}</button></td>
              <td>{r.gp}</td>
              {OVERVIEW_COLS.map((c) => (
                <td key={c.key} className={`${rankTone(r.rank[c.key], n[c.key])}${sort === c.key ? ' is-sorted' : ''}`}>
                  {r[c.key] == null ? <small>—</small> : <span className="nhlx-df-cell"><b>{fmt(r[c.key], c.digits)}</b><RankChip rank={r.rank[c.key]} n={n[c.key]} /></span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </PfTable>
    </div>
  );
}

export default function DefensePanel() {
  const [date, setDate] = useState(() => todayET());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [metric, setMetric] = useState('sog');
  const [span, setSpan] = useState('season');
  const [venue, setVenue] = useState('ALL');
  const [group, setGroup] = useState('pos');
  const [view, setView] = useState('tonight');
  const [active, setActive] = useState('');
  const pick = useCallback((abbr) => setActive((cur) => (cur === abbr ? '' : abbr)), []);

  useEffect(() => {
    let live = true;
    fetch(`/api/nhl/data/defense?date=${date}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; })
      .then((j) => { if (live) { setData(j); setErr(''); } })
      .catch((e) => { if (live) setErr(`Couldn’t load the defense tables: ${e.message}`); });
    return () => { live = false; };
  }, [date]);

  const digits = metric === 'g' ? 2 : 1;
  const keys = GROUPS[group].keys;
  const defense = data?.[span];
  const tables = useMemo(() => (defense ? boardTables(defense, { metric, venue, group }) : null), [defense, metric, venue, group]);
  const byVenue = useMemo(() => (defense ? { ALL: boardTables(defense, { metric, venue: 'ALL', group }), H: boardTables(defense, { metric, venue: 'H', group }), A: boardTables(defense, { metric, venue: 'A', group }) } : null), [defense, metric, group]);
  const reads = useMemo(() => (byVenue ? matchupReads(data?.tonight || [], byVenue) : []), [byVenue, data]);
  const playing = useMemo(() => new Set((data?.tonight || []).flatMap((g) => [g.away, g.home])), [data]);
  const overview = useMemo(() => (defense ? overviewRows(defense, data?.moneypuck?.teams, { venue }) : []), [defense, data, venue]);
  const thin = defense ? Object.values(defense.teams || {}).filter((t) => (t[venue]?.All?.gp || 0) < 10).length : 0;

  if (err) return <div className="nhlx-empty">{err}</div>;
  if (!data) return <div className="nhlx-empty">Loading the defense tables…</div>;

  return (
    <div>
      <div className="nhlx-df-controls">
        <UnderlineTabs items={METRICS} value={metric} onChange={setMetric} label="Shots or goals" />
        <Sel label="Span" value={span} onChange={setSpan} options={SPANS} />
        <Sel label="Defender at" value={venue} onChange={setVenue} options={VENUES} />
        <Sel label="Group" value={group} onChange={setGroup} options={GROUP_OPTS} />
        <Sel label="View" value={view} onChange={setView} options={VIEWS} />
        <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
      </div>

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>Tonight’s matchups</h3><small>{data.tonight?.length || 0} games on {date} · each shooting side against what its opponent gives up {venue === 'ALL' ? 'at the venue it plays tonight' : VENUES.find(([v]) => v === venue)[1].toLowerCase()} · softest spot first</small></div>
      <Reads reads={reads} keys={keys} digits={digits} metric={metric} active={active} onPick={pick} />

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>{metric === 'g' ? 'Goals' : 'Shots'} against by position</h3><small>{SPANS.find(([k]) => k === span)[1]} · defender {venue === 'ALL' ? 'anywhere' : venue === 'H' ? 'at home' : 'away'} · per game · rank 1 allows the most, ties share a rank</small></div>
      <div className="nhlx-df-grid">
        {keys.map((k) => <RankTable key={k} title={`${metric === 'g' ? 'Goals' : 'Shots'} against ${k}`} table={tables?.[k]} digits={digits} playing={playing} view={view} active={active} onPick={pick} />)}
      </div>

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>Team overview</h3><small>Stored box scores for the span above · MoneyPuck season rates, all situations{data.moneypuck?.updatedAt ? ` (updated ${new Date(data.moneypuck.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})` : ''}</small></div>
      <Overview rows={overview} playing={playing} view={view} active={active} onPick={pick} />

      <div className="nhlx-da-legend"><span><i className="is-soft" />Softest third</span><span><i className="is-mid" />Middle</span><span><i className="is-tough" />Stingiest third</span></div>
      <p className="nhlx-df-note">
        {data.games} games stored. {thin ? `${thin} teams have fewer than 10 games ${venue === 'ALL' ? 'stored' : venue === 'H' ? 'at home' : 'away'}; their ranks can swing on one night.` : ''} Positions are the lineup slots the box scores were logged under (LW / C / RW by line, D by pair); a group’s figure is the sum of its positions per game. Click a team to follow it through every table. MoneyPuck rates credit MoneyPuck.com.
      </p>
    </div>
  );
}
