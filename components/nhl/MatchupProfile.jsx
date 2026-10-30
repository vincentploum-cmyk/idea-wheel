'use client';

import { useState } from 'react';
import { TeamLink } from './links';
import { GROUP_TEXT, VERY_LEVELS } from '@/lib/nhl-data/matchup-profile';

// The matchup profile under a game head on Matchups: the two teams side by side, a row per read,
// each cell a word with its rank line (the form of a soccer first-half profile: label · team ·
// team). Data: `profile` on a slate game (lib/nhl-data/matchup-profile.js). Three layouts of the
// same rows, picked in the card head and kept in localStorage (2026-10-30, Vincent asked for
// options): `profile` = the word over its rank line, `sources` = the word with every source's
// figure beside it (the rink · PropFinder · the last ten), `tape` = the tale of the tape, the
// figures first, mirrored around the label.

export const LAYOUTS = [['profile', 'Profile'], ['sources', 'Sources'], ['tape', 'Tape']];
const STORE_KEY = 'nhl.matchup-profile.layout';
const VENUE = { H: 'home', A: 'away' };

/** The layout picked for the session (localStorage), 'profile' by default. */
export function useProfileLayout() {
  // Read once on the client (the card is drawn after the slate's fetch, never on the server).
  const [layout, setLayout] = useState(() => {
    if (typeof window === 'undefined') return 'profile';
    try { const v = window.localStorage.getItem(STORE_KEY); return LAYOUTS.some(([k]) => k === v) ? v : 'profile'; } catch { return 'profile'; }
  });
  const pick = (k) => { setLayout(k); try { window.localStorage.setItem(STORE_KEY, k); } catch { /* private mode */ } };
  return [layout, pick];
}

function Word({ cell, className = '' }) {
  if (!cell?.word) return null;
  return <span className={`nhlx-edge nhlx-prof-word ${cell.tone || ''}${VERY_LEVELS.includes(cell.level) ? ' is-very' : ''} ${className}`}>{cell.word}</span>;
}

function Detail({ lines, one = false }) {
  const list = (lines || []).filter(Boolean);
  if (!list.length) return null;
  return <span className="nhlx-prof-detail">{(one ? list.slice(0, 1) : list).map((l, i) => <span key={i}>{l}</span>)}</span>;
}

function Figures({ list }) {
  if (!list?.length) return null;
  return (
    <span className="nhlx-prof-figs">
      {list.map((f) => (
        <span key={f.label} className={`nhlx-prof-fig ${f.tone || ''}`} title={f.title || undefined}>
          <small>{f.label}</small>
          <b>{f.value}</b>
          {f.rank ? <i>#{f.rank}</i> : null}
        </span>
      ))}
    </span>
  );
}

function Pills({ list }) {
  if (!list?.length) return null;
  return (
    <span className="nhlx-prof-pills">
      {list.map((p) => (
        <span key={p.label} className={`nhlx-prof-pill ${p.tone || ''}`} title={p.title || undefined}>
          <b>{p.label}</b>
          <span>{p.value}</span>
        </span>
      ))}
    </span>
  );
}

/** One team's cell of a row in the picked layout; an empty cell reads a dash. */
function Cell({ cell, layout, side }) {
  const cls = `nhlx-prof-cell is-${side}`;
  if (!cell) return <div className={cls}><span className="nhlx-prof-detail">—</span></div>;
  const title = cell.detail?.join(' · ') || undefined;
  if (layout === 'sources') {
    return (
      <div className={cls} title={title}>
        {cell.pills?.length ? <Pills list={cell.pills} /> : <Figures list={cell.figures} />}
        <Word cell={cell} className="is-small" />
      </div>
    );
  }
  if (layout === 'tape') {
    return (
      <div className={cls} title={title}>
        {cell.pills?.length ? <Pills list={cell.pills} /> : (
          <span className="nhlx-prof-vline">
            {cell.value != null ? <><b className="nhlx-prof-value">{cell.value}</b><small className="nhlx-prof-unit">{cell.unit}</small></> : null}
            <Word cell={cell} />
          </span>
        )}
        <Detail lines={cell.detail} one />
      </div>
    );
  }
  // The profile: the word over its rank line; the game rows (the meetings, the model: a record or a count
  // for a word, no level) show their figures under it.
  return (
    <div className={cls}>
      {cell.pills?.length ? <Pills list={cell.pills} /> : <><Word cell={cell} />{!cell.level ? <Figures list={cell.figures} /> : null}</>}
      <Detail lines={cell.detail} />
    </div>
  );
}

function TeamHead({ head, side, renderTeam }) {
  if (!head) return <div className={`nhlx-prof-cell is-${side}`} />;
  const v = head.verdict;
  return (
    <div className={`nhlx-prof-cell nhlx-prof-team is-${side}`}>
      <span className="nhlx-prof-team-name">
        {renderTeam ? renderTeam(head.team) : <TeamLink abbr={head.team} logo={22}><b>{head.team}</b></TeamLink>}
        <small>{VENUE[head.venue] || ''}</small>
        {v?.headline ? <span className={`nhlx-edge ${v.tier === 'leaky' ? 'is-soft' : v.tier === 'tight' ? 'is-tough' : ''}`}>{v.headline}</span> : null}
      </span>
      <span className="nhlx-prof-team-sub">{head.games ? `${head.games} stored game${head.games === 1 ? '' : 's'} ${head.seasonLabel}` : 'no stored game this season'}{head.pf ? ` · PropFinder ${head.pf.label}${head.pf.stored ? ' (stored)' : ''}` : ''}</span>
    </div>
  );
}

/**
 * The card. `profile` from the slate game; `renderTeam(abbr)` draws a team mark in place of the
 * TeamLink (the picks boards and the mock renders); `layout` / `onLayout` override the stored pick.
 */
export function MatchupProfile({ profile, renderTeam = null, layout: forced = null, onLayout = null, showTabs = true }) {
  const [stored, pick] = useProfileLayout();
  const layout = forced || stored;
  const setLayout = onLayout || pick;
  if (!profile?.rows?.length) return null;
  const [away, home] = profile.order;
  const t = profile.total;
  const tape = layout === 'tape';
  return (
    <div className={`nhlx-prof is-${layout}`}>
      <div className="nhlx-prof-head">
        <b>Matchup profile</b>
        {t?.headline ? <span className={`nhlx-edge ${t.tier === 'high' ? 'is-soft' : t.tier === 'low' ? 'is-tough' : ''}`} title={t.league != null ? `${t.projected} goals read against a league average of ${t.league}` : undefined}>{t.headline}</span> : null}
        {showTabs ? (
          <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Profile layout">
            {LAYOUTS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={layout === k} className={`nhlx-tab${layout === k ? ' is-active' : ''}`} onClick={() => setLayout(k)}>{l}</button>)}
          </div>
        ) : null}
        <small>green = more shots and goals likely, red = fewer · hover a cell for the numbers</small>
      </div>
      <div className="nhlx-prof-rows">
        <div className="nhlx-prof-row is-head">
          {tape ? (
            <>
              <TeamHead head={profile.teams[away]} side="away" renderTeam={renderTeam} />
              <div className="nhlx-prof-label is-head">at</div>
              <TeamHead head={profile.teams[home]} side="home" renderTeam={renderTeam} />
            </>
          ) : (
            <>
              <div className="nhlx-prof-label is-head" />
              <TeamHead head={profile.teams[away]} side="away" renderTeam={renderTeam} />
              <TeamHead head={profile.teams[home]} side="home" renderTeam={renderTeam} />
            </>
          )}
        </div>
        {profile.rows.map((row, i) => {
          const heading = profile.rows[i - 1]?.group !== row.group ? <div key={`g-${row.group}`} className="nhlx-prof-group">{GROUP_TEXT[row.group] || row.group}</div> : null;
          return [
            heading,
            <div key={row.key} className={`nhlx-prof-row is-${row.key}`}>
              {tape ? (
                <>
                  <Cell cell={row.cells[away]} layout={layout} side="away" />
                  <div className="nhlx-prof-label" title={row.hint}>{row.label}</div>
                  <Cell cell={row.cells[home]} layout={layout} side="home" />
                </>
              ) : (
                <>
                  <div className="nhlx-prof-label" title={row.hint}>{row.label}</div>
                  <Cell cell={row.cells[away]} layout={layout} side="away" />
                  <Cell cell={row.cells[home]} layout={layout} side="home" />
                </>
              )}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}
