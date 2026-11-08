"""The NFL's matchup pages, backtested on last season's profiles (Vincent, 2026-11-08: "can't we backtest with last season's
data?"; docs/audits/2026-11-08-nfl-coverage.md).

PropFinder's coverage and rushing pages are season totals, so a season's own games cannot be graded on them (the totals hold
the games). Leak-free: 2025's profiles against 2026's games (PropFinder's logs on the latest pull).
  - Coverage: each receiver's 2025 yards per route (or per target) by coverage (Cover 0/1/2/3/4/6 …, shrunk toward his
    overall at K routes), weighted by his 2026 opponent's 2025 coverage mix → a factor on his decayed average.
  - Rushing: each back's 2025 run direction (left / middle / right) against his opponent's 2025 yards a game by gap
    (the teams on the export's slate).
Graded: what he got over his average by fifth of the factor, the mean miss with and without it, the doubles.

  # the export (GitHub → Actions → NFL PropFinder export) unzipped into .nhl-data/audit/nfl-pf: the latest week holds the pages
  python3 -I tools/audit/nfl_coverage.py .nhl-data/audit/nfl-pf/w09.json.gz
"""
import gzip, json, numpy as np, pandas as pd, collections
import sys
d=json.load(gzip.open(sys.argv[1] if len(sys.argv) > 1 else '.nhl-data/audit/nfl-pf/w09.json.gz'))
P=d['pages']
# 2025 receiver profiles: yards per route by coverage, shrunk to his overall at K routes
K=40
allr={b['playerId']:b for b in P['coverageReceiverSplitsPrior']['baselines'] if b['coverage']=='All'}
split=collections.defaultdict(dict)
for r in P['coverageReceiverSplitsPrior']['players']: split[r['playerId']][r['coverage']]=r
# 2025 defense mixes by team code
mix={t['code']:{s['category']:s['playPerc'] for s in t['topSchemes']} for t in P['coverageTeamsPrior']['teams']}
def factor(pid,opp):
    a=allr.get(pid); m=mix.get(opp)
    if not a or not m or not a.get('routesRun'): return None
    ypr=a['yardsSb']/a['routesRun']
    if ypr<=0: return None
    num=0; den=0
    for c,share in m.items():
        s=split[pid].get(c)
        y=((s['yardsSb'] if s else 0)+K*ypr)/((s['routesRun'] if s else 0)+K)
        num+=share*y/ypr; den+=share
    return num/den if den else None
# 2026 games from PropFinder's logs, the baseline his decayed average before the game
rows=[]
for p in d['pull']['data']['players']:
    if p.get('pos') not in ('WR','TE','RB'): continue
    gs=sorted([g for g in p.get('games',[]) if g.get('type')=='REG'],key=lambda g:g['date'])
    for i,g in enumerate(gs):
        if g['season']!=2026 or i<4: continue
        H=gs[max(0,i-17):i]; v=np.array([h.get('recYds') or 0 for h in H],float); w=0.5**(np.arange(len(v))[::-1]/4)
        base=(v*w).sum()/w.sum()
        f=factor(p.get('id'),g.get('opp'))
        rows.append(dict(pid=p['id'],pos=p['pos'],date=g['date'][:10],opp=g.get('opp'),base=base,act=g.get('recYds') or 0,f=f))
r=pd.DataFrame(rows); r=r[(r.base>=15)&r.f.notna()]
r['wk']=r.date.rank(method='dense').astype(int)
print('graded receiver-games', len(r), 'factor spread', r.f.quantile([.05,.25,.5,.75,.95]).round(3).tolist())
r['ratio']=(r.act+1)/(r.base+1)
for b in [0,0.5,1,2]:
    p=r.base*r.f**b; print(f'b {b}: mean miss {np.mean(np.abs(p-r.act)):.2f}, bias {np.mean(p-r.act):+.2f}')
r['q']=pd.qcut(r.f,5,labels=['worst fit','2','3','4','best fit'])
g=r.groupby('q',observed=True).agg(n=('act','size'),f=('f','mean'),avg=('base','mean'),got=('act','mean'),ratio=('ratio','median'),
    double=('act',lambda a: 0)).reset_index()
g['got/avg']=r.groupby('q',observed=True).apply(lambda x: x.act.sum()/x.base.sum()).values
g['double %']=r.groupby('q',observed=True).apply(lambda x: (x.act>=np.maximum(2*x.base,x.base+40)).mean()*100).values
print(g[['q','n','f','avg','got','got/avg','double %']].round(3).to_string())
# halves: fit b on weeks 1-4 by least absolute deviation, check on 5-8
early=r[r.wk<=r.wk.median()]; late=r[r.wk>r.wk.median()]
best=min([(np.mean(np.abs(early.base*early.f**b-early.act)),b) for b in np.arange(-1,3.01,0.25)])
print('b fitted on the first half:',best[1],'| second half miss: none',round(np.mean(np.abs(late.base-late.act)),3),'with it',round(np.mean(np.abs(late.base*late.f**best[1]-late.act)),3))

print('\n--- variants of the coverage factor')
def factor2(pid,opp,K=20,per='target'):
    a=allr.get(pid); m=mix.get(opp)
    den_key='targets' if per=='target' else 'routesRun'
    if not a or not m or not a.get(den_key): return None
    ypr=a['yardsSb']/a[den_key]
    if ypr<=0: return None
    num=0; den=0
    for c,share in m.items():
        s=split[pid].get(c)
        y=((s['yardsSb'] if s else 0)+K*ypr)/((s[den_key] if s else 0)+K)
        num+=share*y/ypr; den+=share
    return num/den
for per,Kv in [('target',10),('target',25),('route',15)]:
    r[f'f2']=[factor2(p,o,Kv,per) for p,o in zip(r.pid,r.opp)]
    x=r[r.f2.notna()]
    q=pd.qcut(x.f2,5,labels=False)
    gg=[(x[q==i].act.sum()/x[q==i].base.sum()) for i in range(5)]
    print(f'per {per}, K {Kv}: got/avg by fifth (worst → best fit)', [round(v,3) for v in gg], '| miss none', round(np.mean(np.abs(x.base-x.act)),2), 'b=1', round(np.mean(np.abs(x.base*x.f2-x.act)),2))

print('\n--- rushing: his 2025 run direction × the opponent\'s 2025 yards by gap (teams on this week\'s slate)')
rb=P['rushingSlateBoardPrior']['rows']
dirs={x['playerId']:(x['shareLeftAdjPct'],x['shareMiddleAdjPct'],x['shareRightAdjPct']) for x in rb if x.get('shareLeftAdjPct') is not None and (x.get('totalAttempts') or 0)>=40}
gaps={}
for x in rb:
    if x.get('gapLeftYardsPerGame') is not None: gaps[x['opponentCode']]=(x['gapLeftYardsPerGame'],x['gapCenterYardsPerGame'],x['gapRightYardsPerGame'])
lg=np.mean([np.mean(v) for v in gaps.values()])
rows=[]
for p in d['pull']['data']['players']:
    if p.get('pos')!='RB' or p.get('id') not in dirs: continue
    gs=sorted([g for g in p.get('games',[]) if g.get('type')=='REG'],key=lambda g:g['date'])
    for i,g in enumerate(gs):
        if g['season']!=2026 or i<4 or g.get('opp') not in gaps: continue
        H=gs[max(0,i-17):i]; v=np.array([h.get('rushYds') or 0 for h in H],float); w=0.5**(np.arange(len(v))[::-1]/4)
        sh=np.array(dirs[p['id']])/100; gp=np.array(gaps[g['opp']])
        rows.append(dict(base=(v*w).sum()/w.sum(),act=g.get('rushYds') or 0,fit=float((sh*gp).sum()/ (sh.sum()*lg)),opp=float(gp.mean()/lg)))
x=pd.DataFrame(rows); x=x[x.base>=15]
print('graded back-games', len(x))
for col in ['fit','opp']:
    q=pd.qcut(x[col],5,labels=False)
    print(f'{col}: got/avg by fifth (stingy → soft)', [round(x[q==i].act.sum()/x[q==i].base.sum(),3) for i in range(5)], '| miss none', round(np.mean(np.abs(x.base-x.act)),2), 'with it', round(np.mean(np.abs(x.base*x[col]-x.act)),2))
