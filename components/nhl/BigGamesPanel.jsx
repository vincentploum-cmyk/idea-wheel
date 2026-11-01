'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot } from './media';
import { usePlayerCard } from './PlayerCard';
import { NHL_BIG, nhlBigGames, bigWhy } from '@/lib/nhl-data/big-pure';

// The Big games tab (its own slate date; Vincent, 2026-11-01: "Do the same big games study for the NHL"; lib/nhl-data/big-pure.js,
// docs/audits/2026-11-01-nhl-big-games.md): the night's likeliest 5+ / 6+ shots on goal and 2+ goals, off the board's own λ as
// the shuffle prints it, with how often he has done it lately beside each name. One request a slate (/api/nhl/data/shuffle).

const SHOW = 25;
const pct = (v) => (v == null ? '—' : v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const KINDS = Object.entries(NHL_BIG).map(([k, v]) => [k, v.label]);

export function BigRows({ big, market, onOpen }) {
  const [all, setAll] = useState(false);
  const rows = (big?.lists?.[market] || []).map((id) => big.rows[id]).filter(Boolean);
  if (!rows.length) return <p className="nhlx-auto-meta ir-ml-empty">No big-game candidate on this slate yet.</p>;
  const { marks } = rows[0]; const { unit } = NHL_BIG[market];
  const final = rows.some((r) => r.final);
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-ml-table ir-big-table">
          <thead><tr>
            <th className="ir-slate-rank">#</th><th>Skater</th>
            {marks.map((mk, i) => <th key={mk} className={`is-num${i === 0 ? ' is-lead' : ''}`} title={`His chance of ${mk}+ ${unit} tonight`}>{mk}+</th>)}
            <th className="is-num" title={`The board’s projected ${market === 'sog' ? 'shots on goal' : 'goals'} tonight (λ)`}>Proj</th>
            <th className="ir-big-why">Lately</th>
            {final ? <th className="is-num">Got</th> : null}
          </tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id}>
                <td className="ir-slate-rank">{i + 1}</td>
                <td>
                  <span className="ir-big-skater">
                    <Headshot id={r.pid} size={28} />
                    <span>
                      <button type="button" className="ir-big-name" onClick={() => onOpen(r)}><b>{r.name}</b></button>
                      <small className="ir-big-sub">{r.team} · {r.line || r.pos} · {r.venue === 'H' ? 'vs' : '@'} {r.opp}{r.start && !r.final ? ` · ${fmtTime(r.start)}` : ''}</small>
                      <small className="ir-big-why-m">{bigWhy(r)}</small>
                    </span>
                  </span>
                </td>
                {marks.map((mk, j) => (
                  <td key={mk} className={`is-num${j === 0 ? ' is-lead' : ''}${r.got ? (r.got[mk] ? ' is-hit' : ' is-miss') : ''}`} title={r.calibrated && r.raw[mk] != null ? `The board’s read as stated: ${pct(r.raw[mk])}. Shown calibrated to what its stated chances have landed this season.` : undefined}>
                    <b>{pct(r.p[mk])}</b>
                  </td>
                ))}
                <td className="is-num">{r.lam == null ? '—' : r.lam.toFixed(market === 'sog' ? 1 : 2)}</td>
                <td className="ir-big-why"><small>{bigWhy(r)}</small></td>
                {final ? <td className={`is-num nhlx-pk-got${r.got ? (r.got[marks[0]] ? ' is-hit' : ' is-miss') : ''}`}>{r.actual == null ? <small>{r.actual === null ? 'DNP' : '—'}</small> : <b>{r.actual}</b>}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && rows.length > SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </>
  );
}

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    The skaters likeliest to have a <b>big game</b> tonight: 5+ or 6+ shots on goal, two goals or more. Checked on 2025-26 and this season’s box scores, nothing beside the board’s own projection picked them out: not his recent big nights, his attempts, ice time or line, nor the opponent, its goalie or the pace. So the chance is the board’s, as the shuffle prints it, and how often he has done it lately sits beside it for reference. Long shots, not safe plays.
  </p>
);

export default function BigGamesPanel() {
  const open = usePlayerCard();
  const [date, setDate] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [market, setMarket] = useState('sog');
  const load = useCallback((d) => fetch(`/api/nhl/data/shuffle${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setData(j); setDate(j.date); setErr(''); })
    .catch((e) => setErr(`Big games: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  const pick = (d) => { setBusy(true); setErr(''); load(d); };
  const shift = (n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); pick(d.toISOString().slice(0, 10)); };
  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';
  const big = useMemo(() => (data ? nhlBigGames(data) : null), [data]);
  const onOpen = (r) => open({ id: r.pid, opp: r.opp, venue: r.venue, pos: r.pos, line: r.line, date });
  const counts = big ? Object.fromEntries(Object.keys(NHL_BIG).map((m) => [m, big.lists[m].length])) : {};

  return (
    <section className="nhlx-pk" aria-label="Big games">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">{data ? `${data.games.length} game${data.games.length === 1 ? '' : 's'}` : ''}</div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
          <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && pick(e.target.value)} aria-label="Slate date" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !date} onClick={() => pick(date)}>{busy ? 'Loading…' : 'Reload'}</button>
        </div>
      </div>
      {err ? <div className="nhlx-alert">{err}</div> : null}
      {big ? (
        <div className="ir-overview">
          <div className="nhlx-tabs is-pills is-small ir-big-tabs" role="tablist" aria-label="Stat">
            {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-tab${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>{l}<i>{counts[k]}</i></button>)}
          </div>
          {data.games.length ? <BigRows key={`${date}|${market}`} big={big} market={market} onOpen={onOpen} /> : <p className="nhlx-auto-meta">No games on this date.</p>}
          {LEGEND}
        </div>
      ) : null}
    </section>
  );
}
