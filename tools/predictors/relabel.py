"""Relabel each skater-game with the position he played that night, as PropFinder's tables
and the site's stored rows have it, instead of the box score's registered position (which
lists six to eight "C" a team). Centres = the team's forwards who took the draws (top four by
faceoffs taken, at least two); the rest are wingers on their registered side, and a
registered centre on the wing goes to the side with fewer wingers (PropFinder's listing wins
when it carries him). Defence is unchanged.
argv: <games dir> <faceoffs.json> <out games dir> [propfinder skater csv]
"""
import sys, glob, json, os, csv, re, unicodedata
games_dir, fo_file, out_dir = sys.argv[1:4]
pf_file = sys.argv[4] if len(sys.argv) > 4 else None
os.makedirs(out_dir, exist_ok=True)
fo = json.load(open(fo_file))
def norm(n):
    n = unicodedata.normalize('NFD', n); n = ''.join(c for c in n if not unicodedata.combining(c))
    return re.sub(r"[.,'’`-]", '', n).lower().strip()
pfpos = {}
if pf_file:
    lines = open(pf_file, encoding='utf-8-sig').read().split('\n')
    i = next(j for j, l in enumerate(lines) if l.startswith('PLAYER'))
    for l in lines[i + 1:]:
        if not l.strip(): continue
        cell = l.split(',')[0].split()
        while len(cell) > 2 and cell[-1].upper() in ('IR', 'IR-LT', 'IR-NR', 'LTIR', 'O', 'OUT', 'DTD', 'GTD', 'SUSP', 'NA', 'DNP', 'SCR'): cell.pop()
        if cell and cell[-1] in ('C', 'LW', 'RW', 'D', 'G'): pfpos[norm(' '.join(cell[:-1]))] = cell[-1]
stats = dict(games=0, relabeled=0, fwd=0, c_fewer=0)
for f in sorted(glob.glob(f'{games_dir}/*.json')):
    day = json.load(open(f))
    for g in day['games']:
        taken = {int(k): v for k, v in fo.get(str(g['id']), {}).items()}
        stats['games'] += 1
        for team in (g['away']['abbrev'], g['home']['abbrev']):
            fwds = [s for s in g['skaters'] if s['team'] == team and s['pos'] in ('C', 'LW', 'RW')]
            fwds.sort(key=lambda s: -taken.get(s['id'], 0))
            centres = [s for s in fwds if taken.get(s['id'], 0) >= 2][:4]
            if len(centres) < 4: stats['c_fewer'] += 1
            cid = {s['id'] for s in centres}
            wings = {'LW': 0, 'RW': 0}
            new = {}
            for s in fwds:
                if s['id'] in cid: new[s['id']] = 'C'
                elif s['pos'] in ('LW', 'RW'): new[s['id']] = s['pos']; wings[s['pos']] += 1
            for s in fwds:
                if s['id'] in new: continue
                p = pfpos.get(norm(s['name']))
                side = p if p in ('LW', 'RW') else ('LW' if wings['LW'] <= wings['RW'] else 'RW')
                new[s['id']] = side; wings[side] += 1
            for s in fwds:
                stats['fwd'] += 1
                if new[s['id']] != s['pos']: stats['relabeled'] += 1
                s['boxPos'] = s['pos']; s['pos'] = new[s['id']]
    json.dump(day, open(os.path.join(out_dir, os.path.basename(f)), 'w'))
print(stats, f"{100 * stats['relabeled'] / max(1, stats['fwd']):.1f}% of forward-games relabeled; {stats['c_fewer']} team-games with under four centres")
