'use client';

import { useState } from 'react';
import { WORD } from '@/lib/nba/profile';

// The game profile at the top of an opened NBA game, the firsthalfscore.com layout (Vincent, 2026-10-30): the two
// teams side by side, each cell a rating word (Elite · Strong · Average · Weak · Very weak, or the positions a defense
// leaks to) with one short figure beside it, the full reading on the hover. Two views of five rows (Vincent,
// 2026-10-31: "I need only 5 rows. Maybe add an offense / defense toggle"), one setting for the slate.
// Data: `profile` on the board game (lib/nba/profile.js).
const TONE = { very: 'is-up is-very', strong: 'is-up', average: '', weak: 'is-down', veryWeak: 'is-down is-very' };

function Cell({ c }) {
  if (!c) return <td className="ir-prof-cell"><span className="ir-prof-word">—</span></td>;
  return (
    <td className="ir-prof-cell" title={c.text}>
      <span className={`ir-prof-word ${TONE[c.level] || ''}`}>{c.word || WORD[c.level] || '—'}</span>
      {c.short ? <small>{c.short}</small> : null}
    </td>
  );
}

export default function GameProfile({ g, sport, initial = null, view: viewProp = null, onView = null }) {
  const p = g.profile;
  // The view is the board's when it passes one (one setting for every game on the page), else the card's own.
  const [viewOwn, setViewOwn] = useState(initial || 'offense');
  const view = viewProp ?? viewOwn;
  if (!p || (!p.groups?.length && !p.script)) return null;
  const group = p.groups.find((x) => x.key === view) || p.groups[0] || null;
  // The game script: green when the pace and the total point to more of everything, red when both point to less.
  const sc = p.script;
  const up = (sc?.pace?.word === 'Fast' ? 1 : sc?.pace?.word === 'Slow' ? -1 : 0) + (sc?.total?.word === 'High' ? 1 : sc?.total?.word === 'Low' ? -1 : 0);
  const pick = (k) => { if (onView) onView(k); else setViewOwn(k); };
  const exp = (team) => g.sides?.[team]?.teamProj?.pts;
  const total = p.teams.every((t) => exp(t) != null) ? Math.round(p.teams.reduce((s, t) => s + exp(t), 0)) : null;
  return (
    <div className="ir-prof">
      <div className="ir-prof-head">
        {group ? (
          <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Profile view">
            {p.groups.map((x) => <button key={x.key} type="button" role="tab" aria-selected={x.key === group.key} className={`nhlx-tab${x.key === group.key ? ' is-active' : ''}`} onClick={() => pick(x.key)}>{x.label}</button>)}
          </div>
        ) : null}
        {sc?.word ? <span className={`nhlx-edge ir-prof-script${up > 0 ? ' is-up' : up < 0 ? ' is-down' : ''}`} title={sc.text}><b>{sc.word}</b>{sc.pace ? ` · ${sc.pace.game} possessions` : ''}{sc.total ? ` · total ${sc.total.line}` : ''}{sc.spread ? ` · ${sc.spread}` : ''}</span> : null}
        {total != null ? <span className="nhlx-edge" title="Each side's expected points tonight: its own per-game figure through the opponent's environment (PropFinder)">{total} points expected · {p.teams.map((t) => `${t} ${Math.round(exp(t))}`).join(' · ')}</span> : null}
      </div>
      {group ? (
        <div className="nhlx-pfd-wrap">
          <table className="nhlx-pfd-table ir-prof-table">
            <thead>
              <tr>
                <th />
                {p.teams.map((t) => (
                  <th key={t} className="ir-prof-team">
                    <img src={sport.teamLogo(t)} alt="" width="20" height="20" loading="lazy" />
                    <b>{sport.teamName(t)}</b>
                    <small className="nhlx-auto-meta">{t === g.home ? 'home' : 'away'}{g.sides?.[t]?.out?.length ? ` · ${g.sides[t].out.length} out` : ''}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" title={r.hover}>{r.label}</th>
                  {p.teams.map((t) => <Cell key={t} c={p.cells[t]?.[r.key] || null} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
