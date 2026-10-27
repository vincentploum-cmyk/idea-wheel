'use client';

import { TeamLink } from './links';
import { LEVEL_TEXT } from '@/lib/nhl-data/characteristics';

// A team's characteristics the way WhoScored draws a club's: strengths and weaknesses as traits
// with a badge, then the style of play as plain traits. Every line carries its numbers in the
// hover (`detail`), never in the text. Data: `characteristics[team]` on a slate game
// (lib/nhl-data/characteristics.js).

// 14-unit glyphs in the current colour: a stick for the attack, a shield for the defense, a stopwatch for the tempo.
const ICON = {
  attack: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 1.5 6 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /><path d="M6.6 9.8 3.3 13.2a1.6 1.6 0 0 1-2.3-2.3L4.4 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none" /><circle cx="12.8" cy="12.6" r="1.6" fill="currentColor" /></svg>,
  defense: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 2.5 3.6v4.2c0 3.3 2.3 5.6 5.5 6.7 3.2-1.1 5.5-3.4 5.5-6.7V3.6L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" /></svg>,
  tempo: <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M8 6v3.2l2.2 1.3M6.3 1.5h3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>,
};
const LEVEL_TONE = { very: 'is-soft is-very', strong: 'is-soft', weak: 'is-tough', veryWeak: 'is-tough is-very' };

function Row({ x, badge = false }) {
  return (
    <li className="nhlx-char-row" title={x.detail || undefined}>
      <i className={`nhlx-char-icon is-${x.kind}`} aria-hidden="true">{ICON[x.kind] || ICON.attack}</i>
      <span>{x.text}</span>
      {badge && x.level ? <span className={`nhlx-edge nhlx-char-badge ${LEVEL_TONE[x.level] || ''}`}>{LEVEL_TEXT[x.level]}</span> : null}
    </li>
  );
}

/** One team: strengths and weaknesses side by side, the style of play under them. */
export function TeamCharacteristics({ c, headline = null, tone = '' }) {
  return (
    <div className="nhlx-char-team">
      <div className="nhlx-mu-verdict-head">
        <TeamLink abbr={c.team} logo={22}><b>{c.team}</b></TeamLink>
        <small>{c.venue === 'H' ? 'home' : 'away'}</small>
        {headline ? <span className={`nhlx-edge ${tone}`}>{headline}</span> : null}
      </div>
      <div className="nhlx-char-cols">
        <section aria-label={`${c.team} strengths`}>
          <h5><i className="is-plus">+</i> Strengths</h5>
          {c.strengths.length ? <ul>{c.strengths.map((x) => <Row key={x.key} x={x} badge />)}</ul> : <p className="nhlx-auto-meta">Nothing stands out</p>}
        </section>
        <section aria-label={`${c.team} weaknesses`}>
          <h5><i className="is-minus">−</i> Weaknesses</h5>
          {c.weaknesses.length ? <ul>{c.weaknesses.map((x) => <Row key={x.key} x={x} badge />)}</ul> : <p className="nhlx-auto-meta">Nothing stands out</p>}
        </section>
      </div>
      <section aria-label={`${c.team} style of play`}>
        <h5>Style of play</h5>
        {c.style.length ? <ul>{c.style.map((x) => <Row key={x.key} x={x} />)}</ul> : <p className="nhlx-auto-meta">Nothing stands out yet</p>}
      </section>
    </div>
  );
}

/** Both teams of a slate game, away then home, with the game-total pill on the head. */
export function GameCharacteristics({ game }) {
  const total = game.total;
  const tone = total?.tier === 'high' ? 'is-soft' : total?.tier === 'low' ? 'is-tough' : '';
  return (
    <div className="nhlx-char">
      <div className="nhlx-char-head">
        <b>Characteristics</b>
        {total ? <span className={`nhlx-edge ${tone}`} title={total.lines?.map((l) => l.text).join('\n')}>{total.headline}</span> : null}
        <small>hover a line for the numbers</small>
      </div>
      <div className="nhlx-char-grid">
        {[game.away, game.home].map((team) => {
          const c = game.characteristics?.[team];
          const v = game.verdicts?.[team];
          return c
            ? <TeamCharacteristics key={team} c={c} headline={v?.headline || null} tone={v?.tier === 'leaky' ? 'is-soft' : v?.tier === 'tight' ? 'is-tough' : ''} />
            : <div key={team} className="nhlx-char-team"><div className="nhlx-mu-verdict-head"><TeamLink abbr={team} logo={22}><b>{team}</b></TeamLink><small>No read yet</small></div></div>;
        })}
      </div>
    </div>
  );
}
