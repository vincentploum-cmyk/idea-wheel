// Preseason games: who is actually dressing for each team right now.
// Stored apart from regular-season data so the model's history and
// home/away stats never include exhibition games.
import { fetchSchedule, fetchBoxscore, fetchPlayByPlay, isFinal } from './api';
import { buildGameRecord } from './game';
import { readJson, writeJson } from '../nhl-store';

export const PRE_GAMES = (date) => `data/preseason/games/${date}.json`;
export const PRE_PLAYERS = 'data/reference/preseason.json';

export async function ingestPreseason(date) {
  const schedule = await fetchSchedule(date, { types: [1] });
  if (!schedule.length) return { date, scheduled: 0, ingested: 0 };
  const existing = (await readJson(PRE_GAMES(date))) || { date, games: [] };
  const have = new Set(existing.games.map((g) => g.id));
  const todo = schedule.filter((g) => isFinal(g.state) && !have.has(g.id));
  const fresh = [];
  for (const g of todo) {
    const [box, pbp] = await Promise.all([fetchBoxscore(g.id), fetchPlayByPlay(g.id)]);
    const rec = buildGameRecord(box, pbp);
    if (rec) fresh.push(rec);
  }
  if (!fresh.length) return { date, scheduled: schedule.length, ingested: 0, pending: schedule.filter((g) => !isFinal(g.state)).length };

  const games = [...existing.games, ...fresh].sort((a, b) => a.id - b.id);
  await writeJson(PRE_GAMES(date), { date, fetchedAt: new Date().toISOString(), games });

  const file = (await readJson(PRE_PLAYERS)) || { players: {} };
  for (const g of fresh) {
    for (const s of [...g.skaters, ...g.goalies.map((x) => ({ ...x, pos: 'G' }))]) {
      if (s.pos === 'G' && !(s.toi > 0)) continue; // backup goalie who didn't play
      const p = file.players[s.id] || { id: s.id, name: s.name, gp: 0, games: [] };
      if (!p.games.includes(g.id)) {
        p.games = [...p.games, g.id].slice(-20);
        p.gp = p.games.length;
      }
      if (!p.lastGame || p.lastGame <= g.date) {
        Object.assign(p, { name: s.name, team: s.team, pos: s.pos, lastGame: g.date, lastToi: s.toi });
      }
      file.players[s.id] = p;
    }
  }
  file.updatedAt = new Date().toISOString();
  await writeJson(PRE_PLAYERS, file);
  return { date, scheduled: schedule.length, ingested: fresh.length };
}
