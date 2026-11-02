# The rushing study (docs/audits/2026-11-02-nfl-rushing.md): every RB and QB game the site's replay grades
# (nfl-pf-audit.mjs --dump, PropFinder's logs, zeros in), the board's read beside reads built from what was known that
# morning — his yards and carries over his active games, his share of the team's carries, yards a carry, the line, the
# defense — fitted on 2025's weeks 4–18, checked on 2026's weeks 1–7 (and week 8 from a rebuilt pre-game board, --board8).
#
#   node --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl --dump
#   python3 -I tools/audit/nfl_rushing.py [--audit .nhl-data/audit] [--dump <nfl-board-rows.json>] [--board8 <board json>]
# Rushing study: every RB / QB game the site's replay grades (nfl-pf-audit.mjs --dump), the board's read beside reads
# built from what was known that morning (PropFinder's logs, ESPN's line).
import json,gzip,glob,re,sys,unicodedata,collections as C
import numpy as np
arg=lambda k,d=None: sys.argv[sys.argv.index(k)+1] if k in sys.argv else d
ROOT=arg('--audit','.nhl-data/audit'); DUMP=arg('--dump',f'{ROOT}/out/nfl-board-rows.json'); B8=arg('--board8')
mean=lambda xs: sum(xs)/len(xs) if xs else None
def key(s):
  s=unicodedata.normalize('NFD',s); s=''.join(ch for ch in s if not unicodedata.combining(ch))
  s=re.sub(r"\b(JR|SR|III|II|IV)\b","",s,flags=re.I); s=s.replace('-',' '); s=re.sub(r"[.,'’‘`]","",s)
  return ' '.join(s.split()).lower()
# ESPN games: week, date, line, rushing box
games={}; at={}; byweek={}
for season in (2025,2026):
  wk={}
  for f in glob.glob(f'{ROOT}/nfl/{season}/weeks/*.json'):
    j=json.load(open(f))
    for e in j.get('events',[]): wk[str(e['id'])]=j.get('week',{}).get('number')
  for f in glob.glob(f'{ROOT}/nfl/{season}/games/*.json'):
    j=json.load(open(f)); c=j['header']['competitions'][0]
    if c['status']['type']['name']!='STATUS_FINAL': continue
    t={x['homeAway']:x['team']['abbreviation'] for x in c['competitors']}
    gid=str(j['header']['id']); date=c['date']; w=wk.get(gid)
    if w is None and season==2026 and date>='2026-10-29': w=8
    pc=next((p for p in j.get('pickcenter',[]) if p.get('overUnder') and p.get('details')),None)
    total=fav_home=None
    if pc:
      total=pc['overUnder']; m=re.match(r'([A-Z]+)\s*([-+]?\d+(\.\d+)?)',pc['details'])
      fav_home=(abs(float(m.group(2)))/2*(1 if m.group(1)==t['home'] else -1)) if m else 0.0
    box={}; seen=set()
    for side in j['boxscore'].get('players',[]):
      ab=side['team']['abbreviation']
      for st in side['statistics']:
        for a in st['athletes']:
          k=(key(a['athlete']['displayName']),ab); seen.add(k)
          if st['name']=='rushing':
            v=dict(zip(st['keys'],a['stats'])); box[k]={'car':float(v.get('rushingAttempts',0) or 0),'yds':float(v.get('rushingYards',0) or 0)}
    g=dict(id=gid,season=season,week=w,date=date,home=t['home'],away=t['away'],total=total,fav_home=fav_home,box=box,seen=seen)
    games[gid]=g
    for side in ('home','away'):
      at[(date[:10],t['away' if side=='home' else 'home'])]=gid
      byweek[(season,w,t[side])]=gid
# PropFinder logs
pl={}
for f in sorted(glob.glob(f'{ROOT}/nfl-pf/w*.json.gz')):
  d=json.load(gzip.open(f))
  for p in d['pull']['data']['players']:
    if p['pos'] not in ('RB','QB','WR','TE'): continue
    q=pl.setdefault(p['id'],{'key':p['key'],'pos':p['pos'],'rows':{}}); q['pos']=p['pos']
    for g in p.get('games',[]): q['rows'][(g['date'],g['opp'])]=g
rows=[]
for pid,q in pl.items():
  for (date,opp),g in q['rows'].items():
    gid=None; team=None
    # the game: the opponent's opponent on that UTC day
    for gg in (games.get(at.get((date,opp))),):
      pass
    gid=None
    for cand in games.values():
      pass
    rows.append(dict(pid=pid,key=q['key'],pos=q['pos'],date=date,opp=opp,season=g.get('season'),type=g.get('type'),car=float(g.get('rushAtt') or 0),yds=float(g.get('rushYds') or 0),share=g.get('rushShare'),tgt=float(g.get('tgt') or 0),patt=float(g.get('passAtt') or 0),gameId=g.get('gameId')))
# team of each row: the side that faced `opp` that day
opp_of={}
for g in games.values():
  opp_of[(g['date'][:10],g['home'])]=g['away']; opp_of[(g['date'][:10],g['away'])]=g['home']
def team_of(r):
  t=opp_of.get((r['date'],r['opp'])); return t
for r in rows: r['team']=team_of(r)
# team carries per game (sum of the pulled players' carries on that side)
tc=C.defaultdict(float)
for r in rows:
  if r['gameId'] and r['team']: tc[(r['gameId'],r['team'])]+=r['car']
team_games=C.defaultdict(list)  # (season, team) -> [(date, carries)]
for (gid_,team),v in tc.items(): pass
seen=set()
for r in rows:
  if r['gameId'] and r['team'] and r['type']=='REG' and (r['gameId'],r['team']) not in seen:
    seen.add((r['gameId'],r['team'])); team_games[(r['season'],r['team'])].append((r['date'],tc[(r['gameId'],r['team'])]))
# RB rushing allowed per game: sum of RB rows vs opp
allow=C.defaultdict(list)
for r in rows:
  if r['pos']=='RB' and r['type']=='REG' and r['team']: allow[(r['season'],r['opp'])].append((r['date'],r['yds'],r['gameId']))
def defense(season,opp,day):
  gp=len({gi for d,y,gi in allow[(season,opp)] if d<day}); y=sum(y for d,y,gi in allow[(season,opp)] if d<day)
  return gp,(y/gp if gp else None)
LG={}
def league(season,day):
  if (season,day) not in LG:
    v=[defense(season,t,day)[1] for (s,t) in list(allow) if s==season]; v=[x for x in v if x is not None]
    tcs=[c for (s,t),lst in team_games.items() if s==season for d,c in lst if d<day]
    LG[(season,day)]=(mean(v),mean(tcs))
  return LG[(season,day)]
bykey=C.defaultdict(list)
for r in rows: bykey[r['key']].append(r)
for k in bykey: bykey[k].sort(key=lambda r:r['date'],reverse=True)
def feats(k,team,pos,season,day):
  prior=[r for r in bykey.get(k,[]) if r['date']<day and r['pos']==pos]
  if not prior: return None
  act=[r for r in prior if r['car']+r['tgt']>0]
  cur=[r for r in act if r['season']==season and r['type']=='REG']
  allcur=[r for r in prior if r['season']==season and r['type']=='REG']
  f=dict(n_act=len(act),n_cur=len(cur))
  for nm,src in (('a',act),('all',prior)):
    for n in (3,5,10,17): f[f'y{n}{nm}']=mean([r['yds'] for r in src[:n]]); f[f'c{n}{nm}']=mean([r['car'] for r in src[:n]])
  qs=[r for r in prior if r['patt']>=10]
  for n in (5,10,17): f[f'q{n}']=mean([r['yds'] for r in qs[:n]]); f[f'qc{n}']=mean([r['car'] for r in qs[:n]])
  f['qn']=len(qs[:17])
  f['ys_a']=mean([r['yds'] for r in cur]); f['cs_a']=mean([r['car'] for r in cur]); f['ys_all']=mean([r['yds'] for r in allcur])
  sh=[r['share'] for r in act if r['share'] is not None and r['type']=='REG']
  f['sh3']=mean(sh[:3]); f['sh5']=mean(sh[:5])
  c17=sum(r['car'] for r in act[:17]); f['ypc17']=(sum(r['yds'] for r in act[:17])/c17) if c17 else None; f['car17']=c17
  tg=[c for d,c in team_games[(season,team)] if d<day]
  lgd,lgtc=league(season,day)
  f['tc_s']=mean(tg); f['tc_n']=len(tg); f['lgtc']=lgtc
  gp,dy=defense(season,opp_glob,day); f['dgp']=gp; f['dy']=dy; f['lgd']=lgd
  return f
out=[]
dump=[x for x in json.load(open(DUMP)) if x['m']=='rush_yds' and x['pos'] in ('RB','QB')]
def addrow(tag,season,week,k,team,pos,proj,actual,active,car,patt=None):
  global opp_glob
  gid=byweek.get((season,week,team));
  if not gid: return
  g=games[gid]; opp_glob=g['away'] if g['home']==team else g['home']; day=g['date'][:10]
  f=feats(k,team,pos,season,day)
  if f is None: return
  fav=None
  if g['fav_home'] is not None: fav=g['fav_home'] if team==g['home'] else -g['fav_home']
  out.append(dict(tag=tag,season=season,week=week,key=k,team=team,opp=opp_glob,pos=pos,board=proj,actual=actual,active=active,car=car,gatt=patt,total=g['total'],fav=fav,home=team==g['home'],**f))
for x in dump:
  s=int(x['tag'][:4]); w=int(x['tag'][5:])
  addrow(x['tag'],s,w,x['key'],x['team'],x['pos'],x['proj'],x['actual'],x['active'],x.get('rushAtt'),x.get('att'))
if B8:
  b=json.load(open(B8))
  for r in b['rows'].values():
    y=r['yards'].get('rush_yds')
    if r['pos'] not in ('RB','QB') or not y or r.get('backup'): continue
    gid=byweek.get((2026,8,r['team']))
    if not gid or games[gid]['date']<'2026-11-01': continue
    g=games[gid]; kk=(key(r['player']),r['team'])
    if kk not in g['seen']: continue    # not in ESPN's box: did not play (or recorded nothing)
    bx=g['box'].get(kk,{'car':0,'yds':0})
    addrow('2026w8',2026,8,r['key'],r['team'],r['pos'],y['proj'],bx['yds'],True,bx['car'])
print(len(out),C.Counter((o['pos'],o['tag'][:4]) for o in out),C.Counter(o['tag'] for o in out if o['tag']=='2026w8'),file=sys.stderr)

# --- the reads
def sc(rows,f): e=np.array([r['actual']-f(r) for r in rows]); return round(float(np.abs(e).mean()),2),round(float(e.mean()),1)
nz=lambda v,d: v if v is not None else d
def fitrep(name,rows_t,rows_c,feats_):
  A=np.array([feats_(r)+[1] for r in rows_t]); y=np.array([r['actual'] for r in rows_t]); b=np.linalg.lstsq(A,y,rcond=None)[0]
  f=lambda r: float(np.dot(feats_(r)+[1],b)); print(f"  {name:40s} tune {sc(rows_t,f)} check {sc(rows_c,f)}  b={np.round(b,2)}")
RB=[x for x in out if x['pos']=='RB' and x['active'] and x['board'] is not None and x['board']>=10 and x['y17a'] is not None]
t=[x for x in RB if x['season']==2025]; c=[x for x in RB if x['season']==2026]
print(f"RB, listed (board 10+), active: tune {len(t)}, check {len(c)}")
print(f"  {'board':40s} tune {sc(t,lambda r:r['board'])} check {sc(c,lambda r:r['board'])}")
fitrep('y5a+y17a',t,c,lambda r:[r['y5a'],r['y17a']])
fitrep('y5a+y17a+c3a',t,c,lambda r:[r['y5a'],r['y17a'],r['c3a']])
fitrep('y5a+y17a+share x team carries',t,c,lambda r:[r['y5a'],r['y17a'],nz(r['sh3'],0.3)*nz(r['tc_s'],r['lgtc'] or 25)])
fitrep('y5a+y17a+c3a+fav+total',t,c,lambda r:[r['y5a'],r['y17a'],r['c3a'],nz(r['fav'],0),nz(r['total'],44.5)-44.5])
fitrep('y5a+y17a+c3a+def',t,c,lambda r:[r['y5a'],r['y17a'],r['c3a'],((r['dy']-r['lgd'])*r['dgp']/(r['dgp']+8)) if r['dgp']>=3 and r['dy'] is not None else 0])
QB=[x for x in out if x['pos']=='QB' and x['tag']!='2026w8' and (x['gatt'] or 0)>=10 and x.get('q17') is not None]
t=[x for x in QB if x['season']==2025]; c=[x for x in QB if x['season']==2026]
print(f"QB, every start (10+ attempts): tune {len(t)}, check {len(c)}")
print(f"  {'board':40s} tune {sc(t,lambda r:r['board'])} check {sc(c,lambda r:r['board'])}")
for L,K in ((8,3),(10,3),(15,10),(5,6)):
  f=lambda r,L=L,K=K:(r['qn']*r['q17']+K*L)/(r['qn']+K); print(f"  {'q17 -> '+str(L)+' K='+str(K):40s} tune {sc(t,f)} check {sc(c,f)}  listed check {sc([r for r in c if r['board']>=10],f)}")
