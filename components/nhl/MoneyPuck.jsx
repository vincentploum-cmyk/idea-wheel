'use client';

import { useEffect, useState } from 'react';
import { TeamLogo } from './media';

// MoneyPuck metrics: rank 1 = best for the team, so "soft" (green for shooters) is the bottom third.
export const MP_COLS = [
  ['xgfPct', 'xGF%', 1], ['cfPct', 'CF%', 1], ['xgf60', 'xGF/60', 2], ['xga60', 'xGA/60', 2],
  ['sf60', 'SF/60', 1], ['sa60', 'SA/60', 1], ['hdsf60', 'HD for/60', 1], ['hdsa60', 'HD agst/60', 1], ['gf60', 'GF/60', 2], ['ga60', 'GA/60', 2],
];
export const SIT_LABEL = { all: 'All situations', '5on5': '5-on-5', '5on4': 'Power play', '4on5': 'Penalty kill' };
const num = (v, d) => (v == null ? '—' : Number(v).toFixed(d));
export const oppClass = (rank, n = 32) => (!rank ? '' : rank > n - Math.ceil(n / 3) ? 'is-soft' : rank <= Math.ceil(n / 3) ? 'is-tough' : '');

export function MpCell({ v, d, rank, n, invert }) {
  // invert: a high rank for the *opponent* is good for the shooter (defense metrics).
  const cls = invert ? oppClass(rank, n) : (rank && rank <= Math.ceil(n / 3) ? 'is-soft' : rank && rank > n - Math.ceil(n / 3) ? 'is-tough' : '');
  return <td className={cls}>{num(v, d)}{rank ? <i>#{rank}</i> : null}</td>;
}

/** One team, all four situations (+ home/away 5v5 when game logs are loaded). */
export function TeamMoneyPuck({ abbr, mp }) {
  if (!mp?.teams) return <p className="nhlx-auto-meta">MoneyPuck team data not loaded yet — see Start here.</p>;
  const n = mp.teams.teams || 32;
  const sits = Object.keys(mp.teams.situations || {}).filter((s) => mp.teams.situations[s][abbr]);
  if (!sits.length) return <p className="nhlx-auto-meta">No MoneyPuck row for {abbr} yet.</p>;
  const venue = mp.games?.byVenue?.['5on5'];
  return (
    <div className="nhlx-defcard nhlx-defcard-wide">
      <div className="nhlx-defcard-head">
        <div>
          <b>Team profile · MoneyPuck</b>
          <small>{mp.teams.year}-{String(mp.teams.year + 1).slice(2)} regular season · rank 1 = best of {n} · updated {new Date(mp.teams.updatedAt).toLocaleDateString()} · data from MoneyPuck.com</small>
        </div>
      </div>
      <div className="nhlx-db-table-wrap" style={{ boxShadow: 'none' }}>
        <table className="nhlx-deftable">
          <thead><tr><th>Situation</th><th>GP</th>{MP_COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {sits.map((sit) => {
              const t = mp.teams.situations[sit][abbr];
              const r = mp.teams.ranks?.[sit]?.[abbr] || {};
              return (
                <tr key={sit}>
                  <td><b>{SIT_LABEL[sit] || sit}</b></td><td>{t.gp}</td>
                  {MP_COLS.map(([k, , d]) => <MpCell key={k} v={t[k]} d={d} rank={r[k]} n={n} />)}
                </tr>
              );
            })}
            {venue && ['H', 'A'].map((ven) => {
              const t = venue[ven]?.[abbr];
              if (!t) return null;
              const r = mp.games.ranks?.['5on5']?.[ven]?.[abbr] || {};
              return (
                <tr key={ven}>
                  <td><b>5-on-5 {ven === 'H' ? 'at home' : 'away'}</b></td><td>{t.gp}</td>
                  {MP_COLS.map(([k, , d]) => <MpCell key={k} v={t[k]} d={d} rank={r[k]} n={Object.keys(venue[ven]).length} />)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** League-wide table for one situation. */
export function MoneyPuckTable() {
  const [mp, setMp] = useState(null);
  const [sit, setSit] = useState('5on5');
  const [sort, setSort] = useState('xgfPct');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => fetch('/api/nhl/data/moneypuck', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setMp(j)).catch(() => {});
  useEffect(() => { load(); }, []);
  const refresh = async (games) => {
    setBusy(true);
    setMsg(games ? 'Pulling the season summary and all 32 game logs from MoneyPuck…' : 'Pulling the season summary from MoneyPuck…');
    try {
      const res = await fetch(`/api/nhl/data/moneypuck${games ? '?games=1' : ''}`, { method: 'POST' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setMsg(`Done: ${j.result.teams} teams${j.result.gameRows != null ? `, ${j.result.gameRows} game rows` : ''}${j.result.failed?.length ? `; failed: ${j.result.failed.join(', ')}` : ''}.`);
      await load();
    } catch (e) {
      setMsg(`MoneyPuck refresh failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const teams = mp?.teams?.situations?.[sit] || {};
  const ranks = mp?.teams?.ranks?.[sit] || {};
  const n = mp?.teams?.teams || 32;
  const rows = Object.entries(teams).sort((a, b) => (ranks[a[0]]?.[sort] || 99) - (ranks[b[0]]?.[sort] || 99));
  return (
    <div className="nhlx-mp">
      <div className="nhlx-mu-top-head" style={{ marginTop: 36 }}>
        <div>
          <h3>Team metrics · MoneyPuck</h3>
          <p className="nhlx-auto-meta">{mp?.teams ? `${mp.teams.year}-${String(mp.teams.year + 1).slice(2)} · updated ${new Date(mp.teams.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not loaded yet.'} · click a column to sort · data from MoneyPuck.com</p>
        </div>
        <div className="nhlx-auto-actions">
          <select className="nhlx-input nhlx-input-sm" value={sit} onChange={(e) => setSit(e.target.value)} aria-label="Situation">
            {Object.entries(SIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={() => refresh(false)}>Refresh</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={() => refresh(true)} title="Also rebuilds home/away splits from every team's game log (slower)">Refresh with home/away</button>
        </div>
      </div>
      {msg && <p className="nhlx-auto-msg" role="status">{msg}</p>}
      {rows.length ? (
        <div className="nhlx-db-table-wrap">
          <table className="nhlx-db-table nhlx-mp-table">
            <thead>
              <tr><th>Team</th><th>GP</th>{MP_COLS.map(([k, l]) => <th key={k} className={sort === k ? 'is-sorted' : ''} onClick={() => setSort(k)} style={{ cursor: 'pointer' }}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(([abbr, t]) => (
                <tr key={abbr}>
                  <td><div className="nhlx-db-player"><TeamLogo abbr={abbr} size={24} /><span><b>{abbr}</b></span></div></td>
                  <td>{t.gp}</td>
                  {MP_COLS.map(([k, , d]) => <MpCell key={k} v={t[k]} d={d} rank={ranks[abbr]?.[k]} n={n} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="nhlx-empty">No MoneyPuck data stored yet. Click Refresh (Render can reach moneypuck.com; it runs with the morning refresh too).</div>}
    </div>
  );
}
