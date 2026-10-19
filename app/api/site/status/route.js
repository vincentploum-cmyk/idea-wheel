import { authorize, todayET } from '@/lib/nhl-data/util';
import { readJson } from '@/lib/nhl-store';
import { lineupsPath } from '@/lib/nhl-data/ingest';
import { fetchSchedule, isFinal } from '@/lib/nhl-data/api';
import { resolveWeek, boardFor as nflBoard } from '@/lib/nfl/store';
import { weekLabel } from '@/lib/nfl/week';
import { resolveSlate as nbaSlate, boardFor as nbaBoard } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const slim = (g) => ({ id: g.id, away: g.away, home: g.home, date: g.date, state: g.state, final: !!g.final, awayScore: g.awayScore ?? null, homeScore: g.homeScore ?? null, detail: g.detail || '', tally: g.tally || null, plays: g.plays || 0 });

/** A board's panel for the start screen: the slate's games with scores and tallies, the plays, the sources. */
async function panel(board, extra) {
  const games = (board.games || []).map(slim);
  return {
    ...extra, games, plays: board.plays || 0, finals: games.filter((g) => g.final).length,
    hits: games.reduce((s, g) => s + (g.tally?.hit || 0), 0), graded: games.reduce((s, g) => s + (g.tally?.of || 0), 0),
    sheets: board.sources?.sheets?.length || 0, propfinder: !!board.sources?.propfinder, nextStart: games.filter((g) => !g.final).map((g) => g.date).sort()[0] || null,
  };
}

// The start screen's three panels: this NFL week, tonight's NBA slate, tonight's NHL slate, each with
// its games (logos, scores, tallies) and where its data stands. Reads the stored files; ESPN is only
// asked when a slate has no schedule yet.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const today = todayET();
  const [nfl, nba, nhl] = await Promise.all([
    (async () => {
      try { const wk = await resolveWeek({ date: today }); return panel(await nflBoard(wk, { refresh: false }), { week: wk, label: weekLabel(wk) }); }
      catch (err) { return { error: err.message }; }
    })(),
    (async () => {
      try { const slate = await nbaSlate({ date: today }); return panel(await nbaBoard(slate, { refresh: false }), { date: today, label: 'Tonight' }); }
      catch (err) { return { error: err.message }; }
    })(),
    (async () => {
      try {
        const [lineups, refresh] = await Promise.all([readJson(lineupsPath(today)), readJson('data/meta/last-refresh.json')]);
        let schedule = [];
        try { schedule = await fetchSchedule(today, { quick: true }); } catch {}
        const withRows = new Set((lineups?.games || []).filter((g) => g.rows?.length).map((g) => String(g.gameId)));
        const games = schedule.length
          ? schedule.map((g) => ({ id: String(g.id), away: g.away, home: g.home, date: g.startTimeUTC, state: isFinal(g.state) ? 'post' : g.state === 'LIVE' || g.state === 'CRIT' ? 'in' : 'pre', final: isFinal(g.state), awayScore: g.awayScore ?? null, homeScore: g.homeScore ?? null, lineups: withRows.has(String(g.id)) }))
          : (lineups?.games || []).map((g) => ({ id: String(g.gameId), away: g.away, home: g.home, date: null, state: 'pre', final: false, lineups: !!g.rows?.length }));
        return { date: today, label: 'Tonight', games, lineups: games.filter((g) => g.lineups).length, finals: games.filter((g) => g.final).length, refreshedAt: refresh?.at || null, nextStart: games.filter((g) => !g.final && g.date).map((g) => g.date).sort()[0] || null };
      } catch (err) { return { error: err.message }; }
    })(),
  ]);
  return Response.json({ date: today, nfl, nba, nhl }, { headers: { 'Cache-Control': 'private, no-store' } });
}
