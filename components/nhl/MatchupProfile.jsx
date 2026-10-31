'use client';

import { TeamLink } from './links';
import { VERY_LEVELS } from '@/lib/nhl-data/matchup-profile';

// The matchup profile under a game head on Matchups: the two teams side by side, five rows (shooting,
// allows, power play, penalty kill, last 10), each cell a word over one line of figures at tonight's
// venue, every other source in the cell's hover. Data: `profile` on a slate game
// (lib/nhl-data/matchup-profile.js). Cut to five rows and one layout on 2026-10-30 (Vincent: "the
// summary needs to be compact. 5 rows max.").

const VENUE = { H: 'home', A: 'away' };

function Word({ cell }) {
  if (!cell?.word) return null;
  return <span className={`nhlx-edge nhlx-prof-word ${cell.tone || ''}${VERY_LEVELS.includes(cell.level) ? ' is-very' : ''}`}>{cell.word}</span>;
}

/** One team's cell of a row; an empty cell reads a dash. */
function Cell({ cell, side }) {
  const cls = `nhlx-prof-cell is-${side}`;
  if (!cell) return <div className={cls}><span className="nhlx-prof-detail">—</span></div>;
  return (
    <div className={cls} title={cell.title || undefined}>
      <Word cell={cell} />
      <span className="nhlx-prof-detail">{(cell.parts || [{ t: cell.text }]).map((x, i) => (x.tone ? <b key={i} className={`nhlx-prof-rank ${x.tone}`}>{x.t}</b> : <span key={i}>{x.t}</span>))}</span>
    </div>
  );
}

function TeamHead({ head, side, renderTeam }) {
  if (!head) return <div className={`nhlx-prof-cell is-${side}`} />;
  const v = head.verdict;
  const spz = head.shotpropz;
  // The NHL head says where its boards stand; a profile that writes its own line (the NBA's) passes `sub`.
  const sub = head.sub ?? (spz
    ? `ShotPropz${spz.venueGames != null ? ` · ${spz.venueGames} ${VENUE[head.venue] || ''} game${spz.venueGames === 1 ? '' : 's'}` : ''}${spz.leadAt === 'all' ? ' (all games until four there)' : ''}${spz.updated ? ` · ${spz.updated}` : ''}`
    : head.games ? `${head.games} stored game${head.games === 1 ? '' : 's'} · no ShotPropz snapshot yet` : 'no ShotPropz snapshot yet');
  return (
    <div className={`nhlx-prof-cell nhlx-prof-team is-${side}`}>
      <span className="nhlx-prof-team-name">
        {renderTeam ? renderTeam(head.team) : <TeamLink abbr={head.team} logo={22}><b>{head.team}</b></TeamLink>}
        <small>{VENUE[head.venue] || ''}</small>
        {v?.headline ? <span className={`nhlx-edge ${v.tier === 'leaky' ? 'is-soft' : v.tier === 'tight' ? 'is-tough' : ''}`}>{v.headline}</span> : null}
      </span>
      <span className="nhlx-prof-team-sub">{sub}</span>
    </div>
  );
}

/** The card. `profile` from the slate game (or the NBA board game); `renderTeam(abbr)` draws a team mark in place of the TeamLink (the picks boards, the mock renders). */
export function MatchupProfile({ profile, renderTeam = null }) {
  if (!profile?.rows?.length) return null;
  const [away, home] = profile.order;
  const t = profile.total;
  return (
    <div className="nhlx-prof">
      <div className="nhlx-prof-head">
        <b>{profile.title || 'Matchup profile'}</b>
        {t?.headline ? <span className={`nhlx-edge ${t.tier === 'high' ? 'is-soft' : t.tier === 'low' ? 'is-tough' : ''}`} title={t.title || (t.league != null ? `${t.projected} goals read against a league average of ${t.league}` : undefined)}>{t.headline}</span> : null}
        <small>{profile.legend || 'tonight’s venue · green = more shots and goals likely, red = fewer · hover a cell for every source'}</small>
      </div>
      <div className="nhlx-prof-rows">
        <div className="nhlx-prof-row is-head">
          <div className="nhlx-prof-label is-head" />
          <TeamHead head={profile.teams[away]} side="away" renderTeam={renderTeam} />
          <TeamHead head={profile.teams[home]} side="home" renderTeam={renderTeam} />
        </div>
        {profile.rows.map((row) => (
          <div key={row.key} className={`nhlx-prof-row is-${row.key}`}>
            <div className="nhlx-prof-label" title={row.hint}>{row.label}</div>
            <Cell cell={row.cells[away]} side="away" />
            <Cell cell={row.cells[home]} side="home" />
          </div>
        ))}
      </div>
    </div>
  );
}
