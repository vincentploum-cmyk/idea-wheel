/**
 * The Defense tab's by-line table (Vincent, 2026-10-31, after the rink head: the slot a team gives the most to, not the
 * rank-based softest slot): the first column names the raw leader with its figure, its rank chip and the opponent's skater
 * there tonight, the teams sorted by the figure; a header still sorts by any slot.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LineTable } from '@/components/nhl/DefensePanel';

const cell = (value, rank, n = 13) => ({ value, n, rank, of: 2, ratio: 1 });
const board = {
  slots: ['C1', 'C2', 'C3'],
  league: { C1: 2.35, C2: 1.92, C3: 1.57 },
  teams: [
    { abbr: 'PIT', gp: 13, cells: { C1: cell(2.9, 1), C2: cell(1.8, 2), C3: cell(1.8, 1) }, softest: { slot: 'C3', ...cell(1.8, 1) }, most: { slot: 'C1', ...cell(2.9, 1) } },
    { abbr: 'VAN', gp: 12, cells: { C1: cell(2.9, 2), C2: cell(3.2, 1), C3: cell(1.5, 2) }, softest: { slot: 'C2', ...cell(3.2, 1) }, most: { slot: 'C2', ...cell(3.2, 1) } },
  ],
};
const games = [{ away: 'MTL', home: 'PIT', sides: [{ team: 'MTL', skaters: [{ id: 8, name: 'Oliver Kapanen', pos: 'C', line: 1 }, { id: 7, name: 'Phillip Danault', pos: 'C', line: 3 }] }, { team: 'PIT', skaters: [] }] }];
const rowText = (html) => [...html.matchAll(/<tr(?: class="[^"]*")?><td class="is-left">(.*?)<\/tr>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

test('the raw leader first, by the figure; its slot marked on the row; the skater at that slot tonight', () => {
  const html = renderToStaticMarkup(<LineTable board={board} digits={1} metric="sog" playing={new Set()} view="all" active={null} onPick={() => {}} games={games} />);
  expect(html).toContain('Gives the most to');
  expect(html).not.toContain('Softest line');
  const rows = rowText(html);
  expect(rows[0]).toMatch(/^VAN 12 C2 3\.2/);
  expect(rows[1]).toMatch(/^PIT 13 C1 2\.9 .*Kapanen/);
  expect(rows[1]).not.toContain('Danault');
  expect(html).toContain('more than to any other slot');
  expect(html).toContain('says where the shots went, not where they will go');
  // The leader's cell is marked on PIT's row at C1, not at the rank-based C3.
  const pit = html.slice(html.indexOf('PIT</button>'), html.indexOf('VAN</button>') > html.indexOf('PIT</button>') ? html.indexOf('VAN</button>') : undefined);
  expect(pit).toMatch(/is-best[^>]*><b>2\.9<\/b>/);
  expect(pit).not.toMatch(/is-best[^>]*><b>1\.8<\/b>/);
});
