"use client";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { CREDIT_PACKAGES } from "@/lib/pricing";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_MODE_CONFIGS, buildGeneratorIdea } from "@/lib/generator-config";

/* ─── IDEA SEGMENTS ──────────────────────────────────────────────── */
const SEGMENTS = [
  { id: "health",    label: "Health",     color: "#7c3aed",
    title: "VitalLoop",
    tagline: "At-home metabolic coaching from a finger-prick and a phone camera.",
    blurb: "A $39/mo membership that turns a monthly at-home blood panel into a living, AI-personalized nutrition and habit plan — closing the loop between lab work and daily life." },
  { id: "climate",   label: "Climate",    color: "#9333ea",
    title: "Cumulus",
    tagline: "A marketplace for verified carbon credits from small regenerative farms.",
    blurb: "Pairs satellite + soil-sensor verification with a clean buying experience so mid-market companies can fund real, local soil carbon — not sketchy offsets." },
  { id: "fintech",   label: "Fintech",    color: "#c026d3",
    title: "Float",
    tagline: "Zero-fee instant payroll advances for gig and shift workers.",
    blurb: "Workers tap earned-but-unpaid wages instantly; employers pay a flat platform fee. No predatory interest, no tips, no overdraft — just access to money already earned." },
  { id: "creator",   label: "Creator",    color: "#db2777",
    title: "Encore",
    tagline: "Turn a podcast or video back-catalog into a searchable, sellable course.",
    blurb: "Point Encore at years of episodes; it restructures them into a navigable, searchable curriculum creators can sell — unlocking the value buried in the archive." },
  { id: "ai",        label: "AI Tools",   color: "#ff4d8d",
    title: "Bench",
    tagline: "An AI ops analyst that watches your dashboards and pings you before things break.",
    blurb: "Connect your data tools; Bench learns what 'normal' looks like, flags anomalies in plain English, and drafts the Slack message you'd send — your always-on analyst." },
  { id: "edu",       label: "Education",  color: "#5b5bf5",
    title: "Cohortly",
    tagline: "Tiny, high-touch cohort classes taught by working domain experts.",
    blurb: "A platform for 8-person, 3-week cohorts where practitioners teach the exact skill they do daily — accountability and access, not another video library." },
  { id: "logistics", label: "Logistics",  color: "#ff6f61",
    title: "Lastmile",
    tagline: "Shared same-day delivery that finally makes sense for indie retailers.",
    blurb: "Pools deliveries across nearby small shops into shared driver routes — giving independents same-day shipping at a price big-box logistics keeps for themselves." },
  { id: "social",    label: "Social",     color: "#a21caf",
    title: "Campfire",
    tagline: "Small-group audio rooms built for hobby communities, not influencers.",
    blurb: "Cozy, recurring 12-person audio rooms organized around niche hobbies — the warmth of a group call with the discoverability of a community, minus the broadcast noise." },
];

/* ─── HELPERS ────────────────────────────────────────────────────── */
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function slicePath(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}
function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * t); g = Math.round(g + (255 - g) * t); b = Math.round(b + (255 - b) * t);
  return `rgb(${r},${g},${b})`;
}

/* ─── TEASER REEL DATA ───────────────────────────────────────────── */
const TEASER_BANKS = [
  ['Automates','Streamlines','Manages','Tracks','Builds','Improves','Optimizes','Simplifies','Coaches','Plans'],
  ['client onboarding','invoice processing','daily habits','sleep quality','referral tracking','personal finances','contract management','fitness goals','shift scheduling','mental health'],
  ['Healthcare','Legal services','busy professionals','Dental practices','new parents','Construction','remote workers','Accounting firms','athletes','small business owners'],
];
const REEL_COLORS = ['#7c3aed','#c026d3','#ff4d8d'];
const REEL_LABELS = ['ACTION','WORKFLOW','FOR'];

/* ─── AUTO-CYCLING TEASER REEL ──────────────────────────────────── */
function TeaserReel({ bank, color, label }) {
  const [offset, setOffset] = useState(0);
  const ITEM_H = 56;
  useEffect(() => {
    const id = setInterval(() => setOffset(o => o + 1), 1800);
    return () => clearInterval(id);
  }, []);
  const idx = offset % bank.length;
  const items = [...bank, ...bank, ...bank];
  return (
    <div className="tr-col">
      <div className="tr-label" style={{ color }}>{label}</div>
      <div className="tr-window">
        <div className="tr-strip" style={{
          transform: `translateY(${-(idx + bank.length) * ITEM_H + ITEM_H}px)`,
          transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {items.map((word, i) => (
            <div className="tr-item" key={i} style={{ height: ITEM_H }}>{word}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeaserReels() {
  return (
    <div className="tr-root">
      <div className="tr-reels">
        {TEASER_BANKS.map((bank, i) => (
          <TeaserReel key={i} bank={bank} color={REEL_COLORS[i]} label={REEL_LABELS[i]} />
        ))}
      </div>
    </div>
  );
}

/* ─── SVG WHEEL ──────────────────────────────────────────────────── */
function Wheel({ onResult }) {
  const N = SEGMENTS.length;
  const seg = 360 / N;
  const C = 200, R = 192;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const rotRef = useRef(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true); setLanded(null);
    const i = Math.floor(Math.random() * N);
    const centerDeg = i * seg;
    const targetMod = ((-centerDeg) % 360 + 360) % 360;
    const curMod = ((rotRef.current % 360) + 360) % 360;
    let delta = targetMod - curMod; if (delta < 0) delta += 360;
    const turns = 5 + Math.floor(Math.random() * 2);
    const next = rotRef.current + delta + 360 * turns;
    rotRef.current = next;
    setRotation(next);
    setTimeout(() => { setSpinning(false); setLanded(i); onResult(SEGMENTS[i]); }, 4600);
  };

  return (
    <div className="su-wheel-wrap">
      <div className="su-wheel-pointer">
        <svg width="42" height="50" viewBox="0 0 46 54" fill="none">
          <path d="M23 50 L6 14 A20 20 0 0 1 40 14 Z" fill="#fff" stroke="#ece6f5" strokeWidth="1.5"/>
          <circle cx="23" cy="18" r="6" fill="url(#pg)"/>
          <defs><linearGradient id="pg" x1="17" y1="12" x2="29" y2="24">
            <stop stopColor="#7c3aed"/><stop offset="1" stopColor="#ff4d8d"/></linearGradient></defs>
        </svg>
      </div>
      <div className="su-wheel-shadow"/>
      <svg className="su-wheel-svg" viewBox="0 0 400 400"
        style={{ transform:`rotate(${rotation}deg)`,
          transition: spinning ? `transform 4.6s cubic-bezier(.12,.74,.16,1)` : "none" }}>
        <defs>
          {SEGMENTS.map((s,i) => (
            <linearGradient key={i} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={lighten(s.color, 0.16)}/>
              <stop offset="1" stopColor={s.color}/>
            </linearGradient>
          ))}
          <radialGradient id="gloss" cx="0.5" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.30"/>
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.04"/>
            <stop offset="1" stopColor="#fff" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R+2} fill="#fff"/>
        {SEGMENTS.map((s,i) => {
          const start = i*seg - seg/2, end = i*seg + seg/2;
          const win = landed === i;
          return (
            <g key={s.id} style={{ transformOrigin:`${C}px ${C}px`,
              transform: win ? "scale(1.012)" : "scale(1)", transition:"transform .5s ease" }}>
              <path d={slicePath(C,C,R,start,end)} fill={`url(#sg${i})`} stroke="#fff" strokeWidth="2.5"/>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R} fill="url(#gloss)" pointerEvents="none"/>
        {SEGMENTS.map((s,i) => (
          <g key={s.id} transform={`rotate(${i*seg} ${C} ${C})`}>
            <text x={C} y={60} textAnchor="middle"
              fontFamily="Sora,sans-serif" fontWeight="700" fontSize="17" fill="#fff">{s.label}</text>
          </g>
        ))}
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(80,20,110,.08)" strokeWidth="2"/>
      </svg>
      <button className={`su-wheel-hub ${spinning?"is-spinning":""}`} onClick={spin} disabled={spinning}>
        <span className="su-hub-inner">
          {spinning
            ? <span className="su-hub-dots"><i/><i/><i/></span>
            : <><span className="su-hub-spark">✦</span><span className="su-hub-label">SPIN</span></>}
        </span>
      </button>
    </div>
  );
}

/* ─── SCORE RING ─────────────────────────────────────────────────── */
function ScoreRing({ value, size = 128, label }) {
  const [v, setV] = useState(0);
  const r = size/2 - 11, c = 2*Math.PI*r;
  const gid = useMemo(() => "sr" + Math.random().toString(36).slice(2,7), []);
  useEffect(() => { const t = setTimeout(() => setV(value), 300); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2={size} y2={size}>
          <stop stopColor="#7C3AED"/><stop offset="1" stopColor="#FF4D8D"/></linearGradient></defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="#EFE6FF" strokeWidth="11" fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={`url(#${gid})`} strokeWidth="11" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c-(c*v)/100}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:"stroke-dashoffset 1.3s cubic-bezier(.16,1,.3,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center" }}>
        <div>
          <div className="su-ring-num">{Math.round(v)}</div>
          <div className="su-ring-label">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ValidationConfetti({ pieces = 34 }) {
  const particles = useMemo(() => {
    const palette = ['#7c3aed', '#a855f7', '#c026d3', '#ff4d8d', '#f59e0b', '#22c55e'];
    return Array.from({ length: pieces }, (_, index) => ({
      id: index,
      color: palette[index % palette.length],
      left: `${Math.round((index / Math.max(1, pieces - 1)) * 100)}%`,
      drift: `${Math.round((Math.random() - 0.5) * 180)}px`,
      spin: `${Math.round((Math.random() - 0.5) * 720)}deg`,
      delay: `${(Math.random() * 0.2).toFixed(2)}s`,
      duration: `${(1.8 + Math.random() * 0.9).toFixed(2)}s`,
      size: `${8 + Math.round(Math.random() * 8)}px`,
      shape: index % 5 === 0 ? 'pill' : index % 2 === 0 ? 'circle' : 'rect',
    }));
  }, [pieces]);

  return (
    <div className="su-confetti" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`su-confetti-piece su-confetti-piece--${particle.shape}`}
          style={{
            '--confetti-color': particle.color,
            '--confetti-left': particle.left,
            '--confetti-drift': particle.drift,
            '--confetti-spin': particle.spin,
            '--confetti-delay': particle.delay,
            '--confetti-duration': particle.duration,
            '--confetti-size': particle.size,
          }}
        />
      ))}
    </div>
  );
}

/* ─── CREDIT COSTS ───────────────────────────────────────────────── */
// Flat funnel: 1 credit for deep market research, 2 for the blueprint.
const DEEP_RESEARCH_COST = 1;
const BLUEPRINT_COST = 2;

function cleanValidationText(text = '') {
  return String(text)
    .replace(/<\/?cite\b[^>]*>/gi, ' ')
    .replace(/<\/?source\b[^>]*>/gi, ' ')
    .replace(/<\/?sup\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\bindex="[^"]*">?/gi, ' ')
    .replace(/\[(?:\d+[\d,\-\s]*)\]/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/^N\/A[—-]?\s*/i, '')
    .replace(/does not exist as a discrete segment/gi, 'is not a clear standalone category yet')
    .replace(/does not meet general wedge criteria/gi, 'does not have a clear reason to win yet')
    .replace(/general wedge criteria/gi, 'clear reason to win')
    .replace(/high-touch, expensive workflow/gi, 'time-consuming workflow')
    .replace(/proof point:/gi, 'proof:')
    // Strip internal-pipeline language that should never reach the founder.
    .replace(/\b(the\s+)?(scout|skeptic|judge)(\s+and\s+(the\s+)?(scout|skeptic|judge))?\s+(align|aligns|agree|agrees|both\s+\w+|flags?|finds?|found|identif\w+|notes?|says?|conclude[sd]?|recommend[sd]?)\b[:,]?\s*/gi, '')
    .replace(/\bthe moat advice\b/gi, 'the suggested edge')
    .replace(/\bmoat\b/gi, 'edge')
    .replace(/\bwhitespace\b/gi, 'open space')
    .replace(/\bdefensibility\b/gi, 'staying power')
    .replace(/\bdefensible\b/gi, 'hard to copy')
    .replace(/\bincumbents?\b/gi, 'big players')
    .replace(/\bpoint solution\b/gi, 'single-feature tool')
    .replace(/\bwedges?\b/gi, 'angle')
    // Tidy any double spaces / orphaned leading punctuation left by the swaps.
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/^[\s—–-]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .trim();
}

function splitValidationBullets(text = '', max = 3) {
  const clean = cleanValidationText(text)
    // Split only on contrastive joins ("…, but …"), never on ", and" — that
    // breaks comma lists of names like "AppFolio, Yardi, and Buildium".
    .replace(/,\s+(but|while|whereas)\s+/gi, '|$1 ')
    .replace(/\s*\(\d+\)\s*/g, '|')
    .replace(/\s*[•·]\s*/g, '|')
    .replace(/\.\s+/g, '.|')
    .replace(/;\s+/g, '|');

  return clean
    .split('|')
    .map((part) => part.trim().replace(/^[-–—]\s*/, ''))
    .filter(Boolean)
    .slice(0, max);
}

function briefPlayerWeakness(text = '') {
  const cleaned = cleanValidationText(text);
  if (!cleaned) return '';
  const first = cleaned.split(/\.\s+|;\s+/)[0]?.trim() || cleaned;
  return first.length > 120 ? `${first.slice(0, 117).trim()}...` : first;
}

/* ─── PLAIN-ENGLISH LAYER ────────────────────────────────────────────
   A short, jargon-free lead shown above the detailed (often technical)
   content, so a non-technical reader gets the gist before the detail. */
function PlainEnglish({ summary, takeaways, compact = false }) {
  const text = cleanValidationText(summary || '');
  const list = (Array.isArray(takeaways) ? takeaways : [])
    .map((t) => cleanValidationText(t)).filter(Boolean);
  if (!text && list.length === 0) return null;
  return (
    <div className={`su-plain${compact ? ' su-plain--compact' : ''}`}>
      <div className="su-plain-label">In plain English</div>
      {text && <p className="su-plain-text">{text}</p>}
      {list.length > 0 && (
        <ul className="su-plain-takeaways">
          {list.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}

/* ─── PROTO IFRAME ───────────────────────────────────────────────── */
function ProtoFrame({ html }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const blob = new Blob([html], { type:"text/html" });
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);
  if (!src) return null;
  return <iframe src={src} sandbox="allow-scripts allow-forms"
    style={{ width:"100%", height:480, border:"none", display:"block", borderRadius:"0 0 14px 14px" }}
    title="prototype"/>;
}

/* ─── SLOT MACHINE DATA ──────────────────────────────────────────── */
// Rule: every action must pair naturally with every workflow in the same bank.
// Sentence: "I want to build an agent that [action] [workflow] in [industry]"
//           "I want to make an app that [action] [experience] for [audience]"
const MODES = {
  b2b: {
    name:'B2B', connector:'in the', prefix:'I want to build an agent that',
    labels:['ACTION','WORKFLOW','FOR'],
    banks:[
      // Valid action→workflow pairs — every combo is guaranteed to make sense
      // Format: [action, [...allowed workflow indices]]
      // Workflows: 0=client onboarding, 1=invoice processing, 2=contract management,
      //   3=compliance reporting, 4=expense tracking, 5=lead management,
      //   6=staff scheduling, 7=document management, 8=project tracking,
      //   9=quote generation, 10=team communication, 11=vendor management,
      //   12=customer requests, 13=payroll processing, 14=performance reviews,
      //   15=inventory tracking, 16=billing & collections, 17=field operations
      // Fixed: removed Schedules (too narrow), Processes (redundant with workflow names),
      // Digitizes (often redundant). Added: Standardizes, Consolidates, Replaces.
      ['Automates','Streamlines','Manages','Centralizes','Tracks','Handles','Standardizes','Simplifies','Accelerates','Consolidates','Replaces','Organizes','Monitors','Optimizes','Prioritizes'],
      // Fixed: "invoice processing"→"invoicing", "payroll processing"→"payroll",
      // "inventory tracking"→"inventory management", "referral tracking"→"referrals"
      ['time & expense reporting', 'referrals', 'client onboarding', 'invoicing', 'contract management', 'compliance reporting', 'staff scheduling', 'job site inspections', 'quote generation', 'lead management', 'document management', 'project tracking', 'vendor management', 'customer follow-ups', 'payroll', 'performance reviews', 'inventory management', 'billing & collections', 'field operations', 'service request routing', 'safety incident reporting', 'equipment maintenance', 'crew dispatching', 'patient intake', 'referral management', 'renewal reminders', 'work order management', 'quality control checks', 'subcontractor coordination', 'delivery scheduling'],
      ['Healthcare','Legal services','Construction','Logistics','Insurance','Dental practices','Manufacturing','Accounting firms','Property management','Restaurants','Staffing agencies','Real estate','Veterinary clinics','Auto repair shops','Marketing agencies','Financial advisors','Cleaning services','Retail','Physical therapy','Childcare'],
    ],
  },
  consumer: {
    name:'Consumer', connector:'for', prefix:'I want to make an app that',
    labels:['ACTION','EXPERIENCE','FOR'],
    banks:[
      // Fixed: removed Boosts (backfires on goals/abstract nouns), Transforms (too narrow),
      // Gamifies (breaks on stress/health/finances), Personalizes (too narrow).
      // Added: Reduces, Strengthens, Accelerates, Develops.
      ['Tracks', 'Improves', 'Manages', 'Builds', 'Optimizes', 'Plans', 'Simplifies', 'Coaches', 'Monitors', 'Reduces', 'Strengthens', 'Structures', 'Accelerates', 'Organizes', 'Develops'],
      // Fixed problematic objects: "fitness goals"→"fitness", "relationship goals"→"relationships",
      // "skill development"→"skills", "sleep quality"→"sleep", "career progress"→"career growth",
      // "nutrition tracking"→"nutrition", "home organization"→"home routines",
      // "learning routines"→"learning", "social confidence"→"social life",
      // "time management"→"daily schedule"
      ['daily habits', 'sleep', 'personal finances', 'mental health', 'fitness', 'meal planning', 'career growth', 'productivity', 'stress', 'skills', 'daily schedule', 'nutrition', 'home routines', 'creative projects', 'work-life balance', 'learning', 'relationships', 'social life', 'spending habits', 'morning routines', 'workout recovery', 'focus & deep work', 'journaling', 'language learning', 'financial independence', 'digital wellbeing', 'parenting', 'reading habits', 'dating', 'side hustle'],
      // Audiences: clear groups with a shared pain point
      // 18 audiences
      ['busy professionals', 'new parents', 'college students', 'freelancers', 'athletes', 'small business owners', 'retirees', 'remote workers', 'people with ADHD', 'musicians', 'young adults', 'solopreneurs', 'teachers', 'healthcare workers', 'content creators', 'night shift workers', 'seniors living alone', 'couples', 'first-time homeowners', 'job seekers', 'new graduates', 'introverts', 'chronic illness patients', 'travel enthusiasts', 'new immigrants'],
    ],
  },
};
const ITEM_H = 72;
const REPEATS = 10;
const HOME_COPY = 4;
const REEL_TINTS = ['#7c3aed','#c026d3','#ff4d8d'];
// Smooth wind-up → cruise → settle: gentle ease-in start (no teleport on
// the first frame) and a controlled decel tail (no long creep at the end).
const SPIN_EASE = 'cubic-bezier(0.30, 0.65, 0.30, 1)';

function pickWeightedIndex(weights = []) {
  if (!weights.length) return 0;
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 1));
  const total = safe.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < safe.length; i += 1) {
    roll -= safe[i];
    if (roll <= 0) return i;
  }
  return safe.length - 1;
}

const CLIENT_DEFAULT_MODE_CONFIGS = DEFAULT_MODE_CONFIGS;

function SlotMachine({ onResult, onModeChange }) {
  const [mode, setMode] = useState('b2b');
  const [modeConfigs, setModeConfigs] = useState(CLIENT_DEFAULT_MODE_CONFIGS);
  const stripRefs = [useRef(null), useRef(null), useRef(null)];
  const indexRef = useRef([0,0,0]);
  const targetRef = useRef([0,0,0]);
  const commitRef = useRef(false);   // only a deliberate "Generate idea" spin commits a new idea
  const landedByMode = useRef({});   // persist spun result per mode so switching back restores it
  const [landed, setLanded] = useState(['','','']);
  const [spinning, setSpinning] = useState([false,false,false]);
  const [hasSpun, setHasSpun] = useState(false);
  const anySpinning = spinning.some(Boolean);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/generator/config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.modes) setModeConfigs(data.modes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const m = modeConfigs[mode] || CLIENT_DEFAULT_MODE_CONFIGS[mode];
  const banks = m.banks;
  const weights = m.weights || banks.map((bank) => bank.map(() => 1));

  useEffect(() => {
    const saved = landedByMode.current[mode];
    if (saved && saved.every(Boolean)) {
      // Restore the strip positions to match the previously-spun words for this mode
      banks.forEach((bank, w) => {
        const t = bank.indexOf(saved[w]);
        const resolvedIdx = t >= 0 ? HOME_COPY * bank.length + t : HOME_COPY * bank.length;
        indexRef.current[w] = resolvedIdx;
        const el = stripRefs[w].current;
        if (el) { el.style.transition='none'; el.style.transform=`translateY(${-(resolvedIdx-1)*ITEM_H}px)`; }
      });
      setLanded(saved);
    } else {
      banks.forEach((bank,w) => {
        const start = Math.floor(Math.random()*bank.length);
        indexRef.current[w] = HOME_COPY*bank.length + start;
        const el = stripRefs[w].current;
        if (el) { el.style.transition='none'; el.style.transform=`translateY(${-(indexRef.current[w]-1)*ITEM_H}px)`; }
      });
      setLanded(['','','']);
    }
    setSpinning([false,false,false]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, JSON.stringify(banks)]);

  const selectIndex = (column, allowedValues = null, valueWeights = null) => {
    const bank = banks[column];
    if (!allowedValues) {
      return pickWeightedIndex(weights[column] || bank.map(() => 1));
    }

    const entries = allowedValues
      .map((value) => {
        const index = bank.indexOf(value);
        if (index === -1) return null;
        return {
          index,
          weight: valueWeights?.[value] ?? weights[column]?.[index] ?? 1,
        };
      })
      .filter(Boolean);

    if (!entries.length) return pickWeightedIndex(weights[column] || bank.map(() => 1));
    return entries[pickWeightedIndex(entries.map((entry) => entry.weight))].index;
  };

  const spinWheelTo = (w, targetIdx, duration) => {
    if (spinning[w]) return;
    const bank = banks[w];
    const L = bank.length;
    const cur = indexRef.current[w];
    const curBase = ((cur%L)+L)%L;
    const forward = ((targetIdx-curBase)%L+L)%L;
    const loops = 3 + Math.floor(Math.random()*2);
    const newIndex = cur + loops*L + forward + (forward===0?L:0);
    indexRef.current[w] = newIndex;
    targetRef.current[w] = newIndex%L;
    const el = stripRefs[w].current;
    if (el) { el.style.transition=`transform ${duration}ms ${SPIN_EASE}`; el.style.transform=`translateY(${-(newIndex-1)*ITEM_H}px)`; }
    setSpinning(s => { const n=[...s]; n[w]=true; return n; });
  };

  const onSettle = (w) => {
    const bank = banks[w];
    const t = targetRef.current[w];
    indexRef.current[w] = HOME_COPY*bank.length + t;
    const el = stripRefs[w].current;
    if (el) { el.style.transition='none'; el.style.transform=`translateY(${-(indexRef.current[w]-1)*ITEM_H}px)`; }
    setLanded(p => { const n=[...p]; n[w]=bank[t]; return n; });
    setSpinning(s => { const n=[...s]; n[w]=false; return n; });
  };

  const spinAll = () => {
    if (anySpinning) return;
    setHasSpun(true);
    commitRef.current = true;   // this spin (and only this) will commit the resulting idea
    const actionIdx = selectIndex(0);
    const action = banks[0][actionIdx];
    const allowedWorkflows = (m.pairMap?.[action] || banks[1]).filter((workflow) => banks[1].includes(workflow));
    const workflowIdx = selectIndex(1, allowedWorkflows, m.pairWeights?.[action]);
    const workflow = banks[1][workflowIdx];
    const industryIdx = selectIndex(2, banks[2], m.workflowIndustryWeights?.[workflow]);

    spinWheelTo(0, actionIdx, 3000);
    spinWheelTo(1, workflowIdx, 3600);
    spinWheelTo(2, industryIdx, 4200);
  };

  const complete = landed.every(Boolean);

  useEffect(() => {
    // Commit (and reset any prior research) ONLY for a deliberate "Generate idea"
    // spin. This keeps the idea cached: re-renders or single-reel nudges never
    // silently swap the idea or wipe the market research the user is viewing.
    if (complete && !anySpinning && commitRef.current && onResult) {
      commitRef.current = false;
      landedByMode.current[mode] = [...landed];
      onResult(buildGeneratorIdea(m, landed[0], landed[1], landed[2]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, anySpinning]);

  const prefix = m.prefix;
  const conn = m.connector;
  const liveVerb = landed[0] ? landed[0].toLowerCase() : '';

  return (
    <div className="sm-root">
      <div className="sm-cabinet">
        <div className="sm-topbar">
          <div className="sm-modebar">
            {Object.keys(CLIENT_DEFAULT_MODE_CONFIGS).map(k => (
              <button key={k} className={`sm-modebtn${mode===k?' on':''}`} onClick={()=>{ if (k !== mode) { setMode(k); setHasSpun(!!(landedByMode.current[k]?.every(Boolean))); onModeChange?.(k); } }} disabled={anySpinning}>
                {CLIENT_DEFAULT_MODE_CONFIGS[k].name}
              </button>
            ))}
          </div>
        </div>

        <div className="sm-reels-wrap">
          <div className="sm-payline-bar" aria-hidden="true" />
          <div className="sm-reels">
            {banks.map((bank,w) => {
              const repeated = Array.from({length:REPEATS},()=>bank).flat();
              return (
                <div className="sm-col" key={mode+w} style={{'--accent':REEL_TINTS[w]}}>
                  <div className="sm-window">
                    <div className={`sm-strip${spinning[w]?' is-spinning':''}`} ref={stripRefs[w]} onTransitionEnd={()=>onSettle(w)} >
                      {repeated.map((word,i)=>(
                        <div className="sm-item" key={i} style={{height:ITEM_H}}>{word}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* frosted haze: off-payline words blur out of focus, the centered row stays crisp */}
          <div className="sm-reel-haze sm-reel-haze--top" aria-hidden="true" />
          <div className="sm-reel-haze sm-reel-haze--bottom" aria-hidden="true" />
          {/* Before the first spin, cover the reels so no words are pre-populated,
              and show a clear call-to-action banner across the generator. */}
          {!hasSpun && (
            <div className="sm-reel-cover" onClick={()=>!anySpinning&&spinAll()}>
              <span className="sm-reel-cover-title">Click “Generate idea” to start</span>
              <span className="sm-reel-cover-sub">Spin the reels for a fresh startup idea</span>
            </div>
          )}
        </div>

        <div className="sm-base">
          <button className="sm-spin" onClick={spinAll} disabled={anySpinning}>
            <span>{anySpinning ? 'Spinning…' : 'Generate idea'}</span>
          </button>
        </div>
      </div>

      <div className="sm-live-sentence">
        <p>
          <span style={{fontStyle:'italic',color:'var(--muted)'}}>{prefix} </span>
          {landed[0] ? <span className="sm-slot">{liveVerb}</span> : <span className="sm-slot-empty"/>}
          {' '}
          {landed[1] ? <span className="sm-slot">{landed[1]}</span> : <span className="sm-slot-empty"/>}
          {' '}<span style={{fontStyle:'italic',color:'var(--muted)'}}>{conn}</span>{' '}
          {landed[2] ? <span className="sm-slot">{landed[2]}</span> : <span className="sm-slot-empty"/>}
          {mode === 'b2b' ? <span style={{fontStyle:'italic',color:'var(--muted)'}}> industry</span> : null}
          <span style={{color:'var(--magenta)'}}>.</span>
        </p>
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────── */

export default function IdeaWheel() {
  const [screen, setScreen] = useState("wheel");  // landing | wheel | validate | blueprint
  const [authChecked, setAuthChecked] = useState(false);
  const [idea, setIdea]     = useState(null);
  const ideaByMode = useRef({});   // persist idea per mode so switching back restores it
  const currentModeRef = useRef('b2b');
  const [credits, setCredits] = useState(3);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser]       = useState(null);   // logged-in user
  const [hasAccount, setHasAccount]   = useState(false);  // ever signed up

  // validate state
  const [validating, setValidating] = useState(false);
  const [scanPct, setScanPct]       = useState(0);
  const [scanSteps, setScanSteps]   = useState([]);   // live "research log" streamed from the pipeline
  const scanTimerRef = useRef(null);
  const [comp, setComp]             = useState(null);
  const [validateErr, setValidateErr] = useState("");
  const [sessionId, setSessionId] = useState("");
  // deep market research (paid 1-credit add-on)
  const [deepResearch, setDeepResearch] = useState(null);
  const [deepLoading, setDeepLoading]   = useState(false);
  const [deepErr, setDeepErr]           = useState("");
  const [deepPct, setDeepPct]           = useState(0);
  const deepTimerRef = useRef(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiBurstId, setConfettiBurstId] = useState(0);

  // blueprint state  — pipeline stages: null | 1-4 | "done"
  const [bpStage, setBpStage]   = useState(null);
  const [bpPct, setBpPct]       = useState(0);   // smooth, creeping progress %
  const [design, setDesign]     = useState(null);
  const [gtm, setGtm]           = useState(null);
  const [infra, setInfra]       = useState(null);
  const [proto, setProto]       = useState(null);
  const [bpErr, setBpErr]       = useState("");
  const [bpChargeToken, setBpChargeToken] = useState("");  // server charge token, reused across resume so the credit is taken once
  const [protoOpen, setProtoOpen] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);  // a profile "Create blueprint" deep-link is loaded and should auto-generate
  const [pendingResume, setPendingResume]     = useState(false);  // an in-progress blueprint was loaded and should resume where it left off
  const loadedIdeaRef = useRef(false);

  // pricing
  const [showPricing, setShowPricing]     = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [checkoutErr, setCheckoutErr]     = useState("");

  useEffect(() => {
    setMounted(true);
    try {
      const stored = Number(localStorage.getItem("ideaWheelCredits") || "3");
      if (Number.isFinite(stored) && stored >= 0) setCredits(stored);
      if (localStorage.getItem("ideaWheelHasAccount") === "1") setHasAccount(true);
    } catch {}
    const params = new URLSearchParams(window.location.search);
    const isLocalPreview = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    if (isLocalPreview && params.get('preview') === 'wheel') {
      setScreen('wheel');
    }

    // check Supabase session — gate wheel behind auth
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setAuthUser(data.session.user);
        try { localStorage.setItem("ideaWheelHasAccount", "1"); } catch {}
        setHasAccount(true);
        // Only auto-navigate to wheel if coming from auth callback (?wheel=1)
        if (params.get('wheel') === '1') {
          setScreen("wheel");
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        try { localStorage.setItem("ideaWheelHasAccount", "1"); } catch {}
        setHasAccount(true);
      } else {
        setAuthUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => () => { clearInterval(scanTimerRef.current); clearInterval(deepTimerRef.current); }, []);

  // Deep link from the profile: ?idea=<id> opens a saved idea here. With &view=1
  // we load its existing blueprint; otherwise we jump to the blueprint screen and
  // generate one (charging 2 credits via the normal flow).
  useEffect(() => {
    if (!authChecked || !authUser || loadedIdeaRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const savedId = params.get('idea');
    if (!savedId) return;
    loadedIdeaRef.current = true;
    (async () => {
      try {
        const r = await fetch(`/api/ideas/${savedId}`);
        if (!r.ok) return;
        const { idea: saved } = await r.json();
        if (!saved) return;
        setIdea({
          action: saved.action, workflow: saved.workflow, industry: saved.industry,
          connector: saved.connector, label: saved.mode_name, modeName: saved.mode_name,
          title: saved.title, tagline: saved.tagline, blurb: saved.summary || saved.tagline,
        });
        if (saved.comp) setComp(saved.comp);
        if (saved.session_id) setSessionId(saved.session_id);
        if (saved.research) setDeepResearch(saved.research);

        const bp = saved.blueprint;
        const status = saved.blueprint_status;
        if (status === 'complete' && bp) {
          // Finished blueprint — just show it.
          setDesign(bp.design || null);
          setGtm(bp.gtm || null);
          setInfra(bp.infra || null);
          setProto(bp.prototypeHtml || null);
          setBpStage('done');
        } else if (status === 'generating' && bp?.design) {
          // In-progress blueprint — load whatever already finished and resume
          // the remaining stages, reusing the saved charge token (no re-charge).
          setDesign(bp.design || null);
          setGtm(bp.gtm || null);
          setInfra(bp.infra || null);
          setProto(bp.prototypeHtml || null);
          if (bp.chargeToken) setBpChargeToken(bp.chargeToken);
          setPendingResume(true);
        } else {
          setPendingGenerate(true);   // generate once idea + comp are in state
        }
        goTo('blueprint');
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    })();
  }, [authChecked, authUser]);

  // For signed-in users the Supabase balance is the source of truth: credits
  // are added on purchase (Stripe webhook) and subtracted on blueprint spend.
  const refreshBalance = useCallback(async () => {
    if (!authUser) return;
    try {
      const r = await fetch('/api/credits/balance');
      const d = await r.json();
      if (typeof d?.balance === 'number') setCredits(d.balance);
    } catch {}
  }, [authUser]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem("ideaWheelCredits", String(credits)); } catch {}
  }, [credits, mounted]);

  const goTo = (s) => { setScreen(s); window.scrollTo({ top:0, behavior:"smooth" }); };
  const m_prefix = (idea) => idea?.modeName === 'B2B' ? 'I want to build an agent that' : 'I want to make an app that';
  const ideaSummary = (currentIdea) => {
    if (!currentIdea) return '';
    if (currentIdea.freeformIdea) {
      return `${m_prefix(currentIdea)} ${currentIdea.freeformIdea}. ${currentIdea.tagline || ''} ${currentIdea.blurb || ''}`.trim();
    }
    return `${currentIdea.title}: ${currentIdea.tagline} ${currentIdea.blurb}`;
  };

  const handleSpin = (segment) => {
    ideaByMode.current[currentModeRef.current] = segment;
    setIdea(segment);
    setSessionId("");
    setComp(null); setValidateErr("");
    setDesign(null); setGtm(null); setInfra(null); setProto(null);
    setBpStage(null); setBpErr("");
    goTo("wheel");
  };

  const handleModeChange = (newMode) => {
    currentModeRef.current = newMode;
    const saved = ideaByMode.current[newMode] || null;
    setIdea(saved);
    // reset validate/blueprint state — it belongs to the previous mode's idea
    setSessionId(""); setComp(null); setValidateErr("");
    setDesign(null); setGtm(null); setInfra(null); setProto(null);
    setBpStage(null); setBpErr("");
    setDeepResearch(null); setDeepErr("");
  };

  const trackOutcome = async (signal, payload = {}, explicitSessionId = sessionId) => {
    if (!signal || !idea) return;
    try {
      const res = await fetch('/api/pipeline/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal,
          sessionId: explicitSessionId || undefined,
          modeName: idea.label,
          action: idea.action,
          workflow: idea.workflow,
          industry: idea.industry,
          payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.sessionId && !sessionId) setSessionId(data.sessionId);
    } catch {}
  };

  useEffect(() => {
    if ((comp?.score ?? 0) <= 80) {
      setShowConfetti(false);
      return undefined;
    }

    setConfettiBurstId((value) => value + 1);
    setShowConfetti(true);
    const timeout = setTimeout(() => setShowConfetti(false), 2600);
    return () => clearTimeout(timeout);
  }, [comp?.validationId, comp?.score]);

  /* ── FREE VALIDATE ── */
  // Per-stage progress targets so the bar steps forward on every streamed event
  // (real signals from the pipeline, not a simulated timer).
  const STAGE_START = { retrieval: 6, scout: 16, skeptic: 58, judge: 74, eval: 90 };
  const STAGE_DONE  = { retrieval: 14, scout: 55, skeptic: 72, judge: 88, eval: 97 };

  // Merge a streamed stage event into the live research log. One line per stage
  // key, transitioning active → done; any still-active earlier line is marked
  // done once a later stage starts.
  const pushStage = (ev) => {
    setScanSteps((prev) => {
      const next = prev.map((s) => (s.status === 'active' && s.key !== ev.key ? { ...s, status: 'done' } : s));
      const idx = next.findIndex((s) => s.key === ev.key);
      const done = ev.status === 'done';
      const entry = {
        key: ev.key,
        label: ev.label || (idx >= 0 ? next[idx].label : ''),
        status: done ? 'done' : 'active',
        items: ev.items || (idx >= 0 ? next[idx].items : undefined),
      };
      if (idx >= 0) next[idx] = entry; else next.push(entry);
      return next;
    });
  };

  const runValidate = async () => {
    if (!idea) return;
    setValidating(true); setComp(null); setValidateErr(""); setScanPct(0); setScanSteps([]);
    setDeepResearch(null); setDeepErr(""); setDeepLoading(false);   // fresh scan clears any prior deep research
    try {
      const res = await fetch("/api/pipeline/validate", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          action: idea.action,
          workflow: idea.workflow,
          industry: idea.industry,
          connector: idea.connector,
          freeformIdea: ideaSummary(idea),
          modeName: idea.label,
          sessionId,
        }),
      });

      const ctype = res.headers.get('content-type') || '';
      // Fallback: if the response isn't streamed, parse it as plain JSON.
      if (!res.body || !ctype.includes('ndjson')) {
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.sessionId) setSessionId(data.sessionId);
        setScanPct(100);
        setComp(data.comp);
        void trackOutcome('market_scan_completed', {
          validationId: data.comp?.validationId, verdictType: data.comp?.verdictType,
          overallScore: data.comp?.eval?.scores?.overall || null,
        }, data.sessionId || sessionId);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let resultData = null;
      let streamErr = '';
      const handle = (ev) => {
        if (ev.t === 'stage') {
          pushStage(ev);
          const tbl = ev.status === 'done' ? STAGE_DONE : STAGE_START;
          setScanPct((p) => Math.max(p, tbl[ev.key] || p));
        } else if (ev.t === 'result') {
          resultData = ev;
        } else if (ev.t === 'error') {
          streamErr = ev.error || 'Market check failed.';
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) { try { handle(JSON.parse(line)); } catch {} }
        }
      }
      const tail = buf.trim();
      if (tail) { try { handle(JSON.parse(tail)); } catch {} }

      if (streamErr) throw new Error(streamErr);
      if (!resultData?.comp) throw new Error('Market check failed.');
      if (resultData.sessionId) setSessionId(resultData.sessionId);
      setScanPct(100);
      await new Promise(r => setTimeout(r, 400));   // let the log + bar finish
      setComp(resultData.comp);
      void trackOutcome('market_scan_completed', {
        validationId: resultData.comp?.validationId,
        verdictType: resultData.comp?.verdictType,
        overallScore: resultData.comp?.eval?.scores?.overall || null,
      }, resultData.sessionId || sessionId);
    } catch(e) {
      setValidateErr(e.message.includes("AI_CREDITS") || e.message.includes("temporarily") ? "Our AI is taking a short break. Please try again in a minute." : "Market check failed. " + e.message);
    } finally {
      setValidating(false);
    }
  };

  /* ── PAID DEEP MARKET RESEARCH (1 credit) ── */
  // Charged server-side only on success, so a failed run costs nothing.
  const runDeepResearch = async () => {
    if (!comp || deepLoading) return;
    setDeepErr(""); setDeepLoading(true); setDeepPct(0);
    const startedAt = Date.now();
    const estMs = 20000;
    clearInterval(deepTimerRef.current);
    deepTimerRef.current = setInterval(() => {
      const t = (Date.now() - startedAt) / estMs;
      setDeepPct(p => Math.min(92, Math.max(p, Math.round(92 * (1 - Math.exp(-2.2 * t))))));
    }, 180);
    try {
      const res = await fetch('/api/pipeline/deep-research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: idea.action, workflow: idea.workflow, industry: idea.industry,
          connector: idea.connector, modeName: idea.label, freeformIdea: ideaSummary(idea),
          comp, sessionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 402) {
        if (typeof data.balance === 'number') setCredits(data.balance);
        setShowPricing(true);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error || 'Extended research failed.');
      if (data.sessionId) setSessionId(data.sessionId);
      if (typeof data.balance === 'number') setCredits(data.balance);
      clearInterval(deepTimerRef.current);
      setDeepPct(100);
      await new Promise(r => setTimeout(r, 300));
      setDeepResearch(data.research);
    } catch(e) {
      setDeepErr(e.message.includes("AI_CREDITS") || e.message.includes("temporarily") ? "Our AI is taking a short break. Please try again in a minute." : "Extended research failed. " + e.message);
    } finally {
      clearInterval(deepTimerRef.current);
      setDeepLoading(false);
    }
  };

  /* ── PAID BLUEPRINT ── */
  // The build route charges server-side on the first (designer) stage and hands
  // back a chargeToken; every later stage reuses that token, so the credit is
  // taken exactly once. `resume` picks up from the first incomplete stage with
  // the same token, so a mid-pipeline failure never costs a second credit.
  const runBlueprint = async ({ resume = false } = {}) => {
    if (!comp) return;
    const cost = BLUEPRINT_COST;

    if (!resume) {
      if (credits < cost) { setShowPricing(true); return; }   // fast client gate; the server is the source of truth
      void trackOutcome('blueprint_started', {
        validationId: comp.validationId,
        verdictType: comp.verdictType,
        overallScore: comp?.eval?.scores?.overall || null,
      }, sessionId);
      setDesign(null); setGtm(null); setInfra(null); setProto(null); setProtoOpen(false);
      setBpChargeToken("");
    }
    setBpErr("");

    const base = {
      action: idea.action,
      workflow: idea.workflow,
      industry: idea.industry,
      connector: idea.connector,
      freeformIdea: ideaSummary(idea),
      modeName: idea.label,
      sessionId,
      validationId: comp.validationId,
      comp,
      creditCost: cost,
    };
    const api = (body) => fetch("/api/pipeline/build", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
    }).then(r => r.json());

    try {
      let d = resume ? design : null;
      let g = resume ? gtm   : null;
      let inf = resume ? infra : null;
      let pr = resume ? proto : null;
      let chargeToken = bpChargeToken || "";

      // Stage 1 – designer (server charges the credit here and returns the token)
      if (!d) {
        setBpStage(1);
        const r = await api({ ...base, stage:"designer" });
        if (r.error) { if (/not enough credits/i.test(r.error)) setShowPricing(true); throw new Error(r.error); }
        chargeToken = r.chargeToken || "";
        setBpChargeToken(chargeToken);
        if (typeof r.balance === 'number') setCredits(r.balance);
        d = r.result; setDesign(d);
      }
      // Stage 2 – launch
      setBpStage(2);
      if (!g) {
        const r = await api({ ...base, stage:"launch", design: d, chargeToken });
        if (r.error) throw new Error(r.error);
        g = r.result; setGtm(g);
      }
      // Stage 3 – infrastructure
      setBpStage(3);
      if (!inf) {
        const r = await api({ ...base, stage:"infrastructure", design: d, gtm: g, chargeToken });
        if (r.error) throw new Error(r.error);
        inf = r.result; setInfra(inf);
      }
      // Stage 4 – prototype
      setBpStage(4);
      if (!pr) {
        const r = await api({ ...base, stage:"builder", design: d, gtm: g, infra: inf, chargeToken });
        if (r.error) throw new Error(r.error);
        pr = r.result; setProto(pr);
      }
      setBpStage("done");
    } catch(e) {
      // No refund and no reset — the user can resume from here for free (the token is preserved).
      setBpErr(e.message);
    }
  };

  /* ── STRIPE CHECKOUT ── */
  const startCheckout = async (pkg) => {
    setCheckoutErr(""); setCheckoutLoading(pkg.key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.url) throw new Error(data.error || "Unable to start checkout");
      window.location.assign(data.url);
    } catch(e) {
      setCheckoutErr(e.message); setCheckoutLoading("");
    }
  };

  const bpRunning = bpStage !== null && bpStage !== "done";
  const bpDone    = bpStage === "done";

  // Fire the deferred blueprint generation from a profile deep-link, once the
  // idea + comp it loaded are in state (so runBlueprint sees them).
  useEffect(() => {
    if (pendingGenerate && screen === 'blueprint' && idea && comp && !bpRunning && !bpDone) {
      setPendingGenerate(false);
      runBlueprint();
    }
  }, [pendingGenerate, screen, idea, comp, bpRunning, bpDone]);

  // Resume an in-progress blueprint loaded from the profile: the finished stages
  // are already in state, so continue from the first missing one without a new
  // charge (runBlueprint with resume:true reuses the saved charge token).
  useEffect(() => {
    if (pendingResume && screen === 'blueprint' && idea && comp && !bpRunning && !bpDone) {
      setPendingResume(false);
      runBlueprint({ resume: true });
    }
  }, [pendingResume, screen, idea, comp, bpRunning, bpDone]);

  // Smoothly creep the blueprint progress bar WITHIN the running stage, instead
  // of jumping only when a whole stage finishes (which left it stuck at ~13%
  // for the entire, slow first stage). Each of the 4 stages owns a 25% band; we
  // ease toward the top of the current band while it runs, then continue from
  // the next band as stages complete.
  const bpCompletedCount = [design, gtm, infra, proto].filter(Boolean).length;
  useEffect(() => {
    if (bpDone) { setBpPct(100); return; }
    if (!bpRunning) { setBpPct(0); return; }
    if (bpErr) return;                       // frozen while paused on an error
    const floor = (bpCompletedCount / 4) * 100;
    const ceiling = ((bpCompletedCount + 1) / 4) * 100 - 3;
    setBpPct(p => Math.max(p, Math.round(floor) + 1));
    const startedAt = Date.now();
    const estMs = bpCompletedCount === 0 ? 40000 : 24000;   // stage 1 (designer) is the slowest
    const id = setInterval(() => {
      const t = (Date.now() - startedAt) / estMs;
      const target = floor + (ceiling - floor) * (1 - Math.exp(-2.2 * t));
      setBpPct(p => Math.min(ceiling, Math.max(p, Math.round(target))));
    }, 220);
    return () => clearInterval(id);
  }, [bpRunning, bpDone, bpErr, bpCompletedCount]);

  /* Scoped utilitarian proof: only the landing screen gets the new product-tool
     language. Toggling a body class lets the scoped CSS suppress the global
     cloud-blob background for landing without touching other screens. */
  useEffect(() => {
    const onLanding = screen === "landing";
    document.body.classList.toggle("util-landing", onLanding);
    return () => document.body.classList.remove("util-landing");
  }, [screen]);

  /* ── SCREENS ── */
  return (
    <div className={`su-root${screen === "landing" ? " su-root--util" : ""}`}>
      {mounted && <style>{CSS}</style>}

      {/* ── LANDING ── */}
      {screen === "landing" && (
        <section className="su-screen su-landing">
          <div className="su-landing-inner">

            <div className="su-util-eyebrow">Idea validation engine</div>
            <h1 className="su-display su-landing-h1">
              <span style={{ display:"block" }}>Find a startup idea</span>
              <span className="su-grad-text" style={{ display:"block" }}>worth building.</span>
            </h1>
            <p className="su-landing-sub">
              Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.
            </p>

            <div className="su-landing-cta">
              <div className="su-landing-cta-row">
                <button className="su-btn su-btn-primary su-btn-lg" onClick={() => authUser ? goTo("wheel") : window.location.assign("/profile")}>
                  Get started
                </button>
                <button className="su-btn su-btn-ghost su-btn-lg" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior:"smooth", block:"start" })}>
                  See how it works
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="su-hiw" id="how-it-works">
              <div className="su-hiw-label">How it works</div>
              <div className="su-hiw-steps">
                <div className="su-hiw-step">
                  <div className="su-hiw-num">1</div>
                  <div>
                    <div className="su-hiw-t">Generate a business idea worth chasing</div>
                    <div className="su-hiw-d">Combine proven actions, real workflows, and target industries to uncover concrete startup concepts, not vague inspiration.</div>
                  </div>
                </div>
                <div className="su-hiw-connector" aria-hidden />
                <div className="su-hiw-step">
                  <div className="su-hiw-num">2</div>
                  <div>
                    <div className="su-hiw-t">Know if it's worth building before you commit</div>
                    <div className="su-hiw-d">Every idea gets a market check with competitor analysis, market size, and demand signals, so you get a clear build, caution, or avoid verdict before you sink time into it.</div>
                  </div>
                </div>
                <div className="su-hiw-connector" aria-hidden />
                <div className="su-hiw-step">
                  <div className="su-hiw-num">3</div>
                  <div>
                    <div className="su-hiw-t">Turn the winner into a build-ready plan</div>
                    <div className="su-hiw-d">Extended market research costs 1 credit and the full blueprint costs 2 — and every new account starts with 3 free credits. Each blueprint unlocks four AI specialists across product design, launch strategy, infrastructure, and prototype generation.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* steps — above teaser */}
            {/* reviews */}
            <div className="su-reviews">
              <div className="su-reviews-label">What founders are saying</div>
              <div className="su-reviews-grid">
                {[
                  { name:"Sarah K.", role:"Founder, SaaS", text:"I spun 12 ideas in 20 minutes. The market check killed 9 of them before I wasted a single hour. That's the point.", stars:5 },
                  { name:"Marcus L.", role:"Operator", text:"The infrastructure breakdown alone saved me 3 hours of research. Every service I needed, with setup steps and cost estimates.", stars:5 },
                  { name:"Priya M.", role:"Product Manager", text:"I was skeptical about AI ideation tools. This one validates before it builds. That's the difference. The avoid verdict on my first idea was genuinely useful.", stars:5 },
                ].map((r,i) => (
                  <div className="su-review-card" key={i}>
                    <div className="su-review-stars">{"★".repeat(r.stars)}</div>
                    <p className="su-review-text">"{r.text}"</p>
                    <div className="su-review-author">
                      <div className="su-review-avatar">{r.name[0]}</div>
                      <div>
                        <div className="su-review-name">{r.name}</div>
                        <div className="su-review-role">{r.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>



          </div>
        </section>
      )}

      {/* ── WHEEL (slot machine reels) ── */}
      {screen === "wheel" && (
        <section className="su-screen su-wheel-screen">
          <div className="su-eyebrow su-step-eyebrow">Step 1 · Generate idea</div>
          <SlotMachine onResult={handleSpin} onModeChange={handleModeChange}/>
          {/* Validate button + inline results */}
          {idea && (
            <div className="sm-validate-section">
              <div className="su-eyebrow su-step-eyebrow su-step-eyebrow--mt">Step 2 · Free basic market research</div>
              {showConfetti && <ValidationConfetti key={confettiBurstId} />}
              {!comp && !validating && !validateErr && (
                <div className="sm-result-cta">
                  <button className="su-btn su-btn-primary su-btn-lg" onClick={runValidate}>
                    Run free basic market research
                  </button>
                </div>
              )}

              {validating && (
                <div className="su-scan su-glass su-research" style={{marginTop:24}}>
                  <div className="su-scan-head">
                    <span className="su-scan-text">Researching your idea — live</span>
                    <span className="su-scan-pct">{scanPct}%</span>
                  </div>
                  <div className="su-scan-bar su-scan-bar--progress">
                    <div className="su-scan-fill su-scan-fill--progress" style={{width:`${scanPct}%`}}/>
                  </div>
                  <ul className="su-research-log">
                    {scanSteps.map((s) => (
                      <li key={s.key} className={`su-research-step su-research-step--${s.status}`}>
                        <span className="su-research-ico" aria-hidden="true">
                          {s.status === 'done' ? '✓' : <span className="su-research-spin" />}
                        </span>
                        <span className="su-research-body">
                          <span className="su-research-line">{s.label}</span>
                          {s.items?.length > 0 && (
                            <span className="su-research-chips">
                              {s.items.map((it, i) => <span className="su-research-chip" key={i}>{it}</span>)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validateErr && (
                <p className="su-err" style={{marginTop:16}}>
                  {validateErr} <button className="su-retry" onClick={runValidate}>Retry</button>
                </p>
              )}

              {comp && !validating && (() => {
                const score = comp.score ?? 0;
                const potential = score >= 61;                 // gates gap, key players, blueprint-forward CTA
                const advice = score >= 80
                  ? { label: "Get that Blueprint!", tone: "good" }
                  : score >= 61
                    ? { label: "This idea has potential", tone: "warn" }
                    : { label: "Don't waste your time", tone: "bad" };
                const premise = cleanValidationText(comp.premiseNote || "");
                const verdictLines = splitValidationBullets(comp.verdictReasoning || comp.verdict, 3);
                // Funnel: 61-79 → deep research first (1cr); 80+ → blueprint (2cr) with research optional.
                const deepPrimary = potential && !deepResearch && score < 80;
                const goBlueprint = () => { goTo("blueprint"); if (!bpDone && !bpRunning) runBlueprint(); };
                return (
                <div className="su-validate-grid" style={{marginTop:24}}>
                  {/* 0 — Plain-English lead: the whole market read in one digestible bite */}
                  {comp.plainSummary && (
                    <div className="su-card su-v-plainlead">
                      <PlainEnglish summary={comp.plainSummary} />
                    </div>
                  )}

                  {/* 1 — Quick take */}
                  <div className="su-card su-v-score">
                    <ScoreRing value={score} label="Score"/>
                    <div className="su-v-score-side">
                      <span className={`su-chip su-chip--${advice.tone}`}>{advice.label}</span>
                      <div className="su-v-minihead">Quick take</div>
                      <ul className="su-v-bullets su-v-bullets--compact">
                        {splitValidationBullets(comp.verdict || comp.verdictReasoning, 3).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 2 — Market */}
                  <div className="su-card su-v-market">
                    <div className="su-v-market-cell">
                      <div className="su-v-l">Market</div>
                      <ul className="su-v-bullets">
                        {splitValidationBullets(comp.landscape || comp.marketSize, 3).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {potential && cleanValidationText(comp.gap) && (
                      <div className="su-v-gap">
                        <div className="su-v-gap-label">The gap</div>
                        <ul className="su-v-bullets su-v-bullets--gap">
                          {splitValidationBullets(comp.gap, 2).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 3 — Key players (only when the idea has potential), sorted largest → smallest */}
                  {potential && (comp.players||[]).length > 0 && (
                    <div className="su-card su-v-signals">
                      <div className="su-v-signals-head">Key players</div>
                      {(comp.players||[]).slice(0,3).map((pl,i) => (
                        <div className="su-v-signal" key={i}>
                          <div className="su-v-signal-top">
                            <span>{pl.name}</span>
                          </div>
                          <ul className="su-v-bullets su-v-bullets--player">
                            <li>{briefPlayerWeakness(pl.coverage || pl.weakness)}</li>
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extended market research findings (paid add-on, once run) */}
                  {deepResearch && (
                    <div className="su-card su-v-deep">
                      <div className="su-v-signals-head">
                        Extended market research
                        {deepResearch.demandLevel && <span className={`su-deep-tag su-deep-tag--${/strong/i.test(deepResearch.demandLevel)?'good':/weak/i.test(deepResearch.demandLevel)?'bad':'warn'}`}>{deepResearch.demandLevel} demand</span>}
                      </div>
                      {(deepResearch.plainSummary || (deepResearch.takeaways||[]).length > 0) && (
                        <PlainEnglish summary={deepResearch.plainSummary} takeaways={deepResearch.takeaways} compact />
                      )}
                      {(deepResearch.demandSignals||[]).length > 0 && (
                        <ul className="su-v-bullets">{deepResearch.demandSignals.slice(0,5).map((s,i)=><li key={i}>{cleanValidationText(s)}</li>)}</ul>
                      )}
                      {(deepResearch.voiceOfCustomer||[]).length > 0 && (
                        <div className="su-v-deep-quotes">
                          {deepResearch.voiceOfCustomer.slice(0,3).map((q,i)=><blockquote key={i} className="su-v-deep-quote">“{cleanValidationText(q)}”</blockquote>)}
                        </div>
                      )}
                      {(deepResearch.communities||[]).length > 0 && (
                        <div className="su-v-deep-row"><span className="su-v-l">Where they gather</span> <span className="su-v-deep-communities">{deepResearch.communities.slice(0,5).map(c=>cleanValidationText(c)).join(' · ')}</span></div>
                      )}
                      {deepResearch.willingnessToPay && <div className="su-v-deep-row"><span className="su-v-l">Willingness to pay</span> <span>{cleanValidationText(deepResearch.willingnessToPay)}</span></div>}
                      {deepResearch.wedge && <div className="su-v-deep-row"><span className="su-v-l">Sharpest wedge</span> <span>{cleanValidationText(deepResearch.wedge)}</span></div>}
                    </div>
                  )}

                  {/* 4 — Final verdict + funnel CTA */}
                  <div className={`su-v-cta${potential ? "" : " su-v-cta--avoid"}`}>
                    <div className="su-v-l su-v-verdict-label">Final verdict</div>
                    {premise && <p className="su-v-premise">{premise}</p>}
                    <div className="su-v-cta-text">
                      {(deepResearch?.verdict && cleanValidationText(deepResearch.verdict)) || verdictLines[0] || (potential ? "There's a real opening here." : "The signal isn't strong enough yet.")}
                    </div>
                    {!deepResearch && verdictLines.length > 1 && (
                      <ul className="su-v-bullets su-v-bullets--compact su-v-verdict-rationale">
                        {verdictLines.slice(1).map((item, i) => (<li key={i}>{item}</li>))}
                      </ul>
                    )}

                    {deepLoading && (
                      <div className="su-scan su-glass su-v-deep-progress">
                        <div className="su-scan-head">
                          <span className="su-scan-text">Digging through Reddit, forums &amp; communities…</span>
                          <span className="su-scan-pct">{deepPct}%</span>
                        </div>
                        <div className="su-scan-bar su-scan-bar--progress"><div className="su-scan-fill su-scan-fill--progress" style={{width:`${deepPct}%`}}/></div>
                      </div>
                    )}
                    {deepErr && <p className="su-err">{deepErr} <button className="su-retry" onClick={runDeepResearch}>Retry</button></p>}

                    {!deepLoading && (potential ? (
                      <>
                        <div className="su-v-cta-row">
                          {deepPrimary ? (
                            <button className="su-btn su-btn-primary su-btn-lg" onClick={runDeepResearch}>
                              Run extended market research
                              <span className="su-credit-badge">{DEEP_RESEARCH_COST} credit</span>
                            </button>
                          ) : (
                            <button className="su-btn su-btn-primary su-btn-lg" onClick={goBlueprint}>
                              Build the blueprint
                              <span className="su-credit-badge">{BLUEPRINT_COST} credits</span>
                            </button>
                          )}
                          <button className="su-creditpill" onClick={() => setShowPricing(true)}>
                            <span className="su-creditnum">{credits}</span>
                            <span className="su-creditlbl">credits</span>
                          </button>
                        </div>
                        {deepPrimary && (
                          <button className="su-linkbtn" onClick={goBlueprint}>Skip ahead — build the blueprint now · {BLUEPRINT_COST} credits</button>
                        )}
                        {!deepResearch && !deepPrimary && (
                          <button className="su-linkbtn" onClick={runDeepResearch}>First, dig into real demand · {DEEP_RESEARCH_COST} credit</button>
                        )}
                        <div className="su-v-hint">Research {DEEP_RESEARCH_COST} credit · blueprint {BLUEPRINT_COST} credits · you have {credits}</div>
                      </>
                    ) : (
                      <div className="su-v-cta-row">
                        <button className="su-btn su-btn-primary su-btn-lg" onClick={() => { setComp(null); setIdea(null); }}>Spin again</button>
                        <button className="su-linkbtn" onClick={goBlueprint}>Build it anyway · {BLUEPRINT_COST} credits</button>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>
          )}
        </section>
      )}

      {/* ── BLUEPRINT ── */}
      {screen === "blueprint" && idea && (
        <section className="su-screen su-blueprint">
          <div className="su-screen-head">
            <div className="su-eyebrow">Step 4 · The plan</div>
            <h2 className="su-display su-screen-title">
              The <span className="su-grad-text">{idea.title}</span> blueprint
            </h2>
            <p className="su-screen-desc">{idea.blurb}</p>
          </div>

          {/* Pipeline progress — a visible bar + per-stage status so the user
              always knows what's happening, and can resume if a stage fails. */}
          {(bpRunning || bpDone || bpErr) && (() => {
            const stages = [
              { label:"Product",   doing:"Designing the product and MVP scope" },
              { label:"Launch",    doing:"Writing the launch and first-customer plan" },
              { label:"Infra",     doing:"Mapping the infrastructure and services" },
              { label:"Prototype", doing:"Building the clickable prototype" },
            ];
            const completed = [design, gtm, infra, proto].filter(Boolean).length;
            const paused = !!bpErr && !bpDone;
            const activeIdx = Math.min(completed, 3);
            const pct = bpDone ? 100 : Math.max(bpPct, Math.round((completed / 4) * 100) + 1);
            return (
              <div className="su-scan su-glass su-bp-progress">
                <div className="su-scan-head">
                  <span className="su-scan-text">
                    {bpDone ? "Blueprint complete" : paused ? "Paused — resume to finish" : `Step ${activeIdx + 1} of 4 · ${stages[activeIdx].doing}…`}
                  </span>
                  <span className="su-scan-pct">{pct}%</span>
                </div>
                <div className="su-scan-bar su-scan-bar--progress">
                  <div className="su-scan-fill su-scan-fill--progress" style={{ width:`${pct}%` }}/>
                </div>
                <div className="su-pip-progress su-pip-progress--compact">
                  {stages.map((s, i) => {
                    const done = bpDone || i < completed;
                    const running = !bpDone && !paused && i === completed;
                    const errored = paused && i === completed;
                    return (
                      <div key={i} className={`su-pip-step ${done?"done":""} ${running?"running":""} ${errored?"errored":""}`}>
                        <div className="su-pip-dot">{done?"✓":errored?"!":running?<span className="su-spin-sm"/>:i+1}</div>
                        <span className="su-pip-label">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {bpErr && (
            <p className="su-err">
              {bpErr} <button className="su-retry" onClick={() => runBlueprint({ resume: true })}>Resume</button>
            </p>
          )}

          {(design || gtm || infra || proto) && (
            <div className="su-bp-grid">
              {/* Product */}
              {/* 1. Niche + Problem */}
              {design && (
                <div className="su-card su-bp-card su-bp-card--full">
                  <div className="su-bp-head"><span className="su-bp-num">01</span><h3 className="su-bp-title">Niche & Problem</h3></div>
                  {(design.plainSummary || (design.takeaways||[]).length > 0) && (
                    <PlainEnglish summary={design.plainSummary} takeaways={design.takeaways} compact />
                  )}
                  <p className="su-bp-summary" style={{fontSize:14,color:'var(--ink)'}}>{design.niche}</p>
                </div>
              )}

              {/* 2. Product Concept */}
              {design && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-num">02</span><h3 className="su-bp-title">Product concept</h3></div>
                  <p className="su-bp-name">{design.name}</p>
                  <p className="su-bp-summary">{design.tagline}</p>
                  <p className="su-bp-summary">{design.differentiator}</p>
                  <div className="su-bp-list-label">MVP scope</div>
                  <ul className="su-bp-list">{(design.coreFeatures||[]).map((f,i)=><li key={i}>{f}</li>)}</ul>
                </div>
              )}

              {/* 3. Target User + Why Now */}
              {gtm && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-num">03</span><h3 className="su-bp-title">Target user</h3></div>
                  {(gtm.plainSummary || (gtm.takeaways||[]).length > 0) && (
                    <PlainEnglish summary={gtm.plainSummary} takeaways={gtm.takeaways} compact />
                  )}
                  <p className="su-bp-summary" style={{fontSize:14,color:'var(--ink)',fontWeight:600}}>{gtm.persona}</p>
                  {gtm.whereToFind && <p className="su-bp-summary"><strong style={{fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)'}}>Where to find them: </strong>{gtm.whereToFind}</p>}
                  {gtm.whyNow && <>
                    <div className="su-bp-list-label" style={{marginTop:12}}>Why now</div>
                    <p className="su-bp-summary" style={{color:'var(--ink)'}}>{gtm.whyNow}</p>
                  </>}
                </div>
              )}

              {/* 4. Competitor / Gap Snapshot */}
              {comp && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-num">04</span><h3 className="su-bp-title">Competitor & gap</h3></div>
                  {comp.marketSize && <p className="su-bp-name" style={{fontSize:20}}>{cleanValidationText(comp.marketSize)}</p>}
                  {comp.gap && <p className="su-bp-summary" style={{color:'var(--ink)'}}>{cleanValidationText(comp.gap)}</p>}
                  {(comp.players||[]).length>0 && <>
                    <div className="su-bp-list-label">Key players</div>
                    <ul className="su-bp-list">{(comp.players||[]).slice(0,3).map((pl,i)=><li key={i}><strong>{cleanValidationText(pl.name)}</strong> — {cleanValidationText(pl.weakness)}</li>)}</ul>
                  </>}
                </div>
              )}

              {/* 5. Pricing */}
              {gtm?.pricing && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-num">05</span><h3 className="su-bp-title">Pricing idea</h3></div>
                  <div className="su-bp-pricebox">
                    <span>{gtm.pricing.price}</span>
                    <span>{gtm.pricing.rationale}</span>
                    {gtm.pricing.trial && <span style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>{gtm.pricing.trial}</span>}
                  </div>
                  <div className="su-bp-kpis" style={{marginTop:12}}>
                    <div className="su-bp-kpi"><span>{gtm.revenueGoal}</span><small>30-day target</small></div>
                    <div className="su-bp-kpi"><span>{gtm.buildTime}</span><small>to build V1</small></div>
                  </div>
                  {(gtm.firstFiveCustomers||[]).length>0 && <>
                    <div className="su-bp-list-label">First 5 customers</div>
                    <ol className="su-bp-list su-bp-list--ol">{(gtm.firstFiveCustomers||[]).map((c,i)=><li key={i}>{c}</li>)}</ol>
                  </>}
                </div>
              )}

              {/* 6. Landing Page Angle */}
              {design?.landingAngle && (
                <div className="su-card su-bp-card su-bp-card--full">
                  <div className="su-bp-head"><span className="su-bp-num">06</span><h3 className="su-bp-title">Landing page angle</h3></div>
                  <p className="su-bp-summary" style={{fontSize:15,color:'var(--ink)',fontStyle:'italic',lineHeight:1.7}}>"{design.landingAngle}"</p>
                </div>
              )}

              {/* 7. Infra */}
              {infra && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-num">07</span><h3 className="su-bp-title">Infrastructure</h3></div>
                  {(infra.plainSummary || (infra.takeaways||[]).length > 0) && (
                    <PlainEnglish summary={infra.plainSummary} takeaways={infra.takeaways} compact />
                  )}
                  {(infra.services||[]).length>0 && <>
                    <div className="su-bp-list-label">Services</div>
                    <div className="su-bp-chips">{(infra.services||[]).map((s,i)=><span className="su-chip" key={i}>{s.name}</span>)}</div>
                  </>}
                  {infra.buildOrder && <p className="su-bp-summary" style={{marginTop:10,color:'var(--ink)'}}>{infra.buildOrder}</p>}
                  {infra.monthlyCost && (
                    <div className="su-bp-costs">
                      {Object.entries(infra.monthlyCost).map(([k,v],i) => (
                        <div key={i} className="su-bp-cost-cell">
                          <span>{v}</span>
                          <small>{k==="dev"?"Dev":k==="at100users"?"100 users":"1K users"}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 8. First Cursor/Claude Prompt */}
              {gtm?.cursorPrompt && (
                <div className="su-card su-bp-card su-bp-card--full">
                  <div className="su-bp-head"><span className="su-bp-num">08</span><h3 className="su-bp-title">First prompt for Cursor / Claude / Codex</h3></div>
                  <pre className="su-bp-cursor-prompt">{gtm.cursorPrompt}</pre>
                </div>
              )}

              {/* Prototype */}
              {proto && (
                <div className="su-card su-bp-card su-bp-card--proto">
                  <div className="su-bp-head"><span className="su-bp-num">09</span><h3 className="su-bp-title">Prototype</h3></div>
                  <button className="su-proto-toggle" onClick={()=>setProtoOpen(v=>!v)}>
                    {protoOpen?"Hide":"Show"} live prototype
                  </button>
                  {protoOpen && (
                    <div className="su-proto-wrap">
                      <div className="su-proto-chrome">
                        <span/><span/><span/>
                        <div className="su-proto-url">{design?.name?.toLowerCase().replace(/\s+/g,"-")||"prototype"}.app</div>
                      </div>
                      <ProtoFrame html={proto}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {bpDone && (
            <div className="su-bp-footer">
              <div>
                <div className="su-display su-bp-footer-t">That's a company in three spins.</div>
                <div className="su-bp-footer-d">Not feeling it? Spin another idea and compare.</div>
              </div>
              <div className="su-bp-footer-actions">
                <button className="su-btn su-btn-ghost" onClick={() => { goTo("wheel"); setIdea(null); }}>Spin again</button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── PRICING MODAL ── */}
      {showPricing && (
        <div className="su-modal-overlay" onClick={() => setShowPricing(false)}>
          <div className="su-modal" onClick={e=>e.stopPropagation()}>
            <div className="su-modal-head">
              <span>Get credits</span>
              <button onClick={() => setShowPricing(false)}>✕</button>
            </div>
            <p className="su-modal-sub">Extended market research costs 1 credit; the full blueprint costs 2. New accounts start with 3 free credits.</p>
            {checkoutErr && <p className="su-err">{checkoutErr}</p>}
            <div className="su-pkgs">
              {CREDIT_PACKAGES.map(pkg => (
                <div key={pkg.key} className={`su-pkg${pkg.highlight?" su-pkg--hl":""}`}>
                  <span className="su-pkg-label">{pkg.label}</span>
                  <span className="su-pkg-credits">{pkg.credits} credits</span>
                  <span className="su-pkg-price">{pkg.price}</span>
                  <span className="su-pkg-per">{pkg.per}/credit</span>
                  <button className="su-pkg-btn" disabled={!!checkoutLoading} onClick={()=>startCheckout(pkg)}>
                    {checkoutLoading===pkg.key?"Redirecting…":"Checkout"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DISCLAIMER ── */}
      <footer className="su-disclaimer">
        <div className="su-disclaimer-links">
          <a href="/faq">FAQ</a>
          <a href="/pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
        <p>© {new Date().getFullYear()} IdeaReels · AI-generated content is for informational purposes only, not professional advice.</p>
      </footer>
    </div>
  );
}

const CHIP_POS = [
  {x:7,y:19},{x:80,y:13},{x:14,y:62},{x:86,y:56},
  {x:4,y:41},{x:90,y:35},{x:6,y:84},{x:89,y:82},
];

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
/* root — transparent so Popito background shows through */
.su-root { min-height:100vh; position:relative; background:transparent; }
.su-blob { display:none; } /* blobs removed — P2 fix */

/* nav */
.su-nav {
  position:relative; z-index:10;
  max-width:980px; margin:0 auto;
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 24px 0;
}
.su-nav-brand {
  display:flex; align-items:center; gap:8px;
  cursor:pointer; padding:0;
}
.su-brand-logo { display:block; flex-shrink:0; }
.su-brand-word {
  font-family:var(--font-display); font-size:18px; font-weight:800;
  letter-spacing:-.02em; line-height:1;
}
.su-brand-idea { color:var(--ink); }
.su-brand-reels {
  color:var(--ink);
}
.su-nav-links { display:flex; align-items:center; gap:4px; }
.su-nav-link {
  font-family:var(--font-display); font-size:14px; font-weight:700; letter-spacing:-.01em; color:var(--ink-2);
  text-decoration:none; padding:8px 14px; border-radius:var(--r-sm);
  border:1px solid transparent; transition:color .15s, background .15s, border-color .15s;
}
.su-nav-link:hover { color:var(--ink); background:var(--bg-2); }
.su-nav-link--cta {
  color:#fff; background:#111; border-color:transparent;
  padding:8px 18px; border-radius:var(--r-pill); margin-left:6px;
}
.su-nav-link--cta:hover { background:#333; color:#fff; transform:translateY(-1px); }

/* screens */
.su-screen {
  position:relative; z-index:1;
  max-width:980px; margin:0 auto;
  padding:34px 24px 64px;
}
.su-screen-head { text-align:center; margin-bottom:48px; }
.su-eyebrow {
  font-size:12px; font-weight:900; letter-spacing:.14em; text-transform:uppercase;
  color:#111; margin-bottom:14px;
}
.su-step-eyebrow { text-align:center; }
.su-step-eyebrow--mt { margin-top:36px; }
.su-display { font-family:var(--font-display); font-weight:700; letter-spacing:-.02em; line-height:1.05; }
.su-screen-title { font-size:clamp(30px,4vw,46px); color:var(--ink); margin:0 0 14px; }
.su-screen-desc { font-size:16px; color:var(--muted); margin:0; line-height:1.6; }
.su-grad-text {
  color:var(--ink);
}

/* landing */
.su-landing { min-height:auto; display:flex; align-items:center; justify-content:center; padding:26px 24px 20px; }
.su-landing-inner { text-align:center; max-width:760px; margin:0 auto; position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; }
.su-landing-h1 { font-size:clamp(44px,6.5vw,76px); padding-bottom:0; line-height:1.01; text-align:center; color:var(--ink); margin:0 0 14px; }
.su-landing-sub { font-size:17px; color:var(--muted); margin:0 auto 18px; line-height:1.6; max-width:620px; }
.su-landing-cta { display:flex; flex-direction:column; align-items:center; gap:12px; margin:18px 0 8px; }
.su-landing-cta-row { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; }

/* proof bar */
.su-proof-bar { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-bottom:28px; }
.su-proof-chip {
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 14px; border-radius:var(--r-pill);
  background:rgba(255,255,255,0.72); backdrop-filter:blur(8px);
  border:1px solid var(--line); font-size:12px; font-weight:600; color:var(--ink-2);
}

/* value grid */
.su-value-grid {
  display:grid; grid-template-columns:repeat(3,1fr); gap:14px;
  margin:36px 0 0; text-align:left;
}
@media(max-width:640px){ .su-value-grid { grid-template-columns:1fr; } }
.su-value-card {
  padding:20px;
}
.su-value-icon {
  width:40px; height:40px; border-radius:10px; margin-bottom:14px;
  display:flex; align-items:center; justify-content:center;
  background:#111;
  color:#fff;
  flex-shrink:0;
}
.su-value-t { font-weight:700; font-size:14px; color:var(--ink); margin-bottom:8px; line-height:1.3; }
.su-value-d { font-size:13px; color:var(--muted); line-height:1.6; }
.su-landing-steps { display:flex; gap:0; justify-content:center; flex-wrap:wrap; }
.su-landing-steps { display:flex; flex-direction:column; gap:0; margin-top:36px; max-width:560px; text-align:left; }
.su-land-step { display:flex; align-items:flex-start; gap:16px; padding:16px 0; border-top:1px solid var(--line); }
.su-land-step:last-child { border-bottom:1px solid var(--line); }
.su-land-step-n { font-family:var(--font-display); font-size:20px; font-weight:700; flex-shrink:0; padding-top:2px; }
.su-land-step-t { font-weight:700; font-size:14px; color:var(--ink); margin-bottom:4px; }
.su-land-step-d { font-size:13px; color:var(--muted); line-height:1.6; }

/* buttons */
.su-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-body); font-weight:600; font-size:14px;
  padding:11px 22px; border-radius:var(--r-pill); cursor:pointer;
  border:1px solid transparent; transition:background .15s, color .15s, border-color .15s, box-shadow .2s, transform .15s ease;
  text-decoration:none; line-height:1; letter-spacing:-.01em;
}
.su-btn-primary {
  background:#111; color:#fff;
}
.su-btn-primary:hover { background:#333; transform:translateY(-1px); }
.su-btn-primary:active { transform:translateY(0); }
.su-btn-ghost {
  background:var(--surface); color:var(--ink);
  border-color:var(--line-2);
}
.su-btn-ghost:hover { border-color:var(--ink-2); color:var(--ink); background:var(--bg-2); }
.su-btn-lg { font-size:15px; padding:14px 28px; }

/* chip */
.su-chip {
  display:inline-flex; align-items:center; gap:6px;
  padding:5px 12px; border-radius:var(--r-pill);
  font-size:12px; font-weight:600;
  background:var(--bg-2); border:1px solid var(--line);
  color:var(--ink-2);
}
.su-chip--good { background:rgba(21,128,61,0.08); border-color:rgba(21,128,61,0.22); color:var(--good); }
.su-chip--warn { background:rgba(180,83,9,0.08); border-color:rgba(180,83,9,0.22); color:var(--warn); }
.su-chip--bad  { background:rgba(185,28,28,0.08); border-color:rgba(185,28,28,0.22); color:var(--bad); }

/* wheel */
.su-wheel-screen .su-screen-head { margin-bottom:36px; }
.su-wheel-stage { display:grid; grid-template-columns:1fr 1fr; gap:40px; align-items:start; }
@media(max-width:700px){ .su-wheel-stage { grid-template-columns:1fr; } }
.su-wheel-wrap { position:relative; width:320px; height:320px; margin:0 auto; }
.su-wheel-pointer {
  position:absolute; top:-20px; left:50%; transform:translateX(-50%);
  z-index:4; filter:drop-shadow(0 2px 6px rgba(0,0,0,.14));
}
.su-wheel-shadow {
  position:absolute; bottom:-10px; left:50%; transform:translateX(-50%);
  width:260px; height:30px; border-radius:50%;
  background:radial-gradient(closest-side, rgba(0,0,0,.10), transparent);
}
.su-wheel-svg { width:100%; height:100%; display:block; }
.su-wheel-hub {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  width:68px; height:68px; border-radius:50%; z-index:5;
  background:#fff; border:3px solid var(--line-2);
  box-shadow:0 4px 20px -6px rgba(0,0,0,.14);
  display:grid; place-items:center; cursor:pointer;
  transition:all .18s; font-family:var(--font-display);
}
.su-wheel-hub:hover:not(:disabled) { box-shadow:0 6px 28px -6px rgba(0,0,0,.2); border-color:#111; }
.su-wheel-hub:disabled { cursor:default; }
.su-hub-inner { display:flex; flex-direction:column; align-items:center; gap:2px; }
.su-hub-spark { font-size:16px; color:var(--ink); }
.su-hub-label { font-size:9px; font-weight:800; letter-spacing:.14em; color:var(--muted); }
.su-hub-dots { display:flex; gap:5px; }
.su-hub-dots i { width:6px; height:6px; border-radius:50%; background:#111; animation:sudots .8s ease-in-out infinite; }
.su-hub-dots i:nth-child(2){ animation-delay:.15s; }
.su-hub-dots i:nth-child(3){ animation-delay:.3s; }
@keyframes sudots { 0%,100%{opacity:.3;transform:scale(.7)} 50%{opacity:1;transform:scale(1)} }

/* result card */
.su-result-card {
  background:rgba(255,255,255,0.78); backdrop-filter:blur(12px);
  border:1px solid var(--line); border-radius:var(--r-xl);
  padding:28px; box-shadow:var(--sh-md);
  opacity:0; transform:translateY(8px);
  transition:opacity .35s ease, transform .35s var(--ease-out);
}
.su-result-card.in { opacity:1; transform:translateY(0); }
.su-result-empty { display:flex; align-items:center; gap:16px; }
.su-result-empty-ring {
  width:44px; height:44px; border-radius:50%; border:2px dashed var(--line-2);
  display:grid; place-items:center; font-size:18px;
  color:var(--muted);
}
.su-result-empty-t { font-weight:700; font-size:14px; color:var(--ink); }
.su-result-empty-d { font-size:12px; color:var(--muted); margin-top:3px; }
.su-result-domain { margin-bottom:12px; }
.su-result-title { font-size:28px; color:var(--ink); margin:8px 0 6px; }
.su-result-tagline { font-size:14px; font-weight:600; color:var(--ink-2); margin:0 0 8px; line-height:1.5; }
.su-result-blurb { font-size:13px; color:var(--muted); margin:0 0 20px; line-height:1.6; }
.su-result-actions { display:flex; gap:10px; flex-wrap:wrap; }

/* card */
.su-card {
  background:var(--surface);
  border:1px solid var(--line); border-radius:var(--r-xl);
  padding:24px; box-shadow:var(--sh-sm);
}
.su-glass { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg); }

/* scan */
.su-scan { padding:20px 24px; margin-bottom:32px; }
.su-scan-bar { height:3px; border-radius:3px; background:var(--line); overflow:hidden; margin-bottom:12px; position:relative; }
.su-scan-fill { position:absolute; top:0; left:0; height:100%; width:40%; border-radius:3px; background:#111; animation:suscan 1.6s ease-in-out infinite; }
@keyframes suscan { 0%{left:-40%} 100%{left:100%} }
.su-scan-text { font-size:14px; color:var(--muted); font-weight:500; letter-spacing:-.01em; }

/* determinate progress variant — real % bar for the market scan */
.su-scan-head { display:flex; align-items:baseline; justify-content:space-between; gap:14px; margin-bottom:12px; }
.su-scan-pct { flex:none; font-size:14px; font-weight:800; color:var(--ink); font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
.su-scan-bar--progress { height:8px; border-radius:99px; margin-bottom:0; background:rgba(0,0,0,0.08); }
.su-scan-fill--progress {
  position:relative; left:0; width:0; min-width:8px;
  border-radius:99px; background:#111;
  animation:none;
  transition:width .4s cubic-bezier(.16,1,.3,1);
}

/* live research log — the streamed pipeline, shown while validating */
.su-research-log {
  list-style:none; margin:16px 0 0; padding:0;
  display:flex; flex-direction:column; gap:2px;
}
.su-research-step {
  display:flex; align-items:flex-start; gap:12px;
  padding:7px 0; min-height:30px;
  animation:su-research-in .35s cubic-bezier(.16,1,.3,1) both;
}
@keyframes su-research-in {
  from { opacity:0; transform:translateY(5px); }
  to   { opacity:1; transform:translateY(0); }
}
.su-research-ico {
  flex:none; width:18px; height:18px; margin-top:1px;
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:800;
}
.su-research-step--done .su-research-ico { color:var(--good); }
.su-research-spin {
  width:13px; height:13px; border-radius:50%;
  border:2px solid rgba(0,0,0,0.12); border-top-color:#111;
  animation:su-research-spin .7s linear infinite;
}
@keyframes su-research-spin { to { transform:rotate(360deg); } }
.su-research-body { display:flex; flex-direction:column; gap:6px; min-width:0; }
.su-research-line {
  font-size:14px; line-height:1.4; letter-spacing:-.01em;
  color:var(--muted); font-weight:500; transition:color .3s;
}
.su-research-step--active .su-research-line { color:var(--ink); font-weight:600; }
.su-research-step--done .su-research-line { color:var(--ink-2); }
.su-research-chips { display:flex; flex-wrap:wrap; gap:6px; }
.su-research-chip {
  font-size:12px; font-weight:600; color:var(--ink-2);
  background:var(--bg-2); border:1px solid var(--line);
  border-radius:999px; padding:3px 10px;
  animation:su-research-in .3s cubic-bezier(.16,1,.3,1) both;
}

/* validate grid */
.sm-validate-section { position:relative; }
.su-confetti {
  position:absolute; left:0; right:0; top:-8px; height:0;
  pointer-events:none; overflow:visible; z-index:6;
}
.su-confetti-piece {
  position:absolute; left:var(--confetti-left); top:0;
  width:var(--confetti-size); height:calc(var(--confetti-size) * 1.45);
  background:var(--confetti-color); opacity:0;
  transform:translate3d(0,-8px,0) rotate(0deg) scale(.82);
  animation:suConfettiFall var(--confetti-duration) cubic-bezier(.16,1,.3,1) forwards;
  animation-delay:var(--confetti-delay);
}
.su-confetti-piece--circle { border-radius:999px; }
.su-confetti-piece--pill { border-radius:999px; width:calc(var(--confetti-size) * 1.7); }
.su-confetti-piece--rect { border-radius:3px; }
@keyframes suConfettiFall {
  0% { opacity:0; transform:translate3d(0,-10px,0) rotate(0deg) scale(.82); }
  10% { opacity:1; }
  100% { opacity:0; transform:translate3d(var(--confetti-drift), 280px, 0) rotate(var(--confetti-spin)) scale(1); }
}
.su-validate-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media(max-width:640px){ .su-validate-grid { grid-template-columns:1fr; } }
.su-v-score { display:flex; align-items:flex-start; gap:20px; min-width:0; }
.su-v-score-side { display:flex; flex-direction:column; gap:10px; min-width:0; flex:1 1 auto; }
.su-v-minihead { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
.su-v-market { display:flex; flex-direction:column; gap:16px; min-width:0; }
.su-v-market-cell { display:flex; flex-direction:column; gap:8px; min-width:0; }
.su-v-k { font-family:var(--font-display); font-size:26px; font-weight:700; line-height:1; }
.su-v-l { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.su-v-gap { padding:14px; background:var(--bg-2); border-radius:var(--r-md); }
.su-v-gap-label { font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.su-v-signals { grid-column:1/-1; }
/* deep market research panel */
/* Plain-English layer — a digestible lead shown above the detailed content. */
.su-plain { background:var(--bg-2); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:0 0 14px; }
.su-plain--compact { padding:10px 12px; margin-bottom:12px; }
.su-plain-label { font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
.su-plain-text { margin:0; font-size:14px; line-height:1.6; color:var(--ink); }
.su-plain--compact .su-plain-text { font-size:13px; line-height:1.6; }
.su-plain-takeaways { margin:8px 0 0; padding-left:18px; display:flex; flex-direction:column; gap:4px; }
.su-plain-takeaways li { font-size:13px; line-height:1.5; color:var(--ink-2); }
.su-v-plainlead { grid-column:1/-1; }
.su-v-plainlead .su-plain { margin:0; background:transparent; border:none; padding:0; }
.su-v-plainlead .su-plain-text { font-size:15px; }
.su-v-deep { grid-column:1/-1; }
.su-deep-tag { margin-left:10px; font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:3px 8px; border-radius:99px; }
.su-deep-tag--good { background:rgba(21,128,61,0.10); color:var(--good); }
.su-deep-tag--warn { background:rgba(180,83,9,0.10); color:var(--warn); }
.su-deep-tag--bad  { background:rgba(185,28,28,0.10); color:var(--bad); }
.su-v-deep-quotes { display:flex; flex-direction:column; gap:8px; margin:12px 0; }
.su-v-deep-quote { margin:0; padding:8px 0 8px 14px; border-left:3px solid var(--line); font-style:italic; font-size:13px; color:var(--ink-2); line-height:1.5; }
.su-v-deep-row { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:baseline; margin-top:10px; font-size:13px; color:var(--ink-2); line-height:1.5; }
.su-v-deep-row .su-v-l { flex:none; }
.su-v-deep-communities { color:var(--ink); font-weight:600; }
.su-v-deep-progress { margin:14px 0 4px; }
.su-v-signals-head { font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:14px; }
.su-v-signal { margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--line); }
.su-v-signal:last-child { margin-bottom:0; padding-bottom:0; border-bottom:none; }
/* Player name stacked above its pricing/description — the pricing field is
   often a long sentence, so it gets a full-width, left-aligned line instead
   of being crammed into a narrow right-aligned column. */
.su-v-signal-top { display:flex; flex-direction:column; gap:3px; margin-bottom:8px; min-width:0; }
.su-v-signal-top span { font-size:14px; font-weight:700; color:var(--ink); overflow-wrap:anywhere; }
.su-v-signal-top b { font-size:13px; font-weight:500; color:var(--muted); text-align:left; line-height:1.5; overflow-wrap:anywhere; }
.su-ring-num { font-family:var(--font-display); font-size:28px; font-weight:700; color:var(--ink); line-height:1; letter-spacing:-.02em; }
.su-ring-label { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-top:4px; }
.su-v-bullets { list-style:none; margin:0; padding-left:2px; display:flex; flex-direction:column; gap:10px; min-width:0; }
.su-v-bullets li { position:relative; padding-left:18px; font-size:14px; color:var(--ink-2); line-height:1.6; overflow-wrap:anywhere; word-break:break-word; }
.su-v-bullets li::before { content:""; position:absolute; left:1px; top:8px; width:6px; height:6px; border-radius:50%; background:#111; }
.su-v-bullets--compact { gap:8px; }
.su-v-bullets--compact li { font-size:13px; }
.su-v-bullets--gap li { color:var(--ink); font-weight:500; }
.su-v-bullets--player { gap:6px; }
.su-v-bullets--avoid { text-align:left; max-width:560px; margin:0 auto 18px; }
.su-v-bullets--avoid li { font-size:13px; }
.su-v-cta { grid-column:1/-1; text-align:center; padding:28px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); }
.su-v-cta--avoid { background:rgba(185,28,28,0.03); border-color:rgba(185,28,28,0.18); }
.su-v-cta-text { font-size:16px; font-weight:600; color:var(--ink); margin-bottom:16px; line-height:1.4; }
.su-v-cta-row { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; }
.su-v-hint { font-size:12px; color:var(--muted); margin-top:12px; }
.su-v-cta-secondary { margin-top:16px; }
.su-v-verdict-label { margin-bottom:10px; }
.su-v-premise { font-size:14px; font-weight:600; color:var(--bad); line-height:1.5; margin:0 0 10px; }
.su-v-cta--avoid .su-v-premise { color:var(--bad); }
.su-v-verdict-rationale { text-align:left; max-width:520px; margin:0 auto 18px; }
.su-linkbtn {
  background:none; border:none; cursor:pointer;
  font-family:var(--font-body); font-size:13px; font-weight:600;
  color:var(--muted); text-decoration:underline; text-underline-offset:3px;
  padding:8px 4px;
}
.su-linkbtn:hover { color:var(--ink); }
.su-v-exceptional {
  background:var(--bg-2);
  border:1px solid var(--line); border-radius:var(--r-md);
  padding:11px 16px; margin-bottom:16px;
  font-size:14px; font-weight:500; color:var(--ink); line-height:1.5;
}
.su-credit-badge {
  display:inline-flex; align-items:center; padding:3px 8px;
  border-radius:99px; font-size:11px; font-weight:700;
  background:rgba(255,255,255,0.18); color:#fff;
  margin-left:4px; letter-spacing:0;
}
.su-creditpill {
  display:flex; flex-direction:column; align-items:center; gap:2px;
  padding:10px 16px; background:var(--surface);
  border:1px solid var(--line-2); border-radius:var(--r-pill);
  transition:border-color .15s, background .15s;
}
.su-creditpill:hover { border-color:var(--ink-2); background:var(--bg-2); }
.su-creditnum { font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--ink); line-height:1; }
.su-creditlbl { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }

/* blueprint */
.su-pip-progress {
  position:relative; display:grid; grid-template-columns:repeat(4,1fr);
  background:var(--surface); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:18px 22px 16px;
  margin-bottom:28px; overflow:hidden;
}
.su-pip-track { position:absolute; bottom:0; left:0; right:0; height:2px; background:var(--line); }
.su-pip-fill { height:100%; background:#111; transition:width .6s var(--ease-out); }
/* compact pip row used inside the blueprint progress card */
.su-bp-progress { margin-bottom:28px; }
.su-pip-progress--compact { background:none; border:none; border-radius:0; padding:14px 0 0; margin:0; margin-top:14px; overflow:visible; }
.su-pip-step.errored .su-pip-dot { border-color:var(--bad); color:#fff; background:var(--bad); }
.su-pip-step.errored .su-pip-label { color:var(--bad); }
.su-pip-step { display:flex; flex-direction:column; align-items:center; gap:8px; }
.su-pip-dot {
  width:28px; height:28px; border-radius:50%;
  display:grid; place-items:center;
  font-family:var(--font-display); font-size:11px; font-weight:700;
  background:var(--surface); border:1.5px solid var(--line-2);
  color:var(--muted); transition:border-color .25s, color .25s, background .25s, box-shadow .25s;
}
.su-pip-step.running .su-pip-dot { border-color:#555; color:#555; background:var(--bg-2); }
.su-pip-step.done .su-pip-dot { border-color:#111; color:#fff; background:#111; }
.su-pip-label { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
.su-pip-step.running .su-pip-label { color:#555; }
.su-pip-step.done .su-pip-label { color:#111; }
.su-spin-sm { display:inline-block; width:11px; height:11px; border:2px solid rgba(0,0,0,.12); border-top-color:#111; border-radius:50%; animation:suspin .7s linear infinite; }
@keyframes suspin { to{transform:rotate(360deg)} }
.su-bp-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:32px; }
@media(max-width:640px){ .su-bp-grid { grid-template-columns:1fr; } }
.su-bp-card {}
.su-bp-card--proto { grid-column:1/-1; }
.su-bp-card--full { grid-column:1/-1; }
.su-bp-cursor-prompt {
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;
  line-height:1.7; color:var(--ink); background:var(--bg-2);
  border:1px solid var(--line-2); border-radius:var(--r-sm);
  padding:16px; white-space:pre-wrap; word-break:break-word; margin:0;
}
.su-bp-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--line); }
.su-bp-num {
  font-family:var(--font-display); font-size:11px; font-weight:700;
  letter-spacing:.08em; color:#fff;
  width:28px; height:28px; border-radius:8px; flex-shrink:0;
  background:#111; border:1px solid #111;
  display:grid; place-items:center;
}
.su-bp-title { font-family:var(--font-display); font-size:15px; font-weight:700; color:var(--ink); margin:0; letter-spacing:-.01em; }
.su-bp-name { font-family:var(--font-display); font-size:22px; font-weight:700; margin:0 0 6px; line-height:1.1; color:var(--ink); letter-spacing:-.02em; }
.su-bp-summary { font-size:13px; color:var(--muted); margin:0 0 12px; line-height:1.6; }
.su-bp-list-label { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.su-bp-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.su-bp-list li { font-size:14px; color:var(--ink-2); padding-left:18px; position:relative; line-height:1.6; }
.su-bp-list li::before { content:""; position:absolute; left:2px; top:8px; width:5px; height:5px; border-radius:50%; background:#111; }
.su-bp-list--ol { counter-reset:ol; }
.su-bp-list--ol li::before { content:counter(ol); counter-increment:ol; width:auto; height:auto; left:0; top:0; background:none; font-family:var(--font-display); font-size:11px; font-weight:700; color:var(--muted); }
.su-bp-kpis { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.su-bp-kpi { background:var(--bg-2); border-radius:var(--r-sm); padding:10px 12px; display:flex; flex-direction:column; gap:3px; }
.su-bp-kpi span { font-family:var(--font-display); font-size:15px; font-weight:700; }
.su-bp-kpi small { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.su-bp-pricebox { margin-top:14px; padding:14px 16px; background:var(--bg-2); border-radius:var(--r-md); display:flex; flex-direction:column; gap:6px; }
.su-bp-pricebox span:first-child { font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--ink); letter-spacing:-.02em; }
.su-bp-pricebox span:nth-child(2) { font-size:13px; color:var(--ink-2); line-height:1.5; }
.su-bp-chips { display:flex; flex-wrap:wrap; gap:6px; }
.su-bp-env { font-size:11px; background:#1a1a1a; color:#d4d4d4; border-radius:var(--r-sm); padding:12px; white-space:pre-wrap; word-break:break-all; margin:0; line-height:1.7; }
.su-bp-costs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
.su-bp-cost-cell { text-align:center; background:var(--bg-2); border-radius:var(--r-sm); padding:12px 8px; }
.su-bp-cost-cell span { font-family:var(--font-display); font-size:15px; font-weight:700; color:var(--ink); display:block; }
.su-bp-cost-cell small { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.su-proto-toggle {
  display:inline-flex; align-items:center; gap:6px;
  font-size:13px; font-weight:600; color:var(--ink);
  background:var(--bg-2); border:1px solid var(--line);
  border-radius:var(--r-pill); padding:7px 16px; cursor:pointer; margin-bottom:14px;
  transition:background .15s, border-color .15s;
}
.su-proto-toggle:hover { background:var(--surface); border-color:var(--ink-2); }
.su-proto-wrap { border:1px solid var(--line); border-radius:var(--r-md); overflow:hidden; }
.su-proto-chrome { display:flex; align-items:center; gap:6px; padding:10px 14px; background:var(--bg-2); border-bottom:1px solid var(--line); }
.su-proto-chrome span { width:10px; height:10px; border-radius:50%; }
.su-proto-chrome span:nth-child(1){background:#ff5f57} .su-proto-chrome span:nth-child(2){background:#febc2e} .su-proto-chrome span:nth-child(3){background:#28c840}
.su-proto-url { margin-left:10px; font-size:11px; color:var(--muted); background:var(--surface); border:1px solid var(--line); border-radius:4px; padding:2px 10px; }
.su-bp-footer { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:28px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); flex-wrap:wrap; }
.su-bp-footer-t { font-size:24px; color:var(--ink); margin-bottom:4px; letter-spacing:-.02em; }
.su-bp-footer-d { font-size:14px; color:var(--muted); }
.su-bp-footer-actions { display:flex; gap:10px; flex-wrap:wrap; }

/* pricing modal */
.su-modal-overlay { position:fixed; inset:0; background:rgba(13,8,32,.42); backdrop-filter:blur(8px); z-index:100; display:grid; place-items:center; animation:suFade .2s ease; padding:20px; }
@keyframes suFade { from { opacity:0 } to { opacity:1 } }
.su-modal { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); padding:28px; max-width:440px; width:100%; box-shadow:var(--sh-lg); animation:suRise .25s var(--ease-out); }
@keyframes suRise { from { transform:translateY(8px); opacity:0 } to { transform:translateY(0); opacity:1 } }
.su-modal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.su-modal-head span { font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--ink); letter-spacing:-.02em; }
.su-modal-head button { font-size:18px; color:var(--muted); cursor:pointer; padding:4px 8px; border-radius:6px; }
.su-modal-head button:hover { color:var(--ink); background:var(--bg-2); }
.su-modal-sub { font-size:14px; color:var(--muted); margin:0 0 20px; line-height:1.5; }
.su-pkgs { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.su-pkg { display:flex; flex-direction:column; gap:4px; padding:16px; background:var(--bg-2); border:1px solid var(--line); border-radius:var(--r-md); transition:border-color .15s; }
.su-pkg:hover { border-color:var(--line-2); }
.su-pkg--hl { border-color:#111; background:var(--bg-2); }
.su-pkg-label { font-family:var(--font-display); font-size:13px; font-weight:700; color:var(--ink); letter-spacing:-.01em; }
.su-pkg-credits { font-size:13px; color:var(--muted); }
.su-pkg-price { font-family:var(--font-display); font-size:24px; font-weight:700; color:var(--ink); line-height:1; letter-spacing:-.02em; }
.su-pkg-per { font-size:11px; color:var(--muted); margin-bottom:8px; }
.su-pkg-btn { font-size:13px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--line-2); border-radius:var(--r-pill); padding:9px 0; cursor:pointer; transition:background .15s, border-color .15s; }
.su-pkg--hl .su-pkg-btn { background:#111; color:#fff; border-color:#111; }
.su-pkg-btn:hover { border-color:#111; color:#111; }
.su-pkg--hl .su-pkg-btn:hover { background:#333; border-color:#333; color:#fff; }
.su-pkg-btn:disabled { opacity:.6; cursor:wait; }

/* util */
.su-err { font-size:13px; color:#dc2626; margin:12px 0; }
.su-retry { background:none; border:none; color:var(--ink); cursor:pointer; font-size:13px; text-decoration:underline; }

/* disclaimer */
.su-disclaimer { position:relative; z-index:1; max-width:980px; margin:48px auto 0; padding:28px 24px 40px; border-top:1px solid var(--line); text-align:center; }
.su-disclaimer-links { display:flex; gap:24px; justify-content:center; margin-bottom:14px; flex-wrap:wrap; }
.su-disclaimer-links a { font-size:13px; color:var(--ink-2); text-decoration:none; font-weight:500; transition:color .15s; }
.su-disclaimer-links a:hover { color:var(--ink); }
.su-disclaimer p { font-size:12px; color:var(--faint); line-height:1.7; margin:0; }

/* ── how it works ─────────────────────────────────────────────────── */
.su-hiw {
  margin-top:40px; width:100%; max-width:640px;
  padding:0;
  text-align:left;
}
.su-hiw-label {
  font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
  color:var(--muted); margin-bottom:20px; text-align:center;
}
.su-hiw-steps { display:flex; flex-direction:column; gap:0; }
.su-hiw-step { display:flex; align-items:flex-start; gap:18px; }
.su-hiw-num {
  width:32px; height:32px; border-radius:50%; flex-shrink:0;
  background:#111; border:1px solid #111; color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-family:var(--font-display); font-size:13px; font-weight:700;
}
.su-hiw-t { font-weight:600; font-size:16px; color:var(--ink); margin-bottom:6px; letter-spacing:-.01em; }
.su-hiw-d { font-size:14px; color:var(--muted); line-height:1.6; }
.su-hiw-connector {
  width:1px; height:24px; background:var(--line-2);
  margin:6px 0 6px 16px;
}

/* ── combinations bar ─────────────────────────────────────────────── */
.su-combos-bar {
  margin-top:32px; padding:16px 24px;
  background:rgba(255,255,255,0.68); backdrop-filter:blur(10px);
  border:1px solid var(--line); border-radius:var(--r-xl);
  display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;
}
.su-combos-num {
  font-family:var(--font-display); font-size:28px; font-weight:800;
  color:var(--ink);
  letter-spacing:-.02em; flex-shrink:0;
}
.su-combos-text { font-size:14px; color:var(--muted); font-weight:500; line-height:1.4; }

/* ── reviews ──────────────────────────────────────────────────────── */
.su-reviews { margin-top:52px; width:100%; max-width:980px; }
.su-reviews-label {
  font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
  color:var(--muted); text-align:center; margin-bottom:28px;
}
.su-reviews-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
@media(max-width:760px){ .su-reviews-grid { grid-template-columns:1fr; } }
.su-review-card {
  background:var(--surface);
  border:1px solid var(--line); border-radius:var(--r-lg);
  padding:22px; display:flex; flex-direction:column; gap:14px;
  text-align:left;
}
.su-review-stars { color:#111; font-size:13px; letter-spacing:2px; }
.su-review-text { font-size:14px; color:var(--ink-2); line-height:1.6; margin:0; flex:1; }
.su-review-author { display:flex; align-items:center; gap:12px; }
.su-review-avatar {
  width:34px; height:34px; border-radius:50%; flex-shrink:0;
  background:#111; color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-family:var(--font-display); font-size:13px; font-weight:700;
}
.su-review-name { font-size:14px; font-weight:600; color:var(--ink); }
.su-review-role { font-size:12px; color:var(--muted); margin-top:1px; }

/* ── landing footer links ─────────────────────────────────────────── */
.su-landing-footer {
  margin-top:32px; padding-top:24px; border-top:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; gap:12px;
  color:var(--faint); font-size:13px;
}
.su-landing-footer-link { color:var(--muted); text-decoration:none; font-weight:500; }
.su-landing-footer-link:hover { color:var(--ink); }

/* ── slot machine ─────────────────────────────────────────────────── */
.sm-root {
  width:100%; max-width:680px; margin:0 auto;
}

/* ── Cabinet — one elegant glass component ── */
.sm-cabinet {
  position:relative;
  background:#fff;
  border-radius:28px;
  padding:18px 16px 22px;
  border:3px solid #111;
  box-shadow:6px 6px 0 #111;
}

/* ── Mode toggle ── */
.sm-topbar { display:flex; justify-content:center; margin:0 0 16px; }
.sm-modebar {
  display:inline-flex; gap:2px;
  padding:4px;
  border-radius:999px;
  background:rgba(255,255,255,0.8);
  border:1px solid rgba(0,0,0,0.10);
  backdrop-filter:blur(14px);
}
.sm-modebtn {
  font-family:var(--font-body); font-size:13px; font-weight:600;
  color:var(--muted);
  padding:7px 20px; border-radius:999px;
  border:none; background:transparent;
  cursor:pointer;
  transition:color .15s ease, background .25s ease;
  letter-spacing:0;
}
.sm-modebtn:hover:not(:disabled) { color:var(--ink); }
.sm-modebtn.on {
  color:#fff;
  background:#111;
}
.sm-modebtn:disabled { opacity:.5; cursor:default; }

/* ── Reels container with dominant center band ── */
.sm-reels-wrap {
  position:relative;
  border-radius:20px;
  padding:8px;
  background:rgba(248,248,248,0.9);
  border:3px solid #111;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.86);
  overflow:hidden;
}

/* center band — visually dominant pill spanning all 3 reels */
.sm-payline-bar {
  position:absolute;
  left:10px; right:10px;
  top:50%; height:78px;
  transform:translateY(-50%);
  border-radius:16px;
  background:rgba(255,255,255,0.92);
  border:1.5px solid rgba(0,0,0,0.12);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.90),
    0 4px 16px -8px rgba(0,0,0,0.12);
  pointer-events:none;
  z-index:1;
  display:block;
}

.sm-reels {
  position:relative; z-index:2;
  display:grid; grid-template-columns:repeat(3,1fr); gap:4px;
  background:transparent;
}

.sm-col {
  display:flex; flex-direction:column;
  position:relative;
  padding:0; background:none; border:none; box-shadow:none;
}

.sm-window {
  position:relative;
  height:228px;
  overflow:hidden;
  background:transparent;
  border:none;
  border-radius:14px;
  box-shadow:none;
}

/* Aggressive vignette mask: off-center items dissolve, the centered
   row stays fully crisp — making it the visually dominant element. */
.sm-strip {
  will-change:transform;
  pointer-events:none; user-select:none;
  position:relative; z-index:0;
}

/* Motion blur while the reel travels — smooths the fast scroll so it no
   longer strobes frame-to-frame. Removed the instant it settles (the
   strip swaps to transition:none in onSettle) so the landed word is crisp. */
.sm-strip.is-spinning {
  filter:blur(1.4px);
}

/* Frosted depth-of-field over the off-payline zone. Lives on the fixed
   wrap (NOT the moving strip — a mask on the strip scrolls with it and
   never lands over the window), so the blur+tint stay pinned above and
   below the centered band. backdrop-filter blurs the words scrolling
   behind; the tint hides them even where backdrop-filter is unsupported.
   Only the centered row, in the clear band between the two hazes, reads. */
.sm-reel-haze {
  position:absolute;
  left:8px; right:8px;
  z-index:3;
  pointer-events:none;
  -webkit-backdrop-filter:blur(13px);
  backdrop-filter:blur(13px);
}
.sm-reel-haze--top {
  top:8px;
  bottom:calc(50% + 39px);
  background:linear-gradient(180deg,
    rgba(248,248,248,0.97) 0%,
    rgba(248,248,248,0.90) 60%,
    rgba(248,248,248,0.66) 100%);
  -webkit-mask-image:linear-gradient(180deg, #000 0%, #000 80%, transparent 100%);
  mask-image:linear-gradient(180deg, #000 0%, #000 80%, transparent 100%);
}
.sm-reel-haze--bottom {
  top:calc(50% + 39px);
  bottom:8px;
  background:linear-gradient(0deg,
    rgba(248,248,248,0.97) 0%,
    rgba(248,248,248,0.90) 60%,
    rgba(248,248,248,0.66) 100%);
  -webkit-mask-image:linear-gradient(180deg, transparent 0%, #000 20%, #000 100%);
  mask-image:linear-gradient(180deg, transparent 0%, #000 20%, #000 100%);
}

/* Pre-spin cover: hides the reel words (so nothing is pre-populated) and
   carries the call-to-action across the full width of the generator. */
.sm-reel-cover {
  position:absolute;
  inset:8px;
  z-index:6;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px;
  text-align:center;
  cursor:pointer;
  border-radius:14px;
  background:rgba(248,248,248,0.92);
  -webkit-backdrop-filter:blur(8px);
  backdrop-filter:blur(8px);
  border:1px solid rgba(0,0,0,0.10);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.86);
}
.sm-reel-cover-emoji { font-size:24px; line-height:1; }
.sm-reel-cover-title {
  font-family:var(--font-display);
  font-weight:800;
  font-size:clamp(15px, 2.6vw, 18px);
  letter-spacing:-.01em;
  color:var(--ink);
}
.sm-reel-cover-sub {
  font-size:13px; font-weight:600; color:var(--muted);
}

.sm-item {
  display:flex; align-items:center; justify-content:center;
  text-align:center; padding:0 8px;
  font-family:var(--font-display);
  font-size:clamp(11.5px, 1.8vw, 13.5px);
  font-weight:700;
  color:var(--ink);
  line-height:1.08; letter-spacing:-.02em;
  text-shadow:0 1px 0 rgba(255,255,255,0.60);
  pointer-events:none; user-select:none;
  text-wrap:balance;
}

.sm-reels-ledge { display:none; }

/* ── Generate button ── */
.sm-base {
  display:flex; flex-direction:column; align-items:center;
  padding:18px 4px 0;
  position:relative; z-index:5;
  gap:10px;
}

.sm-spin {
  font-family:var(--font-body); font-size:18px; font-weight:900;
  color:#000;
  height:60px; line-height:52px;
  padding:0 50px; border-radius:10px;
  letter-spacing:.25px;
  background-color:#fff6be;
  cursor:pointer; min-width:220px; width:min(100%, 320px);
  position:relative; overflow:hidden;
  border:4px solid #000;
  text-align:center;
  transition:color .3s;
}
.sm-spin::after {
  display:block; position:absolute;
  top:0; right:0; height:100%; width:100%;
  z-index:0; content:'';
  background:#ffdd00;
  transition:all .3s cubic-bezier(.42,0,.58,1);
}
.sm-spin span { position:relative; z-index:2; }
.sm-spin:hover:not(:disabled)::after { right:auto; left:0; width:0; }
.sm-spin:disabled { opacity:.5; cursor:default; }
.sm-spin:active:not(:disabled) { transform:translateY(0); }
.sm-spin:disabled { opacity:.5; cursor:default; }

/* ── Live sentence ── */
.sm-live-sentence {
  width:100%;
  padding:14px 20px;
  margin-top:16px;
  background:#fff;
  border:3px solid #111;
  border-radius:18px;
  text-align:center; min-height:54px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:4px 4px 0 #111;
}
.sm-live-sentence p { margin:0; font-size:15px; line-height:1.6; color:var(--ink-2); }
.sm-live-sentence .sm-slot {
  display:inline-block; font-weight:700; padding:1px 4px;
  color:var(--ink);
  font-size:15px;
}
.sm-live-sentence .sm-slot-empty {
  display:inline-block; width:72px; height:10px; border-radius:999px;
  background:rgba(0,0,0,0.08); border:1px solid rgba(0,0,0,0.10);
  vertical-align:middle; margin:0 4px;
  animation:smpulse 1.4s ease-in-out infinite;
}
@keyframes smpulse { 0%,100%{opacity:.5} 50%{opacity:1} }

.sm-result-cta {
  margin-top:24px; text-align:center;
  animation:iwIn .35s ease-out both;
}
@keyframes iwIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

/* ── laptop mockup ────────────────────────────────────────────────── */
/* monitor */
.su-laptop {
  margin:40px auto 0; max-width:620px; width:100%;
  display:flex; flex-direction:column; align-items:center;
  filter:drop-shadow(0 32px 64px rgba(80,20,120,0.22));
}
.su-laptop-screen {
  width:100%; position:relative;
  background:#1a1a2e;
  border:12px solid #2a2a3e;
  border-bottom:16px solid #2a2a3e;
  border-radius:18px 18px 6px 6px;
  overflow:hidden;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.06),
    0 0 0 1px #111;
}
/* subtle screen glare */
.su-laptop-screen::after {
  content:'';
  position:absolute; top:0; left:0; right:0; height:35%;
  background:linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%);
  pointer-events:none; z-index:10; border-radius:6px 6px 0 0;
}
/* bottom bezel bar with brand dot */
.su-laptop-screen::before {
  content:'';
  position:absolute; bottom:0; left:0; right:0; height:16px;
  background:#2a2a3e;
  pointer-events:none; z-index:10;
}
/* stand neck */
.su-monitor-neck {
  width:0; height:0;
  border-left:28px solid transparent;
  border-right:28px solid transparent;
  border-top:32px solid #2a2a3e;
}
/* stand base */
.su-monitor-foot {
  width:160px; height:10px;
  background:linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%);
  border-radius:0 0 8px 8px;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
}
.su-laptop-chrome {
  background:#f5f4f8; border-bottom:1px solid #e8e4f0;
  padding:9px 14px; display:flex; gap:6px; align-items:center;
}
.su-laptop-chrome span { width:10px; height:10px; border-radius:50%; }
.su-laptop-chrome span:nth-child(1){background:#ff5f57}
.su-laptop-chrome span:nth-child(2){background:#febc2e}
.su-laptop-chrome span:nth-child(3){background:#28c840}
.su-laptop-body { padding:20px 20px 16px; }
.su-laptop-modebar { display:flex; gap:8px; margin-bottom:16px; justify-content:center; }
.su-laptop-mode { font-size:12px; font-weight:700; padding:6px 16px; border-radius:99px; border:1.5px solid var(--line); color:var(--muted); }
.su-laptop-mode.on { background:#111; color:#fff; border-color:transparent; }
.su-laptop-reels { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
.su-laptop-col { display:flex; flex-direction:column; gap:6px; }
.su-laptop-label { font-size:9px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; text-align:center; }
.su-laptop-reel { position:relative; border-radius:10px; overflow:hidden; background:var(--bg-2); border:1.5px solid var(--line-2); }
.su-laptop-reel-item { padding:10px 6px; text-align:center; font-size:11px; font-weight:700; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--line); letter-spacing:.02em; line-height:1.2; }
.su-laptop-reel-item.active { color:var(--ink); background:rgba(255,255,255,0.9); font-weight:800; }
.su-laptop-reel-item:last-child { border-bottom:none; }
.su-laptop-reel-fade { position:absolute; left:0; right:0; height:18px; pointer-events:none; z-index:2; }
.su-laptop-reel-fade--top { top:0; background:linear-gradient(to bottom,var(--bg-2),transparent); }
.su-laptop-reel-fade--bottom { bottom:0; background:linear-gradient(to top,var(--bg-2),transparent); }
.su-laptop-sentence { font-size:12px; color:var(--muted); text-align:center; padding:10px 8px; background:rgba(255,255,255,0.6); border:1px solid var(--line); border-radius:10px; margin-bottom:12px; line-height:1.6; }
.su-laptop-btn { display:flex; align-items:center; justify-content:center; background:#111; color:#fff; border-radius:12px; padding:11px; font-size:13px; font-weight:700; }

/* responsive */
@media(max-width:640px){
  .su-nav { padding:16px 16px 0; }
  .su-screen { padding:24px 16px 48px; }
  .su-landing { padding:18px 16px 18px; }
  .su-landing-h1 { font-size:36px; line-height:1.02; margin-bottom:12px; }
  .su-landing-sub { font-size:15px; line-height:1.6; max-width:34ch; margin-bottom:14px; }
  .su-landing-cta { margin:12px 0 6px; }
  .su-hiw { margin-top:28px; }
  .su-landing-cta-row { width:100%; gap:10px; }
  .su-landing-cta-row .su-btn { flex:1 1 100%; }
  .su-wheel-wrap { width:280px; height:280px; }
  .su-bp-grid,.su-validate-grid { grid-template-columns:1fr; }
  .su-v-score { flex-direction:column; align-items:stretch; }
  .su-v-signals { grid-column:auto; }
  .su-v-cta { grid-column:auto; padding:22px; }
  .su-pip-progress { grid-template-columns:repeat(2,1fr); }
  .sm-cabinet { padding:14px 10px 16px; border-radius:24px; }
  .sm-topbar { margin-bottom:12px; }
  .sm-modebtn { padding:7px 16px; font-size:12px; }
  .sm-reels-wrap { padding:6px; border-radius:16px; }
  .sm-payline-bar { left:6px; right:6px; height:68px; border-radius:14px; }
  .sm-reel-haze { left:6px; right:6px; -webkit-backdrop-filter:blur(11px); backdrop-filter:blur(11px); }
  .sm-reel-haze--top { top:6px; bottom:calc(50% + 34px); }
  .sm-reel-haze--bottom { top:calc(50% + 34px); bottom:6px; }
  .sm-reels { gap:3px; }
  .sm-base { padding:14px 4px 0; }
  .sm-window { height:192px; border-radius:12px; }
  .sm-item { font-size:11px; padding:0 5px; line-height:1.06; }
  .sm-spin { width:100%; max-width:320px; padding:14px 32px; }
  .sm-live-sentence { padding:12px 16px; border-radius:16px; }
  .sm-live-sentence p { font-size:14px; line-height:1.6; }
  .su-bp-footer { padding:20px; }
  .su-disclaimer-links { gap:14px; }
}

/* ══ UTILITARIAN LANDING (scoped proof) ════════════════════════════════
   A product-tool design language (Linear/Vercel feel) scoped to the landing
   screen only via .su-root--util. Flat neutral surfaces, hairline borders,
   small radii, monospace labels, one restrained accent — no gradients,
   glass, glows, or pastel. Nothing here touches the other screens. */
.su-root--util {
  --u-bg:#FAFAF9; --u-surface:#FFFFFF;
  --u-ink:#16151A; --u-muted:#6E6D78; --u-faint:#9A99A4;
  --u-line:#E8E7EC; --u-line-2:#DBDAE1;
  --u-accent:#5B5BF5;
  --u-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
  background:var(--u-bg);
}
body.util-landing { background:#FAFAF9; }
body.util-landing .oc-blob { opacity:0 !important; }

/* nav */
.su-root--util .su-brand-idea { color:var(--u-ink); }
.su-root--util .su-brand-reels {
  background:none; -webkit-background-clip:border-box; background-clip:border-box;
  -webkit-text-fill-color:var(--u-accent); color:var(--u-accent);
}
.su-root--util .su-nav-link { color:var(--u-muted); font-weight:600; }
.su-root--util .su-nav-link:hover { color:var(--u-ink); background:#F1F0F4; }
.su-root--util .su-nav-link--cta {
  background:var(--u-ink); color:#fff; border-radius:7px; box-shadow:none; padding:8px 16px;
}
.su-root--util .su-nav-link--cta:hover { filter:none; background:#000; transform:none; }

/* hero */
.su-util-eyebrow {
  font-family:var(--u-mono); font-size:12px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--u-muted); margin:0 0 18px; display:inline-flex; align-items:center; gap:8px;
}
.su-util-eyebrow::before {
  content:""; width:6px; height:6px; border-radius:2px; background:var(--u-accent); display:inline-block;
}
.su-root--util .su-landing-h1 {
  color:var(--u-ink); letter-spacing:-.03em; line-height:1.04;
  font-size:clamp(40px,5.4vw,64px);
}
.su-root--util .su-grad-text {
  background:none; -webkit-text-fill-color:var(--u-accent); color:var(--u-accent);
}
.su-root--util .su-landing-sub { color:var(--u-muted); }

/* buttons */
.su-root--util .su-btn { border-radius:7px; letter-spacing:0; }
.su-root--util .su-btn-primary {
  background:var(--u-ink); color:#fff; border-color:var(--u-ink); box-shadow:none;
}
.su-root--util .su-btn-primary:hover { filter:none; background:#000; box-shadow:none; transform:none; }
.su-root--util .su-btn-ghost {
  background:var(--u-surface); color:var(--u-ink); border-color:var(--u-line-2); box-shadow:none;
}
.su-root--util .su-btn-ghost:hover { background:#F1F0F4; border-color:var(--u-muted); color:var(--u-ink); }

/* how it works */
.su-root--util .su-hiw-label,
.su-root--util .su-reviews-label {
  font-family:var(--u-mono); font-weight:500; letter-spacing:.06em; color:var(--u-muted); font-size:12px;
}
.su-root--util .su-hiw-num {
  border-radius:7px; background:var(--u-surface); border:1px solid var(--u-line-2);
  color:var(--u-ink); font-family:var(--u-mono); font-weight:500;
}
.su-root--util .su-hiw-t { color:var(--u-ink); }
.su-root--util .su-hiw-d { color:var(--u-muted); }
.su-root--util .su-hiw-connector { background:var(--u-line-2); }

/* reviews */
.su-root--util .su-review-card {
  background:var(--u-surface); border:1px solid var(--u-line); border-radius:10px; box-shadow:none;
}
.su-root--util .su-review-stars { color:#E0A800; }
.su-root--util .su-review-text { color:var(--u-ink); }
.su-root--util .su-review-avatar {
  background:var(--u-ink); border-radius:8px; font-family:var(--u-mono); font-weight:500;
}
.su-root--util .su-review-name { color:var(--u-ink); }
.su-root--util .su-review-role { color:var(--u-muted); font-family:var(--u-mono); font-size:11px; }

/* footer */
.su-root--util .su-landing-footer { border-top:1px solid var(--u-line); color:var(--u-faint); }
.su-root--util .su-landing-footer-link { color:var(--u-muted); }
.su-root--util .su-landing-footer-link:hover { color:var(--u-ink); }
`;
