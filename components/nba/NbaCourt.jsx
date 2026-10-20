'use client';

import { fmtOdds } from '@/lib/nfl/odds';
import { ICON } from '@/components/nhl/flags';
import { useNbaPlayerCard } from './NbaPlayerCard';

// The matchup view of an NBA game, the NHL rink's basketball twin: for each team a half court
// (50 × 47 ft, the basket at the top) with its players placed by position (PF · C · SF under the
// basket, SG · PG on the perimeter), every zone tinted by what tonight's opponent gives up to that
// position for the stat picked above the board (rank 1 = the most permissive of the league:
// green third, amber middle, red stingiest), each chip carrying the player's line and chance for
// the stat; above the court the opponent's allowed table per position with the league ranks,
// under it every player's props read against the matchup.
export const COURT_METRICS = [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes']];
const MARKET_OF = { pts: 'pts', reb: 'reb', ast: 'ast', tpm: 'tpm' };
const STAT_LABEL = { pts: 'PTS', reb: 'REB', ast: 'AST', tpm: '3PM', stl: 'STL', blk: 'BLK', tov: 'TO', pra: 'PRA', pr: 'PR', pa: 'PA', ra: 'RA', ftm: 'FTM', fgm: 'FGM', min: 'MIN', oreb: 'OREB', dreb: 'DREB' };
const STAT_ORDER = ['pts', 'reb', 'ast', 'tpm', 'pra', 'stl', 'blk', 'tov', 'ftm', 'fgm'];
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const TABLE_MARKETS = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['pra', 'PRA']];
const W = 50; const H = 47;
// Zones in feet: [x, y, width, height]; the label sits at the zone's foot, the chips stack from its top.
const ZONES = { PF: [0, 0, 17, 22], C: [17, 0, 16, 22], SF: [33, 0, 17, 22], SG: [0, 22, 25, 25], PG: [25, 22, 25, 25] };
const ZONE_OF = { PG: 'PG', SG: 'SG', SF: 'SF', PF: 'PF', C: 'C', G: 'SG', F: 'SF' };
const CHIP_H = 5.2;                           // feet between stacked chips
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const shortName = (name) => { const parts = String(name || '').trim().split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : name; };
const NB = '\u00a0';

/** League rank (1 = most permissive) → 'soft' | 'mid' | 'tough' | 'none'. */
export function zoneTone(rank, teams) {
  if (!rank || !teams) return 'none';
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'soft';
  if (rank > teams - third) return 'tough';
  return 'mid';
}

/** The player's play for a market: the book's main line on the over (or yes) side first, else his best over, else any. */
export function playFor(p, market) {
  const mine = (p.plays || []).filter((x) => x.market === market);
  const overs = mine.filter((x) => x.side === 'over' || x.side === 'yes');
  return overs.find((x) => x.main) || overs[0] || mine.find((x) => x.main) || mine[0] || null;
}

const ZONE_MAX = { PF: 3, C: 3, SF: 3, SG: 4, PG: 4 };   // chips a zone holds before the rest go under the court

/** Players onto the court: one stack per zone (PG · SG · SF · PF · C; G and F join the guards and wings), the rest under it. */
export function layoutCourt(players) {
  const stacks = Object.fromEntries(Object.keys(ZONES).map((z) => [z, []]));
  const extras = [];
  for (const p of players) {
    const z = ZONE_OF[String(p.pos || '').toUpperCase()] || null;
    if (!z || stacks[z].length >= ZONE_MAX[z]) { extras.push(p); continue; }
    stacks[z].push(p);
  }
  const placed = [];
  for (const [z, list] of Object.entries(stacks)) {
    const [x, y, w] = ZONES[z];
    list.forEach((p, i) => placed.push({ p, zone: z, x: x + w / 2, y: y + 3.4 + i * CHIP_H }));
  }
  return { placed, extras };
}

function CourtMarkings({ clipId, tones }) {
  return (
    <svg className="ir-court-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs><clipPath id={clipId}><rect width={W} height={H} rx="1.5" /></clipPath></defs>
      <rect width={W} height={H} rx="1.5" className="ir-court-floor" />
      <g clipPath={`url(#${clipId})`}>
        {Object.entries(ZONES).map(([z, [x, y, w, h]]) => <rect key={z} x={x} y={y} width={w} height={h} className={`nhlx-rk-band is-${tones[z] || 'none'}`} />)}
        <path d={`M17 0V22M33 0V22M0 22H${W}M25 22V${H}`} className="nhlx-rk-band-line" />
        {/* Paint, free-throw circle, restricted area, rim and board, the three-point line, the centre circle. */}
        <rect x="17" y="0" width="16" height="19" className="ir-court-line" />
        <circle cx="25" cy="19" r="6" className="ir-court-line" />
        <path d="M21 5.25A4 4 0 0 0 29 5.25" className="ir-court-line" />
        <path d="M22 4H28" className="ir-court-line is-board" />
        <circle cx="25" cy="5.25" r="0.75" className="ir-court-line is-rim" />
        <path d="M3 0V14A23.75 23.75 0 0 0 47 14V0" className="ir-court-line is-arc" />
        <path d={`M19 ${H}A6 6 0 0 1 31 ${H}`} className="ir-court-line" />
      </g>
      <rect width={W} height={H} rx="1.5" className="ir-court-edge" />
    </svg>
  );
}

/** The zone's foot: the position and the opponent's rank for the court's stat, tinted by its third. */
function ZoneLabel({ zone, allowed, metric, opp }) {
  const [x, y, w, h] = ZONES[zone];
  const cell = allowed?.rows?.[zone]?.[metric];
  const count = allowed?.count || 30;
  const tone = zoneTone(cell?.rank, count);
  const title = cell ? `${opp} gives up ${cell.value != null ? `${num(cell.value)} ${STAT_LABEL[metric] || metric} per game` : `the #${cell.rank} most ${STAT_LABEL[metric] || metric}`} to ${zone}s · rank ${cell.rank} of ${count}, 1 = the most${allowed.from === 'sheet' ? ' · from the cheat sheet’s tiles' : ' · PropFinder'}` : `No defense table for ${opp} at ${zone}`;
  return (
    <div className={`nhlx-rk-zone is-${tone}`} style={{ left: `${((x + w / 2) / W) * 100}%`, top: `${((y + h - 2.2) / H) * 100}%` }} title={title}>
      <b>{zone}</b>{cell?.rank ? <span>#{cell.rank}{NB}{STAT_LABEL[metric] || metric}</span> : <span>no data</span>}
    </div>
  );
}

function Chip({ p, x, y, metric, sport, team, opp, venue, final }) {
  const open = useNbaPlayerCard();
  const play = playFor(p, MARKET_OF[metric]);
  const avg = p.avg?.[metric];
  const over = play && play.p >= play.floor;
  const flags = [];
  if (play?.confirmed) flags.push(['conf', `On the cheat sheet (${play.onSheet ? 'confirmed' : ''})`, '✓']);
  if (play?.form === 'hot') flags.push(['hot', `Hot: ${pct(play.rates.l5)} of his last 5 over this line`, ICON.hot]);
  if (play?.form === 'cold') flags.push(['cold', `Cold: ${pct(play.rates.l5)} of his last 5 over this line`, ICON.cold]);
  if (play?.spot?.soft) flags.push(['soft', `Soft spot: the opponent is in the permissive third at his position for this stat (#${play.spot.rank})`, ICON.soft]);
  const all = (p.plays || []).filter((x) => x.side === 'over' || x.side === 'yes').map((x) => `${x.side === 'yes' ? '' : 'o'}${x.line} ${x.label} ${pct(x.p)}${x.odds != null ? ` at ${fmtOdds(x.odds)}` : ''}${x.hit == null ? '' : x.hit ? ' ✓' : ' ✗'}`);
  const title = `${p.player} · ${p.pos || '—'}${p.injury ? ` · ${p.injury}` : ''}${avg != null ? ` · ${num(avg)} ${STAT_LABEL[metric]} a game this season` : ''}${all.length ? `\n${all.join('\n')}` : '\nNo PropFinder line yet'}`;
  return (
    <button type="button" className={`nhlx-rk-chip${play?.confirmed ? ' is-pick' : ''}${p.injury ? ' is-out' : ''}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }} title={title} onClick={() => open({ key: p.key, player: p, team, opp, venue, market: MARKET_OF[metric] })}>
      <span className="nhlx-rk-pic">
        {p.espnId ? <img src={sport.headshotUrl(p.espnId)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <img src={sport.teamLogo(team)} alt="" loading="lazy" className="is-logo" />}
        <i className="nhlx-rk-num">{p.pos || '—'}</i>
      </span>
      <span className="nhlx-rk-meta">
        <b className="nhlx-rk-name">{flags.length ? <span className="nhlx-pk-flags nhlx-rk-flags">{flags.map(([k, t, icon]) => <i key={k} className={`nhlx-pk-flag is-${k}`} title={t} aria-label={t}>{icon}</i>)}</span> : null}<span className="nhlx-rk-nm">{shortName(p.player)}</span></b>
        {play
          ? final && play.hit != null
            ? <span className={`nhlx-rk-stat is-actual${play.hit ? ' is-over' : ''}`}><em>{play.actual}</em>{NB}{STAT_LABEL[metric]}{NB}· {play.side === 'yes' ? '' : 'o'}{play.line}{NB}<i>{pct(play.p)}</i></span>
            : <span className={`nhlx-rk-stat is-model${over ? ' is-over' : ''}`}><em>{play.side === 'yes' ? '' : 'o'}{play.line}</em>{NB}{STAT_LABEL[metric]}{NB}· <em>{pct(play.p)}</em></span>
          : <span className="nhlx-rk-stat">{avg != null ? <><em>{num(avg)}</em>{NB}{STAT_LABEL[metric]}{NB}avg</> : p.injury ? p.injury : 'no line'}</span>}
      </span>
    </button>
  );
}

/** What the opponent gives up per game to each position, with the league rank in every cell. */
function AllowedTable({ side }) {
  const a = side.allowed;
  if (!a) return <p className="nhlx-auto-meta ir-court-none">No defense table for {side.opp} yet: pull PropFinder under Data sources.</p>;
  const keys = [...new Set(Object.values(a.rows).flatMap((r) => Object.keys(r)))].filter((k) => k !== 'gp').sort((x, y) => (STAT_ORDER.indexOf(x) + 1 || 99) - (STAT_ORDER.indexOf(y) + 1 || 99)).slice(0, 8);
  const positions = [...POSITIONS.filter((p) => a.rows[p]), ...Object.keys(a.rows).filter((p) => !POSITIONS.includes(p))];
  const count = a.count || 30;
  return (
    <div className="nhlx-pfd">
      <div className="nhlx-pfd-head"><b>What {side.opp} gives up per game, by position</b><small className="nhlx-auto-meta">rank 1 = the most of {count} · {a.from === 'sheet' ? 'the cheat sheet’s tiles' : 'PropFinder; this season blended into last season’s at games / (games + 15)'}</small></div>
      <div className="nhlx-pfd-wrap">
        <table className="nhlx-pfd-table">
          <thead><tr><th>Pos</th>{keys.map((k) => <th key={k}>{STAT_LABEL[k] || k.toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos}>
                <td><b>{pos}</b><small className="nhlx-auto-meta" title={a.rows[pos].prior ? `${a.rows[pos].gp || 0} games this season blended into last season's ${a.rows[pos].prior}` : ''}> {a.rows[pos].gp || 0}{a.rows[pos].prior ? `+${a.rows[pos].prior}` : ''} GP</small></td>
                {keys.map((k) => { const c = a.rows[pos][k]; const tone = zoneTone(c?.rank, count); return <td key={k} className={c ? `is-${tone}` : ''}>{c ? <><span className="nhlx-pfd-val">{c.value != null ? num(c.value) : '—'}</span>{c.rank ? <span className="nhlx-pfd-rank">#{c.rank}</span> : null}</> : '—'}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Every player of the side with his props read against the matchup: the line and the chance per market. */
function PlayersTable({ side, final }) {
  const open = useNbaPlayerCard();
  const players = side.players.filter((p) => p.plays.length);
  if (!players.length) return null;
  return (
    <div className="nhlx-pfd ir-court-players">
      <div className="nhlx-pfd-head"><b>Props by player · {side.team} {side.venue === 'H' ? 'vs' : 'at'} {side.opp}</b><small className="nhlx-auto-meta">the line and the chance (green over the floor); ✓ on the cheat sheet</small></div>
      <div className="nhlx-pfd-wrap">
        <table className="nhlx-pfd-table ir-court-table">
          <thead><tr><th>Player</th><th>Pos</th>{TABLE_MARKETS.map(([k, l]) => <th key={k}>{l}</th>)}{final ? <th>Got</th> : null}</tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.key} className={`is-click${p.injury ? ' is-muted' : ''}`} onClick={() => open({ key: p.key, player: p, team: side.team, opp: side.opp, venue: side.venue })}>
                <td><b>{p.player}</b>{p.injury ? <small className="nhlx-auto-meta"> {p.injury}</small> : null}</td>
                <td>{p.pos || '—'}</td>
                {TABLE_MARKETS.map(([k]) => {
                  const x = playFor(p, k);
                  if (!x) return <td key={k}>—</td>;
                  const tone = x.p >= x.floor ? 'soft' : x.p < x.floor - 0.1 ? 'tough' : 'mid';
                  const title = `${x.side === 'yes' ? '' : x.side === 'under' ? 'u' : 'o'}${x.line} ${x.label}: ${pct(x.p)} (break-even ${x.fair})${x.odds != null ? ` at ${fmtOdds(x.odds)}` : ''}${x.rates.n ? ` · over the line L5 ${pct(x.rates.l5)} · L10 ${pct(x.rates.l10)} · season ${pct(x.rates.season)} (${x.rates.n})` : ''}${x.spot?.soft ? ' · soft spot' : x.spot?.tough ? ' · tough spot' : ''}${x.confirmed ? ' · on the cheat sheet' : ''}${x.hit == null ? '' : ` · got ${x.actual} (${x.hit ? 'hit' : 'miss'})`}`;
                  return <td key={k} className={`is-${tone}${x.hit == null ? '' : x.hit ? ' is-hit' : ' is-miss'}`} title={title}><span className="nhlx-pfd-val">{x.side === 'under' ? 'u' : 'o'}{x.line}{x.confirmed ? <i className="ir-court-conf" title="on the cheat sheet">✓</i> : null}{x.spot?.soft ? <i className="nhlx-pk-flag is-soft ir-court-soft" title="soft spot">{ICON.soft}</i> : null}</span><span className="nhlx-pfd-rank">{pct(x.p)}</span></td>;
                })}
                {final ? <td>{TABLE_MARKETS.map(([k]) => { const x = playFor(p, k); return x && x.actual != null ? `${x.actual} ` : ''; }).join('').trim() || '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CourtCard({ side, metric, sport, final }) {
  const { placed, extras } = layoutCourt(side.players);
  const count = side.allowed?.count || 30;
  const tones = Object.fromEntries(Object.keys(ZONES).map((z) => [z, zoneTone(side.allowed?.rows?.[z]?.[metric]?.rank, count)]));
  const clipId = `court-${side.team}-${side.opp}`;
  const withLines = side.players.filter((p) => p.plays.length).length;
  return (
    <section className="nhlx-rk-card ir-court-card" aria-label={`${side.team} court`}>
      <div className="nhlx-rk-head">
        <img src={sport.teamLogo(side.team)} alt="" width="40" height="40" loading="lazy" />
        <div><b>{sport.teamName(side.team)} <small>{side.venue === 'H' ? 'vs' : 'at'} {sport.teamName(side.opp)}</small></b><small>{withLines} player{withLines === 1 ? '' : 's'} with a line · zones by what {side.opp} gives up to the position</small></div>
      </div>
      <AllowedTable side={side} />
      <div className="nhlx-rk ir-court">
        <CourtMarkings clipId={clipId} tones={tones} />
        {Object.keys(ZONES).map((z) => <ZoneLabel key={z} zone={z} allowed={side.allowed} metric={metric} opp={side.opp} />)}
        {placed.map(({ p, x, y }) => <Chip key={p.key} p={p} x={x} y={y} metric={metric} sport={sport} team={side.team} opp={side.opp} venue={side.venue} final={final} />)}
      </div>
      {extras.length ? <p className="nhlx-rk-extras nhlx-auto-meta"><b>Also:</b> {extras.map((p) => { const x = playFor(p, MARKET_OF[metric]); return `${p.player} (${p.pos || '—'}${x ? `, o${x.line} ${pct(x.p)}` : ''})`; }).join(' · ')}</p> : null}
      <PlayersTable side={side} final={final} />
    </section>
  );
}

/** The two courts of a game: the away team first, as the game head reads. */
export default function CourtPair({ g, metric, sport }) {
  const sides = g.sides || {};
  const list = [sides[g.away], sides[g.home]].filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="nhlx-rink-pair ir-court-pair">
      {list.map((side) => <CourtCard key={side.team} side={side} metric={metric} sport={sport} final={g.final} />)}
    </div>
  );
}
