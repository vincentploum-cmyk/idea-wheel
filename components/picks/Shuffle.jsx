'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { survivorsAt, fallenAt, curveOf, linesAt, thinsAt, READ_FROM, bestReadFrom, readFromOf, BEST_MIN } from '@/lib/picks/shuffle';
import { blendText, dampText, pullText, reachText } from '@/lib/picks/projection';
import { asStated, calibrate } from '@/lib/picks/calibration';

// The shuffle (each board's Shuffle tab): a bar per stat. Raise it and the field falls away; what
// stays are the players whose chance of clearing the bar holds over the floor, each with his chance
// there, how often he has actually cleared it, the book's rung at or above the bar with its price and
// edge, and his projection for the game (the board's). Turned over ("Pick the chance", the panel's first view since
// 2026-10-30): the chance is set and every player shows the highest line he clears at it (`linesAt`), with the book's
// rung there. One request per market (/api/<sport>/shuffle), every bar move local; the tab mounts the panel on its
// first visit and keeps it.
//   sport: { api, query, markets: [{ market, label, unit, min, max, step, start }], teamLogo, headshotUrl, withDay }
//   onOpen(player, market): open the player's card (the NBA), optional.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const fmtStart = (iso, withDay) => (iso ? new Date(iso).toLocaleString(undefined, withDay ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' }) : '');
const FLOORS = [0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6];
const MODES = [['chance', 'Pick the chance'], ['line', 'Pick the line']];
const SORTS = [['line', 'Highest line'], ['edge', 'Best edge']];
const FELL_MAX = 14;
const cardCache = new Map();   // scorecard url → promise of its predictors: one read a session per sport and season
const readLabel = (k) => READ_FROM.find(([key]) => key === k)?.[1] || k;

/** What the season's scorecard says about the reads, for the note under the tabs. */
function readNote(card, from) {
  const on = readLabel(from).toLowerCase();
  if (!card) return `Reading from ${on}. The scorecard under the board says which read has predicted best; the green tab follows it.`;
  if (card.failed) return `Reading from ${on}. The scorecard could not be read, so no tab is marked.`;
  if (card.best == null) return `Reading from ${on} until the scorecard can rank the reads: ${card.n} plays graded this season, it needs ${BEST_MIN}.`;
  const b = card.scores[card.best]; const next = card.ranked[1]; const blend = card.scores.blend;
  const beside = card.best === 'blend'
    ? (next ? `, next ${readLabel(next).toLowerCase()} at ${card.scores[next].brier.toFixed(3)}` : '')
    : (blend ? `, the board’s blend ${blend.brier.toFixed(3)}` : '');
  const verdict = `the scorecard rates it best this season: accuracy ${b.brier.toFixed(3)} over ${card.n} plays${beside} (0 is perfect, 0.25 a coin flip, lower is better; within .002 of each other is a tie)`;
  if (from === card.best) return `Reading from ${on}, the green tab: ${verdict}.`;
  return `Reading from ${on}, your pick. The green tab, ${readLabel(card.best).toLowerCase()}, is where ${verdict}; press it to go back.`;
}

/** League rank → 'soft' | 'mid' | 'tough' | 'none' by third. */
function toneOf(rank, count) {
  if (!rank || !count) return 'none';
  const third = Math.ceil(count / 3);
  return rank <= third ? 'soft' : rank > count - third ? 'tough' : 'mid';
}

function Curve({ curve, height, onPick }) {
  const max = Math.max(1, ...curve.map((c) => c.n));
  const every = Math.max(1, Math.ceil(curve.length / 12));
  return (
    <div className="ir-sh-curve" role="img" aria-label="How many players clear each height at the floor">
      {curve.map((c, i) => (
        <button type="button" key={c.height} className={`ir-sh-step${c.height === height ? ' is-on' : ''}`} style={{ height: `${Math.max(3, (c.n / max) * 100)}%` }} title={`${c.n} clear ${c.height}+`} onClick={() => onPick(c.height)} aria-label={`${c.height} and up: ${c.n} players`}>
          {c.height === height || i % every === 0 ? <i>{c.n}</i> : null}
          {c.height === height || i % every === 0 ? <span>{c.height}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** The figures behind his projection, for the hovers. */
const windowsText = (p) => `Spread ${num(p.sd)} over his games · last 5 ${num(p.own?.l5)} · last 10 ${num(p.own?.l10)} · season ${num(p.own?.season)} (${p.own?.seasonN ?? 0} games) · vs ${p.opp} ${num(p.own?.h2h)} (${p.own?.h2hN ?? 0} meetings) · blend ${num(p.own?.blend)}`;

/** A shuffle row's cells, the same in both directions; `lineCell` (the chance mode's line) goes in front of the chance, `where` names the height in the hovers. */
function RowCells({ p, r, unit, teamLogo, headshotUrl, withDay, showCentre, final, lineCell = null, where = 'the bar' }) {
  const windows = windowsText(p);
  const tone = toneOf(p.spot?.rank, p.spot?.count);
  return (
    <>
      <td className="sh-player">
        <div className="nhlx-db-player">
          {p.espnId ? <img src={headshotUrl(p.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={teamLogo(p.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
          <span><b>{p.player}{p.confirmed ? <small className="ir-sh-check" title={`On the cheat sheet: ${p.sheet.join(', ')}`}> ✓</small> : null}</b><small>{p.team}{p.slot && p.depth ? ` · ${p.slot}${p.depth}` : p.pos ? ` · ${p.pos}` : ''} · {p.venue === 'H' ? 'vs' : 'at'} {p.opp}{p.start ? ` · ${fmtStart(p.start, withDay)}` : ''}</small></span>
        </div>
      </td>
      <td className="sh-health"><span className={`ir-health is-${(p.health || 'In').toLowerCase()}`} title={p.injury ? `${p.injury}${p.injuryDetail ? ` · ${p.injuryDetail}` : ''}${p.injuryFrom === 'override' ? ' · marked by hand on the card' : p.injuryFrom === 'depth' ? ' · the depth chart’s flag' : p.injuryFrom === 'report' ? ` · PropFinder’s report${p.injuryDate ? `, ${String(p.injuryDate).slice(0, 10)}` : ''}` : ''}` : p.injuryStale ? `Listed ${p.injuryStale.status} on ${String(p.injuryStale.date).slice(0, 10)} but played on ${p.injuryStale.playedOn}: left aside` : 'Nothing listed'}>{p.health || 'In'}</span></td>
      <td className="sh-spot">{p.spot?.rank ? <span className={`ir-spot is-${tone}`} title={`${p.opp} gives up ${p.spot.value != null ? `${num(p.spot.value)} ${unit} a game` : `the #${p.spot.rank} most ${unit}`} to ${p.spot.pos}s, #${p.spot.rank} of ${p.spot.count}${p.spot.league != null ? ` (the league ${num(p.spot.league)})` : ''} on ${p.spot.held ? `last season’s table (${p.opp} has no game this season yet)` : 'this season’s table'}, the table the board reads: the court’s other tabs compare against it${p.matchupFrom?.from === 'blend' ? ` · the cheat sheet’s tile #${p.spot.sheetRank} × ${num(p.matchupFrom.sheet, 3)} in full, PropFinder’s × ${num(p.matchupFrom.pf, 3)} beside it by its games${p.matchupFrom.weight != null ? ` (at ${p.matchupFrom.weight} for ${p.matchupFrom.gp} games)` : ''}` : p.matchupFrom?.from === 'sheet' ? ' · the cheat sheet’s tile alone' : ''}${p.matchup != null ? ` · × ${num(p.matchup, 2)} on his rate${dampText(p.matchupFrom)}` : ''}`}>#{p.spot.rankBlend ?? p.spot.rank} {p.spot.pos}</span> : <span className="ir-spot is-none">no table</span>}{p.matchup != null ? <small className="nhlx-auto-meta" style={{ marginLeft: 6 }}>× {num(p.matchup, 2)}</small> : null}{p.teamFactor != null && p.teamFactor !== 1 ? <small className="nhlx-auto-meta" style={{ marginLeft: 6 }} title={`${p.team}’s players’ own rates add up to more than the team is expected to get tonight: × ${num(p.teamFactor, 2)} on every projection of the side, down to the total (a ceiling, never a lift)`}>team × {num(p.teamFactor, 2)}</small> : null}</td>
      {showCentre ? <td className="is-num sh-centre" title={windows}><b>{num(r.centre)}</b></td> : null}
      {lineCell}
      <td className="is-num is-lead sh-chance" title={`Model tail ${pct(r.model)} · hit rate ${pct(r.emp)} over ${r.n} games${r.raw != null ? ` · ${pct(r.p)} calibrated to what this season’s rungs have landed${asStated(r.raw)}` : ''}`}><b>{pct(r.p)}</b><small>{r.fair} fair</small></td>
      <td className="small sh-cleared">{r.cleared ? `${r.cleared.n} of last ${r.cleared.of}` : '—'}{r.season != null ? <small className="nhlx-auto-meta"> · {pct(r.season)} season</small> : null}</td>
      <td className="is-num sh-book" title={r.book ? `${r.exact ? `The book’s rung at ${where}` : `The nearest rung above ${where}`}: ${r.book.main ? 'the main line, ' : ''}${r.book.books} book${r.book.books === 1 ? '' : 's'} · its chance ${pct(r.book.p)}` : `No rung at or above ${where}`}>{r.book ? <><b>{r.exact ? '' : '↑ '}o{r.book.line}</b><small>{fmtOdds(r.book.odds)}{r.book.main ? ' · main' : ''}</small></> : <small>no line</small>}</td>
      <td className={`is-num sh-edge${r.edge != null && r.edge > 0 ? ' is-best' : ''}`}>{r.edge == null ? '—' : <b>{r.edge >= 0 ? '+' : '−'}{Math.abs(Math.round(r.edge * 100))} pts</b>}</td>
      <td className="is-num sh-proj" title={`The board’s projection${p.volume ? ` · ${num(p.volume.att)} attempts a game at ${num(p.volume.pct * 100)}% (this season ${p.volume.pctSeason != null ? num(p.volume.pctSeason * 100) : '—'}% on ${p.volume.attN}, his long run ${num(p.volume.pctLong * 100)}%)` : ''}${p.minutes && p.minutes.factor !== 1 ? ` · ${num(p.minutes.tonight)} minutes tonight over the ${num(p.minutes.base)} behind his rate (× ${num(p.minutes.factor, 3)}${p.minutes.vacated ? `, +${num(p.minutes.vacated)} with ${(p.minutes.from || []).join(' + ')} out` : ', his last five'})` : ''}${p.lift ? ` · +${num(p.lift)} ${unit} of ${(p.liftFrom || []).join(' + ')}’s production handed to him (out tonight)` : ''}${p.pull ? ` · his read${pullText(p.pull)}` : ''}${p.reach?.add ? ` · ${num(p.base)} before the ceiling read${reachText(p.reach, p.spot?.pos)}` : ''} · ${windows}`}><b>{num(p.exp)}</b><small>{unit}{p.floor != null ? ` · ${p.floor}–${p.ceiling}` : ''}{p.lift ? <span className="ir-lift" title={`+${num(p.lift)} with ${(p.liftFrom || []).join(' + ')} out`}> ↑</span> : null}{p.reach?.add ? <span className={p.reach.add > 0 ? 'ir-lift' : 'ir-dip'} title={`${p.reach.add > 0 ? '+' : '−'}${num(Math.abs(p.reach.add))} toward his ${p.reach.add > 0 ? `ceiling of ${num(p.reach.ceiling)}` : `floor of ${num(p.reach.floorAt)}`} for the #${p.reach.rank ?? '—'} matchup`}> {p.reach.add > 0 ? '⇡' : '⇣'}</span> : null}{p.minutes && p.minutes.factor !== 1 ? <span className={p.minutes.factor > 1 ? 'ir-lift' : 'ir-dip'} title={`${num(p.minutes.tonight)} minutes tonight over the ${num(p.minutes.base)} behind his rate: × ${num(p.minutes.factor, 3)}`}> {num(p.minutes.tonight)}′</span> : null}</small></td>
      {final ? <td className="is-num nhlx-pk-got sh-got">{r.got === undefined ? <small>—</small> : r.got === null ? <small>DNP</small> : <><b>{r.got}</b><small>{unit}</small></>}</td> : null}
    </>
  );
}

export default function Shuffle({ sport, onOpen = null }) {
  const { api, query, markets, teamLogo, headshotUrl, withDay = false } = sport;
  const [active, setActive] = useState(markets[0].market);
  const [bars, setBars] = useState(() => Object.fromEntries(markets.map((m) => [m.market, m.start])));
  const [floor, setFloor] = useState(0.35);
  const [mode, setMode] = useState('chance');   // 'chance': the chance set, each player's highest line at it; 'line': the bar set, who clears it
  const [chance, setChance] = useState(0.7);
  const [sortBy, setSortBy] = useState('line');
  const [picked, setPicked] = useState(null);   // the tab pressed this session; until then the panel follows the scorecard's verdict
  const [card, setCard] = useState(null);   // the season's scorecard on the reads: { best, n, scores, ranked }, null until read
  const from = readFromOf(picked, card);
  const [data, setData] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const loaded = useRef({ query: null, set: new Set() });

  const load = useCallback(async (market) => {
    setBusy(market); setErr('');
    try {
      const res = await fetch(`${api}/shuffle?${query}&market=${market}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      setData((prev) => ({ ...prev, [market]: j }));
    } catch (e) { setErr(`Shuffle: ${e.message}`); }
    finally { setBusy(''); }
  }, [api, query]);

  // A new slate starts over; the active market loads first, then the others so every bar can count its field.
  useEffect(() => {
    if (loaded.current.query !== query) { loaded.current = { query, set: new Set() }; setData({}); }
    let cancelled = false;
    (async () => {
      for (const m of [active, ...markets.map((x) => x.market).filter((x) => x !== active)]) {
        if (cancelled || loaded.current.set.has(m)) continue;
        loaded.current.set.add(m);
        await load(m);
      }
    })();
    return () => { cancelled = true; };
  }, [active, query, markets, load]);

  // The season's scorecard, once per sport and season: which read has predicted best so far.
  const scorecardUrl = useMemo(() => { const season = new URLSearchParams(query).get('season'); return `${api}/scorecard${season ? `?season=${season}` : ''}`; }, [api, query]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cardCache.has(scorecardUrl)) {
          cardCache.set(scorecardUrl, fetch(scorecardUrl, { cache: 'no-store' }).then(async (res) => {
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
            return j.predictors || [];
          }));
        }
        const predictors = await cardCache.get(scorecardUrl);
        if (!cancelled) setCard(bestReadFrom(predictors, markets.map((m) => m.market)));
      } catch {
        cardCache.delete(scorecardUrl);
        if (!cancelled) setCard({ best: null, n: 0, scores: {}, ranked: [], failed: true });
      }
    })();
    return () => { cancelled = true; };
  }, [scorecardUrl, markets]);

  const d = data[active];
  const heights = useMemo(() => d?.heights || [], [d]);
  // A bar sits on its market's grid: clamped to the range and snapped to the step.
  const clampTo = (m, h) => { const cfg = markets.find((x) => x.market === m); const v = Math.min(cfg.max, Math.max(cfg.min, Number(h) || cfg.min)); return Math.round((cfg.min + Math.round((v - cfg.min) / cfg.step) * cfg.step) * 100) / 100; };
  const height = clampTo(active, bars[active]);
  const survivors = useMemo(() => (d ? survivorsAt(d.players, heights, height, floor, from) : []), [d, heights, height, floor, from]);
  const fallen = useMemo(() => (d ? fallenAt(d.players, heights, height, floor, from) : []), [d, heights, height, floor, from]);
  const curve = useMemo(() => (d ? curveOf(d.players, heights, floor, from) : []), [d, heights, floor, from]);
  const countAt = (m) => { const dd = data[m]; if (!dd) return null; const h = clampTo(m, bars[m]); return curveOf(dd.players, dd.heights, floor, from).find((c) => c.height === h)?.n ?? null; };
  const unitOf = (m) => markets.find((x) => x.market === m)?.unit || '';
  const final = !!d && d.finals > 0;
  const fromLabel = READ_FROM.find(([k]) => k === from)?.[1] || from;
  // The board's projection is the Projected column; the centre column shows only when the chance is read from somewhere else.
  const showCentre = from !== 'blend';
  // The chance mode: every player's highest line at the chance, and how many have one per market.
  const lines = useMemo(() => (d && mode === 'chance' ? linesAt(d.players, heights, chance, from, { sort: sortBy }) : []), [d, heights, chance, from, sortBy, mode]);
  const linedAt = (m) => { const dd = data[m]; return dd ? dd.players.filter((p) => thinsAt(p, dd.heights, chance, from) != null).length : null; };
  const activeCfg = markets.find((m) => m.market === active);
  const chancePct = Math.round(chance * 100);

  return (
    <section className="ir-sh" aria-label="Shuffle">
      <div className="ir-sh-head">
        <div>
          <div className="nhlx-tabs nhlx-rk-tabs ir-sh-mode" role="tablist" aria-label="Shuffle by">
            {MODES.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={mode === k} className={`nhlx-tab${mode === k ? ' is-active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}
          </div>
          {mode === 'chance'
            ? <p className="nhlx-auto-meta">Set the chance; every player shows the highest line he clears at it, with the book’s rung there, its price and the edge. The chance is his ladder read at that line (his own distribution over it, centred on tonight’s projection with the matchup inside it, beside how often he actually cleared it).</p>
            : <p className="nhlx-auto-meta">Set a height per stat; the list keeps the players whose chance of clearing it holds over the floor. The chance is his ladder read at that line (half his own distribution over it, centred on tonight’s projection with the matchup inside it, half how often he actually cleared it); the price is the book’s rung at or above the bar.</p>}
          {d?.calibrated ? <p className="nhlx-auto-meta">On the board’s blend the chances are calibrated to what this season’s {d.label.toLowerCase()} rungs have landed ({d.calibrated.n.toLocaleString()} graded, a stated 70% now prints {Math.round(calibrate(d.calibrated, 0.7) * 100)}%); a window or the line under Read from reads as stated. Hover a chance for the figure as stated.</p> : null}
        </div>
        {mode === 'chance' ? (
          <div className="ir-sh-floor ir-sh-chance">
            <label htmlFor="ir-sh-chance">Chance at least</label>
            <input id="ir-sh-chance" type="range" min={0.5} max={0.9} step={0.05} value={chance} onChange={(e) => setChance(Number(e.target.value))} />
            <b>{chancePct}%</b>
          </div>
        ) : (
          <div className="ir-sh-floor">
            <label>Keep players at <select className="nhlx-input nhlx-input-sm" value={floor} onChange={(e) => setFloor(Number(e.target.value))} aria-label="The floor">{FLOORS.map((f) => <option key={f} value={f}>{Math.round(f * 100)}%</option>)}</select> or better</label>
          </div>
        )}
      </div>
      <div className="nhlx-rk-toggle ir-sh-from">
          <small>Read from</small>
          <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="What the chance is read from">
            {READ_FROM.map(([k, l]) => {
              const what = k === 'blend' ? `The board’s read: ${blendText(d?.players?.[0]?.weights)}, × the matchup` : k === 'line' ? 'The book’s main line as the centre of his distribution' : k === 'h2h' ? 'His average over his last 4 meetings with the opponent (2 at least, from PropFinder’s logs; the opponent is in it already, so no matchup on top; the board’s blend stands in for a player without two)' : `His average over his ${l.toLowerCase()} games, × the matchup`;
              const sc = card?.scores?.[k];
              return (
                <button key={k} type="button" role="tab" aria-selected={from === k} className={`nhlx-tab${from === k ? ' is-active' : ''}${card?.best === k ? ' is-best' : ''}`} onClick={() => setPicked(k)} title={sc ? `${what} · scorecard: accuracy ${sc.brier.toFixed(3)} over ${sc.n} plays this season (lower is better)${card.best === k ? ' · the best so far: the panel opens on it' : ''}` : what}>
                  {l}{card?.best === k ? <i>best</i> : null}
                </button>
              );
            })}
          </div>
          <span className="nhlx-rk-toggle-note">{readNote(card, from)} The tab sets the centre of each player’s distribution; the hit-rate half of the chance stays as it is.</span>
        </div>
      {err ? <div className="nhlx-alert" style={{ marginTop: 12 }}>{err}</div> : null}
      {mode === 'chance' ? (
        <>
          <div className="nhlx-tabs nhlx-rk-tabs ir-sh-markets" role="tablist" aria-label="Stat">
            {markets.map((m) => {
              const n = linedAt(m.market);
              return <button key={m.market} type="button" role="tab" aria-selected={m.market === active} className={`nhlx-tab${m.market === active ? ' is-active' : ''}`} onClick={() => setActive(m.market)} title={n == null ? 'reading…' : `${n} players clear ${m.min}+ ${m.unit} at ${chancePct}% or better`}>{m.label}<i>{n ?? (busy === m.market ? '…' : '—')}</i></button>;
            })}
          </div>
          {d ? (
            <>
              <div className="nhlx-pfd-head" style={{ marginTop: 14 }}>
                <b>At {chancePct}%: each player’s highest {activeCfg?.label.toLowerCase()} line</b>
                <small className="nhlx-auto-meta">{lines.length} of {d.players.length} players clear {activeCfg?.min}+ {unitOf(active)} at {chancePct}% or better · read from {fromLabel.toLowerCase()} · the book column is the rung at his line, or the nearest one above it{onOpen ? ' · click a row for the card' : ''}</small>
                <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Sort">
                  {SORTS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={sortBy === k} className={`nhlx-tab${sortBy === k ? ' is-active' : ''}`} onClick={() => setSortBy(k)}>{l}</button>)}
                </div>
              </div>
              <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
                <table className="nhlx-db-table nhlx-pk-table ir-sh-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th title="In: nothing listed, or listed active · DTD: on the report but not ruled out · a player out tonight is left off the shuffle; the hover names the status as listed">Health</th>
                      <th title="The opponent’s rank at his position for the stat on the season table, 1 = gives up the most, with its factor on his rate (the cheat sheet’s tile first, PropFinder’s table beside it by its games); ‘team ×’ is his side’s ceiling">Matchup</th>
                      {showCentre ? <th className="is-num" title={`The centre his chance is read around: ${fromLabel.toLowerCase()}`}>Centre</th> : null}
                      <th title={`The highest line he clears at ${chancePct}% or better, and his chance one step higher`}>His line</th>
                      <th className="is-num" title="His chance at that line and the break-even price under it">Chance</th>
                      <th title="How often he cleared that line: his last ten, and the season rate">Cleared it</th>
                      <th className="is-num" title="The book’s rung at his line, or the nearest rung above it, with its price">Book</th>
                      <th className="is-num" title="The rung’s chance minus the price’s implied probability, in points">Edge</th>
                      <th className="is-num" title="His projection for the game, the board’s, with the quartiles of his range">Projected</th>
                      {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length ? lines.map(({ player: p, height: h, read: r, next }) => {
                      const grade = r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss';
                      const lineCell = (
                        <td className="ir-sh-line sh-line" title={`${p.player}: ${pct(r.p)} to clear ${h}+ (over ${r.line})${next ? `, ${pct(next.p)} at ${next.height}+` : ''}`}>
                          <b>{h}+</b><small>{unitOf(active)}{next?.p != null ? ` · ${next.height}+ at ${pct(next.p)}` : ''}</small>
                        </td>
                      );
                      return (
                        <tr key={p.key} className={`${onOpen ? 'is-click' : ''}${grade}`} onClick={() => onOpen?.(p, active)}>
                          <RowCells p={p} r={r} unit={unitOf(active)} teamLogo={teamLogo} headshotUrl={headshotUrl} withDay={withDay} showCentre={showCentre} final={final} lineCell={lineCell} where="his line" />
                        </tr>
                      );
                    }) : <tr><td colSpan={9 + (showCentre ? 1 : 0) + (final ? 1 : 0)}><small className="ir-nfl-none">Nobody clears {activeCfg?.min}+ at {chancePct}% or better. Lower the chance.</small></td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="ir-sh-curve is-empty">{busy ? 'Reading the slate…' : 'No pull for this slate yet'}</div>}
        </>
      ) : (
        <>
          <div className="ir-sh-grid">
            <div className="ir-sh-bars">
              {markets.map((m) => {
                const h = clampTo(m.market, bars[m.market]);
                const n = countAt(m.market);
                const dd = data[m.market];
                return (
                  <div className={`ir-sh-bar${m.market === active ? ' is-active' : ''}`} key={m.market}>
                    <button type="button" className="ir-sh-bar-label" onClick={() => setActive(m.market)}>{m.label}</button>
                    <input type="range" min={m.min} max={m.max} step={m.step} value={h} onChange={(e) => setBars((b) => ({ ...b, [m.market]: Number(e.target.value) }))} onFocus={() => setActive(m.market)} onPointerDown={() => setActive(m.market)} aria-label={`${m.label} bar`} />
                    <div className="ir-sh-bar-val"><b>{h}+</b><small>{m.unit}</small></div>
                    <div className="ir-sh-bar-count">{dd ? <><b>{n}</b> of {dd.players.length} at {Math.round(floor * 100)}%+</> : busy === m.market ? 'reading…' : <span>—</span>}</div>
                  </div>
                );
              })}
            </div>
            <div className="ir-sh-side">
              <div className="nhlx-auto-meta">How many clear the {markets.find((m) => m.market === active)?.label.toLowerCase()} bar at {Math.round(floor * 100)}%+, as it rises · click a step to set the bar</div>
              {d ? <Curve curve={curve} height={height} onPick={(h) => setBars((b) => ({ ...b, [active]: h }))} /> : <div className="ir-sh-curve is-empty">{busy ? 'Reading the slate…' : 'No pull for this slate yet'}</div>}
            </div>
          </div>

          {d ? (
            <>
              <div className="nhlx-pfd-head" style={{ marginTop: 14 }}>
                <b>Clear {height}+ {unitOf(active)}</b>
                <small className="nhlx-auto-meta">{survivors.length} of {d.players.length} players · read from {fromLabel.toLowerCase()} · sorted by the projection, then the chance · the book column is the rung at the bar, or the nearest one above it{onOpen ? ' · click a row for the card' : ''}</small>
              </div>
              <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
                <table className="nhlx-db-table nhlx-pk-table ir-sh-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th title="In: nothing listed, or listed active · DTD: on the report but not ruled out (day-to-day, questionable, probable, a game-time decision) · a player out, doubtful, suspended or on an injured list is left off the shuffle; the hover names the status as listed">Health</th>
                      <th title="The opponent’s rank at his position for the stat on the season table (the court’s and the card’s first tab; their other tabs compare against it and move no figure), 1 = gives up the most, with its factor on his rate — the cheat sheet’s tile first, in full, PropFinder’s table beside it by the games behind it (the hover names each); ‘team ×’ is his side’s ceiling (the team’s expected total over its players’ own rates, shown only when the rates run past it: it scales a side down, never up), the two multiplied into his projection">Matchup</th>
                      {showCentre ? <th className="is-num" title={`The centre his chance is read around: ${fromLabel.toLowerCase()}${from === 'line' || from === 'h2h' ? '' : ' × the matchup'} (the board’s projection when he lacks the window)`}>Centre</th> : null}
                      <th className="is-num" title={`His chance of ${height}+ and the break-even price under it`}>Chance at {height}+</th>
                      <th title="How often he cleared the bar: his last ten, and the season rate">Cleared it</th>
                      <th className="is-num" title="The book’s rung at the bar, or the nearest rung above it, with its price">Book</th>
                      <th className="is-num" title="The rung’s chance minus the price’s implied probability, in points">Edge</th>
                      <th className="is-num" title={`His projection for the game, the board’s: ${blendText(d?.players?.[0]?.weights)} (threes and free throws: his attempts × his percentage, the season’s shrunk toward his long run; in his first games pulled toward his role, his minutes at his position’s rate a minute, harder for rebounds than for assists), × his minutes tonight over the minutes behind that rate (his last five, and the out players’ minutes handed to the ones who play), plus the share of an out teammate’s production handed to him (the hover names both), × the matchup (counted by the games behind the opponent’s table) × his side’s ceiling; the figure the board and the card show; the quartiles of his range beside the unit`}>Projected</th>
                      {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {survivors.length ? survivors.map(({ player: p, read: r }) => {
                      const grade = r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss';
                      return (
                        <tr key={p.key} className={`${onOpen ? 'is-click' : ''}${grade}`} onClick={() => onOpen?.(p, active)}>
                          <RowCells p={p} r={r} unit={unitOf(active)} teamLogo={teamLogo} headshotUrl={headshotUrl} withDay={withDay} showCentre={showCentre} final={final} />
                        </tr>
                      );
                    }) : <tr><td colSpan={8 + (showCentre ? 1 : 0) + (final ? 1 : 0)}><small className="ir-nfl-none">Nobody clears {height}+ at {Math.round(floor * 100)}% or better. Lower the bar or the floor.</small></td></tr>}
                  </tbody>
                </table>
              </div>
              {fallen.length ? (
                <div className="ir-sh-fell" aria-label={`Under the floor at ${height}+`}>
                  <small className="nhlx-auto-meta">Fell off at {height}+ (his chance, the bar he still clears):</small>
                  {fallen.slice(0, FELL_MAX).map(({ player: p, read: r, thins }) => <span key={p.key} title={`${p.player} · ${pct(r.p)} to clear ${height}+${thins != null ? ` · still ${Math.round(floor * 100)}%+ at ${thins}+` : ''}`}>{p.player}<b>{pct(r.p)}</b>{thins != null ? <i> · {thins}+</i> : null}</span>)}
                  {fallen.length > FELL_MAX ? <span>… {fallen.length - FELL_MAX} more</span> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
