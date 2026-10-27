// The picks scorecard: what the board said before each game against what the box score says
// happened, for the NFL and NBA boards alike. Every play the board priced (the chance of the
// hit, the book's price, the edge, whether it made a table) and every rung of every ladder is
// replayed per stored slate and graded: hit rate against the stated chance by bucket, Brier,
// by market, by matchup third, by source (confirmed by the sheet / PropFinder alone / the sheet
// alone), by form, by edge against the book, and the ladders' three reads (the model's tail,
// the hit rate, the blend) side by side. Descriptive only: nothing here feeds the board.
//
// The replay is leak-free by construction: a slate's board is rebuilt from its stored files with
// each player's PropFinder log cut before the ET date of his team's game (`asOf`), so a pull run
// after the games cannot grade a game with its own line in the rates. (The pull's defense tables
// are left as pulled: one game in a 15-game blend moves nothing worth a second file.)
import { impliedProb } from '../nfl/odds';
import { upperTail } from './projection';

const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const dec = (odds) => (odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds);

/** Probability buckets for the calibration tables. */
export const BUCKETS = [
  { key: 'b0', label: 'under 20%', lo: 0, hi: 0.2 },
  { key: 'b20', label: '20–30%', lo: 0.2, hi: 0.3 },
  { key: 'b30', label: '30–40%', lo: 0.3, hi: 0.4 },
  { key: 'b40', label: '40–50%', lo: 0.4, hi: 0.5 },
  { key: 'b50', label: '50–60%', lo: 0.5, hi: 0.6 },
  { key: 'b60', label: '60–70%', lo: 0.6, hi: 0.7 },
  { key: 'b70', label: '70–80%', lo: 0.7, hi: 0.8 },
  { key: 'b80', label: '80% and up', lo: 0.8, hi: 1.01 },
];

/** Edge buckets (the chance minus the book's implied probability, in points). */
export const EDGE_BUCKETS = [
  { key: 'e_neg', label: 'no edge (0 or under)', lo: -2, hi: 0 },
  { key: 'e0', label: '0 to 3 pts', lo: 0, hi: 0.03 },
  { key: 'e3', label: '3 to 6 pts', lo: 0.03, hi: 0.06 },
  { key: 'e6', label: '6 pts and up', lo: 0.06, hi: 2 },
];

/**
 * The predictors of a player's figure compared on the scorecard: the plain windows of his own
 * results before the game, his head to head (his last meetings with the opponent; `sparse`: not
 * every player-game has two, so it is scored on the rows it has and never thins the rows the
 * others are compared on — the projection and the blend are scored on its rows beside it,
 * `against`), the board's blend of them (season with last ten), the projection the ladders
 * centre on (the blend × the matchup × the team scale), and the book's main line.
 */
export const PREDICTORS = [
  { key: 'own3', label: 'Last 3', source: 'own' },
  { key: 'own5', label: 'Last 5', source: 'own' },
  { key: 'own10', label: 'Last 10', source: 'own' },
  { key: 'own20', label: 'Last 20', source: 'own' },
  { key: 'ownSeason', label: 'Season to date', source: 'own' },
  { key: 'h2h', label: 'Head to head', source: 'own', sparse: true, note: 'His average over his last 4 meetings with the opponent before the game, two meetings at least; scored on the player-games that have them, with the projection and the blend on those same rows beside it' },
  { key: 'own5x', label: 'Last 5 × matchup', source: 'own' },
  { key: 'own10x', label: 'Last 10 × matchup', source: 'own' },
  { key: 'ownSeasonx', label: 'Season × matchup', source: 'own' },
  { key: 'blend', label: 'Board’s blend', source: 'board' },
  { key: 'proj', label: 'Projection', source: 'board' },
  { key: 'line', label: 'The book’s line', source: 'book' },
];

export const THIRDS = [['soft', 'Soft third'], ['mid', 'Middle third'], ['tough', 'Stingy third'], ['none', 'No table']];
export const SOURCES = [['confirmed', 'PropFinder, confirmed by the sheet'], ['propfinder', 'PropFinder alone'], ['sheet', 'The sheet alone']];
export const FORMS = [['hot', 'Hot'], ['cold', 'Cold'], ['none', 'Neither']];

/** A game's date on the US East Coast (slates are dated in ET). */
export function etDate(iso) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}

/**
 * The pull as it stood before each game: every player keeps the log rows dated before the ET
 * date of his team's game in the slate and loses the rest.
 */
export function asOf(pf, games) {
  if (!pf?.data?.players) return pf;
  const dateOfTeam = new Map();
  for (const g of games || []) { const d = etDate(g.date); if (!d) continue; if (g.away) dateOfTeam.set(g.away, d); if (g.home) dateOfTeam.set(g.home, d); }
  const players = pf.data.players.map((p) => {
    const d = dateOfTeam.get(p.team);
    if (!d || !Array.isArray(p.games)) return p;
    return { ...p, games: p.games.filter((x) => String(x.date || '').slice(0, 10) < d) };
  });
  return { ...pf, data: { ...pf.data, players } };
}

/**
 * One slate's graded rows from its built board: every finished game's plays (each with its
 * chance, price, edge, whether it made a table) and every ladder rung against his figure.
 * `actualOf(game, player, market)` gives a player's box-score figure for a market (null = did
 * not play, undefined = no box score); without it a rung is graded off the player's plays.
 */
export function gradeBoard(board, { key, label, actualOf = null } = {}) {
  const plays = [];
  const rungs = [];
  const games = board?.games || [];
  let graded = 0;
  for (const g of games) {
    if (!g.final) continue;
    const onBoard = new Map();
    for (const t of Object.values(g.tables || {})) for (const r of t.rows || []) onBoard.set(r.id, { under: !!r.under, sheetOnly: !!r.sheetOnly });
    let any = false;
    for (const side of Object.values(g.sides || {})) {
      for (const p of side.players || []) {
        for (const x of p.plays || []) {
          if (x.hit == null) continue;
          any = true;
          const b = onBoard.get(x.id) || null;
          const implied = x.odds != null ? impliedProb(x.side === 'under' || x.side === 'no' ? x.odds : x.odds) : null;
          plays.push({
            slate: key, game: g.id, player: p.player, key: p.key, team: side.team, opp: side.opp, venue: side.venue, pos: p.pos || null, slot: p.slot || null,
            market: x.market, group: x.group, label: x.label, line: x.line, side: x.side, p: x.p, implied: r3(implied), edge: x.edge ?? null, odds: x.odds ?? null,
            hit: x.hit ? 1 : 0, actual: x.actual ?? null, onBoard: !!b && !b.under && !b.sheetOnly, under: !!b?.under, overFloor: x.p >= x.floor, floor: x.floor,
            main: x.main !== false, confirmed: !!x.confirmed, pfBacked: !!x.pfBacked, source: x.confirmed ? 'confirmed' : x.pfBacked ? 'propfinder' : 'sheet',
            third: x.spot ? (x.spot.soft ? 'soft' : x.spot.tough ? 'tough' : 'mid') : 'none', form: x.form || 'none',
          });
        }
        for (const [market, lad] of Object.entries(p.ladders || {})) {
          const actual = actualOf ? actualOf(g, p, market) : (p.plays || []).find((x) => x.market === market && x.actual != null)?.actual;
          if (actual == null) continue;
          any = true;
          for (const r of lad) rungs.push({ slate: key, game: g.id, key: p.key, market, line: r.line, p: r.p, model: r.model, emp: r.emp, priced: r.odds != null, odds: r.odds ?? null, main: !!r.main, hit: actual > r.line ? 1 : 0 });
        }
      }
    }
    if (any) graded++;
  }
  return { key, label: label || key, games: games.length, finals: games.filter((g) => g.final).length, graded, plays, rungs };
}

/**
 * One slate's predictor rows: for every player with a ladder and a box-score line, per ladder
 * market, his figure beside the windows of his own results before the game (from the cut pull),
 * the board's blend, the projection and the book's main line, with his spread for the
 * over-the-line read. `ownWindows` is the sport's (makeBoard's) window reader.
 */
export function gradePredictors(board, pf, { key, season, actualOf, ownWindows }) {
  const rows = [];
  const pfByKey = new Map();
  for (const p of pf?.data?.players || []) if (!pfByKey.has(p.key)) pfByKey.set(p.key, p);
  for (const g of board?.games || []) {
    if (!g.final) continue;
    for (const side of Object.values(g.sides || {})) {
      for (const p of side.players || []) {
        const pfp = pfByKey.get(p.key);
        if (!pfp?.games?.length) continue;
        for (const [market, lad] of Object.entries(p.ladders || {})) {
          if (!lad?.length) continue;
          const actual = actualOf(g, p, market);
          if (actual == null) continue;
          const own = ownWindows(pfp.games, { market, season, opp: side.opp || null });
          const env = lad[0].env ?? null;
          const main = lad.find((r) => r.main) || null;
          // A window × the matchup is the centre the shuffle reads from (centreOf in shuffle.js: × env, to 0.1).
          const x = (v) => (v == null ? null : Math.round(v * (env ?? 1) * 10) / 10);
          rows.push({
            slate: key, game: g.id, key: p.key, market, actual, sd: lad[0].sd, line: main?.line ?? null, env,
            own3: own.l3, own5: own.l5, own10: own.l10, own20: own.l20, ownSeason: own.season, h2h: own.h2h, h2hN: own.h2hN,
            own5x: x(own.l5), own10x: x(own.l10), ownSeasonx: x(own.season),
            blend: env ? Math.round((lad[0].proj / env) * 10) / 10 : lad[0].proj, proj: lad[0].proj,
          });
        }
      }
    }
  }
  return rows;
}

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** How a predictor does on rows: the figure projected against the actual, and the over-the-line read it implies. */
function predictorScore(key, rows) {
  const pairs = rows.filter((r) => r[key] != null);
  if (!pairs.length) return { key, n: 0, avg: null, actual: null, bias: null, mae: null, rmse: null, said: null, hit: null, brier: null, lined: 0 };
  const err = pairs.map((r) => r[key] - r.actual);
  const lined = pairs.filter((r) => r.line != null && r.sd > 0);
  const probs = lined.map((r) => upperTail((r.line - r[key]) / r.sd));
  const hits = lined.map((r) => (r.actual > r.line ? 1 : 0));
  return {
    key, n: pairs.length, avg: r2(mean(pairs.map((r) => r[key]))), actual: r2(mean(pairs.map((r) => r.actual))),
    bias: r2(mean(err)), mae: r2(mean(err.map(Math.abs))), rmse: r2(Math.sqrt(mean(err.map((e) => e * e)))),
    lined: lined.length, said: r3(mean(probs)), hit: r3(mean(hits)), brier: lined.length ? r4(mean(probs.map((p, i) => (p - hits[i]) ** 2))) : null,
  };
}

/**
 * The predictors on one market: each on its own rows, and all on the rows every predictor with
 * any rows covers (the fair comparison). A sparse predictor (head to head) never thins those rows:
 * it is scored on the common rows it has, with the projection and the blend scored on those same
 * rows beside it (`against`), so its line reads against the board on equal terms.
 */
export function predictorReport(rows, market, label = market) {
  const list = rows.filter((r) => r.market === market);
  const each = PREDICTORS.map((p) => ({ ...p, ...predictorScore(p.key, list) }));
  const covered = each.filter((p) => p.n).map((p) => p.key);
  const dense = covered.filter((k) => !PREDICTORS.find((p) => p.key === k)?.sparse);
  const common = list.filter((r) => dense.every((k) => r[k] != null));
  const predictors = PREDICTORS.filter((p) => covered.includes(p.key)).map((p) => {
    if (!p.sparse) return { ...p, ...predictorScore(p.key, common) };
    const mine = common.filter((r) => r[p.key] != null);
    return { ...p, ...predictorScore(p.key, mine), against: { proj: predictorScore('proj', mine), blend: predictorScore('blend', mine) } };
  });
  return { key: market, label, n: list.length, each, common: { n: common.length, predictors } };
}

/** Hit rate against the stated chance over a list of { p, hit }. */
export function score(list) {
  if (!list.length) return { n: 0, said: null, hit: null, diff: null, brier: null };
  const said = mean(list.map((c) => c.p));
  const hit = mean(list.map((c) => c.hit));
  return { n: list.length, said: r3(said), hit: r3(hit), diff: r3(hit - said), brier: r4(mean(list.map((c) => (c.p - c.hit) ** 2))) };
}

/** The same with the book in it: the average implied probability and the flat-stake return per unit at the book's price. */
export function scorePriced(list) {
  const priced = list.filter((c) => c.odds != null);
  const base = score(list);
  if (!priced.length) return { ...base, priced: 0, implied: null, ret: null };
  return { ...base, priced: priced.length, implied: r3(mean(priced.map((c) => c.implied))), ret: r3(mean(priced.map((c) => (c.hit ? dec(c.odds) - 1 : -1)))) };
}

const inBucket = (b) => (c) => c.p >= b.lo && c.p < b.hi;
const orderOf = (list) => [...new Set(list)];

/** The whole report over the graded slates (gradeBoard() records), newest slate first. */
export function summarize(graded, { from = null, to = null, markets = null, labels = null } = {}) {
  const plays = graded.flatMap((g) => g.plays);
  const rungs = graded.flatMap((g) => g.rungs);
  const pred = graded.flatMap((g) => g.pred || []);
  const board = plays.filter((x) => x.onBoard);
  const both = (list) => ({ all: score(list), board: score(list.filter((x) => x.onBoard)) });
  const keyed = (pairs, keyOf) => pairs.map(([key, label]) => ({ key, label, ...both(plays.filter((x) => keyOf(x) === key)) }));
  const marketKeys = markets || orderOf(plays.map((x) => x.market));
  const labelOf = (k) => labels?.[k] || plays.find((x) => x.market === k)?.label || k;
  const groupOf = (k) => plays.find((x) => x.market === k)?.group || null;
  const rungSet = (list) => {
    const common = list.filter((r) => r.emp != null);
    const on = (field) => score(common.map((r) => ({ p: r[field], hit: r.hit })));
    return { n: list.length, common: common.length, priced: list.filter((r) => r.priced).length, model: on('model'), emp: on('emp'), blend: on('p') };
  };
  return {
    from, to, builtAt: new Date().toISOString(),
    slates: graded.length, games: graded.reduce((s, g) => s + g.finals, 0), graded: graded.reduce((s, g) => s + g.graded, 0),
    plays: plays.length, boardPlays: board.length,
    all: scorePriced(plays), board: scorePriced(board),
    buckets: BUCKETS.map((b) => ({ ...b, ...both(plays.filter(inBucket(b))) })),
    markets: marketKeys.filter((k) => plays.some((x) => x.market === k)).map((k) => ({ key: k, label: labelOf(k), group: groupOf(k), ...both(plays.filter((x) => x.market === k)) })),
    groups: orderOf(plays.map((x) => x.group)).map((k) => ({ key: k, ...both(plays.filter((x) => x.group === k)) })),
    thirds: keyed(THIRDS, (x) => x.third),
    sources: keyed(SOURCES, (x) => x.source),
    forms: keyed(FORMS, (x) => x.form),
    edges: EDGE_BUCKETS.map((b) => { const list = plays.filter((x) => x.edge != null && x.edge >= b.lo && x.edge < b.hi); return { ...b, all: scorePriced(list), board: scorePriced(list.filter((x) => x.onBoard)) }; }),
    ladders: orderOf(rungs.map((r) => r.market)).map((k) => {
      const list = rungs.filter((r) => r.market === k);
      return {
        key: k, label: labelOf(k), ...rungSet(list),
        main: score(list.filter((r) => r.main).map((r) => ({ p: r.p, hit: r.hit }))),
        ceiling: score(list.filter((r) => r.p >= 0.2 && r.p < 0.35).map((r) => ({ p: r.p, hit: r.hit }))),
        buckets: BUCKETS.map((b) => ({ ...b, ...score(list.filter(inBucket(b)).map((r) => ({ p: r.p, hit: r.hit }))) })),
      };
    }),
    predictors: (markets || orderOf(pred.map((r) => r.market))).filter((k) => pred.some((r) => r.market === k)).map((k) => predictorReport(pred, k, labelOf(k))),
    bySlate: [...graded].sort((a, b) => String(b.key).localeCompare(String(a.key))).map((g) => ({ key: g.key, label: g.label, games: g.games, finals: g.finals, graded: g.graded, plays: g.plays.length, ...both(g.plays) })),
  };
}
