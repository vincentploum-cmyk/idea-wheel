'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamLogo, Headshot } from './media';
import { usePlayerCard } from './PlayerCard';
import { PfTable, SortTh, Sel, UnderlineTabs, rankTone } from './pf-ui';
import { TeamLink } from './links';
import { GROUPS, OVERVIEW_COLS, boardTables, overviewRows, matchupReads, groupKeyFor, shootersAt, figureFor, resultsAt } from '@/lib/nhl-data/defense-board';

// The Defense tab: ShotPropz-style cheat sheets from the stored box scores. What every
// team gives up to each position group, ranked softest first (1 = the most allowed),
// tonight's matchups read off the same tables, and a team overview with MoneyPuck's rates.

const METRICS = [['sog', 'Shots'], ['g', 'Goals']];
const SPANS = [['season', 'Season (blended)'], ['l10', 'Last 10'], ['l5', 'Last 5']];
const VENUES = [['ALL', 'All'], ['H', 'Home'], ['A', 'Away']];
const VIEWS = [['all', 'All teams'], ['tonight', 'Playing tonight']];
const GROUP_OPTS = Object.entries(GROUPS).map(([k, g]) => [k, g.label]);
const fmt = (v, d) => (v == null ? '—' : Number(v).toFixed(d));
// Today's date in Eastern time (the slate's day), as YYYY-MM-DD; the server helper lives in a server-only module.
const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function RankChip({ rank, n }) {
  return rank ? <span className="nhlx-rank" title={`Rank ${rank} of ${n}: 1 allows the most`}>#{rank}</span> : null;
}

/** "7 + 82" for a blended season row (this season's games, last season's in the blend), else the games. */
const gpText = (r) => (r?.base ? `${r.gp} + ${r.base}` : r?.gp ?? '—');

/** One cheat-sheet table: Rk · Team · GP · value, tinted by rank thirds, the league mean at the foot. */
function RankTable({ title, table, digits, playing, view, active, onPick }) {
  const rows = table?.rows || [];
  return (
    <div className="nhlx-df-table">
      <h4>{title}</h4>
      <PfTable className="nhlx-da-table">
        <thead><tr><th>Rk</th><th className="is-left">Team</th><th title="Games this season, + last season's in the blend">GP</th><th title={`${digits === 1 ? 'Shots' : 'Goals'} allowed per skater at the position, a game`}>{digits === 1 ? 'SA / skater' : 'GA / skater'}</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const dim = view === 'tonight' && playing.size && !playing.has(r.abbr);
            if (dim) return null;
            return (
              <tr key={r.abbr} className={active === r.abbr ? 'is-active' : ''}>
                <td className="is-rk">{r.rank}</td>
                <td className="is-left"><button type="button" className="nhlx-df-team" onClick={() => onPick(r.abbr)} title={`Highlight ${r.abbr} in every table`}><TeamLogo abbr={r.abbr} size={20} />{r.abbr}</button></td>
                <td>{gpText(r)}</td>
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

/** The shooting side's skaters at a group key tonight, best for the metric first, clickable to the card: "Thompson C1 3.9 · Cozens C2 2.4 · …". */
function Shooters({ side, keyName, group, opp, venue, metric }) {
  const open = usePlayerCard();
  const list = shootersAt(side, keyName, group, metric);
  const lam = (p) => {
    const f = figureFor(p, metric);
    if (!f) return '';
    const unit = metric === 'g' ? 'goals' : 'shots';
    return f.source === 'run' ? ` · the run's λ ${f.value.toFixed(2)} ${unit}` : ` · ${f.value.toFixed(2)} ${unit} a game over his last ${p.gp} stored games (no run yet)`;
  };
  if (!side) return <small className="nhlx-auto-meta">no lineup yet</small>;
  if (!list.length) return <small className="nhlx-auto-meta">nobody listed at {keyName}</small>;
  return (
    <span className="nhlx-df-shooters">
      {list.map((p, i) => (
        <span key={p.id}>
          {i ? ' · ' : ''}
          <button type="button" className="nhlx-df-shooter" onClick={() => open({ id: p.id, opp, venue, pos: p.pos, line: p.line })} title={`${p.name}${p.carried ? ' (carried from an earlier lineup)' : ''}${lam(p)}`}>
            {String(p.name).split(' ').slice(-1)[0]}<small>{p.pos === 'D' ? 'D' : p.pos}{p.line || ''}{p.carried ? '*' : ''}{(() => { const f = figureFor(p, metric); return f ? ` ${f.value.toFixed(metric === 'g' ? 2 : 1)}` : ''; })()}</small>
          </button>
        </span>
      ))}
    </span>
  );
}

/**
 * What the listed shooters did, once the game is stored: the tally over the floor (3+ SOG, or 1+ goal under
 * Goals) with the score, then each shooter's figure, green at the floor, red under it, DNP without a row.
 * Before the game, or while the box score is not stored yet, a note says so.
 */
function Results({ side, keyName, group, metric, game }) {
  const result = game?.result || null;
  const [now] = useState(() => Date.now()); // read once: the note only says whether puck drop has passed
  if (!result) {
    const start = Date.parse(game?.startTimeUTC || '');
    return <small className="nhlx-auto-meta">{Number.isFinite(start) && start < now ? 'no box score yet' : 'not played yet'}</small>;
  }
  const list = side && keyName ? shootersAt(side, keyName, group, metric) : [];
  const r = resultsAt(list, result, metric);
  const unit = metric === 'g' ? 'goal' : 'SOG';
  const score = result.score && game ? `${game.away} ${result.score.away}–${result.score.home} ${game.home}` : '';
  return (
    <>
      <b>{r.graded ? `${r.hits} of ${r.graded}` : '—'}</b> <small>{metric === 'g' ? '1+ goal' : '3+ SOG'}{score ? ` · ${score}` : ''}</small>
      <br />
      <span className="nhlx-df-got">
        {r.rows.map((p, i) => (
          <span key={p.id}>
            {i ? ' · ' : ''}
            <span className={p.hit == null ? 'is-dnp' : p.hit ? 'is-hit' : 'is-miss'} title={p.hit == null ? `${p.name}: no box-score row (did not play)` : `${p.name}: ${p.got} ${unit}${p.got === 1 || unit === 'SOG' ? '' : 's'} · ${p.hit ? 'at' : 'under'} the floor of ${r.floor}`}>
              {String(p.name).split(' ').slice(-1)[0]} <b>{p.hit == null ? 'DNP' : p.got}</b>
            </span>
          </span>
        ))}
        {!r.rows.length && <small className="nhlx-auto-meta">nobody listed</small>}
      </span>
    </>
  );
}

/**
 * Tonight's shooting sides, softest spot first: the defender's figure and rank per group, and the shooters
 * the side has at one position: the softest spot by default, or the cell last clicked on that row.
 */
function Reads({ reads, keys, digits, metric, active, onPick, games, group }) {
  const [picked, setPicked] = useState({});
  if (!reads.length) return <p className="nhlx-auto-meta">No games on this date.</p>;
  const gameOf = (m) => (games || []).find((g) => g.id === m.gameId) || null;
  const sideOf = (m) => gameOf(m)?.sides?.find((s) => s.team === m.team) || null;
  const namesAt = (side, k) => shootersAt(side, k, group, metric).map((p) => `${String(p.name).split(' ').slice(-1)[0]} ${p.pos}${p.line || ''}`).join(', ');
  const rowKey = (m) => `${m.gameId}-${m.team}`;
  const shownKey = (m) => (picked[rowKey(m)] && keys.includes(picked[rowKey(m)]) ? picked[rowKey(m)] : m.best?.key || null);
  return (
    <div className="nhlx-df-table nhlx-df-reads">
      <PfTable className="nhlx-da-table">
        <thead>
          <tr>
            <th className="is-left">Shooters</th>
            <th className="is-left">Against</th>
            {keys.map((k) => <th key={k}>{k}</th>)}
            <th className="is-left" title="The softest spot by default; click a position's value to list the shooters there instead">Softest spot · shooters</th>
            <th className="is-left" title="Once the game is stored: the listed shooters' shots (goals under Goals), the tally at 3+ SOG / 1+ goal, and the score">Result</th>
          </tr>
        </thead>
        <tbody>
          {reads.map((m) => {
            const side = sideOf(m);
            const shown = shownKey(m);
            return (
              <tr key={rowKey(m)} className={active === m.team || active === m.opp ? 'is-active' : ''}>
                <td className="is-left"><TeamLink abbr={m.team} logo={22}><b>{m.team}</b></TeamLink> <small>{m.venue === 'H' ? 'home' : 'away'}</small></td>
                <td className="is-left"><button type="button" className="nhlx-df-team" onClick={() => onPick(m.opp)}><TeamLogo abbr={m.opp} size={20} />{m.opp}</button></td>
                {keys.map((k) => {
                  const c = m.cells[k];
                  const who = side ? namesAt(side, k) : '';
                  return (
                    <td key={k} className={`${c ? rankTone(c.rank, c.n) : ''}${m.best?.key === k ? ' is-best' : ''}${shown === k ? ' is-shown' : ''}`} title={`${who ? `${m.team} ${k} tonight: ${who}. ` : ''}Click to list the ${k} shooters`}>
                      <button type="button" className="nhlx-df-cellbtn" onClick={() => setPicked((cur) => ({ ...cur, [rowKey(m)]: k }))} aria-pressed={shown === k}>
                        {c ? <span className="nhlx-df-cell"><b>{fmt(c.value, digits)}</b><RankChip rank={c.rank} n={c.n} /></span> : <small>—</small>}
                      </button>
                    </td>
                  );
                })}
                <td className="is-left">
                  {m.best ? <>
                    <b>{m.best.key}</b> <small>#{m.best.rank} for {metric === 'g' ? 'goals' : 'shots'}{m.cells[m.best.key]?.gp != null ? ` · ${gpText(m.cells[m.best.key])} gp` : ''}</small>
                    <br />
                    {shown && shown !== m.best.key ? <small className="nhlx-auto-meta">{shown} shooters (#{m.cells[shown]?.rank ?? '—'}): </small> : null}
                    <Shooters side={side} keyName={shown || m.best.key} group={group} opp={m.opp} venue={m.venue} metric={metric} />
                  </> : <small>no games stored</small>}
                </td>
                <td className="is-left nhlx-df-result">
                  <Results side={side} keyName={shown || m.best?.key || null} group={group} metric={metric} game={gameOf(m)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </PfTable>
    </div>
  );
}

const STREAK_TABS = [['goals', 'Goal streaks'], ['points', 'Point streaks'], ['sog3', '3+ shot streaks']];

/** Who is running hot, with tonight's opponent read off the same tables at his position. */
function Streaks({ list, tab, onTab, playing, view, byVenue, venue, group, digits, metric }) {
  const open = usePlayerCard();
  const rows = useMemo(() => {
    const l = view === 'tonight' ? list.filter((p) => p.tonight) : list;
    const key = tab === 'goals' ? (p) => p.goals.streak * 100 + p.goals.l5 : tab === 'points' ? (p) => p.points.streak * 100 + p.points.l5 : (p) => p.sog3.streak * 100 + p.sog3.l5;
    return [...l].filter((p) => (tab === 'goals' ? p.goals.streak >= 2 : tab === 'points' ? p.points.streak >= 3 : p.sog3.streak >= 3)).sort((a, b) => key(b) - key(a) || a.name.localeCompare(b.name)).slice(0, 40);
  }, [list, tab, view]);
  const cellFor = (p) => {
    if (!p.tonight || !byVenue) return null;
    const tables = venue === 'ALL' ? byVenue.ALL : byVenue[p.tonight.venue === 'H' ? 'A' : 'H'];
    const t = tables?.[groupKeyFor(p.pos, group)];
    const row = t?.rows.find((r) => r.abbr === p.tonight.opp);
    return row ? { ...row, n: t.n } : null;
  };
  return (
    <div className="nhlx-df-table nhlx-df-streaks">
      <UnderlineTabs items={STREAK_TABS} value={tab} onChange={onTab} label="Streak" />
      {!rows.length ? <p className="nhlx-auto-meta">Nobody {view === 'tonight' ? 'playing on this date ' : ''}is on one right now.</p> : (
        <PfTable className="nhlx-da-table">
          <thead>
            <tr>
              <th className="is-left">Skater</th><th>Slot</th>
              <th title="Consecutive games with a goal">G streak</th><th title="Consecutive games with a point">Pts streak</th><th title="Consecutive games with 3+ shots on goal">3+ SOG streak</th>
              <th title="Goals over his last five games">G L5</th><th title="Shots on goal over his last five games">SOG L5</th>
              <th className="is-left">Last game</th>
              <th className="is-left" title={`What tonight's opponent gives up per skater at his position a game (${metric === 'g' ? 'goals' : 'shots'}), with its rank`}>Tonight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const c = cellFor(p);
              return (
                <tr key={p.id}>
                  <td className="is-left"><div className="nhlx-db-player is-click" onClick={() => open({ id: p.id })}><Headshot id={p.id} size={30} /><span><b>{p.name}</b><small>{p.team}</small></span></div></td>
                  <td>{p.pos}{p.line || ''}</td>
                  <td className={tab === 'goals' ? 'is-sorted' : ''}>{p.goals.streak || '—'}</td>
                  <td className={tab === 'points' ? 'is-sorted' : ''}>{p.points.streak || '—'}</td>
                  <td className={tab === 'sog3' ? 'is-sorted' : ''}>{p.sog3.streak || '—'}</td>
                  <td>{p.goals.l5}</td><td>{p.sog3.l5}</td>
                  <td className="is-left"><small>{p.last.date.slice(5)} {p.last.venue === 'H' ? 'vs' : '@'} {p.last.opp} · {p.last.g} G {p.last.a} A {p.last.sog} SOG</small></td>
                  <td className={`is-left ${c ? rankTone(c.rank, c.n) : ''}`}>
                    {p.tonight ? <span className="nhlx-df-cell">{p.tonight.venue === 'H' ? 'vs' : '@'} <b>{p.tonight.opp}</b>{c ? <><b>{fmt(c.value, digits)}</b><RankChip rank={c.rank} n={c.n} /></> : <small>no games stored</small>}</span> : <small>—</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </PfTable>
      )}
    </div>
  );
}

const SPAN_LABEL = { season: 'Season (blended)', l10: 'Last 10', l5: 'Last 5' };
const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

const signed0 = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
const liftTone = (v) => (v == null ? '' : v >= 0.03 ? 'is-soft' : v <= -0.03 ? 'is-tough' : '');

/**
 * The track record by the opponent's rank at the skater's position: one column per rank, per span a
 * row; the bold figure is ranks 1 through that one together (how far down the table the soft read
 * holds: it stays green as long as adding the next rank keeps the pooled lift up), the small one the
 * rank alone (about 200 skater-games a rank, so noisy on its own). The hover carries both with the
 * counts and the floor rates.
 */
function ByRank({ grade, metric, floor, unit }) {
  const spans = ['season', 'l10', 'l5'];
  const n = Math.max(0, ...spans.flatMap((s) => (grade.spans[s][metric].ranks || []).map((r) => r.rank)));
  if (!n) return null;
  const ranks = Array.from({ length: n }, (_, i) => i + 1);
  return (
    <div className="nhlx-df-ranks">
      <table>
        <thead>
          <tr><th className="is-left">By rank</th>{ranks.map((k) => <th key={k}>#{k}</th>)}</tr>
        </thead>
        <tbody>
          {spans.map((s) => {
            const by = Object.fromEntries((grade.spans[s][metric].ranks || []).map((r) => [r.rank, r]));
            return (
              <tr key={s}>
                <td className="is-left"><b>{SPAN_LABEL[s]}</b></td>
                {ranks.map((k) => {
                  const r = by[k];
                  if (!r) return <td key={k}><small>—</small></td>;
                  const t = r.top;
                  return (
                    <td key={k} className={liftTone(t.lift)} title={`Ranks 1 to ${k} together: ${t.n} skater-games, ${t.actual.toFixed(2)} ${unit} a game against ${t.expected.toFixed(2)} from their own rates (${signed(t.lift)}); ${floor} ${pct(t.hit)} against ${pct(t.hitExpected)} expected · rank ${k} alone: ${r.n} skater-games, ${signed(r.lift)}; ${floor} ${pct(r.hit)} against ${pct(r.hitExpected)}`}>
                      <b>{signed0(t.lift)}</b><small>{signed0(r.lift)}</small>
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

/**
 * The tab's track record: every stored skater-game this season graded against the tables as they
 * stood that morning. For each span, the soft / mid / tough third of the opponent's table at the
 * skater's position: what he did against his own rate going in; the softest-spot shooters the same;
 * and under it the strip by rank (`ByRank`).
 */
function TrackRecord({ grade, metric, loading }) {
  if (loading) return <p className="nhlx-auto-meta">Grading the season’s games against the tables as they stood each morning…</p>;
  if (!grade?.skaterGames) return <p className="nhlx-auto-meta">Nothing to grade yet: the first stored game of the season grades the next morning.</p>;
  const floor = metric === 'g' ? '1+ goal' : '3+ SOG';
  const unit = metric === 'g' ? 'goals' : 'SOG';
  const all = grade.spans.season[metric].all;
  const Cell = ({ c, tone }) => (c?.n ? (
    <td className={tone || ''} title={`${c.n} skater-games: ${c.actual.toFixed(2)} ${unit} a game against ${c.expected.toFixed(2)} from their own rates (${signed(c.lift)}); ${floor} ${pct(c.hit)} against ${pct(c.hitExpected)} expected`}>
      <span className="nhlx-df-cell"><b>{signed(c.lift)}</b><small>{pct(c.hit, 0)} · {c.n}</small></span>
    </td>
  ) : <td><small>—</small></td>);
  return (
    <div className="nhlx-df-table nhlx-df-grade">
      <PfTable className="nhlx-da-table">
        <thead>
          <tr>
            <th className="is-left">Table</th>
            <th className="is-soft" title="Skaters whose opponent sat in the soft third (rank 1 to 11) at their position that morning">Soft third</th>
            <th title="The middle third">Mid</th>
            <th className="is-tough" title="The stingiest third">Tough third</th>
            <th title="Soft minus tough: how far apart the table pulls the two ends">Spread</th>
            <th title="The skaters lined up at a shooting side's softest spot, whatever its rank">Softest spot</th>
          </tr>
        </thead>
        <tbody>
          {['season', 'l10', 'l5'].map((s) => {
            const g = grade.spans[s][metric]; const t = g.thirds;
            const spread = t.soft.lift != null && t.tough.lift != null ? t.soft.lift - t.tough.lift : null;
            return (
              <tr key={s}>
                <td className="is-left"><b>{SPAN_LABEL[s]}</b></td>
                <Cell c={t.soft} tone="is-soft" /><Cell c={t.mid} /><Cell c={t.tough} tone="is-tough" />
                <td className={spread == null ? '' : spread >= 0.05 ? 'is-soft' : spread <= 0 ? 'is-tough' : 'is-mid'} title="Soft third's lift minus the tough third's: the read works when this is clearly positive"><b>{spread == null ? '—' : `${(spread * 100).toFixed(1)} pts`}</b></td>
                <Cell c={g.best} />
              </tr>
            );
          })}
          <tr className="is-league">
            <td className="is-left">Every skater-game</td>
            <td colSpan={5}><small>{all.n} graded over {grade.games} games ({grade.from} to {grade.to}): {all.actual.toFixed(2)} {unit} a game against {all.expected.toFixed(2)} from the skaters’ own rates ({signed(all.lift)}); {floor} {pct(all.hit)} against {pct(all.hitExpected)} expected</small></td>
          </tr>
        </tbody>
      </PfTable>
      <ByRank grade={grade} metric={metric} floor={floor} unit={unit} />
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
  const [streakTab, setStreakTab] = useState('goals');
  const [graded, setGraded] = useState({ date: null, data: null });
  const pick = useCallback((abbr) => setActive((cur) => (cur === abbr ? '' : abbr)), []);

  useEffect(() => {
    let live = true;
    fetch(`/api/nhl/data/defense?date=${date}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; })
      .then((j) => { if (live) { setData(j); setErr(''); } })
      .catch((e) => { if (live) setErr(`Couldn’t load the defense tables: ${e.message}`); });
    return () => { live = false; };
  }, [date]);

  useEffect(() => {
    let live = true;
    fetch(`/api/nhl/data/defense/grade?to=${date}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; })
      .then((j) => { if (live) setGraded({ date, data: j }); })
      .catch(() => { if (live) setGraded({ date, data: null }); });
    return () => { live = false; };
  }, [date]);
  const grade = graded.date === date ? graded.data : null;
  const grading = graded.date !== date;

  const digits = metric === 'g' ? 2 : 1;
  const keys = GROUPS[group].keys;
  const defense = data?.[span];
  const tables = useMemo(() => (defense ? boardTables(defense, { metric, venue, group }) : null), [defense, metric, venue, group]);
  const byVenue = useMemo(() => (defense ? { ALL: boardTables(defense, { metric, venue: 'ALL', group }), H: boardTables(defense, { metric, venue: 'H', group }), A: boardTables(defense, { metric, venue: 'A', group }) } : null), [defense, metric, group]);
  const reads = useMemo(() => (byVenue ? matchupReads(data?.tonight || [], byVenue, { venueMatched: venue !== 'ALL' }) : []), [byVenue, data, venue]);
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

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>Tonight’s matchups</h3><small>{data.tonight?.length || 0} games on {date} · each shooting side against what its opponent gives up per skater at the position {venue === 'ALL' ? 'over every game' : 'at the venue it defends tonight'} · softest spot first, with the shooters lined up there tonight, the best for {metric === 'g' ? 'goals' : 'shots'} first with his figure (the run’s λ, else his rate a game; click any position’s value to list that position’s shooters instead; * = carried from an earlier lineup) · once the game is stored, Result grades the listed shooters at {metric === 'g' ? '1+ goal' : '3+ SOG'} with the score</small></div>
      <Reads reads={reads} keys={keys} digits={digits} metric={metric} active={active} onPick={pick} games={data.tonight || []} group={group} />

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>Running hot</h3><small>Current streaks from this season’s stored games · the study found no carry-over from a goal last game, so read the streak as colour and the Tonight column as the matchup</small></div>
      <Streaks list={data.streaks || []} tab={streakTab} onTab={setStreakTab} playing={playing} view={view} byVenue={byVenue} venue={venue} group={group} digits={digits} metric={metric} />

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>{metric === 'g' ? 'Goals' : 'Shots'} against by position</h3><small>{SPANS.find(([k]) => k === span)[1]} · defender {venue === 'ALL' ? 'anywhere' : venue === 'H' ? 'at home' : 'away'} · per skater at the position, a game · rank 1 allows the most, ties share a rank</small></div>
      <div className="nhlx-df-grid">
        {keys.map((k) => <RankTable key={k} title={`${metric === 'g' ? 'Goals' : 'Shots'} against ${k}`} table={tables?.[k]} digits={digits} playing={playing} view={view} active={active} onPick={pick} />)}
      </div>

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>Track record</h3><small>Every stored skater-game this season through {date}, graded against each table as it stood that morning · the cell is the skaters’ {metric === 'g' ? 'goals' : 'shots'} against their own rate going in (lift), the {metric === 'g' ? '1+ goal' : '3+ SOG'} rate and the count · a table that works pulls the soft third up and the tough third down · under it the same by the opponent’s rank: the bold figure is ranks 1 through that one together (how far down the table the soft read holds), the small one the rank alone</small></div>
      <TrackRecord grade={grade} metric={metric} loading={grading} />

      <div className="nhlx-df-section"><h3 className="nhlx-db-h3" style={{ margin: 0 }}>Team overview</h3><small>Stored box scores for the span above · MoneyPuck season rates, all situations{data.moneypuck?.updatedAt ? ` (updated ${new Date(data.moneypuck.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})` : ''}</small></div>
      <Overview rows={overview} playing={playing} view={view} active={active} onPick={pick} />

      <div className="nhlx-da-legend"><span><i className="is-soft" />Softest third</span><span><i className="is-mid" />Middle</span><span><i className="is-tough" />Stingiest third</span></div>
      <p className="nhlx-df-note">
        {data.games} games stored. {thin ? `${thin} teams have fewer than 10 games ${venue === 'ALL' ? 'stored' : venue === 'H' ? 'at home' : 'away'}; their ranks can swing on one night.` : ''} Every figure is what the team allows per skater at the position a game, the read the study found twice as sharp as the per-game total. The Season span blends this season into last season’s table at games / (games + 15) for shots and games / (games + 40) for goals (GP reads “this season + last”); Last 10 / Last 5 are the newest stored games across the two seasons and are the noisier read. Positions are the lineup slots the box scores were logged under (LW / C / RW by line, D by pair); a group’s figure weights its positions by the skaters they carry. Click a team to follow it through every table. MoneyPuck rates credit MoneyPuck.com.
      </p>
    </div>
  );
}
