'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo, rankClass } from './media';

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
function DefenseCard({ side, teamCount }) {
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
          <tr><th>Pos</th><th>SOG</th><th>Goals</th><th>Chances</th><th>L10 SOG</th></tr>
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
                <td><b>{pos}</b></td>
                <td className={rankClass(r.sog, teamCount)}>{s?.gp ? `${num(s.sog)} ` : '—'}{r.sog ? <i>#{r.sog}</i> : null}</td>
                <td className={rankClass(r.g, teamCount)}>{s?.gp ? `${num(s.g, 2)} ` : '—'}{r.g ? <i>#{r.g}</i> : null}</td>
                <td className={rankClass(r.iscf, teamCount)}>{s?.gp ? `${num(s.iscf)} ` : '—'}{r.iscf ? <i>#{r.iscf}</i> : null}</td>
                <td className={rankClass(rl10.sog, teamCount)}>{l10?.gp ? `${num(l10.sog)} ` : '—'}{rl10.sog ? <i>#{rl10.sog}</i> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <small className="nhlx-auto-meta">{side.defense.All?.season?.gp || 0} games at {defVenue} this season</small>
    </div>
  );
}

function SkaterRows({ skaters, showTeam, teamCount }) {
  return skaters.map((p) => (
    <tr key={`${p.team}-${p.name}`} className={p.inLineup ? '' : 'is-muted'}>
      <td>
        <div className="nhlx-db-player">
          <Headshot id={p.id} size={30} />
          <span>
            <b>{p.name}</b>
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
    </tr>
  ));
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
  const [top, setTop] = useState('shots');
  const [minGp, setMinGp] = useState(5);

  const load = useCallback(async (d) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/nhl/data/slate${d ? `?date=${d}` : ''}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      setSlate(j);
      setDate(j.date);
    } catch (e) {
      setErr(`Couldn’t load the slate: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(''); }, [load]);

  const shift = (n) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    load(d.toISOString().slice(0, 10));
  };

  const filtered = useMemo(() => {
    if (!slate) return [];
    return slate.games.map((g) => ({
      ...g,
      sides: g.sides.map((s) => ({ ...s, skaters: s.skaters.filter((p) => (!pos || p.pos === pos) && (p.gp || 0) >= minGp) })),
    }));
  }, [slate, pos, minGp]);

  const topList = useMemo(() => {
    if (!slate) return [];
    return slate.top[top].filter((p) => !pos || p.pos === pos);
  }, [slate, top, pos]);

  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <div className="nhlx-mu">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">
            {slate ? `${slate.games.length} game${slate.games.length === 1 ? '' : 's'} · defense tables from ${slate.gamesStored} stored games · positions ${slate.games.some((g) => g.frozen) ? 'frozen pre-game' : 'from the projected lineups (frozen at puck drop)'}` : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
          <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && load(e.target.value)} aria-label="Slate date" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
          <select className="nhlx-input nhlx-input-sm" value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
            <option value="">All positions</option>
            {POS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="nhlx-input nhlx-input-sm" value={minGp} onChange={(e) => setMinGp(Number(e.target.value))} aria-label="Minimum games">
            {[1, 5, 10].map((n) => <option key={n} value={n}>{n}+ GP</option>)}
          </select>
        </div>
      </div>

      {err && <div className="nhlx-alert">⚠ {err}</div>}
      {!slate && !err && <div className="nhlx-empty">Loading tonight’s matchups…</div>}
      {slate && !slate.games.length && <div className="nhlx-empty">No games on this date.</div>}

      {slate && slate.games.length > 0 && (
        <>
          <div className="nhlx-mu-top">
            <div className="nhlx-mu-top-head">
              <h3>Best matchups tonight</h3>
              <div className="nhlx-tabs" role="tablist">
                {[['shots', 'Shots'], ['goals', 'Goals']].map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={top === k} className={`nhlx-tab${top === k ? ' is-active' : ''}`} onClick={() => setTop(k)}>{l}</button>
                ))}
              </div>
            </div>
            {topList.length ? (
              <SkaterTable skaters={topList} showTeam teamCount={slate.teamCount} />
            ) : (
              <p className="nhlx-auto-meta">Nothing to rank yet: players need at least 5 stored games and a defense table for the opponent.</p>
            )}
          </div>

          {filtered.map((g) => (
            <article key={g.id} className="nhlx-mu-game" id={`game-${g.id}`}>
              <div className="nhlx-mu-game-head">
                <TeamLogo abbr={g.away} size={34} />
                <b>{g.away} @ {g.home}</b>
                <TeamLogo abbr={g.home} size={34} />
                <small>{fmtTime(g.startTimeUTC)}{g.frozen ? ' · positions frozen' : ''}</small>
              </div>
              {g.sides.map((s) => (
                <div key={s.team} className="nhlx-mu-side">
                  <div className="nhlx-mu-side-head">
                    <TeamLogo abbr={s.team} size={22} />
                    <b>{s.team} skaters</b>
                    <small>{s.venue === 'H' ? 'home' : 'away'} · positions from {s.source === 'lineup' ? 'the projected lineup' : 'the roster (no lineup yet)'}</small>
                  </div>
                  <div className="nhlx-mu-grid">
                    <DefenseCard side={s} teamCount={slate.teamCount} />
                    {s.skaters.length ? <SkaterTable skaters={s.skaters} teamCount={slate.teamCount} /> : <p className="nhlx-auto-meta">No skaters match the filter.</p>}
                  </div>
                </div>
              ))}
            </article>
          ))}
        </>
      )}
    </div>
  );
}
