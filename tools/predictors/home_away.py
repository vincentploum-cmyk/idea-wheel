# Home / away: teams (shots and goals for and against, Welch per team with a false-discovery adjustment, a venue
# shuffle for the spread, half-to-half and season-to-season repeat, the rink's recorded-shots split) and skaters (20+
# games at each venue). docs/audits/2026-11-25-nhl-home-away-and-allows.md
# python3 -I tools/predictors/home_away.py <last season games dir> <this season games dir>
import sys
import json, glob, os
def load(d):
    games=[]; rows=[]
    for f in sorted(glob.glob(os.path.join(d,'*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType')!=2: continue
            games.append(dict(id=g['id'],date=g['date'],home=g['home']['abbrev'],away=g['away']['abbrev'],
                hs=g['home']['sog'],as_=g['away']['sog'],hg=g['home']['score'],ag=g['away']['score'],ot=g['lastPeriodType']))
            for s in g['skaters']:
                rows.append(dict(gid=g['id'],date=g['date'],pid=s['id'],name=s['name'],team=s['team'],opp=s['opp'],
                    venue=s['venue'],pos=s['pos'],toi=s['toi'],sog=s['sog'],g=s['g'],a=s['a']))
    return pd.DataFrame(games), pd.DataFrame(rows)
import numpy as np, pandas as pd
from scipy.stats import ttest_ind, pearsonr
G5,R5=load(sys.argv[1]); G6,R6=load(sys.argv[2])
def teamgames(G,R):
    gl=R.groupby(['gid','team'])['g'].sum()  # skater goals (no shootout)
    rows=[]
    for g in G.itertuples():
        for side,opp,sf,sa,v in [(g.home,g.away,g.hs,g.as_,'H'),(g.away,g.home,g.as_,g.hs,'A')]:
            rows.append(dict(gid=g.id,date=g.date,team=side,venue=v,SF=sf,SA=sa,GF=gl.get((g.id,side),0),GA=gl.get((g.id,opp),0),
                W=int((g.hg>g.ag) == (v=='H'))))
    return pd.DataFrame(rows)
def bh(p):
    p=np.asarray(p); n=len(p); o=np.argsort(p); q=np.empty(n); prev=1
    for i in range(n-1,-1,-1):
        k=o[i]; prev=min(prev,p[k]*n/(i+1)); q[k]=prev
    return q
def team_report(T,label):
    print(f'\n===== TEAMS {label} ({T.gid.nunique()} games) =====')
    lg=T.groupby('venue')[['SF','SA','GF','GA','W']].mean()
    print('league home vs away:\n', lg.round(3).to_string())
    out=[]
    for t,s in T.groupby('team'):
        h=s[s.venue=='H'];a=s[s.venue=='A']; d=dict(team=t,nH=len(h),nA=len(a))
        for m in ['SF','SA','GF','GA']:
            d[m+'_H']=h[m].mean(); d[m+'_A']=a[m].mean(); d[m+'_d']=h[m].mean()-a[m].mean()
            d[m+'_p']=ttest_ind(h[m],a[m],equal_var=False).pvalue
        d['W_H']=h.W.mean(); d['W_A']=a.W.mean()
        out.append(d)
    o=pd.DataFrame(out)
    for m in ['SF','SA','GF','GA']:
        o[m+'_q']=bh(o[m+'_p'].values)
        # excess spread: observed var of (split - league split) vs mean sampling var
        lgd=lg.loc['H',m]-lg.loc['A',m]
    return o
T5=teamgames(G5,R5); T6=teamgames(G6,R6)
o5=team_report(T5,'2025-26'); o6=team_report(T6,'2026-27 to Nov 24')
def show(o,m,k=6):
    s=o.sort_values(m+'_d')
    cols=['team','nH','nA',m+'_H',m+'_A',m+'_d',m+'_p',m+'_q']
    print(pd.concat([s.head(k),s.tail(k)])[cols].round(3).to_string(index=False))
for m in ['SF','SA','GF','GA']:
    print(f'\n--- 2025-26 {m} home minus away, biggest both ways (p = Welch, q = false-discovery adjusted over 32 teams)')
    show(o5,m)
    print(f'  teams p<0.05: {(o5[m+"_p"]<0.05).sum()} of 32 (chance alone ~1.6); q<0.10: {(o5[m+"_q"]<0.10).sum()}')
# permutation null for spread of team splits (2025-26)
rng=np.random.default_rng(0)
print('\nIs the spread of team home/away splits bigger than chance? (2025-26, 2000 shuffles of venue within team)')
for m in ['SF','SA','GF','GA']:
    obs=o5[m+'_d'].std()
    null=[]
    for _ in range(2000):
        ds=[]
        for t,s in T5.groupby('team'):
            v=rng.permutation(s.venue.values); x=s[m].values
            ds.append(x[v=='H'].mean()-x[v=='A'].mean())
        null.append(np.std(ds,ddof=1))
    null=np.array(null)
    print(f'  {m}: observed sd of splits {obs:.2f}, chance sd {null.mean():.2f}, p={(null>=obs).mean():.3f}')
# persistence: half vs half 2025-26, and 2025-26 -> 2026-27
print('\nDoes a team\'s split repeat?')
T5=T5.sort_values('date'); T5['half']=T5.groupby('team').cumcount()<41
for m in ['SF','SA','GF','GA']:
    a=[];b=[]
    for t,s in T5.groupby('team'):
        f=s[s.half];l=s[~s.half]
        a.append(f[f.venue=='H'][m].mean()-f[f.venue=='A'][m].mean()); b.append(l[l.venue=='H'][m].mean()-l[l.venue=='A'][m].mean())
    r1=pearsonr(a,b)[0]
    m6=o6.set_index('team')[m+'_d']; m5=o5.set_index('team')[m+'_d']
    r2=pearsonr(m5.loc[m6.index],m6)[0]
    print(f'  {m}: 1st half vs 2nd half of 2025-26 r={r1:+.2f} | 2025-26 vs 2026-27 so far r={r2:+.2f}')
print('\n2026-27 to date, biggest team splits (small samples):')
for m in ['SF','GF']:
    print(f' {m}:'); show(o6,m,5)

# ---------------- PLAYERS
def player_split(R,minv):
    out=[]
    for pid,s in R.groupby('pid'):
        h=s[s.venue=='H'];a=s[s.venue=='A']
        if len(h)<minv or len(a)<minv: continue
        d=dict(pid=pid,name=s.name.iloc[-1],team=s.team.iloc[-1],pos=s.pos.iloc[-1],nH=len(h),nA=len(a),
               sH=h.sog.mean(),sA=a.sog.mean(),gH=h.g.mean(),gA=a.g.mean(),tH=h.toi.mean(),tA=a.toi.mean(),
               h3=(h.sog>=3).mean(),a3=(a.sog>=3).mean())
        d['s_d']=d['sH']-d['sA']; d['g_d']=d['gH']-d['gA']
        d['s_p']=ttest_ind(h.sog,a.sog,equal_var=False).pvalue
        d['g_p']=ttest_ind(h.g,a.g,equal_var=False).pvalue if (h.g.var()+a.g.var())>0 else 1
        out.append(d)
    return pd.DataFrame(out)
P5=player_split(R5,20)
print(f'\n===== PLAYERS 2025-26 (20+ games at each venue): {len(P5)} skaters =====')
for m,lab in [('s','shots'),('g','goals')]:
    P5[m+'_q']=bh(P5[m+'_p'].values)
    n=len(P5); k=(P5[m+'_p']<0.05).sum()
    print(f' {lab}: p<0.05 for {k} of {n} ({k/n:.1%}; chance alone 5% = {0.05*n:.0f}); survive false-discovery q<0.10: {(P5[m+"_q"]<0.10).sum()}')
# permutation null for the count of significant players (shots)
cnt=[]
grp=[(s.venue.values,s.sog.values) for _,s in R5[R5.pid.isin(P5.pid)].groupby('pid')]
for _ in range(200):
    c=0
    for v,x in grp:
        v=rng.permutation(v); p=ttest_ind(x[v=='H'],x[v=='A'],equal_var=False).pvalue; c+=p<0.05
    cnt.append(c)
print(f' shots, shuffled venues: {np.mean(cnt):.0f} skaters at p<0.05 on average (95th pct {np.percentile(cnt,95):.0f}) vs {(P5.s_p<0.05).sum()} observed')
# persistence half vs half
R5s=R5.sort_values('date'); R5s['k']=R5s.groupby('pid').cumcount(); R5s['n']=R5s.groupby('pid').pid.transform('size')
A=player_split(R5s[R5s.k<R5s.n/2],8).set_index('pid'); B=player_split(R5s[R5s.k>=R5s.n/2],8).set_index('pid'); j=A.index.intersection(B.index)
print(f' persistence, 1st half vs 2nd half of 2025-26 ({len(j)} skaters): shots split r={pearsonr(A.loc[j,"s_d"],B.loc[j,"s_d"])[0]:+.2f}, goals split r={pearsonr(A.loc[j,"g_d"],B.loc[j,"g_d"])[0]:+.2f}, ice-time split r={pearsonr(A.loc[j,"tH"]-A.loc[j,"tA"],B.loc[j,"tH"]-B.loc[j,"tA"])[0]:+.2f}')
P6=player_split(R6,5).set_index('pid'); P5i=P5.set_index('pid'); j=P5i.index.intersection(P6.index)
print(f' persistence, 2025-26 vs 2026-27 so far ({len(j)} skaters, 5+ games each venue): shots r={pearsonr(P5i.loc[j,"s_d"],P6.loc[j,"s_d"])[0]:+.2f}, goals r={pearsonr(P5i.loc[j,"g_d"],P6.loc[j,"g_d"])[0]:+.2f}')
# top players by significance
print('\n 2025-26 biggest shots splits with p<0.01 (sorted by home minus away):')
s=P5[P5.s_p<0.01].sort_values('s_d')
cols=['name','team','pos','nH','nA','sH','sA','s_d','h3','a3','tH','tA','s_p','s_q']
print(s[cols].round(3).to_string(index=False))
s=s.set_index('pid'); jj=s.index.intersection(P6.index)
print('\n  the same skaters this season (5+ games each venue):')
t=pd.DataFrame({'name':s.loc[jj,'name'],'split_25':s.loc[jj,'s_d'],'nH_26':P6.loc[jj,'nH'],'nA_26':P6.loc[jj,'nA'],'sH_26':P6.loc[jj,'sH'],'sA_26':P6.loc[jj,'sA'],'split_26':P6.loc[jj,'s_d']})
t['same_sign']=np.sign(t.split_25)==np.sign(t.split_26)
print(t.round(2).sort_values('split_25').to_string(index=False)); print(f'  same direction: {t.same_sign.sum()} of {len(t)}')
print('\n 2025-26 biggest goals splits with p<0.05:')
s=P5[P5.g_p<0.05].sort_values('g_d')
print(s[['name','team','pos','nH','nA','gH','gA','g_d','g_p','g_q']].round(3).to_string(index=False))
# this season biggest (8+ each venue)
P6b=player_split(R6,8)
print(f'\n 2026-27 so far, 8+ games each venue ({len(P6b)} skaters), shots splits of 1.0+ a game:')
s=P6b[P6b.s_d.abs()>=1.0].sort_values('s_d')
s=s.merge(P5[['pid','s_d']].rename(columns={'s_d':'split_25'}),on='pid',how='left')
print(s[['name','team','pos','nH','nA','sH','sA','s_d','s_p','split_25']].round(2).to_string(index=False))

# ---------------- the home lift by shooter tier, the rink's recorded shots
for lab,R in [('2025-26',R5),('2026-27',R6)]:
    r=R.copy(); own=r.groupby('pid').agg(n=('gid','size'),s=('sog','mean')); r=r.join(own,on='pid'); r=r[r.n>=(30 if lab=='2025-26' else 10)]
    r['tier']=pd.cut(r.s,[0,1,2,3,10],labels=['<1','1-2','2-3','3+'])
    t=r.groupby(['tier','venue'],observed=True).agg(s=('sog','mean'),toi=('toi','mean'),n=('sog','size')).unstack()
    t['home/away shots']=t[('s','H')]/t[('s','A')]; t['home/away toi']=t[('toi','H')]/t[('toi','A')]
    print(lab); print(t.round(3).to_string())
# rink effect: total shots both teams at a team's home vs in its away games
def rink(G):
    a=G.assign(tot=G.hs+G.as_)
    h=a.groupby('home').tot.mean(); aw=a.groupby('away').tot.mean()
    return (h-aw).rename('rink'), h
r5,h5=rink(G5); r6,h6=rink(G6)
G5s=G5.sort_values('date'); half=G5s.date.iloc[len(G5s)//2]
ra,_=rink(G5s[G5s.date<half]); rb,_=rink(G5s[G5s.date>=half])
print('\nRink effect (both teams\' shots in a team\'s home games minus in its road games):')
print(f' sd 2025-26 {r5.std():.2f}; 1st vs 2nd half r={pearsonr(ra,rb.loc[ra.index])[0]:+.2f}; 2025-26 vs 2026-27 r={pearsonr(r5,r6.loc[r5.index])[0]:+.2f}')
x=pd.DataFrame({'2025-26':r5,'1st half':ra,'2nd half':rb,'2026-27':r6}).sort_values('2025-26')
print(pd.concat([x.head(5),x.tail(5)]).round(1).to_string())
# CHI SA this season
T=G6.assign()
for t in ['CHI','CAR','MTL','DET','FLA','CGY','BOS']:
    h=G6[G6.home==t]; a=G6[G6.away==t]
    print(f' {t} 2026-27: SA home {h.as_.mean():.1f} ({len(h)}) away {a.hs.mean():.1f} ({len(a)}) | SF home {h.hs.mean():.1f} away {a.as_.mean():.1f}')
