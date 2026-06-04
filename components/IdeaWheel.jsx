"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Lock, Unlock, Dices, Plus, X, Copy, Check, Trash2, ArrowRight, Zap, Volume2, VolumeX, Share2, Search, Paintbrush, Code2, ChevronDown, ChevronUp, Rocket } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/pricing";

/* ------------------------------------------------------------------ *
 * THE IDEA WHEEL  ·  v5
 * Spin → Build it → three coordinated agents run:
 *   1. COMPETITOR SCOUT  (web search, finds gaps)
 *   2. PRODUCT DESIGNER  (names it, specs it)
 *   3. PROTOTYPE BUILDER (ships working HTML, rendered inline)
 * The sophistication of the pipeline IS the moat.
 * ------------------------------------------------------------------ */

const MODES = {
  b2b: {
    name: 'B2B', connector: 'in', prefix: 'I want to build an agent that',
    labels: ['ACTION', 'WORKFLOW', 'FOR'],
    banks: [
      ['Automate','Streamline','Replace','Predict','Personalize','Match','Summarize','Track','Verify','Forecast','Simplify','Detect','Schedule','Score','Recommend','Flag','Translate','Eliminate','Analyze','Extract'],
      ['customer onboarding','invoice matching','appointment scheduling','lead qualification','expense approval','contract review','quote generation','manual data entry','quality inspection','dispatch routing','document intake','incident triage','client check-ins','compliance checks','due diligence','RFP responses','performance reviews','shift handoffs','returns handling','onboarding docs'],
      ['Healthcare','Construction','Logistics','Legal services','Property management','Insurance','Dental practices','Field services','Auto repair','Veterinary clinics','Accounting firms','Staffing agencies','Home services','Real estate','Restaurants','Pharmacies','Distribution','Freelancers','Consultants','Financial analysts','Entertainment & media','Sports organizations','Non-profits','Government agencies','E-commerce brands','Marketing agencies','Mental health practices','Gaming studios','EdTech companies','Fintech startups','Architecture firms','Event planning','Cleaning services','Food & beverage','AI startups','Trucking & freight','Mortgage & lending','HR & people ops','Cybersecurity firms','Publishing & content'],
    ],
    hiAction: ['Automate','Predict','Detect','Forecast','Flag','Extract','Analyze'],
    loAction: ['Organize','Connect','Track'],
    hiThing: ['invoice matching','dispatch routing','incident triage','compliance checks','quality inspection','due diligence','contract review'],
    hiCtx: ['Field services','Auto repair','Veterinary clinics','Dental practices','Home services','Construction','Distribution','Freelancers','Consultants','Cleaning services','Mental health practices','Non-profits','Event planning','Architecture firms'],
    loCtx: ['Healthcare','Insurance','Legal services','Real estate'],
  },
  consumer: {
    name: 'Consumer', connector: 'for', prefix: 'I want to make an app that',
    labels: ['ACTION', 'EXPERIENCE', 'FOR'],
    banks: [
      ['Track','Plan','Personalize','Simplify','Remind','Organize','Discover','Budget','Coach','Gamify','Curate','Automate','Teach','Guide','Challenge','Reward','Optimize','Analyze','Improve','Streamline'],
      ['daily habits','personal goals','health tracking','money management','skill learning','sleep & recovery','mental wellness','meal planning','productivity','social connections','career growth','home organization','travel planning','stress management','time management','reading & learning','side income','kids education','creative projects','community building','relationship building','fitness routines','job searching','saving money','staying motivated','building a business','managing a team','learning a language'],
      ['new parents','couples','college students','freelancers','athletes','dog owners','renters','recent immigrants','family caregivers','retirees','content creators','ADHD adults','frequent travelers','young children','homeschool families','anxious people','night shift workers','new homeowners','musicians','seniors living alone','solopreneurs','remote workers','job seekers','new graduates','small business owners','expats','fitness beginners','busy professionals'],
    ],
    hiAction: ['Personalize','Coach','Match','Gamify'],
    loAction: ['Share','Organize'],
    hiThing: ['daily habits','mental wellness','money management','stress management','side income','sleep & recovery','staying motivated','skill learning','building a business'],
    hiCtx: ['family caregivers','recent immigrants','ADHD adults','retirees','seniors living alone','anxious people','homeschool families','night shift workers','new parents','job seekers'],
    loCtx: ['couples','college students','frequent travelers','athletes','musicians'],
  },
};
const TINTS = ["var(--reel1)", "var(--reel2)", "var(--reel3)"];
const ITEM_H = 80;
const REPEATS = 12;
const HOME_COPY = 4;

const reduceMotion =
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rand = (n) => Math.floor(Math.random() * n);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function conjugate(v) {
  const w = v.toLowerCase();
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  if (/(s|sh|ch|x|z)$/.test(w)) return w + "es";
  return w + "s";
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function scoreCombo(m, a, t, c) {
  let s = 46;
  if (m.hiAction.includes(a)) s += 8; else if (m.loAction.includes(a)) s -= 4;
  if (m.hiThing.includes(t)) s += 10;
  if (m.hiCtx.includes(c)) s += 12; else if (m.loCtx.includes(c)) s -= 6;
  s += hashStr(a + "|" + t + "|" + c) % 15;
  return Math.max(12, Math.min(96, s));
}
function band(score) {
  if (score >= 80) return { label: "Goldmine", color: "var(--amber)", desc: "Rare combo — high pain, clear whitespace, active market" };
  if (score >= 66) return { label: "Spicy",    color: "var(--teal)",  desc: "Strong signal — real problem with room to build" };
  if (score >= 52) return { label: "Solid",    color: "var(--violet)",desc: "Decent opportunity — worth validating before building" };
  return              { label: "Sleeper",   color: "var(--muted)", desc: "Low signal — market may be thin or crowded" };
}

// Real, verified community sources for every wheel option.
// These feed into scout + GTM prompts so they always reference real places.
const COMMUNITY_META = {
  // ── B2B Industries ──────────────────────────────────────────────
  "Healthcare":          { find: ["r/healthIT (56K)", "HIMSS Slack", "r/medicine", "Health IT Answers forum"], size: "$4.3T market, 6,000+ health systems" },
  "Construction":        { find: ["r/Construction (280K)", "r/contractorsofreddit", "ConstructionJunkie community"], size: "750K contractors in the US" },
  "Logistics":           { find: ["r/logistics (43K)", "r/supplychain (78K)", "FreightWaves Slack", "r/Trucking"], size: "$1.6T US logistics market" },
  "Legal services":      { find: ["r/LawFirm", "r/paralegal (40K)", "Lawyerist Slack", "Above the Law forums"], size: "440K law firms in the US" },
  "Property management": { find: ["r/PropertyManagement (38K)", "BiggerPockets forums (1M+)", "r/landlord (120K)"], size: "300K property management companies" },
  "Insurance":           { find: ["r/Insurance (45K)", "r/InsuranceAgent", "InsurancePro Slack", "CPCU community"], size: "$1.4T US insurance premium market" },
  "Dental practices":    { find: ["r/dentistry (200K)", "Dental Town forum", "AADOM Slack", "r/DentalHygiene"], size: "185K practices in the US" },
  "Field services":      { find: ["r/HVAC (85K)", "r/plumbing (40K)", "Jobber community", "r/electricians (55K)"], size: "500K+ field service businesses" },
  "Restaurants":         { find: ["r/restaurantowners (95K)", "r/KitchenConfidential (900K)", "Toast community", "r/ChefKnives"], size: "1M restaurants in the US" },
  "Auto repair":         { find: ["r/MechanicAdvice (300K)", "r/AutoRepair (80K)", "NAPA ProLink community", "ATI forums"], size: "165K independent shops" },
  "Veterinary clinics":  { find: ["r/Vetmed (100K)", "r/VetTech (65K)", "VIN community", "AVMA forums"], size: "30K vet clinics in the US" },
  "Accounting firms":    { find: ["r/taxpros (90K)", "r/Accounting (350K)", "AICPA forums", "Accounting Web community"], size: "140K CPA firms in the US" },
  "Staffing agencies":   { find: ["r/recruiting (90K)", "r/humanresources (220K)", "ERE community", "SHRM forums"], size: "25K staffing agencies in the US" },
  "Home services":       { find: ["r/HomeImprovement (2M)", "r/HomeOwners", "Angi Pro community", "r/Construction"], size: "600K home service businesses" },
  "Real estate":         { find: ["r/realestateinvesting (2M)", "r/RealEstate (1.7M)", "BiggerPockets (2M)", "r/FirstTimeHomeBuyer"], size: "3M licensed agents in the US" },
  "Fitness studios":     { find: ["r/personaltraining (45K)", "r/gymowners", "Mindbody community", "PFP Magazine forums"], size: "110K fitness studios in the US" },
  "Pharmacies":          { find: ["r/pharmacy (60K)", "r/PharmacyTech (70K)", "NCPA community", "r/PharmacyStudents"], size: "88K pharmacies in the US" },
  "Senior care":         { find: ["r/caregivers (45K)", "r/AgingParents", "NAHC forums", "Leading Age community"], size: "$400B senior care market" },
  "Distribution":        { find: ["r/logistics", "r/supplychain", "DC Velocity forums", "NAW community"], size: "165K wholesale distributors" },
  "Hospitality":         { find: ["r/Hospitality (15K)", "r/TalesFromTheFrontDesk (700K)", "AHLA community", "Lodging Interactive forums"], size: "54K hotels in the US" },
  "Freelancers":         { find: ["r/freelance (230K)", "r/freelanceWriters", "Indie Hackers (100K)", "r/digitalnomad (1.8M)"], size: "60M freelancers in the US" },
  "Consultants":         { find: ["r/consulting (90K)", "r/MBA", "Consultant Ninja forums", "Management Consulted community"], size: "700K consulting firms in the US" },
  "Financial analysts":  { find: ["r/finance (1.8M)", "r/financialanalysis", "Wall Street Oasis", "CFA Institute forums"], size: "300K financial analysts in the US" },

  // ── New B2B Industries ──────────────────────────────────────────
  "Entertainment & media":   { find: ["r/filmmakers (280K)", "r/videoediting (340K)", "r/podcasting (220K)", "ProductionHUB community"], size: "$2.3T global entertainment market" },
  "Sports organizations":    { find: ["r/SportsBusiness (45K)", "r/sportsmanagement", "SBJ community", "TeamWork Online forums"], size: "500K+ sports orgs in the US" },
  "Non-profits":             { find: ["r/nonprofit (120K)", "NTC Slack (10K nonprofits)", "CharityVillage", "NTEN community"], size: "1.8M registered non-profits in the US" },
  "Government agencies":     { find: ["r/govtech (15K)", "GovLoop (300K)", "Code for America community", "Digital.gov community"], size: "90K government entities in the US" },
  "E-commerce brands":       { find: ["r/ecommerce (150K)", "r/shopify (200K)", "Shopify Partners Slack", "r/Entrepreneur (2.6M)"], size: "$1.1T US e-commerce market" },
  "Marketing agencies":      { find: ["r/marketing (1.4M)", "r/agency (45K)", "Smart Insights community", "Agency Management Institute"], size: "180K marketing agencies in the US" },
  "Mental health practices": { find: ["r/therapists (90K)", "r/psychotherapy (50K)", "Therapy Brands community", "SimplePractice forums"], size: "130K mental health practices in the US" },
  "Gaming studios":          { find: ["r/gamedev (600K)", "r/indiegaming (150K)", "GameDevLeague Slack", "GDC community"], size: "$200B+ global games market" },
  "EdTech companies":        { find: ["r/elearning (50K)", "r/EdTech (40K)", "EdSurge community", "ISTE forums"], size: "$340B global EdTech market by 2025" },
  "Fintech startups":        { find: ["r/fintech (80K)", "r/FinancialTechnology (45K)", "FinTech Sandbox community", "Money 20/20 network"], size: "$340B global fintech market" },
  "Architecture firms":      { find: ["r/architecture (1.4M)", "r/ArchitecturalDesign", "AIA Knowledge Community", "Archinect forums"], size: "120K architecture firms in the US" },
  "Event planning":          { find: ["r/eventplanning (50K)", "r/weddingplanning (900K)", "Event Planners Association", "NACE community"], size: "$1.1T global events market" },
  "Cleaning services":       { find: ["r/cleaningbusiness (25K)", "r/janitorial", "Cleaning Business Academy", "ISSA community"], size: "1.2M cleaning businesses in the US" },
  "Food & beverage":         { find: ["r/foodbusiness (30K)", "r/foodtrucks (90K)", "r/FoodService", "National Restaurant Association"], size: "$900B US food & beverage industry" },
  "AI startups":             { find: ["r/MachineLearning (2.7M)", "r/artificial (2M)", "Hacker News (YC community)", "AI Twitter / r/singularity"], size: "$200B+ AI market by 2026" },
  "Trucking & freight":      { find: ["r/Trucking (140K)", "r/FreightBrokers (35K)", "Truckers Report forums", "DAT community"], size: "$900B US freight market" },
  "Mortgage & lending":      { find: ["r/mortgage (170K)", "r/FirstTimeHomeBuyer (400K)", "Mortgage Bankers Association", "NAMB community"], size: "$4T US mortgage market" },
  "HR & people ops":         { find: ["r/humanresources (220K)", "r/recruiting (90K)", "SHRM community (340K)", "People Ops community Slack"], size: "700K HR professionals in the US" },
  "Cybersecurity firms":     { find: ["r/netsec (150K)", "r/cybersecurity (800K)", "DEFCON community", "ISACA community"], size: "$200B+ global cybersecurity market" },
  "Publishing & content":    { find: ["r/selfpublish (110K)", "r/writing (1.9M)", "Alliance of Independent Authors", "r/blogger (50K)"], size: "55K publishing companies in the US" },

  "TikTok creators":         { find: ["r/Tiktokhelp (200K)", "r/TikTokCreators", "Creator Marketplace community", "TikTok Shop Seller Center"], size: "1B+ TikTok users, $20B creator economy" },
  "newsletter writers":      { find: ["r/newsletters (30K)", "r/beehiiv", "Substack community", "r/EmailMarketing (100K)"], size: "500M+ newsletter subscribers globally" },
  "YouTubers":               { find: ["r/NewTubers (275K)", "r/youtube (800K)", "Creator Insider community", "r/videography"], size: "51M YouTube channels worldwide" },
  "Twitch streamers":        { find: ["r/Twitch (550K)", "r/streaming (120K)", "r/letsplay", "StreamElements community"], size: "8M active Twitch streamers" },
  "podcast hosts":           { find: ["r/podcasting (220K)", "Podcast Movement community", "r/podcasters", "Buzzsprout community"], size: "4M+ active podcasts globally" },
  "affiliate marketers":     { find: ["r/Affiliatemarketing (90K)", "r/juststart (110K)", "Authority Hacker community", "r/SEO (250K)"], size: "$17B affiliate marketing industry" },
  "Etsy sellers":            { find: ["r/EtsySellers (90K)", "r/Etsy (120K)", "Etsy Seller Handbook community", "r/smallbusiness"], size: "9M active Etsy sellers" },
  "print-on-demand sellers": { find: ["r/passive_income (430K)", "r/redbubble (30K)", "Printful community", "r/Merch"], size: "$9.9B print-on-demand market by 2026" },
  "indie game developers":   { find: ["r/gamedev (600K)", "r/indiegaming (150K)", "GameDevLeague Slack", "r/Unity3D (270K)"], size: "$90B+ indie game market share of $200B industry" },
  "affiliate product research":{ find: ["r/Affiliatemarketing","r/juststart","r/SEO"], size: "Top workflow pain for 73% of affiliate marketers" },
  "commission tracking":     { find: ["r/Affiliatemarketing","r/ecommerce (150K)","r/dropship (85K)"], size: "Manual tracking costs affiliates 8hrs/week avg" },
  "content scheduling":      { find: ["r/socialmedia (200K)","r/marketing (1.4M)","Buffer community","Hootsuite community"], size: "$17B social media management market" },
  "social media growth":     { find: ["r/socialmedia","r/Instagram (1.5M)","r/TikTokHelp","r/youtube"], size: "4.9B social media users worldwide" },
  // ── Consumer audiences (including education & family) ──────────

  "toddlers (ages 2-4)":    { find: ["r/toddlers (350K)", "r/Parenting (1.6M)", "r/beyondthebump (1.1M)", "What to Expect community"], size: "18M toddlers in the US, $40B kids app market" },
  "young children (5-8)":   { find: ["r/Parenting (1.6M)", "r/Teachers (300K)", "r/HomeschoolRecovery", "Common Sense Media community"], size: "32M children ages 5-8 in the US" },
  "tweens & teens":         { find: ["r/teenagers (2.4M)", "r/Parenting", "r/Teachers", "r/highschool (450K)"], size: "42M teens in the US, $143B teen spending market" },
  "homeschool families":    { find: ["r/homeschool (180K)", "r/homeschooling", "HSLDA community", "Homeschool.com forums"], size: "3.3M homeschooled students in the US" },
  "special needs learners": { find: ["r/specialeducation (45K)", "r/autism (200K)", "r/ADHD (1.1M)", "CHADD community"], size: "7M students with IEPs in the US" },
  "adult learners":         { find: ["r/learnprogramming (3.8M)", "r/Coursera", "r/ArtificialIntelligence", "Duolingo community"], size: "36M adults enrolled in continuing education" },
  "anxious people":         { find: ["r/Anxiety (950K)", "r/mentalhealth (450K)", "r/therapy (90K)", "7 Cups community"], size: "40M adults with anxiety disorders in the US" },
  "night shift workers":    { find: ["r/nursing (180K)", "r/911dispatchers", "r/SecurityGuards", "r/overnights"], size: "15M night shift workers in the US" },
  "solo travelers":         { find: ["r/solotravel (1.6M)", "r/travel (12M)", "r/backpacking (330K)", "Lonely Planet community"], size: "25M solo travelers annually in the US" },
  "new homeowners":         { find: ["r/FirstTimeHomeBuyer (400K)", "r/HomeImprovement (2M)", "r/DIY (520K)", "r/personalfinance"], size: "4M first-time homebuyers per year in the US" },
  "pet owners":             { find: ["r/pets (700K)", "r/dogs (3M)", "r/cats (5.7M)", "r/Pets (general)"], size: "90M households with pets in the US" },
  "gardeners":              { find: ["r/gardening (4.6M)", "r/vegetablegardening (490K)", "r/houseplants (2.4M)", "GardenWeb community"], size: "55M households garden in the US" },
  "musicians":              { find: ["r/WeAreTheMusicMakers (600K)", "r/Guitar (1.1M)", "r/piano (250K)", "r/singing (150K)"], size: "54M amateur musicians in the US" },
  "athletes":               { find: ["r/running (2.8M)", "r/cycling (620K)", "r/weightroom (450K)", "r/AdvancedRunning (350K)"], size: "175M Americans exercise regularly" },
  "seniors living alone":   { find: ["r/AgingParents (60K)", "r/eldercare", "AARP community (38M members)", "r/retirement (120K)"], size: "14M seniors living alone in the US" },
  "phonics & reading":      { find: ["r/learnreading", "r/Teachers (300K)", "r/homeschool (180K)", "Reading Rockets community"], size: "$8B US early literacy market" },
  "math fluency":           { find: ["r/math (1.1M)", "r/learnmath (280K)", "r/Teachers", "Khan Academy community"], size: "$5B US math ed market" },
  "emotional learning":     { find: ["r/socialskills (250K)", "r/Teachers", "r/Parenting", "CASEL community"], size: "$2.1B SEL market growing 21% annually" },
  "mental wellness":        { find: ["r/mentalhealth (450K)", "r/Meditation (700K)", "r/Mindfulness (400K)", "Headspace community"], size: "$140B global mental wellness market" },

  "new parents":         { find: ["r/NewParents (350K)", "r/beyondthebump (1.1M)", "r/daddit (700K)", "WhatToExpect community"], size: "3.6M births/year in the US" },
  "remote teams":        { find: ["r/remotework (310K)", "r/digitalnomad (1.8M)", "Remote Workers Slack", "We Work Remotely community"], size: "32% of US workers hybrid/remote" },
  "couples":             { find: ["r/relationship_advice (4M)", "r/Marriage (100K)", "r/weddingplanning (400K)"], size: "130M people in relationships in the US" },
  "college students":    { find: ["r/college (675K)", "r/ApplyingToCollege", "r/StudentLoans (170K)", "r/GradSchool"], size: "20M college students in the US" },
  "freelancers":         { find: ["r/freelance (230K)", "r/freelanceWriters", "Indie Hackers", "r/digitalnomad (1.8M)"], size: "60M freelancers in the US" },
  "hobby runners":       { find: ["r/running (2.8M)", "r/AdvancedRunning (350K)", "Strava community", "r/Marathon"], size: "50M runners in the US" },
  "dog owners":          { find: ["r/dogs (3M)", "r/Dogtraining (700K)", "r/puppy101 (400K)", "r/DogAdvice"], size: "90M dogs in the US" },
  "renters":             { find: ["r/renting (150K)", "r/Tenant (90K)", "r/FirstTimeHomeBuyer", "r/personalfinance (17M)"], size: "44M renter households in the US" },
  "recent immigrants":   { find: ["r/immigration (550K)", "r/expats (310K)", "r/moving", "Immigrant Connect forums"], size: "1M+ legal immigrants/year to the US" },
  "family caregivers":   { find: ["r/caregivers (45K)", "r/dementia (100K)", "r/AgingParents (60K)", "AARP Caregiving community"], size: "53M family caregivers in the US" },
  "retirees":            { find: ["r/retirement (120K)", "r/financialindependence (2M)", "r/personalfinance", "AARP community"], size: "56M retirees in the US" },
  "small creators":      { find: ["r/NewTubers (275K)", "r/podcasting (220K)", "r/Twitch (550K)", "Creator Economy community"], size: "50M+ content creators in the US" },
  "ADHD adults":         { find: ["r/ADHD (1.1M)", "r/adhdwomen (240K)", "r/ADHD_Programmers (50K)", "How to ADHD community"], size: "20M adults with ADHD in the US" },
  "book clubs":          { find: ["r/bookclub (70K)", "r/books (22M)", "Goodreads community (150M)", "r/52book"], size: "5M book club members in the US" },
  "roommates":           { find: ["r/badroommates (150K)", "r/Tenant", "r/college (675K)", "SpareRoom community"], size: "30M+ people with roommates" },
  "frequent travelers":  { find: ["r/travel (12M)", "r/solotravel (1.6M)", "r/churning (400K)", "r/digitalnomad (1.8M)"], size: "700M US domestic trips/year" },
};

// Get sources for a specific landed item (searched across all modes)
function getItemMeta(item) { return COMMUNITY_META[item] || null; }

// Strip citation markup from API responses before display
function stripCites(text) {
  if (!text) return '';
  return text.replace(/<cite[^>]*>|<\/cite>/g, '').replace(/\s+/g, ' ').trim();
}



// Real pricing confirmed May 2026 — per million tokens
const PRICING = {
  "claude-haiku-4-5-20251001": { input: 1.00, output: 5.00 },
  "claude-sonnet-4-6":          { input: 3.00, output: 15.00 },
};
function calcCost(model, inp, out) {
  const p = PRICING[model] || PRICING["claude-sonnet-4-6"];
  return (inp * p.input + out * p.output) / 1_000_000;
}
function fmtCost(n) { return n < 0.01 ? "<$0.01" : "$" + n.toFixed(4); }
function fmtNum(n) { return n.toLocaleString(); }

async function callClaude(prompt, useWebSearch, maxTokens, model = "claude-sonnet-4-6") {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
  return { text, usage };
}

function parseJSON(text) {
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  const s = clean.search(/[{[]/);
  const e = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]")) + 1;
  if (s === -1 || e === 0) throw new Error("No JSON in response");
  return JSON.parse(clean.slice(s, e));
}

export default function IdeaWheel() {
  const stripRefs = [useRef(null), useRef(null), useRef(null)];
  const indexRef = useRef([0, 0, 0]);
  const targetRef = useRef([0, 0, 0]);
  const spinAllRef = useRef(() => {});
  const audioRef = useRef(null);

  const [mode, setMode] = useState("b2b");
  const m = MODES[mode];
  const banks = m.banks;

  const [landed, setLanded] = useState(["", "", ""]);
  const [locked, setLocked] = useState([false, false, false]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [shortlist, setShortlist] = useState([]);
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // Pipeline: null | { stage: 1|2|3|4, results: [comp|null, design|null, proto|null], error: null|{stage,msg} }
  const [pipeline, setPipeline] = useState(null);
  const [credits, setCredits] = useState(3);
  const [aiScore, setAiScore] = useState(null); // { score, eureka, insight, angle, loading }
  const [showPricing, setShowPricing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  useEffect(() => {
    setMounted(true);
    try {
      const existing = window.localStorage.getItem("ideaWheelSessionId");
      const id = existing || window.crypto?.randomUUID?.() || `iw-${Date.now()}`;
      if (!existing) window.localStorage.setItem("ideaWheelSessionId", id);
      setSessionId(id);

      const storedCredits = Number(window.localStorage.getItem("ideaWheelCredits") || "3");
      if (Number.isFinite(storedCredits) && storedCredits >= 0) setCredits(storedCredits);
    } catch {
      setSessionId(`iw-${Date.now()}`);
    }
  }, []);
  const [protoOpen, setProtoOpen] = useState(true);
  const [cardCopied, setCardCopied] = useState(false);

  const rememberSessionId = (id) => {
    if (!id) return;
    setSessionId(id);
    try { window.localStorage.setItem("ideaWheelSessionId", id); } catch {}
  };

  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem("ideaWheelCredits", String(credits)); } catch {}
  }, [credits, mounted]);

  const setTransform = (w, idx, animate, duration) => {
    const el = stripRefs[w].current;
    if (!el) return;
    el.style.transition = animate ? `transform ${duration}ms cubic-bezier(0.16,1,0.3,1)` : "none";
    el.style.transform = `translateY(${-(idx - 1) * ITEM_H}px)`;
  };

  const clearPipeline = () => setPipeline(null);

  const tick = () => {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = 430 + Math.random() * 110;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.13);
    } catch (e) {}
  };

  useEffect(() => {
    const b = MODES[mode].banks;
    b.forEach((bank, w) => {
      const start = rand(bank.length);
      indexRef.current[w] = HOME_COPY * bank.length + start;
    });
    setLanded(["", "", ""]);
    setLocked([false, false, false]);
    setSpinning([false, false, false]);
    clearPipeline();
    requestAnimationFrame(() => b.forEach((_, w) => setTransform(w, indexRef.current[w], false)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const spinWheel = (w, duration) => {
    if (spinning[w] || locked[w]) return;
    const bank = banks[w];
    const L = bank.length;
    const cur = indexRef.current[w];
    const curBase = ((cur % L) + L) % L;
    const t = rand(L);
    const forward = ((t - curBase) % L + L) % L;
    const loops = reduceMotion ? 0 : 4 + rand(3);
    const newIndex = cur + loops * L + forward + (forward === 0 ? L : 0);
    indexRef.current[w] = newIndex;
    targetRef.current[w] = newIndex % L;
    requestAnimationFrame(() => setTransform(w, newIndex, true, reduceMotion ? 260 : duration));
    setSpinning((s) => { const n = [...s]; n[w] = true; return n; });
  };

  const onSettle = (w) => {
    const bank = banks[w];
    const t = targetRef.current[w];
    indexRef.current[w] = HOME_COPY * bank.length + t;
    setTransform(w, indexRef.current[w], false);
    setLanded((p) => { const n = [...p]; n[w] = bank[t]; return n; });
    setSpinning((s) => { const n = [...s]; n[w] = false; return n; });
    tick();
  };

  const anySpinning = spinning.some(Boolean);
  const complete = landed.every(Boolean);
  const verb = complete ? conjugate(landed[0]) : "";
  const combo = complete ? `${verb} ${landed[1]} ${m.connector} ${landed[2]}.` : "";
  const sentence = complete ? `${m.prefix} ${combo}` : "";
  const score = useMemo(() => (complete ? scoreCombo(m, landed[0], landed[1], landed[2]) : 0), [complete, landed, mode]);
  const displayedScore = aiScore?.score ?? score;
  const b = band(score);
  const displayBand = band(displayedScore);

  // Fire AI scoring in background after wheels settle
  useEffect(() => {
    if (!complete || anySpinning) return;
    setAiScore({ loading: true });
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: landed[0],
        experience: landed[1],
        audience: landed[2],
        mode,
        heuristicScore: score,
      }),
    })
      .then(r => r.json())
      .then(data => setAiScore({ ...data, loading: false }))
      .catch(() => setAiScore(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, anySpinning]);

  const spinAll = () => {
    if (anySpinning) return;
    clearPipeline();
    setAiScore(null);
    let slot = 0;
    banks.forEach((_, w) => { if (locked[w]) return; spinWheel(w, 2500 + slot * 450); slot++; });
  };
  spinAllRef.current = spinAll;

  const reroll = (w) => { if (anySpinning) return; clearPipeline(); spinWheel(w, 2500); };
  const toggleLock = (w) => setLocked((l) => { const n = [...l]; n[w] = !n[w]; return n; });

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      spinAllRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const recordSignal = (signal, payload = {}) => {
    if (!sessionId) return;
    fetch('/api/pipeline/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        signal,
        modeName: m.name,
        action: landed[0],
        workflow: landed[1],
        industry: landed[2],
        payload,
      }),
    }).catch(() => {});
  };

  const openPricing = (reason = 'manual') => {
    setCheckoutError("");
    setShowPricing(true);
    recordSignal('pricing_viewed', { reason, credits });
  };

  const startCheckout = async (pkg) => {
    setCheckoutError("");
    setCheckoutLoading(pkg.key);
    recordSignal('checkout_started', { package: pkg.label, credits: pkg.credits, price: pkg.price });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.url) throw new Error(data.error || 'Unable to start checkout');
      window.location.assign(data.url);
    } catch (err) {
      setCheckoutError(err.message || 'Unable to start checkout');
      setCheckoutLoading("");
    }
  };

  const save = () => {
    if (!complete || anySpinning) return;
    setShortlist((l) => (l[0] && l[0].full === sentence ? l : [{ display: cap(combo), full: sentence, score: displayedScore, label: displayBand.label }, ...l].slice(0, 40)));
    recordSignal('shortlist_saved', { sentence, score: displayedScore, band: displayBand.label });
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(shortlist.map((s, i) => `${i + 1}. ${s.full}  [${s.score} ${s.label}]`).join("\n"));
      setCopied(true);
      recordSignal('shortlist_exported', { items: shortlist.length });
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {}
  };

  const copyCard = async () => {
    const r = pipeline && pipeline.results;
    const [comp, design, gtm] = r || [];
    const lines = [`🤖 ${sentence}`, `Build Score: ${displayedScore}/100 · ${displayBand.label}`];
    if (comp) lines.push(``, `MARKET: ${comp.marketSize || ""}`, `GAP: ${stripCites(comp?.gap)}`, `VERDICT: ${stripCites(comp?.verdict)}`);
    if (design) lines.push(``, `PRODUCT: ${design.name} — ${design.tagline}`, `EDGE: ${design.differentiator}`);
    if (gtm) {
      lines.push(``, `TARGET: ${gtm.persona}`, `PRICING: ${gtm.pricing?.price} — ${gtm.pricing?.rationale}`, `REVENUE GOAL: ${gtm.revenueGoal}`);
      lines.push(``, `FIRST 5 CUSTOMERS:`);
      (gtm.firstFiveCustomers || []).forEach((c, i) => lines.push(`  ${i+1}. ${c}`));
      lines.push(``, `30-DAY PLAN:`);
      (gtm.plan || []).forEach(w => lines.push(`  Week ${w.week} (${w.theme}): ${(w.actions||[]).join(" | ")}`));
    }
    lines.push(``, `— made with IdeaWheel`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCardCopied(true);
      recordSignal('blueprint_copied', { score: displayedScore, sentence, blueprintReady: briefDone });
      recordSignal('blueprint_exported', { score: displayedScore, sentence, blueprintReady: briefDone, format: 'clipboard' });
      setTimeout(() => setCardCopied(false), 1400);
    } catch (e) {}
  };

  // ── FREE: validate market (scout only, no credit) ───────────────
  const runScout = async () => {
    if (!complete || anySpinning) return;
    clearPipeline();
    setPipeline({ stage: 'scouting', results: [null,null,null,null,null], costs: [], error: null });
    try {
      const res = await fetch('/api/pipeline/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: landed[0], workflow: landed[1], industry: landed[2],
          mode, connector: m.connector, modeName: m.name,
          sessionId,
        }),
      });
      if (!res.ok) throw new Error('Validation failed: ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.sessionId) rememberSessionId(data.sessionId);
      const comp = data.comp;
      const scoutCost = { label: 'Scout', model: 'claude-haiku-4-5-20251001', input_tokens: data.cost?.input_tokens || 0, output_tokens: data.cost?.output_tokens || 0, cost: data.cost?.cost_usd || 0 };
      const vt = comp.verdictType || 'build';
      recordSignal(vt === 'avoid' ? 'validation_avoided' : 'validation_completed', {
        validationId: comp.validationId,
        verdictType: vt,
        score: displayedScore,
        sentence,
      });
      setPipeline({ stage: vt === 'avoid' ? 'avoided' : 'scouted', results: [comp,null,null,null,null], costs: [scoutCost], error: null });
    } catch (e) {
      setPipeline(p => ({ ...p, stage: null, error: { stage: 'scout', msg: 'Market check failed. ' + e.message } }));
    }
  };

  // ── PAID: build the full brief (4 agents via API routes, 1 credit) ──
  const runBrief = async () => {
    if (!pipeline || pipeline.stage !== 'scouted') return;
    if (credits <= 0) { openPricing('no_credits'); return; }
    const comp = pipeline.results[0];
    if (!comp) return;
    setCredits(c => c - 1);
    setShowPricing(false);
    setProtoOpen(true);
    const baseCosts = pipeline.costs || [];
    recordSignal('blueprint_started', { validationId: comp.validationId, score: displayedScore, sentence });
    const combo = {
      action: landed[0], workflow: landed[1], industry: landed[2], mode, connector: m.connector, modeName: m.name,
      sessionId, validationId: comp.validationId,
    };
    const api = (body) => fetch('/api/pipeline/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

    // Stage 1: Designer
    setPipeline(p => ({ ...p, stage: 1 }));
    let design;
    try {
      const data = await api({ ...combo, stage: 'designer', comp });
      if (data.sessionId) rememberSessionId(data.sessionId);
      if (data.error) throw new Error(data.error);
      design = data.result;
      const c2 = { label: 'Designer', model: 'claude-sonnet-4-6', input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0, cost: data.cost_usd || 0 };
      setPipeline(p => ({ ...p, results: [comp,design,null,null,null], costs: [...baseCosts, c2] }));
    } catch (e) { setCredits(c => c + 1); setPipeline(p => ({ ...p, error: { stage: 1, msg: 'Designer failed. ' + e.message } })); return; }

    // Stage 2: Launch Plan
    setPipeline(p => ({ ...p, stage: 2 }));
    let gtm;
    try {
      const data = await api({ ...combo, stage: 'launch', comp, design });
      if (data.sessionId) rememberSessionId(data.sessionId);
      if (data.error) throw new Error(data.error);
      gtm = data.result;
      const c3 = { label: 'Launch', model: 'claude-sonnet-4-6', input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0, cost: data.cost_usd || 0 };
      setPipeline(p => ({ ...p, results: [comp,design,gtm,null,null], costs: [...p.costs, c3] }));
    } catch (e) { setCredits(c => c + 1); setPipeline(p => ({ ...p, error: { stage: 2, msg: 'Launch Plan failed. ' + e.message } })); return; }

    // Stage 3: Infrastructure
    setPipeline(p => ({ ...p, stage: 3 }));
    let infra;
    try {
      const data = await api({ ...combo, stage: 'infrastructure', comp, design, gtm });
      if (data.sessionId) rememberSessionId(data.sessionId);
      if (data.error) throw new Error(data.error);
      infra = data.result;
      const c3b = { label: 'Infra', model: 'claude-haiku-4-5-20251001', input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0, cost: data.cost_usd || 0 };
      setPipeline(p => ({ ...p, results: [comp,design,gtm,infra,null], costs: [...p.costs, c3b] }));
    } catch (e) { setCredits(c => c + 1); setPipeline(p => ({ ...p, error: { stage: 3, msg: 'Infrastructure failed. ' + e.message } })); return; }

    // Stage 4: Prototype Builder
    setPipeline(p => ({ ...p, stage: 4 }));
    let proto;
    try {
      const data = await api({ ...combo, stage: 'builder', comp, design, gtm, infra });
      if (data.sessionId) rememberSessionId(data.sessionId);
      if (data.error) throw new Error(data.error);
      proto = data.result;
      const c4 = { label: 'Builder', model: 'claude-sonnet-4-6', input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0, cost: data.cost_usd || 0 };
      setPipeline(p => ({ stage: 5, results: [comp,design,gtm,infra,proto], costs: [...p.costs, c4], error: null }));
    } catch (e) { setCredits(c => c + 1); setPipeline(p => ({ ...p, error: { stage: 4, msg: 'Prototype failed. ' + e.message } })); }
  };
  const scoutRunning  = pipeline && pipeline.stage === 'scouting';
  const scoutDone     = pipeline && (pipeline.stage === 'scouted' || pipeline.stage === 'avoided');
  const buildRunning  = pipeline && typeof pipeline.stage === 'number' && pipeline.stage >= 1 && pipeline.stage <= 4;
  const briefDone     = pipeline && pipeline.stage === 5;
  const pipelineRunning = scoutRunning || buildRunning;
  const pipelineResults = pipeline && pipeline.results;

  // Stage numbers for the 3 build agents: 1=designer, 2=gtm, 3=builder
  // results: [0]=comp, [1]=design, [2]=gtm, [3]=proto
  const buildStageStatus = (n) => {
    if (!buildRunning && !briefDone) return "idle";
    if (pipeline.error && pipeline.error.stage === n) return "error";
    if (pipeline.stage === n) return "running";
    if (pipelineResults && pipelineResults[n] !== null) return "done";
    return "idle";
  };


  return (
    <div className="iw-root">
      {mounted && <style>{css}</style>}
      <div className="iw-grain" aria-hidden />
      <div className="iw-glow" aria-hidden />

      <div className="iw-shell">
        <section className="iw-machine">
          <header className="iw-head">
            <div className="iw-headtop">
              <span className="iw-kicker">SPIN. VALIDATE. BUILD.</span>
              <span className="iw-headbadge">Free market check before checkout</span>
            </div>
            <div className="iw-headcopy">
              <h1 className="iw-title">Idea Generator</h1>
              <p className="iw-sub">Spin an idea. Validate the market for free. Build only when it's worth it.</p>
              <div className="iw-proofrow">
                <span className="iw-proofchip">Free validation</span>
                <span className="iw-proofchip">Live blueprint build</span>
                <span className="iw-proofchip">1 credit only if it passes</span>
              </div>
            </div>
          </header>

          <div className="iw-controlshelf">
            <div className="iw-bar">
              <div className="iw-modes">
                {Object.keys(MODES).map((k) => (<button key={k} className={`iw-modebtn ${mode === k ? "on" : ""}`} onClick={() => setMode(k)} disabled={anySpinning}>{MODES[k].name}</button>))}
              </div>
              <button className="iw-creditpill" onClick={() => openPricing('credit_pill')} title="Buy more credits">
                <span className="iw-creditnum">{credits}</span>
                <span className="iw-creditlbl">credits</span>
              </button>
            </div>
          </div>

          <div className="iw-slotmachine">
            <div className="iw-reelintro">
              <div>
                <span className="iw-reelintro-label">LIVE WEDGE GENERATOR</span>
                <p className="iw-reelintro-copy">Tap any reel to reroll it. Lock the words you like, then validate the idea before spending a credit.</p>
              </div>
            </div>

            <div className="iw-reels">
              <span className="iw-marker iw-marker-l" aria-hidden />
              <span className="iw-marker iw-marker-r" aria-hidden />
              <span className="iw-payline" aria-hidden />
              {banks.map((bank, w) => {
                const repeated = Array.from({ length: REPEATS }, () => bank).flat();
                return (
                  <div className="iw-col" key={mode + w} style={{ "--accent": TINTS[w] }}>
                    <div className="iw-collabel">{m.labels[w]}</div>
                    <div className="iw-window" onClick={() => reroll(w)} role="button">
                      <div className="iw-strip" ref={stripRefs[w]} onTransitionEnd={() => onSettle(w)}>
                        {repeated.map((word, i) => (<div className="iw-item" key={i} style={{ height: ITEM_H }}><span>{word}</span></div>))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="iw-slotbase">
              <div className="iw-slotlights" aria-hidden>
                <span /><span /><span /><span /><span /><span /><span />
              </div>
              <div className="iw-controls">
                <button className="iw-spin" onClick={spinAll} disabled={anySpinning}>{anySpinning ? "Spinning…" : <><Dices size={16} /> Generate Idea!</>}</button>
                <span className="iw-spinhint">Lock a good reel, then reroll the rest.</span>
              </div>
            </div>
          </div>

          <div className={`iw-result ${complete && !anySpinning ? "show" : ""}`}>
            <p className="iw-statement">
              <span className="iw-prefix">{m.prefix}</span>
              <span className="iw-fill">
                <span style={{ color: TINTS[0] }}>{verb}</span>{" "}
                <span style={{ color: TINTS[1] }}>{landed[1]}</span>{" "}
                <span className="iw-in">{m.connector}</span>{" "}
                <span style={{ color: TINTS[2] }}>{landed[2]}</span>
                <span className="iw-dot">.</span>
              </span>
            </p>

            <div className={`iw-score${aiScore?.eureka ? ' iw-score--eureka' : ''}`}>
              <div className="iw-score-top">
                {aiScore?.eureka ? (
                  <>
                    <span className="iw-scorenum" style={{ color: 'var(--amber)' }}>{aiScore.score}</span>
                    <span className="iw-scoreband iw-scoreband--eureka">⚡ EUREKA</span>
                  </>
                ) : (
                  <>
                    <span className="iw-scorenum" style={{ color: displayBand.color }}>
                      {displayedScore}
                    </span>
                    <span className="iw-scoreband" style={{ color: displayBand.color, borderColor: displayBand.color + '55' }}>
                      {aiScore?.loading ? '…' : displayBand.label}
                    </span>
                  </>
                )}
                <span className="iw-scoredesc">
                  {aiScore?.loading ? 'AI is evaluating this combination…'
                    : aiScore?.insight || b.desc}
                </span>
              </div>
              {aiScore?.eureka && aiScore.angle && (
                <div className="iw-eureka-angle">
                  <span>BUILD THIS</span> {aiScore.angle}
                </div>
              )}
              <div className="iw-meter">
                <span className="iw-meterfill" style={{
                  width: `${displayedScore}%`,
                  background: aiScore?.eureka ? 'var(--amber)' : displayBand.color,
                  transition: 'width 0.6s ease-out, background 0.4s ease'
                }} />
              </div>
            </div>

            <div className="iw-buildrow">
              <div className="iw-resultbtns">
                <button className="iw-save" onClick={save} disabled={anySpinning || pipelineRunning}><Plus size={15} /> Shortlist</button>
                {!scoutDone && !buildRunning && !briefDone ? (
                  <button className="iw-validate iw-validate--primary" onClick={runScout} disabled={anySpinning || scoutRunning}>
                    {scoutRunning ? <><span className="iw-dotspinner iw-dotspinner--light" /> Checking market…</> : <><Search size={15} /> Validate Market<span className="iw-freebadge">free</span></>}
                  </button>
                ) : scoutDone && !buildRunning && !briefDone ? (
                  <button className="iw-validate" onClick={runScout} disabled={anySpinning} style={{opacity:.6,fontSize:"12px"}}>
                    <Search size={13} /> Check again
                  </button>
                ) : null}
              </div>

            </div>
            <span className="iw-scorehint">Validation is always free. Credits unlock the full Blueprint.</span>

            {/* ── SCOUT VERDICT (shown after free validation) ── */}
            {scoutDone && pipelineResults && pipelineResults[0] && (() => {
              const c = pipelineResults[0];
              const vt = c.verdictType || 'build';
              if (vt === 'avoid') return (
                <div className="iw-verdict iw-verdict--avoid">
                  <div className="iw-verdict-banner">
                    <span className="iw-verdict-icon">⛔</span>
                    <span className="iw-verdict-title">Crowded Market</span>
                    {c.marketSize && <span className="iw-verdict-sub">{c.marketSize}</span>}
                  </div>
                  <div className="iw-verdict-body">
                    <p className="iw-verdict-reason">{stripCites(c.verdictReasoning)}</p>
                    {(c.players||[]).slice(0,3).length > 0 && (<>
                      <span className="iw-verdict-players-label">Who owns this space</span>
                      <div className="iw-verdict-players">
                        {(c.players||[]).slice(0,3).map((pl,i) => (
                          <div key={i} className="iw-verdict-player">
                            <span className="iw-verdict-pname">{pl.name}</span>
                            <div className="iw-verdict-pdetail">
                              <span className="iw-verdict-pprice">{stripCites(pl.pricing)||"—"}</span>
                              <span className="iw-verdict-pweak">{stripCites(pl.weakness)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>)}
                    {c.pivotHint && (
                      <div className="iw-verdict-pivot">
                        <div className="iw-verdict-pivot-label">💡 Instead, consider</div>
                        <p>{stripCites(c.pivotHint)}</p>
                      </div>
                    )}
                    <button className="iw-verdict-spin" onClick={() => { clearPipeline(); spinAll(); }}>↩ Spin a new idea</button>
                  </div>
                </div>
              );
              return (
                <div className={"iw-verdict" + (vt === 'warning' ? " iw-verdict--warn" : " iw-verdict--build")}>
                  <div className="iw-verdict-banner">
                    <span className="iw-verdict-icon">{vt === 'build' ? '✅' : '⚡'}</span>
                    <span className="iw-verdict-title">{vt === 'build' ? 'Build-Worthy' : 'Competitive — Wedge Exists'}</span>
                    {c.marketSize && <span className="iw-verdict-sub">{c.marketSize}</span>}
                  </div>
                  <div className="iw-verdict-body">
                    <p className="iw-verdict-reason">{stripCites(c.verdictReasoning)}</p>
                    {c.gap && (
                      <div className="iw-verdict-gap">
                        <span>The Gap</span>
                        <p>{stripCites(c.gap)}</p>
                      </div>
                    )}
                    {(c.players||[]).slice(0,3).length > 0 && (<>
                      <span className="iw-verdict-players-label">Key players</span>
                      <div className="iw-verdict-players">
                        {(c.players||[]).slice(0,3).map((pl,i) => (
                          <div key={i} className="iw-verdict-player">
                            <span className="iw-verdict-pname">{pl.name}</span>
                            <div className="iw-verdict-pdetail">
                              <span className="iw-verdict-pprice">{stripCites(pl.pricing)||"—"}</span>
                              <span className="iw-verdict-pweak">{stripCites(pl.weakness)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>)}
                    <div className="iw-buildbtnrow">
                      <button className="iw-buildbtn" onClick={runBrief} disabled={buildRunning || briefDone}>
                        {credits === 0
                          ? <><Zap size={15} /> Get credits to build the Blueprint</>
                          : <><Zap size={15} /> Build the Blueprint <span className="iw-creditcost">· 1 credit</span></>}
                      </button>
                      <button className="iw-creditpill iw-creditpill--verdict" onClick={() => openPricing('verdict_cta')} title={credits === 0 ? 'Buy credits' : 'Buy more credits'}>
                        <span className="iw-creditnum">{credits}</span>
                        <span className="iw-creditlbl">credits</span>
                      </button>
                    </div>
                    {credits === 0 && <button className="iw-verdict-getc" onClick={() => openPricing('verdict_cta')}>Get credits →</button>}
                  </div>
                </div>
              );
            })()}

            {showPricing && (
              <div className="iw-pricing">
                <div className="iw-pricinghead">
                  <span>GET MORE CREDITS</span>
                  <button className="iw-pricingclose" onClick={() => setShowPricing(false)}>✕</button>
                </div>
                <p className="iw-pricingsub">Each credit unlocks one full Blueprint run: market analysis, product spec, GTM playbook, infrastructure plan, and live prototype.</p>
                {checkoutError && <p className="iw-priceerr">{checkoutError}</p>}
                <div className="iw-pkgs">
                  {CREDIT_PACKAGES.map(pkg => (
                    <div key={pkg.key} className={"iw-pkg" + (pkg.highlight ? " iw-pkg--hl" : "")}>
                      <span className="iw-pkglabel">{pkg.label}</span>
                      <span className="iw-pkgcredits">{pkg.credits} credits</span>
                      <span className="iw-pkgprice">{pkg.price}</span>
                      <span className="iw-pkgper">{pkg.per} / credit</span>
                      <button className="iw-pkgbtn" disabled={Boolean(checkoutLoading)} onClick={() => startCheckout(pkg)}>
                        {checkoutLoading === pkg.key ? 'Redirecting…' : 'Checkout'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── PIPELINE ── */}
          {(buildRunning || briefDone) && pipelineResults && (
            <div className="pip-root">
              <div className="pip-header">
                <span>THE BLUEPRINT</span>
                {briefDone && (<button className="iw-cardbtn" onClick={copyCard}>{cardCopied ? <Check size={13} /> : <Share2 size={13} />}{cardCopied ? "Copied" : "Copy blueprint"}</button>)}
              </div>

              {/* ── Build progress bar ── */}
              <div className="pip-progress">
                {[
                  { n: 1, label: 'Product' },
                  { n: 2, label: 'Launch' },
                  { n: 3, label: 'Infra' },
                  { n: 4, label: 'Prototype' },
                ].map(({ n, label }) => {
                  const st = buildStageStatus(n);
                  return (
                    <div key={n} className={`pip-progress-step pip-progress-step--${st}`}>
                      <div className="pip-progress-dot">
                        {st === 'done' ? '✓' : st === 'running' ? <span className="pip-spinner pip-spinner--sm" /> : n}
                      </div>
                      <span className="pip-progress-label">{label}</span>
                    </div>
                  );
                })}
                <div className="pip-progress-track">
                  <div className="pip-progress-fill" style={{
                    width: briefDone ? '100%' :
                      buildRunning ? `${((typeof pipeline.stage === 'number' ? pipeline.stage - 1 : 0) / 4) * 100}%` : '0%'
                  }} />
                </div>
              </div>

              {/* ── Stage 1: Product Designer ── */}              <AgentCard n={1} icon={<Paintbrush size={15} />} label="PRODUCT DESIGNER" model="sonnet-4.6"
                desc="Names the product, specs the differentiator, defines what to build."
                status={buildStageStatus(1)} accent="var(--teal)">
                {pipelineResults[1] && (() => { const d = pipelineResults[1]; return (
                  <div className="pip-output">
                    <div className="pip-product"><span className="pip-productname">{d.name}</span><span className="pip-producttag">{d.tagline}</span></div>
                    <p className="pip-diff"><strong>Edge:</strong> {d.differentiator}</p>
                    <ul className="pip-features">{(d.coreFeatures||[]).map((f,i)=><li key={i}>{f}</li>)}</ul>
                  </div>); })()}
                {pipeline.error && pipeline.error.stage === 1 && <p className="pip-err">{pipeline.error.msg} <button className="iw-retry" onClick={runBrief}>Retry</button></p>}
              </AgentCard>
              <div className="pip-connector" />

              {/* ── Stage 2: GTM Strategist ── */}              <AgentCard n={2} icon={<Rocket size={15} />} label="LAUNCH PLAN" model="sonnet-4.6"
                desc="First 5 customers, pricing rationale, 30-day plan, build stack."
                status={buildStageStatus(2)} accent="var(--violet)">
                {pipelineResults[2] && (() => { const g = pipelineResults[2]; return (
                  <div className="pip-output">
                    <div className="pip-gtmhero"><div className="pip-revgoal"><span className="pip-revnum">{g.revenueGoal}</span><span className="pip-revlabel">30-DAY TARGET</span></div><div className="pip-buildtime"><span className="pip-btnum">{g.buildTime}</span><span className="pip-btlabel">TO BUILD V1</span></div></div>
                    <div className="pip-section"><span className="pip-seclabel">TARGET CUSTOMER</span><p className="pip-persona">{g.persona}</p>{g.whereToFind && <p className="pip-where"><strong>Where:</strong> {g.whereToFind}</p>}</div>
                    <div className="pip-section"><span className="pip-seclabel">FIRST 5 CUSTOMERS</span><ol className="pip-five">{(g.firstFiveCustomers||[]).map((c,i)=><li key={i}>{c}</li>)}</ol></div>
                    {(g.channels||[]).length > 0 && <div className="pip-section"><span className="pip-seclabel">CHANNELS</span>{g.channels.map((ch,i)=><div key={i} className="pip-channel"><span className="pip-chname">{ch.name}</span><span className="pip-chtactic">{ch.tactic}</span><span className="pip-chtl">{ch.timeline}</span></div>)}</div>}
                    {g.pricing && <div className="pip-pricebox"><span className="pip-price">{g.pricing.price}</span><span className="pip-pricerat">{g.pricing.rationale}</span>{g.pricing.trial && <span className="pip-pricetrial">{g.pricing.trial}</span>}</div>}
                    {(g.plan||[]).length > 0 && <div className="pip-section"><span className="pip-seclabel">30-DAY PLAN</span><div className="pip-weeks">{g.plan.map((w,i)=><div key={i} className="pip-week"><span className="pip-weekn">W{w.week}</span><span className="pip-weektheme">{w.theme}</span><ul>{(w.actions||[]).map((a,j)=><li key={j}>{a}</li>)}</ul></div>)}</div></div>}
                    {(g.startNow||[]).length > 0 && (
                      <div className="pip-startnow">
                        <span className="pip-seclabel">START TODAY</span>
                        <p className="pip-startnow-sub">Three actions you can take in the next 24 hours.</p>
                        <ol className="pip-today">{(g.startNow||[]).map((a,i)=><li key={i}>{a}</li>)}</ol>
                      </div>
                    )}
                    {(g.stack||[]).length > 0 && <div className="pip-section"><span className="pip-seclabel">BUILD STACK</span><div className="pip-stack">{g.stack.map((s,i)=><span key={i} className="pip-stackpill">{s}</span>)}</div></div>}
                  </div>); })()}
                {pipeline.error && pipeline.error.stage === 2 && <p className="pip-err">{pipeline.error.msg} <button className="iw-retry" onClick={runBrief}>Retry</button></p>}
              </AgentCard>
              <div className="pip-connector" />

              {/* ── Stage 3: Infrastructure Architect ── */}
              <AgentCard n={3} icon={<Zap size={15} />} label="INFRASTRUCTURE"
                desc="Services to sign up for, env vars, DB schema, AI wiring, deploy steps, and monthly cost."
                status={buildStageStatus(3)} accent="var(--amber)">
                {pipelineResults && pipelineResults[3] && (() => { const inf = pipelineResults[3]; return (
                  <div className="pip-output">
                    {(inf.services||[]).length > 0 && (
                      <div className="pip-section">
                        <span className="pip-seclabel">SETUP — {inf.services.length} SERVICES</span>
                        <div className="pip-services">
                          {(inf.services||[]).map((svc,i) => (
                            <div key={i} className="pip-svc">
                              <div className="pip-svc-head">
                                <span className="pip-svc-name">{svc.name}</span>
                                <span className="pip-svc-time">{svc.setupTime}</span>
                                {svc.url && <a className="pip-svc-url" href={svc.url} target="_blank" rel="noopener noreferrer">Sign up →</a>}
                              </div>
                              <span className="pip-svc-purpose">{svc.purpose}</span>
                              <span className="pip-svc-free">{svc.freeTier}</span>
                              {(svc.setupSteps||[]).length > 0 && <ol className="pip-svc-steps">{svc.setupSteps.map((s,j)=><li key={j}>{s}</li>)}</ol>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {inf.envVars && <div className="pip-section"><span className="pip-seclabel">.ENV TEMPLATE</span><pre className="pip-envblock">{Array.isArray(inf.envVars)?inf.envVars.join("\n"):inf.envVars}</pre></div>}
                    {inf.schema && <div className="pip-section"><span className="pip-seclabel">DATABASE SCHEMA</span><p className="pip-schema">{inf.schema}</p></div>}
                    {inf.aiWiring && <div className="pip-section pip-aiwiring"><span className="pip-seclabel">AI AGENT WIRING</span><p>{inf.aiWiring}</p></div>}
                    {(inf.deploySteps||[]).length > 0 && <div className="pip-section"><span className="pip-seclabel">DEPLOY STEPS</span><ol className="pip-deploylist">{inf.deploySteps.map((s,i)=><li key={i}>{s}</li>)}</ol></div>}
                    {inf.monthlyCost && <div className="pip-costgrid">{Object.entries(inf.monthlyCost).map(([k,v],i)=><div key={i} className="pip-costcell"><span className="pip-costcellval">{v}</span><span className="pip-costcellkey">{k==='dev'?'Dev mode':k==='at100users'?'100 users':'1,000 users'}</span></div>)}</div>}
                    {inf.buildOrder && <div className="pip-section"><span className="pip-seclabel">BUILD ORDER</span><p className="pip-buildorder">{inf.buildOrder}</p></div>}
                  </div>
                ); })()}
                {pipeline.error && pipeline.error.stage === 3 && <p className="pip-err">{pipeline.error.msg} <button className="iw-retry" onClick={runBrief}>Retry</button></p>}
              </AgentCard>

              <div className="pip-connector" />

              {/* ── Stage 4: Prototype Builder ── */}
              <AgentCard n={4} icon={<Code2 size={15} />} label="PROTOTYPE BUILDER" model="sonnet-4.6"
                desc="Working interactive prototype built for your target customer — rendered live."
                status={buildStageStatus(4)} accent="oklch(58% 0.14 195)">
                {pipelineResults[4] && (
                  <div className="pip-output">
                    <button className="pip-prototoggle" onClick={()=>setProtoOpen(v=>!v)}>{protoOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}{protoOpen ? "Hide prototype" : "Show prototype"}</button>
                    {protoOpen && <div className="pip-frame-wrap"><div className="pip-chrome"><span/><span/><span/><div className="pip-url">{pipelineResults[1] && pipelineResults[1].name ? pipelineResults[1].name.toLowerCase().replace(/\s+/g,"-")+".app" : "prototype.app"}</div></div><ProtoFrame html={pipelineResults[4]} /></div>}
                  </div>)}
                {pipeline.error && pipeline.error.stage === 4 && <p className="pip-err">{pipeline.error.msg} <button className="iw-retry" onClick={runBrief}>Retry</button></p>}
              </AgentCard>

              {/* ── Cost bar ── */}              {briefDone && pipeline.costs && (
                <div className="pip-costbar">
                  <span className="pip-costlabel">RUN COST</span>
                  {pipeline.costs.map((c,i)=>(
                    <span key={i} className="pip-costagent"><span className="pip-costagentname">{c.label}</span><span>{fmtNum(c.input_tokens)}↑ {fmtNum(c.output_tokens)}↓</span><span className="pip-costamt">{fmtCost(c.cost)}</span></span>
                  ))}
                  <span className="pip-costtotal">Total: <strong>{fmtCost(pipeline.costs.reduce((s,c)=>s+c.cost,0))}</strong></span>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
      <div className="iw-disclaimer">
        <p>Idea Generator is an AI-powered research and ideation tool. All market analysis, competitor data, build scores, and recommendations are generated by AI and provided for informational purposes only. They do not constitute professional business, legal, or financial advice. AI-generated research may be incomplete, inaccurate, or outdated — market conditions change rapidly. We make no guarantees about the commercial viability of any idea or the accuracy of competitive intelligence. You are solely responsible for any business decisions you make based on this tool. Always conduct your own research and consult qualified professionals before investing time or money into any venture.</p>
      </div>
    </div>
  );
}

function AgentCard({ n, icon, label, desc, status, accent, model, children }) {
  return (
    <div className={`pip-card pip-card--${status}`} style={{ "--accent": accent }}>
      <div className="pip-card-head">
        <div className="pip-card-icon" style={{ color: accent }}>{icon}</div>
        <div className="pip-card-info">
          <span className="pip-card-label" style={{ color: accent }}>{label}</span>
          <span className="pip-card-desc">{desc}</span>
        </div>
        <div className="pip-card-badge">
          {status === "running" && <span className="pip-spinner" />}
          {status === "done" && <span className="pip-check">✓</span>}
          {status === "error" && <span className="pip-xerr">✗</span>}
          {status === "idle" && <span className="pip-num">{n}</span>}
        </div>
      </div>
      {model && <span className="pip-modelbadge">{model}</span>}
      {children}
    </div>
  );
}

function ProtoFrame({ html }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);
  if (!src) return null;
  return <iframe src={src} sandbox="allow-scripts allow-forms" style={{ width: "100%", height: "500px", border: "none", display: "block", borderRadius: "0 0 10px 10px" }} title="prototype" />;
}

const css = `
/* ── tokens ──────────────────────────────────────────────────── */
.iw-root{
  --bg:        var(--iw-color-bg);
  --surface:   var(--iw-color-surface);
  --surface2:  var(--iw-color-surface-soft);
  --border:    var(--iw-color-border);
  --ink:       var(--iw-color-ink);
  --muted:     var(--iw-color-muted);
  --amber:     var(--iw-color-brand-primary);
  --amber-bg:  var(--iw-color-brand-soft);
  --teal:      var(--iw-color-brand-tertiary);
  --violet:    var(--iw-color-brand-secondary);
  --reel1:     var(--iw-color-brand-primary);
  --reel2:     var(--iw-color-brand-secondary);
  --reel3:     var(--iw-color-brand-tertiary);
  --grad:      var(--iw-gradient-brand);
  --grad-diag: var(--iw-gradient-brand-diagonal);
  --font-ui:   var(--iw-font-ui);
  --font-display: var(--iw-font-display);

  position:relative; min-height:100%; width:100%;
  background:
    radial-gradient(circle at top, rgb(var(--iw-brand-primary-rgb) / 0.18), transparent 32%),
    radial-gradient(circle at 85% 15%, rgb(var(--iw-brand-secondary-rgb) / 0.10), transparent 26%),
    linear-gradient(180deg, #ffffff, var(--bg));
  color:var(--ink);
  font-family:var(--font-ui);
  padding:40px 24px 72px;
  box-sizing:border-box; overflow:hidden;
}
.iw-root *{box-sizing:border-box;}

.iw-grain{
  position:absolute; inset:0; pointer-events:none;
  opacity:.022; mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.iw-glow{
  position:absolute; top:-240px; left:50%; transform:translateX(-50%);
  width:900px; height:600px; pointer-events:none;
  background:radial-gradient(closest-side, rgb(var(--iw-brand-primary-rgb) / 0.18), transparent 72%);
}

/* ── layout ──────────────────────────────────────────────────── */
.iw-shell{
  position:relative; max-width:800px; margin:0 auto;
  display:block;
}
.iw-machine{
  position:relative;
  padding:34px clamp(20px, 3vw, 36px) 36px;
  background:linear-gradient(180deg, var(--surface), var(--surface2));
  border:1px solid var(--border);
  border-radius:34px;
  box-shadow:
    0 32px 80px -44px rgba(29, 29, 31, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    inset 0 -1px 0 rgba(29, 29, 31, 0.06);
  overflow:hidden;
}
.iw-machine::before{
  content:"";
  position:absolute; inset:0 0 auto 0; height:170px; pointer-events:none;
  background:linear-gradient(180deg, rgb(var(--iw-brand-primary-rgb) / 0.08), transparent 74%);
}
.iw-machine::after{
  content:"";
  position:absolute; left:70px; right:70px; bottom:18px; height:24px;
  border-radius:999px;
  background:radial-gradient(closest-side, oklch(18% 0.02 70 / .16), transparent 76%);
  pointer-events:none;
}

/* ── header ──────────────────────────────────────────────────── */
.iw-head{ margin-bottom:26px; }
.iw-headtop{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  margin-bottom:16px;
}
.iw-kicker{
  display:block; font-family:'Inter',-apple-system,sans-serif; font-size:11px;
  font-weight:700; letter-spacing:.28em; text-transform:uppercase;
  color:var(--amber);
}
.iw-headbadge{
  display:inline-flex; align-items:center; padding:7px 12px;
  border-radius:999px; border:1px solid rgb(var(--iw-brand-primary-rgb) / 0.20);
  background:rgb(var(--iw-brand-primary-rgb) / 0.08); color:var(--amber);
  font-size:11px; font-weight:700; letter-spacing:.05em;
}
.iw-headgrid{
  display:grid; grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr); gap:18px; align-items:stretch;
}
.iw-headcopy{
  padding:4px 0 0; text-align:center;
}
.iw-title{
  font-family:'Unbounded',sans-serif; font-weight:900;
  font-size:clamp(34px,5vw,58px); line-height:.94;
  letter-spacing:-.04em; color:var(--ink); margin:0 0 12px;
}
.iw-sub{ color:var(--muted); font-size:16px; font-weight:500; margin:0 auto; line-height:1.58; max-width:60ch; }
.iw-proofrow{
  display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; justify-content:center;
}
.iw-proofchip{
  display:inline-flex; align-items:center; padding:9px 12px;
  border-radius:999px; border:1px solid var(--border);
  background:oklch(100% 0 0 / .68); color:var(--ink);
  font-size:12px; font-weight:700; letter-spacing:.02em;
  box-shadow:inset 0 1px 0 oklch(100% 0 0 / .74);
}
.iw-headcard{
  position:relative; padding:18px 18px 16px;
  border-radius:22px; border:1px solid oklch(55% 0.14 195 / .16);
  background:linear-gradient(180deg, oklch(56% 0.11 196 / .10), oklch(100% 0 0 / .66));
  box-shadow:inset 0 1px 0 oklch(100% 0 0 / .7), 0 18px 36px -30px oklch(55% 0.14 195 / .38);
}
.iw-headcard-label{
  display:block; margin-bottom:12px;
  font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--teal);
}
.iw-headcard-metric{
  display:grid; grid-template-columns:24px 1fr; gap:10px; align-items:start;
  padding:10px 0; border-top:1px solid oklch(55% 0.14 195 / .12);
}
.iw-headcard-metric:first-of-type{ border-top:none; padding-top:0; }
.iw-headcard-metric strong{
  font-family:'Unbounded',sans-serif; font-size:13px; line-height:1.2; color:var(--teal);
}
.iw-headcard-metric span{
  font-size:13px; line-height:1.5; color:var(--ink); font-weight:600;
}

/* ── control shelf ─────────────────────────────────────────────── */
.iw-controlshelf{ margin:0 0 18px; }
.iw-bar{
  display:flex; align-items:center; gap:12px;
  margin:0 auto; padding:12px 14px;
  background:linear-gradient(180deg, oklch(99.4% 0.004 78), oklch(96.5% 0.012 78));
  border:1px solid var(--border); border-radius:22px;
  box-shadow:inset 0 1px 0 oklch(100% 0 0 / .8), 0 16px 30px -28px oklch(18% 0.022 78 / .38);
}
.iw-barlabel{
  font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--muted);
}
.iw-modes{ display:flex; gap:6px; background:transparent; border:none; padding:0; }
.iw-modebtn{
  font-family:'Inter',-apple-system,sans-serif; font-size:14px; font-weight:700;
  color:var(--muted); background:transparent; border:none;
  padding:10px 16px; cursor:pointer; border-radius:999px;
  transition:all .15s ease;
}
.iw-modebtn:hover:not(:disabled){ color:var(--ink); background:rgb(var(--iw-brand-primary-rgb) / 0.06); }
.iw-modebtn.on{ color:#fff; background:var(--grad-diag); box-shadow:var(--iw-shadow-brand-soft); }
.iw-modebtn:disabled{ opacity:.4; cursor:default; }
.iw-steprail{
  display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;
}
.iw-stepchip{
  display:inline-flex; align-items:center; padding:8px 11px;
  border-radius:999px; border:1px solid var(--border);
  background:oklch(100% 0 0 / .65); color:var(--muted);
  font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
}
.iw-stepchip--active{
  color:var(--amber); border-color:rgb(var(--iw-brand-primary-rgb) / 0.22); background:rgb(var(--iw-brand-primary-rgb) / 0.08);
}
.iw-stepchip--done{
  color:var(--teal); border-color:rgb(var(--iw-brand-tertiary-rgb,55 195 195) / 0.3);
  background:rgb(var(--iw-brand-tertiary-rgb,55 195 195) / 0.07);
}
.iw-steprail-arrow{
  color:var(--muted); font-size:14px; line-height:1;
  align-self:center; opacity:.5; flex-shrink:0;
}

/* ── slot machine cabinet ──────────────────────────────────────── */
.iw-slotmachine{
  position:relative; margin:0 0 10px; padding:16px;
  border-radius:34px;
  background:linear-gradient(180deg, oklch(44% 0.06 65), oklch(24% 0.03 58) 18%, oklch(14% 0.018 60) 100%);
  border:1px solid oklch(62% 0.12 72 / .55);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    inset 0 -1px 0 rgb(29 29 31 / 0.24),
    0 30px 60px -42px rgba(29, 29, 31, 0.45);
}
.iw-slotmachine::before{
  content:"";
  position:absolute; inset:10px;
  border-radius:26px;
  border:1px solid rgb(255 255 255 / 0.10);
  pointer-events:none;
}
.iw-marquee{
  display:flex; flex-direction:column; align-items:center; gap:8px;
  margin-bottom:14px; padding:14px 16px 12px;
  border-radius:22px;
  background:linear-gradient(180deg, oklch(80% 0.16 75), oklch(70% 0.19 65) 48%, oklch(58% 0.16 52));
  border:1px solid oklch(92% 0.12 82 / .45);
  box-shadow:inset 0 1px 0 oklch(100% 0 0 / .46), 0 16px 32px -24px oklch(0% 0 0 / .58);
  text-align:center;
}
.iw-marquee-label{
  font-family:'Unbounded',sans-serif; font-size:15px; font-weight:900; letter-spacing:.08em; color:#fff;
}
.iw-marquee-dots{ display:flex; gap:7px; }
.iw-marquee-dots span{
  width:8px; height:8px; border-radius:999px; background:oklch(99% 0.01 90);
  box-shadow:0 0 10px oklch(100% 0 0 / .9), 0 0 18px oklch(98% 0.08 88 / .65);
}
.iw-marquee-copy{
  font-size:12px; font-weight:700; letter-spacing:.03em; color:rgb(255 255 255 / 0.88);
}
.iw-reelintro{
  display:flex; align-items:end; justify-content:space-between; gap:16px;
  margin:0 0 14px; padding:0 4px;
}
.iw-reelintro-label{
  display:block; margin-bottom:6px;
  font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:oklch(83% 0.1 78);
}
.iw-reelintro-copy{
  margin:0; font-size:14px; line-height:1.55; color:oklch(95% 0.01 80); font-weight:600;
}
.iw-reelintro-tip{
  flex-shrink:0; display:inline-flex; align-items:center; padding:9px 12px;
  border-radius:999px; background:oklch(100% 0 0 / .12); color:oklch(98% 0.004 78);
  border:1px solid oklch(100% 0 0 / .12);
  font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
}

/* ── reels ─────────────────────────────────────────────────────── */
.iw-reels{
  position:relative; display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px;
  margin-bottom:0;
  padding:24px 18px 18px;
  border-radius:32px;
  background:linear-gradient(180deg, rgb(var(--iw-brand-primary-rgb) / 0.26) 0%, rgba(44, 22, 64, 0.94) 12%, rgba(24, 12, 38, 0.98) 100%);
  border:1px solid rgb(255 255 255 / 0.12);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.16),
    inset 0 -1px 0 rgb(29 29 31 / 0.58),
    0 26px 54px -36px rgba(29, 29, 31, 0.55);
  overflow:hidden;
}
.iw-reels::before{
  content:"";
  position:absolute; left:28px; right:28px; top:12px; height:12px;
  border-radius:999px;
  background:
    radial-gradient(circle at 6px 50%, oklch(90% 0.14 80) 0 2px, transparent 2.2px) 0 0 / 22px 12px repeat-x,
    linear-gradient(180deg, oklch(88% 0.09 78 / .42), oklch(48% 0.06 70 / .08));
  opacity:.88;
  pointer-events:none;
}
.iw-reels::after{
  content:"";
  position:absolute; inset:12px;
  border-radius:24px;
  border:1px solid oklch(100% 0 0 / .06);
  box-shadow:inset 0 0 0 1px oklch(16% 0.012 70 / .7);
  pointer-events:none;
}
.iw-payline{
  position:absolute; left:18px; right:18px;
  top:50%; height:${ITEM_H}px;
  transform:translateY(calc(-50% + 16px));
  border-top:2px solid rgb(var(--iw-brand-secondary-rgb) / 0.55);
  border-bottom:2px solid rgb(var(--iw-brand-secondary-rgb) / 0.55);
  background:linear-gradient(180deg, transparent 0%, rgb(255 255 255 / 0.05) 50%, transparent 100%);
  box-shadow:0 0 18px -14px rgb(var(--iw-brand-secondary-rgb) / 0.45);
  pointer-events:none; z-index:3;
}
.iw-marker{ display:none; }

.iw-col{
  --accent: var(--amber);
  min-width:0;
  position:relative; display:flex; flex-direction:column; align-items:stretch; gap:10px; z-index:2;
}
.iw-col:not(:last-child)::after{
  content:"";
  position:absolute; top:48px; right:-5px; bottom:8px; width:1px;
  background:linear-gradient(180deg, transparent, oklch(100% 0 0 / .16), transparent);
}
.iw-collabel{
  align-self:center;
  font-family:'Inter',-apple-system,sans-serif; font-size:11px; font-weight:700;
  letter-spacing:.24em; text-transform:uppercase;
  text-align:center; margin-bottom:2px; opacity:.95;
  color:var(--accent);
}
.iw-collabel::after{
  content:"";
  display:block; width:36px; height:2px; border-radius:999px;
  background:var(--accent); margin:8px auto 0;
  opacity:.9;
}
.iw-window{
  min-width:0;
  position:relative; width:100%; height:${ITEM_H * 3}px;
  background:linear-gradient(180deg, oklch(99.2% 0.008 78), oklch(95.5% 0.018 78));
  border:1px solid oklch(84% 0.03 78 / .92);
  border-radius:16px; overflow:hidden; cursor:pointer;
  box-shadow:
    inset 0 1px 0 oklch(100% 0 0 / .82),
    0 14px 24px -24px oklch(0% 0 0 / .72);
  transition:transform .18s ease, box-shadow .2s ease, border-color .18s ease;
}
.iw-window::before{
  content:"";
  position:absolute; inset:0;
  background:linear-gradient(180deg, oklch(18% 0.016 70 / .18) 0%, transparent 16%, transparent 84%, oklch(18% 0.016 70 / .24) 100%);
  pointer-events:none; z-index:1;
}
.iw-window::after{
  content:"";
  position:absolute; inset:0;
  box-shadow:inset 0 0 0 1px oklch(100% 0 0 / .16);
  pointer-events:none; z-index:1;
}
.iw-window:hover{ transform:translateY(-1px); box-shadow:inset 0 1px 0 oklch(100% 0 0 / .82), 0 18px 30px -24px oklch(0% 0 0 / .76); }
.iw-window.is-locked{ border-color:rgb(var(--iw-brand-primary-rgb) / 0.72); box-shadow:0 0 0 1px rgb(var(--iw-brand-primary-rgb) / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.82), 0 18px 30px -24px rgb(var(--iw-brand-primary-rgb) / 0.28); }

.iw-lock{
  position:absolute; top:10px; right:10px; z-index:5;
  width:30px; height:30px; display:grid; place-items:center;
  border:1px solid oklch(83% 0.03 78 / .9); border-radius:999px;
  background:oklch(99.5% 0.006 78 / .86); color:var(--muted);
  box-shadow:0 8px 16px -14px oklch(18% 0.022 78 / .4);
  cursor:pointer; transition:all .15s ease;
}
.iw-lock:hover{ color:var(--ink); border-color:oklch(76% 0.05 78); }
.iw-lock:active{ transform:scale(.9); }
.iw-lock.on{ color:var(--amber); border-color:var(--amber); background:var(--amber-bg); }

.iw-strip{
  position:relative; z-index:0; will-change:transform;
  -webkit-mask-image:linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
  mask-image:linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
}
.iw-item{
  min-width:0;
  display:flex; align-items:center; justify-content:center;
  text-align:center; padding:0 10px;
  background:linear-gradient(180deg, oklch(99.4% 0.008 78 / .96), oklch(95.8% 0.016 78 / .96));
  border-bottom:1px solid oklch(84% 0.025 78 / .52);
}
.iw-item:last-child{ border-bottom:none; }
.iw-item span{
  max-width:100%;
  font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size:clamp(14px, 1.35vw, 21px); font-weight:800; line-height:.94; letter-spacing:0;
  text-transform:uppercase;
  text-wrap:balance;
  overflow-wrap:normal;
  word-break:normal;
  hyphens:none;
  color:oklch(22% 0.02 78);
  text-shadow:none;
}

/* ── slot base / controls ─────────────────────────────────────── */
.iw-slotbase{
  margin-top:14px; padding:14px 8px 2px;
  border-radius:22px;
  background:linear-gradient(180deg, oklch(24% 0.03 58), oklch(15% 0.018 60));
  border:1px solid oklch(100% 0 0 / .08);
  box-shadow:inset 0 1px 0 oklch(100% 0 0 / .08);
}
.iw-slotlights{
  display:flex; justify-content:center; gap:10px; margin-bottom:14px;
}
.iw-slotlights span{
  width:10px; height:10px; border-radius:999px;
  background:linear-gradient(180deg, oklch(95% 0.1 85), oklch(75% 0.16 70));
  box-shadow:0 0 14px oklch(86% 0.14 78 / .45);
}
.iw-controls{ display:flex; flex-direction:column; align-items:center; gap:10px; margin:0 0 8px; }
.iw-spin{
  display:inline-flex; align-items:center; justify-content:center; gap:10px;
  font-family:'Unbounded',sans-serif; font-weight:800; font-size:15px; letter-spacing:.01em;
  color:#221607; padding:18px 28px; min-width:min(100%, 420px); width:100%; max-width:420px; border:none; border-radius:18px;
  background:linear-gradient(180deg, oklch(84% 0.16 78), oklch(72% 0.19 65) 52%, oklch(63% 0.18 58));
  cursor:pointer;
  box-shadow:
    inset 0 1px 0 oklch(100% 0 0 / .75),
    inset 0 -2px 0 oklch(45% 0.13 55 / .35),
    0 20px 38px -20px oklch(64% 0.18 58 / .65);
  transition:transform .12s cubic-bezier(0.16,1,0.3,1), filter .15s ease;
}
.iw-spin:hover:not(:disabled){ filter:brightness(1.03); transform:translateY(-2px); }
.iw-spin:active:not(:disabled){ transform:scale(.985) translateY(0); }
.iw-spin:disabled{ opacity:.45; cursor:default; }
.iw-spinhint{ font-size:12px; color:oklch(92% 0.01 80 / .78); font-weight:700; letter-spacing:.02em; }

/* ── result stage ─────────────────────────────────────────────── */
.iw-result{
  display:flex; flex-direction:column; align-items:center; gap:16px;
  margin-top:20px; padding-top:24px;
  border-top:1px solid var(--border);
  opacity:0; transform:translateY(10px);
  transition:opacity .35s ease-out, transform .35s cubic-bezier(0.16,1,0.3,1);
}
.iw-result.show{ opacity:1; transform:translateY(0); }

.iw-statement{ display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center; margin:0; }
.iw-prefix{ font-size:14px; font-weight:400; font-style:italic; color:var(--muted); }
.iw-fill{
  font-family:'Unbounded',sans-serif; font-weight:800;
  font-size:clamp(18px,3.2vw,30px);
  line-height:1.18; letter-spacing:-.02em; color:var(--ink);
}
.iw-in{ color:var(--muted); font-family:'Inter',-apple-system,sans-serif; font-weight:400; font-style:italic; font-size:.82em; }
.iw-dot{ color:var(--amber); }

.iw-score{ display:flex; flex-direction:column; gap:8px; }
.iw-score-top{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.iw-meter{
  height:6px; border-radius:999px; background:var(--surface2);
  border:1px solid var(--border); overflow:hidden; margin-top:4px;
}
.iw-meterfill{
  display:block; height:100%; border-radius:999px;
}
.iw-scorenum{
  font-family:'Unbounded',sans-serif; font-weight:900; font-size:36px;
  line-height:1; letter-spacing:-.02em;
}
.iw-scoredesc{
  font-size:12.5px; color:var(--muted); font-weight:400;
  line-height:1.4; flex:1; min-width:160px;
}
.iw-scoreband{
  font-family:'Inter',-apple-system,sans-serif; font-size:12px; font-weight:700;
  letter-spacing:.18em; text-transform:uppercase;
  border:1.5px solid currentColor; border-radius:3px; padding:3px 9px;
}

.iw-resultbtns{ display:flex; gap:10px; }
.iw-save,.iw-develop{
  display:inline-flex; align-items:center; gap:6px;
  font-family:'Inter',-apple-system,sans-serif; font-size:13px; font-weight:600;
  border-radius:5px; padding:10px 20px; cursor:pointer;
  transition:all .15s ease-out;
}
.iw-save{
  color:var(--ink); background:var(--surface);
  border:1.5px solid var(--border);
}
.iw-save:hover:not(:disabled){ border-color:var(--amber); color:var(--amber); }
.iw-develop{
  color:#fff; border:none;
  background:linear-gradient(135deg, var(--teal), var(--violet));
  box-shadow:0 6px 20px -8px oklch(46% 0.20 290 / .5);
}
.iw-develop:hover:not(:disabled){ filter:brightness(1.08); }
.iw-save:active:not(:disabled),.iw-develop:active:not(:disabled){ transform:scale(.96); }
.iw-save:disabled,.iw-develop:disabled{ opacity:.38; cursor:default; }
.iw-scorehint{
  display:block; font-size:11.5px; color:var(--muted);
  font-weight:500; text-align:center; margin-top:-4px;
}

/* ── share card button ────────────────────────────────────────── */
.iw-cardbtn{
  display:inline-flex; align-items:center; gap:6px;
  font-family:'Inter',-apple-system,sans-serif; font-size:12px; font-weight:600;
  color:var(--amber); background:var(--amber-bg);
  border:1.5px solid oklch(70% 0.19 65 / .3);
  border-radius:5px; padding:5px 12px; cursor:pointer;
  transition:all .15s ease-out;
}
.iw-cardbtn:hover{ background:oklch(92% 0.09 72); }
.iw-retry{ background:none; border:none; color:var(--amber); cursor:pointer; font-size:13px; text-decoration:underline; padding:0 2px; }

/* ── pipeline ─────────────────────────────────────────────────── */
.pip-root{ margin-top:32px; display:flex; flex-direction:column; }
.pip-header{
  display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;
}
.pip-header span{
  font-family:'Inter',-apple-system,sans-serif; font-size:11px; font-weight:700;
  letter-spacing:.24em; text-transform:uppercase; color:var(--muted);
}
.pip-connector{ width:1.5px; height:18px; background:var(--border); margin:0 auto; }
.pip-card{
  border:1.5px solid var(--border); border-radius:8px;
  padding:16px 18px; background:var(--surface);
  transition:border-color .3s ease, box-shadow .3s ease;
}
.pip-card--running{
  border-color:var(--accent);
  box-shadow:0 0 0 3px oklch(from var(--accent) l c h / .12);
}
.pip-card--done{ border-color:oklch(55% 0.14 195 / .35); }
.pip-card--error{ border-color:oklch(52% 0.18 25 / .4); }
.pip-card-head{ display:flex; align-items:flex-start; gap:12px; margin-bottom:0; }
.pip-card--done .pip-card-head,.pip-card--running .pip-card-head{ margin-bottom:14px; }
.pip-card-icon{
  width:30px; height:30px; display:grid; place-items:center;
  background:var(--surface2); border:1px solid var(--border);
  border-radius:6px; flex-shrink:0; margin-top:2px;
}
.pip-card-info{ flex:1; }
.pip-card-label{
  display:block; font-family:'Inter',-apple-system,sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.2em; text-transform:uppercase; margin-bottom:3px;
}
.pip-card-desc{ font-size:13px; color:var(--muted); line-height:1.45; }
.pip-card-badge{ display:flex; align-items:center; justify-content:center; width:24px; height:24px; flex-shrink:0; }
.pip-spinner{
  width:16px; height:16px; border:2px solid var(--border); border-top-color:var(--accent);
  border-radius:50%; animation:iwspin .7s linear infinite;
}
@keyframes iwspin{ to{ transform:rotate(360deg); } }
.pip-check{ color:var(--teal); font-size:16px; font-weight:700; }
.pip-xerr{ color:oklch(52% 0.18 25); font-size:16px; font-weight:700; }
.pip-num{ font-family:'Inter',-apple-system,sans-serif; font-size:13px; font-weight:600; color:var(--muted); }
.pip-output{ animation:iwIn .3s ease-out both; }
@keyframes iwIn{ from{ opacity:0; transform:translateY(5px); } to{ opacity:1; transform:translateY(0); } }
.pip-verdict{
  font-family:'Unbounded',sans-serif; font-size:14px; font-weight:800;
  color:var(--amber); margin:0 0 10px; line-height:1.35; letter-spacing:-.01em;
}
.pip-gap{ font-size:13.5px; color:var(--ink); margin:0 0 12px; line-height:1.5; }
.pip-gap strong,.pip-diff strong{
  color:var(--muted); font-size:10px; font-family:'Inter',-apple-system,sans-serif;
  letter-spacing:.16em; text-transform:uppercase; font-weight:700; margin-right:6px;
}
.pip-player{
  display:flex; flex-direction:column; gap:2px;
  padding:8px 10px; background:var(--surface2); border:1px solid var(--border);
  border-radius:6px; margin-bottom:6px;
}
.pip-playername{ font-size:13px; font-weight:600; color:var(--ink); }
.pip-playerweak{ font-size:12px; color:var(--muted); }
.pip-product{ margin-bottom:10px; }
.pip-productname{
  display:block; font-family:'Unbounded',sans-serif;
  font-size:20px; font-weight:800; color:var(--teal);
  letter-spacing:-.02em; line-height:1;
}
.pip-producttag{ display:block; font-size:14px; color:var(--muted); margin-top:4px; }
.pip-diff{ font-size:13.5px; color:var(--ink); margin:0 0 12px; line-height:1.5; }
.pip-features{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.pip-features li{ font-size:13px; color:var(--ink); padding-left:16px; position:relative; }
.pip-features li::before{ content:"→"; position:absolute; left:0; color:var(--teal); font-size:12px; }
.pip-err{ font-size:13px; color:oklch(52% 0.18 25); margin:8px 0 0; }
.pip-prototoggle{
  display:inline-flex; align-items:center; gap:6px;
  font-family:'Inter',-apple-system,sans-serif; font-size:12.5px; font-weight:600;
  color:var(--violet); background:oklch(46% 0.20 290 / .07);
  border:1.5px solid oklch(46% 0.20 290 / .25);
  border-radius:5px; padding:6px 12px; cursor:pointer; margin-bottom:12px;
  transition:all .15s ease;
}
.pip-prototoggle:hover{ background:oklch(46% 0.20 290 / .13); }
.pip-frame-wrap{
  border:1px solid var(--border); border-radius:10px; overflow:hidden;
  box-shadow:0 4px 24px -6px oklch(18% 0.022 78 / .12);
}
.pip-chrome{
  display:flex; align-items:center; gap:6px; padding:10px 14px;
  background:var(--surface2); border-bottom:1px solid var(--border);
}
.pip-chrome span{ width:10px; height:10px; border-radius:50%; }
.pip-chrome span:nth-child(1){ background:#ff5f57; }
.pip-chrome span:nth-child(2){ background:#febc2e; }
.pip-chrome span:nth-child(3){ background:#28c840; }
.pip-url{
  margin-left:10px; font-family:'Inter',-apple-system,sans-serif; font-size:11px;
  color:var(--muted); background:var(--surface); border:1px solid var(--border);
  border-radius:4px; padding:2px 10px;
}

/* ── shortlist ─────────────────────────────────────────────────── */
.iw-list{
  background:var(--surface); border:1.5px solid var(--border); border-radius:12px;
  padding:22px 20px; position:sticky; top:20px; min-height:260px;
  box-shadow:0 2px 16px -4px oklch(18% 0.022 78 / .08);
}
.iw-listhead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.iw-listhead h2{
  font-family:'Unbounded',sans-serif; font-weight:800; font-size:16px;
  margin:0; color:var(--ink); display:flex; align-items:center; gap:10px;
  letter-spacing:-.01em;
}
.iw-listhead h2 span{
  font-family:'Inter',-apple-system,sans-serif; font-size:12px; font-weight:700;
  color:var(--amber); background:var(--amber-bg);
  border:1.5px solid oklch(70% 0.19 65 / .28);
  border-radius:5px; padding:1px 8px;
}
.iw-listactions{ display:flex; gap:6px; }
.iw-listactions button{
  width:28px; height:28px; display:grid; place-items:center;
  border:1px solid var(--border); border-radius:6px; background:var(--surface2);
  color:var(--muted); cursor:pointer; transition:all .15s ease;
}
.iw-listactions button:hover{ color:var(--ink); }
.iw-listactions button:active{ transform:scale(.9); }
.iw-empty{ text-align:center; padding:32px 12px; color:var(--muted); }
.iw-empty p{
  font-family:'Unbounded',sans-serif; font-size:13px; font-weight:700;
  color:var(--ink); margin:0 0 7px; letter-spacing:-.01em;
}
.iw-empty span{ font-size:13px; line-height:1.55; }
.iw-empty strong{ color:var(--amber); font-weight:600; }
.iw-list ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.iw-row{
  display:flex; align-items:flex-start; gap:12px; padding:10px 12px;
  background:var(--surface2); border:1px solid var(--border);
  border-radius:7px; animation:iwIn .28s ease-out both;
}
.iw-num{
  font-family:'Unbounded',sans-serif; font-size:13px; font-weight:900;
  padding-top:1px; min-width:22px; line-height:1;
}
.iw-text{ flex:1; font-size:13px; line-height:1.45; color:var(--ink); font-weight:500; }
.iw-del{
  flex-shrink:0; width:20px; height:20px; display:grid; place-items:center;
  border:none; background:transparent; color:var(--muted);
  cursor:pointer; border-radius:5px; transition:all .15s ease;
}
.iw-del:hover{ color:oklch(52% 0.18 25); background:oklch(52% 0.18 25 / .08); }
.iw-tip{
  display:flex; align-items:flex-start; gap:8px; margin-top:16px;
  padding-top:14px; border-top:1px dashed var(--border);
  color:var(--muted); font-size:12px; line-height:1.5; font-weight:500;
}
.iw-tip svg{ color:var(--teal); flex-shrink:0; margin-top:2px; }


.pip-modelbadge{
  display:block; margin-top:8px;
  font-family:'Inter',-apple-system,sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.16em; text-transform:uppercase; color:var(--muted);
  background:var(--surface2); border:1px solid var(--border);
  border-radius:4px; padding:2px 8px; width:fit-content;
}








/* ── infrastructure agent ──────────────────────────────────────── */
.pip-services{display:flex;flex-direction:column;gap:10px;}
.pip-svc{padding:11px 13px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;}
.pip-svc-head{display:flex;align-items:baseline;gap:8px;margin-bottom:4px;flex-wrap:wrap;}
.pip-svc-name{font-family:'Unbounded',sans-serif;font-size:12px;font-weight:800;color:var(--ink);letter-spacing:-.01em;}
.pip-svc-time{font-size:11px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:1px 6px;}
.pip-svc-url{margin-left:auto;font-size:11px;font-weight:700;color:var(--teal);text-decoration:none;}
.pip-svc-url:hover{text-decoration:underline;}
.pip-svc-purpose{display:block;font-size:13px;color:var(--ink);margin-bottom:3px;line-height:1.45;}
.pip-svc-free{display:block;font-size:11.5px;color:var(--teal);margin-bottom:6px;}
.pip-svc-steps{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:4px;}
.pip-svc-steps li{font-size:12px;color:var(--muted);line-height:1.45;}
.pip-envblock{margin:0;font-family:'Space Mono',monospace;font-size:11.5px;line-height:1.7;color:var(--amber);background:oklch(18% 0.022 78);border:1px solid var(--line2,var(--border));border-radius:8px;padding:12px 14px;white-space:pre-wrap;word-break:break-all;overflow-x:auto;}
.pip-schema{font-size:13px;color:var(--ink);line-height:1.6;margin:0;font-family:'Space Mono',monospace;font-size:12px;}
.pip-aiwiring{padding:12px 14px;background:oklch(46% 0.20 290 / .06);border:1px solid oklch(46% 0.20 290 / .18);border-radius:8px;}
.pip-aiwiring p{font-size:13px;color:var(--ink);margin:4px 0 0;line-height:1.55;}
.pip-deploylist{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:5px;}
.pip-deploylist li{font-size:12.5px;color:var(--ink);line-height:1.45;}
.pip-costgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px;}
.pip-costcell{padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;text-align:center;}
.pip-costcellval{display:block;font-family:'Unbounded',sans-serif;font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.01em;}
.pip-costcellkey{display:block;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:3px;}
.pip-buildorder{font-size:13px;color:var(--ink);line-height:1.6;margin:0;}

/* ── start today ───────────────────────────────────────────────── */
.pip-startnow{margin-bottom:16px;padding:14px 16px;background:oklch(46% 0.20 290 / .06);border:1.5px solid oklch(46% 0.20 290 / .22);border-radius:10px;}
.pip-startnow-sub{font-size:12.5px;color:var(--muted);margin:4px 0 10px;line-height:1.4;}
.pip-today{list-style:none;margin:0;padding:0;counter-reset:today;display:flex;flex-direction:column;gap:8px;}
.pip-today li{counter-increment:today;position:relative;padding:10px 12px 10px 36px;background:var(--surface);border:1px solid var(--border);border-radius:7px;font-size:13px;line-height:1.5;color:var(--ink);}
.pip-today li::before{content:counter(today);position:absolute;left:10px;top:11px;font-family:'Unbounded',sans-serif;font-size:11px;font-weight:900;color:var(--violet);}
/* ── validate button ─────────────────────────────────────────── */
.iw-validate{display:inline-flex;align-items:center;gap:7px;font-family:'Inter',-apple-system,sans-serif;font-size:13px;font-weight:700;color:var(--ink);background:var(--surface);border:1.5px solid var(--border);border-radius:9px;padding:9px 16px;cursor:pointer;transition:all .15s ease-out;position:relative;}
.iw-validate:hover:not(:disabled){border-color:var(--ink);}
.iw-validate:active:not(:disabled){transform:scale(.97);}
.iw-validate:disabled{opacity:.55;cursor:default;}
.iw-validate--primary{
  color:#fff; background:var(--grad-diag); border-color:transparent;
  padding:12px 22px; font-size:14px; border-radius:12px;
  box-shadow:0 8px 24px -10px rgb(var(--iw-brand-secondary-rgb) / 0.45);
}
.iw-validate--primary:hover:not(:disabled){ filter:brightness(1.07); border-color:transparent; transform:translateY(-1px); }
.iw-validate--primary:active:not(:disabled){ transform:scale(.98) translateY(0); }
.iw-freebadge{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:rgb(255 255 255 / 0.25);border-radius:4px;padding:2px 6px;margin-left:2px;border:1px solid rgb(255 255 255 / 0.3);}
.iw-dotspinner{display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--ink);border-radius:50%;animation:iwspin .7s linear infinite;}
.iw-dotspinner--light{border-color:rgb(255 255 255 / 0.35);border-top-color:#fff;}

/* ── build brief button ─────────────────────────────────────── */
.iw-buildbtn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:'Inter',-apple-system,sans-serif;font-size:15px;font-weight:800;color:#fff;border:none;border-radius:12px;padding:15px;cursor:pointer;background:var(--grad-diag);box-shadow:var(--iw-shadow-brand);transition:all .18s ease-out;margin-top:16px;letter-spacing:-.01em;}
.iw-buildbtn:hover:not(:disabled){filter:brightness(1.07);}
.iw-buildbtn:active:not(:disabled){transform:scale(.98);}
.iw-buildbtn:disabled{opacity:.45;cursor:default;}
.iw-creditcost{font-size:12px;opacity:.8;font-weight:500;}
.iw-verdict-getc{display:block;width:100%;text-align:center;margin-top:8px;font-size:12px;color:var(--amber);background:none;border:none;cursor:pointer;text-decoration:underline;}

/* ── scout verdict card ─────────────────────────────────────── */
.iw-verdict{
  margin-top:18px;
  border-radius:20px;
  overflow:hidden;
  border:1.5px solid var(--border);
  box-shadow:0 12px 40px -16px oklch(18% 0.022 78 / .16);
}
.iw-verdict--build{ border-color:oklch(55% 0.14 195 / .5); }
.iw-verdict--warn{ border-color:oklch(70% 0.19 65 / .5); }
.iw-verdict--avoid{ border-color:oklch(62% 0.18 30 / .4); }

/* banner strip */
.iw-verdict-banner{
  padding:14px 20px;
  display:flex; align-items:center; gap:10px;
  border-bottom:1px solid oklch(0% 0 0 / .06);
}
.iw-verdict--build .iw-verdict-banner{ background:linear-gradient(90deg,oklch(55% 0.14 195 / .14),transparent); }
.iw-verdict--warn .iw-verdict-banner{ background:linear-gradient(90deg,oklch(70% 0.19 65 / .12),transparent); }
.iw-verdict--avoid .iw-verdict-banner{ background:linear-gradient(90deg,oklch(62% 0.18 30 / .12),transparent); }

.iw-verdict-icon{ font-size:18px; flex-shrink:0; line-height:1; }
.iw-verdict-title{
  font-family:'Unbounded',sans-serif;
  font-size:11px; font-weight:900;
  letter-spacing:.04em; text-transform:uppercase;
  flex:1;
}
.iw-verdict--build .iw-verdict-title{ color:var(--teal); }
.iw-verdict--warn .iw-verdict-title{ color:var(--amber); }
.iw-verdict--avoid .iw-verdict-title{ color:oklch(55% 0.18 30); }
.iw-verdict-sub{
  font-size:11px; font-weight:600;
  color:var(--muted);
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:99px;
  padding:3px 10px;
  white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis;
  max-width:160px;
}

/* body */
.iw-verdict-body{
  padding:18px 20px 20px;
  background:var(--surface);
}
.iw-verdict-reason{
  font-size:13.5px; color:var(--ink);
  line-height:1.65; margin:0 0 16px;
  word-break:break-word;
}

/* gap highlight */
.iw-verdict-gap{
  padding:12px 16px;
  background:oklch(55% 0.14 195 / .07);
  border-left:3px solid var(--teal);
  border-radius:0 10px 10px 0;
  margin-bottom:16px;
}
.iw-verdict-gap span{
  font-size:9px; font-weight:800;
  letter-spacing:.24em; text-transform:uppercase;
  color:var(--teal); display:block; margin-bottom:5px;
}
.iw-verdict-gap p{
  margin:0; font-size:13.5px; font-weight:600;
  color:var(--ink); line-height:1.5;
  word-break:break-word;
}

/* competitors */
.iw-verdict-players-label{
  font-size:9px; font-weight:800;
  letter-spacing:.24em; text-transform:uppercase;
  color:var(--muted); display:block; margin-bottom:8px;
}
.iw-verdict-players{
  border:1px solid var(--border);
  border-radius:12px; overflow:hidden;
  margin-bottom:16px;
}
.iw-verdict-player{
  display:grid;
  grid-template-columns:120px 1fr;
  gap:10px;
  padding:10px 14px;
  border-bottom:1px solid var(--border);
  background:var(--surface);
}
.iw-verdict-player:last-child{ border-bottom:none; }
.iw-verdict-player:nth-child(even){ background:var(--surface2); }
.iw-verdict-pname{
  font-weight:800; font-size:12.5px;
  color:var(--ink);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.iw-verdict-pdetail{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.iw-verdict-pprice{
  font-size:11px; font-weight:700; color:var(--teal);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.iw-verdict-pweak{
  font-size:12px; color:var(--muted); line-height:1.4;
  display:-webkit-box; -webkit-line-clamp:2;
  -webkit-box-orient:vertical; overflow:hidden;
}

/* pivot / instead */
.iw-verdict-pivot{
  padding:14px 16px;
  background:oklch(95% 0.06 75 / .5);
  border:1.5px solid oklch(70% 0.19 65 / .35);
  border-radius:12px; margin-bottom:16px;
}
.iw-verdict-pivot-label{
  display:flex; align-items:center; gap:6px;
  font-size:9px; font-weight:800;
  letter-spacing:.24em; text-transform:uppercase;
  color:var(--amber); margin-bottom:8px;
}
.iw-verdict-pivot p{
  margin:0; font-size:13.5px; font-weight:500;
  color:var(--ink); line-height:1.6;
  word-break:break-word;
}

/* spin again button */
.iw-verdict-spin{
  width:100%;
  font-family:'Inter',-apple-system,sans-serif;
  font-size:13px; font-weight:700;
  color:var(--muted);
  background:transparent;
  border:1.5px solid var(--border);
  border-radius:12px; padding:11px;
  cursor:pointer; transition:all .15s ease-out;
  display:flex; align-items:center; justify-content:center; gap:8px;
}
.iw-verdict-spin:hover{ border-color:var(--ink); color:var(--ink); background:var(--surface2); }
.iw-verdict-spin:active{ transform:scale(.98); }



/* ── eureka score state ─────────────────────────────────────────── */
.iw-score--eureka{position:relative;}
.iw-score--eureka::before{
  content:'';position:absolute;inset:-8px -12px;border-radius:14px;
  background:linear-gradient(135deg,oklch(70% 0.19 65 / .12),oklch(82% 0.16 70 / .08));
  border:1.5px solid oklch(70% 0.19 65 / .35);
  animation:eurekapulse 2.4s ease-in-out infinite;pointer-events:none;
}
@keyframes eurekapulse{
  0%,100%{box-shadow:0 0 0 0 oklch(70% 0.19 65 / .2);}
  50%{box-shadow:0 0 18px 4px oklch(70% 0.19 65 / .15);}
}
.iw-scoreband--eureka{
  font-family:'Unbounded',sans-serif;font-size:10px;font-weight:900;
  letter-spacing:.06em;color:var(--amber);
  background:oklch(70% 0.19 65 / .12);
  border:1.5px solid oklch(70% 0.19 65 / .4);
  border-radius:6px;padding:3px 8px;
}
.iw-eureka-angle{
  display:inline-flex;align-items:center;gap:7px;margin-top:6px;
  font-size:12px;font-weight:600;color:var(--amber);
  background:oklch(70% 0.19 65 / .08);
  border:1px solid oklch(70% 0.19 65 / .25);
  border-radius:8px;padding:6px 12px;
}
.iw-eureka-angle span{
  font-family:'Unbounded',sans-serif;font-size:9px;
  font-weight:900;letter-spacing:.14em;opacity:.7;
}

/* ── disclaimer ─────────────────────────────────────────────────── */
.iw-disclaimer{
  max-width:680px;
  margin:40px auto 0;
  padding:20px 24px;
  border-top:1px solid var(--border);
  text-align:center;
}
.iw-disclaimer p{
  font-size:11.5px;
  color:var(--muted);
  line-height:1.7;
  margin:0;
  font-weight:400;
}
/* ── run cost bar ──────────────────────────────────────────────── */
.pip-costbar{margin-top:20px;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.pip-costlabel{font-family:'Inter',-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);flex-shrink:0;}
.pip-costagent{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);padding:2px 8px;background:var(--surface);border:1px solid var(--border);border-radius:5px;}
.pip-costagentname{font-weight:700;color:var(--ink);}
.pip-costamt{font-weight:700;color:var(--teal);}
.pip-costtotal{margin-left:auto;font-size:12px;color:var(--ink);}
.pip-costtotal strong{font-family:'Unbounded',sans-serif;font-size:13px;font-weight:900;color:var(--ink);}
/* ── crowded market ────────────────────────────────────────────── */
.pip-crowded{border:1.5px solid oklch(70% 0.19 65 / .45);border-radius:12px;padding:20px;background:var(--surface);position:relative;overflow:hidden;}
.pip-crowded::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--amber);}
.pip-crowded-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;}
.pip-crowded-icon{font-size:26px;line-height:1;flex-shrink:0;}
.pip-crowded-title{display:block;font-family:'Unbounded',sans-serif;font-size:13px;font-weight:800;color:var(--amber);letter-spacing:-.01em;}
.pip-crowded-refund{display:block;font-size:11.5px;color:var(--teal);font-weight:600;margin-top:3px;}
.pip-crowded-reason{font-size:14px;color:var(--ink);line-height:1.6;margin:0 0 16px;}
.pip-pivot{padding:12px 14px;background:var(--amber-bg);border:1px solid oklch(70% 0.19 65 / .25);border-radius:8px;margin-bottom:16px;}
.pip-pivot p{font-size:13.5px;color:var(--ink);margin:6px 0 0;line-height:1.5;}
.pip-crowded-spin{width:100%;font-family:'Inter',-apple-system,sans-serif;font-size:13px;font-weight:700;color:var(--ink);background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;padding:11px;cursor:pointer;transition:all .15s ease-out;}
.pip-crowded-spin:hover{border-color:var(--amber);color:var(--amber);}
.pip-crowded-spin:active{transform:scale(.98);}
/* ── verdict badge ─────────────────────────────────────────────── */
.pip-verdictrow{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}
.pip-verdictbadge{font-family:'Inter',-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:5px;padding:3px 10px;border:1.5px solid;}
.pip-vt--build{color:var(--teal);border-color:oklch(55% 0.14 195 / .4);background:oklch(55% 0.14 195 / .08);}
.pip-vt--warning{color:var(--amber);border-color:oklch(70% 0.19 65 / .4);background:var(--amber-bg);}
.pip-warningnote{font-size:12px;color:var(--muted);font-style:italic;}
/* ── credits & pricing ─────────────────────────────────────────── */
.iw-buildrow{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;}
.iw-creditpill{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:10px 14px;background:linear-gradient(180deg, var(--surface), oklch(96% 0.014 78));border:1.5px solid var(--border);border-radius:16px;min-width:84px;cursor:pointer;transition:all .15s ease-out;box-shadow:inset 0 1px 0 oklch(100% 0 0 / .74);}
.iw-creditpill:hover{border-color:var(--teal);background:oklch(55% 0.14 195 / .08);}
.iw-creditnum{font-family:'Unbounded',sans-serif;font-size:20px;font-weight:900;color:var(--ink);line-height:1;}
.iw-creditlbl{font-family:'Inter',-apple-system,sans-serif;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);}

.iw-pricing{margin-top:20px;padding:20px;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;box-shadow:0 4px 24px -8px oklch(18% 0.022 78 / .12);}
.iw-pricinghead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.iw-pricinghead span{font-family:'Inter',-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);}
.iw-pricingclose{background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0;line-height:1;transition:color .15s;}
.iw-pricingclose:hover{color:var(--ink);}
.iw-pricingsub{font-size:13px;color:var(--muted);margin:0 0 16px;line-height:1.5;}
.iw-priceerr{margin:0 0 14px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,107,107,.25);background:rgba(255,107,107,.08);color:#ffb0b0;font-size:12px;line-height:1.45;}
.iw-pkgs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.iw-pkg{display:flex;flex-direction:column;gap:3px;padding:12px 14px;background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;transition:border-color .15s;}
.iw-pkg--hl{border-color:var(--amber);background:var(--amber-bg);}
.iw-pkg:hover{border-color:oklch(88% 0.018 78);}
.iw-pkg--hl:hover{border-color:var(--amber);}
.iw-pkglabel{font-family:'Unbounded',sans-serif;font-size:11px;font-weight:800;color:var(--ink);letter-spacing:-.01em;}
.iw-pkgcredits{font-family:'Inter',-apple-system,sans-serif;font-size:13px;font-weight:700;color:var(--ink);margin:2px 0;}
.iw-pkgprice{font-family:'Unbounded',sans-serif;font-size:20px;font-weight:900;color:var(--ink);letter-spacing:-.02em;line-height:1;}
.iw-pkgper{font-size:11px;color:var(--muted);margin-bottom:8px;}
.iw-pkgbtn{font-family:'Inter',-apple-system,sans-serif;font-size:12px;font-weight:700;color:#fff;background:var(--ink);border:none;border-radius:6px;padding:7px 0;cursor:pointer;transition:all .15s;}
.iw-pkg--hl .iw-pkgbtn{background:var(--amber);color:#1a1206;}
.iw-pkgbtn:hover{filter:brightness(1.1);}
.iw-pkgbtn:disabled{cursor:wait;opacity:.7;filter:none;}
.iw-pkgbtn:active{transform:scale(.97);}
/* ── market sizing ─────────────────────────────────────────────── */
.pip-marketsz{display:flex;align-items:baseline;gap:8px;margin-bottom:10px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;}
.pip-mslabel{font-family:'Inter',-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);flex-shrink:0;}

/* ── competitor table ──────────────────────────────────────────── */
.pip-comptable{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:4px;}
.pip-comptable th{font-family:'Inter',-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px 8px 6px 0;border-bottom:1px solid var(--border);}
.pip-comptable td{padding:7px 8px 7px 0;vertical-align:top;border-bottom:1px solid var(--border);color:var(--ink);line-height:1.4;}
.pip-comptable tr:last-child td{border-bottom:none;}
.pip-compname{font-weight:700;color:var(--ink);}
.pip-compprice{font-family:'Inter',-apple-system,sans-serif;font-weight:600;color:var(--teal);white-space:nowrap;}

/* ── GTM hero ──────────────────────────────────────────────────── */
.pip-gtmhero{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;}
.pip-revgoal,.pip-buildtime{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;}
.pip-revnum,.pip-btnum{font-family:'Unbounded',sans-serif;font-size:14px;font-weight:800;color:var(--ink);line-height:1.2;}
.pip-revlabel,.pip-btlabel{font-family:'Inter',-apple-system,sans-serif;font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);}

/* ── GTM sections ──────────────────────────────────────────────── */
.pip-section{margin-bottom:16px;}
.pip-seclabel{display:block;font-family:'Inter',-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:7px;}
.pip-persona{font-size:13.5px;color:var(--ink);margin:0 0 6px;font-weight:600;line-height:1.45;}
.pip-where{font-size:13px;color:var(--ink);margin:0;line-height:1.45;}
.pip-where strong{color:var(--muted);font-size:10px;font-family:'Inter',-apple-system,sans-serif;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin-right:4px;}

/* ── first 5 customers ─────────────────────────────────────────── */
.pip-five{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;counter-reset:five;}
.pip-five li{counter-increment:five;position:relative;padding:9px 12px 9px 36px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;font-size:13px;line-height:1.5;color:var(--ink);}
.pip-five li::before{content:counter(five);position:absolute;left:10px;top:10px;font-family:'Unbounded',sans-serif;font-size:11px;font-weight:900;color:var(--violet);}

/* ── channels ──────────────────────────────────────────────────── */
.pip-channel{padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;margin-bottom:6px;}
.pip-chname{display:block;font-family:'Inter',-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:4px;}
.pip-chtactic{display:block;font-size:13px;color:var(--ink);line-height:1.45;margin-bottom:4px;}
.pip-chtl{display:block;font-size:11.5px;color:var(--muted);}

/* ── pricing box ───────────────────────────────────────────────── */
.pip-pricebox{margin:16px 0;padding:14px 16px;background:oklch(95% 0.06 75 / .45);border:1.5px solid oklch(70% 0.19 65 / .35);border-radius:10px;}
.pip-price{display:block;font-family:'Unbounded',sans-serif;font-size:24px;font-weight:900;color:var(--amber);letter-spacing:-.02em;margin-bottom:4px;}
.pip-pricerat{display:block;font-size:13px;color:var(--ink);line-height:1.5;margin-bottom:4px;}
.pip-pricetrial{display:block;font-size:12px;color:var(--muted);font-style:italic;}

/* ── 30-day plan ───────────────────────────────────────────────── */
.pip-weeks{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.pip-week{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 12px;}
.pip-weekn{display:block;font-family:'Unbounded',sans-serif;font-size:11px;font-weight:900;color:var(--violet);margin-bottom:3px;}
.pip-weektheme{display:block;font-size:12px;font-weight:700;color:var(--ink);margin-bottom:7px;line-height:1.3;}
.pip-week ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;}
.pip-week ul li{font-size:11.5px;color:var(--muted);line-height:1.4;padding-left:10px;position:relative;}
.pip-week ul li::before{content:"·";position:absolute;left:0;color:var(--violet);}

/* ── build stack ───────────────────────────────────────────────── */
.pip-stack{display:flex;flex-wrap:wrap;gap:6px;}
.pip-stackpill{font-family:'Inter',-apple-system,sans-serif;font-size:11.5px;font-weight:700;color:var(--teal);background:oklch(55% 0.14 195 / .08);border:1px solid oklch(55% 0.14 195 / .28);border-radius:5px;padding:3px 10px;}
/* ── build button row (verdict) ────────────────────────────────── */
.iw-buildbtnrow{
  display:flex; align-items:stretch; gap:10px; margin-top:16px;
}
.iw-buildbtnrow .iw-buildbtn{ flex:1; margin-top:0; }
.iw-creditpill--verdict{
  flex-shrink:0; min-width:64px;
  border-radius:12px;
}

/* ── pipeline progress bar ─────────────────────────────────────── */
.pip-progress{
  position:relative;
  display:grid; grid-template-columns:repeat(4,1fr); gap:0;
  margin-bottom:24px; padding:16px 18px 14px;
  background:var(--surface2); border:1px solid var(--border);
  border-radius:12px; overflow:hidden;
}
.pip-progress-track{
  position:absolute; bottom:0; left:0; right:0; height:3px;
  background:var(--border);
}
.pip-progress-fill{
  height:100%; background:var(--grad-diag);
  border-radius:999px; transition:width 0.6s cubic-bezier(0.16,1,0.3,1);
}
.pip-progress-step{
  display:flex; flex-direction:column; align-items:center; gap:7px;
  position:relative;
}
.pip-progress-step:not(:last-child)::after{
  content:'';
  position:absolute; top:14px; left:calc(50% + 14px); right:calc(-50% + 14px);
  height:1px; background:var(--border); z-index:0;
}
.pip-progress-dot{
  width:28px; height:28px; border-radius:50%;
  display:grid; place-items:center;
  font-family:'Unbounded',sans-serif; font-size:11px; font-weight:800;
  background:var(--surface); border:1.5px solid var(--border);
  color:var(--muted); transition:all .3s ease; position:relative; z-index:1;
}
.pip-progress-step--running .pip-progress-dot{
  border-color:var(--amber); color:var(--amber);
  background:rgb(var(--iw-brand-primary-rgb) / 0.08);
  box-shadow:0 0 0 4px rgb(var(--iw-brand-primary-rgb) / 0.12);
}
.pip-progress-step--done .pip-progress-dot{
  border-color:var(--teal); color:var(--teal);
  background:rgb(var(--iw-brand-tertiary-rgb,55 195 195) / 0.10);
}
.pip-progress-label{
  font-family:'Inter',-apple-system,sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.14em; text-transform:uppercase; color:var(--muted);
  transition:color .3s ease;
}
.pip-progress-step--running .pip-progress-label{ color:var(--amber); }
.pip-progress-step--done .pip-progress-label{ color:var(--teal); }
.pip-spinner--sm{
  width:12px; height:12px; border:2px solid var(--border);
  border-top-color:var(--amber); border-radius:50%;
  animation:iwspin .7s linear infinite;
  display:inline-block;
}

/* ── responsive ───────────────────────────────────────────────── */
@media (max-width:860px){
  .iw-root{ padding:20px 14px 56px; }
  .iw-shell{ grid-template-columns:1fr; gap:18px; }
  .iw-machine{ padding:20px 14px 24px; border-radius:26px; }
  .iw-list{ position:static; }
  .iw-headtop{ flex-direction:column; align-items:flex-start; gap:8px; margin-bottom:14px; }
  .iw-headgrid{ grid-template-columns:1fr; gap:14px; }
  .iw-title{ font-size:42px; }
  .iw-sub{ font-size:15px; }
  .iw-proofrow{ gap:6px; }
  .iw-proofchip{ font-size:11px; padding:8px 10px; }
  .iw-headcard{ padding:14px; border-radius:18px; }
  .iw-bar{ gap:10px; padding:12px; border-radius:18px; }
  .iw-modes{ flex:1; display:grid; grid-template-columns:1fr 1fr; min-width:0; }
  .iw-modes{ width:100%; display:grid; grid-template-columns:1fr 1fr; min-width:0; }
  .iw-modebtn{ width:100%; padding:11px 10px; }
  .iw-creditpill{ min-width:72px; padding:10px 12px; }
  .iw-steprail{ gap:6px; }
  .iw-stepchip{ font-size:10px; padding:7px 9px; }
  .iw-slotmachine{ padding:12px; border-radius:26px; }
  .iw-marquee{ margin-bottom:12px; padding:12px 12px 11px; border-radius:18px; }
  .iw-marquee-label{ font-size:13px; }
  .iw-marquee-copy{ font-size:11px; }
  .iw-reelintro{ flex-direction:column; align-items:flex-start; gap:10px; padding:0 2px; }
  .iw-reelintro-copy{ font-size:13px; }
  .iw-reelintro-tip{ font-size:10px; }
  .iw-fill{ font-size:19px; }
  .iw-reels{ gap:6px; padding:16px 8px 10px; border-radius:22px; }
  .iw-payline{ left:10px; right:10px; }
  .iw-col{ gap:8px; min-width:0; }
  .iw-col:not(:last-child)::after{ right:-3px; }
  .iw-collabel{ font-size:8px; letter-spacing:.16em; }
  .iw-collabel::after{ width:24px; margin-top:6px; }
  .iw-window{ border-radius:12px; }
  .iw-lock{ top:8px; right:8px; width:26px; height:26px; }
  .iw-item{ padding:0 4px; }
  .iw-item span{ font-size:11.5px; line-height:1; }
  .iw-slotbase{ margin-top:10px; padding:12px 6px 2px; border-radius:18px; }
  .iw-slotlights{ gap:8px; margin-bottom:12px; }
  .iw-slotlights span{ width:8px; height:8px; }
  .iw-controls{ margin-top:0; }
  .iw-spin{ max-width:none; font-size:14px; padding:16px 18px; border-radius:16px; }
}
@media (prefers-reduced-motion:reduce){
  .iw-result{ transition:opacity .2s ease; }
  .iw-row,.pip-output{ animation:none; }
}
`
