// The matchup profile under a game head on Matchups: the two teams side by side, a row per read,
// each cell a word (Elite · Strong · Average · Weak · Poor for an attack, Elite · Tight · Average ·
// Leaky · Very leaky for a defense), its rank over the league and the figure behind it, and the
// same read from every source the slate carries — the rink's stored box scores, PropFinder's
// tables (the one above the rink and its team table), MoneyPuck's rates, the saved model run and
// the stored meetings. It replaced the strengths / weaknesses / style card on 2026-10-30 (Vincent:
// "replace it with a summary of data from both the rink and propfinder", in the form of a soccer
// first-half profile: label · team · team, a badge word over a rank line). Pure functions over
// data the slate already builds; nothing here touches a number the boards read.
import { memoByRows } from '../memo';
import { seasonYearOf } from './picks-pure';
import { DEF_POS } from './defense';
import { defaultDefenseTab } from './propfinder-csv';

/** The ranks at either end of the league that read Elite / Poor. */
export const VERY = 3;
/** The share of the league at each end that carries a word other than Average: a quarter. */
export const SHARE = 4;
/** A team's own per-game figures lead its attack rows from this many games this season. */
export const MIN_OWN_GAMES = 5;
/** A first-goal record needs this many games at the venue. */
export const FG_MIN_GAMES = 5;
/** The last five against the season: a shot volume up or down by this share reads Rising / Falling. */
export const FORM_EDGE = 0.1;
/** A last-ten rank this far from the season rank reads Loosening / Tightening. */
export const TREND_DRIFT = 5;

// The words per kind of read, by level (rank 1 = the best for the team on that read), and the tone
// each carries. Green means more shots and goals likely in the game from that side's angle (a strong
// attack, a leaky defense, a fast pace), red fewer — the rink's one colour rule, never the team's
// quality: a tight defense is red because its opponents' shooters face it.
export const WORDS = {
  attack: { elite: 'Elite', strong: 'Strong', average: 'Average', weak: 'Weak', poor: 'Poor' },
  defense: { elite: 'Elite', strong: 'Tight', average: 'Average', weak: 'Leaky', poor: 'Very leaky' },
  goalie: { elite: 'Elite', strong: 'Strong', average: 'Average', weak: 'Weak', poor: 'Poor' },
  pace: { elite: 'Very fast', strong: 'Fast', average: 'Average', weak: 'Slow', poor: 'Very slow' },
  firstGoal: { elite: 'Rarely concedes', strong: 'Rarely concedes', average: 'Average', weak: 'Often concedes', poor: 'Often concedes' },
};
const TONES = {
  attack: { elite: 'is-soft', strong: 'is-soft', average: '', weak: 'is-tough', poor: 'is-tough' },
  defense: { elite: 'is-tough', strong: 'is-tough', average: '', weak: 'is-soft', poor: 'is-soft' },
  goalie: { elite: 'is-tough', strong: 'is-tough', average: '', weak: 'is-soft', poor: 'is-soft' },
  pace: { elite: 'is-soft', strong: 'is-soft', average: '', weak: 'is-tough', poor: 'is-tough' },
  firstGoal: { elite: 'is-tough', strong: 'is-tough', average: '', weak: 'is-soft', poor: 'is-soft' },
};
/** The badge's strength: the ends of the league are drawn bolder. */
export const VERY_LEVELS = ['elite', 'poor'];

/** A rank's level over n teams, rank 1 = the best for the team on the read; null without a rank. */
export function levelOf(rank, n = 32) {
  if (!rank || !n) return null;
  const edge = Math.ceil(n / SHARE);
  if (rank <= VERY) return 'elite';
  if (rank <= edge) return 'strong';
  if (rank > n - VERY) return 'poor';
  if (rank > n - edge) return 'weak';
  return 'average';
}

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  const s = { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th';
  return `${v}${s}`;
}

/** A defense rank (1 = allows the most) turned round, so 1 = the best for the team. */
export const bestOf = (rank, n) => (rank && n ? n + 1 - rank : null);

const r1 = (v) => (v == null ? null : Number(v).toFixed(1));
const r2 = (v) => (v == null ? null : Number(v).toFixed(2));
const pct = (v) => (v == null ? null : `${Math.round(Number(v) * 100)}%`);
const VENUE_WORD = { H: 'at home', A: 'on the road' };
const seasonLabel = (year) => (year == null ? '' : `${year}-${String(Number(year) + 1).slice(2)}`);

/** The word, tone and level for a rank of a kind: { word, level, tone }, or nulls without a rank. */
export function badgeOf(kind, rank, n) {
  const level = levelOf(rank, n);
  return { level, word: level ? WORDS[kind][level] : null, tone: level ? TONES[kind][level] : '' };
}

/** One figure of a cell's strip: { label, value, rank, n, tone, title }. `best` is the rank with 1 the best for the team. */
function figure(label, value, { best = null, n = null, kind = 'attack', title = null, unit = '', show = null } = {}) {
  if (value == null) return null;
  return { label, value: String(value), unit, rank: show ?? best, n, tone: best ? TONES[kind][levelOf(best, n)] || '' : '', title };
}

/**
 * Every team's own per-game figures from the stored skater rows (the rink's side of an attack row):
 * its shots and goals a game this season (its skaters' rows summed per game), its last five, and the
 * ranks over the teams with a game (1 = the most). A team without a game this season reads last
 * season's regular season until its first (`held: true`). Kept per rows array.
 */
export function teamRates(rows, season) {
  return memoByRows(rows, `teamRates|${season}`, () => {
    const by = { cur: {}, prev: {} };
    for (const r of rows) {
      if (!r.team || !r.gameId) continue;
      const y = seasonYearOf(r.date);
      const k = y === season ? 'cur' : y === season - 1 ? 'prev' : null;
      if (!k) continue;
      const games = (by[k][r.team] ||= {});
      const g = (games[r.gameId] ||= { gameId: r.gameId, date: r.date, venue: r.venue, sog: 0, g: 0 });
      g.sog += Number(r.sog) || 0;
      g.g += Number(r.g) || 0;
    }
    const tally = (list) => {
      const n = list.length;
      const sum = (xs, k) => xs.reduce((s, g) => s + g[k], 0);
      const l5 = list.slice(-5);
      return {
        gp: n, sog: n ? +(sum(list, 'sog') / n).toFixed(2) : 0, g: n ? +(sum(list, 'g') / n).toFixed(2) : 0,
        l5: l5.length ? { gp: l5.length, sog: +(sum(l5, 'sog') / l5.length).toFixed(2), g: +(sum(l5, 'g') / l5.length).toFixed(2) } : null,
        last: n ? list[n - 1].date : null,
      };
    };
    const teams = {};
    for (const team of new Set([...Object.keys(by.cur), ...Object.keys(by.prev)])) {
      const cur = Object.values(by.cur[team] || {}).sort((a, b) => (a.date < b.date ? -1 : 1));
      const prev = Object.values(by.prev[team] || {}).sort((a, b) => (a.date < b.date ? -1 : 1));
      const use = cur.length ? cur : prev;
      if (!use.length) continue;
      teams[team] = { ...tally(use), season: cur.length ? season : season - 1, held: !cur.length };
    }
    const abbrs = Object.keys(teams);
    const ranks = Object.fromEntries(abbrs.map((a) => [a, {}]));
    const league = {};
    for (const k of ['sog', 'g']) {
      const sorted = [...abbrs].sort((a, b) => teams[b][k] - teams[a][k]);
      sorted.forEach((a, i) => { ranks[a][k] = sorted.findIndex((b) => teams[b][k] === teams[a][k]) + 1 || i + 1; });
      league[k] = abbrs.length ? +(abbrs.reduce((s, a) => s + teams[a][k], 0) / abbrs.length).toFixed(2) : null;
    }
    return { teams, ranks, league, teamCount: abbrs.length, season };
  });
}

/** PropFinder's team table row for a team: its per-game figures with PropFinder's ranks (1 = the highest) and the table's size. */
export function pfTeamOf(table, abbr) {
  const row = table?.teams?.[abbr];
  if (!row) return null;
  return { row, ranks: table.ranks?.[abbr] || {}, n: table.count || Object.keys(table.teams).length, season: table.season ?? null, gp: row.gp ?? null };
}

/** The PropFinder defense tabs of a team read for the card: the tab the rink opens on and its L10. */
export function pfDefenseOf(tabs) {
  const list = tabs || [];
  const tab = defaultDefenseTab(list);
  if (!tab) return null;
  return { tab, l10: list.find((t) => t.key === 'l10') || null };
}

/**
 * The saved run's read of a side: its lineup skaters' λ summed (shots and goals the model expects
 * of the team tonight), how many it projected, and the plays strip's best play. Null without a run.
 */
export function modelOf(side) {
  const rows = (side?.skaters || []).filter((p) => p.inLineup !== false && p.model && p.model.sog != null);
  if (!rows.length && !side?.plays) return null;
  const sog = rows.reduce((s, p) => s + (Number(p.model.sog) || 0), 0);
  const goals = rows.reduce((s, p) => s + (Number(p.model.g) || 0), 0);
  const plays = side?.plays ? [...side.plays.shots, ...side.plays.goals] : [];
  const best = plays.length ? [...plays].sort((a, b) => b.prob - a.prob)[0] : null;
  return { skaters: rows.length, sog: +sog.toFixed(1), goals: +goals.toFixed(2), plays: plays.length, best: best ? { name: best.name, market: best.market, prob: best.prob } : null };
}

/** A team's side of the stored meetings (h2hTotals): goals for and against a game, the record, the last score. */
export function h2hOf(meetings, team, opp) {
  const list = (meetings || []).filter((m) => m.goals && m.goals[team] != null && m.goals[opp] != null);
  if (!list.length) return null;
  const gf = list.reduce((s, m) => s + m.goals[team], 0) / list.length;
  const ga = list.reduce((s, m) => s + m.goals[opp], 0) / list.length;
  const won = list.filter((m) => m.goals[team] > m.goals[opp]).length;
  const last = list[list.length - 1];
  const homeTeam = last.home;
  const awayTeam = homeTeam === team ? opp : team;
  return { gp: list.length, gf: +gf.toFixed(2), ga: +ga.toFixed(2), won, lost: list.length - won, last: { date: last.date, score: `${awayTeam} ${last.goals[awayTeam]}–${last.goals[homeTeam]} ${homeTeam}` } };
}

/** The rows of the card, in order, with their group and the hover text under the label. */
export const PROFILE_ROWS = [
  { key: 'shots', group: 'attack', label: 'Shot volume', hint: 'Shots on goal a game: the stored box scores this season lead, PropFinder’s team table and MoneyPuck’s shots for per 60 beside them.' },
  { key: 'goals', group: 'attack', label: 'Scoring', hint: 'Goals a game: the stored box scores this season, PropFinder’s team table, MoneyPuck’s goals for per 60.' },
  { key: 'chances', group: 'attack', label: 'Chance quality', hint: 'Expected goals for per 60 (MoneyPuck, all situations), PropFinder’s scoring chances a game, and finishing: goals over expected goals.' },
  { key: 'special', group: 'attack', label: 'Special teams', hint: 'Power play and penalty kill percentages with PropFinder’s ranks.' },
  { key: 'form', group: 'attack', label: 'Attack form', hint: 'Shots a game over the last five against the season, from the stored box scores.' },
  { key: 'shotsAllowed', group: 'defense', label: 'Shots allowed', hint: 'Shots on goal allowed a game: PropFinder’s table above the rink on the tab it opens on leads; beside it the stored box scores at tonight’s venue and the last ten.' },
  { key: 'goalsAllowed', group: 'defense', label: 'Goals allowed', hint: 'Goals allowed a game, the same three reads.' },
  { key: 'leaks', group: 'defense', label: 'By position', hint: 'Shots allowed a game to each position with PropFinder’s rank, 1 = allows the most: the table above the rink.' },
  { key: 'trend', group: 'defense', label: 'Defense trend', hint: 'Shots allowed over the last ten games against the season rank, from the stored box scores.' },
  { key: 'firstGoal', group: 'defense', label: 'First goal', hint: 'How often the team scores the game’s first goal and how often it concedes it at tonight’s venue, from the stored games.' },
  { key: 'goaltending', group: 'defense', label: 'Goaltending', hint: 'Goals against under expected goals against (MoneyPuck), ranked over the teams with ten games.' },
  { key: 'pace', group: 'game', label: 'Pace', hint: 'Shot attempts both ways per 60 and the share of the attempts the team takes (MoneyPuck).' },
  { key: 'h2h', group: 'game', label: 'Head to head', hint: 'The stored meetings between the two, this season and last: goals for and against a game, the record, the last score.' },
  { key: 'tonight', group: 'game', label: 'Model tonight', hint: 'The saved run’s λ summed over the lineup: the shots and goals it expects of the team, and the plays strip’s best play.' },
];
export const GROUP_TEXT = { attack: 'Attack', defense: 'Defense tonight', game: 'The game' };

/**
 * The profile of one game. `game` is a slate game before this is added ({ away, home, sides,
 * verdicts, total }); `moneypuck` the slate's block, `ratios` from ratioRanks(), `profiles` from
 * shotProfiles() (the first goals scored), `rates` from teamRates(), `pfTeams` PropFinder's team
 * table (loadPropfinder().teams), `h2h` from h2hTotals(rows, away, home).
 * Returns { order: [away, home], teams: { ABBR: head }, rows: [{ key, group, label, hint, cells: { ABBR: cell } }] }
 * — a cell { word, level, tone, value, unit, detail: [line, …], figures: [{ label, value, rank, n, tone }], pills, source }
 * — or null when no row reads for either team.
 */
export function matchupProfile({ game, moneypuck = null, ratios = null, profiles = null, rates = null, pfTeams = null, h2h = [] }) {
  if (!game?.away || !game?.home || !Array.isArray(game.sides)) return null;
  const mpN = moneypuck ? moneypuck.teams || Object.keys(moneypuck.situations?.all || {}).length || 32 : 32;
  const cells = {};
  const heads = {};
  for (let i = 0; i < game.sides.length; i++) {
    const s = game.sides[i];
    const other = game.sides[1 - i];
    const team = s.team;
    const where = VENUE_WORD[s.venue] || '';
    // What this team allows at its venue tonight: the other side's defense object and PropFinder table describe it.
    const def = other?.defense || null;
    const all = def?.All || null;
    const defN = all?.teamCount || 32;
    const pfd = pfDefenseOf(other?.propfinder?.tabs);
    const pfAll = pfd?.tab?.rows?.All || null;
    const pfL10All = pfd?.l10?.rows?.All || null;
    const own = rates?.teams?.[team] || null;
    const ownRank = rates?.ranks?.[team] || {};
    const ownN = rates?.teamCount || 0;
    const pfT = pfTeamOf(pfTeams, team);
    const t = moneypuck?.situations?.all?.[team] || null;
    const r = moneypuck?.ranks?.all?.[team] || null;
    const model = modelOf(s);
    const meet = h2hOf(h2h, team, s.opp);
    const out = {};

    // ── Attack: the team's own shots and goals a game, the rink leading from five games.
    const attackRow = (k, unitWord, mpKey, mpLabel) => {
      const rink = own && !own.held && own.gp >= MIN_OWN_GAMES ? { value: k === 'g' ? r2(own[k]) : r1(own[k]), rank: ownRank[k], n: ownN, gp: own.gp } : null;
      const pf = pfT && pfT.row[k] != null ? { value: k === 'g' ? r2(pfT.row[k]) : r1(pfT.row[k]), rank: pfT.ranks[k] ?? null, n: pfT.n, season: pfT.season } : null;
      const mp = t && t[mpKey] != null && r ? { value: k === 'g' ? r2(t[mpKey]) : r1(t[mpKey]), rank: r[mpKey] ?? null, n: mpN } : null;
      const lead = rink ? { ...rink, src: 'rink' } : pf ? { ...pf, src: 'pf' } : mp ? { ...mp, src: 'mp' } : null;
      if (!lead) return null;
      const b = badgeOf('attack', lead.rank, lead.n);
      const srcText = lead.src === 'rink' ? `over ${lead.gp} stored games` : lead.src === 'pf' ? `PropFinder ${seasonLabel(lead.season)}` : 'MoneyPuck, per 60';
      const detail = [`${ordinal(lead.rank)} of ${lead.n} · ${lead.value} ${unitWord} a game · ${srcText}`];
      if (lead.src === 'rink' && pf) detail.push(`PropFinder ${pf.value} (${ordinal(pf.rank)})${mp ? ` · MoneyPuck ${mp.value} per 60 (${ordinal(mp.rank)})` : ''}`);
      else if (own?.held && own.gp) detail.push(`${seasonLabel(own.season)} stored games: ${k === 'g' ? r2(own[k]) : r1(own[k])} a game — no game this season yet`);
      return {
        ...b, value: lead.value, unit: `${unitWord}/G`, detail, source: lead.src,
        figures: [
          figure('Rink', rink?.value, { best: rink?.rank, n: rink?.n, title: rink ? `${rink.value} ${unitWord} a game over ${rink.gp} stored games this season, ${ordinal(rink.rank)} of ${rink.n}` : null }),
          figure('PF', pf?.value, { best: pf?.rank, n: pf?.n, title: pf ? `PropFinder's team table ${seasonLabel(pf.season)}: ${pf.value} ${unitWord} a game, ${ordinal(pf.rank)} of ${pf.n}` : null }),
          figure(mpLabel, mp?.value, { best: mp?.rank, n: mp?.n, title: mp ? `MoneyPuck, all situations: ${mp.value} per 60, ${ordinal(mp.rank)} of ${mp.n}` : null }),
        ].filter(Boolean),
      };
    };
    out.shots = attackRow('sog', 'shots', 'sf60', 'SF/60');
    out.goals = attackRow('g', 'goals', 'gf60', 'GF/60');

    // Chance quality: MoneyPuck's expected goals lead, PropFinder's scoring chances and the finishing ratio beside them.
    {
      const xg = t?.xgf60 != null && r ? { value: r2(t.xgf60), rank: r.xgf60 ?? null, n: mpN } : null;
      const sc = pfT && pfT.row.sc != null ? { value: r1(pfT.row.sc), rank: pfT.ranks.sc ?? null, n: pfT.n } : null;
      const fin = ratios?.finishing?.[team] ? { value: `×${ratios.finishing[team].ratio.toFixed(2)}`, rank: ratios.finishing[team].rank, n: ratios.n } : null;
      const lead = xg ? { ...xg, src: 'mp' } : sc ? { ...sc, src: 'pf' } : null;
      if (lead) {
        const b = badgeOf('attack', lead.rank, lead.n);
        const detail = lead.src === 'mp'
          ? [`${ordinal(lead.rank)} of ${lead.n} · ${lead.value} expected goals per 60 · MoneyPuck`]
          : [`${ordinal(lead.rank)} of ${lead.n} · ${lead.value} scoring chances a game · PropFinder`];
        if (fin) detail.push(`finishing ×${ratios.finishing[team].ratio.toFixed(2)} on expected (${ordinal(fin.rank)} of ${fin.n})${lead.src === 'mp' && sc ? ` · PropFinder ${sc.value} scoring chances a game (${ordinal(sc.rank)})` : ''}`);
        out.chances = {
          ...b, value: lead.value, unit: lead.src === 'mp' ? 'xGF/60' : 'SC/G', detail, source: lead.src,
          figures: [
            figure('xGF/60', xg?.value, { best: xg?.rank, n: xg?.n, title: xg ? `MoneyPuck expected goals for per 60, ${ordinal(xg.rank)} of ${xg.n}` : null }),
            figure('SC/G', sc?.value, { best: sc?.rank, n: sc?.n, title: sc ? `PropFinder scoring chances a game, ${ordinal(sc.rank)} of ${sc.n}` : null }),
            figure('Finish', fin?.value, { best: fin?.rank, n: fin?.n, title: fin ? `goals for over expected goals for (MoneyPuck), ${ordinal(fin.rank)} of ${fin.n}` : null }),
          ].filter(Boolean),
        };
      }
    }

    // Special teams: PropFinder's PP% and PK% (the power play leads; a strong kill reads red — fewer goals against it).
    if (pfT && (pfT.row.ppPct != null || pfT.row.pkPct != null)) {
      const pp = pfT.row.ppPct != null ? { value: r1(pfT.row.ppPct), rank: pfT.ranks.ppPct ?? null, n: pfT.n } : null;
      const pk = pfT.row.pkPct != null ? { value: r1(pfT.row.pkPct), rank: pfT.ranks.pkPct ?? null, n: pfT.n } : null;
      const lead = pp || pk;
      const b = badgeOf(pp ? 'attack' : 'goalie', lead.rank, lead.n);
      const detail = [pp ? `${ordinal(pp.rank)} of ${pp.n} · ${pp.value}% on the power play · PropFinder ${seasonLabel(pfT.season)}` : `${ordinal(pk.rank)} of ${pk.n} · ${pk.value}% on the kill · PropFinder ${seasonLabel(pfT.season)}`];
      if (pp && pk) detail.push(`penalty kill ${pk.value}% (${ordinal(pk.rank)} of ${pk.n})`);
      out.special = {
        ...b, value: `${lead.value}%`, unit: pp ? 'PP' : 'PK', detail, source: 'pf',
        figures: [
          figure('PP%', pp?.value, { best: pp?.rank, n: pp?.n, title: pp ? `power play ${pp.value}%, ${ordinal(pp.rank)} of ${pp.n}` : null }),
          figure('PK%', pk?.value, { best: pk?.rank, n: pk?.n, kind: 'goalie', title: pk ? `penalty kill ${pk.value}%, ${ordinal(pk.rank)} of ${pk.n}` : null }),
        ].filter(Boolean),
      };
    }

    // Attack form: the last five's shots against the season's, this season's stored games (eight at least, so the five have something to stand against).
    if (own && !own.held && own.gp >= 8 && own.l5 && own.sog > 0) {
      const ratio = own.l5.sog / own.sog;
      const level = ratio >= 1 + FORM_EDGE ? 'rising' : ratio <= 1 - FORM_EDGE ? 'falling' : 'steady';
      out.form = {
        level, word: { rising: 'Rising', falling: 'Falling', steady: 'Steady' }[level], tone: level === 'rising' ? 'is-soft' : level === 'falling' ? 'is-tough' : '',
        value: r1(own.l5.sog), unit: 'SOG L5', source: 'rink',
        detail: [`last 5 vs season · ${r1(own.l5.sog)} shots and ${r2(own.l5.g)} goals a game against ${r1(own.sog)} and ${r2(own.g)} over ${own.gp} games`],
        figures: [
          figure('L5 SOG', r1(own.l5.sog), { title: 'shots a game over the last five stored games' }),
          figure('L5 G', r2(own.l5.g), { title: 'goals a game over the last five stored games' }),
          figure('Season', r1(own.sog), { title: `shots a game over ${own.gp} stored games this season` }),
        ],
      };
    }

    // ── Defense at tonight's venue: PropFinder's table above the rink leads, the rink's venue table and the last ten beside it.
    const defenseRow = (k, unitWord) => {
      const pf = pfAll && pfAll[k] != null ? { value: k === 'g' ? r2(pfAll[k]) : r1(pfAll[k]), rank: pfAll.ranks?.[k] ?? null, n: pfd.tab.count || 32, label: pfd.tab.label, stored: pfd.tab.source === 'stored', gp: pfAll.gp } : null;
      const rink = all?.season?.gp && all.source === 'games' && all.season[k] != null ? { value: k === 'g' ? r2(all.season[k]) : r1(all.season[k]), rank: all.rank?.[k] ?? null, n: defN, gp: all.season.gp } : null;
      const stand = !rink && all?.season?.gp && all.source === 'propfinder' && all.season[k] != null ? { value: k === 'g' ? r2(all.season[k]) : r1(all.season[k]), rank: all.rank?.[k] ?? null, n: defN, label: all.seasonLabel } : null;
      const l10 = pfL10All && pfL10All[k] != null ? { value: k === 'g' ? r2(pfL10All[k]) : r1(pfL10All[k]), rank: pfL10All.ranks?.[k] ?? null, n: pfd.l10.count || 32, src: 'pf' }
        : all?.l10?.gp && all.l10[k] != null ? { value: k === 'g' ? r2(all.l10[k]) : r1(all.l10[k]), rank: all.l10Rank?.[k] ?? null, n: defN, src: 'rink' } : null;
      const lead = pf ? { ...pf, src: 'pf' } : rink ? { ...rink, src: 'rink' } : stand ? { ...stand, src: 'stand' } : null;
      if (!lead) return null;
      const b = badgeOf('defense', bestOf(lead.rank, lead.n), lead.n);
      const srcText = lead.src === 'pf' ? `PropFinder ${lead.label}${lead.stored ? ' (stored games)' : ''}` : lead.src === 'rink' ? `${lead.gp} stored games ${where}` : `PropFinder ${lead.label || 'last season'}, standing in`;
      const detail = [`${ordinal(lead.rank)} of ${lead.n} most · ${lead.value} ${unitWord} allowed a game · ${srcText}`];
      if (lead.src === 'pf' && rink) detail.push(`${where}: ${rink.value} over ${rink.gp} stored games (${ordinal(rink.rank)} of ${rink.n})${l10 ? ` · last 10: ${l10.value} (${ordinal(l10.rank)})` : ''}`);
      else if (l10) detail.push(`last 10: ${l10.value} a game (${ordinal(l10.rank)} of ${l10.n})`);
      return {
        ...b, value: lead.value, unit: `${unitWord} A/G`, detail, source: lead.src,
        figures: [
          figure('PF', pf?.value, { best: bestOf(pf?.rank, pf?.n), show: pf?.rank, n: pf?.n, kind: 'defense', title: pf ? `PropFinder ${pf.label}: ${pf.value} ${unitWord} allowed a game, ${ordinal(pf.rank)} of ${pf.n} most` : null }),
          figure(s.venue === 'H' ? 'Rink home' : 'Rink away', rink?.value, { best: bestOf(rink?.rank, rink?.n), show: rink?.rank, n: rink?.n, kind: 'defense', title: rink ? `${rink.value} ${unitWord} allowed a game over ${rink.gp} stored games ${where}, ${ordinal(rink.rank)} of ${rink.n} most` : null }),
          figure('L10', l10?.value, { best: bestOf(l10?.rank, l10?.n), show: l10?.rank, n: l10?.n, kind: 'defense', title: l10 ? `${l10.value} ${unitWord} allowed a game over the last ten (${l10.src === 'pf' ? 'PropFinder' : 'stored games'}), ${ordinal(l10.rank)} of ${l10.n} most` : null }),
        ].filter(Boolean),
      };
    };
    out.shotsAllowed = defenseRow('sog', 'shots');
    out.goalsAllowed = defenseRow('g', 'goals');

    // By position: a pill per position from the table above the rink, tinted by third (1 = allows the most).
    if (pfd?.tab?.rows) {
      const n = pfd.tab.count || 32;
      const third = Math.ceil(n / 3);
      const pills = DEF_POS.map((pos) => {
        const row = pfd.tab.rows[pos];
        if (!row || row.sog == null) return null;
        const rank = row.ranks?.sog ?? null;
        return { label: pos, value: rank ? `#${rank}` : '—', sub: `${r1(row.sog)} SOG`, rank, n, tone: rank ? (rank <= third ? 'is-soft' : rank > n - third ? 'is-tough' : '') : '', title: `${pos}: ${r1(row.sog)} shots and ${r2(row.g)} goals allowed a game, ${rank ? `${ordinal(rank)} of ${n} most` : 'unranked'} · PropFinder ${pfd.tab.label}` };
      }).filter(Boolean);
      if (pills.length) {
        const soft = pills.filter((p) => p.tone === 'is-soft').map((p) => p.label);
        const tight = pills.filter((p) => p.tone === 'is-tough').map((p) => p.label);
        const word = soft.length === pills.length ? 'Leaks everywhere' : tight.length === pills.length ? 'Holds everywhere' : soft.length ? `Leaks to ${soft.join(', ')}` : tight.length ? `Holds ${tight.join(', ')}` : 'Even';
        out.leaks = { word, level: null, tone: soft.length ? 'is-soft' : tight.length ? 'is-tough' : '', value: null, unit: null, detail: [`shots allowed a game to each position · PropFinder ${pfd.tab.label}${pfd.tab.source === 'stored' ? ' (stored games)' : ''}`], pills, figures: [], source: 'pf' };
      }
    }

    // Defense trend: the rink's last ten against the season rank at the venue.
    if (all?.l10?.gp && all.l10Rank?.sog && all.rank?.sog) {
      const drift = all.l10Rank.sog - all.rank.sog;
      const level = drift <= -TREND_DRIFT ? 'loosening' : drift >= TREND_DRIFT ? 'tightening' : 'steady';
      out.trend = {
        level, word: { loosening: 'Loosening', tightening: 'Tightening', steady: 'Steady' }[level], tone: level === 'loosening' ? 'is-soft' : level === 'tightening' ? 'is-tough' : '',
        value: r1(all.l10.sog), unit: 'SOG A L10', source: 'rink',
        detail: [`${r1(all.l10.sog)} shots allowed a game over its last ${all.l10.gp} (${ordinal(all.l10Rank.sog)} of ${defN} most) against ${ordinal(all.rank.sog)} on the season ${where}`],
        figures: [
          figure('L10', r1(all.l10.sog), { best: bestOf(all.l10Rank.sog, defN), show: all.l10Rank.sog, n: defN, kind: 'defense', title: `shots allowed a game over the last ${all.l10.gp} stored games, ${ordinal(all.l10Rank.sog)} of ${defN} most` }),
          figure('Season', all.season?.sog != null ? r1(all.season.sog) : null, { best: bestOf(all.rank.sog, defN), show: all.rank.sog, n: defN, kind: 'defense', title: `shots allowed a game on the season ${where}, ${ordinal(all.rank.sog)} of ${defN} most` }),
          figure('Drift', `${drift > 0 ? '+' : ''}${drift}`, { title: 'last-ten rank minus season rank: negative = allowing more lately' }),
        ].filter(Boolean),
      };
    }

    // The first goal: concedes it at the venue (the rink's record) and scores it (the team's own profile).
    {
      const fg = all?.firstGoal;
      const scored = profiles?.teams?.[team]?.first || null;
      const con = fg?.games >= FG_MIN_GAMES ? fg : null;
      if (con || scored?.games >= FG_MIN_GAMES) {
        const fgN = con?.teamCount || defN;
        const b = con?.rank ? badgeOf('firstGoal', bestOf(con.rank, fgN), fgN) : { word: null, level: null, tone: '' };
        const detail = [];
        if (con) detail.push(`conceded the first goal in ${con.allowed} of ${con.games} games ${where} (${pct(con.share)}${con.league != null ? `, league ${pct(con.league)}` : ''})${con.rank ? ` · ${ordinal(con.rank)} of ${fgN} most` : ''}`);
        if (scored?.games >= FG_MIN_GAMES) detail.push(`scored first in ${scored.scored} of ${scored.games} games (${pct(scored.share)})`);
        out.firstGoal = {
          ...b, value: con ? pct(con.share) : pct(scored.share), unit: con ? 'conceded first' : 'scored first', detail, source: 'rink',
          figures: [
            figure('Scores 1st', scored?.games >= FG_MIN_GAMES ? pct(scored.share) : null, { title: scored ? `scored the first goal in ${scored.scored} of ${scored.games} stored games` : null }),
            figure('Concedes 1st', con ? pct(con.share) : null, { best: bestOf(con?.rank, fgN), show: con?.rank, n: fgN, kind: 'firstGoal', title: con ? `conceded the first goal in ${con.allowed} of ${con.games} games ${where}` : null }),
            figure('League', con?.league != null ? pct(con.league) : null, { title: 'the league’s share of games with the first goal conceded at this venue' }),
          ].filter(Boolean),
        };
      }
    }

    // Goaltending: goals against under expected (MoneyPuck), over the teams with ten games.
    if (ratios?.goaltending?.[team] && t) {
      const gk = ratios.goaltending[team];
      const b = badgeOf('goalie', gk.rank, ratios.n);
      out.goaltending = {
        ...b, value: `×${gk.ratio.toFixed(2)}`, unit: 'GA / xGA', source: 'mp',
        detail: [`${ordinal(gk.rank)} of ${ratios.n} · ${r2(t.ga60)} goals against per 60 on ${r2(t.xga60)} expected (×${gk.ratio.toFixed(2)}) · MoneyPuck`],
        figures: [
          figure('GA/60', r2(t.ga60), { title: 'goals against per 60, all situations' }),
          figure('xGA/60', r2(t.xga60), { best: r?.xga60 ?? null, n: mpN, kind: 'goalie', title: `expected goals against per 60, ${r?.xga60 ? `${ordinal(r.xga60)} of ${mpN}` : 'unranked'}` }),
          figure('Saved', `×${gk.ratio.toFixed(2)}`, { best: gk.rank, n: ratios.n, kind: 'goalie', title: `goals against over expected, ${ordinal(gk.rank)} of ${ratios.n} (1 = the fewest)` }),
        ],
      };
    }

    // ── The game: pace, the meetings, the model's read.
    if (t && r) {
      const pace = t.pace60 ?? (t.cf60 != null && t.ca60 != null ? t.cf60 + t.ca60 : null);
      if (pace != null) {
        const b = badgeOf('pace', r.pace60 ?? null, mpN);
        out.pace = {
          ...b, value: r1(pace), unit: 'CF+CA/60', source: 'mp',
          detail: [`${r.pace60 ? `${ordinal(r.pace60)} of ${mpN} fastest · ` : ''}${r1(pace)} shot attempts both ways per 60${t.cfPct != null ? ` · takes ${r1(t.cfPct)}% of them` : ''} · MoneyPuck`],
          figures: [
            figure('Pace', r1(pace), { best: r.pace60 ?? null, n: mpN, kind: 'pace', title: `shot attempts both ways per 60, ${r.pace60 ? `${ordinal(r.pace60)} of ${mpN} fastest` : 'unranked'}` }),
            figure('CF%', t.cfPct != null ? r1(t.cfPct) : null, { best: r.cfPct ?? null, n: mpN, title: `the team's share of the shot attempts, ${r.cfPct ? `${ordinal(r.cfPct)} of ${mpN}` : 'unranked'}` }),
          ].filter(Boolean),
        };
      }
    }
    out.h2h = meet
      ? {
        word: `${meet.won}–${meet.lost}`, level: null, tone: meet.won > meet.lost ? 'is-soft' : meet.won < meet.lost ? 'is-tough' : '', value: r1(meet.gf), unit: 'GF a meeting', source: 'rink',
        detail: [`${meet.gp} meeting${meet.gp === 1 ? '' : 's'} stored · ${r1(meet.gf)} goals for and ${r1(meet.ga)} against a game · last ${meet.last.score} (${meet.last.date})`],
        figures: [
          figure('GF', r1(meet.gf), { title: 'goals a meeting, this season and last' }),
          figure('GA', r1(meet.ga), { title: 'goals against a meeting' }),
        ],
      }
      : { word: null, level: null, tone: '', value: null, unit: null, detail: ['no stored meetings this season or last'], figures: [], source: 'rink' };
    out.tonight = model
      ? {
        word: model.plays ? `${model.plays} play${model.plays === 1 ? '' : 's'}` : 'No play', level: null, tone: model.plays ? 'is-soft' : '', value: r1(model.sog), unit: 'λ SOG', source: 'model',
        detail: [`${r1(model.sog)} shots and ${r2(model.goals)} goals expected over ${model.skaters} skaters${model.best ? ` · best play ${model.best.name} ${model.best.market} ${Math.round(model.best.prob * 100)}%` : ' · no play clears the floor'}`],
        figures: [
          figure('SOG', r1(model.sog), { title: 'the run’s λ shots summed over the lineup' }),
          figure('Goals', r2(model.goals), { title: 'the run’s λ goals summed over the lineup' }),
        ],
      }
      : { word: null, level: null, tone: '', value: null, unit: null, detail: ['no model run saved for this slate yet'], figures: [], source: 'model' };

    cells[team] = out;
    const v = game.verdicts?.[team] || null;
    heads[team] = {
      team, venue: s.venue, opp: s.opp,
      games: own && !own.held ? own.gp : 0, seasonLabel: seasonLabel(rates?.season),
      pf: pfd?.tab ? { label: pfd.tab.label, stored: pfd.tab.source === 'stored' } : null,
      verdict: v ? { headline: v.headline, tier: v.tier } : null,
    };
  }

  const order = [game.away, game.home];
  const rows = PROFILE_ROWS.map((row) => ({ ...row, cells: Object.fromEntries(order.map((team) => [team, cells[team]?.[row.key] || null])) })).filter((row) => order.some((team) => row.cells[team]));
  if (!rows.length) return null;
  const total = game.total ? { headline: game.total.headline, tier: game.total.tier, projected: game.total.projected, league: game.total.league } : null;
  return { order, teams: heads, total, rows };
}
