// The Patterns tab's numbers (Vincent, 2026-10-30: "look at literally every data point that is available to detect
// patterns … the outcome should be pills"): every skater-game of the season read the morning of the game, the
// season's rows walked in date order so each game's figures come from the games before it — his own windows, his
// home / away split, his streaks, what tonight's opponent gives up to his position and his line slot in attempts,
// unblocked attempts, chances and shots by window, the teams' totals, rest, the head to head. The study
// (tools/predictors/patterns-rows.mjs → patterns.py) mines its rules from these figures and the site checks the same
// rules on the same figures, so a pattern found offline is the one the pill fires on.
//
// This season alone (Vincent, 2026-10-30: "forget about last season"): a row before `seasonStart` of the date read
// is never counted. Pure: no store import (the panel shares the labels).

export const MARKS = [
  { key: 's3', stat: 'sog', at: 3, label: '3+ SOG', short: '3+', group: 'shots' },
  { key: 's4', stat: 'sog', at: 4, label: '4+ SOG', short: '4+', group: 'shots' },
  { key: 's5', stat: 'sog', at: 5, label: '5+ SOG', short: '5+', group: 'shots' },
  { key: 's6', stat: 'sog', at: 6, label: '6+ SOG', short: '6+', group: 'shots' },
  { key: 'g1', stat: 'g', at: 1, label: '1+ goal', short: '1+ G', group: 'goals' },
  { key: 'g2', stat: 'g', at: 2, label: '2+ goals', short: '2+ G', group: 'goals' },
  { key: 'g3', stat: 'g', at: 3, label: '3+ goals', short: '3+ G', group: 'goals' },
];

const POS = ['C', 'LW', 'RW', 'D'];
// His own figures a game (pts = g + a); the opponent's allowed reads.
export const OWN_STATS = ['sog', 'icf', 'iff', 'iscf', 'ihdcf', 'g', 'a', 'pts', 'toi', 'hits', 'blk'];
export const DEF_STATS = ['sog', 'icf', 'iff', 'iscf', 'ihdcf', 'g', 'pts'];
const SLOT_STATS = ['sog', 'icf', 'iscf', 'g'];
// A team's totals for / against a game: shots, attempts, unblocked attempts, chances, high-danger chances, goals.
export const TOT = { s: 'sog', c: 'icf', f: 'iff', sc: 'iscf', hdc: 'ihdcf', g: 'g' };
const WINDOWS = [['', null], ['_l5', 5], ['_l10', 10]];

const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** The regular season a date belongs to starts the previous July: "2026-10-13" → "2026-07-01". */
export function seasonStart(date) {
  const y = Number(String(date).slice(0, 4)); const m = Number(String(date).slice(5, 7));
  return `${m >= 7 ? y : y - 1}-07-01`;
}

/** A skater's slot key on a row: "LW1", "D2"; null without a line. */
export const slotKey = (pos, line) => (pos && line != null && line !== '' && Number(line) > 0 ? `${pos}${Number(line)}` : null);

const streak = (games, hit) => { let n = 0; for (let i = games.length - 1; i >= 0 && hit(games[i]); i--) n++; return n; };
const sinceLast = (games, hit) => { for (let i = games.length - 1; i >= 0; i--) if (hit(games[i])) return games.length - 1 - i; return games.length; };

function ownGame(r) {
  const g = { date: r.date, venue: r.venue, opp: r.opp };
  for (const k of OWN_STATS) g[k] = k === 'pts' ? num(r.g) + num(r.a) : num(r[k]);
  return g;
}

/** One team's side of one game: what its skaters did, by position and slot, and in all (its attack; the opponent's defense). */
function sideAgg(rows) {
  const pos = {}; const slot = {}; const tot = { n: 0 };
  for (const k of Object.values(TOT)) tot[k] = 0;
  for (const r of rows) {
    const p = r.pos;
    const add = (bucket) => { bucket.n = (bucket.n || 0) + 1; for (const k of DEF_STATS) bucket[k] = (bucket[k] || 0) + (k === 'pts' ? num(r.g) + num(r.a) : num(r[k])); };
    if (POS.includes(p)) add(pos[p] ||= {});
    const sk = slotKey(p, r.line);
    if (sk) add(slot[sk] ||= {});
    tot.n += 1; for (const k of Object.values(TOT)) tot[k] += num(r[k]);
  }
  return { pos, slot, tot };
}

/**
 * The season walked one date at a time. `addDate(rows)` takes every row of a date (after the date's features are
 * read); `features(sk)` reads a skater-game ({ playerId, team, opp, venue, pos, line, date }) from what was added
 * before. A row before the season of the first date added starts nothing.
 */
export function makeTracker() {
  const players = new Map();   // playerId → his games, date order
  const def = new Map();       // team → its defense games: { date, venue, pos, slot, tot } (what the opponents' skaters did)
  const att = new Map();       // team → its own skaters' games in all: { date, tot }
  const teamDates = new Map(); // team → the dates it played
  const league = { pos: {}, slot: {}, games: 0, tot: {} };
  let version = 0; let rankCache = null;

  function addDate(rows) {
    const bySide = new Map();
    for (const r of rows) {
      if (r.playerId == null || !r.team || !r.opp) continue;
      const list = players.get(r.playerId) || [];
      list.push(ownGame(r)); players.set(r.playerId, list);
      const k = `${r.gameId}|${r.team}`;
      if (!bySide.has(k)) bySide.set(k, { team: r.team, opp: r.opp, venue: r.venue, date: r.date, rows: [] });
      bySide.get(k).rows.push(r);
    }
    for (const s of bySide.values()) {
      const agg = sideAgg(s.rows);
      // The opponent defended against these skaters, at the other venue.
      const d = def.get(s.opp) || []; d.push({ date: s.date, venue: s.venue === 'H' ? 'A' : 'H', ...agg }); def.set(s.opp, d);
      const a = att.get(s.team) || []; a.push({ date: s.date, tot: agg.tot }); att.set(s.team, a);
      for (const t of [s.team, s.opp]) { const ds = teamDates.get(t) || []; if (ds[ds.length - 1] !== s.date) ds.push(s.date); teamDates.set(t, ds); }
      for (const [p, b] of Object.entries(agg.pos)) { const L = (league.pos[p] ||= { n: 0 }); L.n += b.n; for (const k of DEF_STATS) L[k] = (L[k] || 0) + b[k]; }
      for (const [p, b] of Object.entries(agg.slot)) { const L = (league.slot[p] ||= { n: 0, games: 0 }); L.n += b.n; L.games += 1; for (const k of DEF_STATS) L[k] = (L[k] || 0) + b[k]; }
      league.games += 1; for (const k of Object.values(TOT)) league.tot[k] = (league.tot[k] || 0) + agg.tot[k];
    }
    version += 1;
  }

  /** Per skater at a position over a team's defense games (the last n, or those at a venue). */
  function perSkater(games, pos, stat) {
    let n = 0; let s = 0;
    for (const g of games) { const b = g.pos[pos]; if (b) { n += b.n; s += b[stat]; } }
    return n ? s / n : null;
  }
  const lastN = (list, n) => (n ? list.slice(-n) : list);
  const totPer = (games, k) => (games.length ? games.reduce((s, g) => s + g.tot[k], 0) / games.length : null);

  /** Ranks across the teams with games: 1 = gives up the most (per skater at a position, and team totals). */
  function ranks() {
    if (rankCache?.version === version) return rankCache;
    const out = { version, pos: {}, tot: {} };
    const teams = [...def.keys()];
    const rankOf = (vals) => {
      const sorted = Object.entries(vals).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
      const r = {}; sorted.forEach(([t], i) => { r[t] = i + 1; });
      return { r, count: sorted.length };
    };
    for (const [suffix, n] of WINDOWS) {
      for (const p of POS) for (const k of DEF_STATS) {
        const vals = {}; for (const t of teams) vals[t] = perSkater(lastN(def.get(t), n), p, k);
        out.pos[`${p}|${k}${suffix}`] = rankOf(vals);
      }
      for (const [abbr, k] of Object.entries(TOT)) {
        const vals = {}; for (const t of teams) vals[t] = totPer(lastN(def.get(t), n), k);
        out.tot[`${abbr}${suffix}`] = rankOf(vals);
      }
    }
    rankCache = out;
    return out;
  }

  function features(sk) {
    const f = {};
    const pos = sk.pos; const venue = sk.venue; const date = sk.date;
    const H = players.get(sk.playerId) || [];
    const n = H.length;
    f.gp = n;
    f.home = venue === 'H' ? 1 : 0;
    f.fwd = pos === 'D' ? 0 : 1;
    f.pos = pos;
    f.line = sk.line != null && sk.line !== '' && Number(sk.line) > 0 ? Number(sk.line) : null;
    f.slot = slotKey(pos, f.line);
    // His own windows.
    for (const k of OWN_STATS) {
      f[`${k}_avg`] = r3(mean(H.map((g) => g[k])));
      for (const w of [3, 5, 10]) f[`${k}_l${w}`] = r3(mean(H.slice(-w).map((g) => g[k])));
    }
    const toiSum = H.reduce((s, g) => s + g.toi, 0);
    for (const k of ['sog', 'icf', 'iscf', 'g']) f[`${k}60`] = toiSum > 0 ? r3((H.reduce((s, g) => s + g[k], 0) / toiSum) * 60) : null;
    const sogSum = H.reduce((s, g) => s + g.sog, 0);
    f.shpct = sogSum > 0 ? r3(H.reduce((s, g) => s + g.g, 0) / sogSum) : null;
    f.sog_max = n ? Math.max(...H.map((g) => g.sog)) : null;
    f.sog_sd = n > 1 ? r3(Math.sqrt(H.reduce((s, g) => s + (g.sog - f.sog_avg) ** 2, 0) / (n - 1))) : null;
    const share = (games, hit) => (games.length ? r3(games.filter(hit).length / games.length) : null);
    for (const at of [2, 3, 4, 5]) f[`s${at}_rate`] = share(H, (g) => g.sog >= at);
    for (const w of [5, 10]) { f[`s3_l${w}`] = share(H.slice(-w), (g) => g.sog >= 3); f[`s4_l${w}`] = share(H.slice(-w), (g) => g.sog >= 4); f[`g1_l${w}`] = share(H.slice(-w), (g) => g.g >= 1); f[`pt1_l${w}`] = share(H.slice(-w), (g) => g.pts >= 1); }
    f.g1_rate = share(H, (g) => g.g >= 1);
    f.pt1_rate = share(H, (g) => g.pts >= 1);
    // Streaks: the run he is on coming in.
    f.str_s2 = streak(H, (g) => g.sog >= 2); f.str_s3 = streak(H, (g) => g.sog >= 3); f.str_s4 = streak(H, (g) => g.sog >= 4);
    f.str_g = streak(H, (g) => g.g >= 1); f.str_pt = streak(H, (g) => g.pts >= 1);
    f.cold_s2 = streak(H, (g) => g.sog < 2); f.cold_pt = streak(H, (g) => g.pts < 1);
    f.since_g = sinceLast(H, (g) => g.g >= 1); f.since_s3 = sinceLast(H, (g) => g.sog >= 3);
    f.toi_trend = f.toi_avg ? r3(f.toi_l5 / f.toi_avg) : null;
    f.sog_trend = f.sog_avg ? r3(f.sog_l5 / f.sog_avg) : null;
    f.icf_trend = f.icf_avg ? r3(f.icf_l5 / f.icf_avg) : null;
    // At tonight's venue.
    const V = H.filter((g) => g.venue === venue);
    f.ven_n = V.length;
    for (const k of ['sog', 'icf', 'iff', 'iscf', 'g', 'pts', 'toi']) f[`ven_${k}`] = r3(mean(V.map((g) => g[k])));
    f.ven_s3 = share(V, (g) => g.sog >= 3);
    f.ven_g1 = share(V, (g) => g.g >= 1);
    f.ven_sog_x = f.ven_sog != null && f.sog_avg ? r3(f.ven_sog / f.sog_avg) : null;
    // Against tonight's opponent this season.
    const vs = H.filter((g) => g.opp === sk.opp);
    f.h2h_n = vs.length; f.h2h_sog = r3(mean(vs.map((g) => g.sog))); f.h2h_g = vs.length ? vs.reduce((s, g) => s + g.g, 0) : null;
    // Rest.
    const lastOf = (t) => { const ds = (teamDates.get(t) || []).filter((d) => d < date); return ds[ds.length - 1] || null; };
    const tl = lastOf(sk.team); const ol = lastOf(sk.opp);
    f.rest = tl ? daysBetween(tl, date) - 1 : null; f.b2b = f.rest === 0 ? 1 : 0;
    f.opp_rest = ol ? daysBetween(ol, date) - 1 : null; f.opp_b2b = f.opp_rest === 0 ? 1 : 0;
    // The opponent's defense: per skater at his position, by window and at its venue tonight, against the league's at the position, ranked.
    const D = def.get(sk.opp) || [];
    f.opp_gp = D.length;
    const oppVenue = venue === 'H' ? 'A' : 'H';
    const DV = D.filter((g) => g.venue === oppVenue);
    f.opp_ven_gp = DV.length;
    const L = league.pos[pos];
    const R = ranks();
    for (const k of DEF_STATS) {
      const lg = L?.n ? L[k] / L.n : null;
      for (const [suffix, w] of WINDOWS) {
        const v = POS.includes(pos) ? perSkater(lastN(D, w), pos, k) : null;
        f[`opp_pos_${k}${suffix}`] = r3(v);
        f[`opp_pos_${k}${suffix}_x`] = v != null && lg ? r3(v / lg) : null;
        f[`opp_pos_${k}${suffix}_rk`] = R.pos[`${pos}|${k}${suffix}`]?.r?.[sk.opp] ?? null;
      }
      const vv = POS.includes(pos) ? perSkater(DV, pos, k) : null;
      f[`opp_pos_${k}_ven`] = r3(vv);
      f[`opp_pos_${k}_ven_x`] = vv != null && lg ? r3(vv / lg) : null;
    }
    f.opp_teams = R.pos[`${pos}|sog`]?.count ?? null;
    // … and to his line slot, a game.
    const sl = f.slot;
    const SL = sl ? league.slot[sl] : null;
    const slotGames = sl ? D.filter((g) => g.slot[sl]) : [];
    f.opp_slot_n = slotGames.length;
    for (const k of SLOT_STATS) {
      const v = slotGames.length ? slotGames.reduce((s, g) => s + g.slot[sl][k], 0) / slotGames.length : null;
      const lg = SL?.games ? SL[k] / SL.games : null;
      f[`opp_slot_${k}`] = r3(v);
      f[`opp_slot_${k}_x`] = v != null && lg ? r3(v / lg) : null;
    }
    // The teams' totals a game: what the opponent gives up (shots, attempts, unblocked, chances, high-danger, goals), what both create.
    for (const [abbr, k] of Object.entries(TOT)) {
      for (const [suffix, w] of WINDOWS) {
        f[`opp_${abbr}a${suffix}`] = r3(totPer(lastN(D, w), k));
        f[`opp_${abbr}a${suffix}_rk`] = R.tot[`${abbr}${suffix}`]?.r?.[sk.opp] ?? null;
      }
    }
    const T = att.get(sk.team) || []; const O = att.get(sk.opp) || []; const TD = def.get(sk.team) || [];
    for (const [abbr, k] of Object.entries(TOT)) {
      f[`team_${abbr}f`] = r3(totPer(T, k)); f[`team_${abbr}f_l5`] = r3(totPer(lastN(T, 5), k));
    }
    f.team_sa = r3(totPer(TD, 'sog'));
    f.opp_sf = r3(totPer(O, 'sog'));
    f.pace = f.team_sf != null && f.team_sa != null && f.opp_sf != null && f.opp_sa != null ? r3((f.team_sf + f.team_sa + f.opp_sf + f.opp_sa) / 2) : null;
    return f;
  }

  return { addDate, features, players, def };
}

/** The outcome columns of a row: his shots, goals and every mark's hit. */
export function outcomesOf(r) {
  const o = { sog: num(r.sog), g: num(r.g), a: num(r.a), toi: num(r.toi) };
  for (const m of MARKS) o[`y_${m.key}`] = num(r[m.stat]) >= m.at ? 1 : 0;
  return o;
}

/**
 * Every skater-game of the season of `date` (rows before it), each with the figures it carried in and what he got,
 * date order; and the tracker standing after the last of them, to read tonight's skaters. `keep` (a set of feature
 * names) trims each row to the figures the rules read; the study keeps them all.
 */
export function patternTable(rows, { date, keep = null } = {}) {
  const from = seasonStart(date || rows[rows.length - 1]?.date || '2000-01-01');
  const byDate = new Map();
  for (const r of rows || []) {
    if (!r || r.date < from || (date && r.date >= date)) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  const tracker = makeTracker();
  const out = [];
  for (const d of [...byDate.keys()].sort()) {
    const day = byDate.get(d);
    for (const r of day) {
      if (r.playerId == null || !POS.includes(r.pos)) continue;
      const full = tracker.features({ playerId: r.playerId, team: r.team, opp: r.opp, venue: r.venue, pos: r.pos, line: r.line, date: d });
      if (!full.gp) continue;   // his first game carries nothing
      const f = keep ? Object.fromEntries([...keep].map((k) => [k, full[k] ?? null])) : full;
      out.push({ date: d, gameId: r.gameId, playerId: r.playerId, name: r.name, team: r.team, opp: r.opp, venue: r.venue, pos: r.pos, line: r.line ?? null, f, o: outcomesOf(r) });
    }
    tracker.addDate(day);
  }
  return { rows: out, tracker };
}

// ── The rules ───────────────────────────────────────────────────────────────────────────────────────────────────

const OPS = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b };

/** Whether a skater's figures meet every condition of a rule ({ f, op, v }); a figure he lacks fails it. */
export function matches(rule, f) {
  for (const c of rule.when) {
    const x = f[c.f];
    if (x == null || (typeof x === 'number' && !Number.isFinite(x))) return false;
    if (!OPS[c.op](x, c.v)) return false;
  }
  return true;
}

/** Every key a rule set reads (to trim the table the site keeps). */
export function rulesKeys(rules) {
  const keys = new Set(['gp', 'sog_avg']);
  for (const m of Object.values(rules?.marks || {})) for (const r of m.rules || []) for (const c of r.when) keys.add(c.f);
  return keys;
}

const liveRates = (rules, counts, k) => Object.fromEntries(Object.entries(rules?.marks || {}).map(([mk, m]) => [mk, m.rules.map((rule, i) => {
  const c = counts[mk][i]; const prior = rule.rate ?? m.base;
  return { n: c.n, hits: c.hits, rate: (c.hits + k * prior) / (c.n + k) };
})]));

/**
 * The rules on the site's own games after the study's last (`rules.builtThrough`): each rule's live rate (the
 * study's out-of-sample figure carried in at `k` skater-games, the season's own count on top), and the record of the
 * filled pills, every date read with the rates as they stood that morning. The rows before it built the rules and are
 * not counted, so the pill reads what a rule has done since, and the record is games the search never saw.
 */
export function patternRecord(table, rules, { k = 30 } = {}) {
  const after = rules?.builtThrough || '';
  const marks = Object.entries(rules?.marks || {});
  const counts = Object.fromEntries(marks.map(([mk, m]) => [mk, m.rules.map(() => ({ n: 0, hits: 0 }))]));
  const tally = Object.fromEntries(marks.map(([mk]) => [mk, { picks: 0, landed: 0, said: 0 }]));
  const rows = (table || []).filter((r) => r.date > after);
  for (let i = 0; i < rows.length;) {
    const date = rows[i].date; let j = i;
    while (j < rows.length && rows[j].date === date) j++;
    const rates = liveRates(rules, counts, k);
    for (let x = i; x < j; x++) {
      const pills = pillsFor(rows[x].f, rules, rates);
      for (const [mk] of marks) if (pills[mk].selected) { tally[mk].picks += 1; tally[mk].said += pills[mk].p; tally[mk].landed += rows[x].o[`y_${mk}`]; }
    }
    for (let x = i; x < j; x++) {
      for (const [mk, m] of marks) m.rules.forEach((rule, q) => { if (matches(rule, rows[x].f)) { counts[mk][q].n += 1; counts[mk][q].hits += rows[x].o[`y_${mk}`]; } });
    }
    i = j;
  }
  for (const t of Object.values(tally)) t.said = t.picks ? r3(t.said / t.picks) : null;
  return { after, from: rows[0]?.date || null, to: rows[rows.length - 1]?.date || null, games: rows.length, marks: tally, rates: liveRates(rules, counts, k) };
}

/**
 * A skater's pills: per mark the strongest rule he meets (its live rate), selected when that rate clears the mark's
 * bar and the rule held on the week it never saw; the facts are the conditions of the rule behind each pill.
 */
export function pillsFor(f, rules, rates) {
  const out = {};
  for (const [mk, m] of Object.entries(rules?.marks || {})) {
    let best = null;
    m.rules.forEach((rule, i) => {
      if (!matches(rule, f)) return;
      const rate = rates?.[mk]?.[i]?.rate ?? rule.rate;
      if (!best || rate > best.rate) best = { rule, rate, live: rates?.[mk]?.[i] || null };
    });
    const p = best ? best.rate : m.base;
    out[mk] = {
      p: r3(p),
      selected: !!best && best.rule.held && p >= m.bar,
      rule: best ? { id: best.rule.id, kind: best.rule.kind, when: best.rule.when, check: best.rule.check || null, live: best.live } : null,
    };
  }
  return out;
}

// The figures the notes read beside a rule's conditions.
export const NOTE_KEYS = ['str_s3', 'str_s2', 'str_pt', 'str_g', 'ven_sog_x', 'ven_n', 'opp_pos_ihdcf_l5_rk', 'opp_ga_rk', 'opp_teams', 'sog_avg', 'gp'];

/** The few figures worth a pill whatever the rules say: a run he is on, his venue split, a soft or leaky opponent. */
function notesOf(f, ctx) {
  const out = [];
  const teams = f.opp_teams || 32;
  if (f.str_pt >= 3) out.push({ key: 'str_pt', ...describe({ f: 'str_pt', op: '>=', v: 3 }, f.str_pt, ctx), tone: 'hot' });
  if (f.str_s3 >= 3) out.push({ key: 'str_s3', ...describe({ f: 'str_s3', op: '>=', v: 3 }, f.str_s3, ctx), tone: 'hot' });
  else if (f.str_s2 >= 4) out.push({ key: 'str_s2', ...describe({ f: 'str_s2', op: '>=', v: 4 }, f.str_s2, ctx), tone: 'hot' });
  if (f.str_g >= 2) out.push({ key: 'str_g', ...describe({ f: 'str_g', op: '>=', v: 2 }, f.str_g, ctx), tone: 'hot' });
  if (f.ven_n >= 3 && f.ven_sog_x != null && (f.ven_sog_x >= 1.2 || f.ven_sog_x <= 0.8)) out.push({ key: 'ven_sog_x', ...describe({ f: 'ven_sog_x', op: f.ven_sog_x >= 1.2 ? '>=' : '<=', v: f.ven_sog_x >= 1.2 ? 1.2 : 0.8 }, f.ven_sog_x, ctx), tone: f.ven_sog_x >= 1.2 ? 'soft' : 'tough' });
  const hd = f.opp_pos_ihdcf_l5_rk;
  if (hd != null && (hd <= Math.ceil(teams / 6) || hd > teams - Math.ceil(teams / 6))) out.push({ key: 'opp_pos_ihdcf_l5_rk', ...describe({ f: 'opp_pos_ihdcf_l5_rk', op: '<=', v: hd }, hd, ctx), tone: hd <= teams / 2 ? 'soft' : 'tough' });
  if (f.opp_ga_rk != null && f.opp_ga_rk <= 5) out.push({ key: 'opp_ga_rk', ...describe({ f: 'opp_ga_rk', op: '<=', v: 5 }, f.opp_ga_rk, ctx), tone: 'soft' });
  return out;
}

/** One skater's payload: his pills per line, the conditions behind the filled ones, the notes, his figures to show. */
export function skaterPatterns(f, rules, rates, ctx) {
  const pills = pillsFor(f, rules, rates);
  const facts = new Map();
  for (const m of MARKS) {
    const p = pills[m.key];
    if (!p?.selected || !p.rule) continue;
    for (const c of p.rule.when) {
      if (c.f === 'gp' && p.rule.kind === 'tier') continue;
      const id = `${c.f}|${c.op}|${c.v}`;
      if (!facts.has(id)) facts.set(id, { key: c.f, ...describe(c, f[c.f], ctx), marks: [] });
      facts.get(id).marks.push(m.key);
    }
  }
  const ruleFacts = [...facts.values()];
  const seen = new Set(ruleFacts.map((x) => x.key));
  const notes = notesOf(f, ctx).filter((n) => !seen.has(n.key));
  // Each pill names its rule (the payload's catalog carries the conditions once) and his values for them; the panel
  // words them with describe().
  return {
    pills: Object.fromEntries(Object.entries(pills).map(([mk, p]) => [mk, {
      p: p.p, selected: p.selected,
      ...(p.rule ? { rule: p.rule.id, vals: p.rule.when.map((c) => f[c.f] ?? null), ...(p.rule.live?.n ? { live: [p.rule.live.hits, p.rule.live.n] } : {}) } : {}),
    }])),
    facts: ruleFacts, notes,
  };
}

/** The rules the pills name, once: id → { mark, kind, when, check } (the payload's catalog). */
export function rulesCatalog(rules) {
  const out = {};
  for (const [mk, m] of Object.entries(rules?.marks || {})) for (const r of m.rules) out[r.id] = { mark: mk, kind: r.kind, when: r.when, check: r.check || null };
  return out;
}

// ── Words for the facts ─────────────────────────────────────────────────────────────────────────────────────────

const STAT_WORD = { sog: 'shots', icf: 'attempts', iff: 'unblocked attempts', iscf: 'chances', ihdcf: 'high-danger chances', g: 'goals', a: 'assists', pts: 'points', toi: 'minutes', hits: 'hits', blk: 'blocks' };
const STAT_SHORT = { sog: 'SOG', icf: 'iCF', iff: 'iFF', iscf: 'iSCF', ihdcf: 'iHDCF', g: 'G', a: 'A', pts: 'PTS', toi: 'TOI', hits: 'hits', blk: 'blocks' };
const TOT_SHORT = { s: 'SA', c: 'CA', f: 'FA', sc: 'SCA', hdc: 'HDCA', g: 'GA' };
const WIN_WORD = { '': 'season', _l5: 'L5', _l10: 'L10', _ven: 'at the venue' };
const fmt = (v, d = 2) => (v == null ? '—' : String(Number(Number(v).toFixed(d))));   // 3.40 → 3.4, 4.00 → 4
const pctTxt = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/**
 * A condition in words and as a short pill: { text, short } for a figure key, its threshold and the skater's own
 * value. `ctx` = { opp, pos, slot } names the opponent and his spot.
 */
export function describe(c, value, ctx = {}) {
  const k = c.f; const op = c.op === '>=' ? '≥' : c.op === '<=' ? '≤' : '=';
  const opp = ctx.opp || 'Opp'; const pos = ctx.pos || 'his position'; const slot = ctx.slot || 'his slot';
  let m;
  if ((m = k.match(/^opp_pos_(\w+?)(_l5|_l10|_ven)?(_x|_rk)?$/))) {
    const [, s, w = '', kind = ''] = m;
    const win = WIN_WORD[w];
    if (kind === '_rk') return { text: `${opp} ranks #${value} in ${STAT_WORD[s]} allowed to ${pos}s (${win}; needs #${c.v} or ${c.op === '<=' ? 'higher' : 'lower'})`, short: `${opp} #${value} ${STAT_SHORT[s]} to ${pos} · ${win}` };
    if (kind === '_x') return { text: `${opp} gives ${pos}s ${fmt(value)}× the league's ${STAT_WORD[s]} (${win}; rule ${op} ${fmt(c.v)}×)`, short: `${opp} ${STAT_SHORT[s]} to ${pos} ×${fmt(value)} · ${win}` };
    return { text: `${opp} gives up ${fmt(value)} ${STAT_WORD[s]} a skater to ${pos}s (${win}; rule ${op} ${fmt(c.v)})`, short: `${opp} ${STAT_SHORT[s]} to ${pos} ${fmt(value)} · ${win}` };
  }
  if ((m = k.match(/^opp_slot_(\w+?)(_x)?$/)) && m[1] !== 'n') {
    const [, s, x] = m;
    return x
      ? { text: `${opp} gives ${slot} ${fmt(value)}× the league's ${STAT_WORD[s]} (rule ${op} ${fmt(c.v)}×)`, short: `${opp} ${STAT_SHORT[s]} to ${slot} ×${fmt(value)}` }
      : { text: `${opp} gives up ${fmt(value)} ${STAT_WORD[s]} a game to ${slot} (rule ${op} ${fmt(c.v)})`, short: `${opp} ${STAT_SHORT[s]} to ${slot} ${fmt(value)}` };
  }
  if ((m = k.match(/^opp_(s|c|f|sc|hdc|g)a(_l5|_l10)?(_rk)?$/))) {
    const [, t, w = '', rk] = m;
    return rk
      ? { text: `${opp} ranks #${value} in ${TOT_SHORT[t]} a game (${WIN_WORD[w]}; rule ${op} #${c.v})`, short: `${opp} #${value} ${TOT_SHORT[t]} · ${WIN_WORD[w]}` }
      : { text: `${opp} gives up ${fmt(value, 1)} ${TOT_SHORT[t]} a game (${WIN_WORD[w]}; rule ${op} ${fmt(c.v, 1)})`, short: `${opp} ${TOT_SHORT[t]} ${fmt(value, 1)} · ${WIN_WORD[w]}` };
  }
  if ((m = k.match(/^team_(s|c|f|sc|hdc|g)f(_l5)?$/))) return { text: `His team takes ${fmt(value, 1)} ${TOT_SHORT[m[1]].replace('A', 'F')} a game (${WIN_WORD[m[2] || '']}; rule ${op} ${fmt(c.v, 1)})`, short: `Team ${TOT_SHORT[m[1]].replace('A', 'F')} ${fmt(value, 1)}` };
  if ((m = k.match(/^str_(s2|s3|s4|g|pt)$/))) { const w = { s2: '2+ SOG', s3: '3+ SOG', s4: '4+ SOG', g: 'a goal', pt: 'a point' }[m[1]]; return { text: `${w} in ${value} straight (rule ${op} ${c.v})`, short: `${w} ${value} straight` }; }
  if ((m = k.match(/^cold_(s2|pt)$/))) { const w = m[1] === 's2' ? 'under 2 SOG' : 'no point'; return { text: `${w} in ${value} straight (rule ${op} ${c.v})`, short: `${w} ${value} straight` }; }
  if ((m = k.match(/^since_(g|s3)$/))) { const w = m[1] === 'g' ? 'a goal' : '3+ SOG'; return { text: `${value} games since ${w} (rule ${op} ${c.v})`, short: `${value} gp since ${w}` }; }
  if ((m = k.match(/^ven_(\w+)$/))) {
    const where = ctx.home ? 'at home' : 'away';
    if (m[1] === 'n') return { text: `${value} games ${where} this season`, short: `${value} gp ${where}` };
    if (m[1] === 'sog_x') return { text: `${fmt(value)}× his shots ${where} (rule ${op} ${fmt(c.v)}×)`, short: `${where} ×${fmt(value)} SOG` };
    if (m[1] === 's3' || m[1] === 'g1') return { text: `${pctTxt(value)} of his games ${where} at ${m[1] === 's3' ? '3+ SOG' : 'a goal'} (rule ${op} ${pctTxt(c.v)})`, short: `${where} ${m[1] === 's3' ? '3+' : '1+ G'} ${pctTxt(value)}` };
    return { text: `${fmt(value)} ${STAT_WORD[m[1]]} a game ${where} (rule ${op} ${fmt(c.v)})`, short: `${where} ${fmt(value)} ${STAT_SHORT[m[1]]}` };
  }
  if ((m = k.match(/^(s[2-5]|g1|pt1)_(rate|l5|l10)$/))) {
    const what = { s2: '2+ SOG', s3: '3+ SOG', s4: '4+ SOG', s5: '5+ SOG', g1: 'a goal', pt1: 'a point' }[m[1]]; const win = m[2] === 'rate' ? 'this season' : m[2].toUpperCase();
    return { text: `${what} in ${pctTxt(value)} of his games (${win}; rule ${op} ${pctTxt(c.v)})`, short: `${what} ${pctTxt(value)} ${win === 'this season' ? 'season' : win}` };
  }
  if ((m = k.match(/^(\w+?)_(avg|l3|l5|l10)$/)) && STAT_WORD[m[1]]) {
    const win = m[2] === 'avg' ? 'season' : m[2].toUpperCase();
    const d = m[1] === 'toi' ? 1 : 2;   // minutes to the tenth
    return { text: `${fmt(value, d)} ${STAT_WORD[m[1]]} a game (${win}; rule ${op} ${fmt(c.v, d)})`, short: `${fmt(value, d)} ${STAT_SHORT[m[1]]} · ${win}` };
  }
  if ((m = k.match(/^(sog|icf|iscf|g)60$/))) { const d = m[1] === 'g' ? 2 : 1; return { text: `${fmt(value, d)} ${STAT_WORD[m[1]]} per 60 (rule ${op} ${fmt(c.v, d)})`, short: `${fmt(value, d)} ${STAT_SHORT[m[1]]}/60` }; }
  if ((m = k.match(/^(toi|sog|icf)_trend$/))) return { text: `last five at ${fmt(value)}× his season ${STAT_WORD[m[1]]} (rule ${op} ${fmt(c.v)}×)`, short: `L5 ${STAT_SHORT[m[1]]} ×${fmt(value)}` };
  const plain = {
    gp: [`${value} games behind his numbers`, `${value} gp`], home: [value ? 'at home' : 'away', value ? 'Home' : 'Away'], fwd: [value ? 'a forward' : 'a defenseman', value ? 'F' : 'D'],
    line: [`line ${value}`, `Line ${value}`], b2b: [value ? 'second of a back-to-back' : 'rested', value ? 'B2B' : 'Rested'], opp_b2b: [value ? `${opp} on a back-to-back` : `${opp} rested`, value ? `${opp} B2B` : `${opp} rested`],
    rest: [`${value} days' rest`, `${value}d rest`], opp_rest: [`${opp} on ${value} days' rest`, `${opp} ${value}d rest`], shpct: [`shooting ${pctTxt(value)}`, `Sh% ${pctTxt(value)}`],
    sog_max: [`${value} shots at his most this season`, `Max ${value} SOG`], sog_sd: [`his shots swing ±${fmt(value)}`, `SOG ±${fmt(value)}`], pace: [`pace ${fmt(value, 1)} shots a team`, `Pace ${fmt(value, 1)}`],
    team_sa: [`his team gives up ${fmt(value, 1)} shots`, `Team SA ${fmt(value, 1)}`], opp_sf: [`${opp} takes ${fmt(value, 1)} shots`, `${opp} SF ${fmt(value, 1)}`],
    h2h_n: [`${value} games against ${opp}`, `${value} gp vs ${opp}`], h2h_sog: [`${fmt(value)} shots a game against ${opp}`, `vs ${opp} ${fmt(value)} SOG`], h2h_g: [`${value} goals against ${opp}`, `vs ${opp} ${value} G`],
    opp_gp: [`${opp} ${value} games in`, `${opp} ${value} gp`], opp_ven_gp: [`${opp} ${value} games at the venue`, `${opp} ${value} gp`], opp_slot_n: [`${value} games of ${opp} against ${slot}`, `${value} gp`],
  }[k];
  if (plain) return { text: plain[0], short: plain[1] };
  return { text: `${k} ${fmt(value)} (rule ${op} ${fmt(c.v)})`, short: `${k} ${fmt(value)}` };
}
