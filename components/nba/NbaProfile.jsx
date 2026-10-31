'use client';

import { WORD } from '@/lib/nba/profile';

// The game profile at the top of an opened NBA game, the firsthalfscore.com layout (Vincent, 2026-10-30): one row
// per aspect, the two teams side by side, each cell a rating word (Elite · Strong · Average · Weak · Very weak, or
// the positions a defense leaks to) with the figures under it. Data: `profile` on the board game (lib/nba/profile.js).
const TONE = { very: 'is-up is-very', strong: 'is-up', average: '', weak: 'is-down', veryWeak: 'is-down is-very' };

function Cell({ c }) {
  if (!c) return <td className="ir-prof-cell"><span className="ir-prof-word">—</span></td>;
  return (
    <td className="ir-prof-cell">
      <span className={`ir-prof-word ${TONE[c.level] || ''}`}>{c.word || WORD[c.level] || '—'}</span>
      <small>{c.text}</small>
    </td>
  );
}

export default function GameProfile({ g, sport }) {
  const p = g.profile;
  if (!p) return null;
  const exp = (team) => g.sides?.[team]?.teamProj?.pts;
  const total = p.teams.every((t) => exp(t) != null) ? Math.round(p.teams.reduce((s, t) => s + exp(t), 0)) : null;
  return (
    <div className="ir-prof">
      <div className="nhlx-pfd-head">
        <b>Game profile</b>
        {total != null ? <span className="nhlx-edge" title="Each side's expected points tonight: its own per-game figure through the opponent's environment (PropFinder)">{total} points expected · {p.teams.map((t) => `${t} ${Math.round(exp(t))}`).join(' · ')}</span> : null}
        <small className="nhlx-auto-meta">PropFinder’s team rows ranked over the league, what each defense gives up by position with the cheat sheet’s tiles, the sheet’s named players · hover a row’s label for what it reads</small>
      </div>
      <div className="nhlx-pfd-wrap">
        <table className="nhlx-pfd-table ir-prof-table">
          <thead>
            <tr>
              <th />
              {p.teams.map((t) => (
                <th key={t} className="ir-prof-team">
                  <img src={sport.teamLogo(t)} alt="" width="22" height="22" loading="lazy" />
                  <b>{sport.teamName(t)}</b>
                  <small className="nhlx-auto-meta">{t === g.home ? 'home' : 'away'}{g.sides?.[t]?.out?.length ? ` · ${g.sides[t].out.length} out` : ''}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" title={r.hover}>{r.label}</th>
                {p.teams.map((t) => <Cell key={t} c={p.cells[t]?.[r.key] || null} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
