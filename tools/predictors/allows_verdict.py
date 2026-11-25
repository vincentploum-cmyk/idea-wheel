# Does the rink head's verdict ("CHI allows a lot of shots" / goals) hold: every skater-game replayed leak-free with the
# opponent's shots and goals allowed a game this season before the date, ranked as teamAllowsBook / zoneTone do (3+
# games, thirds), against the skater's own season-to-date rate (10+ games). docs/audits/2026-11-25-nhl-home-away-and-allows.md
# python3 -I tools/predictors/allows_verdict.py <games dir> [...]   (fetch.mjs output, one season a dir)
import sys, math
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
from scipy.stats import poisson
def third(rank,n):
    t=math.ceil(n/3); return 'soft' if rank<=t else ('tough' if rank>n-t else 'mid')
def run(season, prev=None, minown=5):
    G,R=load(season)
    R=R.sort_values('date')
    # per opp per game allowed (skater rows against opp) -- as teamAllowsBook
    allowed=R.groupby(['opp','gid','date'])[['sog','g']].sum().reset_index()
    tf=R.groupby(['team','gid','date'])[['sog','g']].sum().reset_index()
    out=[]
    dates=sorted(R.date.unique())
    for d in dates:
        prior=allowed[allowed.date<d]
        per=prior.groupby('opp').agg(gp=('gid','nunique'),sog=('sog','sum'),g=('g','sum'))
        per['sog']/=per.gp; per['g']/=per.gp
        rk=per[per.gp>=3]; n=len(rk)
        tone={}
        for m in ['sog','g']:
            tone[m]={t:(third(1+(rk[m]>v).sum(),n) if n else None) for t,v in rk[m].items()}
        today=R[R.date==d]
        pr=R[R.date<d]
        own=pr.groupby('pid').agg(gp=('gid','nunique'),sog=('sog','sum'),g=('g','sum'))
        tprior=tf[tf.date<d].groupby('team').agg(gp=('gid','nunique'),sog=('sog','sum'),g=('g','sum'))
        for r in today.itertuples():
            o=own.loc[r.pid] if r.pid in own.index else None
            tp=tprior.loc[r.team] if r.team in tprior.index else None
            out.append(dict(date=d,pid=r.pid,name=r.name,team=r.team,opp=r.opp,venue=r.venue,pos=r.pos,sog=r.sog,g=r.g,gid=r.gid,
              own_gp=o.gp if o is not None else 0, own_sog=o.sog/o.gp if o is not None else np.nan, own_g=o.g/o.gp if o is not None else np.nan,
              t_gp=tp.gp if tp is not None else 0, t_sog=tp.sog/tp.gp if tp is not None else np.nan, t_g=tp.g/tp.gp if tp is not None else np.nan,
              tone_sog=tone['sog'].get(r.opp), tone_g=tone['g'].get(r.opp),
              opp_gp=int(per.gp.get(r.opp,0))))
    return pd.DataFrame(out), tf
def report(df, tf, label):
    print(f'\n===== {label} =====')
    x=df[(df.own_gp>=10)&df.tone_sog.notna()].copy()
    print(f'skater-games with own rate from 10+ games and a ranked opponent: {len(x)}')
    x['p3']=1-poisson.cdf(2,x.own_sog); x['p4']=1-poisson.cdf(3,x.own_sog)
    print('\nSHOTS verdict (opp shots allowed a game this season, thirds)')
    print(f"{'tone':6} {'n':>6} {'act/gm':>7} {'own/gm':>7} {'ratio':>6} {'3+ hit':>7} {'3+ exp':>7} {'4+ hit':>7} {'4+ exp':>7}")
    for t in ['soft','mid','tough']:
        s=x[x.tone_sog==t]
        print(f"{t:6} {len(s):6d} {s.sog.mean():7.2f} {s.own_sog.mean():7.2f} {s.sog.sum()/s.own_sog.sum():6.3f} {(s.sog>=3).mean():7.1%} {s.p3.mean():7.1%} {(s.sog>=4).mean():7.1%} {s.p4.mean():7.1%}")
    # shooters 2.5+
    print('  shooters at 2.5+ shots a game:')
    for t in ['soft','mid','tough']:
        s=x[(x.tone_sog==t)&(x.own_sog>=2.5)]
        print(f"  {t:6} {len(s):5d} ratio {s.sog.sum()/s.own_sog.sum():.3f}  3+ {(s.sog>=3).mean():.1%} (exp {s.p3.mean():.1%})  4+ {(s.sog>=4).mean():.1%} (exp {s.p4.mean():.1%})")
    # bootstrap CI on soft-vs-tough ratio difference (resample games)
    rng=np.random.default_rng(1); gids=x.gid.unique()
    gb={g:i for i,g in enumerate(gids)}; x['gi']=x.gid.map(gb)
    agg=x.groupby(['gi','tone_sog']).agg(a=('sog','sum'),e=('own_sog','sum')).unstack(fill_value=0)
    A=agg['a'];E=agg['e']; diffs=[]
    for _ in range(1000):
        idx=rng.integers(0,len(gids),len(gids))
        a=A.iloc[idx].sum();e=E.iloc[idx].sum(); r=a/e; diffs.append(r['soft']-r['tough'])
    print(f'  soft minus tough ratio: {np.mean(diffs):+.3f}  95% CI [{np.percentile(diffs,2.5):+.3f}, {np.percentile(diffs,97.5):+.3f}]')
    # by opponent games played
    print('  by how many games the opponent had played (rank reliability):')
    for lo,hi in [(3,9),(10,19),(20,39),(40,90)]:
        s=x[(x.opp_gp>=lo)&(x.opp_gp<=hi)]
        if len(s)<500: continue
        r={t:s[s.tone_sog==t].sog.sum()/s[s.tone_sog==t].own_sog.sum() for t in ['soft','mid','tough']}
        h={t:(s[s.tone_sog==t].sog>=3).mean()-s[s.tone_sog==t].p3.mean() for t in ['soft','mid','tough']}
        print(f"   opp {lo}-{hi} gp n={len(s):6d}  ratio soft {r['soft']:.3f} mid {r['mid']:.3f} tough {r['tough']:.3f} | 3+ hit minus exp soft {h['soft']:+.1%} mid {h['mid']:+.1%} tough {h['tough']:+.1%}")
    print('\nGOALS verdict (opp goals allowed a game this season, thirds)')
    y=df[(df.own_gp>=10)&df.tone_g.notna()].copy()
    y['p1']=1-np.exp(-y.own_g)
    print(f"{'tone':6} {'n':>6} {'act/gm':>7} {'own/gm':>7} {'ratio':>6} {'1+ hit':>7} {'1+ exp':>7}")
    for t in ['soft','mid','tough']:
        s=y[y.tone_g==t]
        print(f"{t:6} {len(s):6d} {s.g.mean():7.3f} {s.own_g.mean():7.3f} {s.g.sum()/s.own_g.sum():6.3f} {(s.g>=1).mean():7.1%} {s.p1.mean():7.1%}")
    print('  scorers at 0.35+ goals a game:')
    for t in ['soft','mid','tough']:
        s=y[(y.tone_g==t)&(y.own_g>=0.35)]
        print(f"  {t:6} {len(s):5d} ratio {s.g.sum()/s.own_g.sum():.3f}  1+ {(s.g>=1).mean():.1%} (exp {(s.own_g.apply(lambda l:1-math.exp(-l))).mean():.1%})")
    y['gi']=y.gid.map({g:i for i,g in enumerate(y.gid.unique())}); ng=y.gi.max()+1
    agg=y.groupby(['gi','tone_g']).agg(a=('g','sum'),e=('own_g','sum')).unstack(fill_value=0)
    A=agg['a'];E=agg['e'];diffs=[]
    for _ in range(1000):
        idx=rng.integers(0,ng,ng); a=A.iloc[idx].sum();e=E.iloc[idx].sum();r=a/e;diffs.append(r['soft']-r['tough'])
    print(f'  soft minus tough ratio: {np.mean(diffs):+.3f}  95% CI [{np.percentile(diffs,2.5):+.3f}, {np.percentile(diffs,97.5):+.3f}]')
    # cross: does the shots verdict help goals?
    print('  goals by the SHOTS verdict:')
    for t in ['soft','mid','tough']:
        s=y[y.tone_sog==t]; print(f"   {t:6} ratio {s.g.sum()/s.own_g.sum():.3f}  1+ {(s.g>=1).mean():.1%} (exp {s.p1.mean():.1%})")
    # team level
    tm=df[(df.t_gp>=5)&df.tone_sog.notna()].groupby(['gid','team']).agg(sog=('sog','sum'),g=('g','sum'),t_sog=('t_sog','first'),t_g=('t_g','first'),tone_sog=('tone_sog','first'),tone_g=('tone_g','first')).reset_index()
    print('\nTEAM level: team shots/goals that night vs its own season-to-date average, by the verdict')
    for t in ['soft','mid','tough']:
        s=tm[tm.tone_sog==t]; s2=tm[tm.tone_g==t]
        print(f"  {t:6} n={len(s):4d} shots {s.sog.mean():5.1f} vs own {s.t_sog.mean():5.1f} ({s.sog.sum()/s.t_sog.sum()-1:+.1%}) | goals(by goals verdict) {s2.g.mean():.2f} vs own {s2.t_g.mean():.2f} ({s2.g.sum()/s2.t_g.sum()-1:+.1%})")
if __name__=='__main__':
    for s in sys.argv[1:]:
        df,tf=run(s)
        report(df,tf,s)
