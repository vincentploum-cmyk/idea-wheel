'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from './SportNav';

const NHL_TABS = ['teams', 'matchups', 'defense', 'firstgoal', 'model', 'league', 'history'];

const fmtKick = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '');

const TILES = [
  {
    key: 'nfl', code: 'NFL', title: 'NFL picks',
    body: 'The best plays in every game of the week, in four tables: touchdowns, passing, rushing and receiving. The two cheat sheets you upload plus PropFinder’s logs and lines, graded against the box score.',
    status: (s) => {
      const n = s?.nfl; if (!n || n.error) return n?.error ? `Schedule unavailable: ${n.error}` : 'Loading…';
      const parts = [n.label, n.games != null ? `${n.games} games` : 'schedule not fetched yet'];
      if (n.finals) parts.push(`${n.finals} final`);
      parts.push(n.sheets ? `${n.sheets} cheat sheet${n.sheets === 1 ? '' : 's'}` : 'no cheat sheet yet');
      parts.push(n.propfinder ? 'PropFinder pulled' : 'PropFinder not pulled');
      if (n.nextKickoff) parts.push(`next kickoff ${fmtKick(n.nextKickoff)}`);
      return parts.join(' · ');
    },
  },
  {
    key: 'nhl', code: 'NHL', title: 'NHL picks',
    body: 'Model 3.0: tonight’s best shots and goal plays, the matchups by position, what every defense gives up, first-goal candidates and the scorecard. Everything you had, unchanged.',
    status: (s) => {
      const n = s?.nhl; if (!n) return 'Loading…';
      if (!n.games) return 'No games tonight';
      return `Tonight: ${n.games} game${n.games === 1 ? '' : 's'}${n.lineups ? ` · ${n.lineups} with lineups` : ''}`;
    },
  },
  {
    key: 'nba', code: 'NBA', title: 'NBA picks',
    body: 'Tonight’s best plays in every game, in five tables: points, rebounds, assists, threes and the combos. The cheat sheets you upload plus PropFinder’s logs and lines, graded against the box score.',
    status: (s) => {
      const n = s?.nba; if (!n || n.error) return n?.error ? `Schedule unavailable: ${n.error}` : 'Loading…';
      if (n.games === null) return 'Tonight: schedule not fetched yet';
      if (!n.games) return 'No games tonight';
      const parts = [`Tonight: ${n.games} game${n.games === 1 ? '' : 's'}`];
      if (n.finals) parts.push(`${n.finals} final`);
      parts.push(n.sheets ? `${n.sheets} cheat sheet${n.sheets === 1 ? '' : 's'}` : 'no cheat sheet yet');
      parts.push(n.propfinder ? 'PropFinder pulled' : 'PropFinder not pulled');
      if (n.nextStart) parts.push(`next tip ${fmtKick(n.nextStart)}`);
      return parts.join(' · ');
    },
  },
];

export default function Start({ email }) {
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  // Links saved before the start screen existed (ideareels.io/#teams/BUF, /#matchups) open the NHL app.
  useEffect(() => {
    const key = window.location.hash.slice(1).split('/')[0];
    if (NHL_TABS.includes(key)) window.location.replace(`/nhl${window.location.hash}`);
  }, []);

  useEffect(() => {
    fetch('/api/site/status', { cache: 'no-store' })
      .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); setStatus(j); })
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <SiteHeader nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main className="ir-start">
        <div className="nhlx-wrap">
          <span className="nhlx-eyebrow">{status?.date ? new Date(`${status.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : 'Today'}</span>
          <h1 className="ir-start-h1">Pick a <span>sport</span></h1>
          {err ? <p className="nhlx-auto-sub">Status unavailable: {err}</p> : null}
          <div className="ir-tiles">
            {TILES.map((t) => (
              <Link key={t.key} href={`/${t.key}`} className="ir-tile">
                <span className="ir-tile-mark">{t.code}</span>
                <span className="ir-tile-body">
                  <span className="ir-tile-title">{t.title}</span>
                  <span className="ir-tile-status">{t.status(status)}</span>
                  <span className="ir-tile-copy">{t.body}</span>
                </span>
                <span className="ir-tile-arrow" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>ideareels · NFL, NHL and NBA picks</span>
          <span>Private tool · access by invitation</span>
        </div>
      </footer>
    </>
  );
}
