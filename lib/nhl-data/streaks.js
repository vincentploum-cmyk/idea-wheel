// Who is running hot: every skater's current goal, point and 3+ SOG streaks from the
// stored box scores of the season in progress, with his last game and, when his team
// plays on the date, the opponent. Descriptive only: the predictor study found no
// carry-over from a goal last game (docs/shots-goals-predictors.md, "scored last game"),
// so a streak is colour beside the matchup, not a signal.

/** The regular season a date belongs to starts the previous July: "2026-10-13" → "2026-07-01". */
export function seasonStart(date) {
  const y = Number(String(date).slice(0, 4));
  const m = Number(String(date).slice(5, 7));
  return `${m >= 7 ? y : y - 1}-07-01`;
}

const streakOf = (games, hit) => { let n = 0; for (let i = games.length - 1; i >= 0 && hit(games[i]); i--) n++; return n; };
const sum = (games, k) => games.reduce((s, g) => s + (Number(g[k]) || 0), 0);

/**
 * rows: rowObj() records of the season (older seasons are ignored). games: the date's
 * games ({ away, home }) for the "tonight" column. Returns skaters sorted by goal streak,
 * then goals over the last five, keeping anyone with a goal streak of 2+, a point streak
 * of 3+, a 3+ SOG streak of 3+ or three goals over his last five games.
 */
export function skaterStreaks(rows, { date, games = [], min = { goals: 2, points: 3, sog3: 3, goalsL5: 3 } } = {}) {
  const from = date ? seasonStart(date) : null;
  const byPlayer = new Map();
  for (const r of rows || []) {
    if (!r?.playerId || (from && r.date < from)) continue;
    const list = byPlayer.get(r.playerId) || [];
    list.push(r);
    byPlayer.set(r.playerId, list);
  }
  const tonight = {};
  for (const g of games || []) { if (g?.away && g?.home) { tonight[g.away] = { opp: g.home, venue: 'A' }; tonight[g.home] = { opp: g.away, venue: 'H' }; } }
  const out = [];
  for (const [playerId, list] of byPlayer) {
    const games = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const last = games[games.length - 1];
    const l5 = games.slice(-5);
    const l10 = games.slice(-10);
    const goals = { streak: streakOf(games, (g) => Number(g.g) >= 1), l5: sum(l5, 'g'), l10: sum(l10, 'g') };
    const points = { streak: streakOf(games, (g) => Number(g.g) + Number(g.a) >= 1), l5: sum(l5, 'g') + sum(l5, 'a') };
    const sog3 = { streak: streakOf(games, (g) => Number(g.sog) >= 3), l5: sum(l5, 'sog') };
    if (goals.streak < min.goals && points.streak < min.points && sog3.streak < min.sog3 && goals.l5 < min.goalsL5) continue;
    out.push({
      id: playerId, name: last.name, team: last.team, pos: last.pos, line: last.line ?? null, gp: games.length,
      goals, points, sog3,
      last: { date: last.date, opp: last.opp, venue: last.venue, g: Number(last.g) || 0, a: Number(last.a) || 0, sog: Number(last.sog) || 0 },
      tonight: tonight[last.team] || null,
    });
  }
  return out.sort((a, b) => b.goals.streak - a.goals.streak || b.goals.l5 - a.goals.l5 || b.points.streak - a.points.streak || a.name.localeCompare(b.name));
}
