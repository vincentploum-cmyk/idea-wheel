"""PropFinder's opponent tables (the CSV exports bundled in lib/nhl-data/seed, written to a
folder by a one-line node script, or fresh exports) -> one CSV: season, window, position, team,
GP, SOG/G + rank, G/G + rank, SC/G + rank. Ranks are PropFinder's own (1 = most allowed).
argv: <folder of nhl-team-stats-Opponent-*.csv> <out csv>
To write the bundled files:  node -e "import('./lib/nhl-data/seed/propfinder-2025.js').then(m=>{const fs=require('fs');for(const f of m.PROPFINDER_SEED.files)fs.writeFileSync(process.argv[1]+'/'+f.name,f.text)})" <folder>
"""
import sys, glob, csv, re, os
NAMES = {'Ducks': 'ANA', 'Bruins': 'BOS', 'Sabres': 'BUF', 'Hurricanes': 'CAR', 'Blue Jackets': 'CBJ', 'Flames': 'CGY', 'Blackhawks': 'CHI', 'Avalanche': 'COL',
         'Stars': 'DAL', 'Red Wings': 'DET', 'Oilers': 'EDM', 'Panthers': 'FLA', 'Kings': 'LAK', 'Wild': 'MIN', 'Canadiens': 'MTL', 'Devils': 'NJD', 'Predators': 'NSH',
         'Islanders': 'NYI', 'Rangers': 'NYR', 'Senators': 'OTT', 'Flyers': 'PHI', 'Penguins': 'PIT', 'Kraken': 'SEA', 'Sharks': 'SJS', 'Blues': 'STL', 'Lightning': 'TBL',
         'Maple Leafs': 'TOR', 'Mammoth': 'UTA', 'Utah Hockey Club': 'UTA', 'Canucks': 'VAN', 'Golden Knights': 'VGK', 'Jets': 'WPG', 'Capitals': 'WSH'}
folder, out = sys.argv[1], sys.argv[2]
def ranked(cell):
    m = re.match(r'^\s*([-\d.]+)%?\s*(?:#(\d+))?', cell or '')
    return (float(m.group(1)), int(m.group(2)) if m.group(2) else None) if m else (None, None)
rows = []
for f in sorted(glob.glob(f'{folder}/nhl-team-stats-Opponent-*.csv')):
    name = os.path.basename(f)
    lines = open(f, encoding='utf-8-sig').read().replace('\r', '').split('\n')
    meta = {}; i = 0
    while i < len(lines) and lines[i].strip():
        k, _, v = lines[i].partition(','); meta[k] = v; i += 1
    while i < len(lines) and not lines[i].strip(): i += 1
    head = lines[i].split(','); body = [l.split(',') for l in lines[i + 1:] if l.strip()]
    tail = name.lower().replace('.csv', '')
    tag = next((t for t in re.split(r'[-_]', tail)[::-1] if t in ('lw', 'rw', 'c', 'd', 'all')), 'all')
    position = 'All' if tag == 'all' else tag.upper()
    wm = re.search(r'(?:last|l)\s*(\d+)', meta.get('Window', ''), re.I)
    window = wm.group(1) if wm else 'season'
    col = {h: j for j, h in enumerate(head)}
    for r in body:
        abbr = NAMES.get(r[0])
        if not abbr: print('unknown team', r[0], 'in', name); continue
        sog, sogr = ranked(r[col['SOG']]); g, gr = ranked(r[col['G']]); sc, scr = ranked(r[col['SC']])
        rows.append(dict(file=name, season=meta.get('Season'), window=window, position=position, abbr=abbr, gp=r[col['GP']], sog=sog, sog_rank=sogr, g=g, g_rank=gr, sc=sc, sc_rank=scr))
    print(name, meta.get('Stats Type'), position, window, len(body), 'teams')
with open(out, 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print('wrote', len(rows), 'rows to', out)
