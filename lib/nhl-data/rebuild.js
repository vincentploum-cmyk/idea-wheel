// Rebuilds the derived indexes from the per-date source files, so a lost or
// stale update can always be repaired:
//   data/games/<date>.json          → data/rows/<season>.json + seen players
//   data/slates/<date>/*.xlsx       → data/defense/latest.json + source names
import { listNames, readJson, writeJson, readBlob } from '../nhl-store';
import { toRow, rowsPath, ROW_FIELDS, SEEN_PATH } from './ingest';
import { inspectMatchups, slatePath } from './matchups';
import { SOURCE_NAMES_PATH } from './names';

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

export async function rebuildGameIndexes() {
  const dates = (await listNames('data/games')).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).sort();
  const files = await mapLimit(dates, 8, (d) => readJson(`data/games/${d}.json`));
  const bySeason = {};
  const seen = {};
  let games = 0;
  for (const f of files) {
    for (const g of f?.games || []) {
      games++;
      (bySeason[g.season] = bySeason[g.season] || []).push(...g.skaters.map((s) => toRow(g, s)));
      for (const sk of [...g.skaters, ...g.goalies.map((x) => ({ ...x, pos: 'G' }))]) {
        const prev = seen[sk.id];
        if (!prev || prev.lastGame <= g.date) seen[sk.id] = { id: sk.id, name: sk.name, team: sk.team, pos: sk.pos, lastGame: g.date };
      }
    }
  }
  const now = new Date().toISOString();
  for (const [season, rows] of Object.entries(bySeason)) {
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    await writeJson(rowsPath(season), { season: Number(season), fields: ROW_FIELDS, updatedAt: now, rows });
  }
  await writeJson(SEEN_PATH, { updatedAt: now, players: seen });
  return { dates: dates.length, games, seasons: Object.fromEntries(Object.entries(bySeason).map(([s, r]) => [s, r.length])), players: Object.keys(seen).length };
}

export async function rebuildSlateIndexes() {
  const dates = (await listNames('data/slates')).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  const defense = {};
  const names = {};
  for (const date of dates) {
    for (const kind of ['season', 'l5']) {
      const blob = await readBlob(slatePath(date, kind));
      if (!blob) continue;
      const info = inspectMatchups(Buffer.from(await blob.arrayBuffer()), `x-${date}.xlsx`);
      for (const [abbr, rows] of Object.entries(info.defense)) defense[abbr] = { date, rows };
      for (const [nm, v] of Object.entries(info.names)) names[nm] = { ...v, lastSeen: date };
    }
  }
  const now = new Date().toISOString();
  await writeJson('data/defense/latest.json', { updatedAt: now, teams: defense });
  await writeJson(SOURCE_NAMES_PATH, { updatedAt: now, names });
  return { slates: dates.length, defenseTeams: Object.keys(defense).length, names: Object.keys(names).length };
}
