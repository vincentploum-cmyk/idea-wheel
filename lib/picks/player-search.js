// The player search both boards carry (Vincent, 2026-11-01: "I should be able to search on players for both nba and
// nfl"): pure, client-safe. A query matches a player when every word of it starts a word of his name or is his team's
// code ("cade", "cun", "det cun"), accents and punctuation ignored; the best matches first — his surname from the
// first letter, then his first name, then anywhere — and a player who is out after those who play.

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** How a player matches a query: 0 = no match, higher = better. */
export function matchScore(p, query) {
  const q = fold(query);
  if (!q) return 0;
  const words = fold(p.name).split(' ');
  const team = fold(p.team);
  let score = 0;
  for (const t of q.split(' ')) {
    if (t === team) { score += 3; continue; }
    const at = words.findIndex((w) => w.startsWith(t));
    if (at < 0) { if (!fold(p.name).includes(t)) return 0; score += 1; continue; }
    score += at === words.length - 1 ? 6 : at === 0 ? 5 : 4;
    if (words[at] === t) score += 2;
  }
  return score;
}

/** The players matching a query, the best first, `limit` of them. */
export function searchPlayers(players, query, limit = 8) {
  return (players || [])
    .map((p) => ({ p, s: matchScore(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.p.out ? 1 : 0) - (b.p.out ? 1 : 0) || String(a.p.name).localeCompare(String(b.p.name)))
    .slice(0, limit)
    .map((x) => x.p);
}

/** The NBA slate's players to search: every side player of every game, one row each. */
export function nbaSearchList(board) {
  const out = [];
  for (const g of board?.games || []) {
    for (const team of [g.away, g.home]) {
      const side = g.sides?.[team];
      for (const p of side?.players || []) {
        const r = p.ranges || {};
        out.push({
          id: `${p.key}|${team}`, key: p.key, name: p.player, team, opp: side.opp, venue: side.venue, pos: p.slot && p.depth ? `${p.slot}${p.depth}` : p.pos || null,
          espnId: p.espnId || null, out: !!p.out, health: p.health || null, game: g.id,
          sub: ['pts', 'reb', 'ast'].filter((k) => r[k]?.exp != null).map((k) => `${Math.round(r[k].exp * 10) / 10} ${k.toUpperCase()}`).join(' · '),
          ref: p,
        });
      }
    }
  }
  return out;
}

/** The NFL week's players to search: the projection rows (lib/nfl/projections.js), one a player and team. */
export function nflSearchList(board) {
  const pj = board?.projections;
  return Object.values(pj?.rows || {}).map((r) => {
    const y = r.yards || {};
    const main = r.pos === 'QB' ? y.pass_yds : r.pos === 'RB' ? y.rush_yds : y.rec_yds;
    const unit = r.pos === 'QB' ? 'pass yds' : r.pos === 'RB' ? 'rush yds' : 'rec yds';
    return {
      id: r.id, key: r.key, name: r.player, team: r.team, opp: r.opp, venue: r.venue, pos: r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos || null,
      espnId: r.espnId || null, out: r.health === 'Out', health: r.health || null, game: r.game,
      sub: [main?.proj != null ? `${Math.round(main.proj)} ${unit}` : null, r.td?.p != null ? `TD ${Math.round(r.td.p * 100)}%` : null].filter(Boolean).join(' · '),
      ref: r,
    };
  });
}
