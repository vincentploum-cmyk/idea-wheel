// The period an odds item names (pure, client-safe): "1st Half Player Receiving Yards [H1receivingYards]" → h1,
// "1st Quarter Player Points [Q1points]" → q1, "1st 3 Minutes Player Points" → m3 (the first N minutes of the game).
// Each sport files a period's item under `<key>_<market>` when it has that market (lib/picks/propfinder.js
// marketOfItem), never under the full game's; a period the sport has no market for is kept aside with the pull's extra.
const PER_NAME = /^(1st|first|2nd|second|3rd|third|4th|fourth)\s+(half|quarter)\s+/i;
// "1st 3 Minutes Player Points", "Player Points - First 3 Minutes", "1st 3 Min Points"; the categories "first3MinPoints",
// "points3min".
const PER_MINUTES = /(?:\b1st|\bfirst)\s+(\d{1,2})\s+min(?:ute)?s?\b/i;
const CAT_MINUTES = /^first(\d{1,2})min(?:ute)?s?(?=[A-Za-z])|(\d{1,2})min(?:ute)?s?$/i;
const PER_CAT = /^(H[12]|Q[1-4])(?=[a-z])/;
const ORD = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4 };

/** { key: 'h1' | 'h2' | 'q1' … 'q4' | 'm<N>', name, cat } with the period's words taken off, or null when no period is named. */
export function periodOf(name, cat) {
  const nm = String(name || ''); const ct = String(cat || '');
  const mins = nm.match(PER_MINUTES); const cmin = ct.match(CAT_MINUTES);
  if (mins || cmin) {
    const n = Number(mins ? mins[1] : cmin[1] || cmin[2]);
    const name = (mins ? nm.replace(PER_MINUTES, ' ') : nm).replace(/\s+(?:in|-)\s*$|^\s*(?:-|in)\s+/gi, ' ').replace(/\s+/g, ' ').trim();
    return { key: `m${n}`, name, cat: cmin ? ct.replace(CAT_MINUTES, '') : ct };
  }
  const m = nm.match(PER_NAME); const c = ct.match(PER_CAT);
  if (!m && !c) return null;
  const key = m ? `${/half/i.test(m[2]) ? 'h' : 'q'}${ORD[m[1].toLowerCase()]}` : c[1].toLowerCase();
  return { key, name: nm.replace(PER_NAME, ''), cat: ct.replace(PER_CAT, '') };
}
