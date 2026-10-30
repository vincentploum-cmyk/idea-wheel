// MTL @ DAL as the Matchups tab read it on 2026-10-30, in the shapes the slate hands the profile
// builder: the two sides (each side's `defense` and `propfinder` describe its opponent), the
// verdicts and the total, MoneyPuck's block, the finishing / goaltending ranks, the shooting
// profiles, every team's own rates and PropFinder's team table. Shared by the builder test and
// the card's render test (and the mock-up renders, `MOCK_OUT`).

const pfRow = (gp, sog, g, rankSog, rankG) => ({ gp, g, a: g * 1.7, sog, icf: sog * 1.8, iff: sog * 1.35, iscf: sog * 0.9, ranks: { g: rankG, a: rankG, sog: rankSog, icf: rankSog, iff: rankSog, iscf: rankSog } });
const tab = (key, label, kind, rows, extra = {}) => ({ key, label, season: 2026, count: 32, asOf: '2026-10-29', rows, kind, ...extra });

// What each team allows, as the other side's objects carry it.
const dalDefense = {
  All: { season: { gp: 6, sog: 24.2, g: 2.1, iscf: 21 }, rank: { sog: 31, g: 29, iscf: 30 }, source: 'games', teamCount: 32, l10: { gp: 10, sog: 26.0, g: 2.4 }, l10Rank: { sog: 25, g: 24 }, firstGoal: { games: 6, allowed: 2, share: 0.33, rank: 27, teamCount: 32, league: 0.5, bySlot: { C1: 1, D2: 1 } } },
  LW: { season: { gp: 6, sog: 6.1, g: 0.5 }, rank: { sog: 30, g: 28 }, teamCount: 32 },
  C: { season: { gp: 6, sog: 8.0, g: 0.8 }, rank: { sog: 8, g: 10 }, teamCount: 32 },
  RW: { season: { gp: 6, sog: 5.9, g: 0.4 }, rank: { sog: 29, g: 30 }, teamCount: 32 },
  D: { season: { gp: 6, sog: 4.2, g: 0.4 }, rank: { sog: 31, g: 26 }, teamCount: 32 },
};
const mtlDefense = {
  All: { season: { gp: 5, sog: 33.1, g: 2.6, iscf: 29 }, rank: { sog: 3, g: 20, iscf: 4 }, source: 'games', teamCount: 32, l10: { gp: 10, sog: 31.8, g: 2.9 }, l10Rank: { sog: 6, g: 14 }, firstGoal: { games: 5, allowed: 3, share: 0.6, rank: 8, teamCount: 32, league: 0.5, bySlot: { LW1: 2, RW2: 1 } } },
  LW: { season: { gp: 5, sog: 9.1, g: 0.8 }, rank: { sog: 2, g: 6 }, teamCount: 32 },
  C: { season: { gp: 5, sog: 7.5, g: 0.6 }, rank: { sog: 13, g: 18 }, teamCount: 32 },
  RW: { season: { gp: 5, sog: 8.4, g: 0.7 }, rank: { sog: 4, g: 9 }, teamCount: 32 },
  D: { season: { gp: 5, sog: 8.1, g: 0.5 }, rank: { sog: 6, g: 17 }, teamCount: 32 },
};
const dalTabs = {
  cols: [['g', 'Goals/G'], ['a', 'Assists/G'], ['sog', 'Shots/G'], ['icf', 'ICF/G'], ['iff', 'IFF/G'], ['iscf', 'ISCF/G']],
  tabs: [
    tab('season-2025', '2025', 'season', { All: pfRow(82, 27.9, 2.8, 20, 18), LW: pfRow(82, 7.1, 0.7, 22, 20), C: pfRow(82, 7.6, 0.8, 14, 15), RW: pfRow(82, 6.9, 0.6, 21, 23), D: pfRow(82, 6.3, 0.5, 19, 17) }, { season: 2025 }),
    tab('season-2026', '2026', 'season', { All: pfRow(11, 25.1, 2.4, 30, 26), LW: pfRow(11, 6.4, 0.5, 30, 27), C: pfRow(11, 8.1, 0.8, 7, 11), RW: pfRow(11, 6.3, 0.5, 29, 28), D: pfRow(11, 5.2, 0.4, 31, 25) }),
    tab('l10', 'L10', 'window', { All: pfRow(10, 25.8, 2.5, 27, 24), LW: pfRow(10, 6.6, 0.6, 28, 22), C: pfRow(10, 8.3, 0.8, 6, 12), RW: pfRow(10, 6.5, 0.5, 26, 27), D: pfRow(10, 5.5, 0.4, 30, 26) }, { windowGames: 10, split: null }),
  ],
};
const mtlTabs = {
  cols: dalTabs.cols,
  tabs: [
    tab('season-2025', '2025', 'season', { All: pfRow(82, 30.2, 3.1, 8, 10), LW: pfRow(82, 8.4, 0.8, 6, 9), C: pfRow(82, 7.7, 0.8, 12, 13), RW: pfRow(82, 7.9, 0.7, 9, 11), D: pfRow(82, 6.9, 0.5, 10, 14) }, { season: 2025 }),
    tab('season-2026', '2026', 'season', { All: pfRow(10, 31.4, 2.9, 4, 14), LW: pfRow(10, 8.9, 0.8, 2, 7), C: pfRow(10, 7.6, 0.7, 12, 16), RW: pfRow(10, 8.2, 0.7, 5, 10), D: pfRow(10, 6.8, 0.5, 18, 19) }),
    tab('l10', 'L10', 'window', { All: pfRow(10, 31.0, 3.0, 6, 11), LW: pfRow(10, 8.7, 0.8, 3, 8), C: pfRow(10, 7.5, 0.7, 13, 15), RW: pfRow(10, 8.0, 0.7, 6, 12), D: pfRow(10, 6.9, 0.5, 15, 18) }, { windowGames: 10, split: null }),
  ],
};

// Lineup skaters with the run's λ: eighteen a side, the shots adding to the team's read.
const skaters = (team, opp, venue, sogs, goals) => sogs.map((sog, i) => ({ id: 8480000 + (team === 'MTL' ? 0 : 50) + i, name: `${team} Skater ${i + 1}`, team, opp, venue, pos: i < 12 ? ['LW', 'C', 'RW'][i % 3] : 'D', line: i < 12 ? Math.floor(i / 3) + 1 : Math.floor((i - 12) / 2) + 1, inLineup: true, gp: 10, model: { sog, g: goals[i], p3s: 0.4, p1g: 0.2 } }));
const mtlSog = [3.4, 2.9, 2.6, 2.4, 2.1, 1.9, 1.8, 1.6, 1.4, 1.2, 1.1, 1.0, 2.2, 1.9, 1.5, 1.3, 1.1, 0.9];
const mtlG = [0.42, 0.36, 0.3, 0.28, 0.22, 0.2, 0.18, 0.16, 0.12, 0.1, 0.1, 0.08, 0.14, 0.12, 0.08, 0.07, 0.06, 0.05];
const dalSog = [3.1, 2.7, 2.4, 2.2, 2.0, 1.7, 1.6, 1.4, 1.3, 1.1, 1.0, 0.9, 2.0, 1.7, 1.4, 1.2, 1.0, 0.8];
const dalG = [0.4, 0.34, 0.28, 0.26, 0.2, 0.18, 0.16, 0.14, 0.11, 0.1, 0.09, 0.07, 0.12, 0.1, 0.07, 0.06, 0.05, 0.04];

export const game = {
  id: 2026020150, away: 'MTL', home: 'DAL',
  sides: [
    { team: 'MTL', opp: 'DAL', venue: 'A', skaters: skaters('MTL', 'DAL', 'A', mtlSog, mtlG), defense: dalDefense, propfinder: dalTabs, plays: { shots: [{ name: 'Cole Caufield', market: '3+ SOG', prob: 0.62, stat: 'sog', min: 3 }], goals: [{ name: 'Nick Suzuki', market: '1+ G', prob: 0.31, stat: 'g', min: 1 }] } },
    { team: 'DAL', opp: 'MTL', venue: 'H', skaters: skaters('DAL', 'MTL', 'H', dalSog, dalG), defense: mtlDefense, propfinder: mtlTabs, plays: { shots: [{ name: 'Jason Robertson', market: '3+ SOG', prob: 0.58, stat: 'sog', min: 3 }], goals: [] } },
  ],
  verdicts: { MTL: { headline: 'Leaky defense away', tier: 'leaky' }, DAL: { headline: 'Tight defense at home', tier: 'tight' } },
  total: { headline: 'Average scoring · 6.0 goals', tier: 'average', projected: 6.0, league: 6.1 },
};

const filler = Object.fromEntries(['NYR', 'NJD', 'BOS', 'PIT', 'TOR', 'OTT', 'BUF', 'DET', 'FLA', 'TBL'].map((t) => [t, { gp: 10, sf60: 28, gf60: 3.0, xgf60: 2.9, xga60: 2.9, ga60: 2.9, hdsf60: 10, hdsa60: 10, cfPct: 50, pace60: 105 }]));
export const moneypuck = {
  updatedAt: '2026-10-30T09:00:00Z', year: 2026, teams: 32,
  situations: { all: { ...filler,
    MTL: { gp: 10, sf60: 30.1, gf60: 3.3, xgf60: 3.05, xga60: 3.2, ga60: 2.7, hdsf60: 11.0, hdsa60: 11.4, cfPct: 51.2, pace60: 112.0 },
    DAL: { gp: 11, sf60: 27.0, gf60: 3.1, xgf60: 2.7, xga60: 2.3, ga60: 2.4, hdsf60: 9.4, hdsa60: 8.6, cfPct: 52.0, pace60: 98.0 },
  } },
  ranks: { all: {
    MTL: { sf60: 7, gf60: 6, xgf60: 8, xga60: 22, hdsf60: 9, hdsa60: 21, cfPct: 10, pace60: 6 },
    DAL: { sf60: 19, gf60: 12, xgf60: 18, xga60: 2, hdsf60: 20, hdsa60: 3, cfPct: 7, pace60: 27 },
  } },
};
export const ratios = { n: 28, finishing: { MTL: { ratio: 1.08, rank: 9 }, DAL: { ratio: 1.15, rank: 4 } }, goaltending: { MTL: { ratio: 0.84, rank: 2 }, DAL: { ratio: 1.04, rank: 18 } } };
export const profiles = { teams: { MTL: { games: 10, season: 2026, first: { games: 10, scored: 6, share: 0.6 } }, DAL: { games: 11, season: 2026, first: { games: 11, scored: 7, share: 0.64 } } }, league: {}, teamCount: 32 };
export const rates = {
  season: 2026, teamCount: 32, league: { sog: 28.6, g: 3.0 },
  teams: {
    MTL: { gp: 10, sog: 31.2, g: 3.4, l5: { gp: 5, sog: 34.5, g: 3.8 }, season: 2026, held: false },
    DAL: { gp: 11, sog: 28.0, g: 3.1, l5: { gp: 5, sog: 24.9, g: 2.6 }, season: 2026, held: false },
  },
  ranks: { MTL: { sog: 5, g: 6 }, DAL: { sog: 17, g: 12 } },
};
export const pfTeams = {
  season: 2026, count: 32,
  teams: {
    MTL: { name: 'Montreal Canadiens', gp: 10, g: 3.3, a: 5.6, pts: 8.9, sog: 31.0, shPct: 10.6, ppPct: 27.5, pkPct: 76.1, sc: 28.4, hdc: 11.2, hdg: 1.4 },
    DAL: { name: 'Dallas Stars', gp: 11, g: 3.2, a: 5.4, pts: 8.6, sog: 27.8, shPct: 11.5, ppPct: 21.0, pkPct: 84.2, sc: 24.1, hdc: 9.6, hdg: 1.3 },
  },
  ranks: {
    MTL: { g: 7, a: 8, pts: 7, sog: 6, shPct: 15, ppPct: 3, pkPct: 24, sc: 4, hdc: 8, hdg: 10 },
    DAL: { g: 10, a: 11, pts: 10, sog: 18, shPct: 9, ppPct: 15, pkPct: 4, sc: 19, hdc: 17, hdg: 12 },
  },
};
export const h2h = [
  { gameId: 2025020310, date: '2025-11-20', goals: { MTL: 2, DAL: 4 }, home: 'DAL', total: 6 },
  { gameId: 2025020880, date: '2026-02-14', goals: { MTL: 5, DAL: 2 }, home: 'MTL', total: 7 },
];
