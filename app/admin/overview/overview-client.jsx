'use client';

import { useEffect, useState } from 'react';

/**
 * Owner ops dashboard. Bearer SEED_SECRET — Vincent pastes the key once,
 * it lives in sessionStorage until the tab closes.
 */

const STORAGE_KEY = 'ir_admin_secret';

function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  if (typeof n === 'object' && 'count' in n) return fmtNum(n.count);
  if (typeof n === 'object' && 'error' in n) return `err`;
  return Number(n).toLocaleString();
}
function fmtMs(n) {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n).toLocaleString()} ms`;
}
function fmtUsd(n) {
  if (n === null || n === undefined) return '—';
  return `$${(Number(n) || 0).toFixed(2)}`;
}

const CARD = { border: '3px solid #111', boxShadow: '4px 4px 0 #111', padding: 20, background: '#fff' };
const H = { fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' };

export default function OverviewClient() {
  const [secret, setSecret] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) { setSecret(saved); load(saved); }
    } catch {}
  }, []);

  const load = async (key = secret) => {
    if (!key) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setErr('Wrong or missing key.');
        setData(null);
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        return;
      }
      if (!res.ok) {
        setErr(`Load failed (${res.status})`);
        return;
      }
      const body = await res.json();
      setData(body);
      try { sessionStorage.setItem(STORAGE_KEY, key); } catch {}
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!data && !loading) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 20 }}>
        <div style={CARD}>
          <h1 style={{ marginTop: 0 }}>Admin overview</h1>
          <p style={{ fontSize: 13, opacity: 0.65 }}>Paste SEED_SECRET to load. Not saved beyond this browser tab.</p>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="SEED_SECRET"
              style={{ flex: 1, border: '2px solid #111', padding: '8px 10px', borderRadius: 4, fontFamily: 'monospace' }}
              autoFocus
            />
            <button type="submit" style={{ background: '#FFE000', border: '2px solid #111', boxShadow: '2px 2px 0 #111', padding: '8px 16px', fontWeight: 900, cursor: 'pointer' }}>
              Load
            </button>
          </form>
          {err && <p role="alert" style={{ color: '#b91c1c', marginTop: 12, fontSize: 13 }}>{err}</p>}
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  }

  const stages = data?.latencyLast24h || {};
  const stageNames = ['validate', 'deep_research', 'build:designer', 'build:launch', 'build:infrastructure'];

  return (
    <div style={{ maxWidth: 1100, margin: '32px auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Admin overview</h1>
        <span style={{ fontSize: 12, opacity: 0.5 }}>{data?.generatedAt}</span>
        <button
          onClick={() => load()}
          style={{ marginLeft: 'auto', border: '2px solid #111', background: '#fff', boxShadow: '2px 2px 0 #111', padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div style={CARD}>
          <h3 style={H}>Spins · 24h</h3>
          <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtNum(data?.counts?.spinsLast24h)}</div>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>7d: {fmtNum(data?.counts?.spinsLast7d)} · all-time: {fmtNum(data?.counts?.spinsAllTime)}</div>
        </div>
        <div style={CARD}>
          <h3 style={H}>Validations · 24h</h3>
          <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtNum(data?.counts?.validationsLast24h)}</div>
        </div>
        <div style={CARD}>
          <h3 style={H}>Blueprints · 24h</h3>
          <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtNum(data?.counts?.blueprintsLast24h)}</div>
        </div>
        <div style={CARD}>
          <h3 style={H}>Revenue · month-to-date</h3>
          <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtUsd(data?.revenue?.thisMonthDollars)}</div>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>{fmtNum(data?.revenue?.paidOrdersCount)} paid orders</div>
        </div>
        <div style={CARD}>
          <h3 style={H}>Errors · 24h</h3>
          <div style={{ fontSize: 32, fontWeight: 900, color: (data?.counts?.errorsLast24h?.count || 0) > 50 ? '#dc2626' : '#111' }}>
            {fmtNum(data?.counts?.errorsLast24h)}
          </div>
        </div>
        <div style={CARD}>
          <h3 style={H}>Contact messages · 7d</h3>
          <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtNum(data?.counts?.contactMessagesPending7d)}</div>
        </div>
      </div>

      <div style={{ ...CARD, marginTop: 20 }}>
        <h3 style={H}>Pipeline latency (last 24h)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #111' }}>
              <th style={{ padding: '8px 0' }}>Stage</th>
              <th style={{ padding: '8px 0' }}>Samples</th>
              <th style={{ padding: '8px 0' }}>p50</th>
              <th style={{ padding: '8px 0' }}>p95</th>
              <th style={{ padding: '8px 0' }}>Errors</th>
            </tr>
          </thead>
          <tbody>
            {stageNames.map((s) => (
              <tr key={s} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{s}</td>
                <td style={{ padding: '8px 0' }}>{fmtNum(stages[s]?.count)}</td>
                <td style={{ padding: '8px 0' }}>{fmtMs(stages[s]?.p50)}</td>
                <td style={{ padding: '8px 0' }}>{fmtMs(stages[s]?.p95)}</td>
                <td style={{ padding: '8px 0', color: (stages[s]?.errors || 0) > 0 ? '#dc2626' : '#111' }}>{fmtNum(stages[s]?.errors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...CARD, marginTop: 20 }}>
        <h3 style={H}>Errors by scope (24h)</h3>
        {Object.keys(data?.errorsByScope || {}).length === 0 ? (
          <p style={{ opacity: 0.5, margin: 0 }}>No errors 🎉</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {Object.entries(data.errorsByScope).sort((a, b) => b[1] - a[1]).map(([scope, n]) => (
                <tr key={scope} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{scope}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 12, opacity: 0.5, marginTop: 20 }}>
        Detailed error events: <a href="/api/admin/errors?hours=24" style={{ textDecoration: 'underline' }}>/api/admin/errors</a> ·
        Full latency: <a href="/api/admin/metrics?hours=24" style={{ textDecoration: 'underline' }}>/api/admin/metrics</a>
      </p>
    </div>
  );
}
