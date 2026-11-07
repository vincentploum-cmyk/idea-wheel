"""The outliers list's fit (lib/nba/big.js NBA_OUTLIERS): the board's tail at double his projection, σ(a + b · logit), on the
replayed board's rows (nba-audit.mjs --cocktail site; the fit season first, the check second). Paths below are the 2026-11-07 run's."""
import pandas as pd, numpy as np
from scipy.stats import norm, nbinom, poisson
from scipy.optimize import minimize
SPEC={'pts':(10,6,False),'reb':(4,2.5,True),'ast':(4,1.5,True),'tpm':(2,0.8,True)}
def tail(k,mu,sd,count):
    if not count: return norm.sf((k-0.5-mu)/np.maximum(sd,.01))
    out=np.empty(len(mu))
    for i in range(len(mu)):
        m=max(mu[i],.05); v=sd[i]**2
        if v<=m*1.0001: out[i]=poisson.sf(k[i]-1,m)
        else: p=m/v; n=m*p/(1-p); out[i]=nbinom.sf(k[i]-1,n,p)
    return out
def load(f):
    r=pd.read_csv(f); return r[r.exp.notna()&r.sd.notna()&r.actual.notna()&(r.out!=True)&(r.actualMin.fillna(0)>0)&(r.minTonight.fillna(0)>=12)]
F=load('.nhl-data/audit/ab25/nba-2026-04-12-minutes-rows.csv'); C=load('.nhl-data/audit/sp2/nba-2026-11-06-minutes-rows.csv')
lg=lambda p: np.log(np.clip(p,1e-4,1-1e-4)/(1-np.clip(p,1e-4,1-1e-4)))
def prep(r,m):
    add,fl,cnt=SPEC[m]; x=r[(r.market==m)&(r.exp>=fl)].copy()
    x['k']=np.maximum(np.ceil(2*x.exp),np.ceil(x.exp+add)).astype(int); x['y']=(x.actual>=x.k).astype(int)
    x['p0']=tail(x.k.values,x.exp.values,x.sd.values,cnt); return x
def ll(p,y): p=np.clip(p,1e-4,1-1e-4); return -np.mean(y*np.log(p)+(1-y)*np.log(1-p))
for m in SPEC:
    f=prep(F,m); c=prep(C,m)
    nll=lambda b: -np.sum(f.y*np.log(1/(1+np.exp(-(b[0]+b[1]*lg(f.p0)))))+(1-f.y)*np.log(1-1/(1+np.exp(-(b[0]+b[1]*lg(f.p0))))))
    b=minimize(nll,[0,1]).x
    cal=lambda x: 1/(1+np.exp(-(b[0]+b[1]*lg(x.p0))))
    print(f'{m}: a {b[0]:.4f} b {b[1]:.4f}  fit n {len(f)} base {f.y.mean():.3f} | check n {len(c)} base {c.y.mean():.3f}  ll raw {ll(c.p0,c.y):.4f} cal {ll(cal(c),c.y):.4f}')
    for lab,x in [('2025-26',f),('this season',c)]:
        x=x.assign(pc=cal(x)); t=x.groupby('slate',group_keys=False).apply(lambda d:d.nlargest(10,'pc'))
        bands=pd.cut(x.pc,[0,.03,.06,.1,.15,1]); g=x.groupby(bands,observed=True).agg(n=('y','size'),said=('pc','mean'),raw=('p0','mean'),landed=('y','mean'))
        print(f'   {lab}: top10/night said {t.pc.mean():.3f} (raw {t.p0.mean():.3f}) landed {t.y.mean():.3f}  n {len(t)}'); print('     '+g.round(3).to_string().replace('\n','\n     '))
