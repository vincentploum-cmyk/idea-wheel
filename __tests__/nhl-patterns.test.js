import RULES from '../lib/nhl-data/patterns-rules.json';
import { makeTracker, patternTable, patternRecord, pillsFor, matches, rulesKeys, rulesCatalog, skaterPatterns, describe as describeFact, seasonStart, MARKS } from '../lib/nhl-data/patterns-pure';

// A small season: BOS and TOR play three times, MTL twice; one BOS left wing (id 1) and his teammates.
function row(date, gameId, playerId, team, opp, venue, pos, line, s = {}) {
  return { date, gameId, playerId, name: `P${playerId}`, team, opp, venue, pos, line, toi: 18, g: 0, a: 0, sog: 2, hits: 1, blk: 0, icf: 4, iff: 3, isf: 2, iscf: 1, ihdcf: 0, ...s };
}
function game(date, id, away, home, shots = {}) {
  // Two skaters a side: an LW1 and a D1; `shots` overrides by playerId.
  const ids = { BOS: [1, 2], TOR: [3, 4], MTL: [5, 6] };
  const out = [];
  for (const [team, opp, venue] of [[away, home, 'A'], [home, away, 'H']]) {
    const [f, d] = ids[team];
    out.push(row(date, id, f, team, opp, venue, 'LW', 1, shots[f] || {}));
    out.push(row(date, id, d, team, opp, venue, 'D', 1, shots[d] || {}));
  }
  return out;
}
const season = [
  ...game('2026-10-01', 1, 'BOS', 'TOR', { 1: { sog: 4, g: 1, icf: 7 }, 3: { sog: 1 } }),
  ...game('2026-10-03', 2, 'MTL', 'BOS', { 1: { sog: 3, icf: 6 }, 5: { sog: 5 } }),
  ...game('2026-10-05', 3, 'TOR', 'BOS', { 1: { sog: 5, g: 2, icf: 9 }, 3: { sog: 0 } }),
  ...game('2026-10-07', 4, 'BOS', 'MTL', { 1: { sog: 1, icf: 2 } }),
];

describe('patterns: the features, read the morning of each game', () => {
  test('a skater-game carries only the games before it', () => {
    const { rows } = patternTable(season, { date: '2026-10-08' });
    const p1 = rows.filter((r) => r.playerId === 1);
    expect(p1.map((r) => r.date)).toEqual(['2026-10-03', '2026-10-05', '2026-10-07']);   // his first game carries nothing
    const third = p1.find((r) => r.date === '2026-10-05');
    expect(third.f.gp).toBe(2);
    expect(third.f.sog_avg).toBe(3.5);   // 4 and 3, not tonight's 5
    expect(third.f.str_s3).toBe(2);
    expect(third.f.str_g).toBe(0);
    expect(third.f.since_g).toBe(1);
    expect(third.o.y_s3).toBe(1); expect(third.o.y_s5).toBe(1); expect(third.o.y_g2).toBe(1); expect(third.o.y_g3).toBe(0);
  });

  test('the venue split, the streaks and the head to head', () => {
    const t = makeTracker();
    for (const d of ['2026-10-01', '2026-10-03', '2026-10-05']) t.addDate(season.filter((r) => r.date === d));
    const f = t.features({ playerId: 1, team: 'BOS', opp: 'TOR', venue: 'H', pos: 'LW', line: 1, date: '2026-10-09' });
    expect(f.gp).toBe(3);
    expect(f.ven_n).toBe(2);                 // home on the 3rd and 5th
    expect(f.ven_sog).toBe(4);               // 3 and 5
    expect(f.ven_sog_x).toBeCloseTo(4 / 4, 3);
    expect(f.str_s3).toBe(3);
    expect(f.s3_rate).toBe(1);
    expect(f.h2h_n).toBe(2);                 // TOR twice
    expect(f.h2h_g).toBe(3);
    expect(f.slot).toBe('LW1');
    expect(f.home).toBe(1);
  });

  test('what the opponent gives up to his position, against the league, ranked', () => {
    const t = makeTracker();
    for (const d of ['2026-10-01', '2026-10-03', '2026-10-05']) t.addDate(season.filter((r) => r.date === d));
    // TOR's defense: BOS's LW took 4 (Oct 1) and 5 (Oct 5) → 4.5 a skater.
    const f = t.features({ playerId: 1, team: 'BOS', opp: 'TOR', venue: 'A', pos: 'LW', line: 1, date: '2026-10-09' });
    expect(f.opp_pos_sog).toBe(4.5);
    // The league's LWs this season: 4, 1, 3, 5, 5, 0 → 3 a skater.
    expect(f.opp_pos_sog_x).toBe(1.5);
    expect(f.opp_pos_sog_rk).toBe(1);       // TOR gave LWs the most
    expect(f.opp_slot_sog).toBe(4.5);       // LW1 a game
    expect(f.opp_gp).toBe(2);
    expect(f.opp_sa).toBe((4 + 2 + 5 + 2) / 2);   // shots against a game: LW + D each night
    expect(f.opp_pos_sog_ven).toBe(4);      // BOS away tonight: TOR's home game alone (Oct 1)
  });

  test('a row before the season of the date is never counted', () => {
    const old = row('2026-04-10', 99, 1, 'BOS', 'TOR', 'H', 'LW', 1, { sog: 9 });
    const { rows } = patternTable([old, ...season], { date: '2026-10-08' });
    expect(rows.find((r) => r.playerId === 1).f.gp).toBe(1);
    expect(seasonStart('2026-10-08')).toBe('2026-07-01');
    expect(seasonStart('2027-03-01')).toBe('2026-07-01');
  });
});

describe('patterns: the rules and the pills', () => {
  const rules = {
    builtThrough: '2026-10-02',
    marks: {
      s3: { label: '3+ SOG', bar: 0.5, base: 0.2, rules: [
        { id: 'a', kind: 'rule', held: true, rate: 0.6, when: [{ f: 'sog_avg', op: '>=', v: 3 }] },
        { id: 'b', kind: 'rule', held: false, rate: 0.9, when: [{ f: 'str_s3', op: '>=', v: 5 }] },
        { id: 't', kind: 'tier', held: true, rate: 0.3, when: [{ f: 'sog_avg', op: '>=', v: 0 }] },
      ] },
      g1: { label: '1+ goal', bar: 0.35, base: 0.15, rules: [
        { id: 'g', kind: 'rule', held: true, rate: 0.3, when: [{ f: 'g_avg', op: '>=', v: 0.5 }, { f: 'pos', op: '==', v: 'LW' }] },
      ] },
    },
  };

  test('a pick needs a rule that held and a rate over the bar', () => {
    const f = { sog_avg: 3.5, str_s3: 6, g_avg: 1, pos: 'LW' };
    const p = pillsFor(f, rules, null);
    expect(p.s3.p).toBe(0.9);                  // the strongest rule he meets is the figure …
    expect(p.s3.selected).toBe(false);         // … but it did not hold: no pick
    const p2 = pillsFor({ ...f, str_s3: 1 }, rules, null);
    expect(p2.s3).toMatchObject({ p: 0.6, selected: true });
    expect(p2.s3.rule.id).toBe('a');
    expect(p2.g1).toMatchObject({ p: 0.3, selected: false });   // held, under the 35% bar
    expect(pillsFor({ sog_avg: 1, g_avg: 0, pos: 'D' }, rules, null).s3).toMatchObject({ p: 0.3, selected: false });   // the tier
    expect(pillsFor({ sog_avg: null }, rules, null).g1.p).toBe(0.15);   // nothing fits: the base rate
    expect(matches({ when: [{ f: 'x', op: '>=', v: 1 }] }, {})).toBe(false);
  });

  test('the record counts the nights after the study, each with the rates as they stood that morning', () => {
    const table = [
      { date: '2026-10-01', f: { sog_avg: 4 }, o: { y_s3: 0, y_g1: 0 } },   // the study's own night: not counted
      { date: '2026-10-03', f: { sog_avg: 4 }, o: { y_s3: 1, y_g1: 0 } },
      { date: '2026-10-03', f: { sog_avg: 4 }, o: { y_s3: 0, y_g1: 0 } },
      { date: '2026-10-05', f: { sog_avg: 4 }, o: { y_s3: 0, y_g1: 0 } },
    ];
    const rec = patternRecord(table, rules, { k: 2 });
    expect(rec.from).toBe('2026-10-03');
    expect(rec.games).toBe(3);
    // Oct 3: rule a at its prior 0.6 → two picks, one landed. Oct 5: (1 + 2 × 0.6) / (2 + 2) = 0.55 → a pick, missed.
    expect(rec.marks.s3).toMatchObject({ picks: 3, landed: 1 });
    expect(rec.rates.s3[0]).toMatchObject({ n: 3, hits: 1 });
    expect(rec.rates.s3[0].rate).toBeCloseTo((1 + 2 * 0.6) / (3 + 2), 6);
  });

  test('the payload: the conditions behind a pick as facts, the notes beside them', () => {
    const f = { gp: 8, sog_avg: 3.4, sog_l5: 3.8, str_s3: 1, str_pt: 4, g_avg: 0.6, pos: 'LW', ven_n: 4, ven_sog_x: 1.3, opp_teams: 32 };
    const out = skaterPatterns(f, rules, null, { opp: 'TOR', pos: 'LW', slot: 'LW1', home: true });
    expect(out.pills.s3.selected).toBe(true);
    expect(out.facts.map((x) => x.key)).toEqual(['sog_avg']);
    expect(out.facts[0].marks).toEqual(['s3']);
    expect(out.notes.map((n) => n.key)).toEqual(['str_pt', 'ven_sog_x']);
    expect(out.pills.s3).toMatchObject({ rule: 'a', vals: [3.4] });
    expect(out.facts[0].short).toBe('3.4 SOG · season');
  });

  test('describe words the opponent, his venue and his runs', () => {
    expect(describeFact({ f: 'opp_pos_ihdcf_l5_rk', op: '<=', v: 5 }, 3, { opp: 'TOR', pos: 'LW' }).short).toBe('TOR #3 iHDCF to LW · L5');
    expect(describeFact({ f: 'opp_ga_rk', op: '<=', v: 10 }, 4, { opp: 'MTL' }).short).toBe('MTL #4 GA · season');
    expect(describeFact({ f: 'ven_sog_x', op: '>=', v: 1.18 }, 1.25, { home: false }).short).toBe('away ×1.25 SOG');
    expect(describeFact({ f: 'str_s3', op: '>=', v: 3 }, 4).short).toBe('3+ SOG 4 straight');
    expect(describeFact({ f: 'opp_fa_l10', op: '>=', v: 34 }, 35.2, { opp: 'TOR' }).short).toBe('TOR FA 35.2 · L10');
  });
});

describe('patterns: the study’s rules', () => {
  test('every rule reads a figure the feature builder makes, every line has a bar and a ladder', () => {
    const { rows } = patternTable(season, { date: '2026-10-08' });
    const keys = new Set(Object.keys(rows[rows.length - 1].f));
    for (const k of rulesKeys(RULES)) expect(keys.has(k) ? k : `missing ${k}`).toBe(k);
    for (const m of MARKS) {
      const mk = RULES.marks[m.key];
      expect(mk.bar).toBeGreaterThan(0);
      expect(mk.rules.some((r) => r.kind === 'tier')).toBe(true);
      for (const r of mk.rules) for (const c of r.when) expect(['>=', '<=', '==']).toContain(c.op);
    }
    expect(RULES.builtThrough).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const cat = rulesCatalog(RULES);
    expect(Object.keys(cat).length).toBe(Object.values(RULES.marks).reduce((n, m) => n + m.rules.length, 0));   // ids are unique
  });
});
