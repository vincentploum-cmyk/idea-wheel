'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo, rankClass } from './media';
import { usePlayerCard, FormChip } from './PlayerCard';
import { oppClass } from './MoneyPuck';
import { Rink, RinkLegend } from './Rink';

const POS = ['LW', 'C', 'RW', 'D'];
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

function EdgeChip({ v }) {
  if (v == null) return <span className="nhlx-edge">—</span>;
  const cls = v >= 10 ? 'is-soft' : v <= -10 ? 'is-tough' : '';
  return <span className={`nhlx-edge ${cls}`}>{signed(v)}</span>;
}

/** What `side.opp` allows to each position when it plays at `defVenue`. */
function MpLine({ mp, opp, venue }) {
  if (!mp?.situations?.['5on5']?.[opp]) return null;
  const ven = venue === 'A' ? 'H' : 'A';
  const v = mp.byVenue?.['5on5']?.[ven]?.[opp];
  const t = v || mp.situations['5on5'][opp];
  const r = v ? (mp.venueRanks?.['5on5']?.[ven]?.[opp] || {}) : (mp.ranks?.['5on5']?.[opp] || {});
  const n = v ? Object.keys(mp.byVenue['5on5'][ven]).length : Object.keys(mp.situations['5on5']).length;
  const cell = (k, label, d) => <span className={`nhlx-mp-pill ${oppClass(r[k], n)}`}>{label} <b>{num(t[k], d)}</b>{r[k] ? <i>#{r[k]}</i> : null}</span>;
  return (
    <div className="nhlx-mp-line">
      <small>5-on-5 {v ? (ven === 'H' ? 'at home' : 'away') : 'season'} · MoneyPuck{v ? '' : ' (no venue split yet)'} · {t.gp} GP</small>
      <div>{cell('xga60', 'xGA/60', 2)}{cell('sa60', 'SA/60', 1)}{cell('hdsa60', 'HD agst/60', 1)}{cell('cfPct', 'CF%', 1)}</div>
    </div>
  );
}

/** The slots a team's first goals allowed came from, most first: "LW1 ×3, LW2 ×1". */
export function slotBreakdown(bySlot) {
  return Object.entries(bySlot || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ×${n}`).join(', ');
}

/** First goals given up to one position: "4/12" with the line slots behind it, ranked like the other columns. */
function FirstGoalCell({ fg, pos, opp, venue, teamCount }) {
  if (!fg?.games) return <td>—</td>;
  const slots = slotBreakdown(fg.bySlot);
  const title = `${opp} gave up the first goal to ${pos === 'All' ? 'anyone' : pos} in ${fg.allowed} of ${fg.games} games at ${venue} with a first goal on record (${Math.round(fg.share * 100)}%${fg.league != null ? `, league ${Math.round(fg.league * 100)}%` : ''})${slots ? ` · by line: ${slots}` : ''}${fg.rank ? ` · rank ${fg.rank} of ${fg.teamCount}` : ''}`;
  return (
    <td className={rankClass(fg.rank, fg.teamCount || teamCount)} title={title}>
      {fg.allowed}/{fg.games}{fg.rank ? <i>#{fg.rank}</i> : null}{slots ? <small className="nhlx-fg-slots">{slots}</small> : null}
    </td>
  );
}

function DefenseCard({ side, teamCount, mp }) {
  const defVenue = side.venue === 'A' ? 'home' : 'away';
  return (
    <div className="nhlx-defcard">
      <div className="nhlx-defcard-head">
        <TeamLogo abbr={side.opp} size={28} />
        <div>
          <b>{side.opp} defense at {defVenue}</b>
          <small>Allowed per game to each position · rank 1 = most permissive of {teamCount}</small>
        </div>
      </div>
      <table className="nhlx-deftable">
        <thead>
          <tr><th>Pos</th><th>SOG</th><th>Goals</th><th>Chances</th><th>L10 SOG</th><th title="First goals of the game given up to this position at this venue, out of the games whose first goal is on record; the line slots they came from">1st goal</th></tr>
        </thead>
        <tbody>
          {POS.map((pos) => {
            const d = side.defense[pos];
            const s = d?.season;
            const r = d?.rank || {};
            const l10 = d?.l10;
            const rl10 = d?.l10Rank || {};
            return (
              <tr key={pos}>
                <td><b>{pos}</b>{d?.source === 'propfinder' ? <i title={`PropFinder ${d.seasonLabel}`}> PF</i> : null}</td>
                <td className={rankClass(r.sog, d?.teamCount || teamCount)}>{s?.gp ? `${num(s.sog)} ` : '—'}{r.sog ? <i>#{r.sog}</i> : null}</td>
                <td className={rankClass(r.g, teamCount)}>{s?.gp ? `${num(s.g, 2)} ` : '—'}{r.g ? <i>#{r.g}</i> : null}</td>
                <td className={rankClass(r.iscf, teamCount)}>{s?.gp ? `${num(s.iscf)} ` : '—'}{r.iscf ? <i>#{r.iscf}</i> : null}</td>
                <td className={rankClass(rl10.sog, teamCount)}>{l10?.gp ? `${num(l10.sog)} ` : '—'}{rl10.sog ? <i>#{rl10.sog}</i> : null}</td>
                <FirstGoalCell fg={d?.firstGoal} pos={pos} opp={side.opp} venue={defVenue} teamCount={teamCount} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <small className="nhlx-auto-meta">
        {side.defense.All?.season?.gp || 0} games at {defVenue} this season{side.defense.All?.firstGoal?.games ? ` · first goal given up in ${side.defense.All.firstGoal.allowed} of ${side.defense.All.firstGoal.games} (${slotBreakdown(side.defense.All.firstGoal.bySlot) || 'no line on record'})` : ''}
        {POS.some((p) => side.defense[p]?.source === 'propfinder') ? ` · positions marked PF use PropFinder ${POS.map((p) => side.defense[p]?.seasonLabel).find(Boolean)} (last season) until 10 games are stored` : ''}
      </small>
      <MpLine mp={mp} opp={side.opp} venue={side.venue} />
    </div>
  );
}

function SkaterRows({ skaters, showTeam, teamCount }) {
  const open = usePlayerCard();
  return skaters.map((p) => (
    <tr key={`${p.team}-${p.name}`} className={`${p.inLineup ? '' : 'is-muted'}${p.id ? ' is-click' : ''}`} onClick={() => p.id && open({ id: p.id, opp: p.opp, venue: p.venue })}>
      <td>
        <div className="nhlx-db-player">
          <Headshot id={p.id} size={30} />
          <span>
            <b>{p.name} <FormChip tag={p.form?.shots} small /></b>
            <small>{showTeam ? `${p.team} ${p.venue === 'H' ? 'vs' : '@'} ${p.opp} · ` : ''}{p.pos}{p.line ? ` · L${p.line}` : p.inLineup ? '' : ' · not in lineup'}</small>
          </span>
        </div>
      </td>
      <td>{p.gp || 0}</td>
      <td><b>{num(p.sog)}</b>{p.l5Sog != null ? <small> L5 {num(p.l5Sog)}</small> : null}</td>
      <td>{num(p.g, 2)}</td>
      <td className={rankClass(p.vs?.sog?.rank, teamCount)}>{p.vs?.sog ? `${num(p.vs.sog.allowed)} ` : '—'}{p.vs?.sog?.rank ? <i>#{p.vs.sog.rank}</i> : null}</td>
      <td><EdgeChip v={p.shotEdge} /></td>
      <td><EdgeChip v={p.goalEdge} /></td>
      <td><b>{num(p.projSog)}</b></td>
      <td><b>{num(p.projG, 2)}</b></td>
      <td>{p.hit?.s3 != null ? `${Math.round(p.hit.s3 * 100)}%` : '—'}</td>
      <td><FormChip tag={p.form?.goals} small /></td>
    </tr>
  ));
}

/** Finished game: every skater's pre-game position, box line, and the defense bucket it fed. */
function PositionLog({ game }) {
  const open = usePlayerCard();
  const [team, setTeam] = useState(game.away);
  const rows = game.log.skaters.filter((s) => s.team === team);
  const lineup = rows.filter((s) => s.posSource !== 'box').length;
  return (
    <details className="nhlx-db-details nhlx-poslog">
      <summary>Position log · final {game.away} {game.log.score.away} – {game.home} {game.log.score.home}</summary>
      <p className="nhlx-auto-meta">
        Each row is one skater in this game at the position and line slot the latest lineup read gives him (LW1 … RW4, D1 … D3; a read after the game still corrects it); his shots and goals count against the opponent’s
        <b> {rows[0]?.bucket.venue === 'H' ? 'home' : 'away'}</b> defense for that position, and are logged per line. {lineup}/{rows.length} positions came from the lineup{lineup < rows.length ? `, ${rows.length - lineup} from the box-score roster code (no line)` : ''}.
      </p>
      <div className="nhlx-tabs" role="tablist">
        {[game.away, game.home].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={team === t} className={`nhlx-tab${team === t ? ' is-active' : ''}`} onClick={() => setTeam(t)}>{t} skaters</button>
        ))}
      </div>
      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table nhlx-mu-table">
          <thead>
            <tr><th>Player</th><th title="Line slot from the lineup read for the game: forward line 1–4, defense pair 1–3">Line</th><th title="Position from the lineup read for the game">Pos</th><th title="Position code in the NHL box score">Box</th><th>Source</th><th>TOI</th><th>G</th><th>A</th><th>SOG</th><th>iCF</th><th>iSCF</th><th>Counts against</th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={`${s.team}-${s.id}`} className={s.id ? 'is-click' : ''} onClick={() => s.id && open({ id: s.id, opp: s.opp, venue: s.venue })}>
                <td><div className="nhlx-db-player"><Headshot id={s.id} size={26} /><span><b>{s.name}</b></span></div></td>
                <td>{s.slot ? <span className="nhlx-chip">{s.slot}</span> : <span className="nhlx-auto-meta">—</span>}</td>
                <td><b>{s.pos}</b></td>
                <td className={s.boxPos !== s.pos ? 'is-diff' : ''}>{s.boxPos}</td>
                <td><span className={`nhlx-chip ${s.posSource === 'box' ? '' : 'nhlx-chip-blue'}`}>{s.posSource === 'box' ? 'box score' : 'lineup'}</span></td>
                <td>{num(s.toi)}</td><td>{s.g}</td><td>{s.a}</td><td><b>{s.sog}</b></td><td>{s.icf}</td><td>{s.iscf}</td>
                <td className="nhlx-auto-meta">{s.bucket.team} {s.bucket.venue === 'H' ? 'home' : 'away'} vs {s.bucket.pos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SkaterTable({ skaters, showTeam = false, teamCount }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table">
        <thead>
          <tr>
            <th>Player</th><th>GP</th><th>SOG/G</th><th>G/G</th>
            <th title="Shots the opponent allows per game to this position at this venue (rank 1 = most)">Opp allows</th>
            <th title="Opponent's shots allowed to this position vs the league average">Shot edge</th>
            <th title="Opponent's goals allowed to this position vs the league average">Goal edge</th>
            <th title="Player's SOG/G × opponent's shot ratio">Proj SOG</th>
            <th title="Player's G/G × opponent's goal ratio">Proj G</th>
            <th title="How often the player had 3+ shots over the window">3+ rate</th>
            <th title="Goal form over the last 5 games">Goals</th>
          </tr>
        </thead>
        <tbody><SkaterRows skaters={skaters} showTeam={showTeam} teamCount={teamCount} /></tbody>
      </table>
    </div>
  );
}

export default function MatchupsPanel() {
  const [date, setDate] = useState('');
  const [slate, setSlate] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState('');
  const [minGp, setMinGp] = useState(5);

  const load = useCallback((d) => fetch(`/api/nhl/data/slate${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => {
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      return j;
    })
    .then((j) => { setSlate(j); setDate(j.date); setErr(''); })
    .catch((e) => setErr(`Couldn’t load the slate: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  // Picking another date from the controls.
  const pickDate = (d) => { setBusy(true); setErr(''); load(d); };

  // Pull the beat writers' lines (GameDayTweets) and NHL.com's lineups for this date right now.
  const [lineMsg, setLineMsg] = useState('');
  const refreshLines = async () => {
    setBusy(true);
    setLineMsg('Reading GameDayTweets and NHL.com lineups…');
    try {
      const res = await fetch(`/api/nhl/data/refresh?only=lineups&date=${date}`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || j.reason || `${res.status}`);
      const r = j.result || {};
      setLineMsg(`Lines updated at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET: ${r.gamedaytweets ?? 0} team${r.gamedaytweets === 1 ? '' : 's'} from GameDayTweets, ${r.withLineups ?? 0} of ${r.scheduled ?? 0} games with an NHL.com lineup${r.restamp?.changed ? `, ${r.restamp.changed} logged position${r.restamp.changed === 1 ? '' : 's'} corrected` : ''}. ${r.model?.ran ? `Model run saved (${r.model.players} players).` : r.model?.skipped ? `Model not re-run: ${r.model.skipped}.` : r.model?.error ? `Model run failed: ${r.model.error}.` : ''} Each rink says when its source last changed.`);
      await load(date);
    } catch (e) {
      setLineMsg(`Couldn’t update the lines: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const shift = (n) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    pickDate(d.toISOString().slice(0, 10));
  };

  const filtered = useMemo(() => {
    if (!slate) return [];
    return slate.games.map((g) => ({
      ...g,
      // The rinks show every skater and dim the rest; the tables filter.
      rinkSides: g.sides,
      sides: g.sides.map((s) => ({ ...s, skaters: s.skaters.filter((p) => (!pos || p.pos === pos) && (p.gp || 0) >= minGp) })),
    }));
  }, [slate, pos, minGp]);

  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <div className="nhlx-mu">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">
            {slate ? `${slate.games.length} game${slate.games.length === 1 ? '' : 's'} · defense tables from ${slate.gamesStored} stored games · positions from the latest lineup read (re-read after the game)` : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
          <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && pickDate(e.target.value)} aria-label="Slate date" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
          <select className="nhlx-input nhlx-input-sm" value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
            <option value="">All positions</option>
            {POS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="nhlx-input nhlx-input-sm" value={minGp} onChange={(e) => setMinGp(Number(e.target.value))} aria-label="Minimum games">
            {[1, 5, 10].map((n) => <option key={n} value={n}>{n}+ GP</option>)}
          </select>
          <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={busy || !date} onClick={refreshLines} title="Read the beat writers' lines on GameDayTweets and NHL.com's projected lineups for this date now">Refresh lines</button>
        </div>
      </div>
      {lineMsg && <p className="nhlx-auto-msg" role="status">{lineMsg}</p>}

      {err && <div className="nhlx-alert">⚠ {err}</div>}
      {!slate && !err && <div className="nhlx-empty">Loading tonight’s matchups…</div>}
      {slate && !slate.games.length && <div className="nhlx-empty">No games on this date.</div>}

      {slate && slate.games.length > 0 && (
        <>
          {filtered.map((g, i) => (
            <article key={g.id} className={`nhlx-mu-game${i === 0 ? ' is-first' : ''}`} id={`game-${g.id}`}>
              <div className="nhlx-mu-game-head">
                <TeamLogo abbr={g.away} size={34} />
                <b>{g.away} @ {g.home}</b>
                <TeamLogo abbr={g.home} size={34} />
                <small>
                  {g.log?.score
                    ? <>Final · <b className="nhlx-mu-score">{g.away} {g.log.score.away} – {g.home} {g.log.score.home}</b>{g.startTimeUTC ? ` · ${fmtTime(g.startTimeUTC)}` : ''}</>
                    : fmtTime(g.startTimeUTC)}
                </small>
              </div>
              {g.total && (
                <div className="nhlx-mu-verdict nhlx-mu-total">
                  <div className="nhlx-mu-verdict-head">
                    <b>Game total</b>
                    <span className={`nhlx-edge ${g.total.tier === 'high' ? 'is-soft' : g.total.tier === 'low' ? 'is-tough' : ''}`}>{g.total.headline}</span>
                    {g.log?.score ? <small>actual {g.log.score.away + g.log.score.home}</small> : null}
                  </div>
                  <ul>
                    {g.total.lines.map((l) => <li key={l.key} className={l.tone || undefined}>{l.text}</li>)}
                  </ul>
                  {g.total.h2h?.games?.length ? <small className="nhlx-auto-meta">Meetings: {g.total.h2h.games.map((m) => `${m.score} (${m.total})`).join(' · ')}. Expected goals and pace © MoneyPuck.com.</small> : <small className="nhlx-auto-meta">Expected goals and pace © MoneyPuck.com.</small>}
                </div>
              )}
              {g.verdicts && Object.values(g.verdicts).some(Boolean) && (
                <div className="nhlx-mu-verdicts">
                  {/* Above each rink: the read on the defense its skaters face (the away rink carries the home team's). */}
                  {g.sides.map((s) => {
                    const v = g.verdicts[s.opp];
                    return (
                      <div key={s.team} className="nhlx-mu-verdict">
                        <div className="nhlx-mu-verdict-head">
                          <TeamLogo abbr={s.opp} size={22} />
                          <b>{s.opp}</b>
                          {v ? <span className={`nhlx-edge ${v.tier === 'leaky' ? 'is-soft' : v.tier === 'tight' ? 'is-tough' : ''}`}>{v.headline}</span> : <small>No read yet</small>}
                        </div>
                        {v && (
                          <ul>
                            {v.lines.map((l) => <li key={l.key} className={l.tone || undefined}>{l.text}</li>)}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="nhlx-rink-pair">
                {g.rinkSides.map((s) => <Rink key={s.team} side={s} teamCount={slate.teamCount} posFilter={pos} minGp={minGp} log={g.log} modelRun={slate.modelRun} />)}
              </div>
              <RinkLegend />
              {g.log && <PositionLog game={g} />}
              <details className="nhlx-db-details nhlx-mu-details">
                <summary>Defense tables and all skaters</summary>
                {g.sides.map((s) => (
                  <div key={s.team} className="nhlx-mu-side">
                    <div className="nhlx-mu-side-head">
                      <TeamLogo abbr={s.team} size={22} />
                      <b>{s.team} skaters</b>
                      <small>{s.venue === 'H' ? 'home' : 'away'} · positions from {{ lineup: 'the NHL.com projected lineup', gamedaytweets: 'the beat writers’ lines', propfinder: 'PropFinder’s depth chart' }[s.source] || 'the roster (no lineup yet)'}</small>
                    </div>
                    <div className="nhlx-mu-grid">
                      <DefenseCard side={s} teamCount={slate.teamCount} mp={slate.moneypuck} />
                      {s.skaters.length ? <SkaterTable skaters={s.skaters} teamCount={slate.teamCount} /> : <p className="nhlx-auto-meta">No skaters match the filter.</p>}
                    </div>
                  </div>
                ))}
              </details>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
