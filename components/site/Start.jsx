'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from './SportNav';
import { teamLogo as nflLogo } from '@/lib/nfl/teams';
import { teamLogo as nbaLogo } from '@/lib/nba/teams';
import { logoUrl as nhlLogo } from '@/components/nhl/media';

const NHL_TABS = ['teams', 'matchups', 'defense', 'firstgoal', 'model', 'league', 'history'];
const SHOW = 5;

const fmtWhen = (iso, withDay) => (iso ? new Date(iso).toLocaleString(undefined, withDay ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' }) : '');

/** One game line: the two logos, the score when played, the start time before, the tally once graded. */
function GameRow({ g, logo, withDay }) {
  const score = g.awayScore != null && g.homeScore != null ? ` ${g.awayScore}–${g.homeScore}` : '';
  const when = g.final ? `Final${score}` : g.state === 'in' ? `Live${score}` : fmtWhen(g.date, withDay) || 'tonight';
  const tally = g.tally?.of ? `${g.tally.hit}/${g.tally.of}` : g.plays ? `${g.plays} play${g.plays === 1 ? '' : 's'}` : g.lineups ? 'lines in' : '';
  return (
    <li className={`ir-game${g.final ? ' is-final' : ''}${g.state === 'in' ? ' is-live' : ''}`}>
      <span className="ir-game-teams">
        <img src={logo(g.away)} alt="" width="22" height="22" loading="lazy" /><b>{g.away}</b>
        <i>@</i>
        <img src={logo(g.home)} alt="" width="22" height="22" loading="lazy" /><b>{g.home}</b>
      </span>
      <span className="ir-game-when">{when}</span>
      <span className={`ir-game-tally${g.tally?.of ? (g.tally.hit * 2 >= g.tally.of ? ' is-good' : ' is-bad') : ''}`}>{tally}</span>
    </li>
  );
}

function Stat({ n, label, tone = '' }) {
  return <span className={`ir-stat${tone ? ` is-${tone}` : ''}`}><b>{n}</b><small>{label}</small></span>;
}

const PANELS = [
  {
    key: 'nfl', code: 'NFL', title: 'NFL picks', logo: nflLogo, withDay: true,
    copy: 'Touchdowns, passing, rushing and receiving: the week’s best plays per game from your cheat sheets and PropFinder’s logs and lines.',
    sub: (s) => (s?.label ? `${s.label} · ${s.week?.season ?? ''}` : 'This week'),
    stats: (s) => [[s.games.length, 'games'], [s.plays, 'plays'], s.graded ? [`${s.hits}/${s.graded}`, 'hit', s.hits * 2 >= s.graded ? 'good' : 'bad'] : [s.finals, 'final'], [s.sheets, s.sheets === 1 ? 'sheet' : 'sheets']],
    foot: (s) => `${s.propfinder ? 'PropFinder pulled' : 'PropFinder not pulled yet'}${s.nextStart ? ` · next kickoff ${fmtWhen(s.nextStart, true)}` : ''}`,
  },
  {
    key: 'nba', code: 'NBA', title: 'NBA picks', logo: nbaLogo, withDay: false,
    copy: 'Points, rebounds, assists, threes and the combos: tonight’s best plays per game from your cheat sheets and PropFinder’s logs and lines.',
    sub: () => 'Tonight',
    stats: (s) => [[s.games.length, 'games'], [s.plays, 'plays'], s.graded ? [`${s.hits}/${s.graded}`, 'hit', s.hits * 2 >= s.graded ? 'good' : 'bad'] : [s.finals, 'final'], [s.sheets, s.sheets === 1 ? 'sheet' : 'sheets']],
    foot: (s) => `${s.propfinder ? 'PropFinder pulled' : 'PropFinder not pulled yet'}${s.nextStart ? ` · first tip ${fmtWhen(s.nextStart)}` : ''}`,
  },
  {
    key: 'nhl', code: 'NHL', title: 'NHL picks', logo: nhlLogo, withDay: false,
    copy: 'Model 3.0: tonight’s best shots and goal plays, the matchups by position, what every defense gives up, first-goal candidates and the scorecard.',
    sub: () => 'Tonight',
    stats: (s) => [[s.games.length, 'games'], [`${s.lineups}/${s.games.length || 0}`, 'lineups', s.games.length && s.lineups === s.games.length ? 'good' : ''], [s.finals, 'final']],
    foot: (s) => `${s.refreshedAt ? `Data refreshed ${fmtWhen(s.refreshedAt, true)}` : 'Data not refreshed today'}${s.nextStart ? ` · first puck ${fmtWhen(s.nextStart)}` : ''}`,
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

  const day = status?.date ? new Date(`${status.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <>
      <SiteHeader nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main className="ir-start">
        <section className="ir-start-hero">
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">{day || 'Today'}</span>
            <h1>Pick a <span>sport</span></h1>
            <p>Three boards, one standard: the best plays in every game, each with its chance and its price, graded against the box score.</p>
          </div>
        </section>
        <section className="ir-start-body">
          <div className="nhlx-wrap">
            {err ? <div className="nhlx-alert">Status unavailable: {err}</div> : null}
            <div className="ir-panels">
              {PANELS.map((p) => {
                const s = status?.[p.key];
                const ready = s && !s.error;
                const games = ready ? s.games : [];
                return (
                  <Link key={p.key} href={`/${p.key}`} className="ir-panel" aria-label={`Open ${p.title}`}>
                    <span className="ir-panel-head">
                      <span className="ir-panel-mark">{p.code}</span>
                      <span className="ir-panel-title"><b>{p.title}</b><small>{ready ? p.sub(s) : status ? 'Unavailable' : 'Loading…'}</small></span>
                      <span className="ir-panel-arrow" aria-hidden>→</span>
                    </span>
                    {ready ? (
                      <>
                        <span className="ir-stats">{p.stats(s).map(([n, label, tone]) => <Stat key={label} n={n} label={label} tone={tone} />)}</span>
                        {games.length ? (
                          <ul className="ir-games">
                            {games.slice(0, SHOW).map((g) => <GameRow key={g.id} g={g} logo={p.logo} withDay={p.withDay} />)}
                            {games.length > SHOW ? <li className="ir-game-more">+ {games.length - SHOW} more game{games.length - SHOW === 1 ? '' : 's'}</li> : null}
                          </ul>
                        ) : <span className="ir-games-none">No games on the slate.</span>}
                        <span className="ir-panel-foot">{p.foot(s)}</span>
                      </>
                    ) : <span className="ir-games-none">{s?.error ? `Schedule unavailable: ${s.error}` : 'Loading the slate…'}</span>}
                    <span className="ir-panel-copy">{p.copy}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>ideareels · NFL, NBA and NHL picks</span>
          <span>Private tool · access by invitation</span>
        </div>
      </footer>
    </>
  );
}
