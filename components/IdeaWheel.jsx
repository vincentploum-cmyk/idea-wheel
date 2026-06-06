"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { CREDIT_PACKAGES } from "@/lib/pricing";
import { createClient } from "@/lib/supabase-browser";

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
          <stop stopColor="#7c3aed"/><stop offset="1" stopColor="#ff4d8d"/></linearGradient></defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="#f3edff" strokeWidth="11" fill="none"/>
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

/* ─── METER BAR ──────────────────────────────────────────────────── */
function Meter({ value, delay=0 }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return (
    <div className="su-meter-track">
      <div className="su-meter-fill" style={{ width:`${w}%`, transition:`width 1.1s cubic-bezier(.16,1,.3,1) ${delay}ms` }}/>
    </div>
  );
}

/* ─── DYNAMIC CREDIT COST ────────────────────────────────────────── */
function creditCost(score) {
  if (score >= 85) return 3;
  if (score >= 65) return 2;
  return 1;
}
function creditLabel(score) {
  if (score >= 85) return { cost: 3, tier: '🔥 Exceptional', color: '#7c3aed' };
  if (score >= 65) return { cost: 2, tier: '⚡ Strong signal', color: '#c026d3' };
  return { cost: 1, tier: 'Standard', color: '#7a7191' };
}

/* ─── CONFETTI ───────────────────────────────────────────────────── */
function Confetti({ active }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#7c3aed','#c026d3','#ff4d8d','#ff6f61','#5b5bf5','#fbbf24'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      vrot: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        if (p.y > canvas.height * 0.6) p.opacity -= 0.02;
        if (p.opacity > 0) alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      if (alive) rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999 }}/>;
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
      ['Automates','Streamlines','Manages','Centralizes','Tracks','Handles','Schedules','Simplifies','Accelerates','Digitizes','Processes','Organizes','Monitors','Optimizes','Prioritizes'],
      ['time & expense reporting', 'referral tracking', 'client onboarding', 'invoice processing', 'contract management', 'compliance reporting', 'staff scheduling', 'job site inspections', 'quote generation', 'lead management', 'document management', 'project tracking', 'vendor management', 'customer follow-ups', 'payroll processing', 'performance reviews', 'inventory tracking', 'billing & collections', 'field operations', 'service request routing', 'safety incident reporting', 'equipment maintenance', 'crew dispatching', 'patient intake', 'referral management', 'renewal reminders', 'work order management', 'quality control checks', 'subcontractor coordination', 'delivery scheduling'],
      ['Healthcare','Legal services','Construction','Logistics','Insurance','Dental practices','Manufacturing','Accounting firms','Property management','Restaurants','Staffing agencies','Real estate','Veterinary clinics','Auto repair shops','Marketing agencies','Financial advisors','Cleaning services','Retail','Physical therapy','Childcare'],
    ],
  },
  consumer: {
    name:'Consumer', connector:'for', prefix:'I want to make an app that',
    labels:['ACTION','EXPERIENCE','FOR'],
    banks:[
      // 15 actions — every verb pairs naturally with every experience below
      ['Tracks', 'Improves', 'Manages', 'Builds', 'Optimizes', 'Plans', 'Simplifies', 'Coaches', 'Monitors', 'Personalizes', 'Boosts', 'Structures', 'Transforms', 'Organizes', 'Gamifies'],
      // 18 experiences — noun phrases that read naturally after any action above
      ['daily habits', 'sleep quality', 'personal finances', 'mental health', 'fitness goals', 'meal planning', 'career progress', 'productivity', 'anxiety & stress', 'skill development', 'time management', 'nutrition tracking', 'home organization', 'creative projects', 'work-life balance', 'learning routines', 'relationship goals', 'social confidence', 'spending habits', 'morning routines', 'workout recovery', 'focus & deep work', 'journaling & reflection', 'language learning', 'financial independence', 'digital wellbeing', 'parenting routines', 'reading habits', 'dating & relationships', 'side hustle growth'],
      // Audiences: clear groups with a shared pain point
      // 18 audiences
      ['busy professionals', 'new parents', 'college students', 'freelancers', 'athletes', 'small business owners', 'retirees', 'remote workers', 'people with ADHD', 'musicians', 'young adults', 'solopreneurs', 'teachers', 'healthcare workers', 'content creators', 'night shift workers', 'seniors living alone', 'couples', 'first-time homeowners', 'job seekers', 'new graduates', 'introverts', 'chronic illness patients', 'travel enthusiasts', 'new immigrants'],
    ],
  },
};
const ITEM_H = 80;
const REPEATS = 10;
const HOME_COPY = 4;
const REEL_TINTS = ['#7c3aed','#c026d3','#ff4d8d'];

function SlotMachine({ onResult }) {
  const [mode, setMode] = useState('b2b');
  const m = MODES[mode];
  const banks = m.banks;
  const stripRefs = [useRef(null), useRef(null), useRef(null)];
  const indexRef = useRef([0,0,0]);
  const targetRef = useRef([0,0,0]);
  const [landed, setLanded] = useState(['','','']);
  const [spinning, setSpinning] = useState([false,false,false]);
  const anySpinning = spinning.some(Boolean);

  useEffect(() => {
    banks.forEach((bank,w) => {
      const start = Math.floor(Math.random()*bank.length);
      indexRef.current[w] = HOME_COPY*bank.length + start;
      const el = stripRefs[w].current;
      if (el) { el.style.transition='none'; el.style.transform=`translateY(${-(indexRef.current[w]-1)*ITEM_H}px)`; }
    });
    setLanded(['','','']);
    setSpinning([false,false,false]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const spinWheel = (w, duration) => {
    if (spinning[w]) return;
    const bank = banks[w];
    const L = bank.length;
    const cur = indexRef.current[w];
    const curBase = ((cur%L)+L)%L;
    const t = Math.floor(Math.random()*L);
    const forward = ((t-curBase)%L+L)%L;
    const loops = 8 + Math.floor(Math.random()*4);
    const newIndex = cur + loops*L + forward + (forward===0?L:0);
    indexRef.current[w] = newIndex;
    targetRef.current[w] = newIndex%L;
    const el = stripRefs[w].current;
    if (el) { el.style.transition=`transform ${duration}ms cubic-bezier(0.12,0.0,0.08,1.0)`; el.style.transform=`translateY(${-(newIndex-1)*ITEM_H}px)`; }
    setSpinning(s => { const n=[...s]; n[w]=true; return n; });
  };

  const spinWheelTo = (w, targetIdx, duration) => {
    if (spinning[w]) return;
    const bank = banks[w];
    const L = bank.length;
    const cur = indexRef.current[w];
    const curBase = ((cur%L)+L)%L;
    const forward = ((targetIdx-curBase)%L+L)%L;
    const loops = 4 + Math.floor(Math.random()*3);
    const newIndex = cur + loops*L + forward + (forward===0?L:0);
    indexRef.current[w] = newIndex;
    targetRef.current[w] = newIndex%L;
    const el = stripRefs[w].current;
    if (el) { el.style.transition=`transform ${duration}ms cubic-bezier(0.16,1,0.3,1)`; el.style.transform=`translateY(${-(newIndex-1)*ITEM_H}px)`; }
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

  const B2B_VALID_PAIRS = {0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 3: [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 24, 25, 26, 28], 4: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28], 5: [0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 6: [2, 7, 8, 18, 21, 22], 7: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 8: [0, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23, 24, 25, 26, 28], 9: [0, 2, 3, 4, 5, 7, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 23, 24, 25, 26, 27, 28], 10: [0, 2, 3, 4, 5, 9, 10, 13, 14, 16, 17, 19, 20, 23, 24, 25, 26], 11: [0, 1, 2, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 24, 25, 26, 27, 28], 12: [0, 1, 4, 5, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28], 13: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 14: [0, 9, 11, 12, 13, 14, 15, 17, 19, 20, 22, 23, 24, 25, 26, 27]};

  const CONSUMER_VALID_PAIRS = {0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 3: [0, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29], 4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 5: [0, 2, 4, 6, 7, 9, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 6: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 7: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29], 8: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 10: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 29], 11: [0, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29], 12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 13: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 14: [0, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29]};

  const spinAll = () => {
    if (anySpinning) return;
    const validPairs = mode === 'b2b' ? B2B_VALID_PAIRS : CONSUMER_VALID_PAIRS;
    // Pick a random valid action first, then a compatible experience/workflow
    const actionIdx = Math.floor(Math.random() * banks[0].length);
    const allowed = validPairs[actionIdx] || [...Array(banks[1].length).keys()];
    const expIdx = allowed[Math.floor(Math.random() * allowed.length)];
    const audienceIdx = Math.floor(Math.random() * banks[2].length);
    spinWheelTo(0, actionIdx, 3000);
    spinWheelTo(1, expIdx, 3600);
    spinWheelTo(2, audienceIdx, 4200);
  };

  const complete = landed.every(Boolean);

  useEffect(() => {
    if (complete && !anySpinning && onResult) {
      const v = landed[0]; const w = landed[1]; const ind = landed[2];

      const thirdPerson = (s) => s.toLowerCase();
      const title = `${w.replace(/\b\w/g, c => c.toUpperCase())} for ${ind.replace(/\b\w/g, c => c.toUpperCase())}`;
      const tagline = m.name === 'B2B'
        ? `A B2B agent that ${thirdPerson(v)} ${w} in the ${ind} industry.`
        : `A consumer app that ${thirdPerson(v)} ${w} for ${ind}.`;
      const blurb = m.name === 'B2B'
        ? `Built for ${ind} teams that need to ${v.toLowerCase()} ${w} faster, with less manual work and more consistency.`
        : `Built for ${ind} who want a simpler way to ${v.toLowerCase()} ${w} without another bloated app.`;
      onResult({
        action:v,
        workflow:w,
        industry:ind,
        connector:m.connector,
        modeName:m.name,
        label:m.name,
        title,
        tagline,
        blurb,
        freeformIdea:m.name === 'B2B' ? `${v.toLowerCase()} ${w} in the ${ind} industry` : `${v.toLowerCase()} ${w} ${m.connector} ${ind}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, anySpinning]);

  const prefix = m.prefix;
  const conn = m.connector;
  const liveVerb = landed[0] ? landed[0].toLowerCase() : '';

  return (
    <div className="sm-root">
      {/* mode toggle */}
      <div className="sm-modebar">
        {Object.keys(MODES).map(k => (
          <button key={k} className={`sm-modebtn${mode===k?' on':''}`} onClick={()=>setMode(k)} disabled={anySpinning}>
            {MODES[k].name}
          </button>
        ))}
      </div>

      {/* reels */}
      <div className="sm-cabinet">
        {/* Marquee header */}
        <div className="sm-marquee">
          <div className="sm-marquee-title">Idea Generator</div>
          <div className="sm-marquee-sub">Spin to discover your next venture</div>
        </div>

        {/* Reels */}
        <div className="sm-reels-outer">
          {/* Column labels */}
          <div className="sm-labels-row">
            {m.labels.map((label,w) => (
              <div className="sm-collabel" key={w}>{label}</div>
            ))}
          </div>

          <div className="sm-reels-wrap">
            <div className="sm-reels">
              {banks.map((bank,w) => {
                const repeated = Array.from({length:REPEATS},()=>bank).flat();
                return (
                  <div className="sm-col" key={mode+w} style={{'--accent':REEL_TINTS[w]}}>
                    <div className="sm-window" onClick={()=>!anySpinning&&spinWheel(w,3200)}>
                      <div className="sm-strip" ref={stripRefs[w]} onTransitionEnd={()=>onSettle(w)}>
                        {repeated.map((word,i)=>(
                          <div className="sm-item" key={i} style={{height:ITEM_H}}>{word}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sm-payline-bar"/>
          </div>
          <div className="sm-reels-ledge"/>
        </div>
        <div className="sm-base">
          <div className="sm-btn-housing">
            <button className="sm-spin" onClick={spinAll} disabled={anySpinning}>
              {anySpinning ? '✦  Spinning…' : '✦  Generate Idea'}
            </button>
          </div>
      </div>

      {/* live sentence under reels */}
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

/* ── Confetti + EUREKA overlay ─────────────────────────────── */
function FullConfetti() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#c084fc','#f0abfc','#818cf8','#fb7185','#fbbf24','#34d399','#60a5fa','#fff'];
    const pieces = Array.from({length:180}, (_, i) => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      w: 6 + Math.random() * 10,
      h: 4 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      opacity: 1,
    }));

    let frame;
    let tick = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;
      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.vy += 0.05; // gravity
        if (tick > 120) p.opacity -= 0.008;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      if (pieces.some(p => p.opacity > 0 && p.y < canvas.height + 50)) {
        frame = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9999}}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
      <div style={{
        position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-60%)',
        textAlign:'center', animation:'eurekaIn .5s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{
          fontSize:'clamp(48px,10vw,96px)', fontWeight:900,
          fontFamily:'var(--font-head)',
          background:'linear-gradient(120deg,#fbbf24,#f59e0b,#fcd34d,#fbbf24)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          filter:'drop-shadow(0 0 30px rgba(251,191,36,0.8))',
          letterSpacing:'-0.02em',
          lineHeight:1,
        }}>EUREKA!</div>
        <div style={{
          fontSize:'clamp(14px,2.5vw,22px)', color:'rgba(255,255,255,0.9)',
          fontWeight:700, marginTop:12, letterSpacing:'0.05em',
          textShadow:'0 2px 20px rgba(0,0,0,0.5)',
        }}>Strong market signal detected ✦</div>
      </div>
      <style>{`
        @keyframes eurekaIn {
          from { opacity:0; transform:translate(-50%,-60%) scale(0.5); }
          to { opacity:1; transform:translate(-50%,-60%) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function IdeaWheel() {
  const [screen, setScreen] = useState("landing");  // landing | wheel | validate | blueprint
  const [authChecked, setAuthChecked] = useState(false);
  const [idea, setIdea]     = useState(null);
  const [credits, setCredits] = useState(3);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser]       = useState(null);   // logged-in user
  const [hasAccount, setHasAccount]   = useState(false);  // ever signed up

  // validate state
  const [validating, setValidating] = useState(false);
  const [comp, setComp]             = useState(null);
  const [validateErr, setValidateErr] = useState("");

  // blueprint state  — pipeline stages: null | 1-4 | "done"
  const [bpStage, setBpStage]   = useState(null);
  const [design, setDesign]     = useState(null);
  const [gtm, setGtm]           = useState(null);
  const [infra, setInfra]       = useState(null);
  const [proto, setProto]       = useState(null);
  const [bpErr, setBpErr]       = useState("");
  const [protoOpen, setProtoOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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
    // check Supabase session — gate wheel behind auth
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setAuthUser(data.session.user);
        try { localStorage.setItem("ideaWheelHasAccount", "1"); } catch {}
        setHasAccount(true);
        setScreen("wheel");
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
    setIdea(segment);
    setComp(null); setValidateErr("");
    setDesign(null); setGtm(null); setInfra(null); setProto(null);
    setBpStage(null); setBpErr("");
    goTo("wheel");
  };

  /* ── FREE VALIDATE ── */
  const runValidate = async () => {
    if (!idea) return;
    setValidating(true); setComp(null); setValidateErr("");
    try {
      const res = await fetch("/api/pipeline/validate", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          freeformIdea: ideaSummary(idea),
          modeName: idea.label,
          sessionId: "",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setComp(data.comp);
      if ((data.comp?.score ?? 0) >= 85) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
    } catch(e) {
      setValidateErr(e.message.includes("AI_CREDITS") || e.message.includes("temporarily") ? "Our AI is taking a short break. Please try again in a minute." : "Market check failed. " + e.message);
    } finally {
      setValidating(false);
    }
  };

  /* ── PAID BLUEPRINT ── */
  const runBlueprint = async () => {
    const cost = creditCost(comp?.score ?? 0);
    if (!comp || credits < cost) { setShowPricing(true); return; }
    setCredits(c => c - cost);
    setBpStage(1); setBpErr("");
    setDesign(null); setGtm(null); setInfra(null); setProto(null);
    setProtoOpen(false);

    const base = {
      freeformIdea: ideaSummary(idea),
      modeName: idea.label,
      sessionId: "",
      validationId: comp.validationId,
      comp,
    };
    const api = (body) => fetch("/api/pipeline/build", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
    }).then(r => r.json());

    try {
      // Stage 1 – designer
      const d = await api({ ...base, stage:"designer" });
      if (d.error) throw new Error(d.error);
      setDesign(d.result); setBpStage(2);

      // Stage 2 – launch
      const g = await api({ ...base, stage:"launch", design: d.result });
      if (g.error) throw new Error(g.error);
      setGtm(g.result); setBpStage(3);

      // Stage 3 – infrastructure
      const inf = await api({ ...base, stage:"infrastructure", design: d.result, gtm: g.result });
      if (inf.error) throw new Error(inf.error);
      setInfra(inf.result); setBpStage(4);

      // Stage 4 – prototype
      const pr = await api({ ...base, stage:"builder", design: d.result, gtm: g.result, infra: inf.result });
      if (pr.error) throw new Error(pr.error);
      setProto(pr.result); setBpStage("done");
    } catch(e) {
      setCredits(c => c + creditCost(comp?.score ?? 0));
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
  const vt        = comp?.verdictType || "build";

  /* ── SCREENS ── */
  return (
    <div className="su-root">
      {mounted && <style>{CSS}</style>}
      <Confetti active={showConfetti} />

      {/* atmospheric blobs */}
      <div className="su-blob" style={{ width:500, height:500, top:"-8%", left:"-6%", background:"#7c3aed" }}/>
      <div className="su-blob" style={{ width:440, height:440, bottom:"-12%", right:"-6%", background:"#ff4d8d", animationDelay:"-7s" }}/>

      {/* ── NAV ── */}
      <nav className="su-nav">
        <button className="su-nav-brand" onClick={() => goTo("landing")}>IdeaReels</button>
        <div className="su-nav-links">
                    <a className="su-nav-link" href="/pricing">Pricing</a>
          {authUser ? (
            <a className="su-nav-link su-nav-link--cta" href="/profile">Profile</a>
          ) : hasAccount ? (
            <a className="su-nav-link su-nav-link--cta" href="/profile">Log in</a>
          ) : (
            <a className="su-nav-link su-nav-link--cta" href="/profile">Sign up</a>
          )}
        </div>
      </nav>

      {/* ── LANDING ── */}
      {screen === "landing" && (
        <section className="su-screen su-landing">
          <div className="su-landing-inner">

            <h1 className="su-display su-landing-h1">
              <span style={{ display:"block" }}>Your startup idea</span>
              <span className="su-grad-text" style={{ display:"block", paddingRight:"6px", paddingBottom:"16px" }}>is one spin away.</span>
            </h1>
            <p className="su-landing-sub">
              Spin the reels to find your next business idea. Our AI agents validate the market for you and hand you a detailed blueprint, recommended architecture, go-to-market strategy and clear steps to create your prototype.
            </p>

            <div className="su-landing-cta">
              <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
                <button className="su-btn su-btn-primary su-btn-lg" onClick={() => authUser ? goTo("wheel") : window.location.assign("/profile")}>
                  Get started
                </button>
                <button className="su-btn su-btn-ghost su-btn-lg" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior:"smooth", block:"start" })}>
                  How it works
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
                    <div className="su-hiw-t">Know if it's worth building, for free</div>
                    <div className="su-hiw-d">Every idea gets a real market check with competitor analysis, market size, and demand signals, so you get a clear build, caution, or avoid verdict before spending a dollar.</div>
                  </div>
                </div>
                <div className="su-hiw-connector" aria-hidden />
                <div className="su-hiw-step">
                  <div className="su-hiw-num">3</div>
                  <div>
                    <div className="su-hiw-t">Turn the winner into a build-ready plan</div>
                    <div className="su-hiw-d">One credit unlocks four AI specialists, product design, launch strategy, infrastructure, and prototype generation, so you get a complete blueprint you can act on immediately.</div>
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
          <SlotMachine onResult={(result) => {
            setIdea(result); setComp(null); setValidateErr("");
          }}/>
          {/* Validate button + inline results */}
          {idea && (
            <div className="sm-validate-section">
              {!comp && !validating && !validateErr && (
                <div className="sm-result-cta">
                  <button className="su-btn su-btn-primary su-btn-lg" onClick={runValidate}>
                    Validate this market — free →
                  </button>
                </div>
              )}

              {validating && (
                <div className="su-scan su-glass" style={{marginTop:24}}>
                  <div className="su-scan-bar"><div className="su-scan-fill"/></div>
                  <div className="su-scan-text">⚡ Scanning demand, market size & competition…</div>
                </div>
              )}

              {validateErr && (
                <p className="su-err" style={{marginTop:16}}>
                  {validateErr} <button className="su-retry" onClick={runValidate}>Retry</button>
                </p>
              )}

              {comp && !validating && (
                <div className="su-validate-grid" style={{marginTop:24}}>
                  <div className="su-card su-v-score">
                    <ScoreRing value={comp.score ?? 65} label="Demand"/>
                    <div className="su-v-score-side">
                      <span className="su-chip" style={{
                        background: vt==="avoid"?"#dc2626":vt==="warning"?"#d97706":"#16a34a",
                        color:"#fff", border:"none"
                      }}>
                        {vt==="avoid"?"High":vt==="warning"?"Medium":"Low"} competition
                      </span>
                      <p className="su-v-verdict">{comp.verdict || comp.verdictReasoning}</p>
                    </div>
                  </div>

                  <div className="su-card su-v-market">
                    <div className="su-v-market-cell">
                      <div className="su-v-k su-grad-text">{comp.marketSize || "—"}</div>
                      <div className="su-v-l">Market size</div>
                    </div>
                    {comp.gap && (
                      <div className="su-v-gap">
                        <div className="su-v-gap-label">The gap</div>
                        <p>{comp.gap}</p>
                      </div>
                    )}
                  </div>

                  {(comp.players||[]).length > 0 && (
                    <div className="su-card su-v-signals">
                      <div className="su-v-signals-head">Key players</div>
                      {(comp.players||[]).slice(0,3).map((pl,i) => (
                        <div className="su-v-signal" key={i}>
                          <div className="su-v-signal-top">
                            <span>{pl.name}</span><b>{pl.pricing||"—"}</b>
                          </div>
                          <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{pl.weakness}</div>
                          <Meter value={60+Math.random()*30} delay={200+i*150}/>
                        </div>
                      ))}
                    </div>
                  )}

                  {vt !== "avoid" && (() => {
                    const score = comp.score ?? 0;
                    const cl = creditLabel(score);
                    const cost = cl.cost;
                    return (
                      <div className="su-v-cta">
                        {score >= 85 && (
                          <div className="su-v-exceptional">
                            🎉 This idea scored in the top tier — it has genuine potential.
                          </div>
                        )}
                        <div className="su-v-cta-text">
                          {score >= 85 ? "Build this before someone else does." : "Signal is strong. Ready to turn this into a real plan?"}
                        </div>
                        <div className="su-v-cta-row">
                          <button className="su-btn su-btn-primary su-btn-lg" onClick={() => { goTo("blueprint"); if (!bpDone && !bpRunning) runBlueprint(); }}>
                            ✦ Generate the blueprint
                            <span className="su-credit-badge" style={{background: cl.color}}>
                              {cost} credit{cost > 1 ? 's' : ''}
                            </span>
                          </button>
                          <button className="su-creditpill" onClick={() => setShowPricing(true)}>
                            <span className="su-creditnum">{credits}</span>
                            <span className="su-creditlbl">credits</span>
                          </button>
                        </div>
                        <div className="su-v-hint">
                          <span style={{color: cl.color, fontWeight:700}}>{cl.tier}</span>
                          {' · '}validation always free{' · '}you have {credits} credits
                        </div>
                      </div>
                    );
                  })()}

                  {vt === "avoid" && (
                    <div className="su-v-cta su-v-cta--avoid">
                      <div className="su-v-cta-text">⛔ Crowded market — consider a different angle.</div>
                      {comp.pivotHint && <p style={{fontSize:13,color:"var(--muted)",margin:"8px 0 0"}}>{comp.pivotHint}</p>}
                      <button className="su-btn su-btn-ghost" onClick={() => { setComp(null); setIdea(null); }}>↩ Spin again</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── BLUEPRINT ── */}
      {screen === "blueprint" && idea && (
        <section className="su-screen su-blueprint">
          <div className="su-screen-head">
            <div className="su-eyebrow">Step three · The plan</div>
            <h2 className="su-display su-screen-title">
              The <span className="su-grad-text">{idea.title}</span> blueprint
            </h2>
            <p className="su-screen-desc">{idea.blurb}</p>
          </div>

          {bpRunning && !design && (
            <div className="su-scan su-glass">
              <div className="su-scan-bar"><div className="su-scan-fill"/></div>
              <div className="su-scan-text">✦ Drafting product, launch plan, infrastructure &amp; prototype…</div>
            </div>
          )}

          {bpErr && <p className="su-err">{bpErr} <button className="su-retry" onClick={runBlueprint}>Retry</button></p>}

          {/* Pipeline progress */}
          {(bpRunning || bpDone) && (
            <div className="su-pip-progress">
              {[{n:1,label:"Product"},{n:2,label:"Launch"},{n:3,label:"Infra"},{n:4,label:"Prototype"}].map(({n,label}) => {
                const done = bpDone || (typeof bpStage === "number" && bpStage > n);
                const running = typeof bpStage === "number" && bpStage === n;
                return (
                  <div key={n} className={`su-pip-step ${done?"done":""} ${running?"running":""}`}>
                    <div className="su-pip-dot">{done?"✓":running?<span className="su-spin-sm"/>:n}</div>
                    <span className="su-pip-label">{label}</span>
                  </div>
                );
              })}
              <div className="su-pip-track">
                <div className="su-pip-fill" style={{ width: bpDone?"100%":typeof bpStage==="number"?`${((bpStage-1)/4)*100}%`:"0%" }}/>
              </div>
            </div>
          )}

          {(design || gtm || infra || proto) && (
            <div className="su-bp-grid">
              {/* Product */}
              {/* 1. Niche + Problem */}
              {design && (
                <div className="su-card su-bp-card su-bp-card--full">
                  <div className="su-bp-head"><span className="su-bp-icon">◎</span><h3 className="su-bp-title">Niche & Problem</h3></div>
                  <p className="su-bp-summary" style={{fontSize:14,color:'var(--ink)'}}>{design.niche}</p>
                </div>
              )}

              {/* 2. Product Concept */}
              {design && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-icon">◈</span><h3 className="su-bp-title">Product Concept</h3></div>
                  <p className="su-bp-name su-grad-text">{design.name}</p>
                  <p className="su-bp-summary">{design.tagline}</p>
                  <p className="su-bp-summary">{design.differentiator}</p>
                  <div className="su-bp-list-label">MVP scope</div>
                  <ul className="su-bp-list">{(design.coreFeatures||[]).map((f,i)=><li key={i}>{f}</li>)}</ul>
                </div>
              )}

              {/* 3. Target User + Why Now */}
              {gtm && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-icon">👤</span><h3 className="su-bp-title">Target User</h3></div>
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
                  <div className="su-bp-head"><span className="su-bp-icon">⚡</span><h3 className="su-bp-title">Competitor & Gap</h3></div>
                  {comp.marketSize && <p className="su-bp-name su-grad-text" style={{fontSize:20}}>{comp.marketSize}</p>}
                  {comp.gap && <p className="su-bp-summary" style={{color:'var(--ink)'}}>{comp.gap}</p>}
                  {(comp.players||[]).length>0 && <>
                    <div className="su-bp-list-label">Key players</div>
                    <ul className="su-bp-list">{(comp.players||[]).slice(0,3).map((pl,i)=><li key={i}><strong>{pl.name}</strong> — {pl.weakness}</li>)}</ul>
                  </>}
                </div>
              )}

              {/* 5. Pricing */}
              {gtm?.pricing && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-icon">💰</span><h3 className="su-bp-title">Pricing Idea</h3></div>
                  <div className="su-bp-pricebox">
                    <span className="su-grad-text">{gtm.pricing.price}</span>
                    <span>{gtm.pricing.rationale}</span>
                    {gtm.pricing.trial && <span style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>{gtm.pricing.trial}</span>}
                  </div>
                  <div className="su-bp-kpis" style={{marginTop:12}}>
                    <div className="su-bp-kpi"><span className="su-grad-text">{gtm.revenueGoal}</span><small>30-day target</small></div>
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
                  <div className="su-bp-head"><span className="su-bp-icon">📣</span><h3 className="su-bp-title">Landing Page Angle</h3></div>
                  <p className="su-bp-summary" style={{fontSize:15,color:'var(--ink)',fontStyle:'italic',lineHeight:1.7}}>"{design.landingAngle}"</p>
                </div>
              )}

              {/* 7. Infra */}
              {infra && (
                <div className="su-card su-bp-card">
                  <div className="su-bp-head"><span className="su-bp-icon">⬡</span><h3 className="su-bp-title">Infrastructure</h3></div>
                  {(infra.services||[]).length>0 && <>
                    <div className="su-bp-list-label">Services</div>
                    <div className="su-bp-chips">{(infra.services||[]).map((s,i)=><span className="su-chip" key={i}>{s.name}</span>)}</div>
                  </>}
                  {infra.buildOrder && <p className="su-bp-summary" style={{marginTop:10,color:'var(--ink)'}}>{infra.buildOrder}</p>}
                  {infra.monthlyCost && (
                    <div className="su-bp-costs">
                      {Object.entries(infra.monthlyCost).map(([k,v],i) => (
                        <div key={i} className="su-bp-cost-cell">
                          <span className="su-grad-text">{v}</span>
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
                  <div className="su-bp-head"><span className="su-bp-icon">⌨️</span><h3 className="su-bp-title">First Prompt for Cursor / Claude / Codex</h3></div>
                  <pre className="su-bp-cursor-prompt">{gtm.cursorPrompt}</pre>
                </div>
              )}

              {/* Prototype */}
              {proto && (
                <div className="su-card su-bp-card su-bp-card--proto">
                  <div className="su-bp-head"><span className="su-bp-icon">▣</span><h3 className="su-bp-title">Prototype</h3></div>
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
                <div className="su-display su-bp-footer-t">That's a company in 3 spins.</div>
                <div className="su-bp-footer-d">Not feeling it? Draw another frontier and compare.</div>
              </div>
              <div className="su-bp-footer-actions">
                <button className="su-btn su-btn-ghost" onClick={() => { goTo("wheel"); setIdea(null); }}>↺ Spin again</button>
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
            <p className="su-modal-sub">Each credit runs the full 4-agent blueprint pipeline.</p>
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
      <div className="su-disclaimer"><div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:10,flexWrap:"wrap"}}><a href="/faq" style={{fontSize:12,color:"#7a7191",textDecoration:"none",fontWeight:500}}>FAQ</a><a href="/pricing" style={{fontSize:12,color:"#7a7191",textDecoration:"none",fontWeight:500}}>Pricing</a><a href="/privacy" style={{fontSize:12,color:"#7a7191",textDecoration:"none",fontWeight:500}}>Privacy</a><a href="/terms" style={{fontSize:12,color:"#7a7191",textDecoration:"none",fontWeight:500}}>Terms</a></div>
        <p>© {new Date().getFullYear()} IdeaReels · AI-generated content is for informational purposes only, not professional advice.</p>
      </div>
    </div>
  );
}

const CHIP_POS = [
  {x:7,y:19},{x:80,y:13},{x:14,y:62},{x:86,y:56},
  {x:4,y:41},{x:90,y:35},{x:6,y:84},{x:89,y:82},
];

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
/* atmospheric backdrop */
.su-root { min-height:100vh; position:relative; overflow:hidden; }
.su-blob {
  position:fixed; border-radius:50%; filter:blur(70px); opacity:.38; z-index:0;
  pointer-events:none; animation:sudrift 22s ease-in-out infinite;
}
@keyframes sudrift { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.12)} }

/* nav */
.su-nav {
  position:relative; z-index:10;
  max-width:860px; margin:20px auto 0;
  display:flex; align-items:center; justify-content:flex-end;
  padding:8px 20px;
  background:none; border:none; box-shadow:none;
}
.su-nav-brand {
  font-family:var(--font-display); font-size:15px; font-weight:800;
  color:var(--ink); letter-spacing:-.02em; background:none; border:none; cursor:pointer;
}
.su-nav-links { display:flex; align-items:center; gap:8px; }
.su-nav-link {
  font-size:13px; font-weight:600; color:var(--muted);
  text-decoration:none; padding:7px 14px; border-radius:var(--r-sm);
  border:1px solid transparent; transition:all .15s;
}
.su-nav-link:hover { color:var(--ink); background:var(--bg-2); }
.su-nav-link--cta { color:var(--ink); border-color:var(--line); background:var(--bg-2); }
.su-nav-link--cta:hover { border-color:var(--violet); color:var(--violet); }
.su-nav-avatar {
  width:20px; height:20px; border-radius:50%;
  background:var(--grad-brand); color:#fff;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:10px; font-weight:800; flex-shrink:0;
}

/* screens */
.su-screen {
  position:relative; z-index:1;
  max-width:860px; margin:0 auto;
  padding:60px 20px 80px;
}
.su-screen-head { text-align:center; margin-bottom:48px; }
.su-eyebrow {
  font-size:12px; font-weight:600; letter-spacing:.14em; text-transform:uppercase;
  color:var(--magenta); margin-bottom:14px;
}
.su-display { font-family:var(--font-display); font-weight:700; letter-spacing:-.03em; line-height:.98; }
.su-screen-title { font-size:clamp(30px,4vw,46px); color:var(--ink); margin:0 0 14px; }
.su-screen-desc { font-size:16px; color:var(--muted); margin:0; line-height:1.6; }
.su-grad-text {
  background:var(--grad-brand); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
}

/* landing */
.su-landing { min-height:90vh; display:flex; align-items:center; justify-content:center; padding:40px 20px; }
.su-landing-chips { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.su-float-chip {
  position:absolute; display:inline-flex; align-items:center; gap:7px;
  padding:7px 13px; border-radius:var(--r-pill);
  background:rgba(255,255,255,0.72); border:1px solid var(--line);
  font-size:12px; font-weight:600; color:var(--ink-2);
  backdrop-filter:blur(8px);
  animation:sufloat 5s ease-in-out infinite;
}
@keyframes sufloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
.su-float-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.su-landing-inner { text-align:center; max-width:960px; margin:0 auto; position:relative; z-index:2; padding:0 32px; display:flex; flex-direction:column; align-items:center; }
.su-landing-h1 { font-size:clamp(48px,7vw,88px); padding-bottom:4px; line-height:1.15; overflow:visible; text-align:center; color:#18112b; color:var(--ink); margin:0 0 22px; }
.su-landing-sub { font-size:18px; color:var(--muted); margin:16px auto 32px; line-height:1.65; max-width:680px; }
.su-landing-cta { display:flex; flex-direction:column; align-items:center; gap:12px; margin:36px 0 20px; }
.su-landing-cta-row { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
.su-landing-meta { font-size:13px; color:var(--faint); }
.su-landing-free { font-size:12px; color:var(--faint); margin:0; }

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
  background:var(--grad-brand);
  color:#fff;
  flex-shrink:0;
}
.su-value-t { font-weight:700; font-size:14px; color:var(--ink); margin-bottom:8px; line-height:1.3; }
.su-value-d { font-size:13px; color:var(--muted); line-height:1.65; }
.su-landing-steps { display:flex; gap:0; justify-content:center; flex-wrap:wrap; }
.su-landing-steps { display:flex; flex-direction:column; gap:0; margin-top:36px; max-width:560px; text-align:left; }
.su-land-step { display:flex; align-items:flex-start; gap:16px; padding:16px 0; border-top:1px solid var(--line); }
.su-land-step:last-child { border-bottom:1px solid var(--line); }
.su-land-step-n { font-family:var(--font-display); font-size:20px; font-weight:700; flex-shrink:0; padding-top:2px; }
.su-land-step-t { font-weight:700; font-size:14px; color:var(--ink); margin-bottom:4px; }
.su-land-step-d { font-size:13px; color:var(--muted); line-height:1.6; }

/* buttons */
.su-btn {
  display:inline-flex; align-items:center; gap:8px;
  font-family:var(--font-body); font-weight:700; font-size:14px;
  padding:12px 22px; border-radius:var(--r-md); cursor:pointer;
  border:none; transition:all .18s ease; text-decoration:none;
}
.su-btn-primary {
  background:var(--grad-brand); color:#fff;
  box-shadow:0 8px 28px -10px rgba(200,38,211,.5);
}
.su-btn-primary:hover { filter:brightness(1.07); transform:translateY(-1px); }
.su-btn-primary:active { transform:scale(.98); }
.su-btn-ghost {
  background:rgba(255,255,255,.7); color:var(--ink-2);
  border:1.5px solid var(--line); backdrop-filter:blur(6px);
}
.su-btn-ghost:hover { border-color:var(--violet); color:var(--violet); }
.su-btn-lg { font-size:16px; padding:15px 28px; border-radius:var(--r-lg); }

/* chip */
.su-chip {
  display:inline-flex; align-items:center; gap:6px;
  padding:5px 12px; border-radius:var(--r-pill);
  font-size:12px; font-weight:600;
  background:var(--bg-2); border:1px solid var(--line-2);
  color:var(--ink-2);
}

/* wheel */
.su-wheel-screen .su-screen-head { margin-bottom:36px; }
.su-wheel-stage { display:grid; grid-template-columns:1fr 1fr; gap:40px; align-items:start; }
@media(max-width:700px){ .su-wheel-stage { grid-template-columns:1fr; } }
.su-wheel-wrap { position:relative; width:320px; height:320px; margin:0 auto; }
.su-wheel-pointer {
  position:absolute; top:-20px; left:50%; transform:translateX(-50%);
  z-index:4; filter:drop-shadow(0 2px 6px rgba(80,20,110,.18));
}
.su-wheel-shadow {
  position:absolute; bottom:-10px; left:50%; transform:translateX(-50%);
  width:260px; height:30px; border-radius:50%;
  background:radial-gradient(closest-side, rgba(80,20,110,.18), transparent);
}
.su-wheel-svg { width:100%; height:100%; display:block; }
.su-wheel-hub {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  width:68px; height:68px; border-radius:50%; z-index:5;
  background:#fff; border:3px solid var(--line-2);
  box-shadow:0 4px 20px -6px rgba(80,20,110,.28);
  display:grid; place-items:center; cursor:pointer;
  transition:all .18s; font-family:var(--font-display);
}
.su-wheel-hub:hover:not(:disabled) { box-shadow:0 6px 28px -6px rgba(124,58,237,.45); border-color:var(--violet); }
.su-wheel-hub:disabled { cursor:default; }
.su-hub-inner { display:flex; flex-direction:column; align-items:center; gap:2px; }
.su-hub-spark { font-size:16px; background:var(--grad-brand); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.su-hub-label { font-size:9px; font-weight:800; letter-spacing:.14em; color:var(--muted); }
.su-hub-dots { display:flex; gap:5px; }
.su-hub-dots i { width:6px; height:6px; border-radius:50%; background:var(--grad-brand); animation:sudots .8s ease-in-out infinite; }
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
  background:var(--grad-brand); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
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
  background:rgba(255,255,255,0.78); backdrop-filter:blur(10px);
  border:1px solid var(--line); border-radius:var(--r-xl);
  padding:24px; box-shadow:var(--sh-sm);
}
.su-glass { background:rgba(255,255,255,0.58); backdrop-filter:blur(14px); border:1px solid var(--line); border-radius:var(--r-lg); }

/* scan */
.su-scan { padding:24px; margin-bottom:32px; }
.su-scan-bar { height:4px; border-radius:4px; background:var(--line-2); overflow:hidden; margin-bottom:12px; }
.su-scan-fill { height:100%; width:45%; border-radius:4px; background:var(--grad-brand); animation:suscan 1.8s ease-in-out infinite; }
@keyframes suscan { 0%{margin-left:-45%;width:45%} 100%{margin-left:100%;width:45%} }
.su-scan-text { font-size:14px; color:var(--muted); font-weight:500; }

/* validate grid */
.su-validate-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media(max-width:640px){ .su-validate-grid { grid-template-columns:1fr; } }
.su-v-score { display:flex; align-items:flex-start; gap:20px; }
.su-v-score-side { display:flex; flex-direction:column; gap:12px; }
.su-v-verdict { font-size:13px; color:var(--ink-2); line-height:1.6; margin:0; }
.su-v-market { display:flex; flex-direction:column; gap:16px; }
.su-v-market-cell { display:flex; flex-direction:column; gap:4px; }
.su-v-k { font-family:var(--font-display); font-size:26px; font-weight:700; line-height:1; }
.su-v-l { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.su-v-gap { padding:12px 14px; background:var(--bg-2); border-radius:var(--r-sm); }
.su-v-gap-label { font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--violet); margin-bottom:6px; }
.su-v-gap p { font-size:13px; color:var(--ink); margin:0; line-height:1.5; font-weight:500; }
.su-v-signals { grid-column:1/-1; }
.su-v-signals-head { font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:14px; }
.su-v-signal { margin-bottom:12px; }
.su-v-signal-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; font-size:13px; color:var(--ink); }
.su-v-signal-top b { font-size:12px; color:var(--muted); }
.su-meter-track { height:7px; border-radius:7px; background:var(--bg-2); overflow:hidden; }
.su-meter-fill { height:100%; border-radius:7px; background:var(--grad-brand); }
.su-v-cta { grid-column:1/-1; text-align:center; padding:28px; background:rgba(255,255,255,.6); border:1.5px solid var(--line); border-radius:var(--r-xl); backdrop-filter:blur(8px); }
.su-v-cta--avoid { background:rgba(254,226,226,.6); border-color:rgba(220,38,38,.2); }
.su-v-cta-text { font-size:15px; font-weight:600; color:var(--ink); margin-bottom:18px; line-height:1.5; }
.su-v-cta-row { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; }
.su-v-hint { font-size:11.5px; color:var(--faint); margin-top:10px; }
.su-v-exceptional {
  background:linear-gradient(120deg,rgba(124,58,237,.1),rgba(255,77,141,.1));
  border:1.5px solid rgba(124,58,237,.3); border-radius:var(--r-md);
  padding:12px 16px; margin-bottom:16px;
  font-size:14px; font-weight:600; color:var(--ink); line-height:1.5;
  animation:eurekapulse 2s ease-in-out infinite;
}
@keyframes eurekapulse {
  0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.15)}
  50%{box-shadow:0 0 20px 6px rgba(124,58,237,.12)}
}
.su-credit-badge {
  display:inline-flex; align-items:center; padding:2px 8px;
  border-radius:99px; font-size:11px; font-weight:800;
  color:#fff; margin-left:6px; letter-spacing:.04em;
}
.su-creditpill {
  display:flex; flex-direction:column; align-items:center; gap:2px;
  padding:10px 14px; background:var(--bg-2);
  border:1.5px solid var(--line); border-radius:var(--r-md); cursor:pointer;
  transition:all .15s;
}
.su-creditpill:hover { border-color:var(--violet); }
.su-creditnum { font-family:var(--font-display); font-size:18px; font-weight:800; color:var(--ink); line-height:1; }
.su-creditlbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }

/* blueprint */
.su-pip-progress {
  position:relative; display:grid; grid-template-columns:repeat(4,1fr);
  background:rgba(255,255,255,.72); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:16px 20px 14px;
  margin-bottom:28px; overflow:hidden;
}
.su-pip-track { position:absolute; bottom:0; left:0; right:0; height:3px; background:var(--line); }
.su-pip-fill { height:100%; background:var(--grad-brand); transition:width .6s var(--ease-out); }
.su-pip-step { display:flex; flex-direction:column; align-items:center; gap:6px; }
.su-pip-dot {
  width:28px; height:28px; border-radius:50%;
  display:grid; place-items:center;
  font-family:var(--font-display); font-size:11px; font-weight:800;
  background:var(--bg-2); border:1.5px solid var(--line);
  color:var(--muted); transition:all .3s;
}
.su-pip-step.running .su-pip-dot { border-color:var(--magenta); color:var(--magenta); background:rgba(192,38,211,.08); box-shadow:0 0 0 4px rgba(192,38,211,.1); }
.su-pip-step.done .su-pip-dot { border-color:var(--violet); color:var(--violet); background:rgba(124,58,237,.08); }
.su-pip-label { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
.su-pip-step.running .su-pip-label { color:var(--magenta); }
.su-pip-step.done .su-pip-label { color:var(--violet); }
.su-spin-sm { display:inline-block; width:11px; height:11px; border:2px solid rgba(192,38,211,.25); border-top-color:var(--magenta); border-radius:50%; animation:suspin .7s linear infinite; }
@keyframes suspin { to{transform:rotate(360deg)} }
.su-bp-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:32px; }
@media(max-width:640px){ .su-bp-grid { grid-template-columns:1fr; } }
.su-bp-card {}
.su-bp-card--proto { grid-column:1/-1; }
.su-bp-card--full { grid-column:1/-1; }
.su-bp-cursor-prompt {
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;
  line-height:1.75; color:var(--ink); background:var(--bg-2);
  border:1px solid var(--line-2); border-radius:var(--r-sm);
  padding:16px; white-space:pre-wrap; word-break:break-word; margin:0;
}
.su-bp-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.su-bp-icon { font-size:20px; background:var(--grad-brand); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.su-bp-title { font-family:var(--font-display); font-size:15px; font-weight:700; color:var(--ink); margin:0; }
.su-bp-name { font-family:var(--font-display); font-size:22px; font-weight:700; margin:0 0 6px; line-height:1; }
.su-bp-summary { font-size:13px; color:var(--muted); margin:0 0 12px; line-height:1.6; }
.su-bp-list-label { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.su-bp-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.su-bp-list li { font-size:13px; color:var(--ink); padding-left:16px; position:relative; line-height:1.5; }
.su-bp-list li::before { content:"→"; position:absolute; left:0; color:var(--violet); font-size:11px; top:1px; }
.su-bp-list--ol { counter-reset:ol; }
.su-bp-list--ol li::before { content:counter(ol); counter-increment:ol; font-family:var(--font-display); font-size:10px; font-weight:800; color:var(--magenta); top:2px; }
.su-bp-kpis { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.su-bp-kpi { background:var(--bg-2); border-radius:var(--r-sm); padding:10px 12px; display:flex; flex-direction:column; gap:3px; }
.su-bp-kpi span { font-family:var(--font-display); font-size:15px; font-weight:700; }
.su-bp-kpi small { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.su-bp-pricebox { margin-top:14px; padding:12px 14px; background:var(--bg-2); border-radius:var(--r-sm); display:flex; flex-direction:column; gap:4px; }
.su-bp-pricebox span:first-child { font-family:var(--font-display); font-size:20px; font-weight:700; }
.su-bp-pricebox span:last-child { font-size:12px; color:var(--muted); line-height:1.5; }
.su-bp-chips { display:flex; flex-wrap:wrap; gap:6px; }
.su-bp-env { font-size:11px; background:rgba(18,17,43,.88); color:#c4b5fd; border-radius:var(--r-sm); padding:12px; white-space:pre-wrap; word-break:break-all; margin:0; line-height:1.7; }
.su-bp-costs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
.su-bp-cost-cell { text-align:center; background:var(--bg-2); border-radius:var(--r-sm); padding:10px 8px; }
.su-bp-cost-cell span { font-family:var(--font-display); font-size:14px; font-weight:700; display:block; }
.su-bp-cost-cell small { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.su-proto-toggle {
  display:inline-flex; align-items:center; gap:6px;
  font-size:13px; font-weight:600; color:var(--violet);
  background:rgba(124,58,237,.07); border:1.5px solid rgba(124,58,237,.2);
  border-radius:var(--r-sm); padding:7px 14px; cursor:pointer; margin-bottom:14px;
  transition:all .15s;
}
.su-proto-toggle:hover { background:rgba(124,58,237,.14); }
.su-proto-wrap { border:1px solid var(--line); border-radius:var(--r-md); overflow:hidden; }
.su-proto-chrome { display:flex; align-items:center; gap:6px; padding:10px 14px; background:var(--bg-2); border-bottom:1px solid var(--line); }
.su-proto-chrome span { width:10px; height:10px; border-radius:50%; }
.su-proto-chrome span:nth-child(1){background:#ff5f57} .su-proto-chrome span:nth-child(2){background:#febc2e} .su-proto-chrome span:nth-child(3){background:#28c840}
.su-proto-url { margin-left:10px; font-size:11px; color:var(--muted); background:var(--surface); border:1px solid var(--line); border-radius:4px; padding:2px 10px; }
.su-bp-footer { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:28px; background:rgba(255,255,255,.7); border:1px solid var(--line); border-radius:var(--r-xl); flex-wrap:wrap; }
.su-bp-footer-t { font-size:22px; color:var(--ink); margin-bottom:4px; }
.su-bp-footer-d { font-size:13px; color:var(--muted); }
.su-bp-footer-actions { display:flex; gap:10px; flex-wrap:wrap; }

/* pricing modal */
.su-modal-overlay { position:fixed; inset:0; background:rgba(18,11,40,.45); backdrop-filter:blur(6px); z-index:100; display:grid; place-items:center; }
.su-modal { background:#fff; border-radius:var(--r-xl); padding:28px; max-width:420px; width:90%; box-shadow:var(--sh-lg); }
.su-modal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.su-modal-head span { font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--ink); }
.su-modal-head button { font-size:16px; color:var(--muted); }
.su-modal-sub { font-size:13px; color:var(--muted); margin:0 0 20px; line-height:1.5; }
.su-pkgs { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.su-pkg { display:flex; flex-direction:column; gap:3px; padding:14px; background:var(--bg-2); border:1.5px solid var(--line); border-radius:var(--r-md); }
.su-pkg--hl { border-color:var(--violet); background:rgba(124,58,237,.06); }
.su-pkg-label { font-family:var(--font-display); font-size:12px; font-weight:700; color:var(--ink); }
.su-pkg-credits { font-size:13px; color:var(--muted); }
.su-pkg-price { font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--ink); line-height:1; }
.su-pkg-per { font-size:11px; color:var(--muted); margin-bottom:8px; }
.su-pkg-btn { font-size:12px; font-weight:700; color:#fff; background:var(--grad-brand); border-radius:var(--r-sm); padding:8px 0; cursor:pointer; transition:all .15s; }
.su-pkg-btn:hover { filter:brightness(1.07); }
.su-pkg-btn:disabled { opacity:.6; cursor:wait; }

/* util */
.su-err { font-size:13px; color:#dc2626; margin:12px 0; }
.su-retry { background:none; border:none; color:var(--violet); cursor:pointer; font-size:13px; text-decoration:underline; }

/* disclaimer */
.su-disclaimer { position:relative; z-index:1; max-width:760px; margin:0 auto 40px; padding:20px 24px; border-top:1px solid var(--line); text-align:center; }
.su-disclaimer p { font-size:11px; color:var(--faint); line-height:1.7; margin:0; }

/* ── how it works ─────────────────────────────────────────────────── */
.su-hiw {
  margin-top:32px; width:100%;
  padding:8px 0;
  text-align:left;
}
.su-hiw-label {
  font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
  color:var(--muted); margin-bottom:24px; text-align:center;
}
.su-hiw-steps { display:flex; flex-direction:column; gap:0; }
.su-hiw-step { display:flex; align-items:flex-start; gap:18px; }
.su-hiw-num {
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  background:transparent; border:2px solid var(--violet); color:var(--violet);
  display:flex; align-items:center; justify-content:center;
  font-family:var(--font-display); font-size:14px; font-weight:800;
}
.su-hiw-t { font-weight:700; font-size:15px; color:var(--ink); margin-bottom:6px; }
.su-hiw-d { font-size:13px; color:var(--muted); line-height:1.65; }
.su-hiw-connector {
  width:1.5px; height:24px; background:var(--line);
  margin:8px 0 8px 17px;
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
  background:var(--grad-brand); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  letter-spacing:-.02em; flex-shrink:0;
}
.su-combos-text { font-size:14px; color:var(--muted); font-weight:500; line-height:1.4; }

/* ── reviews ──────────────────────────────────────────────────────── */
.su-reviews { margin-top:32px; width:100%; }
.su-reviews-label {
  font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
  color:var(--muted); text-align:center; margin-bottom:20px;
}
.su-reviews-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
@media(max-width:640px){ .su-reviews-grid { grid-template-columns:1fr; } }
.su-review-card {
  background:rgba(255,255,255,0.72); backdrop-filter:blur(10px);
  border:1px solid var(--line); border-radius:var(--r-lg);
  padding:20px; display:flex; flex-direction:column; gap:12px;
  text-align:left;
}
.su-review-stars { color:var(--magenta); font-size:14px; letter-spacing:2px; }
.su-review-text { font-size:13px; color:var(--ink-2); line-height:1.65; margin:0; flex:1; }
.su-review-author { display:flex; align-items:center; gap:10px; }
.su-review-avatar {
  width:32px; height:32px; border-radius:50%; flex-shrink:0;
  background:var(--grad-brand); color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:800;
}
.su-review-name { font-size:13px; font-weight:700; color:var(--ink); }
.su-review-role { font-size:11px; color:var(--muted); }

/* ── landing footer links ─────────────────────────────────────────── */
.su-landing-footer {
  margin-top:32px; padding-top:24px; border-top:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; gap:12px;
  color:var(--faint); font-size:13px;
}
.su-landing-footer-link { color:var(--muted); text-decoration:none; font-weight:500; }
.su-landing-footer-link:hover { color:var(--violet); }

/* ── slot machine ─────────────────────────────────────────────────── */
.sm-root { width:100%; max-width:760px; margin:0 auto; }

/* ── Mode toggle ── */
.sm-modebar { display:flex; gap:10px; justify-content:center; margin-bottom:24px; }
.sm-modebtn {
  font-family:var(--font-body); font-size:14px; font-weight:700;
  color:rgba(180,140,255,0.8); padding:10px 28px; border-radius:99px;
  border:1.5px solid rgba(180,100,255,0.25); background:rgba(255,255,255,0.04);
  cursor:pointer; transition:all .2s; letter-spacing:0.02em;
}
.sm-modebtn:hover:not(:disabled) { color:rgba(220,180,255,1); border-color:rgba(180,100,255,0.5); background:rgba(150,80,255,0.1); }
.sm-modebtn.on {
  color:#fff; background:linear-gradient(120deg,#7c3aed,#c026d3);
  border-color:transparent;
  box-shadow:0 0 24px rgba(180,80,255,0.5), 0 4px 16px rgba(0,0,0,0.4);
}
.sm-modebtn:disabled { opacity:.4; cursor:default; }

/* ── Cabinet — the physical machine body ── */
.sm-cabinet {
  position:relative;
  background:linear-gradient(175deg, #1c0f35 0%, #0e0620 40%, #180a30 100%);
  border-radius:32px;
  padding:0;
  overflow:hidden;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.06) inset,
    0 0 0 3px rgba(120,50,220,0.15) inset,
    0 60px 120px -20px rgba(5,0,20,0.95),
    0 0 80px -10px rgba(120,50,220,0.35),
    0 20px 40px -10px rgba(0,0,0,0.8);
}

/* Chrome trim top */
.sm-cabinet::before {
  content:'';
  position:absolute; top:0; left:0; right:0; height:4px;
  background:linear-gradient(90deg,
    transparent 0%, rgba(200,150,255,0.3) 20%,
    rgba(255,255,255,0.6) 50%,
    rgba(200,150,255,0.3) 80%, transparent 100%
  );
  z-index:10;
}

/* Inner top glow */
.sm-cabinet::after {
  content:'';
  position:absolute; top:0; left:0; right:0; height:120px;
  background:radial-gradient(ellipse at 50% 0%, rgba(140,60,255,0.2) 0%, transparent 70%);
  pointer-events:none; z-index:1;
}

/* ── Cabinet header / marquee ── */
.sm-marquee {
  position:relative; z-index:5;
  text-align:center;
  padding:20px 24px 16px;
  border-bottom:1px solid rgba(180,100,255,0.15);
  background:linear-gradient(180deg, rgba(80,20,160,0.3) 0%, transparent 100%);
}
.sm-marquee-title {
  font-family:var(--font-head);
  font-size:clamp(18px,3vw,26px);
  font-weight:900;
  letter-spacing:0.12em;
  text-transform:uppercase;
  background:linear-gradient(120deg, #e0b0ff, #fff, #c084fc);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  text-shadow:none;
  filter:drop-shadow(0 0 12px rgba(180,100,255,0.6));
}
.sm-marquee-sub {
  font-size:10px; letter-spacing:0.2em; text-transform:uppercase;
  color:rgba(180,140,255,0.5); margin-top:4px;
}

/* ── Reels container ── */
.sm-reels-outer {
  padding:16px 20px 0;
  position:relative; z-index:5;
}

/* Column labels row */
.sm-labels-row {
  display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
  margin-bottom:8px;
}
.sm-collabel {
  text-align:center; font-size:9px; font-weight:900;
  letter-spacing:0.25em; text-transform:uppercase;
  color:rgba(180,130,255,0.6);
  background:rgba(100,50,200,0.15);
  border:1px solid rgba(150,80,255,0.15);
  border-radius:6px;
  padding:5px 0;
}

/* The 3-reel display */
.sm-reels-wrap {
  position:relative;
  border-radius:16px;
  overflow:hidden;
  /* Chrome bezel */
  background:linear-gradient(180deg, #2a1a4a 0%, #1a0d30 100%);
  box-shadow:
    0 0 0 2px rgba(120,60,220,0.4),
    0 0 0 4px rgba(60,20,100,0.6),
    0 0 0 5px rgba(200,150,255,0.1),
    inset 0 2px 4px rgba(0,0,0,0.8),
    inset 0 0 40px rgba(0,0,0,0.5);
}
.sm-reels {
  display:grid; grid-template-columns:repeat(3,1fr); gap:0;
  /* The actual reel drum - dark inside */
  background:linear-gradient(180deg, #080412 0%, #0d0820 100%);
}

/* Column dividers — look like physical separators */
.sm-col {
  display:flex; flex-direction:column; gap:0;
  border-right:2px solid rgba(80,30,150,0.6);
  position:relative;
}
.sm-col:last-child { border-right:none; }

/* Individual reel window */
.sm-window {
  height:240px; overflow:hidden; border-radius:0;
  background:transparent; border:none;
  cursor:pointer; position:relative;
}

/* Top/bottom shadow to simulate physical drum curve */
.sm-window::before {
  content:'';
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    rgba(8,4,18,1) 0%,
    rgba(8,4,18,0.95) 12%,
    rgba(8,4,18,0.6) 25%,
    rgba(8,4,18,0.1) 35%,
    transparent 45%,
    transparent 55%,
    rgba(8,4,18,0.1) 65%,
    rgba(8,4,18,0.6) 75%,
    rgba(8,4,18,0.95) 88%,
    rgba(8,4,18,1) 100%
  );
  pointer-events:none; z-index:2;
}
.sm-window::after { display:none; }
.sm-window:hover {}

/* Reel strip */
.sm-strip { will-change:transform; pointer-events:none; user-select:none; }

/* Individual item on the reel */
.sm-item {
  display:flex; align-items:center; justify-content:center;
  text-align:center; padding:0 14px;
  font-size:clamp(10px,1.4vw,15px); font-weight:800;
  text-transform:uppercase;
  color:rgba(220,200,255,0.85);
  line-height:1.2; letter-spacing:0.05em;
  pointer-events:none; user-select:none;
  /* Subtle separator */
  border-bottom:1px solid rgba(80,40,160,0.2);
}

/* ── Payline — the glowing center line ── */
.sm-payline-bar {
  position:absolute; left:0; right:0;
  top:50%; transform:translateY(-50%);
  height:80px;
  pointer-events:none; z-index:5;
  /* Neon top and bottom lines */
  border-top:1.5px solid rgba(220,150,255,0.8);
  border-bottom:1.5px solid rgba(220,150,255,0.8);
  /* Glow through the center */
  background:linear-gradient(180deg,
    rgba(160,80,255,0.12) 0%,
    rgba(180,100,255,0.18) 50%,
    rgba(160,80,255,0.12) 100%
  );
  box-shadow:
    0 0 12px rgba(200,120,255,0.4),
    0 0 40px rgba(180,80,255,0.15),
    inset 0 0 20px rgba(180,100,255,0.08);
}

/* Active item highlight (center slot) */
.sm-payline-bar::before {
  content:'';
  position:absolute; inset:0;
  background:linear-gradient(90deg,
    transparent 0%,
    rgba(180,100,255,0.06) 20%,
    rgba(200,120,255,0.1) 50%,
    rgba(180,100,255,0.06) 80%,
    transparent 100%
  );
}

/* Side chrome trim lines */
.sm-reels-wrap::before {
  content:'';
  position:absolute; left:0; top:0; bottom:0; width:3px;
  background:linear-gradient(180deg, rgba(200,150,255,0.15), rgba(120,60,200,0.3), rgba(200,150,255,0.15));
  z-index:10;
}
.sm-reels-wrap::after {
  content:'';
  position:absolute; right:0; top:0; bottom:0; width:3px;
  background:linear-gradient(180deg, rgba(200,150,255,0.15), rgba(120,60,200,0.3), rgba(200,150,255,0.15));
  z-index:10;
}

/* ── Bottom of reels — chrome ledge ── */
.sm-reels-ledge {
  height:8px;
  background:linear-gradient(180deg, rgba(80,40,160,0.4), rgba(40,15,80,0.8));
  border-top:1px solid rgba(120,60,200,0.3);
  margin:0 0 0 0;
}

/* ── Generate button section ── */
.sm-base {
  display:flex; flex-direction:column; align-items:center;
  padding:20px 24px 24px;
  position:relative; z-index:5;
  gap:12px;
}

/* Button housing */
.sm-btn-housing {
  position:relative;
  background:linear-gradient(180deg, rgba(60,20,120,0.4), rgba(30,10,60,0.6));
  border-radius:20px;
  padding:16px 24px;
  border:1px solid rgba(120,60,200,0.2);
  width:100%;
  display:flex; align-items:center; justify-content:center;
}

.sm-spin {
  font-family:var(--font-body); font-size:18px; font-weight:900;
  color:#fff; padding:18px 56px; border:none; border-radius:14px;
  letter-spacing:0.06em; text-transform:uppercase;
  background:linear-gradient(135deg, #9333ea 0%, #c026d3 40%, #e11d7a 80%, #f43f5e 100%);
  cursor:pointer; min-width:260px; position:relative;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.1) inset,
    0 0 30px rgba(180,60,255,0.5),
    0 0 60px rgba(180,60,255,0.25),
    0 10px 30px rgba(0,0,0,0.5);
  transition:all .2s;
  animation:spinbtnpulse 2.5s ease-in-out infinite;
}
@keyframes spinbtnpulse {
  0%,100% { box-shadow:0 0 0 1px rgba(255,255,255,0.1) inset, 0 0 30px rgba(180,60,255,0.5), 0 0 60px rgba(180,60,255,0.25), 0 10px 30px rgba(0,0,0,0.5); }
  50% { box-shadow:0 0 0 1px rgba(255,255,255,0.15) inset, 0 0 50px rgba(180,60,255,0.75), 0 0 100px rgba(180,60,255,0.4), 0 10px 30px rgba(0,0,0,0.5); }
}
.sm-spin:hover:not(:disabled) {
  transform:translateY(-2px) scale(1.02);
  animation:none;
  box-shadow:0 0 0 1px rgba(255,255,255,0.2) inset, 0 0 60px rgba(200,80,255,0.9), 0 0 120px rgba(180,60,255,0.5), 0 14px 40px rgba(0,0,0,0.6);
}
.sm-spin:active:not(:disabled) { transform:scale(.97) translateY(1px); }
.sm-spin:disabled { opacity:.4; cursor:default; animation:none; }

/* ── Live sentence ── */
.sm-live-sentence {
  width:100%;
  padding:14px 20px;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(150,80,255,0.2);
  border-radius:12px;
  text-align:center; min-height:52px;
  display:flex; align-items:center; justify-content:center;
}
.sm-live-sentence p { margin:0; font-size:14px; line-height:1.7; color:rgba(200,175,255,0.8); }
.sm-live-sentence .sm-slot {
  display:inline-block; font-weight:900; padding:1px 6px; border-radius:6px;
  background:linear-gradient(120deg,#c084fc,#f0abfc);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  font-size:15px;
}
.sm-live-sentence .sm-slot-empty {
  display:inline-block; width:80px; height:12px; border-radius:4px;
  background:rgba(150,80,255,0.2); vertical-align:middle; margin:0 4px;
  animation:smpulse 1.2s ease-in-out infinite;
}
@keyframes scorePulse {
  0%,100% { transform:scale(1); }
  50% { transform:scale(1.08); }
}
@keyframes smpulse { 0%,100%{opacity:.4} 50%{opacity:.9} }

.sm-result-cta {
  margin-top:20px; text-align:center;
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
.su-laptop-mode.on { background:var(--grad-brand); color:#fff; border-color:transparent; }
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
.su-laptop-btn { display:flex; align-items:center; justify-content:center; background:var(--grad-brand); color:#fff; border-radius:12px; padding:11px; font-size:13px; font-weight:700; }

/* responsive */
@media(max-width:640px){
  .su-nav { margin-top:12px; border-radius:var(--r-lg); }
  .su-screen { padding:40px 16px 60px; }
  .su-landing-h1 { font-size:42px; }
  .su-wheel-wrap { width:280px; height:280px; }
  .su-bp-grid,.su-validate-grid { grid-template-columns:1fr; }
  .su-v-signals { grid-column:auto; }
  .su-v-cta { grid-column:auto; }
  .su-pip-progress { grid-template-columns:repeat(2,1fr); }
}
`;
