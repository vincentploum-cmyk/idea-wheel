"""Tonight's shots and goals plays from the shipped formula (lib/nhl-data/picks-pure.js, section 13),
built from the public box scores: the skater's rate this season blended into last season's at
n / (n + 18) for shots and attempts, n / (n + 40) for goals and chances, n / (n + 5) for TOI; home
ice; back-to-back; what the opponent allows per skater at his position, this season blended into
last season's table at games / (games + 15) for shots and games / (games + 40) for goals.

Lineup = the skaters who dressed in each team's last game (scratches and call-ups since are not
known here; the site's board reads the beat writers' lines). The board rule: every skater over
the floor (3+ SOG at 50%, 1+ goal at 35%), three to four a game.

argv: <this season's games dir (relabelled)> <previous season's games dir (relabelled)> <date> [--all]
"""
import sys, glob, json, math
from collections import defaultdict
from datetime import date as D
import urllib.request

cur_dir, prev_dir, date = sys.argv[1:4]
show_all = '--all' in sys.argv
POS = ('C', 'LW', 'RW', 'D')
# the shipped coefficients (picks-pure.js)
S = dict(const=-1.4391, sog=0.3923, icf=0.4484, toi=0.297, home=0.0341, pos=0.6869, b2b=-0.026)
G = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
LEAGUE = {'C': (1.73, 0.23), 'LW': (1.63, 0.21), 'RW': (1.69, 0.215), 'D': (1.27, 0.077)}
lg = lambda v: math.log(max(v, 0.05))
mean = lambda xs: sum(xs) / len(xs) if xs else None

def load(d):
    gs = []
    for f in sorted(glob.glob(f'{d}/*.json')): gs += json.load(open(f))['games']
    return sorted(gs, key=lambda g: (g['date'], g['id']))

def tally(games, before=None):
    """Per player and per (defending team, position): what happened in these games."""
    ph = defaultdict(list); opp = defaultdict(lambda: dict(sog=0, g=0, n=0, games=set())); last = {}; dressed = {}
    for g in games:
        if before and g['date'] >= before: continue
        for team in (g['away']['abbrev'], g['home']['abbrev']):
            last[team] = g['date']; dressed[team] = [s for s in g['skaters'] if s['team'] == team and s['pos'] in POS]
        for s in g['skaters']:
            if s['pos'] not in POS: continue
            ph[s['id']].append(s)
            o = opp[(s['opp'], s['pos'])]; o['sog'] += s['sog']; o['g'] += s['g']; o['n'] += 1; o['games'].add(g['id'])
    return ph, opp, last, dressed

cur, prev = load(cur_dir), load(prev_dir)
ph, oppc, last, dressed = tally(cur, date)
pph, oppp, _, _ = tally(prev)

def rates(pid):
    c, p = ph.get(pid, []), pph.get(pid, [])
    n = len(c); base = len(p) >= 10
    if not base and n < 5: return None
    def bl(k, prior):
        w = n / (n + prior) if base else 1
        return w * (mean([x[k] for x in c]) or 0) + (1 - w) * (mean([x[k] for x in p]) if base else 0)
    toi = bl('toi', 5)
    return dict(n=n, base=len(p) if base else 0, sog=bl('sog', 18), icf=bl('icf', 18), g=bl('g', 40), iscf=bl('iscf', 40), toi=toi,
                toiL5=mean([x['toi'] for x in c[-5:]]) if n else toi, cur=mean([x['sog'] for x in c]), curG=mean([x['g'] for x in c]),
                baseSog=mean([x['sog'] for x in p]) if base else None, baseG=mean([x['g'] for x in p]) if base else None)

def opp_read(team, pos):
    c, p = oppc.get((team, pos)), oppp.get((team, pos))
    cs = c['sog'] / c['n'] if c and c['n'] else None; cg = c['g'] / c['n'] if c and c['n'] else None
    ps = p['sog'] / p['n'] if p and p['n'] and len(p['games']) >= 10 else None; pg = p['g'] / p['n'] if p and p['n'] and len(p['games']) >= 10 else None
    games = len(c['games']) if c else 0
    def bl(cv, pv, k): return cv if pv is None else pv if cv is None else (games / (games + k)) * cv + (k / (games + k)) * pv
    if cs is None and ps is None: return None
    return dict(sog=bl(cs, ps, 15), g=bl(cg, pg, 40), games=games)

ranks = {}
for pos in POS:
    teams = {t for (t, p) in list(oppc) + list(oppp) if p == pos}
    reads = {t: opp_read(t, pos) for t in teams}; reads = {t: r for t, r in reads.items() if r}
    bys = sorted(reads, key=lambda t: -reads[t]['sog']); byg = sorted(reads, key=lambda t: -reads[t]['g'])
    for t in reads: ranks[(t, pos)] = (bys.index(t) + 1, byg.index(t) + 1, len(reads))

def poisson_at_least(lam, k):
    term = math.exp(-lam); below = 0
    for i in range(k): below += term; term *= lam / (i + 1)
    return max(0, min(1, 1 - below))
fair = lambda p: ('—' if not (0 < p < 1) else (f'-{round(100 * p / (1 - p))}' if p >= 0.5 else f'+{round(100 * (1 - p) / p)}'))
def b2b(team):
    d = D.fromisoformat(date); l = last.get(team)
    return bool(l) and (d - D.fromisoformat(l)).days == 1

req = urllib.request.Request(f'https://api-web.nhle.com/v1/schedule/{date}', headers={'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)'})
sched = json.load(urllib.request.urlopen(req, timeout=30))
day = next((d for d in sched['gameWeek'] if d['date'] == date), None)
games = [g for g in (day['games'] if day else []) if g['gameType'] == 2]
print(f'{date}: {len(games)} games. Lineups = who dressed in each team\'s last game; the formula is the site\'s (picks-pure.js).')
rows = []
for gm in games:
    away, home = gm['awayTeam']['abbrev'], gm['homeTeam']['abbrev']
    for team, opp, is_home in ((away, home, 0), (home, away, 1)):
        bb = b2b(team)
        for s in dressed.get(team, []):
            r = rates(s['id'])
            if not r: continue
            o = opp_read(opp, s['pos']) or dict(sog=LEAGUE[s['pos']][0], g=LEAGUE[s['pos']][1], games=0)
            lamS = math.exp(S['const'] + S['sog'] * lg(r['sog']) + S['icf'] * lg(r['icf']) + S['toi'] * lg(r['toiL5']) + S['home'] * is_home + S['pos'] * lg(o['sog']) + S['b2b'] * bb)
            lamG = math.exp(G['const'] + G['g'] * math.log(max(r['g'], 0) + 0.05) + G['iscf'] * lg(r['iscf']) + G['sog'] * lg(r['sog']) + G['home'] * is_home + G['pos'] * math.log(max(o['g'], 0) + 0.1) + G['b2b'] * bb)
            rk = ranks.get((opp, s['pos']), (None, None, None))
            rows.append(dict(game=f'{away} @ {home}', team=team, opp=opp, name=s['name'], pos=s['pos'], home=is_home, b2b=bb, n=r['n'], cur=r['cur'], base=r['baseSog'], curG=r['curG'], baseG=r['baseG'],
                             lamS=lamS, p2=poisson_at_least(lamS, 2), p3=poisson_at_least(lamS, 3), p4=poisson_at_least(lamS, 4), lamG=lamG, p1g=1 - math.exp(-lamG),
                             oppSog=o['sog'], oppG=o['g'], oppGames=o['games'], rankS=rk[0], rankG=rk[1], teams=rk[2]))

f2 = lambda v: '—' if v is None else f'{v:.2f}'
def line_s(r):
    return (f"    {r['name']:24s} {r['team']} {r['pos']:2s}{' B2B' if r['b2b'] else '    '}  λ {r['lamS']:.2f}  2+ {r['p2']:4.0%} ({fair(r['p2'])})  3+ {r['p3']:4.0%} ({fair(r['p3'])})  4+ {r['p4']:4.0%} ({fair(r['p4'])})"
            f"   {f2(r['cur'])}/g in {r['n']}, base {f2(r['base'])}; {r['opp']} allows {r['oppSog']:.2f} per {r['pos']} (#{r['rankS']} of {r['teams']}, {r['oppGames']} g this season)")
def line_g(r):
    return (f"    {r['name']:24s} {r['team']} {r['pos']:2s}{' B2B' if r['b2b'] else '    '}  λ {r['lamG']:.2f}  1+ goal {r['p1g']:4.0%} ({fair(r['p1g'])})"
            f"   {f2(r['curG'])}/g in {r['n']}, base {f2(r['baseG'])}; {r['opp']} allows {r['oppG']:.3f} goals per {r['pos']} (#{r['rankG']} of {r['teams']})")
seen = set()
for gm in games:
    key = f"{gm['awayTeam']['abbrev']} @ {gm['homeTeam']['abbrev']}"
    if key in seen: continue
    seen.add(key)
    grp = [r for r in rows if r['game'] == key]
    if not grp: print(f'\n=== {key} === no stored games for these teams yet'); continue
    print(f'\n=== {key} ===')
    sh = sorted(grp, key=lambda r: -r['p3']); over = [r for r in sh if r['p3'] >= 0.5]
    take = sh[:min(4, max(3, len(over)))] if not show_all else sh[:8]
    print('  SHOTS (3+ at 50%+; dimmed rows fill to three):')
    for r in take: print(('  ' if r['p3'] >= 0.5 else '  ·') + line_s(r)[3:])
    nxt = sh[len(take):len(take) + 3]
    if nxt: print('    next: ' + '; '.join(f"{r['name']} {r['p3']:.0%}" for r in nxt))
    go = sorted(grp, key=lambda r: -r['p1g']); overg = [r for r in go if r['p1g'] >= 0.35]
    takeg = go[:min(4, max(3, len(overg)))] if not show_all else go[:8]
    print('  GOALS (1+ at 35%+):')
    for r in takeg: print(('  ' if r['p1g'] >= 0.35 else '  ·') + line_g(r)[3:])
    nxtg = go[len(takeg):len(takeg) + 3]
    if nxtg: print('    next: ' + '; '.join(f"{r['name']} {r['p1g']:.0%}" for r in nxtg))

print('\n=== The slate\'s top 12 shooters by P(3+) ===')
for r in sorted(rows, key=lambda r: -r['p3'])[:12]: print(line_s(r))
print('\n=== The slate\'s top 12 scorers by P(1+ goal) ===')
for r in sorted(rows, key=lambda r: -r['p1g'])[:12]: print(line_g(r))
print(f'\n{len(rows)} skaters rated. Check scratches and the confirmed lines before puck drop; a skater not in the lineup is not a play.')
