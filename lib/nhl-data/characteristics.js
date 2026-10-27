// Team characteristics, the way WhoScored draws a club: strengths and weaknesses as traits with
// a badge (Very strong · Strong · Weak · Very weak) and a style of play as plain traits, no number
// in the line (the figures ride on each trait as `detail` for the hover). Written from what the
// slate already carries: what the team allows at tonight's venue by position (the stored box
// scores, lib/nhl-data/defense.js), MoneyPuck's team rates, and the team's own shooting profile
// from its stored games (`shotProfiles`). Pure functions; nothing here touches a number.
import { seasonYearOf } from './picks-pure';
import { DEF_POS } from './defense';
import { levelOf, LEVEL_TEXT, VERY, STRENGTHS, WEAKNESSES, joinAnd } from '../picks/levels';

// The badge's levels and words are shared with the NBA and NFL cards (lib/picks/levels.js).
export { levelOf, LEVEL_TEXT, VERY };

const POS_WORD = { LW: 'left wings', C: 'centres', RW: 'right wings', D: 'defensemen' };
const VENUE_WORD = { H: 'at home', A: 'on the road' };
/** A ratio-based trait needs this many games behind it (finishing, goaltending, the shot profile). */
export const MIN_GAMES = 10;
/** A first-goal record needs this many games at the venue. */
export const FG_MIN_GAMES = 5;
/** How far from the league's share a shot-profile trait must sit (×). */
export const PROFILE_EDGE = 0.15;

const r2 = (v) => +Number(v).toFixed(2);
const r1 = (v) => Number(v).toFixed(1);
const pct = (v) => `${Math.round(Number(v) * 100)}%`;


/** A stored defense rank (1 = allows the most) turned round, so 1 = the best. */
const bestOf = (rank, n) => (rank && n ? n + 1 - rank : null);

/** One trait, or null when the rank sits in the middle. `text` may be { plus, minus } for different words each side. */
function trait(key, kind, text, rank, n, detail) {
  const level = levelOf(rank, n);
  if (!level) return null;
  const word = typeof text === 'string' ? text : STRENGTHS.includes(level) ? text.plus : text.minus;
  return { key, kind, text: word, level, rank, n, detail };
}

/** Ranks of two ratios over the league from MoneyPuck's table: finishing (GF over xGF) and goaltending (GA under xGA). */
export function ratioRanks(mp) {
  const all = mp?.situations?.all || {};
  const teams = Object.keys(all).filter((t) => (all[t].gp || 0) >= MIN_GAMES && all[t].xgf60 > 0 && all[t].xga60 > 0 && all[t].gf60 != null && all[t].ga60 != null);
  const rank = (val, dir) => {
    const sorted = [...teams].sort((a, b) => (dir === 'high' ? val(b) - val(a) : val(a) - val(b)));
    return Object.fromEntries(sorted.map((t, i) => [t, { ratio: r2(val(t)), rank: i + 1 }]));
  };
  return { n: teams.length, finishing: rank((t) => all[t].gf60 / all[t].xgf60, 'high'), goaltending: rank((t) => all[t].ga60 / all[t].xga60, 'low') };
}

/**
 * Every team's own shooting profile from the stored skater rows: the share of its shots from each
 * position, the share of its goals from the first forward line, its scoring chances per shot, and
 * how often it scored the game's first goal. This season's games from `MIN_GAMES`, last season's
 * until then. `league` holds the averages the traits are judged against.
 */
export function shotProfiles(rows, date) {
  const year = seasonYearOf(date);
  const by = { cur: {}, prev: {} };
  const fgKnown = new Set();
  for (const r of rows) {
    if (!r.team || !DEF_POS.includes(r.pos)) continue;
    if (Number(r.fg) === 1) fgKnown.add(r.gameId);
    const y = seasonYearOf(r.date);
    const k = y === year ? 'cur' : y === year - 1 ? 'prev' : null;
    if (!k) continue;
    (by[k][r.team] ||= []).push(r);
  }
  const tally = (list) => {
    const games = new Set(list.map((r) => r.gameId));
    const sog = { LW: 0, C: 0, RW: 0, D: 0 };
    let shots = 0; let chances = 0; let goals = 0; let line1 = 0; let lined = 0; let first = 0;
    for (const r of list) {
      const s = Number(r.sog) || 0; const g = Number(r.g) || 0;
      sog[r.pos] += s; shots += s; chances += Number(r.iscf) || 0; goals += g;
      if (r.line) { lined += g; if (r.pos !== 'D' && Number(r.line) === 1) line1 += g; }
      if (Number(r.fg) === 1) first += 1;
    }
    const fgGames = [...games].filter((id) => fgKnown.has(id)).length;
    return {
      games: games.size,
      share: shots ? Object.fromEntries(DEF_POS.map((p) => [p, r2(sog[p] / shots)])) : null,
      line1: lined >= 10 && lined / Math.max(goals, 1) >= 0.6 ? r2(line1 / lined) : null,
      danger: shots ? r2(chances / shots) : null,
      first: fgGames ? { games: fgGames, scored: first, share: r2(first / fgGames) } : null,
    };
  };
  const teams = {};
  for (const team of new Set([...Object.keys(by.cur), ...Object.keys(by.prev)])) {
    const cur = by.cur[team] || [];
    const curGames = new Set(cur.map((r) => r.gameId)).size;
    const use = curGames >= MIN_GAMES ? cur : by.prev[team] || cur;
    if (!use.length) continue;
    teams[team] = { ...tally(use), season: use === cur ? year : year - 1 };
  }
  const list = Object.values(teams);
  const mean = (get) => { const v = list.map(get).filter((x) => x != null); return v.length ? r2(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const league = {
    share: Object.fromEntries(DEF_POS.map((p) => [p, mean((t) => t.share?.[p])])),
    line1: mean((t) => t.line1),
    danger: mean((t) => t.danger),
  };
  return { teams, league, teamCount: list.length };
}

/**
 * One team's characteristics for tonight. `defense` is what the team allows at its venue (the
 * other side's defense object on the slate, keyed by position + All), `mp` the slate's MoneyPuck
 * block, `ratios` from ratioRanks(mp), `profile` / `league` from shotProfiles().
 * Returns { team, venue, strengths, weaknesses, style } (each a list of traits, the strengths and
 * weaknesses most extreme first), or null without any read at all.
 */
export function teamCharacteristics({ team, venue, defense = null, mp = null, ratios = null, profile = null, league = null, teamCount = 32 }) {
  if (!team) return null;
  const where = VENUE_WORD[venue] || '';
  const traits = [];
  const style = [];

  // ── Attack: MoneyPuck's rates, all situations (rank 1 = the best for the team).
  const t = mp?.situations?.all?.[team];
  const r = mp?.ranks?.all?.[team];
  const mpN = mp ? mp.teams || Object.keys(mp.situations?.all || {}).length || 32 : 32;
  if (t && r) {
    const mpd = (v, unit, rank) => `${v} ${unit}, #${rank} of ${mpN} · MoneyPuck, all situations`;
    if (t.sf60 != null) traits.push(trait('volume', 'attack', 'Shot volume', r.sf60, mpN, mpd(r1(t.sf60), 'shots for per 60', r.sf60)));
    if (t.xgf60 != null) traits.push(trait('chances', 'attack', 'Creating chances', r.xgf60, mpN, mpd(t.xgf60.toFixed(2), 'expected goals for per 60', r.xgf60)));
    if (t.hdsf60 != null) traits.push(trait('danger', 'attack', 'High-danger chances', r.hdsf60, mpN, mpd(r1(t.hdsf60), 'high-danger shots for per 60', r.hdsf60)));
    if (t.cfPct != null) traits.push(trait('possession', 'attack', 'Controlling the puck', r.cfPct, mpN, mpd(r1(t.cfPct), '% of the shot attempts', r.cfPct)));
    const fin = ratios?.finishing?.[team];
    if (fin) traits.push(trait('finishing', 'attack', 'Finishing', fin.rank, ratios.n, `${t.gf60.toFixed(2)} goals for per 60 on ${t.xgf60.toFixed(2)} expected (×${fin.ratio.toFixed(2)}), #${fin.rank} of ${ratios.n} · MoneyPuck`));
    if (t.xga60 != null) traits.push(trait('chancesAgainst', 'defense', 'Limiting chances', r.xga60, mpN, mpd(t.xga60.toFixed(2), 'expected goals against per 60', r.xga60)));
    if (t.hdsa60 != null) traits.push(trait('dangerAgainst', 'defense', 'Limiting high-danger chances', r.hdsa60, mpN, mpd(r1(t.hdsa60), 'high-danger shots against per 60', r.hdsa60)));
    const gk = ratios?.goaltending?.[team];
    if (gk) traits.push(trait('goaltending', 'defense', 'Goaltending', gk.rank, ratios.n, `${t.ga60.toFixed(2)} goals against per 60 on ${t.xga60.toFixed(2)} expected (×${gk.ratio.toFixed(2)}), #${gk.rank} of ${ratios.n} · MoneyPuck`));
    // Style: pace.
    const pace = t.pace60 ?? (t.cf60 != null && t.ca60 != null ? t.cf60 + t.ca60 : null);
    const paceLevel = levelOf(r.pace60, mpN);
    if (pace != null && paceLevel) style.push({ key: 'pace', kind: 'tempo', text: STRENGTHS.includes(paceLevel) ? 'Plays at a fast pace' : 'Plays a slow game', detail: `${r1(pace)} shot attempts both ways per 60, #${r.pace60} of ${mpN} fastest · MoneyPuck` });
  }

  // ── Defense at tonight's venue: the stored tables (rank 1 = allows the most, turned round).
  const all = defense?.All;
  const n = all?.teamCount || teamCount;
  if (all?.season?.gp) {
    const src = all.source === 'propfinder' ? `PropFinder ${all.seasonLabel || 'last season'}` : `${all.season.gp} stored games ${where}`;
    if (all.rank?.sog) traits.push(trait('shotsAgainst', 'defense', `Limiting shots ${where}`, bestOf(all.rank.sog, n), n, `${r1(all.season.sog)} shots allowed a game, #${all.rank.sog} of ${n} most · ${src}`));
    if (all.rank?.g) traits.push(trait('goalsAgainst', 'defense', `Limiting goals ${where}`, bestOf(all.rank.g, n), n, `${all.season.g.toFixed(2)} goals allowed a game, #${all.rank.g} of ${n} most · ${src}`));
  }
  // By position, one line each way: the positions in the soft third and in the tight third.
  const byPos = DEF_POS.map((pos) => ({ pos, rank: defense?.[pos]?.rank?.sog ?? null, n: defense?.[pos]?.teamCount || n, sog: defense?.[pos]?.season?.sog ?? null })).filter((p) => p.rank);
  const leaks = byPos.filter((p) => WEAKNESSES.includes(levelOf(bestOf(p.rank, p.n), p.n))).sort((a, b) => a.rank - b.rank);
  const holds = byPos.filter((p) => STRENGTHS.includes(levelOf(bestOf(p.rank, p.n), p.n))).sort((a, b) => b.rank - a.rank);
  const posDetail = (list) => list.map((p) => `${p.pos} ${p.sog != null ? `${r1(p.sog)} shots a game, ` : ''}#${p.rank} of ${p.n} most`).join(' · ');
  if (leaks.length) traits.push({ key: 'leaks', kind: 'defense', text: leaks.length === DEF_POS.length ? `Leaks shots at every position ${where}` : `Leaks shots to ${joinAnd(leaks.map((p) => POS_WORD[p.pos]))} ${where}`, level: leaks[0].rank <= VERY ? 'veryWeak' : 'weak', rank: bestOf(leaks[0].rank, leaks[0].n), n: leaks[0].n, detail: posDetail(leaks) });
  if (holds.length) traits.push({ key: 'holds', kind: 'defense', text: holds.length === DEF_POS.length ? `Holds every position ${where}` : `Holds ${joinAnd(holds.map((p) => POS_WORD[p.pos]))} ${where}`, level: holds[0].rank > holds[0].n - VERY ? 'very' : 'strong', rank: bestOf(holds[0].rank, holds[0].n), n: holds[0].n, detail: posDetail(holds) });
  // The last 10 games against the season rank.
  const l10Rank = all?.l10Rank?.sog ?? null;
  if (all?.l10?.gp && l10Rank && all.rank?.sog) {
    const drift = l10Rank - all.rank.sog;
    const detail = `${r1(all.l10.sog)} shots allowed a game over its last ${all.l10.gp}, #${l10Rank} of ${n} most, against #${all.rank.sog} on the season ${where}`;
    if (drift <= -5) traits.push({ key: 'trend', kind: 'defense', text: 'Defense loosening over the last ten', level: l10Rank <= VERY ? 'veryWeak' : 'weak', rank: bestOf(l10Rank, n), n, detail });
    if (drift >= 5) traits.push({ key: 'trend', kind: 'defense', text: 'Defense tightening over the last ten', level: l10Rank > n - VERY ? 'very' : 'strong', rank: bestOf(l10Rank, n), n, detail });
  }
  // The first goal: how often it concedes it at this venue.
  const fg = all?.firstGoal;
  if (fg?.games >= FG_MIN_GAMES && fg.rank) {
    const fgN = fg.teamCount || n;
    traits.push(trait('firstGoal', 'defense', { plus: `Rarely concedes the first goal ${where}`, minus: `Concedes the first goal ${where}` }, bestOf(fg.rank, fgN), fgN, `conceded the first goal in ${fg.allowed} of ${fg.games} games ${where} (${pct(fg.share)}${fg.league != null ? `, league ${pct(fg.league)}` : ''}), #${fg.rank} of ${fgN} most`));
  }

  // ── Style: the team's own shooting profile.
  if (profile && league) {
    const seasonWord = profile.season != null ? `${profile.season}-${String(profile.season + 1).slice(2)}` : 'this season';
    const from = `${profile.games} stored games, ${seasonWord}`;
    if (profile.share && league.share) {
      const cand = [
        { key: 'point', text: 'Shots from the point', share: profile.share.D, lg: league.share.D, who: 'defensemen' },
        { key: 'wings', text: 'Wingers carry the shooting', share: r2(profile.share.LW + profile.share.RW), lg: r2((league.share.LW || 0) + (league.share.RW || 0)), who: 'wingers' },
        { key: 'middle', text: 'Shots run through the centres', share: profile.share.C, lg: league.share.C, who: 'centres' },
      ].filter((c) => c.lg > 0 && c.share / c.lg >= 1 + PROFILE_EDGE).sort((a, b) => b.share / b.lg - a.share / a.lg);
      if (cand.length) style.push({ key: cand[0].key, kind: 'attack', text: cand[0].text, detail: `${pct(cand[0].share)} of its shots from the ${cand[0].who}, league ${pct(cand[0].lg)} · ${from}` });
    }
    if (profile.line1 != null && league.line1 > 0) {
      const ratio = profile.line1 / league.line1;
      if (ratio >= 1 + PROFILE_EDGE) style.push({ key: 'topline', kind: 'attack', text: 'Top line carries the scoring', detail: `${pct(profile.line1)} of its goals from the first line, league ${pct(league.line1)} · ${from}` });
      else if (ratio <= 1 - PROFILE_EDGE) style.push({ key: 'depth', kind: 'attack', text: 'Scoring spread across the lines', detail: `${pct(profile.line1)} of its goals from the first line, league ${pct(league.line1)} · ${from}` });
    }
    if (profile.danger != null && league.danger > 0) {
      const ratio = profile.danger / league.danger;
      if (ratio >= 1 + PROFILE_EDGE) style.push({ key: 'inside', kind: 'attack', text: 'Shoots from dangerous areas', detail: `${profile.danger.toFixed(2)} scoring chances a shot, league ${league.danger.toFixed(2)} · ${from}` });
      else if (ratio <= 1 - PROFILE_EDGE) style.push({ key: 'perimeter', kind: 'attack', text: 'Shoots from the perimeter', detail: `${profile.danger.toFixed(2)} scoring chances a shot, league ${league.danger.toFixed(2)} · ${from}` });
    }
    if (profile.first?.games >= MIN_GAMES) {
      if (profile.first.share >= 0.6) style.push({ key: 'scoresFirst', kind: 'attack', text: 'Scores first more often than not', detail: `scored first in ${profile.first.scored} of ${profile.first.games} games (${pct(profile.first.share)}) · ${from}` });
      else if (profile.first.share <= 0.4) style.push({ key: 'chases', kind: 'defense', text: 'Often chasing the game', detail: `scored first in ${profile.first.scored} of ${profile.first.games} games (${pct(profile.first.share)}) · ${from}` });
    }
  }

  // Most extreme first, by the rank's place in its own league (the ratio ranks run over fewer teams).
  const list = traits.filter(Boolean);
  const place = (x) => x.rank / (x.n || teamCount);
  const strengths = list.filter((x) => STRENGTHS.includes(x.level)).sort((a, b) => place(a) - place(b));
  const weaknesses = list.filter((x) => !STRENGTHS.includes(x.level)).sort((a, b) => place(b) - place(a));
  if (!strengths.length && !weaknesses.length && !style.length) return null;
  return { team, venue, strengths, weaknesses, style };
}
