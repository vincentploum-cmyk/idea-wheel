'use client';

import { useCallback, useEffect, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';

const LEADER_TABS = [['points', 'Points'], ['goals', 'Goals'], ['assists', 'Assists'], ['shots', 'Shots']];

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Standings({ conferences }) {
  if (!conferences.length) return <div className="nhlx-empty">No standings stored yet. Click “Refresh from the NHL”.</div>;
  return (
    <div className="nhlx-lg-confs">
      {conferences.map((c) => (
        <div key={c.name} className="nhlx-lg-conf">
          <h3 className="nhlx-db-h3">{c.name}</h3>
          {c.divisions.map((d) => (
            <div key={d.name} className="nhlx-db-table-wrap nhlx-lg-div">
              <table className="nhlx-db-table nhlx-lg-table">
                <thead>
                  <tr><th>{d.name}</th><th>GP</th><th>W</th><th>L</th><th>OTL</th><th>PTS</th><th>P%</th><th>GF</th><th>GA</th><th>DIFF</th><th>Home</th><th>Road</th><th>L10</th><th>Strk</th></tr>
                </thead>
                <tbody>
                  {d.teams.map((t) => (
                    <tr key={t.abbrev}>
                      <td><div className="nhlx-db-player"><TeamLogo abbr={t.abbrev} size={26} /><span><b>{t.name}</b><small>{t.divisionRank ? `#${t.divisionRank} · ` : ''}{t.abbrev}</small></span></div></td>
                      <td>{t.gp}</td><td>{t.w}</td><td>{t.l}</td><td>{t.otl}</td><td><b>{t.pts}</b></td><td>{t.pct.toFixed(3)}</td>
                      <td>{t.gf}</td><td>{t.ga}</td><td className={t.diff > 0 ? 'is-pos' : t.diff < 0 ? 'is-neg' : ''}>{t.diff > 0 ? `+${t.diff}` : t.diff}</td>
                      <td>{t.home}</td><td>{t.road}</td><td>{t.l10}</td><td>{t.streak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Leaders({ leaders, tab }) {
  const open = usePlayerCard();
  const list = leaders[tab] || [];
  if (!list.length) return <p className="nhlx-auto-meta">{tab === 'shots' ? 'Shot leaders appear once games are stored for this season.' : 'No leaders stored yet.'}</p>;
  const isShots = tab === 'shots';
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-lg-leaders">
        <thead>
          <tr><th>#</th><th>Player</th><th>Team</th><th>Pos</th>{isShots ? <><th>GP</th><th>SOG</th><th>SOG/G</th><th>G</th></> : <th>{LEADER_TABS.find(([k]) => k === tab)[1]}</th>}</tr>
        </thead>
        <tbody>
          {list.map((p, i) => (
            <tr key={p.id}>
              <td>{i + 1}</td>
              <td><div className="nhlx-db-player is-click" onClick={() => open({ id: p.id })}><Headshot id={p.id} size={32} /><span><b>{p.name}</b></span></div></td>
              <td><div className="nhlx-db-player"><TeamLogo abbr={p.team} size={22} /><span>{p.team}</span></div></td>
              <td>{p.pos}</td>
              {isShots ? <><td>{p.gp}</td><td><b>{p.sog}</b></td><td>{p.sogPerGame.toFixed(2)}</td><td>{p.g}</td></> : <td><b>{p.value}</b></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeaguePanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('points');

  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/nhl/data/league${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setErr('');
    } catch (e) {
      setErr(`Couldn’t load the league tables: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="nhlx-empty">{err || 'Loading standings…'}</div>;

  return (
    <div className="nhlx-lg">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">Standings</div>
          <div className="nhlx-auto-sub">From the NHL · updated {fmt(data.updatedAt)}{data.refreshed?.error ? ` · refresh failed: ${data.refreshed.error}` : ''}</div>
        </div>
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={() => load(true)}>Refresh from the NHL</button>
      </div>
      {err && <div className="nhlx-alert">⚠ {err}</div>}
      <Standings conferences={data.conferences} />

      <div className="nhlx-mu-top-head" style={{ marginTop: 36 }}>
        <h3>Top scorers</h3>
        <div className="nhlx-tabs" role="tablist">
          {LEADER_TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`nhlx-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <Leaders leaders={data.leaders} tab={tab} />
    </div>
  );
}
