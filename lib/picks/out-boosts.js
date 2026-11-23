// Who gains when a teammate is out tonight (Vincent, 2026-11-23: "I don't see the badge. I need a separate view with all
// players that have an advantage bc another player is out"): for every player out tonight, every active teammate's season
// with and without him — the player card's "With and without each teammate" figures (lib/picks/injuries.js
// teammateSplits: the games they shared, the games the out player sat), one row per pair, read from the same PropFinder
// logs. Pure: the board builds the list (`board.outBoosts`), the NBA's Teammates out tab draws it, and each player's
// biggest row becomes the chip's badge (`woSplit`).
import { gamesPlayed, shortNames } from './injuries';

export const OUT_BOOST = { minWith: 3, big: { games: 2, min: 4, pts: 4 } };
const STATS = ['min', 'pts', 'reb', 'ast', 'tpm', 'pra'];
const r1 = (v) => Math.round(v * 10) / 10;
const valOf = (g, k) => {
  if (k === 'pra') { const p = Number(g?.pts); const r = Number(g?.reb); const a = Number(g?.ast); return [p, r, a].every(Number.isFinite) ? p + r + a : null; }
  const v = Number(g?.[k]); return g?.[k] == null || !Number.isFinite(v) ? null : v;
};
const avg = (list, k) => { const v = list.map((g) => valOf(g, k)).filter((x) => x != null); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null; };

/** One pair: the player's season with and without the out teammate, null when they shared under `minWith` games or he never played without him. */
export function boostOf(playerPf, outPf, season, { minWith = OUT_BOOST.minWith } = {}) {
  if (!playerPf?.games?.length || !outPf?.games?.length) return null;
  const played = gamesPlayed(outPf);
  if (!played.size) return null;
  const games = playerPf.games.filter((g) => g?.gameId != null && g.season === season && (g.type === 'REG' || !g.type) && (g.min == null || g.min > 0));
  const withG = games.filter((g) => played.has(String(g.gameId)));
  const without = games.filter((g) => !played.has(String(g.gameId)));
  if (withG.length < minWith || !without.length) return null;
  const stats = {};
  for (const k of STATS) { const w = avg(withG, k); const wo = avg(without, k); if (w != null && wo != null) stats[k] = { with: w, without: wo, gap: r1(wo - w) }; }
  if (!stats.min && !stats.pts) return null;
  return { gpWith: withG.length, gpWithout: without.length, stats };
}

/** Whether a pair is worth the badge: 2+ games without and a move of 4+ minutes or 4+ points either way. */
export const isBig = (b, big = OUT_BOOST.big) => !!b && b.gpWithout >= big.games && (Math.abs(b.stats.min?.gap ?? 0) >= big.min || Math.abs(b.stats.pts?.gap ?? 0) >= big.pts);

/**
 * The slate's list from the built games (each side's `out` and active `players`) and the pull's players (their logs):
 * [{ game, team, opp, key, player, pos, espnId, out: { key, name, pos, status, detail }, gpWith, gpWithout, stats, big,
 * proj: { pts | reb | ast | pra: { exp, line } } }], the biggest minutes gain first. Each side player with a big pair
 * gets `woSplit` (the biggest by minutes moved) for the chip.
 */
export function outBoostsOf(games, pfPlayers, season) {
  const byKey = new Map();
  for (const p of pfPlayers || []) byKey.set(`${p.team}|${p.key}`, p);
  const rows = [];
  for (const g of games || []) {
    for (const side of Object.values(g.sides || {})) {
      if (!side?.team) continue;
      const outs = (side.out || []).filter((o) => o?.key);
      if (!outs.length) continue;
      for (const p of side.players || []) {
        if (p.out || p.idle) continue;
        const ppf = byKey.get(`${side.team}|${p.key}`);
        let best = null;
        for (const o of outs) {
          if (o.key === p.key) continue;
          const opf = byKey.get(`${side.team}|${o.key}`);
          const b = boostOf(ppf, opf, season);
          if (!b) continue;
          const proj = {}; for (const k of ['pts', 'reb', 'ast', 'pra']) if (p.ranges?.[k]) proj[k] = { exp: p.ranges[k].exp ?? null, line: p.ranges[k].line ?? null };
          const row = { game: g.id, team: side.team, opp: side.opp, key: p.key, player: p.player, pos: p.pos || null, espnId: p.espnId || null, out: { key: o.key, name: o.name, pos: o.pos || null, status: o.status || null, detail: o.detail || null }, ...b, big: isBig(b), proj };
          rows.push(row);
          if (row.big && (!best || Math.abs(row.stats.min?.gap ?? 0) > Math.abs(best.stats.min?.gap ?? 0))) best = row;
        }
        p.woSplit = best ? { names: shortNames([best.out]), gpWith: best.gpWith, gpWithout: best.gpWithout, stats: best.stats, big: true } : null;
      }
    }
  }
  return rows.sort((a, b) => (b.stats.min?.gap ?? -99) - (a.stats.min?.gap ?? -99) || (b.stats.pts?.gap ?? -99) - (a.stats.pts?.gap ?? -99));
}
