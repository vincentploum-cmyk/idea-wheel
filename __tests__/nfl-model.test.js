// The NFL's learned read (lib/nfl/model.js; docs/audits/2026-11-15-nfl-model.md): the site's tree walker gives LightGBM's own
// answers on the fixture's player-games (tools/audit/nfl_model_fit.py --fixture), the features read the logs before the game
// only, and the blend lands on the board's rows with the board's read beside it.
import { describe, expect, test } from '@jest/globals';
import MODEL from '../lib/nfl/model-trees.json';
import FIXTURE from './fixtures/nfl-model.json';
import { modelFeatures, teamFigures, modelRead, modelBlend, modelText, activeRow, rowsBefore, MODEL_MARKETS } from '../lib/nfl/model';
import { buildBoard as plainBuild, makeBuild } from '../lib/nfl/picks';

const dates = Array.from({ length: 8 }, (_, i) => `2026-10-${String(30 - i * 3).padStart(2, '0')}`);
const base = { season: 2026, type: 'REG', passYds: 0, passTd: 0, passAtt: 0, passCmp: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tgt: 0, retTd: 0 };
const logs = (f) => dates.map((date, i) => { const g = { ...base, date, opp: 'ARI', gameId: `g${i}`, ...f(i) }; return { ...g, td: g.rushTd + g.recTd }; });
const WR = logs((i) => ({ rec: 6, recYds: 70 + i, tgt: 9, tgtShare: 0.25, airYds: 60, yac: 20, recTd: i % 3 === 0 ? 1 : 0 }));
const RB = logs((i) => ({ rushAtt: 18, rushYds: 80, rushShare: 0.6, rzAtt: 3, rushTd: i % 2 }));

describe('the NFL model: the trees', () => {
  test('the file carries the four markets, each with its positions and its weight; passing is not in it', () => {
    expect(Object.keys(MODEL.stats).sort()).toEqual([...MODEL_MARKETS].sort());
    expect(MODEL.stats.pass_yds).toBeUndefined();
    for (const m of MODEL_MARKETS) { expect(MODEL.blend[m]).toBeGreaterThan(0); expect(MODEL.stats[m].trees.length).toBeGreaterThan(100); }
    expect(MODEL.stats.td.link).toBe('logit');
    expect(MODEL.stats.rec_yds.cal).toHaveLength(2);
  });
  test("the site's walker gives LightGBM's answers", () => {
    expect(FIXTURE.length).toBeGreaterThanOrEqual(8);
    for (const row of FIXTURE) {
      const got = modelRead(MODEL, row.feats, row.pos);
      expect(Object.keys(got).sort()).toEqual(Object.keys(row.pred).sort());
      for (const [m, want] of Object.entries(row.pred)) expect(got[m]).toBeCloseTo(want, 2);
    }
  });
  test('a market is read only at the positions it was fitted for', () => {
    const feats = FIXTURE[0].feats;
    expect(modelRead(MODEL, feats, 'QB').rec_yds).toBeUndefined();
    expect(modelRead(MODEL, feats, 'QB').rush_yds).toBeGreaterThanOrEqual(0);
    expect(modelRead(MODEL, feats, 'WR').rush_yds).toBeUndefined();
    expect(modelRead(MODEL, feats, 'WR').td).toBeGreaterThan(0);
  });
});

describe('the NFL model: the features', () => {
  test('every feature the trees read is computed, off the games before the date only', () => {
    const f = modelFeatures({ games: WR, season: 2026, pos: 'WR', date: '2026-10-25', ctx: { home: true, points: 24, total: 47 } });
    for (const name of MODEL.stats.rec_yds.features) expect(f).toHaveProperty(name);
    // 2026-10-24 and before: six of the eight games.
    expect(f.nAll).toBe(6);
    expect(f.last_recYds).toBe(72);
    expect(f.e5_tgtShare).toBeCloseTo(0.25, 6);
    expect(f.e5_teamTgt).toBeCloseTo(36, 6);
    expect(f.e5_ypt).toBeCloseTo(f.e5_recYds / 9, 6);
    expect(f.home).toBe(1);
    expect(f.daysSince).toBe(1);
  });
  test('a week of zeros is a game he was not in: off his memory, on his availability', () => {
    const sat = [{ ...base, date: '2026-11-02', opp: 'SF', td: 0 }, ...WR];
    expect(activeRow(sat[0])).toBe(false);
    const f = modelFeatures({ games: sat, season: 2026, pos: 'WR', date: '2026-11-08' });
    expect(f.nAll).toBe(8);
    expect(f.lastActive).toBe(0);
    expect(f.act5).toBeCloseTo(0.8, 6);
    expect(f.daysSince).toBe(9);
    expect(modelFeatures({ games: WR.slice(0, 2), season: 2026, pos: 'WR', date: '2026-11-08' })).toBeNull();
    expect(rowsBefore(WR, '2026-10-25')).toHaveLength(6);
  });
  test("the side's figures: its players' five-game memories summed, the starter's passing, a man gone a month left off", () => {
    const QB = logs(() => ({ passAtt: 34, passCmp: 22, passYds: 240 }));
    const gone = WR.map((g) => ({ ...g, date: g.date.replace('2026-10', '2026-08') }));
    const t = teamFigures([{ pos: 'WR', games: WR }, { pos: 'RB', games: RB }, { pos: 'QB', games: QB }, { pos: 'QB', games: QB.map((g) => ({ ...g, passYds: 10 })), backup: true }, { pos: 'WR', games: gone }], '2026-11-08');
    expect(t.tgt).toBeCloseTo(9, 6);
    expect(t.rushAtt).toBeCloseTo(18, 6);
    expect(t.qbPassYds).toBeCloseTo(240, 6);
    expect(t.qbN).toBe(8);
  });
});

describe('the NFL model: the blend', () => {
  test('yards half and half, a chance on its log-odds, nothing without a weight', () => {
    expect(modelBlend(MODEL, 'rec_yds', 60, 50)).toBeCloseTo((1 - MODEL.blend.rec_yds) * 60 + MODEL.blend.rec_yds * 50, 6);
    const p = modelBlend(MODEL, 'td', 0.5, 0.2);
    expect(p).toBeGreaterThan(0.2); expect(p).toBeLessThan(0.5);
    expect(modelBlend(MODEL, 'td', 0.3, 0.3)).toBeCloseTo(0.3, 6);
    expect(modelBlend(MODEL, 'pass_yds', 240, 200)).toBeNull();
    expect(modelBlend(MODEL, 'rec_yds', null, 50)).toBeNull();
  });
  test("on the board: the row carries the trees' figure and the board's own; passing and the plain build are untouched", () => {
    const QB = logs(() => ({ passAtt: 34, passCmp: 22, passYds: 240, rushAtt: 3, rushYds: 12 }));
    const players = [
      { id: 'p-wr', name: 'Wide Guy', key: 'wide guy', team: 'LAR', pos: 'WR', games: WR, props: [] },
      { id: 'p-rb', name: 'Back Guy', key: 'back guy', team: 'LAR', pos: 'RB', games: RB, props: [] },
      { id: 'p-qb', name: 'Arm Guy', key: 'arm guy', team: 'LAR', pos: 'QB', games: QB, props: [] },
    ];
    const args = { season: 2026, week: 10, games: [{ id: 'g', date: '2026-11-08T21:25Z', away: 'LAR', home: 'SEA', final: false, state: 'pre', odds: { spread: 'SEA -3', total: 47.5 } }], sheets: [], pf: { at: 'a', data: { players, defense: null } }, results: {} };
    const plain = plainBuild(args).projections.rows;
    const built = makeBuild(undefined, { params: { MODEL } })(args).projections;
    const fed = built.rows;
    // The payload names the trees (what they were trained on, the weights) and does not carry them.
    expect(built.constants.MODEL).toEqual({ version: MODEL.version, trained: MODEL.trained, rows: MODEL.rows, blend: MODEL.blend });
    expect(modelText(fed['wide guy|LAR'].yards.rec_yds.model)).toMatch(/^the board's \d+ blended with the learned read's \d+$/);
    expect(modelText(fed['back guy|LAR'].td.model, 'td')).toMatch(/%.*%$/);
    const y0 = plain['wide guy|LAR'].yards.rec_yds; const y1 = fed['wide guy|LAR'].yards.rec_yds;
    expect(y0.model).toBeNull();
    expect(y1.model.before).toBe(y0.proj);
    expect(y1.proj).toBeCloseTo((y1.model.before + y1.model.pred) / 2, 0);
    expect(y1.tiers.strong.mark).toBeLessThanOrEqual(y1.proj);
    const r1 = fed['back guy|LAR'];
    expect(r1.yards.rush_yds.model.before).toBe(plain['back guy|LAR'].yards.rush_yds.proj);
    expect(r1.td.model.before).toBeGreaterThan(0);
    expect(r1.td.p).toBeGreaterThan(Math.min(r1.td.model.before, r1.td.model.pred) - 0.002);
    expect(r1.td.p).toBeLessThan(Math.max(r1.td.model.before, r1.td.model.pred) + 0.002);
    expect(fed['arm guy|LAR'].yards.pass_yds.model).toBeNull();
    expect(fed['arm guy|LAR'].yards.pass_yds.proj).toBe(plain['arm guy|LAR'].yards.pass_yds.proj);
    expect(fed['wide guy|LAR'].feats).toBeUndefined();
  });
  test("where the passing goes: the side's receivers as parts of their own sum, on the starter's passing read", () => {
    const QB = logs(() => ({ passAtt: 34, passCmp: 22, passYds: 240 }));
    const TE = logs(() => ({ rec: 3, recYds: 30, tgt: 4, tgtShare: 0.1 }));
    const players = [
      { id: 'p-wr', name: 'Wide Guy', key: 'wide guy', team: 'LAR', pos: 'WR', games: WR, props: [] },
      { id: 'p-te', name: 'Tight Guy', key: 'tight guy', team: 'LAR', pos: 'TE', games: TE, props: [] },
      { id: 'p-qb', name: 'Arm Guy', key: 'arm guy', team: 'LAR', pos: 'QB', games: QB, props: [] },
    ];
    const rows = plainBuild({ season: 2026, week: 10, games: [{ id: 'g', date: '2026-11-08T21:25Z', away: 'LAR', home: 'SEA', final: false, state: 'pre', odds: { spread: 'SEA -3', total: 47.5 } }], sheets: [], pf: { at: 'a', data: { players, defense: null } }, results: {} }).projections.rows;
    const to = rows['arm guy|LAR'].yards.pass_yds.to;
    const wr = rows['wide guy|LAR'].yards.rec_yds; const te = rows['tight guy|LAR'].yards.rec_yds;
    expect(to.players.map((p) => p.player)).toEqual(['Wide Guy', 'Tight Guy']);
    expect(to.sum).toBeCloseTo(wr.proj + te.proj, 1);
    expect(to.players[0]).toMatchObject({ id: 'wide guy|LAR', pos: 'WR', proj: wr.proj, share: wr.teamShare });
    expect(wr.teamShare + te.teamShare).toBeCloseTo(1, 2);
    expect(wr.teamShare).toBeGreaterThan(te.teamShare);
    expect(to.rest).toBe(0);
  });
});
