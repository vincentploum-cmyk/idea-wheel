'use client';

import { useEffect } from 'react';
import { teamLogo, teamName } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';
import { passText } from '@/lib/nfl/projections';

// One NFL player from the week's projections (lib/nfl/projections.js `board.projections.rows`), opened from the head's
// search (Vincent, 2026-11-01: "I should be able to search on players for both nba and nfl"): his touchdown chances
// (anytime, first half, first TD, 2+), every yards market with his projection, his floor–ceiling and the strong / lean /
// thin marks, the matchup the projection reads (PropFinder's rank at his spot, the factor on his rate), and his big-game
// chances; graded once the game is in. The NBA opens its full player card instead.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const MARKETS = [['pass_yds', 'Passing yards', 'yds'], ['rush_yds', 'Rushing yards', 'yds'], ['rec_yds', 'Receiving yards', 'yds'], ['receptions', 'Receptions', 'rec']];
const TIERS = [['strong', 'Strong'], ['lean', 'Lean'], ['thin', 'Thin']];
const third = (rank, count) => (!rank || !count ? '' : rank <= Math.ceil(count / 3) ? 'is-soft' : rank > count - Math.ceil(count / 3) ? 'is-tough' : '');

function Spot({ s }) {
  if (!s?.rank) return <small className="nhlx-auto-meta">no table</small>;
  return <span className={`ir-bd-rk ${third(s.rank, s.count)}`} title={`The opponent gives up ${s.value != null ? `${s.value} a game ` : ''}to ${s.pos}s, #${s.rank} of ${s.count} (1 = the most): PropFinder's table with the cheat sheet's tile blended`}>{s.pos} #{s.rank}</span>;
}

export default function NflPlayer({ row: r, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!r) return null;
  const t = r.td;
  const markets = MARKETS.filter(([m]) => r.yards?.[m]);
  const big = Object.entries(r.big || {});
  return (
    <div className="nhlx-modal" role="dialog" aria-modal="true" aria-label={r.player} onClick={onClose}>
      <div className="nhlx-modal-card ir-np" onClick={(e) => e.stopPropagation()}>
        <div className="ir-np-head">
          <button type="button" className="nhlx-pc-back" onClick={onClose} aria-label="Close">←</button>
          {r.espnId ? <img src={headshotUrl(r.espnId)} alt="" width="52" height="52" className="ir-np-face" /> : <img src={teamLogo(r.team)} alt="" width="52" height="52" />}
          <div>
            <h3>{r.player}{r.onSheet ? <small className="ir-sh-check" title="On the cheat sheet"> ✓</small> : null}</h3>
            <small className="nhlx-auto-meta">{r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos} · {teamName(r.team)} {r.venue === 'H' ? 'vs' : 'at'} {r.opp}{r.health && r.health !== 'In' ? ` · ${r.injury || r.health}` : ''}{(r.role || []).map((x) => ` · ${x.word}`).join('')}</small>
          </div>
        </div>
        <div className="ir-np-body">
          {t ? (
            <section className="ir-np-sec">
              <h4>Touchdowns <small className="nhlx-auto-meta">{t.lambda != null ? `${Number(t.lambda).toFixed(2)} expected` : ''}{t.spot?.rank ? <> · <Spot s={t.spot} /></> : null}</small></h4>
              <div className="ir-np-tds">
                {[['p', 'Anytime'], ['p1h', '1st half'], ['pFirst', 'First TD'], ['p2', '2+ TDs']].map(([k, l]) => <span key={k} className="ir-np-td"><small>{l}</small><b>{pct(t[k])}</b></span>)}
                {r.final && t.actual != null ? <span className="ir-np-td"><small>Got</small><b>{t.actual} TD</b></span> : null}
              </div>
            </section>
          ) : null}
          {markets.map(([m, label, unit]) => {
            const y = r.yards[m];
            return (
              <section key={m} className="ir-np-sec">
                <h4>{label} <small className="nhlx-auto-meta">proj <b>{m === 'receptions' ? Number(y.proj).toFixed(1) : Math.round(y.proj)}</b>{y.floor != null ? ` · ${y.floor}–${y.ceiling} most nights` : ''}{y.line != null ? ` · the book’s line ${y.line}` : ''} · <Spot s={y.spot} />{y.matchup != null && y.matchup !== 1 ? ` · ×${Number(y.matchup).toFixed(2)} on his rate` : ''}</small></h4>
                {y.pass ? <p className="nhlx-auto-meta">{passText(y.pass)}</p> : null}
                <div className="ir-np-tiers">
                  {TIERS.map(([k, l]) => { const x = y.tiers?.[k]; const hit = y.actual == null || !x ? '' : y.actual >= x.mark ? ' is-hit' : ' is-miss'; return <span key={k} className={`ir-bd-mark is-${k}${hit}`}>{x ? `${x.mark}+ ${unit}` : '—'}<small>{l.toLowerCase()}{x ? ` ${pct(x.p)}` : ''}</small></span>; })}
                  {y.actual != null ? <span className="nhlx-auto-meta">got <b>{y.actual}</b></span> : null}
                </div>
              </section>
            );
          })}
          {big.length ? (
            <section className="ir-np-sec">
              <h4>Big games</h4>
              <div className="ir-np-tiers">{big.map(([m, b]) => b.marks.map((mk) => <span key={`${m}|${mk}`} className="ir-bd-mark"><b>{mk}+</b><small>{(MARKETS.find(([x]) => x === m) || [, m])[1].toLowerCase()} {pct(b.p[mk])}</small></span>))}</div>
            </section>
          ) : null}
          {!t && !markets.length ? <p className="nhlx-auto-meta">No projection for him this week.</p> : null}
        </div>
      </div>
    </div>
  );
}
