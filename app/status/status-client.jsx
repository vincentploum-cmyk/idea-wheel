'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function StatusPill({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '4px 12px', borderRadius: 999,
      border: '2px solid #111',
      background: ok === null ? '#f3f4f6' : ok ? '#DCFCE7' : '#FEE2E2',
      color: '#111', fontWeight: 900, fontSize: 13,
    }}>
      <span aria-hidden="true" style={{
        width: 10, height: 10, borderRadius: '50%',
        background: ok === null ? '#9ca3af' : ok ? '#16a34a' : '#dc2626',
      }} />
      {label}
    </span>
  );
}

export default function StatusClient() {
  const [state, setState] = useState({ loading: true, error: null, health: null });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const body = await res.json();
        if (alive) setState({ loading: false, error: null, health: { httpStatus: res.status, ...body } });
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message, health: null });
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const overallOk = state.health?.ok ?? null;
  const dbOk = state.health?.db?.ok ?? null;
  const dbMs = state.health?.db?.ms ?? null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>
      <div className="fn__bold_item" style={{ padding: '24px 26px' }}>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, marginBottom: 16 }}>
          Overall
        </h2>
        <StatusPill ok={overallOk} label={
          state.loading ? 'Checking…' : overallOk ? 'All systems operational' : 'Degraded'
        } />
      </div>

      <div className="fn__bold_item" style={{ padding: '24px 26px', marginTop: 16 }}>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, marginBottom: 16 }}>
          Components
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <StatusPill ok={overallOk} label="Web app" />
            <span style={{ fontSize: 13, opacity: 0.65 }}>Serving requests</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <StatusPill ok={dbOk} label="Database" />
            <span style={{ fontSize: 13, opacity: 0.65 }}>
              {dbMs != null ? `${dbMs} ms round-trip` : 'Waiting for check'}
            </span>
          </li>
        </ul>
        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.5 }}>
          AI (OpenAI) and payments (Stripe) status is not shown here — check
          their status pages directly if a feature is misbehaving.
        </p>
      </div>

      <div className="fn__bold_item" style={{ padding: '24px 26px', marginTop: 16 }}>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, marginBottom: 12 }}>
          Details
        </h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13, margin: 0 }}>
          <dt style={{ fontWeight: 700 }}>HTTP</dt><dd style={{ margin: 0 }}>{state.health?.httpStatus ?? '—'}</dd>
          <dt style={{ fontWeight: 700 }}>Commit</dt><dd style={{ margin: 0, fontFamily: 'monospace' }}>{state.health?.commit || '—'}</dd>
          <dt style={{ fontWeight: 700 }}>Checked at</dt><dd style={{ margin: 0 }}>{state.health?.ts ? new Date(state.health.ts).toLocaleString() : '—'}</dd>
          <dt style={{ fontWeight: 700 }}>Raw</dt><dd style={{ margin: 0 }}>
            <Link href="/api/health" style={{ textDecoration: 'underline' }}>/api/health</Link>
          </dd>
        </dl>
      </div>

      <p style={{ fontSize: 12, opacity: 0.5, marginTop: 24 }}>
        Something broken not shown here? <a href="mailto:hello@ideareels.io" style={{ textDecoration: 'underline' }}>hello@ideareels.io</a>.
      </p>
    </div>
  );
}
