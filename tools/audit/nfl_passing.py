# The passing read (lib/nfl/projections.js PASS, passRead): every starting quarterback's game of 2025 (weeks 4–18) and 2026
# (weeks 1–8), what was known that morning from the PropFinder export's logs and ESPN's line, against what he threw
# (ESPN's box score, 15+ attempts). The board's own read beside it from nfl-pf-audit.mjs --dump (and, for a week whose
# pre-game pull survived, a board file written by rebuilding that pull). Fits on 2025, checks on 2026.
# docs/audits/2026-11-02-nfl-passing.md.
#
#   node --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl --dump
#   python3 -I tools/audit/nfl_passing.py [--audit .nhl-data/audit] [--board8 <week-8 board json>]
import json,gzip,glob,os,re,sys,math,unicodedata,collections as C
import numpy as np
arg=lambda k,d=None: sys.argv[sys.argv.index(k)+1] if k in sys.argv else d
ROOT=arg('--audit','.nhl-data/audit')
BOARD8=arg('--board8')
def norm(s): s=re.sub(r"[^a-z ]","",s.lower().replace('.','')); s=re.sub(r"\b(jr|sr|ii|iii|iv)\b","",s); return ' '.join(s.split())
# ESPN games
games={}; byday={}
for season in (2025,2026):
  wk={}
  for f in glob.glob(f'{ROOT}/nfl/{season}/weeks/*.json'):
    j=json.load(open(f))
    for e in j.get('events',[]): wk[str(e['id'])]=j.get('week',{}).get('number')
  for f in glob.glob(f'{ROOT}/nfl/{season}/games/*.json'):
    j=json.load(open(f)); c=j['header']['competitions'][0]
    if c['status']['type']['name']!='STATUS_FINAL': continue
    t={x['homeAway']:x['team']['abbreviation'] for x in c['competitors']}
    pc=next((p for p in j.get('pickcenter',[]) if p.get('overUnder') and p.get('details')),None) or j.get('coreOdds')
    total=spread_home=None
    if pc:
      total=pc.get('overUnder'); d=pc.get('details') or ''
      m=re.match(r'([A-Z]+)\s*([-+]?\d+(\.\d+)?)',d)
      if m: v=float(m.group(2)); spread_home = v if m.group(1)==t['home'] else -v
      elif d.upper().startswith('EVEN') or d.upper().startswith('PK'): spread_home=0.0
    # ESPN passing lines
    box={}
    for side in j['boxscore'].get('players',[]):
      ab=side['team']['abbreviation']
      for st in side['statistics']:
        if st['name']!='passing': continue
        keys=st['keys']
        for a in st['athletes']:
          v=dict(zip(keys,a['stats'])); ca=v.get('completions/passingAttempts','0/0').split('/')
          box[(norm(a['athlete']['displayName']),ab)]={'yds':float(v.get('passingYards',0) or 0),'att':float(ca[1]) if len(ca)>1 else 0}
    gid=str(j['header']['id']); date=c['date']
    games[gid]=dict(id=gid,season=season,week=wk.get(gid),date=date,home=t['home'],away=t['away'],total=total,spread_home=spread_home,box=box)
    for side in ('home','away'): byday[(date[:10],t[side])]=gid
print('games',len(games),'with line',sum(g['total'] is not None for g in games.values()),file=sys.stderr)
# PropFinder QB logs, all pulls
qbs={}
for f in sorted(glob.glob(f'{ROOT}/nfl-pf/w*.json.gz')):
  d=json.load(gzip.open(f))
  for p in d['pull']['data']['players']:
    if p['pos']!='QB': continue
    q=qbs.setdefault(p['id'],{'name':p['name'],'key':norm(p['name']),'team':p['team'],'rows':{}})
    q['team']=p['team']
    for g in p.get('games',[]): q['rows'][(g['date'],g['opp'])]=g
# team-games per team per season (for per-game allowed)
rows=[]
for qid,q in qbs.items():
  for (date,opp),g in q['rows'].items():
    gid=byday.get((date,opp))
    team=None
    if gid: G=games[gid]; team=G['home'] if G['away']==opp else G['away']
    rows.append(dict(qid=qid,key=q['key'],name=q['name'],date=date,opp=opp,season=g.get('season'),type=g.get('type'),att=float(g.get('passAtt') or 0),yds=float(g.get('passYds') or 0),cmp=float(g.get('passCmp') or 0),sacked=float(g.get('sacked') or 0),gid=gid,team=team))
print('qb rows',len(rows),file=sys.stderr)
D={'games':{k:{**v,'box':{f'{a}|{b}':x for (a,b),x in v['box'].items()}} for k,v in games.items()},'rows':rows}

# --- what was known before each start
G=D['games']; R=D['rows']
def key(s):
  s=unicodedata.normalize('NFD',s); s=''.join(ch for ch in s if not unicodedata.combining(ch))
  s=re.sub(r"\b(JR|SR|III|II|IV)\b","",s,flags=re.I); s=s.replace('-',' '); s=re.sub(r"[.,'’‘`]","",s)
  return ' '.join(s.split()).lower()
bykey=C.defaultdict(list)
for r in R: r['k']=key(r['name']); bykey[r['k']].append(r)
for k in bykey: bykey[k].sort(key=lambda r:r['date'])
# team games played per season before a date
tg=C.defaultdict(list)
for g in G.values():
  for t in (g['home'],g['away']): tg[(g['season'],t)].append(g['date'][:10])
# QB yards allowed: sum over QB rows by opp, per season
allowed=C.defaultdict(list)  # (season,opp) -> [(date,yds)]
for r in R:
  if r['type']=='REG' and r['gid']: allowed[(r['season'],r['opp'])].append((r['date'],r['yds'],r['att']))
def defense(season,opp,day):
  def at(s,cut):
    gp=sum(1 for d in tg[(s,opp)] if d<cut); y=sum(x for d,x,a in allowed[(s,opp)] if d<cut); a=sum(a for d,x,a in allowed[(s,opp)] if d<cut)
    return gp,y,a
  gp,y,a=at(season,day)
  return gp,(y/gp if gp else None),(a/gp if gp else None)
def league(season,day):
  vals=[defense(season,t,day) for t in set(t for (s,t) in tg if s==season)]
  v=[x[1] for x in vals if x[1] is not None]; a=[x[2] for x in vals if x[2] is not None]
  return (sum(v)/len(v) if v else None),(sum(a)/len(a) if a else None)
LG={}
board={}
for x in json.load(open(f'{ROOT}/out/nfl-board-rows.json')):
  if x['m']=='pass_yds': board[(x['tag'],x['key'],x['team'])]=x
try:
  b8=json.load(open(BOARD8)) if BOARD8 else {'rows':{}}
  for r in b8['rows'].values():
    if r['pos']=='QB' and r['yards'].get('pass_yds'): board[('2026w8',r['key'],r['team'])]={'proj':r['yards']['pass_yds']['proj'],'sd':r['yards']['pass_yds']['sd'],'backup':r.get('backup',False),'matchup':r['yards']['pass_yds']['matchup']}
except Exception as e: print('no w8 board',e,file=sys.stderr)
out=[]
mean=lambda xs: sum(xs)/len(xs) if xs else None
for g in G.values():
  s,w=g['season'],g['week']
  if w is None and s==2026 and g['date']>='2026-10-29': w=8
  if s==2026 and w==8 and g['date']<'2026-11-01': continue
  if w is None or (s==2025 and w<4) : continue
  day=g['date'][:10]
  if day not in LG: LG[day]=league(s,day)
  lgY,lgA=LG[day]
  for bk,b in g['box'].items():
    if b['att']<15: continue
    nm,team=bk.rsplit('|',1); opp=g['away'] if team==g['home'] else g['home']
    cands=[k for k in bykey if key(k)==key(nm)] 
    if not cands:
      # surname + team fallback
      sur=nm.split()[-1]; cands=[k for k,rs in bykey.items() if k.split()[-1]==sur and any(r['team']==team for r in rs)]
    if len(cands)!=1: continue
    k=cands[0]; prior=[r for r in bykey[k] if r['date']<day]
    if not prior: continue
    prior=prior[::-1]  # newest first
    starts=[r for r in prior if r['att']>=10]
    cur=[r for r in prior if r['season']==s and r['type']=='REG']
    curst=[r for r in cur if r['att']>=10]
    gp,dY,dA=defense(s,opp,day)
    if gp<3:  # last season's
      gp0,dY0,dA0=defense(s-1,opp,'9999'); 
    else: dY0=dA0=None
    tot=g['total']; sh=g['spread_home']
    imp=None
    if tot is not None and sh is not None:
      sp= sh if team==g['home'] else -sh
      imp=tot/2 - sp/2
    tag=f'{s}w{w}'
    bd=board.get((tag,k,team))
    out.append(dict(tag=tag,season=s,week=w,day=day,name=nm,key=k,team=team,opp=opp,home=team==g['home'],actual=b['yds'],att=b['att'],
      board=bd['proj'] if bd else None, bsd=bd.get('sd') if bd else None, bmatch=bd.get('matchup') if bd else None,
      s_all=mean([r['yds'] for r in cur]), n_all=len(cur), l10_all=mean([r['yds'] for r in prior[:10]]),
      s_st=mean([r['yds'] for r in curst]), n_st=len(curst), l5_st=mean([r['yds'] for r in starts[:5]]), l10_st=mean([r['yds'] for r in starts[:10]]), l17_st=mean([r['yds'] for r in starts[:17]]), l34_st=mean([r['yds'] for r in starts[:34]]), n_starts=len(starts),
      att17=mean([r['att'] for r in starts[:17]]), ypa17=(sum(r['yds'] for r in starts[:17])/max(1,sum(r['att'] for r in starts[:17]))),
      att_s=mean([r['att'] for r in curst]), ypa_s=(sum(r['yds'] for r in curst)/sum(r['att'] for r in curst)) if curst else None,
      sack17=mean([r['sacked'] for r in starts[:17]]),
      dgp=gp, dY=dY, dA=dA, dY0=dY0, lgY=lgY, lgA=lgA, total=tot, imp=imp))
print(len(out),'QB starts; with the board read',sum(o['board'] is not None for o in out),file=sys.stderr)

# --- the reads, fitted on 2025, checked on 2026
X=[x for x in out if x['board'] is not None and x['l17_st'] is not None]
tune=[x for x in X if x['season']==2025]; chk=[x for x in X if x['season']==2026]
L=225.0
def shr(r,K): n=min(r['n_starts'],17); return (n*r['l17_st']+K*L)/(n+K)
def defv(r):
  lg=r['lgY'] or 225
  if r['dgp']>=3: return (r['dY']-lg)*r['dgp']/(r['dgp']+8)
  return 0.0
def F(r,K,use):
  v=[shr(r,K)]
  tot=r['total'] if r['total'] is not None else 44.5; imp=r['imp'] if r['imp'] is not None else tot/2
  if 'tot' in use: v.append(tot-44.5)
  if 'imp' in use: v.append(imp-tot/2)   # = minus half the spread: favourite > 0
  if 'def' in use: v.append(defv(r))
  return v+[1]
def fit(K,use):
  A=np.array([F(r,K,use) for r in tune]); y=np.array([r['actual'] for r in tune]); return np.linalg.lstsq(A,y,rcond=None)[0]
def pred(r,K,use,b): return float(np.dot(F(r,K,use),b))
def score(rows,f): e=np.array([r['actual']-f(r) for r in rows]); return np.abs(e).mean(), e.mean()
res={}
for use in ([],['tot'],['tot','imp'],['tot','imp','def'],['tot','def']):
  for K in (0,3,6,10):
    b=fit(K,use); t=score(tune,lambda r:pred(r,K,use,b)); c=score(chk,lambda r:pred(r,K,use,b))
    print(f"K={K:2d} {'+'.join(use) or 'own':14s} b={np.round(b,2)} tune {t[0]:.1f} check {c[0]:.1f} ({c[1]:+.1f})")
# bootstrap: chosen vs board, chosen vs own-only
def boot(f1,f2,rows,B=4000):
  d=np.array([abs(r['actual']-f1(r))-abs(r['actual']-f2(r)) for r in rows]); rng=np.random.default_rng(1)
  bs=[d[rng.integers(0,len(d),len(d))].mean() for _ in range(B)]; return d.mean(),np.percentile(bs,2.5),np.percentile(bs,97.5)
K=6
b1=fit(K,['tot','imp']); b0=fit(K,[]); b2=fit(K,['tot','imp','def'])
print('check: new(tot+imp) - board', boot(lambda r:pred(r,K,['tot','imp'],b1), lambda r:r['board'], chk))
print('check: new(tot+imp) - shrunk own', boot(lambda r:pred(r,K,['tot','imp'],b1), lambda r:pred(r,K,[],b0), chk))
print('check: +def - (tot+imp)', boot(lambda r:pred(r,K,['tot','imp','def'],b2), lambda r:pred(r,K,['tot','imp'],b1), chk))
print('check: shrunk own - board', boot(lambda r:pred(r,K,[],b0), lambda r:r['board'], chk))
w8=[r for r in chk if r['week']==8]
for nm,f in [('board',lambda r:r['board']),('new',lambda r:pred(r,K,['tot','imp'],b1)),('new+def',lambda r:pred(r,K,['tot','imp','def'],b2))]:
  print('wk8',nm,round(score(w8,f)[0],1), ' wk1-7', round(score([r for r in chk if r['week']<8],f)[0],1))
