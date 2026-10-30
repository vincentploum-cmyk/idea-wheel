'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { MARKS, describe } from '@/lib/nhl-data/patterns-pure';

// The Patterns tab (its own slate date): a pill per line for every skater in tonight's lineups — 3+ / 4+ / 5+ / 6+
// SOG, 1+ / 2+ / 3+ goals — after firsthalfscore.com's: solid with a check when a rule the study kept fires and its
// rate clears the line's bar, outlined with the figure otherwise; the conditions behind the filled pills underneath.
// The strongest tonight per line first, then every game folded to a line. One request a slate (/api/nhl/data/patterns).

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');
const SHOWN = 15;
const markOf = (k) => MARKS.find((m) => m.key === k);
const hitOf = (actual, mk) => { const m = markOf(mk); return actual && !actual.dnp ? actual[m.stat] >= m.at : null; };

/** What a pill's hover says: the rule behind it (the payload's catalog, worded with his values), how it did on the week it never saw and since. */
function pillTitle(mk, p, bar, s, catalog) {
  const m = markOf(mk);
  if (!p) return m.label;
  const head = `${m.label}: ${pct(p.p)}${p.selected ? ` — a pick (a rule that held, over the ${pct(bar)} bar)` : bar != null ? ` (the bar is ${pct(bar)})` : ''}`;
  const rule = p.rule ? catalog?.[p.rule] : null;
  if (!rule) return `${head}. No rule fires and no tier fits: the season’s base rate.`;
  const ctx = { opp: s.opp, pos: s.pos, slot: s.slot || s.pos, home: s.venue === 'H' };
  const when = rule.when.map((c, i) => [c, p.vals?.[i]]).filter(([c]) => !(rule.kind === 'tier' && c.f === 'gp')).map(([c, v]) => describe(c, v, ctx).text).join('; ');
  const check = rule.check?.n ? ` Check week: ${rule.check.hits} of ${rule.check.n} (${pct(rule.check.hits / rule.check.n)}).` : '';
  const live = p.live ? ` Since the study: ${p.live[0]} of ${p.live[1]}.` : '';
  return `${head}. ${rule.kind === 'tier' ? 'His shots-a-game tier' : 'The rule'}: ${when}.${check}${live}`;
}

function Pill({ mk, s, bar, final, catalog }) {
  const m = markOf(mk);
  const p = s.pills?.[mk];
  const hit = final ? hitOf(s.actual, mk) : null;
  // Graded once final, the picks only: a pick that landed rings green, one that missed red.
  const cls = `ir-pill${p?.selected ? ` is-on${hit === true ? ' is-hit' : hit === false ? ' is-miss' : ''}` : ''}`;
  return (
    <span className={cls} title={pillTitle(mk, p, bar, s, catalog)}>
      <b>{m.short}</b>{p?.selected ? <i aria-label="pick">✓</i> : null}<span>{pct(p?.p)}</span>
    </span>
  );
}

function Facts({ s, max = 4 }) {
  const [all, setAll] = useState(false);
  const list = [...(s.facts || []).map((f) => ({ ...f, tone: 'rule' })), ...(s.notes || [])];
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, max);
  return (
    <span className="ir-facts">
      {shown.map((f, i) => <span key={`${f.key}-${i}`} className={`ir-fact is-${f.tone || 'rule'}`} title={f.text}>{f.short}</span>)}
      {list.length > shown.length ? <button type="button" className="ir-fact is-more" onClick={(e) => { e.stopPropagation(); setAll(true); }}>+{list.length - shown.length}</button> : null}
    </span>
  );
}

const gotText = (a) => (!a ? '' : a.dnp ? 'DNP' : `${a.sog} SOG · ${a.g} G`);

function Strongest({ data, onOpen }) {
  const [mk, setMk] = useState('s3');
  const [more, setMore] = useState(false);
  const rows = useMemo(() => {
    const out = [];
    for (const g of data.games) for (const side of g.sides) for (const s of side.skaters) if (s.pills?.[mk]?.selected) out.push({ ...s, game: g });
    return out.sort((a, b) => b.pills[mk].p - a.pills[mk].p);
  }, [data, mk]);
  const counts = useMemo(() => Object.fromEntries(MARKS.map((m) => [m.key, data.games.reduce((n, g) => n + g.sides.reduce((k, side) => k + side.skaters.filter((s) => s.pills?.[m.key]?.selected).length, 0), 0)])), [data]);
  const bar = data.rules.marks[mk]?.bar;
  const shown = more ? rows : rows.slice(0, SHOWN);
  const final = data.games.some((g) => g.final);
  return (
    <div className="ir-pt-strong">
      <div className="nhlx-tabs" role="tablist" aria-label="Line">
        {MARKS.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={mk === m.key} className={`nhlx-tab${mk === m.key ? ' is-active' : ''}`} onClick={() => { setMk(m.key); setMore(false); }}>
            {m.label}<i>{counts[m.key]}</i>
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="nhlx-db-table-wrap">
          <table className="nhlx-pk-table ir-pt-table">
            <thead><tr><th>#</th><th>Skater</th><th>Game</th><th>{markOf(mk).label}</th><th>Why</th>{final ? <th>Got</th> : null}</tr></thead>
            <tbody>
              {shown.map((s, i) => {
                const hit = s.game.final ? hitOf(s.actual, mk) : null;
                return (
                  <tr key={s.id} className={`is-click${hit === true ? ' is-hit' : hit === false ? ' is-miss' : ''}`} onClick={() => onOpen(s)}>
                    <td className="ir-pt-rank">{i + 1}</td>
                    <td className="ir-pt-player"><Headshot id={s.id} size={28} /><span><b>{s.name}</b><small className="nhlx-auto-meta">{s.slot || s.pos}</small></span></td>
                    <td className="ir-pt-game"><small className="nhlx-auto-meta">{s.team} {s.venue === 'H' ? 'vs' : '@'} {s.opp}{s.game.final ? '' : ` · ${fmtTime(s.game.startTimeUTC)}`}</small></td>
                    <td className="ir-pt-pill"><Pill mk={mk} s={s} bar={bar} final={s.game.final} catalog={data.rules.catalog} /></td>
                    <td className="ir-pt-why"><Facts s={{ facts: s.facts.filter((f) => f.marks.includes(mk)), notes: s.notes }} max={4} /></td>
                    {final ? <td className="ir-pt-got">{gotText(s.actual)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="nhlx-auto-meta">No skater fills the {markOf(mk).label} pill tonight: no rule that held fires over the {pct(bar)} bar.</p>}
      {rows.length > SHOWN ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setMore((v) => !v)}>{more ? 'Show the top 15' : `Show all ${rows.length}`}</button> : null}
    </div>
  );
}

function SideList({ side, final, onlyPicks, bars, catalog, onOpen }) {
  const skaters = side.skaters.filter((s) => s.pills && (!onlyPicks || MARKS.some((m) => s.pills[m.key]?.selected)))
    .sort((a, b) => MARKS.filter((m) => b.pills[m.key]?.selected).length - MARKS.filter((m) => a.pills[m.key]?.selected).length || b.pills.s3.p - a.pills.s3.p);
  return (
    <section className="ir-pt-side" aria-label={side.team}>
      <div className="ir-gf-team-head"><TeamLogo abbr={side.team} size={24} /><b>{side.team}</b><small className="nhlx-auto-meta">{side.venue === 'H' ? 'vs' : 'at'} {side.opp}</small></div>
      {skaters.length ? (
        <ul className="ir-pt-list">
          {skaters.map((s) => (
            <li key={s.id}>
              <button type="button" className="ir-pt-who" onClick={() => onOpen(s)}><b>{s.name}</b><small className="nhlx-auto-meta">{s.slot || s.pos}{final ? ` · ${gotText(s.actual)}` : ''}</small></button>
              <span className="ir-pills">{MARKS.map((m) => <Pill key={m.key} mk={m.key} s={s} bar={bars[m.key]} final={final} catalog={catalog} />)}</span>
              <Facts s={s} max={3} />
            </li>
          ))}
        </ul>
      ) : <p className="nhlx-auto-meta">{onlyPicks ? 'No pick on this side.' : 'No skater with games this season.'}</p>}
    </section>
  );
}

function GameFold({ g, onlyPicks, bars, catalog, onOpen }) {
  const [open, setOpen] = useState(false);
  const picks = g.sides.reduce((n, side) => n + side.skaters.reduce((k, s) => k + MARKS.filter((m) => s.pills?.[m.key]?.selected).length, 0), 0);
  const landed = g.final ? g.sides.reduce((n, side) => n + side.skaters.reduce((k, s) => k + MARKS.filter((m) => s.pills?.[m.key]?.selected && hitOf(s.actual, m.key)).length, 0), 0) : null;
  const id = `pt-game-${g.id}`;
  return (
    <article className={`ir-gf${open ? ' is-open' : ''}`}>
      <button type="button" className="ir-gf-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span className="ir-gf-teams"><TeamLogo abbr={g.away} size={22} />{g.away}<i>@</i><TeamLogo abbr={g.home} size={22} />{g.home}</span>
        <span className="ir-gf-meta">{g.final ? `Final ${g.score.away}–${g.score.home}` : fmtTime(g.startTimeUTC)}</span>
        <span className="ir-gf-meta">{picks} pick{picks === 1 ? '' : 's'}{landed != null ? ` · ${landed} landed` : ''}</span>
        <svg className="ir-gf-caret" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open ? (
        <div className="ir-gf-body" id={id}>
          <div className="ir-gf-cols">{g.sides.map((side) => <SideList key={side.team} side={side} final={g.final} onlyPicks={onlyPicks} bars={bars} catalog={catalog} onOpen={onOpen} />)}</div>
        </div>
      ) : null}
    </article>
  );
}

function RecordLine({ data }) {
  const r = data.record;
  const parts = MARKS.map((m) => ({ m, t: r.marks?.[m.key] })).filter((x) => x.t?.picks);
  if (!parts.length) return <p className="nhlx-auto-meta">Record: no game since {fmtDay(data.rules.builtThrough)} is stored yet; the first night after the study starts it.</p>;
  return (
    <p className="ir-pt-record">
      <b>Since {fmtDay(r.from)}</b>
      {parts.map(({ m, t }) => <span key={m.key}>{m.label} <b>{t.landed} of {t.picks}</b> landed ({pct(t.landed / t.picks)}, said {pct(t.said)})</span>)}
    </p>
  );
}

export default function PatternsPanel() {
  const open = usePlayerCard();
  const [date, setDate] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [onlyPicks, setOnlyPicks] = useState(true);
  const load = useCallback((d) => fetch(`/api/nhl/data/patterns${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setData(j); setDate(j.date); setErr(''); })
    .catch((e) => setErr(`Patterns: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  const pick = (d) => { setBusy(true); setErr(''); load(d); };
  const shift = (n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); pick(d.toISOString().slice(0, 10)); };
  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';
  const onOpen = (s) => open({ id: s.id, opp: s.opp, venue: s.venue, pos: s.pos, line: s.line, date });
  const bars = useMemo(() => Object.fromEntries(Object.entries(data?.rules?.marks || {}).map(([k, m]) => [k, m.bar])), [data]);
  const skaters = data ? data.games.reduce((n, g) => n + g.sides.reduce((k, s) => k + s.skaters.length, 0), 0) : 0;

  return (
    <section className="nhlx-pk" aria-label="Patterns">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">{data ? `${data.games.length} game${data.games.length === 1 ? '' : 's'} · ${skaters} skaters in the lineups` : ''}</div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
          <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && pick(e.target.value)} aria-label="Slate date" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !date} onClick={() => pick(date)}>{busy ? 'Loading…' : 'Reload'}</button>
        </div>
      </div>
      {err ? <div className="nhlx-alert">{err}</div> : null}
      {data ? (
        <>
          <p className="nhlx-auto-meta ir-pt-how">
            A pill per line. <span className="ir-pill is-on"><b>3+</b><i>✓</i><span>58%</span></span> is a pick: a rule the study kept fires for him and its rate clears the line’s bar
            ({MARKS.map((m) => `${m.short} ${pct(bars[m.key])}`).join(' · ')}, about what a book asks). <span className="ir-pill"><b>4+</b><span>31%</span></span> is his figure without a pick:
            the strongest rule he meets, else his shots-a-game tier. The rules were searched on {fmtDay(data.rules.fit?.[0])}–{fmtDay(data.rules.fit?.[1])} and kept only when they held on {fmtDay(data.rules.check?.[0])}–{fmtDay(data.rules.check?.[1])}; their rates move with every game since. Hover a pill for its rule.
          </p>
          <RecordLine data={data} />
          <h3 className="nhlx-db-h3">Strongest tonight</h3>
          <Strongest data={data} onOpen={onOpen} />
          <div className="ir-pt-games-head">
            <h3 className="nhlx-db-h3">Every game</h3>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-soft" aria-pressed={onlyPicks} onClick={() => setOnlyPicks((v) => !v)}>{onlyPicks ? 'Skaters with a pick' : 'Every skater'}</button>
          </div>
          <div className="ir-gf-list">{data.games.map((g) => <GameFold key={g.id} g={g} onlyPicks={onlyPicks} bars={bars} catalog={data.rules.catalog} onOpen={onOpen} />)}</div>
          {!data.games.length ? <p className="nhlx-auto-meta">No games on this date.</p> : null}
        </>
      ) : null}
    </section>
  );
}
