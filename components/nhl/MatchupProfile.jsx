'use client';

import { TeamLink } from './links';
import { ICON } from './Characteristics';

// The matchup profile under a game head on Matchups, drawn the way WhoScored draws a club's characteristics:
// the two teams side by side, each with its strengths and its weaknesses as short lines with a badge, only the
// extremes (Vincent, 2026-11-27: "average doesn't help me … steady for last 10 doesn't tell me anything. I only
// need the extremes", then WhoScored's Strengths / Weaknesses card as the format, without the style of play).
// Data: `profile` on a slate game (lib/nhl-data/matchup-profile.js; the NBA's and NFL's builders give the same
// shape): every row's cell carries a level, rank 1 = the best for the team on that read, so elite / strong (and a
// rising last ten) is a strength, weak / poor (and a falling one) a weakness; Average and Steady are left out.
// The full line and every source ride on the line's hover.

const VENUE = { H: 'home', A: 'away' };

/** The levels that say nothing either way. */
export const QUIET_LEVELS = ['average', 'steady'];
const GOOD = { elite: 2, strong: 1, rising: 1 };
const BAD = { poor: 2, weak: 1, falling: 1 };

// Each row's line as a strength and as a weakness, and its glyph. A row without an entry reads its label.
const PHRASES = {
  shooting: { kind: 'attack', good: 'Shooting a lot', bad: 'Shooting little' },
  allows: { kind: 'defense', good: 'Limiting the opponent', bad: 'Giving up a lot' },
  saves: { kind: 'defense', good: 'Goaltending', bad: 'Goaltending' },
  powerplay: { kind: 'attack', good: 'Power play', bad: 'Power play' },
  discipline: { kind: 'defense', good: 'Staying out of the box', bad: 'Taking penalties' },
  last10: { kind: 'tempo', good: 'Shooting more lately (last 10)', bad: 'Shooting less lately (last 10)' },
  scoring: { kind: 'attack', good: 'Scoring a lot', bad: 'Scoring little' },
  rebounding: { kind: 'attack', good: 'Rebounding', bad: 'Rebounding' },
  playmaking: { kind: 'attack', good: 'Playmaking', bad: 'Playmaking' },
  passing: { kind: 'attack', good: 'Passing game', bad: 'Passing game' },
  rushing: { kind: 'attack', good: 'Running game', bad: 'Running game' },
  endzone: { kind: 'attack', good: 'Finding the end zone', bad: 'Finding the end zone' },
  spots: { kind: 'defense', good: 'No soft spots', bad: 'Soft spots' },
};

/**
 * One team's strengths and weaknesses from the profile's rows: { strengths, weaknesses }, each a list of
 * { key, kind, text, short, word, very, title }, the most extreme first (then the row order).
 */
export function traitsOf(rows, team) {
  const strengths = []; const weaknesses = [];
  rows.forEach((row, i) => {
    const c = row.cells?.[team];
    if (!c?.level || QUIET_LEVELS.includes(c.level) || !c.word) return;
    const good = GOOD[c.level]; const bad = BAD[c.level];
    if (!good && !bad) return;
    const ph = PHRASES[row.key] || { kind: 'attack', good: row.label, bad: row.label };
    const x = { key: row.key, kind: ph.kind, text: good ? ph.good : ph.bad, short: c.short || null, word: c.word, very: (good || bad) === 2, title: [c.text, c.title].filter(Boolean).join(' · '), i };
    (good ? strengths : weaknesses).push(x);
  });
  const order = (a, b) => (b.very - a.very) || (a.i - b.i);
  return { strengths: strengths.sort(order), weaknesses: weaknesses.sort(order) };
}

function Trait({ x, tone }) {
  return (
    <li className="nhlx-char-row" title={x.title || undefined}>
      <i className={`nhlx-char-icon is-${x.kind}`} aria-hidden="true">{ICON[x.kind] || ICON.attack}</i>
      <span>{x.text}{x.short ? <small className="nhlx-prof-short">{x.short}</small> : null}</span>
      <span className={`nhlx-edge nhlx-char-badge ${tone}${x.very ? ' is-very' : ''}`}>{x.word}</span>
    </li>
  );
}

function TeamTraits({ head, rows, renderTeam }) {
  const team = head.team;
  const { strengths, weaknesses } = traitsOf(rows, team);
  const v = head.verdict;
  const spz = head.shotpropz;
  // The NHL head says where its boards stand; a profile that writes its own line (the NBA's) passes `sub`.
  const sub = head.sub ?? (spz
    ? `ShotPropz${spz.venueGames != null ? ` · ${spz.venueGames} ${VENUE[head.venue] || ''} game${spz.venueGames === 1 ? '' : 's'}` : ''}${spz.leadAt === 'all' ? ' (all games until four there)' : ''}${spz.updated ? ` · ${spz.updated}` : ''}`
    : head.games ? `${head.games} stored game${head.games === 1 ? '' : 's'} · no ShotPropz snapshot yet` : 'no ShotPropz snapshot yet');
  return (
    <div className="nhlx-char-team">
      <div className="nhlx-mu-verdict-head nhlx-prof-team-head">
        {renderTeam ? renderTeam(team) : <TeamLink abbr={team} logo={22}><b>{team}</b></TeamLink>}
        <small>{VENUE[head.venue] || ''}</small>
        {/* Neutral here: the lists below colour by the team's quality, the rest of the rink by more shots likely. */}
        {v?.headline ? <span className="nhlx-edge">{v.headline}</span> : null}
        <span className="nhlx-prof-team-sub">{sub}</span>
      </div>
      <section className="nhlx-char-strengths" aria-label={`${team} strengths`}>
        <h5><i className="is-plus">+</i> Strengths</h5>
        {strengths.length ? <ul>{strengths.map((x) => <Trait key={x.key} x={x} tone="is-soft" />)}</ul> : <p className="nhlx-auto-meta">Nothing stands out</p>}
      </section>
      <section className="nhlx-char-weaknesses" aria-label={`${team} weaknesses`}>
        <h5><i className="is-minus">−</i> Weaknesses</h5>
        {weaknesses.length ? <ul>{weaknesses.map((x) => <Trait key={x.key} x={x} tone="is-tough" />)}</ul> : <p className="nhlx-auto-meta">Nothing stands out</p>}
      </section>
    </div>
  );
}

/**
 * The projected score as the head's pill (lib/nhl-data/score.js, `projected` on the slate game): "MTL 2.8 – 3.3 DAL · 6.1 goals",
 * the home side's chance to win beside it, every part on the hover; once the game is final, the stored pre-game projection
 * (the one the scorecard grades) with the final beside it, green when it called the winner, red when not.
 */
export function ProjectedScore({ projected, final = null, away, home }) {
  if (!projected?.exp) return null;
  const p = projected.stored && final ? projected.stored : projected;
  const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const pHome = p.win?.[home];
  const graded = p.final || (final && projected.final) || null;
  const tone = graded?.called == null ? '' : graded.called ? 'is-soft' : 'is-tough';
  const title = `${p.title || projected.title || ''}${projected.stored && final ? ` Stored ${new Date(projected.stored.at).toLocaleString()} before puck drop; the live read with tonight's data says ${projected.headline}.` : ''}`.trim();
  return (
    <span className={`nhlx-edge nhlx-prof-score ${tone}`} title={title || undefined}>
      {final ? <>Final {away} {final.away} – {final.home} {home} · projected </> : 'Projected '}
      <b>{away} {f1(p.exp?.[away])} – {f1(p.exp?.[home])} {home}</b>
      {!final && p.total != null ? <> · {f1(p.total)} goals</> : null}
      {pHome != null ? <> · {home} {Math.round(pHome * 100)}%</> : null}
    </span>
  );
}

/** The card. `profile` from the slate game (or the NBA board game); `renderTeam(abbr)` draws a team mark in place of the TeamLink (the picks boards, the mock renders); `projected` the game's predicted score, `final` its stored score. */
export function MatchupProfile({ profile, renderTeam = null, projected = null, final = null }) {
  if (!profile?.rows?.length) return null;
  const [away, home] = profile.order;
  const t = profile.total;
  return (
    <div className="nhlx-prof nhlx-char">
      <div className="nhlx-prof-head">
        <b>{profile.title || 'Matchup profile'}</b>
        {projected?.exp
          ? <ProjectedScore projected={projected} final={final} away={away} home={home} />
          : t?.headline ? <span className={`nhlx-edge ${t.tier === 'high' ? 'is-soft' : t.tier === 'low' ? 'is-tough' : ''}`} title={t.title || (t.league != null ? `${t.projected} goals read against a league average of ${t.league}` : undefined)}>{t.headline}</span> : null}
        <small>{profile.legend ? profile.legend.split(' · ')[0] : 'tonight’s venue'} · only what stands out from the league · hover a line for the numbers</small>
      </div>
      <div className="nhlx-char-grid">
        {[away, home].map((team) => (profile.teams[team]
          ? <TeamTraits key={team} head={profile.teams[team]} rows={profile.rows} renderTeam={renderTeam} />
          : <div key={team} className="nhlx-char-team"><div className="nhlx-mu-verdict-head">{renderTeam ? renderTeam(team) : <TeamLink abbr={team} logo={22}><b>{team}</b></TeamLink>}<small>No read yet</small></div></div>))}
      </div>
    </div>
  );
}
