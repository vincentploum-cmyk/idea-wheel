// The matchup profile under a game head on Matchups: the two teams side by side, five rows, each
// cell a word (Elite · Strong · Average · Weak · Poor for an attack, Elite · Tight · Average · Leaky ·
// Very leaky for a defense) over one line of figures — what the team shoots and scores, what it
// allows, its power play, its penalty kill, its last ten — at tonight's venue, from ShotPropz's
// team boards first (lib/nhl-data/shotpropz.js: the venue board from four games there, all games
// until then), the rink's stored box scores and PropFinder standing in without a snapshot, every
// other source in the hover. It replaced the strengths / weaknesses / style card on 2026-10-30
// (Vincent: "replace it with a summary of data from both the rink and propfinder", in the form of a
// soccer first-half profile) and was cut from fourteen rows to five the same night ("the summary
// needs to be compact. 5 rows max."). Pure functions over data the slate already builds.
import { memoByRows } from '../memo';
import { seasonYearOf } from './picks-pure';
import { defaultDefenseTab } from './propfinder-csv';
import { spzTeamRead, spzSavePct } from './shotpropz-pure';
import { VERY, SHARE, WORDS, VERY_LEVELS, levelOf, ordinal, bestOf, badgeOf, cellOf, rankPart } from '../picks/profile-words';

// The words and the helpers are shared with the NBA's profile (lib/picks/profile-words.js).
export { VERY, SHARE, WORDS, VERY_LEVELS, levelOf, ordinal, bestOf, badgeOf };

/** A team's own stored figures stand in for ShotPropz from this many games this season. */
export const MIN_OWN_GAMES = 5;
/** The last ten against the season: shots up or down by this share read Rising / Falling. */
export const FORM_EDGE = 0.1;

const r1 = (v) => (v == null ? null : Number(v).toFixed(1));
const r2 = (v) => (v == null ? null : Number(v).toFixed(2));
const AT = { home: 'at home', away: 'on the road', all: 'all games' };
const seasonLabel = (year) => (year == null ? '' : `${year}-${String(Number(year) + 1).slice(2)}`);

/**
 * Every team's own per-game figures from the stored skater rows: its shots and goals a game this
 * season (its skaters' rows summed per game), its last five and last ten, and the ranks over the
 * teams with a game (1 = the most). A team without a game this season reads last season's regular
 * season until its first (`held: true`). Kept per rows array.
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
    const mean = (list, k) => (list.length ? +(list.reduce((s, g) => s + g[k], 0) / list.length).toFixed(2) : 0);
    const window = (list) => (list.length ? { gp: list.length, sog: mean(list, 'sog'), g: mean(list, 'g') } : null);
    const teams = {};
    for (const team of new Set([...Object.keys(by.cur), ...Object.keys(by.prev)])) {
      const cur = Object.values(by.cur[team] || {}).sort((a, b) => (a.date < b.date ? -1 : 1));
      const prev = Object.values(by.prev[team] || {}).sort((a, b) => (a.date < b.date ? -1 : 1));
      const use = cur.length ? cur : prev;
      if (!use.length) continue;
      teams[team] = { gp: use.length, sog: mean(use, 'sog'), g: mean(use, 'g'), l5: window(use.slice(-5)), l10: window(use.slice(-10)), last: use[use.length - 1].date, season: cur.length ? season : season - 1, held: !cur.length };
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

/** The five rows, in order, with the hover text under the label. */
export const PROFILE_ROWS = [
  { key: 'shooting', label: 'Shooting', hint: 'Shots on goal and goals a game at tonight’s venue (ShotPropz, the venue board from four games there, all games until then; the stored box scores and PropFinder’s team table stand in), the word on the shots. Hover a cell for every source.' },
  { key: 'allows', label: 'Allows', hint: 'Shots on goal and goals allowed a game at tonight’s venue (ShotPropz; PropFinder’s table above the rink and the stored venue table stand in), the word on the shots: rank 1 = allows the most.' },
  { key: 'saves', label: 'Saves', hint: 'The saves the goalie likely in net is projected to make tonight: the shots the opponent is expected to put on him (the saved run’s λ shots summed over the opponent’s lineup; without a run, ShotPropz’s boards — the opponent’s shots a game at its venue and this team’s shots allowed at its own, their geometric mean) × his save percentage this season from the stored box scores (his own from three starts, shrunk toward the league’s; the team’s from ShotPropz until then, ranked 1 = the best). The likely starter is the one with the most starts over the team’s last ten, the other on the second night of a back-to-back; the hover says why. Once the game is stored, the goalie who played and his saves. Vincent, 2026-10-31.' },
  { key: 'powerplay', label: 'Power play', hint: 'Power-play percentage and the power plays the team draws a game at tonight’s venue (ShotPropz; PropFinder’s season figure stands in).' },
  { key: 'penaltykill', label: 'Penalty kill', hint: 'Penalty-kill percentage and the power plays the team gives a game at tonight’s venue (ShotPropz; PropFinder’s season figure stands in). Rank 1 = the softest kill.' },
  { key: 'last10', label: 'Last 10', hint: 'Shots for and against a game over the last ten (ShotPropz; the stored box scores stand in), the word on the shots for against the season: Rising / Falling at a tenth either way.' },
];

/**
 * The profile of one game. `game` is a slate game before this is added ({ away, home, sides,
 * verdicts, total }); `rates` from teamRates(), `pfTeams` PropFinder's team table (loadPropfinder().teams),
 * `shotpropz` the stored ShotPropz snapshot (loadShotpropz()).
 * Returns { order: [away, home], teams: { ABBR: head }, total, rows: [{ key, label, hint, cells: { ABBR: cell } }] }
 * — a cell { word, level, tone, parts: [{ t, tone? }], text, title, source } — or null when no row reads for either team.
 */
export function matchupProfile({ game, rates = null, pfTeams = null, shotpropz = null } = {}) {
  if (!game?.away || !game?.home || !Array.isArray(game.sides)) return null;
  const cells = {};
  const heads = {};
  const savePct = spzSavePct(shotpropz);
  for (let i = 0; i < game.sides.length; i++) {
    const s = game.sides[i];
    const other = game.sides[1 - i];
    const team = s.team;
    const where = s.venue === 'H' ? 'at home' : 'on the road';
    const def = other?.defense?.All || null; // what this team allows at its venue: the other side's object describes it
    const defN = def?.teamCount || 32;
    const pfd = pfDefenseOf(other?.propfinder?.tabs);
    const pfAll = pfd?.tab?.rows?.All || null;
    const pfN = pfd?.tab?.count || 32;
    const own = rates?.teams?.[team] || null;
    const ownRank = rates?.ranks?.[team] || {};
    const ownN = rates?.teamCount || 0;
    const pfT = pfTeamOf(pfTeams, team);
    const spz = spzTeamRead(shotpropz, team, s.venue);
    const spzStamp = spz ? `ShotPropz ${seasonLabel(spz.year)}${spz.updated ? `, ${spz.updated}` : ''}` : null;
    const out = {};

    // ── Shooting: shots and goals a game at the venue.
    {
      const sf = spz?.sf; const gf = spz?.gf;
      const hover = [];
      if (sf?.venue) hover.push(`ShotPropz ${AT[sf.venue.location]}: ${r1(sf.venue.value)} shots (${ordinal(sf.venue.rank)} of ${sf.venue.n}) and ${r2(gf?.venue?.value)} goals a game over ${sf.venue.gp} games`);
      if (sf?.all) hover.push(`all games ${r1(sf.all.value)} shots (${ordinal(sf.all.rank)}) and ${r2(gf?.all?.value)} goals`);
      if (own?.gp) hover.push(`stored box scores${own.held ? ` (${seasonLabel(own.season)}, no game this season yet)` : ''}: ${r1(own.sog)} shots (${ordinal(ownRank.sog)} of ${ownN}) and ${r2(own.g)} goals a game over ${own.gp} games`);
      if (pfT?.row.sog != null) hover.push(`PropFinder ${seasonLabel(pfT.season)}: ${r1(pfT.row.sog)} shots (${ordinal(pfT.ranks.sog)} of ${pfT.n}) and ${r2(pfT.row.g)} goals a game`);
      if (sf?.lead) {
        const b = badgeOf('attack', sf.lead.rank, sf.lead.n);
        out.shooting = cellOf(b, 'spz', [spzStamp, ...hover].join(' · '), [{ t: `${r1(sf.lead.value)} shots · ${r2(gf?.lead?.value)} goals a game ${AT[sf.leadAt]} (${sf.lead.gp} games) · ` }, rankPart('attack', sf.lead.rank, sf.lead.n, ' in shots')]);
      } else if (own && !own.held && own.gp >= MIN_OWN_GAMES) {
        const b = badgeOf('attack', ownRank.sog, ownN);
        out.shooting = cellOf(b, 'rink', hover.join(' · '), [{ t: `${r1(own.sog)} shots · ${r2(own.g)} goals a game over ${own.gp} stored games · ` }, rankPart('attack', ownRank.sog, ownN, ' in shots')]);
      } else if (pfT?.row.sog != null) {
        const b = badgeOf('attack', pfT.ranks.sog ?? null, pfT.n);
        out.shooting = cellOf(b, 'pf', hover.join(' · '), [{ t: `${r1(pfT.row.sog)} shots · ${r2(pfT.row.g)} goals a game · ` }, rankPart('attack', pfT.ranks.sog, pfT.n, ' in shots'), { t: ` · PropFinder ${seasonLabel(pfT.season)}` }]);
      }
    }

    // ── Allows: shots and goals allowed a game at the venue (rank 1 = the most).
    {
      const sa = spz?.sa; const ga = spz?.ga;
      const hover = [];
      if (sa?.venue) hover.push(`ShotPropz ${AT[sa.venue.location]}: ${r1(sa.venue.value)} shots (${ordinal(sa.venue.rank)} of ${sa.venue.n} most) and ${r2(ga?.venue?.value)} goals allowed a game over ${sa.venue.gp} games`);
      if (sa?.all) hover.push(`all games ${r1(sa.all.value)} shots (${ordinal(sa.all.rank)}) and ${r2(ga?.all?.value)} goals`);
      if (pfAll?.sog != null) hover.push(`PropFinder ${pfd.tab.label}${pfd.tab.source === 'stored' ? ' (stored games)' : ''}: ${r1(pfAll.sog)} shots (${ordinal(pfAll.ranks?.sog)} of ${pfN} most) and ${r2(pfAll.g)} goals allowed a game`);
      if (def?.season?.gp && def.source === 'games') hover.push(`stored box scores ${where}: ${r1(def.season.sog)} shots (${ordinal(def.rank?.sog)} of ${defN} most) and ${r2(def.season.g)} goals allowed a game over ${def.season.gp} games`);
      if (sa?.lead) {
        const b = badgeOf('defense', bestOf(sa.lead.rank, sa.lead.n), sa.lead.n);
        out.allows = cellOf(b, 'spz', [spzStamp, ...hover].join(' · '), [{ t: `${r1(sa.lead.value)} shots · ${r2(ga?.lead?.value)} goals allowed a game ${AT[sa.leadAt]} · ` }, rankPart('defense', sa.lead.rank, sa.lead.n, ' most')]);
      } else if (pfAll?.sog != null) {
        const b = badgeOf('defense', bestOf(pfAll.ranks?.sog, pfN), pfN);
        out.allows = cellOf(b, 'pf', hover.join(' · '), [{ t: `${r1(pfAll.sog)} shots · ${r2(pfAll.g)} goals allowed a game · ` }, rankPart('defense', pfAll.ranks?.sog, pfN, ' most'), { t: ` · PropFinder ${pfd.tab.label}` }]);
      } else if (def?.season?.gp) {
        const b = badgeOf('defense', bestOf(def.rank?.sog, defN), defN);
        out.allows = cellOf(b, 'rink', hover.join(' · '), [{ t: `${r1(def.season.sog)} shots · ${r2(def.season.g)} goals allowed a game ${where} over ${def.season.gp} stored games · ` }, rankPart('defense', def.rank?.sog, defN, ' most')]);
      }
    }

    // ── Saves: the shots the opponent is expected to put on this team's goalie × his save percentage (the likely
    // starter's own, shrunk, from three starts; the team's from ShotPropz until then); the box score once final.
    {
      const sv = savePct?.teams?.[team] || null;
      const gk = s.goalie || null;
      const ownSv = gk && gk.starts >= 3 ? gk.svPct : null;
      // Without ShotPropz or a starter the rink's venue table gives a save percentage (no rank): goals over shots allowed at the venue.
      const rinkSv = !sv && !ownSv && def?.season?.gp && def.source === 'games' && def.season.sog > 0 && def.season.g != null ? +(1 - def.season.g / def.season.sog).toFixed(3) : null;
      const pctOf = (v) => (v == null ? null : `.${String(Math.round(v * 1000)).padStart(3, '0')}`);
      // The shots against tonight: the run's λ shots over the opponent's lineup, else ShotPropz's boards (the opponent's shots at its venue, this team's shots allowed at its own, the geometric mean).
      const oppModel = (other?.skaters || []).filter((p) => p.inLineup !== false && p.model && p.model.sog != null);
      const lamShots = oppModel.length >= 10 ? +oppModel.reduce((acc, p) => acc + (Number(p.model.sog) || 0), 0).toFixed(1) : null;
      const oppSpz = spzTeamRead(shotpropz, s.opp, other?.venue || (s.venue === 'H' ? 'A' : 'H'));
      const oppSf = oppSpz?.sf?.lead?.value ?? null;
      const ownSa = spz?.sa?.lead?.value ?? null;
      const spzShots = oppSf != null && ownSa != null ? +Math.sqrt(oppSf * ownSa).toFixed(1) : oppSf ?? ownSa;
      const shots = lamShots ?? spzShots;
      const svUse = ownSv ?? sv?.sv ?? rinkSv;
      const lastName = (n) => String(n || '').split(' ').slice(-1)[0];
      // Once the game is stored: the goalie who played, his saves on his shots against.
      const played = (game.log?.goalies || []).filter((k) => k.team === team && (k.sa > 0 || k.starter)).sort((a, b) => b.sa - a.sa)[0] || null;
      if (shots != null && svUse != null) {
        const saves = +(shots * svUse).toFixed(1);
        const b = sv ? badgeOf('goalie', sv.rank, savePct.n) : { word: null, level: null, tone: '' };
        const from = lamShots != null ? `the run’s λ over ${oppModel.length} ${s.opp} skaters` : `ShotPropz: ${s.opp} ${r1(oppSf)} shots a game ${AT[oppSpz?.sf?.leadAt] || ''}, ${team} ${r1(ownSa)} allowed ${AT[spz?.sa?.leadAt] || ''}`;
        // The line names the goalie when his own percentage leads; the team's rank (the word) follows the team's figure otherwise.
        const parts = ownSv
          ? [{ t: `~${Math.round(saves)} saves expected · ${r1(shots)} shots faced · ${lastName(gk.name)} likely · ${pctOf(gk.svPct)} over ${gk.starts} starts` }]
          : [{ t: `~${Math.round(saves)} saves expected · ${r1(shots)} shots faced · ${gk ? `${lastName(gk.name)} likely (${gk.starts} start${gk.starts === 1 ? '' : 's'}) · ` : ''}team ${pctOf(svUse)} save % ` }];
        if (!ownSv && sv) parts.push({ t: '(' }, { t: `${ordinal(sv.rank)} of ${savePct.n}`, tone: b.tone }, { t: ')' });
        else if (!ownSv && rinkSv != null) parts.push({ t: `(${where}, stored games)` });
        if (played) parts.push({ t: ` · got ${lastName(played.name)} ${played.sv} of ${played.sa}` });
        const hover = [
          `${r1(shots)} shots faced expected (${from}) × ${pctOf(svUse)} = ${saves} saves`,
          gk ? `${gk.name} likely in net: ${gk.reason}${gk.b2b ? ' (back to back)' : ''}; ${gk.starts} start${gk.starts === 1 ? '' : 's'}, ${gk.sv} saves on ${gk.sa} shots${gk.pct != null ? ` (${pctOf(gk.pct)}, shrunk to ${pctOf(gk.svPct)})` : ''}${gk.savesPerStart != null ? `, ${gk.savesPerStart} saves a start` : ''}${gk.other ? ` · the other way: ${gk.other.name}, ${gk.other.starts} start${gk.other.starts === 1 ? '' : 's'}` : ''}${gk.held ? ' · last season’s goalies, no game this season yet' : ''}` : 'no goalie on record for the team: the team’s save percentage stands in',
          sv ? `the team’s save percentage this season, all games: ${r2(sv.ga)} goals on ${r1(sv.sa)} shots allowed a game, ${ordinal(sv.rank)} of ${savePct.n} · ShotPropz` : rinkSv != null ? `the team’s save percentage ${where} from the stored box scores` : null,
          played ? `the box score: ${played.name} ${played.sv} saves on ${played.sa} shots${played.starter ? '' : ' (in relief)'}` : null,
        ].filter(Boolean).join(' · ');
        out.saves = cellOf(b, ownSv ? 'rink' : sv ? 'spz' : 'rink', hover, parts);
      }
    }

    // ── Power play: PP% and the power plays drawn a game at the venue.
    {
      const pp = spz?.ppPct; const ppo = spz?.ppo;
      const pfPp = pfT?.row.ppPct != null ? { value: r1(pfT.row.ppPct), rank: pfT.ranks.ppPct ?? null, n: pfT.n } : null;
      const hover = [];
      if (pp?.venue) hover.push(`ShotPropz ${AT[pp.venue.location]}: ${r1(pp.venue.value)}% (${ordinal(pp.venue.rank)} of ${pp.venue.n}), ${r1(ppo?.venue?.value)} power plays a game, ${pp.venue.gp} games`);
      if (pp?.all) hover.push(`all games ${r1(pp.all.value)}% (${ordinal(pp.all.rank)}), ${r1(ppo?.all?.value)} a game`);
      if (pp?.l10) hover.push(`last 10 ${r1(pp.l10.value)}% (${ordinal(pp.l10.rank)})`);
      if (pfPp) hover.push(`PropFinder ${seasonLabel(pfT.season)}: ${pfPp.value}% (${ordinal(pfPp.rank)} of ${pfPp.n})`);
      if (pp?.lead) {
        const b = badgeOf('attack', pp.lead.rank, pp.lead.n);
        out.powerplay = cellOf(b, 'spz', [spzStamp, ...hover].join(' · '), [{ t: `${r1(pp.lead.value)}% · draws ${r1(ppo?.lead?.value)} power plays a game ${AT[pp.leadAt]} · ` }, rankPart('attack', pp.lead.rank, pp.lead.n)]);
      } else if (pfPp) {
        const b = badgeOf('attack', pfPp.rank, pfPp.n);
        out.powerplay = cellOf(b, 'pf', hover.join(' · '), [{ t: `${pfPp.value}% on the power play · ` }, rankPart('attack', pfPp.rank, pfPp.n), { t: ` · PropFinder ${seasonLabel(pfT.season)}` }]);
      }
    }

    // ── Penalty kill: PK% and the power plays given a game at the venue (rank 1 = the softest kill).
    {
      const pk = spz?.pkPct; const ppoa = spz?.ppoa;
      const pfPk = pfT?.row.pkPct != null ? { value: r1(pfT.row.pkPct), rank: pfT.ranks.pkPct ?? null, n: pfT.n } : null;
      const hover = [];
      if (pk?.venue) hover.push(`ShotPropz ${AT[pk.venue.location]}: ${r1(pk.venue.value)}% (${ordinal(pk.venue.rank)} of ${pk.venue.n} softest), gives ${r1(ppoa?.venue?.value)} power plays a game, ${pk.venue.gp} games`);
      if (pk?.all) hover.push(`all games ${r1(pk.all.value)}% (${ordinal(pk.all.rank)}), gives ${r1(ppoa?.all?.value)} a game`);
      if (pk?.l10) hover.push(`last 10 ${r1(pk.l10.value)}% (${ordinal(pk.l10.rank)})`);
      if (pfPk) hover.push(`PropFinder ${seasonLabel(pfT.season)}: ${pfPk.value}% (${ordinal(pfPk.rank)} of ${pfPk.n}, 1 = the best kill)`);
      if (pk?.lead) {
        const b = badgeOf('defense', bestOf(pk.lead.rank, pk.lead.n), pk.lead.n);
        out.penaltykill = cellOf(b, 'spz', [spzStamp, ...hover].join(' · '), [{ t: `${r1(pk.lead.value)}% · gives ${r1(ppoa?.lead?.value)} power plays a game ${AT[pk.leadAt]} · ` }, rankPart('defense', pk.lead.rank, pk.lead.n, ' softest')]);
      } else if (pfPk) {
        const b = badgeOf('defense', pfPk.rank, pfPk.n);
        // PropFinder's PK% rank is 1 = the best kill: the attack kind's ordering, the defense words.
        out.penaltykill = cellOf(b, 'pf', hover.join(' · '), [{ t: `${pfPk.value}% on the penalty kill · ` }, { t: `${ordinal(pfPk.rank)} of ${pfPk.n}`, tone: b.tone }, { t: ` · PropFinder ${seasonLabel(pfT.season)}` }]);
      }
    }

    // ── Last 10: shots for and against over the last ten, the word on the shots for against the season.
    {
      const form = (l10, season) => {
        const ratio = season > 0 ? l10 / season : 1;
        const level = ratio >= 1 + FORM_EDGE ? 'rising' : ratio <= 1 - FORM_EDGE ? 'falling' : 'steady';
        return { level, word: { rising: 'Rising', falling: 'Falling', steady: 'Steady' }[level], tone: level === 'rising' ? 'is-soft' : level === 'falling' ? 'is-tough' : '' };
      };
      const sf = spz?.sf?.l10; const sa = spz?.sa?.l10; const gf = spz?.gf?.l10; const ga = spz?.ga?.l10;
      if (sf && spz?.sf?.all) {
        out.last10 = cellOf(form(sf.value, spz.sf.all.value), 'spz', `${spzStamp} · the last ten regular-season games: ${r1(sf.value)} shots for (${ordinal(sf.rank)} of ${sf.n}) against ${r1(spz.sf.all.value)} on the season · ${r1(sa?.value)} shots allowed (${ordinal(sa?.rank)} most) · ${r2(gf?.value)} goals for, ${r2(ga?.value)} against`, [
          { t: `${r1(sf.value)} shots for (` }, { t: ordinal(sf.rank), tone: badgeOf('attack', sf.rank, sf.n).tone }, { t: `) · ${r1(sa?.value)} against (` },
          sa ? { t: `${ordinal(sa.rank)} most`, tone: badgeOf('defense', bestOf(sa.rank, sa.n), sa.n).tone } : { t: '—' }, { t: `) · ${r2(gf?.value)}–${r2(ga?.value)} goals a game` },
        ]);
      } else if (own?.l10 && !own.held && own.gp >= MIN_OWN_GAMES) {
        const l10 = own.l10;
        const against = def?.l10?.gp ? def.l10 : null;
        out.last10 = cellOf(form(l10.sog, own.sog), 'rink', `stored box scores: ${r1(l10.sog)} shots for over the last ${l10.gp} against ${r1(own.sog)} on the season${against ? ` · ${r1(against.sog)} allowed over its last ${against.gp} (${ordinal(def.l10Rank?.sog)} of ${defN} most)` : ''}`, [
          { t: `${r1(l10.sog)} shots for` },
          ...(against ? [{ t: ` · ${r1(against.sog)} against (` }, { t: `${ordinal(def.l10Rank?.sog)} most`, tone: badgeOf('defense', bestOf(def.l10Rank?.sog, defN), defN).tone }, { t: ')' }] : []),
          { t: ` · ${r2(l10.g)}${against ? `–${r2(against.g)}` : ''} goals a game · stored games` },
        ]);
      }
    }

    cells[team] = out;
    const v = game.verdicts?.[team] || null;
    heads[team] = {
      team, venue: s.venue, opp: s.opp,
      games: own && !own.held ? own.gp : 0,
      shotpropz: spz ? { updated: spz.updated, venueGames: spz.sf?.venue?.gp ?? spz.gf?.venue?.gp ?? null, leadAt: spz.sf?.leadAt || spz.pkPct?.leadAt || 'all' } : null,
      verdict: v ? { headline: v.headline, tier: v.tier } : null,
    };
  }

  const order = [game.away, game.home];
  const rows = PROFILE_ROWS.map((row) => ({ ...row, cells: Object.fromEntries(order.map((team) => [team, cells[team]?.[row.key] || null])) })).filter((row) => order.some((team) => row.cells[team]));
  if (!rows.length) return null;
  const total = game.total ? { headline: game.total.headline, tier: game.total.tier, projected: game.total.projected, league: game.total.league } : null;
  return { order, teams: heads, total, rows };
}
