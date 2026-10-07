'use client';

// NHL Prop Probability Model — ported from Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx
// and restyled to the Flowbit theme used on ideareels.io. Model logic is unchanged.

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { TEAM_LOGO_ABBR, TEAM_SHORT, buildProjections, clamp, isOnFire, normShort, normTeam, normalizeName, normalizePlayerName, parseBoxScoresWorkbook, parseHistoricalProfiles, parseLineups, parseMatchups, parsePaceWorkbook, parsePlayerHomeAway, parseRankingsFile, poissonAtLeast, summarizeRun } from "./model-core";
export { summarizeRun };




function teamLogoUrl(teamKey) {
  const abbr = TEAM_LOGO_ABBR[normTeam(teamKey || "")];
  return abbr ? `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg` : "";
}

function useViewportFlags() {
  const getWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1440);
  const [viewportWidth, setViewportWidth] = useState(getWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    viewportWidth,
    isTablet: viewportWidth < 1180,
    isMobile: viewportWidth < 768,
  };
}

// ─── FILE READER ─────────────────────────────────────────────────────────────

function readWorkbook(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        res(XLSX.read(e.target.result, { type: "binary" }));
      } catch (err) {
        rej(err);
      }
    };

    reader.onerror = (e) =>
      rej(
        new Error(
          `FileReader error reading ${file.name}: ${
            e.target?.error?.message || "unknown"
          }`
        )
      );

    reader.readAsBinaryString(file);
  });
}

function evaluateBestBetOutcome(r, actual) {
  if (!r || !actual) return { label: "No actual", color: "#636977", bg: "#f2f2f8" };
  const best = bestBetLabel(r);
  const key = best.key || "";
  let hit = false;
  if (key === "shots3") hit = (actual.shots || 0) >= 3;
  else if (key === "shots4") hit = (actual.shots || 0) >= 4;
  else if (key === "shots5") hit = (actual.shots || 0) >= 5;
  else if (key === "point1") hit = (actual.points || 0) >= 1;
  else if (key === "point2") hit = (actual.points || 0) >= 2;
  else if (key === "goal") hit = (actual.goals || 0) >= 1;
  else if (key === "goals2") hit = (actual.goals || 0) >= 2;
  return hit ? { label: "Hit", color: "#166534", bg: "#dcfce7" } : { label: "Miss", color: "#991b1b", bg: "#fee2e2" };
}


function fmtPct(val) {
  return val == null || Number.isNaN(Number(val)) ? null : `${Math.round(Number(val) * 100)}%`;
}

function summarizeRoleHistoryText(r) {
  if (!r) return '';
  const role = (r.currentRole || `${r.pos}${r.todayLine || ''}`).toUpperCase();
  const venue = r.isHome ? 'home' : 'away';
  const sample = r.roleVenueSample ?? r.roleSample ?? 0;
  const bits = [];

  const pair = (label, roleRate, posRate) => {
    if (roleRate == null) return null;
    const rolePct = fmtPct(roleRate);
    const posPct = fmtPct(posRate);
    if (posRate == null) return `${role} ${venue} has hit ${label} in ${rolePct} of the sample`;
    const diff = Number(roleRate) - Number(posRate);
    const comp = Math.abs(diff) >= 0.03
      ? diff > 0
        ? `vs ${posPct} for the broader ${r.pos} lane`
        : `vs ${posPct} for the broader ${r.pos} lane`
      : `in line with the broader ${r.pos} lane (${posPct})`;
    return `${role} ${venue} has hit ${label} in ${rolePct} of the sample, ${comp}`;
  };

  const pointText = pair('1+ point', r.roleP1Rate, r.histP1Rate);
  const goalText = pair('1+ goal', r.roleG1Rate, r.histG1Rate);
  const shotText = pair('3+ shots', r.roleS3Rate, r.histS3Rate);

  if (pointText) bits.push(pointText);
  if (goalText) bits.push(goalText);
  else if (shotText) bits.push(shotText);

  if (!bits.length) return '';
  const sampleText = sample ? ` Sample: ${sample} ${sample === 1 ? 'game' : 'games'}.` : '';
  return bits.join('. ') + '.' + sampleText;
}

function summarizeDefenseRoleProfile(r) {
  if (!r) return '';
  const role = (r.currentRole || `${r.pos}${r.todayLine || ''}`).toUpperCase();
  const venue = r.isHome ? 'home' : 'away';
  const sample = r.roleVenueSample ?? r.roleSample ?? 0;
  if (!sample) return '';

  const parts = [];
  const pushIf = (rate, posRate, label) => {
    if (rate == null) return;
    const pct = fmtPct(rate);
    const posPct = fmtPct(posRate);
    if (posRate == null) parts.push(`${label} ${pct}`);
    else {
      const diff = Number(rate) - Number(posRate);
      const descriptor = Math.abs(diff) < 0.03 ? 'in line with' : diff > 0 ? 'above' : 'below';
      parts.push(`${label} ${pct} (${descriptor} ${r.pos} ${posPct})`);
    }
  };

  pushIf(r.roleS3Rate, r.histS3Rate, '3+ shots');
  pushIf(r.roleP1Rate, r.histP1Rate, '1+ point');
  pushIf(r.roleG1Rate, r.histG1Rate, '1+ goal');
  if (!parts.length) return '';
  return `${role} ${venue} history: ${parts.join(' · ')} · sample ${sample}g`;
}



function roleDisplay(r) {
  if (!r) return "";
  const pos = (r.pos || "").toUpperCase();
  const line = r.todayLine || "";
  if (!pos) return "";
  return `${pos}${line}`;
}

function defenseContextClause(r, market = "shots") {
  if (!r) return "";
  const role = roleDisplay(r).toLowerCase();
  const opp = r.opponent || "today's opponent";
  const shotRank = r.rankShots || r.defRank || null;
  const goalLabel = r.defenseRoleGoalLabel || "";
  const shotLabel = r.defenseRoleShotLabel || "";
  const genericSummary = r.defenseRoleSummary || "";

  const shotState = shotLabel
    ? shotLabel.toLowerCase()
    : shotRank != null
    ? shotRank <= 10
      ? `allows shots to ${role}`
      : shotRank >= 23
      ? `suppresses shots to ${role}`
      : `is neutral for shots to ${role}`
    : `has a mixed shot profile versus ${role}`;

  const goalState = goalLabel
    ? goalLabel.toLowerCase()
    : (r.p1g || 0) >= 0.24
    ? `does not fully suppress goals in that lane`
    : `leans more toward goal suppression than goal leakage`;

  const pointState = (r.p1p || 0) >= 0.52
    ? `the point path stays open`
    : (r.p2p || 0) >= 0.15
    ? `secondary point upside is still alive`
    : `point upside is more modest`;

  if (market === "shots") {
    return `${opp} ${shotState}, while ${goalState}.`;
  }
  if (market === "goals") {
    const intro = goalLabel
      ? `${opp} ${goalState}`
      : `${opp} ${goalState}`;
    const tail = shotLabel ? ` and ${shotState}` : "";
    return `${intro}${tail}.`;
  }
  if (market === "points") {
    return `${opp} ${shotState}, and ${pointState}.`;
  }
  return genericSummary ? `${opp} ${genericSummary}.` : `${opp} has a mixed role profile tonight.`;
}

function buildBoardBulletPoints(r, market = "shots") {
  if (!r) return [];
  const role = roleDisplay(r);
  const lineSharePct = Math.round((r.lineShare || 0) * 100);
  const lambdaShots = r.lambdaS != null ? r.lambdaS.toFixed(1) : "—";
  const lambdaPoints = r.lambdaP != null ? r.lambdaP.toFixed(2) : "—";
  const lambdaGoals = r.lambdaG != null ? r.lambdaG.toFixed(2) : "—";
  const historyTag = r.lineFit === "aligned"
    ? `Historical ${role} sample is aligned with the lane.`
    : r.lineFit === "mismatch"
    ? `Historical ${role} sample is weaker than the overall lane.`
    : `Historical ${role} sample is neutral.`;
  const venueTag = r.venueFormTag && r.venueFormTag !== "Neutral"
    ? `${r.venueLabel || r.venue} form is ${r.venueFormTag.toLowerCase()}.`
    : `${r.venueLabel || r.venue} form is neutral.`;
  const projectedTriplet = `Projected: Shots ${lambdaShots} | Points ${lambdaPoints} | Goals ${lambdaGoals}.`;

  if (market === "shots") {
    return [
      defenseContextClause(r, "shots"),
      `${r.name} is skating as ${role} and owns about ${lineSharePct}% of his line's shot share.`,
      projectedTriplet,
      historyTag,
      venueTag,
    ];
  }
  if (market === "goals") {
    return [
      defenseContextClause(r, "goals"),
      `${r.name} is skating as ${role} with a ${Math.round((r.dangerRate || 0) * 100)}% danger mix.`,
      projectedTriplet,
      historyTag,
      venueTag,
    ];
  }
  if (market === "points") {
    return [
      defenseContextClause(r, "points"),
      `${r.name} is skating as ${role} and still carries about ${lineSharePct}% of his line's shot share into the point path.`,
      projectedTriplet,
      historyTag,
      venueTag,
    ];
  }
  return [defenseContextClause(r, market), `${r.name} is skating as ${role}.`, projectedTriplet];
}

function buildBoardRationale(r, market = "shots") {
  return buildBoardBulletPoints(r, market).join(" ");
}

function BulletList({ items, color = "#373449", fontSize = "18px", tight = false }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: "20px", color, fontSize, lineHeight: tight ? 1.45 : 1.6, display: "grid", gap: tight ? "2px" : "4px" }}>
      {list.map((item, idx) => (
        <li key={`${idx}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}


function getShotTag(p4s = 0) {
  if (p4s >= 0.70) return { label: '4+ ELITE', fg: '#166534', bg: '#dcfce7' };
  if (p4s >= 0.55) return { label: '4+ CORE', fg: '#166534', bg: '#dcfce7' };
  if (p4s >= 0.45) return { label: '4+ THIN', fg: '#92400e', bg: '#fef3c7' };
  return null;
}

function getCeilingTag(p5s = 0) {
  if (p5s >= 0.30) return { label: '5+ ELITE', fg: '#1d4ed8', bg: '#dbeafe' };
  if (p5s >= 0.18) return { label: '5+ EDGE', fg: '#1d4ed8', bg: '#dbeafe' };
  if (p5s >= 0.12) return { label: '5+ LOTTO', fg: '#7c3aed', bg: '#ede9fe' };
  return null;
}

function getGoalTag(p1g = 0) {
  if (p1g >= 0.45) return { label: 'GOAL ELITE', fg: '#b45309', bg: '#fef3c7' };
  if (p1g >= 0.30) return { label: 'GOAL CORE', fg: '#b45309', bg: '#fef3c7' };
  if (p1g >= 0.22) return { label: 'GOAL THIN', fg: '#9a3412', bg: '#ffedd5' };
  if (p1g >= 0.18) return { label: 'GOAL LOTTO', fg: '#9a3412', bg: '#ffedd5' };
  return null;
}

function getCompositeTag(r) {
  const shot = getShotTag(r?.p4s || 0);
  const ceil = getCeilingTag(r?.p5s || 0);
  const goal = getGoalTag(r?.p1g || 0);
  const style = String(r?.capabilityStyle || r?.style || '').toLowerCase();
  const finisher = style.includes('finisher');
  if (shot && (ceil || (goal && finisher))) {
    return { label: 'PRIMARY TARGET', fg: '#065f46', bg: '#d1fae5' };
  }
  if (shot && ceil) {
    return { label: 'LADDER TARGET', fg: '#1d4ed8', bg: '#dbeafe' };
  }
  if (goal && finisher) {
    return { label: 'GOAL TARGET', fg: '#92400e', bg: '#fef3c7' };
  }
  if (ceil) {
    return { label: 'CEILING PLAY', fg: '#6d28d9', bg: '#ede9fe' };
  }
  return null;
}

function TagPill({ tag }) {
  if (!tag) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: '999px',
      background: tag.bg,
      color: tag.fg,
      fontSize: '15px',
      fontWeight: 800,
      fontFamily: "'Outfit Variable','Outfit',sans-serif",
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {tag.label}
    </span>
  );
}


function enrichBoardTags(r) {
  const shotTag = r?.shotTag || getShotTag(r?.p4s || 0);
  const ceilingTag = r?.ceilingTag || getCeilingTag(r?.p5s || 0);
  const goalTag = r?.goalTag || getGoalTag(r?.p1g || 0);
  const compositeTag = r?.compositeTag || getCompositeTag(r);
  return { ...r, shotTag, ceilingTag, goalTag, compositeTag };
}

function scoreTopBoardRow(r, market = 'shots') {
  const row = enrichBoardTags(r);
  const hotRoleBonus = row.hotRoleExtreme ? 16 : row.hotRoleStrong ? 10 : row.hotRoleActive ? 5 : 0;
  const compositeBonus =
    row.compositeTag?.label === 'PRIMARY TARGET' ? 28 :
    row.compositeTag?.label === 'LADDER TARGET' ? 22 :
    row.compositeTag?.label === 'GOAL TARGET' ? 20 :
    row.compositeTag?.label === 'CEILING PLAY' ? 16 : 0;
  const shotBonus =
    row.shotTag?.label === '4+ ELITE' ? 22 :
    row.shotTag?.label === '4+ CORE' ? 16 :
    row.shotTag?.label === '4+ THIN' ? 8 : 0;
  const ceilingBonus =
    row.ceilingTag?.label === '5+ ELITE' ? 20 :
    row.ceilingTag?.label === '5+ EDGE' ? 14 :
    row.ceilingTag?.label === '5+ LOTTO' ? 6 : 0;
  const goalBonus =
    row.goalTag?.label === 'GOAL ELITE' ? 22 :
    row.goalTag?.label === 'GOAL CORE' ? 16 :
    row.goalTag?.label === 'GOAL THIN' ? 8 :
    row.goalTag?.label === 'GOAL LOTTO' ? 4 : 0;

  if (market === 'shots') {
    return ((row.p4s || 0) * 100) + ((row.p5s || 0) * 60) + ((row.signalScore || 0) * 0.18) + shotBonus + ceilingBonus + compositeBonus + hotRoleBonus;
  }
  if (market === 'goals') {
    return ((row.p1g || 0) * 100) + ((row.p2g || 0) * 65) + ((row.dangerRate || 0) * 18) + goalBonus + compositeBonus + hotRoleBonus;
  }
  return ((row.p1p || 0) * 100) + ((row.p2p || 0) * 55) + ((row.signalScore || 0) * 0.22) + (goalBonus * 0.35) + (shotBonus * 0.20) + compositeBonus + (hotRoleBonus * 0.7);
}

function includeTopBoardRow(r, market = 'shots') {
  const row = enrichBoardTags(r);
  if (market === 'shots') {
    return !!(row.compositeTag?.label === 'PRIMARY TARGET' || row.compositeTag?.label === 'LADDER TARGET' || row.compositeTag?.label === 'CEILING PLAY' || row.shotTag || row.ceilingTag);
  }
  if (market === 'goals') {
    return !!(row.compositeTag?.label === 'PRIMARY TARGET' || row.compositeTag?.label === 'GOAL TARGET' || row.goalTag);
  }
  return (row.p1p || 0) >= 0.42 || row.compositeTag?.label === 'PRIMARY TARGET';
}

function bestBetLabel(r) {
  let options = [
    { label: "1+ point", prob: r.p1p || 0, key: "point1" },
    { label: "Anytime goal", prob: r.p1g || 0, key: "goal" },
    { label: "4+ shots", prob: r.p4s || 0, key: "shots4" },
    { label: "3+ shots", prob: r.p3s || 0, key: "shots3" },
    { label: "5+ shots", prob: r.p5s || 0, key: "shots5" },
    { label: "2+ points", prob: r.p2p || 0, key: "points2" },
    { label: "2+ goals", prob: r.p2g || 0, key: "goals2" },
  ];

  if (r?.pos === 'RW' && r?.rwPrimaryMarket === 'goal' && !r?.rwEliteVolumeForShots) {
    const bonus = (key) => key === 'goal' ? 0.06 : key === 'point1' ? 0.02 : key.includes('shots') ? -0.08 : 0;
    options = options.map((o) => ({ ...o, prob: Math.max(0, Math.min(0.999, o.prob + bonus(o.key))) }));
  }

  if (r?.hotRolePrimaryMarket === 'shots') {
    const hotRoleBestBetDamp =
      (r?.environmentScore ?? 0) >= 72 ? 1.00 :
      (r?.environmentScore ?? 0) >= 60 ? 0.88 :
      0.72;
    options = options.map((o) => ({
      ...o,
      prob: Math.max(0, Math.min(0.999, o.prob + ((o.key === 'shots4' ? (r?.hotRoleExtreme ? 0.18 : r?.hotRoleStrong ? 0.14 : 0.10) : o.key === 'shots3' ? (r?.hotRoleExtreme ? 0.12 : r?.hotRoleStrong ? 0.10 : 0.08) : o.key === 'shots5' ? (r?.hotRoleExtreme ? 0.10 : r?.hotRoleStrong ? 0.07 : 0.05) : o.key === 'point1' ? -0.09 : o.key === 'goal' ? -0.06 : 0)) * hotRoleBestBetDamp)),
    }));
  } else if (r?.hotRolePrimaryMarket === 'goals') {
    const hotRoleBestBetDamp =
      (r?.environmentScore ?? 0) >= 72 ? 1.00 :
      (r?.environmentScore ?? 0) >= 60 ? 0.86 :
      0.68;
    options = options.map((o) => ({
      ...o,
      prob: Math.max(0, Math.min(0.999, o.prob + ((o.key === 'goal' ? (r?.hotRoleExtreme ? 0.14 : r?.hotRoleStrong ? 0.12 : 0.10) : o.key === 'goals2' ? (r?.hotRoleExtreme ? 0.05 : 0.03) : o.key.includes('shots') ? -0.08 : o.key === 'point1' ? -0.03 : 0)) * hotRoleBestBetDamp)),
    }));
  }

  if (r?.defenseRolePrimaryMarket === 'goal') {
    options = options.map((o) => ({
      ...o,
      prob: Math.max(0, Math.min(0.999, o.prob + (o.key === 'goal' ? 0.14 : o.key === 'goals2' ? 0.04 : o.key === 'point1' ? 0.03 : o.key.includes('shots') ? -0.10 : 0))),
    }));
  } else if (r?.defenseRolePrimaryMarket === 'points') {
    options = options.map((o) => ({
      ...o,
      prob: Math.max(0, Math.min(0.999, o.prob + (o.key === 'point1' ? 0.10 : o.key === 'points2' ? 0.05 : o.key === 'goal' ? 0.02 : 0))),
    }));
  }

  options.sort((a, b) => b.prob - a.prob);
  return options[0];
}

function signalTier(score) {
  if (score >= 75) return "Elite";
  if (score >= 60) return "Strong";
  if (score >= 45) return "Good";
  return "Thin";
}
// ─── STYLES ──────────────────────────────────────────────────────────────────

const css = `
  .nhlx-model *{box-sizing:border-box;}
  .nhlx-model{font-size:17px;line-height:1.5;color:#26262c;}
  .nhlx-model ::-webkit-scrollbar{width:8px;height:8px;}
  .nhlx-model ::-webkit-scrollbar-thumb{background:#dcdbe8;border-radius:8px;}

  @keyframes fadeUp{
    from{opacity:0;transform:translateY(8px)}
    to{opacity:1;transform:translateY(0)}
  }

  .nhlx-model .fade-up{animation:fadeUp 0.3s ease forwards;}
  .nhlx-model .rh:hover td{background:#f4f1fe!important;}

  .nhlx-model input,.nhlx-model select,.nhlx-model button{font-family:'Inter Variable','Inter',sans-serif;font-size:1rem;}
  .nhlx-model table{font-size:1rem;border-collapse:collapse;}
  .nhlx-model h1,.nhlx-model h2,.nhlx-model h3,.nhlx-model h4,.nhlx-model p{margin:0;}

  @media (max-width: 1180px) {
    .nhlx-model .results-table th, .nhlx-model .results-table td {
      padding-left: 4px !important;
      padding-right: 4px !important;
    }
  }

  @media (max-width: 768px) {
    .nhlx-model .results-table th, .nhlx-model .results-table td {
      padding-left: 3px !important;
      padding-right: 3px !important;
    }
  }
`;

const POS_COLOR = {
  C: "#2563eb",
  LW: "#db2777",
  RW: "#ea580c",
  D: "#7c3aed",
};

function probColor(p) {
  if (p >= 0.6) return { fg: "#15803d", bg: "#dcfce7" };
  if (p >= 0.3) return { fg: "#b45309", bg: "#fef9c3" };
  if (p >= 0.15) return { fg: "#c2410c", bg: "#ffedd5" };
  return { fg: "#80828d", bg: "#f8fafb" };
}

function leakBadgeColor(score) {
  if (score == null) return { fg: "#636977", bg: "#f2f2f8" };
  if (score >= 90) return { fg: "#991b1b", bg: "#fee2e2" };
  if (score >= 75) return { fg: "#b45309", bg: "#fef3c7" };
  if (score >= 55) return { fg: "#166534", bg: "#dcfce7" };
  if (score >= 35) return { fg: "#373449", bg: "#e9e8f3" };
  return { fg: "#26262c", bg: "#e9e8f3" };
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────

function Tooltip({ hist, mouseX, mouseY }) {
    if (!hist) return null;

  const adjMult = hist.adj?.mult ?? 1;
  const adjColor =
    adjMult > 1.05 ? "#15803d" : adjMult < 0.95 ? "#dc2626" : "#80828d";

  const winW = typeof window !== "undefined" ? window.innerWidth : 900;
  const winH = typeof window !== "undefined" ? window.innerHeight : 700;

  const tooltipHeight = 320;
  const tooltipWidth = 320;
  const top = mouseY + 16 + tooltipHeight > winH ? mouseY - (tooltipHeight - 20) : mouseY + 16;
  const left = Math.max(8, Math.min(mouseX - 150, winW - (tooltipWidth + 12)));

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 99999,
        pointerEvents: "none",
        background: "#ffffff",
        border: "1px solid #e9e8f3",
        borderRadius: "12px",
        padding: "14px 16px",
        width: `${tooltipWidth}px`,
        boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
        fontFamily: "'Inter Variable','Inter',sans-serif",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#373449",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: "10px",
          fontFamily: "'Outfit Variable','Outfit',sans-serif",
          borderBottom: "1px solid #e9e8f3",
          paddingBottom: "8px",
        }}
      >
        Historical Profile
      </div>

      <div style={{ fontSize: "18px", lineHeight: "2.1" }}>
        {[
          ["Sample", `${hist.n} / ${hist.total} games`, "#05011c"],
          ["Hit rate", `${Math.round(hist.hitRate * 100)}%`, "#d97706"],
          ["Avg TOI (achievers)", `${hist.avgToi} min`, "#05011c"],
          ["Min TOI seen", `${hist.minToi} min`, "#636977"],
        ].map(([lbl, val, vc]) => (
          <div
            key={lbl}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#373449", fontSize: "18px" }}>{lbl}</span>
            <strong style={{ color: vc }}>{val}</strong>
          </div>
        ))}

        <div
          style={{
            marginTop: "7px",
            paddingTop: "7px",
            borderTop: "1px solid #e9e8f3",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#373449", fontSize: "18px" }}>λ adjustment</span>
          <strong style={{ color: adjColor }}>
            {adjMult > 1 ? "+" : ""}
            {Math.round((adjMult - 1) * 100)}%
          </strong>
        </div>
      </div>
    </div>
  );
}

// ─── PROB CELL ───────────────────────────────────────────────────────────────

function getPropLabel(prop, p) {
  if (p == null) return null;
  const thresholds = {
    p3s: [{v:0.65,l:"Strong"},{v:0.58,l:"Good"},{v:0.52,l:"Thin"}],
    p4s: [{v:0.50,l:"Strong"},{v:0.45,l:"Playable"},{v:0.40,l:"Thin"}],
    p5s: [{v:0.35,l:"Thin"}],
    p1p: [{v:0.55,l:"Strong"},{v:0.50,l:"Playable"}],
    p2p: [{v:0.30,l:"Strong"},{v:0.25,l:"Good"}],
    p1g: [{v:0.33,l:"Strong"},{v:0.28,l:"Playable"},{v:0.24,l:"Thin"}],
    p2g: [{v:0.14,l:"Legit"},{v:0.10,l:"Sprinkle"}],
  };
  const tiers = thresholds[prop];
  if (!tiers) return null;
  for (const t of tiers) {
    if (p >= t.v) return t.l;
  }
  return null;
}

function labelColor(label) {
  if (label === "Strong") return "#15803d";
  if (label === "Good" || label === "Playable" || label === "Legit") return "#b45309";
  if (label === "Thin" || label === "Sprinkle") return "#c2410c";
  return "#80828d";
}

function ProbCell({ p, hist, highlight, onHover, onLeave, prop, fire }) {
  const safeP = clamp(Number.isFinite(Number(p)) ? Number(p) : 0, 0, 0.999);
  const pct = Math.round(safeP * 100);
  const { fg, bg } = probColor(safeP);
  const label = prop ? getPropLabel(prop, safeP) : null;

  const adjMult = hist?.adj?.mult ?? 1;
  const adjColor =
    adjMult > 1.05 ? "#15803d" : adjMult < 0.95 ? "#dc2626" : "#80828d";
  const adjPct = Math.abs(Math.round((adjMult - 1) * 100));

  return (
    <td
      style={{ padding: "9px 5px", textAlign: "right" }}
      onMouseEnter={(e) => hist && onHover && onHover(hist, e.clientX, e.clientY)}
      onMouseMove={(e) => hist && onHover && onHover(hist, e.clientX, e.clientY)}
      onMouseLeave={() => onLeave && onLeave()}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          {fire && <span style={{ fontSize: "18px", lineHeight: 1 }}>🔥</span>}
          <span
            style={{
              display: "inline-block",
              fontFamily: "'Outfit Variable','Outfit',sans-serif",
              fontWeight: 900,
              fontSize: highlight ? "16px" : "14px",
              color: fg,
              background: bg,
              borderRadius: "7px",
              padding: "4px 6px",
              minWidth: "34px",
              textAlign: "center",
              border: highlight ? `1px solid ${fg}40` : "none",
              lineHeight: 1,
            }}
          >
            {pct}%
          </span>
        </div>

        <span style={{
          fontSize: "13px",
          fontWeight: 700,
          color: label ? labelColor(label) : "#636977",
          fontFamily: "'Outfit Variable','Outfit',sans-serif",
          letterSpacing: "0.03em",
        }}>
          {label || getLikelyLabel(safeP)}
        </span>

        {hist && (
          <span style={{ fontSize: "15px", color: adjColor }}>
            {adjMult > 1.005 ? "▲" : adjMult < 0.995 ? "▼" : "—"} {adjPct}%
          </span>
        )}
      </div>
    </td>
  );
}

// ─── RESULTS TABLE ───────────────────────────────────────────────────────────


function getAlertScore(r) {
  if (!r) return 0;
  if ((r.p3s ?? 0) >= 0.7 && ((r.p1g ?? 0) >= 0.33 || (r.p1p ?? 0) >= 0.62)) return 3;
  if ((r.defenseRolePrimaryMarket === 'goal' && (r.p1g ?? 0) >= 0.22) || (r.defenseRolePrimaryMarket === 'points' && (r.p1p ?? 0) >= 0.22)) return 2;
  if ((r.p1g ?? 0) >= 0.33 || (r.p2g ?? 0) >= 0.12 || (r.p1p ?? 0) >= 0.62 || (r.p2p ?? 0) >= 0.18) return 2;
  if ((r.p4s ?? 0) >= 0.5 || (r.p3s ?? 0) >= 0.7 || (r.p5s ?? 0) >= 0.2 || ((r.defenseRolePrimaryMarket === 'goal' || r.defenseRolePrimaryMarket === 'points') && (r.defenseRoleSignalBoost || 0) >= 6)) return 1;
  return 0;
}

function getAlertConfig(r) {
  if (!r) return null;
  const score = getAlertScore(r);
  if (score === 3) {
    return { score, icon: "‼", short: "A++", label: "High shots + scoring", fg: "#991b1b", bg: "#fee2e2" };
  }
  if (score === 2) {
    return { score, icon: "!", short: "G!", label: "High scoring probability", fg: "#b45309", bg: "#fef3c7" };
  }
  if (score === 1) {
    return { score, icon: "!", short: "S!", label: "High shot probability", fg: "#166534", bg: "#dcfce7" };
  }
  return { score: 0, icon: "—", short: "—", label: "No alert", fg: "#636977", bg: "#f2f2f8" };
}

function getPredictionSummary(r) {
  if (!r) return "—";
  const parts = [];
  if ((r.p3s ?? 0) >= 0.7) parts.push(`3+ shots ${Math.round(r.p3s * 100)}%`);
  if ((r.p4s ?? 0) >= 0.45) parts.push(`4+ shots ${Math.round(r.p4s * 100)}%`);
  if ((r.p5s ?? 0) >= 0.18) parts.push(`5+ shots ${Math.round(r.p5s * 100)}%`);
  if ((r.p1p ?? 0) >= 0.45) parts.push(`1+ point ${Math.round(r.p1p * 100)}%`);
  if ((r.p2p ?? 0) >= 0.12) parts.push(`2+ points ${Math.round(r.p2p * 100)}%`);
  if ((r.p1g ?? 0) >= 0.25) parts.push(`1+ goal ${Math.round(r.p1g * 100)}%`);
  if ((r.p2g ?? 0) >= 0.1) parts.push(`2+ goals ${Math.round(r.p2g * 100)}%`);
  if (!parts.length) {
    parts.push(`Pred S ${r.lambdaS?.toFixed(1) ?? "—"}`);
    parts.push(`Pred P ${r.lambdaP?.toFixed(2) ?? "—"}`);
    parts.push(`Pred G ${r.lambdaG?.toFixed(2) ?? "—"}`);
  }
  return parts.join(" · ");
}

function getPrimaryCall(r) {
  if (!r) return "No clear edge";
  if (r.defenseRolePrimaryMarket === 'goal' && (r.p1g ?? 0) >= 0.18) return `Best call: anytime goal`;
  if (r.defenseRolePrimaryMarket === 'points' && (r.p1p ?? 0) >= 0.20) return `Best call: 1+ point`;
  if (((r.p1g ?? 0) >= 0.33 || (r.p1p ?? 0) >= 0.6) && (r.p3s ?? 0) >= 0.65) return `Best call: shots + scoring combo live`;
  if ((r.p4s ?? 0) >= 0.5) return `Best call: 4+ shots`;
  if ((r.p3s ?? 0) >= 0.65) return `Best call: 3+ shots`;
  if ((r.p1p ?? 0) >= 0.6) return `Best call: 1+ point`;
  if ((r.p1g ?? 0) >= 0.33) return `Best call: anytime goal`;
  if ((r.p1g ?? 0) >= 0.22) return `Best call: thin anytime goal`;
  return `Best call: watchlist only`;
}

function getPlayScoreLabel(score) {
  const s = Number(score || 0);
  if (s >= 85) return { label: "Auto", fg: "#166534", bg: "#dcfce7" };
  if (s >= 72) return { label: "Strong", fg: "#166534", bg: "#ecfccb" };
  if (s >= 58) return { label: "Lean", fg: "#b45309", bg: "#fef3c7" };
  return { label: "Thin", fg: "#b91c1c", bg: "#fee2e2" };
}

function getRowPrimaryMarket(r) {
  const best = (r?.bestBetLabel || "").toLowerCase();
  if (best.includes("goal")) return "goals";
  if (best.includes("shot")) return "shots";
  if (best.includes("point")) return "points";
  if ((r?.p4s || 0) >= 0.45 || (r?.p3s || 0) >= 0.6) return "shots";
  if ((r?.p1g || 0) >= 0.22) return "goals";
  return "points";
}

function getQuickWhy(r) {
  const market = getRowPrimaryMarket(r);
  return buildBoardBulletPoints(r, market).slice(0, 3);
}

function getLikelyLabel(p) {
  const v = Number(p || 0);
  if (v >= 0.85) return "Very Likely";
  if (v >= 0.70) return "Strong";
  if (v >= 0.55) return "Lean";
  return "Thin";
}


function MatchupHistory({ venueProfile, player, venue }) {
    const vp = venueProfile;
  if (!vp) return null;
  const vs = vp._venue || {};
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  const fmt = (v) => (v != null && !Number.isNaN(v) ? Number(v).toFixed(1) : "—");
  const accent = "#15803d";
  const venueDisplay = venue === "home" ? "HOME" : "AWAY";
  const playerIff = player.iffBlend?.toFixed(2) ?? "—";
  const playerToi = player.playerToi?.toFixed(1) ?? "—";
  const rows = [
    { label: "3+ Shots", rate: vs.s3Rate, toiKey: "toiS3" },
    { label: "4+ Shots", rate: vs.s4Rate, toiKey: "toiS4" },
    { label: "5+ Shots", rate: vs.s5Rate, toiKey: "toiS5" },
    { label: "1+ Point", rate: vs.p1Rate, toiKey: "toiP1" },
    { label: "2+ Points", rate: vs.p2Rate, toiKey: "toiP2" },
    { label: "1+ Goal", rate: vs.g1Rate, toiKey: "toiG1" },
    { label: "2+ Goals", rate: vs.g2Rate, toiKey: null },
  ];
  const rateColor = (rate) => rate >= 0.4 ? "#16a34a" : rate >= 0.25 ? "#d97706" : rate >= 0.1 ? "#ea580c" : "#636977";
  return (
    <div style={{ padding: "16px 18px", fontFamily: "'Inter Variable','Inter',sans-serif", background: "#f0fdf4", borderRadius: "10px", marginTop: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 700, fontSize: "24px", letterSpacing: "0.12em", color: "#15803d", textTransform: "uppercase" }}>
          {player.pos} vs {player.opponent} · {venueDisplay} · {vs.n || 0} games in history
        </span>
        <span style={{ fontSize: "22px", color: "#373449" }}>
          Avg shots: <strong style={{ color: "#05011c" }}>{fmt(vs.avgS)}</strong> · Avg points: <strong style={{ color: "#05011c" }}>{fmt(vs.avgP)}</strong> · Avg goals: <strong style={{ color: "#05011c" }}>{fmt(vs.avgG)}</strong> · Avg TOI: <strong style={{ color: "#05011c" }}>{fmt(vs.avgT)} min</strong>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(210px, 1fr))", gap: "10px", marginBottom: "12px" }}>
        {rows.map(({ label, rate, toiKey }) => {
          const achieverToi = toiKey ? vs[toiKey] : null;
          const playerAhead = achieverToi && player.playerToi >= achieverToi;
          const rc = rateColor(rate || 0);
          return (
            <div key={label} style={{ background: "#fff", borderRadius: "10px", padding: "14px 16px", border: "1px solid #e9e8f3" }}>
              <div style={{ fontSize: "30px", fontWeight: 900, color: "#373449", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>{label}</div>
              <div style={{ height: "4px", background: "#e9e8f3", borderRadius: "2px", marginBottom: "10px" }}><div style={{ height: "4px", width: `${Math.round((rate || 0) * 100)}%`, background: rc, borderRadius: "2px" }} /></div>
              <div style={{ fontSize: "42px", fontWeight: 700, color: rc, fontFamily: "'Outfit Variable','Outfit',sans-serif", lineHeight: 1, marginBottom: "4px" }}>{pct(rate)}</div>
              <div style={{ fontSize: "22px", color: "#636977", marginBottom: achieverToi != null ? "10px" : "0" }}>hit rate</div>
              {achieverToi != null && <div style={{ paddingTop: "10px", borderTop: "1px solid #e9ecef" }}><div style={{ fontSize: "22px", color: "#636977", marginBottom: "3px" }}>Achiever avg TOI</div><div style={{ fontSize: "28px", fontWeight: 700, color: playerAhead ? "#16a34a" : "#ea580c" }}>{fmt(achieverToi)} min <span style={{ fontSize: "22px", fontWeight: 400 }}>{playerAhead ? "< yours" : "> yours"}</span></div></div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "#ecfdf5", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
        <span style={{ fontSize: "21px", fontWeight: 700, color: "#636977", fontFamily: "'Outfit Variable','Outfit',sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Tonight&apos;s Player</span>
        <span style={{ fontSize: "26px", color: "#05011c", fontWeight: 700 }}>{player.name}</span>
        <span style={{ fontSize: "24px", color: "#373449" }}>iFF <strong style={{ color: accent }}>{playerIff}</strong> · TOI <strong style={{ color: accent }}>{playerToi} min</strong> · Def mult <strong style={{ color: accent }}>{player.defMult?.toFixed(3) ?? '—'}</strong> · λ shots <strong style={{ color: accent }}>{player.lambdaS?.toFixed(2) ?? '—'}</strong></span>
        <span style={{ marginLeft: "auto", fontSize: "22px", color: "#636977" }}>Hist avg TOI (all): <strong style={{ color: "#05011c" }}>{fmt(vs.avgT)} min</strong> vs yours <strong style={{ color: Number(player.playerToi) >= Number(vs.avgT || 0) ? "#16a34a" : "#ea580c" }}>{playerToi} min</strong></span>
      </div>
    </div>
  );
}

function getAttackBadge(score, primaryMarket = null, marketTag = null) {
  const s = Number(score || 0);
  if (primaryMarket === 'goal' && s >= 14) return { label: marketTag || 'Goal Leak', rank: 3, fg: '#b45309', bg: '#fef3c7' };
  if (primaryMarket === 'points' && s >= 12) return { label: marketTag || 'Point Leak', rank: 2, fg: '#b45309', bg: '#fef3c7' };
  if (s >= 70) return { label: "Elite", rank: 4, fg: "#166534", bg: "#dcfce7" };
  if (s >= 58) return { label: "Strong", rank: 3, fg: "#15803d", bg: "#ecfccb" };
  if (s >= 46) return { label: "Solid", rank: 2, fg: "#b45309", bg: "#fef3c7" };
  return { label: "Thin", rank: 1, fg: "#b91c1c", bg: "#fee2e2" };
}

// ─── PLAYER EXPANDED PANEL ───────────────────────────────────────────────────

function HistStatCard({ label, homeRate, awayRate, tonightVenue, homeN, awayN }) {
  const pct = (v) => v != null ? `${Math.round(v * 100)}%` : "—";
  const color = (v) => {
    if (v == null) return "#80828d";
    if (v >= 0.6) return "#15803d";
    if (v >= 0.4) return "#b45309";
    if (v >= 0.25) return "#c2410c";
    return "#80828d";
  };
  const bg = (v) => {
    if (v == null) return "#f2f2f8";
    if (v >= 0.6) return "#dcfce7";
    if (v >= 0.4) return "#fef9c3";
    if (v >= 0.25) return "#ffedd5";
    return "#f2f2f8";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "120px" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#80828d", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>
        {label}
      </div>
      {[{ key: "H", rate: homeRate, n: homeN }, { key: "A", rate: awayRate, n: awayN }].map(({ key, rate, n }) => {
        const isTonight = (tonightVenue === "home" && key === "H") || (tonightVenue === "away" && key === "A");
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "5px 8px",
            borderRadius: "8px",
            background: isTonight ? bg(rate) : "#f8fafb",
            border: isTonight ? `1.5px solid ${color(rate)}44` : "1px solid #e9e8f3",
          }}>
            <span style={{
              fontSize: "15px", fontWeight: 800, fontFamily: "'Outfit Variable','Outfit',sans-serif",
              color: isTonight ? color(rate) : "#80828d",
              minWidth: "12px",
            }}>{key}</span>
            <span style={{
              fontSize: "21px", fontWeight: 900, fontFamily: "'Outfit Variable','Outfit',sans-serif",
              color: isTonight ? color(rate) : "#636977",
            }}>{pct(rate)}</span>
            {n != null && <span style={{ fontSize: "14px", color: "#80828d" }}>({n}g)</span>}
            {isTonight && <span style={{ fontSize: "14px", fontWeight: 700, color: color(rate), marginLeft: "auto" }}>★</span>}
          </div>
        );
      })}
    </div>
  );
}

function PlayerExpandedPanel({ r, venue, hasHist }) {
  const home = r.hist?._home?._venue || null;
  const away = r.hist?._away?._venue || null;
  const homeN = r.hist?._home?._venue?.n ?? null;
  const awayN = r.hist?._away?._venue?.n ?? null;
  const histAvailable = hasHist && (home || away);

  const statGroups = [
    { label: "3+ Shots", homeRate: home?.s3Rate, awayRate: away?.s3Rate },
    { label: "4+ Shots", homeRate: home?.s4Rate, awayRate: away?.s4Rate },
    { label: "5+ Shots", homeRate: home?.s5Rate, awayRate: away?.s5Rate },
    { label: "1+ Point", homeRate: home?.p1Rate, awayRate: away?.p1Rate },
    { label: "2+ Points", homeRate: home?.p2Rate, awayRate: away?.p2Rate },
    { label: "1+ Goal",  homeRate: home?.g1Rate, awayRate: away?.g1Rate },
    { label: "2+ Goals", homeRate: home?.g2Rate, awayRate: away?.g2Rate },
  ];

  return (
    <div style={{ padding: "14px 12px 10px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>

      {/* Model section — always shown */}
      <div style={{ flex: "0 0 auto", minWidth: "220px", background: "#fff", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px 14px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#80828d", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Outfit Variable','Outfit',sans-serif", marginBottom: "8px" }}>
          Model Output
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
          <span style={{ background: "#dcfce7", borderRadius: "6px", padding: "4px 8px", fontWeight: 700, fontSize: "16px", color: "#15803d" }}>Signal {r.signalScore ?? r.edgeScore}</span>
          <span style={{ background: "#ede9fe", borderRadius: "6px", padding: "4px 8px", fontWeight: 700, fontSize: "16px", color: "#7c3aed" }}>λS {r.lambdaS?.toFixed(1)}</span>
          <span style={{ background: "#ffedd5", borderRadius: "6px", padding: "4px 8px", fontWeight: 700, fontSize: "16px", color: "#b45309" }}>λG {r.lambdaG?.toFixed(2)}</span>
        </div>
        <div style={{ fontSize: "16px", color: "#373449", lineHeight: 1.7 }}>
          <div><strong>Best bet:</strong> {r.bestBetLabel || bestBetLabel(r).label} · {Math.round(((r.bestProb ?? bestBetLabel(r).prob) || 0) * 100)}%</div>
          <div><strong>Why:</strong> {r.selectionRationale || r.featureSummary}</div>
          <div><strong>Role:</strong> {r.currentRole || `L${r.todayLine}`} · <strong>Line fit:</strong> {r.lineFit || "neutral"} · <strong>Venue form:</strong> {r.venueFormTag || "Neutral"}</div>
          {r.defenseRoleSummary && <div><strong>Defense role profile:</strong> {r.defenseRoleSummary}</div>}
          {r.goalLeakOverride && <div style={{ color: "#b45309" }}><strong>Goal leak:</strong> {r.goalLeakOverride}</div>}
          <div><strong>Team SOG:</strong> {r.teamExpectedShots?.toFixed(1)} · <strong>Shot share:</strong> {r.shotSharePct?.toFixed(1)}%</div>
        </div>
      </div>

      {/* History section */}
      <div style={{ flex: 1, background: "#fff", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px 14px", minWidth: "340px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#80828d", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>
            Historical Hit Rates vs {r.opponent}
          </span>
          <span style={{ fontSize: "15px", color: "#80828d" }}>·</span>
          <span style={{ fontSize: "15px", color: r.isHome ? "#166534" : "#1d4ed8", fontWeight: 700, background: r.isHome ? "#dcfce7" : "#dbeafe", padding: "2px 6px", borderRadius: "4px" }}>
            Tonight: {r.isHome ? "HOME" : "AWAY"} ★
          </span>
          {!histAvailable && (
            <span style={{ fontSize: "15px", color: "#80828d", fontStyle: "italic" }}>— upload history file to see</span>
          )}
        </div>
        {histAvailable ? (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {statGroups.map((sg) => (
              <HistStatCard
                key={sg.label}
                label={sg.label}
                homeRate={sg.homeRate}
                awayRate={sg.awayRate}
                tonightVenue={venue}
                homeN={homeN}
                awayN={awayN}
              />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "16px", color: "#80828d", fontStyle: "italic" }}>
            Upload the Historical Profiles file to see H/A hit rates for this player vs {r.opponent}.
          </div>
        )}
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f2f2f8" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#80828d", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Outfit Variable','Outfit',sans-serif", marginBottom: "8px" }}>
            Last 7 venue form ({r.isHome ? "Home" : "Away"})
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {[
              ["3+ S", r.venueS3Rate],
              ["4+ S", r.venueS4Rate],
              ["5+ S", r.venueS5Rate],
              ["1+ P", r.venueP1Rate],
              ["1+ G", r.venueG1Rate],
            ].map(([label, val]) => (
              <div key={label} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "8px", padding: "8px 10px", minWidth: "70px" }}>
                <div style={{ fontSize: "15px", color: "#80828d", fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: "27px", fontWeight: 900, fontFamily: "'Outfit Variable','Outfit',sans-serif", color: "#05011c" }}>{val != null ? `${Math.round(val * 100)}%` : "—"}</div>
              </div>
            ))}
            <div style={{ background: r.venueFormTag === "Hot" ? "#dcfce7" : r.venueFormTag === "Cold" ? "#fee2e2" : "#f2f2f8", borderRadius: "8px", padding: "8px 12px", fontWeight: 800, color: r.venueFormTag === "Hot" ? "#15803d" : r.venueFormTag === "Cold" ? "#b91c1c" : "#636977" }}>
              {r.venueFormTag || "Neutral"} · {r.venueFormSample || 0}g
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function defenseRankTone(rank) {
  if (!rank) return { fg: "#dcdbe8", bg: "rgba(148,163,184,0.16)" };
  if (rank <= 11) return { fg: "#16a34a", bg: "rgba(22,163,74,0.18)" };
  if (rank <= 22) return { fg: "#d97706", bg: "rgba(217,119,6,0.18)" };
  return { fg: "#dc2626", bg: "rgba(220,38,38,0.18)" };
}

function formatCheatStat(val) {
  if (val == null || Number.isNaN(Number(val))) return "—";
  return Number(val).toFixed(2);
}

function getDefenseCheatRows(defBlock) {
  if (!defBlock?.posStats) return [];
  return ["ALL", "LW", "RW", "C", "D"].map((pos) => {
    const s = defBlock.posStats?.[pos] || {};
    const rankSource = typeof s.ranks === 'object' && s.ranks ? s.ranks : {};
    return {
      pos,
      goals: s.goalsAllowed ?? null,
      assists: s.assistsAllowed ?? null,
      shots: s.shotsAllowed ?? null,
      icf: s.icfAllowed ?? null,
      iff: s.iffAllowed ?? null,
      iscf: s.iscfAllowed ?? null,
      goalsRank: rankSource.goals ?? null,
      assistsRank: rankSource.assists ?? null,
      shotsRank: rankSource.shots ?? null,
      icfRank: rankSource.icf ?? null,
      iffRank: rankSource.iff ?? null,
      iscfRank: rankSource.iscf ?? null,
    };
  });
}

function PropFinderDefenseCard({ defBlock, accent = "#a855f7", rankingsData = null }) {
  const rows = useMemo(() => getDefenseCheatRows(defBlock), [defBlock]);
  const [mode, setMode] = useState("per");
  if (!defBlock) return null;

  // Position tab map: cheat-sheet pos → rankings tab name
  const posTabMap = { ALL: "All", LW: "LW", RW: "RW", C: "C", D: "D" };
  const teamKey = normTeam(defBlock.team);

  function getRank(pos, metric) {
    if (!rankingsData) return null;
    const tab = posTabMap[pos] || "All";
    return rankingsData[tab]?.[teamKey]?.[metric] ?? null;
  }

  const MetricCell = ({ value, pos, metric }) => {
    const rank = getRank(pos, metric);
    const tone = defenseRankTone(rank);
    return (
      <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
        <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 800, fontSize: "24px", color: "#f9faff", lineHeight: 1.05 }}>
          {formatCheatStat(value)}
        </div>
        <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "38px", padding: "2px 8px", borderRadius: "999px", background: tone.bg, color: tone.fg, fontSize: "14px", fontWeight: 800, fontFamily: "'Outfit Variable','Outfit',sans-serif", letterSpacing: "0.04em" }}>
          {rank ? `#${rank}` : "—"}
        </div>
      </td>
    );
  };

  return (
    <div style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(3,7,18,0.98) 100%)", border: `1px solid ${accent}55`, borderRadius: "18px", overflow: "hidden", boxShadow: "0 10px 30px rgba(2,6,23,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          {teamLogoUrl(defBlock.team) ? (
            <img src={teamLogoUrl(defBlock.team)} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 800, fontSize: "24px", color: "#f9faff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {normShort(defBlock.team)} Defense
            </div>
            <div style={{ marginTop: "2px", fontSize: "13px", color: "#80828d", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              PropFinder cheat sheet
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <span style={{ fontSize: "14px", color: mode === "per" ? "#f9faff" : "#636977", fontWeight: 700 }}>Per Game</span>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "per" ? "total" : "per"))}
            style={{ width: "38px", height: "22px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)", background: mode === "per" ? "#f9faff" : "#334155", position: "relative", cursor: "pointer", padding: 0 }}
          >
            <span style={{ position: "absolute", top: "2px", left: mode === "per" ? "2px" : "18px", width: "16px", height: "16px", borderRadius: "999px", background: mode === "per" ? "#05011c" : "#f9faff", transition: "left 0.18s ease" }} />
          </button>
          <span style={{ fontSize: "14px", color: mode === "total" ? "#f9faff" : "#636977", fontWeight: 700 }}>Total</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Position", "Goals/G", "Assists/G", "Shots/G", "ICF/G", "IFF/G", "ISCF/G"].map((label, idx) => (
                <th key={label} style={{ padding: "10px 8px", textAlign: idx === 0 ? "left" : "center", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "16px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#dcdbe8", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pos}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f9faff", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "22px", fontWeight: 800 }}>
                  {row.pos}
                </td>
                <MetricCell value={row.goals}   pos={row.pos} metric="goalsRank" />
                <MetricCell value={row.assists}  pos={row.pos} metric="assistsRank" />
                <MetricCell value={row.shots}    pos={row.pos} metric="shotsRank" />
                <MetricCell value={row.icf}      pos={row.pos} metric="icfRank" />
                <MetricCell value={row.iff}      pos={row.pos} metric="iffRank" />
                <MetricCell value={row.iscf}     pos={row.pos} metric="iscfRank" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PropFinderCheatStrip({ matchup, rankingsData = null }) {
  if (!matchup?.defBlocks?.length) return null;
  const orderedBlocks = matchup.defBlocks.slice(0, 2);
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "13px", fontWeight: 700, color: "#80828d", textTransform: "uppercase", letterSpacing: "0.1em" }}>Defense rank</span>
        {[
          { label: "1–11  Most allowed",   fg: "#16a34a", bg: "rgba(22,163,74,0.13)" },
          { label: "12–22  Ok matchup",    fg: "#d97706", bg: "rgba(217,119,6,0.13)" },
          { label: "23–32  Least allowed", fg: "#dc2626", bg: "rgba(220,38,38,0.13)" },
          { label: "—  No file",           fg: "#80828d", bg: "rgba(148,163,184,0.13)" },
        ].map(({ label, fg, bg }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: bg, color: fg, borderRadius: "999px", padding: "2px 9px", fontSize: "12px", fontWeight: 700, fontFamily: "'Outfit Variable','Outfit',sans-serif", letterSpacing: "0.03em" }}>
            {label}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "16px" }}>
        {orderedBlocks.map((block, idx) => (
          <PropFinderDefenseCard key={`${block.team}-${idx}`} defBlock={block} accent={idx === 0 ? "#f59e0b" : "#a855f7"} rankingsData={rankingsData} />
        ))}
      </div>
    </div>
  );
}

function SortTh({ col, label, title, width, sortCol, sortDir, onToggle }) {
  return (
    <th
      onClick={() => onToggle(col)}
      title={title || ""}
      style={{
        padding: "9px 5px",
        textAlign: "right",
        fontSize: "18px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        color: sortCol === col ? "#15803d" : "#80828d",
        borderBottom: "1px solid #e9ecef",
        fontFamily: "'Outfit Variable','Outfit',sans-serif",
        width: width || "auto",
        position: "sticky",
        top: 0,
        background: "#f8fafb",
        zIndex: 8,
      }}
    >
      {label} {sortCol === col ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );
}

function ResultsTable({ data, hasHist, matchups = [], rankingsData = null }) {
  const [sortCol, setSortCol] = useState("attackScore");
  const [sortDir, setSortDir] = useState("desc");
  const [filter, setFilter] = useState("");
  const [posF, setPosF] = useState("ALL");
  const [gameF, setGameF] = useState("ALL");
  const [gateOnly, setGateOnly] = useState(true);
  const [minP3s, setMinP3s] = useState(0);
  const [minLeak, setMinLeak] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // "all" | "bygame"
  const [pickedGame, setActiveGame] = useState(null);
  const tableScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);

  const showTip = useCallback((hist, x, y) => setTooltip({ hist, x, y }), []);
  const hideTip = useCallback(() => setTooltip(null), []);

  const gameOptions = useMemo(
    () => ["ALL", ...new Set(data.map((d) => d.game))],
    [data]
  );

  const games = useMemo(() => [...new Set(data.map((d) => d.game))], [data]);
  // By-game view starts on the first game until one is picked.
  const activeGame = pickedGame ?? games[0] ?? null;

  const selectedMatchup = useMemo(() => {
    const selectedGameLabel = viewMode === "bygame" ? activeGame : gameF !== "ALL" ? gameF : null;
    if (!selectedGameLabel) return null;
    return matchups.find((m) => m.label === selectedGameLabel) || null;
  }, [viewMode, activeGame, gameF, matchups]);

  const sorted = useMemo(() => {
    let d = data;

    if (filter) {
      d = d.filter(
        (r) =>
          r.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.team.toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (posF !== "ALL") d = d.filter((r) => r.pos === posF);
    if (viewMode === "bygame" && activeGame) {
      d = d.filter((r) => r.game === activeGame);
    } else if (gameF !== "ALL") {
      d = d.filter((r) => r.game === gameF);
    }
    if (gateOnly) d = d.filter((r) => r.gateOpen);
    if (minP3s > 0) d = d.filter((r) => r.p3s >= minP3s / 100);
    if (minLeak > 0) d = d.filter((r) => (r.leakScore ?? 0) >= minLeak);

    d = d.map((r) => {
      const best = bestBetLabel(r);
      return {
        ...r,
        bestBetLabel: best.label,
        bestProb: best.prob,
        shotTag: getShotTag(r.p4s || 0),
        ceilingTag: getCeilingTag(r.p5s || 0),
        goalTag: getGoalTag(r.p1g || 0),
        compositeTag: getCompositeTag(r),
        alertRank:
          r.alertCode === "A++" ? 3 :
          r.alertCode === "G!" ? 2 :
          r.alertCode === "S!" ? 1 : 0,
        attackBadge: getAttackBadge(r.attackScore, r.defenseRolePrimaryMarket, r.defenseRoleMarketTag),
        attackBadgeRank: getAttackBadge(r.attackScore, r.defenseRolePrimaryMarket, r.defenseRoleMarketTag).rank
      };
    });

    return [...d].sort((a, b) => {
      const av = sortCol === "alertScore" ? getAlertScore(a) : sortCol === "attackBadgeRank" ? (a.attackBadgeRank ?? 0) : (a[sortCol] ?? 0);
      const bv = sortCol === "alertScore" ? getAlertScore(b) : sortCol === "attackBadgeRank" ? (b.attackBadgeRank ?? 0) : (b[sortCol] ?? 0);

      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "desc"
          ? String(bv).localeCompare(String(av))
          : String(av).localeCompare(String(bv));
      }

      if (bv === av && sortCol === "alertScore") {
        const fallbackA = a.signalScore ?? 0;
        const fallbackB = b.signalScore ?? 0;
        return sortDir === "desc" ? fallbackB - fallbackA : fallbackA - fallbackB;
      }

      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [data, sortCol, sortDir, filter, posF, gameF, gateOnly, minP3s, minLeak, viewMode, activeGame]);

  const toggle = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  useEffect(() => {
    const top = tableScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!top || !bottom) return;

    let syncing = false;
    const syncFromTop = () => {
      if (syncing) return;
      syncing = true;
      bottom.scrollLeft = top.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    };
    const syncFromBottom = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = bottom.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    };

    top.addEventListener("scroll", syncFromTop, { passive: true });
    bottom.addEventListener("scroll", syncFromBottom, { passive: true });
    bottom.scrollLeft = top.scrollLeft;

    return () => {
      top.removeEventListener("scroll", syncFromTop);
      bottom.removeEventListener("scroll", syncFromBottom);
    };
  }, [sorted.length, expandedRow]);

  const exportToExcel = () => {
    const rows = sorted.map((r, idx) => ({
      Rank: idx + 1,
      Player: r.name,
      Player_Normalized: normalizeName(r.name),
      Team: r.team,
      Position: r.pos,
      Venue: r.venue,
      Opponent: r.opponent,
      Opponent_Def_Rank: r.defRank,
      Attack_Badge: r.attackBadge?.label || "",
      Attack_Score: r.attackScore,
      Shots_3plus: Math.round((r.p3s || 0) * 100),
      Shots_4plus: Math.round((r.p4s || 0) * 100),
      Shots_5plus: Math.round((r.p5s || 0) * 100),
      Points_1plus: Math.round((r.p1p || 0) * 100),
      Points_2plus: Math.round((r.p2p || 0) * 100),
      Goals_1plus: Math.round((r.p1g || 0) * 100),
      Goals_2plus: Math.round((r.p2g || 0) * 100),
      Goals_3plus: Math.round((r.p3g || 0) * 100),
      Shot_Tag: r.shotTag?.label || "",
      Ceiling_Tag: r.ceilingTag?.label || "",
      Goal_Tag: r.goalTag?.label || "",
      Composite_Tag: r.compositeTag?.label || "",
      Best_Bet: r.bestBetLabel || "",
      Best_Prob: Math.round(((r.bestProb || 0) * 100)),
      Pred_S: r.predS ?? r.lambdaS ?? "",
      Pred_G: r.predG ?? r.lambdaG ?? "",
      Signal: r.signalScore ?? "",
      Leak_Tier: r.leakTier ?? ""
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    const datePart = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `nhl_model_export_${datePart}.xlsx`);
  };

  const thProps = { sortCol, sortDir, onToggle: toggle };

  return (
    <>
      <div>
        {selectedMatchup && <PropFinderCheatStrip matchup={selectedMatchup} rankingsData={rankingsData} />}
        {/* View mode toggle */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px", alignItems: "center" }}>
          {["all", "bygame"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: `1px solid ${viewMode === mode ? "#16a34a" : "#e9e8f3"}`,
                background: viewMode === mode ? "#dcfce7" : "#fff",
                color: viewMode === mode ? "#15803d" : "#636977",
                fontFamily: "'Outfit Variable','Outfit',sans-serif",
                fontWeight: 700,
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              {mode === "all" ? "All Players" : "By Game"}
            </button>
          ))}
        </div>

        {/* Game tabs — only shown in bygame mode */}
        {viewMode === "bygame" && (
          <div style={{
            display: "flex", gap: "6px", marginBottom: "10px",
            flexWrap: "wrap",
          }}>
            {games.map((g) => {
              const count = data.filter((r) => r.game === g && (gateOnly ? r.gateOpen : true)).length;
              return (
                <button
                  key={g}
                  onClick={() => { setActiveGame(g); setExpandedRow(null); }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${activeGame === g ? "#2563eb" : "#e9e8f3"}`,
                    background: activeGame === g ? "#dbeafe" : "#fff",
                    color: activeGame === g ? "#1d4ed8" : "#636977",
                    fontFamily: "'Outfit Variable','Outfit',sans-serif",
                    fontWeight: 700,
                    fontSize: "18px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g} <span style={{ opacity: 0.6, fontSize: "16px" }}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Row 1: Search + pos filters + game select */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            overflow: "visible",
          }}
        >
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search player or team…"
            style={{
              flex: "1 1 180px",
              minWidth: "0",
              maxWidth: "420px",
              background: "#f8fafb",
              border: "1px solid #e9e8f3",
              borderRadius: "10px",
              color: "#26262c",
              padding: "9px 12px",
              fontSize: "18px",
              outline: "none",
            }}
          />

          {["ALL", "C", "LW", "RW", "D"].map((p) => (
            <button
              key={p}
              onClick={() => setPosF(p)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "'Outfit Variable','Outfit',sans-serif",
                whiteSpace: "nowrap",
                background: posF === p ? POS_COLOR[p] || "#16a34a" : "#f5f5f9",
                color: posF === p ? "#000" : "#636977",
              }}
            >
              {p}
            </button>
          ))}

          {viewMode === "all" && (
          <select
            value={gameF}
            onChange={(e) => setGameF(e.target.value)}
            style={{
              background: "#f8fafb",
              border: "1px solid #e9e8f3",
              borderRadius: "8px",
              color: "#26262c",
              padding: "8px 10px",
              fontSize: "18px",
              outline: "none",
              cursor: "pointer",
              minWidth: "84px",
            }}
          >
            {gameOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          )}

          <button
            onClick={() => setGateOnly((g) => !g)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "18px",
              fontFamily: "'Outfit Variable','Outfit',sans-serif",
              fontWeight: 700,
              whiteSpace: "nowrap",
              border: `1px solid ${gateOnly ? "#16a34a" : "#dcdbe8"}`,
              background: gateOnly ? "#dcfce7" : "transparent",
              color: gateOnly ? "#16a34a" : "#636977",
            }}
          >
            Gate ≤8 Only
          </button>

          <button
            onClick={exportToExcel}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "18px",
              fontFamily: "'Outfit Variable','Outfit',sans-serif",
              fontWeight: 700,
              whiteSpace: "nowrap",
              border: "1px solid #2563eb",
              background: "#dbeafe",
              color: "#1d4ed8",
            }}
          >
            Export Excel
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "16px", color: "#4b4a5c" }}>Min 3+S%</span>
            <input
              type="number"
              min="0"
              max="100"
              value={minP3s}
              onChange={(e) => setMinP3s(Number(e.target.value))}
              style={{
                width: "44px",
                background: "#f8fafb",
                border: "1px solid #e9e8f3",
                borderRadius: "6px",
                color: "#26262c",
                padding: "7px 6px",
                fontSize: "18px",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "16px", color: "#4b4a5c" }}>Min Leak</span>
            <input
              type="number"
              min="0"
              max="100"
              value={minLeak}
              onChange={(e) => setMinLeak(Number(e.target.value))}
              style={{
                width: "44px",
                background: "#f8fafb",
                border: "1px solid #e9e8f3",
                borderRadius: "6px",
                color: "#26262c",
                padding: "7px 6px",
                fontSize: "18px",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>
        </div>

        <div
          style={{
            fontSize: "18px",
            color: "#4b4a5c",
            marginBottom: "10px",
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <span>{sorted.length} players shown</span>
          {hasHist && (
            <span style={{ color: "#15803d" }}>
              ▲▼ = hist. adjustment active · hover cells for profile detail
            </span>
          )}
        </div>

        <div
          ref={tableScrollRef}
          style={{
            width: "100%",
            overflowX: "auto",
            overflowY: "visible",
            paddingBottom: "12px",
            scrollbarWidth: "thin",
            borderRadius: "14px",
            border: "1px solid #e9e8f3",
            background: "#ffffff",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ minWidth: "1800px" }}>
          <table
            className="results-table"
            style={{
              width: "100%",
              minWidth: "1800px",
              borderCollapse: "collapse",
              fontSize: "18px",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "2.5%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "3.5%" }} />
              <col style={{ width: "3.5%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7.5%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "5.5%" }} />
              <col style={{ width: "5.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
              <col style={{ width: "4.5%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#f2f2f8" }}>
                <th colSpan={11} style={{ position: "sticky", top: 0, background: "#f2f2f8", zIndex: 9, borderBottom: "1px solid #e9e8f3", padding: "8px 5px" }} />
                <th colSpan={3} style={{ position: "sticky", top: 0, background: "#ecfccb", color: "#166534", zIndex: 9, borderBottom: "1px solid #e9e8f3", padding: "8px 5px", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", letterSpacing: "0.10em", textTransform: "uppercase" }}>Shots</th>
                <th colSpan={2} style={{ position: "sticky", top: 0, background: "#dbeafe", color: "#1d4ed8", zIndex: 9, borderBottom: "1px solid #e9e8f3", padding: "8px 5px", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", letterSpacing: "0.10em", textTransform: "uppercase" }}>Points</th>
                <th colSpan={3} style={{ position: "sticky", top: 0, background: "#fef3c7", color: "#b45309", zIndex: 9, borderBottom: "1px solid #e9e8f3", padding: "8px 5px", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", letterSpacing: "0.10em", textTransform: "uppercase" }}>Goals</th>
              </tr>
              <tr style={{ background: "#f8fafb" }}>
                <th
                  style={{
                    padding: "9px 5px",
                    width: "34px",
                    textAlign: "center",
                    fontSize: "18px",
                    color: "#4b4a5c",
                    borderBottom: "1px solid #e9ecef",
                    fontFamily: "'Outfit Variable','Outfit',sans-serif",
                    position: "sticky",
                    top: 0,
                    background: "#f8fafb",
                    zIndex: 8,
                  }}
                >
                  #
                </th>

                <th
                  onClick={() => toggle("name")}
                  style={{
                    padding: "9px 5px",
                    textAlign: "left",
                    fontSize: "18px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    userSelect: "none",
                    color: sortCol === "name" ? "#16a34a" : "#80828d",
                    borderBottom: "1px solid #e9ecef",
                    fontFamily: "'Outfit Variable','Outfit',sans-serif",
                    width: "460px",
                    position: "sticky",
                    top: 0,
                    background: "#f8fafb",
                    zIndex: 8,
                  }}
                >
                  Player {sortCol === "name" ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </th>

                <SortTh {...thProps} col="team" label="Team" width="90px" />
                <SortTh {...thProps} col="pos" label="Pos" width="56px" />
                <SortTh {...thProps} col="venue" label="H/A" width="64px" />
                <SortTh {...thProps} col="opponent" label="Opp" width="110px" />
                <SortTh
                  {...thProps}
                  col="defRank"
                  label="Def Rnk"
                  width="86px"
                  title="Composite rank using Shots, ICF, IFF, ISCF"
                />
                <SortTh
                  {...thProps}
                  col="attackScore"
                  label="Play Score"
                  width="120px"
                  title="Decision score that blends probability, role, confidence, and best-bet strength"
                />
                <SortTh
                  {...thProps}
                  col="attackBadgeRank"
                  label="Play Tier"
                  width="100px"
                  title="Readable tier for the overall play score"
                />
                <SortTh {...thProps} col="oppAvgShots" label="Opp Avg Shots" width="94px" title="Average shots allowed by tonight's opponent over the last 7 venue-matched historical games for this player's current role." />
                <SortTh {...thProps} col="oppAvgGoals" label="Opp Avg Goals" width="94px" title="Average goals allowed by tonight's opponent over the last 7 venue-matched historical games for this player's current role." />
                <SortTh {...thProps} col="p3s" label="3+" width="74px" />
                <SortTh {...thProps} col="p4s" label="4+" width="74px" />
                <SortTh {...thProps} col="p5s" label="5+" width="74px" />
                <SortTh {...thProps} col="p1p" label="1P" width="74px" />
                <SortTh {...thProps} col="p2p" label="2P" width="74px" />
                <SortTh {...thProps} col="p1g" label="1G" width="74px" />
                <SortTh {...thProps} col="p2g" label="2G" width="74px" />
                <SortTh {...thProps} col="p3g" label="3G" width="74px" />
              </tr>
            </thead>

            <tbody>
              {sorted.map((r, i) => {
                const pc = POS_COLOR[r.pos] || "#05011c";
                const gc = r.gateOpen ? "#15803d" : "#dc2626";
                const rowKey = `${r.name}-${r.venue}-${r.game}`;
                const isExpanded = expandedRow === rowKey;
                const venue = r.isHome ? "home" : "away";
                const vp = r.hist?.[`_${venue}`] || null;
                const alert = getAlertConfig(r);
                const predictionSummary = getPredictionSummary(r);
                const primaryCall = getPrimaryCall(r);
                const quickWhy = getQuickWhy(r);
                const playTier = getPlayScoreLabel(r.attackScore);

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className="rh"
                      onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #e9ecef",
                        cursor: "pointer",
                        background: isExpanded ? "#ffffff" : "transparent",
                      }}
                    >
                      <td
                        style={{
                          padding: "9px 5px",
                          textAlign: "center",
                          fontSize: "18px",
                          color: "#4b4a5c",
                          fontFamily: "'Outfit Variable','Outfit',sans-serif",
                        }}
                      >
                        {i + 1}
                      </td>

                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ color: "#05011c", fontWeight: 700, fontSize: "21px" }}>
                              {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span>
                            </span>
                            {alert && (
                              <span
                                title={alert.label}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minWidth: "20px",
                                  height: "20px",
                                  padding: "0 6px",
                                  borderRadius: "999px",
                                  background: alert.bg,
                                  color: alert.fg,
                                  fontSize: "18px",
                                  fontWeight: 900,
                                  border: `1px solid ${alert.fg}22`,
                                }}
                              >
                                {alert.icon}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "16px",
                                fontWeight: 700,
                                fontFamily: "'Outfit Variable','Outfit',sans-serif",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background:
                                  r.lineBoost > 0 ? "#dcfce7" : r.todayLine > r.impliedLine ? "#fee2e2" : "rgba(0,0,0,0.05)",
                                color: r.lineBoost > 0 ? "#15803d" : r.todayLine > r.impliedLine ? "#dc2626" : "#4b4a5c",
                              }}
                            >
{r.currentRole || `L${r.todayLine}`}
                            </span>
                          </div>
                          <span style={{ fontSize: "16px", color: "#4b4a5c" }}>
                            {r.isHome ? "🏠" : "✈"} · {r.leakTier} matchup · TOI {r.effectiveToi ?? r.playerToi}m
                          </span>
                          <span style={{ fontSize: "17px", color: "#05011c", fontWeight: 800 }}>{primaryCall}</span>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "4px" }}>
                            <span style={{ padding: "3px 8px", borderRadius: "999px", background: playTier.bg, color: playTier.fg, fontSize: "15px", fontWeight: 800, fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>
                              Play Score {r.attackScore ?? "—"} · {playTier.label}
                            </span>
                            <TagPill tag={r.compositeTag} />
                            <TagPill tag={r.shotTag} />
                            <TagPill tag={r.ceilingTag} />
                            <TagPill tag={r.goalTag} />
                          </div>
                          <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                            {quickWhy.map((item, idx) => (
                              <span key={`${rowKey}-why-${idx}`} style={{ fontSize: "15px", color: "#4b4a5c" }}>• {item.replace(/\.$/, "")}</span>
                            ))}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right", color: "#373449", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px" }}>
                        {r.team}
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right" }}>
                        <span style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 700, fontSize: "18px", color: pc, background: `${pc}22`, borderRadius: "5px", padding: "3px 6px" }}>
                          {r.pos}
                        </span>
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right" }}>
                        <span style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 700, fontSize: "18px", color: r.isHome ? "#166534" : "#1d4ed8", background: r.isHome ? "#dcfce7" : "#dbeafe", borderRadius: "5px", padding: "3px 6px" }}>
                          {r.venue}
                        </span>
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", color: "#373449" }}>
                        {r.opponent}
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right" }}>
                        <span style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 700, fontSize: "18px", color: gc, background: r.gateOpen ? "#dcfce7" : "#fee2e2", borderRadius: "7px", padding: "3px 6px" }}>
                          {r.defRank === 99 ? "—" : `#${r.defRank}`}
                        </span>
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right" }}>
                        <span style={{
                          display: "inline-block",
                          minWidth: "48px",
                          textAlign: "center",
                          padding: "4px 8px",
                          borderRadius: "10px",
                          background: getPlayScoreLabel(r.attackScore).bg,
                          color: getPlayScoreLabel(r.attackScore).fg,
                          fontFamily: "'Outfit Variable','Outfit',sans-serif",
                          fontWeight: 900,
                          fontSize: "18px"
                        }}>
                          {r.attackScore ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 5px", textAlign: "right" }}>
                        <span style={{
                          display: "inline-block",
                          minWidth: "34px",
                          textAlign: "center",
                          padding: "4px 8px",
                          borderRadius: "999px",
                          background: r.attackBadge?.bg || "#f2f2f8",
                          color: r.attackBadge?.fg || "#636977",
                          fontFamily: "'Outfit Variable','Outfit',sans-serif",
                          fontWeight: 800,
                          fontSize: "16px"
                        }}>
                          {r.attackBadge?.label || "—"}
                        </span>
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", color: "#373449" }}>
                        {r.oppAvgShots != null ? r.oppAvgShots.toFixed(2) : ""}
                      </td>

                      <td style={{ padding: "9px 5px", textAlign: "right", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", color: "#373449" }}>
                        {r.oppAvgGoals != null ? r.oppAvgGoals.toFixed(3) : ""}
                      </td>

                      <ProbCell p={r.p3s} hist={r.hist.s3} highlight={sortCol === "p3s"} onHover={showTip} onLeave={hideTip} prop="p3s" />
                      <ProbCell p={r.p4s} hist={r.hist.s4} highlight={sortCol === "p4s"} onHover={showTip} onLeave={hideTip} prop="p4s" />
                      <ProbCell p={r.p5s} hist={r.hist.s5} highlight={sortCol === "p5s"} onHover={showTip} onLeave={hideTip} prop="p5s" />
                      <ProbCell p={r.p1p} hist={null} highlight={sortCol === "p1p"} onHover={showTip} onLeave={hideTip} prop="p1p" />
                      <ProbCell p={r.p2p} hist={null} highlight={sortCol === "p2p"} onHover={showTip} onLeave={hideTip} prop="p2p" />
                      <ProbCell p={r.p1g} hist={r.hist.g1} highlight={sortCol === "p1g"} onHover={showTip} onLeave={hideTip} prop="p1g" fire={isOnFire(r)} />
                      <ProbCell p={r.p2g} hist={r.hist.g2} highlight={sortCol === "p2g"} onHover={showTip} onLeave={hideTip} prop="p2g" />
                      <ProbCell p={r.p3g} hist={null} highlight={sortCol === "p3g"} onHover={showTip} onLeave={hideTip} />
                    </tr>

{isExpanded && (
                      <tr key={`${rowKey}-expand`}>
                        <td
                          colSpan={19}
                          style={{
                            padding: "0 8px 14px 8px",
                            background: "#f9faff",
                            borderTop: "1px solid #e9e8f3",
                            borderBottom: "1px solid #e9ecef",
                          }}
                        >
                          <PlayerExpandedPanel r={r} venue={venue} hasHist={hasHist} />
                        </td>
                      </tr>
                    )}

                  </React.Fragment>
                );
              })}

              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={19}
                    style={{
                      padding: "44px",
                      textAlign: "center",
                      color: "#4b4a5c",
                      fontSize: "18px",
                    }}
                  >
                    No players match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <Tooltip
        hist={tooltip ? tooltip.hist : null}
        mouseX={tooltip ? tooltip.x : 0}
        mouseY={tooltip ? tooltip.y : 0}
      />
    </>
  );
}



function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderRadius: "10px",
        border: `1px solid ${active ? "#16a34a" : "#e9e8f3"}`,
        background: active ? "#dcfce7" : "#ffffff",
        color: active ? "#166534" : "#636977",
        fontFamily: "'Outfit Variable','Outfit',sans-serif",
        fontWeight: 800,
        fontSize: "18px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SummaryCard({ title, body, accent = "#15803d" }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e9e8f3",
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontFamily: "'Outfit Variable','Outfit',sans-serif",
          fontSize: "24px",
          fontWeight: 800,
          color: accent,
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.65 }}>{body}</div>
    </div>
  );
}




function BestBetsCard({ title, accent, rows, market }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e9e8f3", borderRadius: "16px", padding: "16px" }}>
      <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "28px", fontWeight: 800, color: accent, marginBottom: "10px" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rows.map((r, idx) => {
          const prob = market === "shots" ? Math.max(r.p4s || 0, r.p3s || 0) : market === "goals2" ? (r.p2g || 0) : (r.p1g || 0);
          const headline = market === "shots" ? `${Math.round((r.p4s || 0) * 100)}% 4+` : market === "goals2" ? `${Math.round((r.p2g || 0) * 100)}% 2G` : `${Math.round((r.p1g || 0) * 100)}% 1G`;
          // 2+ goals is read against the model's own ladder (≥14% Legit, 10–13% Sprinkle), not the generic likely scale.
          const tail = market === "goals2"
            ? `${getPropLabel("p2g", r.p2g) || "Below the 10% sprinkle floor"} · 1G ${Math.round((r.p1g || 0) * 100)}% · Pred G ${r.lambdaG != null ? r.lambdaG.toFixed(2) : "—"}`
            : getLikelyLabel(prob);
          return (
            <div key={`${market}-${r.name}-${idx}`} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                <div style={{ fontSize: "19px", fontWeight: 800, color: "#05011c" }}>{idx + 1}. {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span></div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: accent }}>{headline}</div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "6px" }}>
                <span style={{ padding: "4px 8px", borderRadius: "999px", background: getPlayScoreLabel(r.attackScore).bg, color: getPlayScoreLabel(r.attackScore).fg, fontSize: "16px", fontWeight: 800, fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>
                  Play Score {r.attackScore ?? "—"} · {getPlayScoreLabel(r.attackScore).label}
                </span>
                <span style={{ color: "#636977", fontSize: "17px" }}>{r.bestBetLabel || getPrimaryCall(r).replace("Best call: ", "")}</span>
                <span style={{ color: "#636977", fontSize: "17px" }}>{tail}</span>
              </div>
            </div>
          );
        })}
        {!rows.length && <div style={{ color: "#636977", fontSize: "17px" }}>No skater clears the floor on this slate.</div>}
      </div>
    </div>
  );
}

function OverallBestBets({ data }) {
  const shots = useMemo(() => {
    return [...data]
      .filter((r) => r.gateOpen && ((r.p4s || 0) >= 0.40 || (r.p3s || 0) >= 0.60))
      .sort((a, b) => ((b.p4s || 0) * 100 + (b.p5s || 0) * 60 + (b.attackScore || 0)) - ((a.p4s || 0) * 100 + (a.p5s || 0) * 60 + (a.attackScore || 0)))
      .slice(0, 5);
  }, [data]);

  const goals = useMemo(() => {
    return [...data]
      .filter((r) => (r.p1g || 0) >= 0.18 || r.goalTag?.label)
      .sort((a, b) => ((b.p1g || 0) * 100 + (b.p2g || 0) * 70 + (b.attackScore || 0) * 0.35) - ((a.p1g || 0) * 100 + (a.p2g || 0) * 70 + (a.attackScore || 0) * 0.35))
      .slice(0, 5);
  }, [data]);

  // 2+ goal candidates: the model's p2g ladder (≥14% Legit, 10–13% Sprinkle, below 10% noise),
  // sorted by p2g alone so the multi-goal ceiling is read on its own rather than under the 1G rank.
  const goals2 = useMemo(() => {
    return [...data]
      .filter((r) => (r.p2g || 0) >= 0.10)
      .sort((a, b) => (b.p2g || 0) - (a.p2g || 0) || (b.p1g || 0) - (a.p1g || 0))
      .slice(0, 6);
  }, [data]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px", marginBottom: "18px" }}>
      <BestBetsCard title="Top 5 Shots Plays" accent="#166534" rows={shots} market="shots" />
      <BestBetsCard title="Top 5 Goal Plays" accent="#b45309" rows={goals} market="goals" />
      <BestBetsCard title="2+ Goal Candidates" accent="#9a3412" rows={goals2} market="goals2" />
    </div>
  );
}


function AuditView({ data, actualResults = {} }) {
  const [auditMode, setAuditMode] = useState("shots"); // shots | points | goals

  const rows = useMemo(() => {
    return data
      .map((r) => {
        const actual = actualResults[normalizePlayerName(r.name)] || null;
        return { ...r, actual };
      })
      .filter((r) => r.actual)
      .map((r) => ({
        ...r,
        actualShots: r.actual?.shots || 0,
        actualGoals: r.actual?.goals || 0,
        actualPoints: r.actual?.points || 0,
      }));
  }, [data, actualResults]);

  const getAuditRowsForMode = useCallback((mode) => {
    let out = rows;
    if (mode === "shots") {
      out = out
        .filter((r) => r.actualShots > 0)
        .sort((a, b) => {
          if ((b.actualShots || 0) !== (a.actualShots || 0)) return (b.actualShots || 0) - (a.actualShots || 0);
          return (b.p4s || 0) - (a.p4s || 0);
        });
    } else if (mode === "points") {
      out = out
        .filter((r) => r.actualPoints > 0)
        .sort((a, b) => {
          if ((b.actualPoints || 0) !== (a.actualPoints || 0)) return (b.actualPoints || 0) - (a.actualPoints || 0);
          return (b.p1p || 0) - (a.p1p || 0);
        });
    } else {
      out = out
        .filter((r) => r.actualGoals > 0)
        .sort((a, b) => {
          if ((b.actualGoals || 0) !== (a.actualGoals || 0)) return (b.actualGoals || 0) - (a.actualGoals || 0);
          return (b.p1g || 0) - (a.p1g || 0);
        });
    }
    return out;
  }, [rows]);

  const filtered = useMemo(() => getAuditRowsForMode(auditMode), [getAuditRowsForMode, auditMode]);

  const summary = useMemo(() => {
    const shotsRows = rows.filter((r) => r.actualShots > 0);
    const pointsRows = rows.filter((r) => r.actualPoints > 0);
    const goalsRows = rows.filter((r) => r.actualGoals > 0);
    return {
      matched: rows.length,
      shotOutcomes: shotsRows.length,
      pointOutcomes: pointsRows.length,
      goalOutcomes: goalsRows.length,
    };
  }, [rows]);

  const buildAuditExportRows = useCallback((mode) => {
    return getAuditRowsForMode(mode).map((r, idx) => ({
      Rank: idx + 1,
      Player: r.name,
      Team: r.team,
      Role: r.currentRole || "",
      Historical_Venue_Avg_Shots: r.oppAvgShots != null ? r.oppAvgShots : "",
      Historical_Venue_Avg_Goals: r.oppAvgGoals != null ? r.oppAvgGoals : "",
      Position: r.pos,
      Venue: r.venue,
      Opponent: r.opponent,
      Game: r.game,
      Actual_Shots: r.actualShots || 0,
      Actual_Goals: r.actualGoals || 0,
      Actual_Points: r.actualPoints || 0,
      Pred_3plus_Shots_Pct: Math.round((r.p3s || 0) * 100),
      Pred_4plus_Shots_Pct: Math.round((r.p4s || 0) * 100),
      Pred_5plus_Shots_Pct: Math.round((r.p5s || 0) * 100),
      Pred_1plus_Point_Pct: Math.round((r.p1p || 0) * 100),
      Pred_2plus_Points_Pct: Math.round((r.p2p || 0) * 100),
      Pred_1plus_Goal_Pct: Math.round((r.p1g || 0) * 100),
      Pred_2plus_Goals_Pct: Math.round((r.p2g || 0) * 100),
      Pred_3plus_Goals_Pct: Math.round((r.p3g || 0) * 100),
      Hit_3plus_Shots: (r.actualShots || 0) >= 3 ? "Y" : "N",
      Hit_4plus_Shots: (r.actualShots || 0) >= 4 ? "Y" : "N",
      Hit_5plus_Shots: (r.actualShots || 0) >= 5 ? "Y" : "N",
      Hit_1plus_Point: (r.actualPoints || 0) >= 1 ? "Y" : "N",
      Hit_2plus_Points: (r.actualPoints || 0) >= 2 ? "Y" : "N",
      Hit_1plus_Goal: (r.actualGoals || 0) >= 1 ? "Y" : "N",
      Hit_2plus_Goals: (r.actualGoals || 0) >= 2 ? "Y" : "N",
      Hit_3plus_Goals: (r.actualGoals || 0) >= 3 ? "Y" : "N",
    }));
  }, [getAuditRowsForMode]);

  const exportAuditResults = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const shotsWs = XLSX.utils.json_to_sheet(buildAuditExportRows("shots"));
    const goalsWs = XLSX.utils.json_to_sheet(buildAuditExportRows("goals"));
    const pointsWs = XLSX.utils.json_to_sheet(buildAuditExportRows("points"));

    XLSX.utils.book_append_sheet(wb, shotsWs, "Shots");
    XLSX.utils.book_append_sheet(wb, goalsWs, "Goals");
    XLSX.utils.book_append_sheet(wb, pointsWs, "Points");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `nhl_audit_export_${stamp}.xlsx`);
  }, [buildAuditExportRows]);

  const tabs = [
    { key: "shots", label: "By Actual Shots" },
    { key: "points", label: "By Actual Points" },
    { key: "goals", label: "By Actual Goals" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "Players Matched", value: summary.matched, fg: "#26262c", bg: "#f2f2f8" },
          { label: "Shot Outcomes", value: summary.shotOutcomes, fg: "#166534", bg: "#ecfccb" },
          { label: "Point Outcomes", value: summary.pointOutcomes, fg: "#1d4ed8", bg: "#dbeafe" },
          { label: "Goal Outcomes", value: summary.goalOutcomes, fg: "#b45309", bg: "#fef3c7" },
        ].map((c) => (
          <div key={c.label} style={{ background: c.bg, color: c.fg, borderRadius: "14px", padding: "14px", border: "1px solid #e9e8f3" }}>
            <div style={{ fontSize: "16px", opacity: 0.8 }}>{c.label}</div>
            <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 800, fontSize: "30px" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setAuditMode(t.key)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid #e9e8f3",
                cursor: "pointer",
                background: auditMode === t.key ? "#05011c" : "#ffffff",
                color: auditMode === t.key ? "#ffffff" : "#373449",
                fontFamily: "'Outfit Variable','Outfit',sans-serif",
                fontWeight: 800,
                fontSize: "18px"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={exportAuditResults}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            border: "1px solid #1d4ed8",
            cursor: "pointer",
            background: "#dbeafe",
            color: "#1d4ed8",
            fontFamily: "'Outfit Variable','Outfit',sans-serif",
            fontWeight: 800,
            fontSize: "18px",
            whiteSpace: "nowrap"
          }}
        >
          Export Audit
        </button>
      </div>

      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e9e8f3", borderRadius: "14px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafb" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Player</th>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Role</th>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Hist Venue Avg S</th>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Hist Venue Avg G</th>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Team</th>
              {auditMode === "shots" && (
                <>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Actual SOG</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>3+ Pre-game</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>4+ Pre-game</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>5+ Pre-game</th>
                </>
              )}
              {auditMode === "points" && (
                <>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Actual Points</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>1+ Pre-game</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>2+ Pre-game</th>
                </>
              )}
              {auditMode === "goals" && (
                <>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>Actual Goals</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>1+ Pre-game</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e9e8f3", fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "19px", letterSpacing: "0.04em", color: "#80828d" }}>2+ Pre-game</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={`${r.name}-${idx}`} style={{ borderBottom: "1px solid #fbfcfd" }}>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 800, fontSize: "18px", color: "#05011c" }}>{r.name}</div>
                  <div style={{ fontSize: "14px", color: "#636977" }}>{r.venue}</div>
                </td>
                <td style={{ padding: "10px 12px", color: "#373449", fontWeight: 700 }}>{r.currentRole || "—"}</td>
                <td style={{ padding: "10px 12px", color: "#373449" }}>{r.oppAvgShots != null ? r.oppAvgShots.toFixed(2) : "—"}</td>
                <td style={{ padding: "10px 12px", color: "#373449" }}>{r.oppAvgGoals != null ? r.oppAvgGoals.toFixed(3) : "—"}</td>
                <td style={{ padding: "10px 12px", color: "#373449" }}>{r.team}</td>

                {auditMode === "shots" && (
                  <>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#05011c" }}>{r.actualShots}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#166534" }}>{Math.round((r.p3s || 0) * 100)}%</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#166534" }}>{Math.round((r.p4s || 0) * 100)}%</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#166534" }}>{Math.round((r.p5s || 0) * 100)}%</td>
                  </>
                )}

                {auditMode === "points" && (
                  <>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#05011c" }}>{r.actualPoints}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1d4ed8" }}>{Math.round((r.p1p || 0) * 100)}%</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1d4ed8" }}>{Math.round((r.p2p || 0) * 100)}%</td>
                  </>
                )}

                {auditMode === "goals" && (
                  <>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#05011c" }}>{r.actualGoals}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#b45309" }}>{Math.round((r.p1g || 0) * 100)}%</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#b45309" }}>{Math.round((r.p2g || 0) * 100)}%</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BestByGame({ data }) {
  const games = useMemo(() => {
    const grouped = new Map();
    data.forEach((r) => {
      if (!grouped.has(r.game)) grouped.set(r.game, []);
      grouped.get(r.game).push(r);
    });

    return Array.from(grouped.entries()).map(([game, rows]) => {
      const envBest = [...rows].sort((a, b) => (b.environmentScore || 0) - (a.environmentScore || 0))[0] || rows[0];

      const shotCandidates = [...rows]
        .filter((r) => r.gateOpen && ((r.p4s || 0) >= 0.40 || (r.p3s || 0) >= 0.58 || (r.signalScore || 0) >= 65))
        .sort(
          (a, b) =>
            (b.p4s || 0) * 100 +
            (b.p3s || 0) * 45 +
            (b.signalScore || 0) * 0.65 +
            ((b.histS3Rate || 0) * 100) * 0.15 -
            ((a.p4s || 0) * 100 +
              (a.p3s || 0) * 45 +
              (a.signalScore || 0) * 0.65 +
              ((a.histS3Rate || 0) * 100) * 0.15)
        )
        .slice(0, 3);

      const goalCandidates = [...rows]
        .filter((r) => (r.p1g || 0) >= 0.22 || ((r.p1g || 0) >= 0.16 && (r.signalScore || 0) >= 68))
        .sort(
          (a, b) =>
            ((b.goalLeakOverride ? 1 : 0) * 28) +
            (b.p1g || 0) * 100 +
            (b.p2g || 0) * 35 +
            (b.dangerRate || 0) * 32 +
            (b.signalScore || 0) * 0.28 +
            ((b.histG1Rate || 0) * 100) * 0.18 -
            (((a.goalLeakOverride ? 1 : 0) * 28) +
              (a.p1g || 0) * 100 +
              (a.p2g || 0) * 35 +
              (a.dangerRate || 0) * 32 +
              (a.signalScore || 0) * 0.28 +
              ((a.histG1Rate || 0) * 100) * 0.18)
        )
        .slice(0, 3);

      const pointCandidates = [...rows]
        .filter((r) => (r.p1p || 0) >= 0.46 || ((r.p2p || 0) >= 0.15 && (r.signalScore || 0) >= 62))
        .sort(
          (a, b) =>
            (b.p1p || 0) * 100 +
            (b.p2p || 0) * 45 +
            (b.signalScore || 0) * 0.32 +
            ((b.histS3Rate || 0) * 100) * 0.10 -
            ((a.p1p || 0) * 100 +
              (a.p2p || 0) * 45 +
              (a.signalScore || 0) * 0.32 +
              ((a.histS3Rate || 0) * 100) * 0.10)
        )
        .slice(0, 3);

      return { game, envBest, shotCandidates, goalCandidates, pointCandidates };
    });
  }, [data]);

  return (
    <div
      style={{
        marginBottom: "22px",
        background: "#ffffff",
        border: "1px solid #e9e8f3",
        borderRadius: "16px",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontFamily: "'Outfit Variable','Outfit',sans-serif",
          fontSize: "33px",
          fontWeight: 800,
          color: "#05011c",
          marginBottom: "6px",
        }}
      >
        Best by game
      </div>
      <div style={{ fontSize: "21px", color: "#636977", marginBottom: "14px" }}>
        Fast matchup view: the legit best shot, point, and goal bets for each game, not just one player.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(285px, 1fr))",
          gap: "12px",
        }}
      >
        {games.map(({ game, envBest, shotCandidates, goalCandidates, pointCandidates }) => (
          <div
            key={game}
            style={{
              background: "#f8fafb",
              border: "1px solid #e9e8f3",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div
              style={{
                fontFamily: "'Outfit Variable','Outfit',sans-serif",
                fontSize: "24px",
                fontWeight: 800,
                color: "#26262c",
                marginBottom: "10px",
              }}
            >
              {game}
            </div>

            <div style={{ fontSize: "18px", color: "#636977", marginBottom: "10px" }}>
              Environment: <strong style={{ color: "#166534" }}>{envBest?.environmentTier}</strong> · Score {envBest?.environmentScore ?? "—"}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#05011c", marginBottom: "6px" }}>
                Best shots bets
              </div>

              {shotCandidates.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {shotCandidates.map((r, idx) => (
                    <div
                      key={`${game}-shot-${idx}-${r.name}-${r.venue}`}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e9e8f3",
                        borderRadius: "10px",
                        padding: "10px 11px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#05011c" }}>
                          {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span>
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#166534" }}>
                          {Math.round((r.p4s || 0) * 100)}% for 4+
                        </div>
                      </div>
                      <div style={{ fontSize: "18px", color: "#636977", marginTop: "2px" }}>
                        3+ {Math.round((r.p3s || 0) * 100)}% · Pred S {r.lambdaS?.toFixed(1)} · Signal {r.signalScore}
                      </div>
                      <div style={{ marginTop: "6px" }}><BulletList items={buildBoardBulletPoints(r, "shots")} color="#373449" fontSize="17px" tight /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "18px", color: "#636977" }}>No strong shot bets flagged.</div>
              )}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#05011c", marginBottom: "6px" }}>
                Best points bets
              </div>

              {pointCandidates.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {pointCandidates.map((r, idx) => (
                    <div
                      key={`${game}-point-${idx}-${r.name}-${r.venue}`}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e9e8f3",
                        borderRadius: "10px",
                        padding: "10px 11px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#05011c" }}>
                          {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span>
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#2563eb" }}>
                          {Math.round((r.p1p || 0) * 100)}% for 1P
                        </div>
                      </div>
                      <div style={{ fontSize: "18px", color: "#636977", marginTop: "2px" }}>
                        2P {Math.round((r.p2p || 0) * 100)}% · Pred P {r.lambdaP?.toFixed(2)} · Signal {r.signalScore}
                      </div>
                      <div style={{ marginTop: "6px" }}><BulletList items={buildBoardBulletPoints(r, "points")} color="#373449" fontSize="17px" tight /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "18px", color: "#636977" }}>No strong points bets flagged.</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#05011c", marginBottom: "6px" }}>
                Best goal bets
              </div>

              {goalCandidates.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {goalCandidates.map((r, idx) => (
                    <div
                      key={`${game}-goal-${idx}-${r.name}-${r.venue}`}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e9e8f3",
                        borderRadius: "10px",
                        padding: "10px 11px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#05011c" }}>
                          {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span>
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#b45309" }}>
                          {Math.round((r.p1g || 0) * 100)}% for 1G
                        </div>
                      </div>
                      <div style={{ fontSize: "18px", color: "#636977", marginTop: "2px" }}>
                        2G {Math.round((r.p2g || 0) * 100)}% · Pred G {r.lambdaG?.toFixed(2)} · Signal {r.signalScore}
                      </div>
                      <div style={{ marginTop: "6px" }}><BulletList items={buildBoardBulletPoints(r, "goals")} color="#373449" fontSize="17px" tight /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "18px", color: "#636977" }}>No strong goal bets flagged.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConclusionBoard({ data }) {
  const taggedData = [...data].map((r) => enrichBoardTags(r));

  const topShots = taggedData
    .filter((r) => r.gateOpen && includeTopBoardRow(r, 'shots'))
    .sort((a, b) => scoreTopBoardRow(b, 'shots') - scoreTopBoardRow(a, 'shots'))
    .slice(0, 8);

  const topGoals = taggedData
    .filter((r) => includeTopBoardRow(r, 'goals'))
    .sort((a, b) => scoreTopBoardRow(b, 'goals') - scoreTopBoardRow(a, 'goals'))
    .slice(0, 8);

  const topPoints = taggedData
    .filter((r) => includeTopBoardRow(r, 'points'))
    .sort((a, b) => scoreTopBoardRow(b, 'points') - scoreTopBoardRow(a, 'points'))
    .slice(0, 8);

  const strongestSignals = [
    `${data.filter((r) => (r.leakScore ?? 0) >= 75).length} players are in clearly soft positional lanes (Leak ≥ 75).`,
    `${data.filter((r) => (r.environmentScore ?? 0) >= 72).length} players sit in A-or-better environments (Environment Score ≥ 72).`,
    `${data.filter((r) => (r.lineShare ?? 0) >= 0.36).length} players are primary line shooters (Line Share ≥ 36%).`,
    `${data.filter((r) => (r.shotConv ?? 0) >= 0.7).length} players have strong iFF→SOG conversion (≥ 0.70).`,
    `${data.filter((r) => (r.dangerRate ?? 0) >= 0.45).length} players have a real goal-friendly danger mix (Danger Rate ≥ 0.45).`,
    `${data.filter((r) => (r.histS3Rate ?? 0) >= 0.4 || (r.histG1Rate ?? 0) >= 0.18).length} players are being supported by the historical hit engine.`,
  ];

  return (
    <div style={{ display: "grid", gap: "18px", marginBottom: "22px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr",
          gap: "14px",
        }}
      >
        <SummaryCard
          title="How to conclude faster"
          body="Start with Signal, then verify Leak, Line Share, and Conversion. For shots, trust players who have both a soft lane and primary shot share. For goals, require either strong Danger Rate or already-live goal probability. Fade players who are high on Leak but weak on conversion or low on line share."
        />
        <SummaryCard
          title="What is actually working"
          body="The model is most right when Leak is strong and at least one player-side driver confirms it: conversion, line share, or danger rate. Those are the cases where the board is finding the right names near the top instead of just identifying open defenses."
          accent="#b45309"
        />
        <SummaryCard
          title="What still creates fake flags"
          body="Soft defensive lanes alone can still over-rank some players. The usual culprits are block-heavy defenses, secondary shooters on the line, and low-conversion players whose iFF does not become real shots on goal."
          accent="#7c2d12"
        />
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e9e8f3",
          borderRadius: "16px",
          padding: "18px",
        }}
      >
        <div
          style={{
            fontFamily: "'Outfit Variable','Outfit',sans-serif",
            fontSize: "33px",
            fontWeight: 800,
            color: "#05011c",
            marginBottom: "10px",
          }}
        >
          Board legend
        </div>
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.55 }}>
            <strong>Shot tags:</strong> 4+ ELITE = 70%+ · 4+ CORE = 55–70% · 4+ THIN = 45–55% · 5+ ELITE = 30%+ · 5+ EDGE = 18–30% · 5+ LOTTO = 12–18%
          </div>
          <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.55 }}>
            <strong>Goal tags:</strong> GOAL ELITE = 45%+ · GOAL CORE = 30–45% · GOAL THIN = 22–30% · GOAL LOTTO = 18–22%
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <TagPill tag={{ label: "PRIMARY TARGET" }} />
            <TagPill tag={{ label: "LADDER TARGET" }} />
            <TagPill tag={{ label: "GOAL TARGET" }} />
            <TagPill tag={{ label: "CEILING PLAY" }} />
          </div>
          <div style={{ fontSize: "18px", color: "#636977", lineHeight: 1.55 }}>
            <strong>How to use it:</strong> PRIMARY TARGET = best all-around play · LADDER TARGET = strongest 4+/5+ shot ladder candidate · GOAL TARGET = best goal play · CEILING PLAY = higher-variance upside only
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e9e8f3",
          borderRadius: "16px",
          padding: "18px",
        }}
      >
        <div
          style={{
            fontFamily: "'Outfit Variable','Outfit',sans-serif",
            fontSize: "33px",
            fontWeight: 800,
            color: "#05011c",
            marginBottom: "10px",
          }}
        >
          Strongest slate-wide signals
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "10px",
          }}
        >
          {strongestSignals.map((s, idx) => (
            <div
              key={idx}
              style={{
                background: "#f8fafb",
                border: "1px solid #e9e8f3",
                borderRadius: "12px",
                padding: "14px",
                fontSize: "18px",
                color: "#373449",
                lineHeight: 1.6,
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e9e8f3",
            borderRadius: "16px",
            padding: "18px",
          }}
        >
          <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "33px", fontWeight: 800, color: "#05011c", marginBottom: "10px" }}>
            Top shots board
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {topShots.map((r, idx) => (
              <div key={`${r.name}-${r.venue}-${r.game}-shots`} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#05011c" }}>{idx + 1}. {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span></div>
                    <div style={{ fontSize: "18px", color: "#636977" }}>{r.game} · {r.pos} · Signal {r.signalScore}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}><TagPill tag={r.compositeTag} /><TagPill tag={r.shotTag} /><TagPill tag={r.ceilingTag} /><TagPill tag={r.goalTag} /></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#15803d" }}>{Math.round(r.p3s * 100)}% 3+</div>
                    <div style={{ fontSize: "18px", color: "#636977" }}>{Math.round(r.p4s * 100)}% 4+</div>
                  </div>
                </div>
                <div style={{ marginTop: "8px" }}><BulletList items={buildBoardBulletPoints(r, "shots")} color="#373449" fontSize="17px" tight /></div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e9e8f3",
            borderRadius: "16px",
            padding: "18px",
          }}
        >
          <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "33px", fontWeight: 800, color: "#05011c", marginBottom: "10px" }}>
            Top points board
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {topPoints.map((r, idx) => (
              <div key={`${r.name}-${r.venue}-${r.game}-points`} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#05011c" }}>{idx + 1}. {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span></div>
                    <div style={{ fontSize: "18px", color: "#636977" }}>{r.game} · {r.pos} · Signal {r.signalScore}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}><TagPill tag={r.compositeTag} /><TagPill tag={r.shotTag} /><TagPill tag={r.ceilingTag} /><TagPill tag={r.goalTag} /></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#2563eb" }}>{Math.round(r.p1p * 100)}% 1P</div>
                    <div style={{ fontSize: "18px", color: "#636977" }}>{Math.round(r.p2p * 100)}% 2P</div>
                  </div>
                </div>
                <div style={{ marginTop: "8px" }}><BulletList items={buildBoardBulletPoints(r, "points")} color="#373449" fontSize="17px" tight /></div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e9e8f3",
            borderRadius: "16px",
            padding: "18px",
          }}
        >
          <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "33px", fontWeight: 800, color: "#05011c", marginBottom: "10px" }}>
            Top goals board
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {topGoals.map((r, idx) => (
              <div key={`${r.name}-${r.venue}-${r.game}-goals`} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#05011c" }}>{idx + 1}. {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span></div>
                    <div style={{ fontSize: "18px", color: "#636977" }}>{r.game} · {r.pos} · Danger {Math.round(r.dangerRate * 100)}%</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}><TagPill tag={r.compositeTag} /><TagPill tag={r.goalTag} /><TagPill tag={r.shotTag} /></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#b45309" }}>{Math.round(r.p1g * 100)}% 1G</div>
                    <div style={{ fontSize: "18px", color: "#636977" }}>{Math.round(r.p2g * 100)}% 2G</div>
                  </div>
                </div>
                <div style={{ marginTop: "8px" }}><BulletList items={buildBoardBulletPoints(r, "goals")} color="#373449" fontSize="17px" tight /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}




function DefenseRoleProfiles({ data }) {
  const [mode, setMode] = React.useState("shots");

  const teamCards = useMemo(() => {
    const grouped = new Map();

    data.forEach((r) => {
      const tk = normTeam(r.opponent || "");
      if (!tk) return;
      if (!grouped.has(tk)) {
        grouped.set(tk, {
          teamKey: tk,
          team: TEAM_SHORT[tk] || r.opponent || tk,
          rows: [],
        });
      }
      grouped.get(tk).rows.push(r);
    });

    const rankProb = (row, key) => row?.[key] || 0;
    const dedupeByPlayer = (rows) => {
      const seen = new Set();
      return rows.filter((r) => {
        const k = `${r.name}|${r.team}|${r.currentRole || r.pos}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    return Array.from(grouped.values()).map((card) => {
      const rows = card.rows;
      const byStrength = [...rows].sort((a, b) => (b.environmentScore || 0) - (a.environmentScore || 0));

      const topShots = dedupeByPlayer(
        [...rows]
          .map((r) => enrichBoardTags(r))
          .filter((r) => includeTopBoardRow(r, 'shots'))
          .sort((a, b) => scoreTopBoardRow(b, 'shots') - scoreTopBoardRow(a, 'shots'))
      ).slice(0, 3);

      const topPoints = dedupeByPlayer(
        [...rows]
          .map((r) => enrichBoardTags(r))
          .filter((r) => includeTopBoardRow(r, 'points'))
          .sort((a, b) => scoreTopBoardRow(b, 'points') - scoreTopBoardRow(a, 'points'))
      ).slice(0, 3);

      const topGoals = dedupeByPlayer(
        [...rows]
          .map((r) => enrichBoardTags(r))
          .filter((r) => includeTopBoardRow(r, 'goals'))
          .sort((a, b) => scoreTopBoardRow(b, 'goals') - scoreTopBoardRow(a, 'goals'))
      ).slice(0, 3);

      const roleSignals = (() => {
        const counts = {};
        rows.forEach((r) => {
          const role = (r.currentRole || `${r.pos}${r.todayLine || ""}`).toUpperCase();
          if (!counts[role]) counts[role] = { role, n: 0, shots: 0, points: 0, goals: 0 };
          counts[role].n += 1;
          counts[role].shots += (r.p4s || 0) * 0.65 + (r.p3s || 0) * 0.35;
          counts[role].points += (r.p1p || 0) * 0.75 + (r.p2p || 0) * 0.25;
          counts[role].goals += (r.p1g || 0) * 0.8 + (r.p2g || 0) * 0.2;
        });
        const arr = Object.values(counts).map((x) => ({
          role: x.role,
          shots: x.shots / Math.max(1, x.n),
          points: x.points / Math.max(1, x.n),
          goals: x.goals / Math.max(1, x.n),
        }));
        const bestShots = [...arr].sort((a,b)=>b.shots-a.shots)[0];
        const bestPoints = [...arr].sort((a,b)=>b.points-a.points)[0];
        const bestGoals = [...arr].sort((a,b)=>b.goals-a.goals)[0];
        return {
          shots: bestShots && bestShots.shots >= 0.42 ? `${bestShots.role} is the best shots fit` : "No clear shots role edge",
          points: bestPoints && bestPoints.points >= 0.48 ? `${bestPoints.role} is the best points fit` : "No clear points role edge",
          goals: bestGoals && bestGoals.goals >= 0.18 ? `${bestGoals.role} is the best goals fit` : "No clear goals role edge",
        };
      })();

      return {
        ...card,
        environmentScore: byStrength[0]?.environmentScore || 0,
        roleSignals,
        topShots,
        topPoints,
        topGoals,
      };
    }).sort((a, b) => (b.environmentScore || 0) - (a.environmentScore || 0));
  }, [data]);

  const sectionMeta = {
    shots: { title: "Shots profile", color: "#15803d", key: "topShots", signal: "shots" },
    points: { title: "Points profile", color: "#2563eb", key: "topPoints", signal: "points" },
    goals: { title: "Goals profile", color: "#b45309", key: "topGoals", signal: "goals" },
  };

  const renderFitCard = (row, kind) => {
    const prob = kind === "shots"
      ? Math.max(row.p4s || 0, row.p3s || 0)
      : kind === "points"
      ? Math.max(row.p1p || 0, row.p2p || 0)
      : Math.max(row.p1g || 0, row.p2g || 0);
    const label = kind === "shots"
      ? `${Math.round((row.p4s || 0) * 100)}% 4+`
      : kind === "points"
      ? `${Math.round((row.p1p || 0) * 100)}% 1+P`
      : `${Math.round((row.p1g || 0) * 100)}% 1G`;

    return (
      <div key={`${kind}-${row.name}-${row.team}-${row.currentRole || row.pos}`} style={{ background: "#fff", border: "1px solid #e9e8f3", borderRadius: "10px", padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#05011c" }}>
            {row.name} <span style={{ color: "#636977", fontWeight: 600 }}>{row.currentRole || row.pos}</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 800, color: prob >= 0.5 ? "#15803d" : prob >= 0.35 ? "#b45309" : "#636977" }}>
            {label}
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#636977", marginTop: "4px", lineHeight: 1.45 }}>
          {row.team} · Signal {row.signalScore ?? "—"} · {row.featureSummary || row.selectionRationale || "No note"}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e9e8f3", borderRadius: "16px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
        <div>
          <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "18px", fontWeight: 800, color: "#05011c", marginBottom: "4px" }}>
            Defense Role Profiles
          </div>
          <div style={{ fontSize: "13px", color: "#636977" }}>
            Slate-aware and lineup-aware. Uses today&apos;s lineup role as the source of truth.
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["shots", "points", "goals"].map((key) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: `1px solid ${mode === key ? sectionMeta[key].color : "#e9e8f3"}`,
                background: mode === key ? `${sectionMeta[key].color}18` : "#fff",
                color: mode === key ? sectionMeta[key].color : "#636977",
                fontFamily: "'Outfit Variable','Outfit',sans-serif",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {sectionMeta[key].title}
            </button>
          ))}
        </div>
      </div>

      {!teamCards.length && (
        <div style={{ fontSize: "13px", color: "#80828d", marginBottom: "10px" }}>
          No opponent cards available for the current slate.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
        {teamCards.map((card) => {
          const meta = sectionMeta[mode];
          const rows = card[meta.key] || [];
          return (
            <div key={card.teamKey} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "16px", fontWeight: 800, color: "#05011c", marginBottom: "4px" }}>
                {card.team}
              </div>
              <div style={{ fontSize: "12px", color: "#636977", marginBottom: "10px" }}>
                {card.roleSignals[meta.signal]}
              </div>

              <div style={{ background: "#fff", border: "1px solid #e9e8f3", borderRadius: "10px", padding: "10px 12px", marginBottom: "10px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: meta.color, marginBottom: "6px", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>
                  {meta.title}
                </div>
                {rows.length ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {rows.map((row) => renderFitCard(row, meta.signal))}
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "#80828d" }}>No current fits cleared the model threshold.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── BET IDEAS ────────────────────────────────────────────────────────────────

function parlayProb(legs) {
  return legs.reduce((acc, p) => acc * p, 1);
}

function BetCard({ title, subtitle, legs, combinedProb, type, note }) {
  const pct = Math.round(combinedProb * 100);
  const typeColor = type === "sgp" ? { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8", tag: "SGP" }
    : type === "parlay" ? { bg: "#fdf4ff", border: "#e9d5ff", label: "#7c3aed", tag: "PARLAY" }
    : { bg: "#f0fdf4", border: "#bbf7d0", label: "#15803d", tag: "SINGLE" };

  const probColor = pct >= 60 ? "#15803d" : pct >= 45 ? "#b45309" : "#c2410c";

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${typeColor.border}`,
      borderRadius: "14px",
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <span style={{
              fontSize: "15px", fontWeight: 800, fontFamily: "'Outfit Variable','Outfit',sans-serif",
              background: typeColor.bg, color: typeColor.label,
              border: `1px solid ${typeColor.border}`,
              padding: "2px 7px", borderRadius: "999px", letterSpacing: "0.08em",
            }}>{typeColor.tag}</span>
            <span style={{ fontSize: "20px", fontWeight: 800, color: "#05011c", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>{title}</span>
          </div>
          {subtitle && <div style={{ fontSize: "16px", color: "#636977" }}>{subtitle}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "33px", fontWeight: 900, fontFamily: "'Outfit Variable','Outfit',sans-serif", color: probColor, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: "14px", color: "#80828d", textTransform: "uppercase", letterSpacing: "0.06em" }}>model prob</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {legs.map((leg, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#f8fafb", borderRadius: "8px", padding: "6px 10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#373449" }}>{leg.player}</span>
              <span style={{ fontSize: "15px", color: "#80828d" }}>{leg.team} · {leg.pos}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "#636977" }}>{leg.prop}</span>
              <span style={{
                fontSize: "18px", fontWeight: 900, fontFamily: "'Outfit Variable','Outfit',sans-serif",
                color: leg.prob >= 0.6 ? "#15803d" : leg.prob >= 0.4 ? "#b45309" : "#c2410c",
              }}>{Math.round(leg.prob * 100)}%</span>
            </div>
          </div>
        ))}
      </div>

      {note && (
        <div style={{ fontSize: "15px", color: "#636977", fontStyle: "italic", borderTop: "1px solid #f2f2f8", paddingTop: "6px" }}>
          💡 {note}
        </div>
      )}
    </div>
  );
}

function BetIdeas({ data }) {
  const [minProb, setMinProb] = React.useState(45);
  const [activeSection, setActiveSection] = React.useState("all");

  // ── Singles: best single-leg bets across all players ──
  const singles = React.useMemo(() => {
    const candidates = [];
    for (const r of data) {
      if (!r.gateOpen) continue;
      const props = [
        { prop: "3+ Shots", prob: r.p3s },
        { prop: "4+ Shots", prob: r.p4s },
        { prop: "5+ Shots", prob: r.p5s },
        { prop: "1+ Point", prob: r.p1p },
        { prop: "2+ Points", prob: r.p2p },
        { prop: "1+ Goal", prob: r.p1g },
        { prop: "2+ Goals", prob: r.p2g },
      ];
      for (const { prop, prob } of props) {
        if (!prob || prob < minProb / 100) continue;
        candidates.push({
          type: "single",
          title: `${r.name} — ${prop}`,
          subtitle: `${r.game} · ${r.isHome ? "Home" : "Away"} · TOI ${r.effectiveToi ?? r.playerToi}m · Signal ${r.signalScore ?? "—"}`,
          legs: [{ player: r.name, team: r.team, pos: r.pos, prop, prob }],
          combinedProb: prob,
          note: r.featureSummary,
          signal: r.signalScore ?? 0,
        });
      }
    }
    return candidates.sort((a, b) => b.combinedProb - a.combinedProb).slice(0, 20);
  }, [data, minProb]);

  // ── SGPs: best 2–3 leg same-game parlays ──
  const sgps = React.useMemo(() => {
    const byGame = {};
    for (const r of data) {
      if (!r.gateOpen) continue;
      if (!byGame[r.game]) byGame[r.game] = [];
      byGame[r.game].push(r);
    }

    const results = [];
    for (const [game, players] of Object.entries(byGame)) {
      // Sort by signal within each game
      const top = [...players].sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0)).slice(0, 8);

      // 2-leg SGPs: best prob pair from different players
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          const a = top[i], b = top[j];
          const aBest = getBestLeg(a);
          const bBest = getBestLeg(b);
          if (!aBest || !bBest) continue;
          const prob = parlayProb([aBest.prob, bBest.prob]);
          if (prob < minProb / 100) continue;
          results.push({
            type: "sgp",
            title: `${game}`,
            subtitle: "2-Leg Same Game Parlay",
            legs: [
              { player: a.name, team: a.team, pos: a.pos, prop: aBest.prop, prob: aBest.prob },
              { player: b.name, team: b.team, pos: b.pos, prop: bBest.prop, prob: bBest.prob },
            ],
            combinedProb: prob,
            note: `${a.name} Signal ${a.signalScore ?? "—"} · ${b.name} Signal ${b.signalScore ?? "—"}`,
          });
        }
      }

      // 3-leg SGPs: best prob trio
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          for (let k = j + 1; k < top.length; k++) {
            const a = top[i], b = top[j], c = top[k];
            const aBest = getBestLeg(a);
            const bBest = getBestLeg(b);
            const cBest = getBestLeg(c);
            if (!aBest || !bBest || !cBest) continue;
            const prob = parlayProb([aBest.prob, bBest.prob, cBest.prob]);
            if (prob < 0.25) continue; // 3-leggers need at least 25%
            results.push({
              type: "sgp",
              title: `${game}`,
              subtitle: "3-Leg Same Game Parlay",
              legs: [
                { player: a.name, team: a.team, pos: a.pos, prop: aBest.prop, prob: aBest.prob },
                { player: b.name, team: b.team, pos: b.pos, prop: bBest.prop, prob: bBest.prob },
                { player: c.name, team: c.team, pos: c.pos, prop: cBest.prop, prob: cBest.prob },
              ],
              combinedProb: prob,
              note: null,
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.combinedProb - a.combinedProb).slice(0, 20);
  }, [data, minProb]);

  // ── Cross-game parlays: 2–3 legs from different games ──
  const parlays = React.useMemo(() => {
    // Pick top candidate per game (highest signal, gate open)
    const topPerGame = {};
    for (const r of data) {
      if (!r.gateOpen) continue;
      const leg = getBestLeg(r);
      if (!leg || leg.prob < 0.55) continue;
      if (!topPerGame[r.game] || (r.signalScore ?? 0) > (topPerGame[r.game].signal ?? 0)) {
        topPerGame[r.game] = { ...r, bestLeg: leg, signal: r.signalScore ?? 0 };
      }
    }

    const pool = Object.values(topPerGame).sort((a, b) => b.bestLeg.prob - a.bestLeg.prob);
    const results = [];

    // 2-leg cross-game
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i], b = pool[j];
        const prob = parlayProb([a.bestLeg.prob, b.bestLeg.prob]);
        if (prob < minProb / 100) continue;
        results.push({
          type: "parlay",
          title: "2-Game Parlay",
          subtitle: `${a.game} + ${b.game}`,
          legs: [
            { player: a.name, team: a.team, pos: a.pos, prop: a.bestLeg.prop, prob: a.bestLeg.prob },
            { player: b.name, team: b.team, pos: b.pos, prop: b.bestLeg.prop, prob: b.bestLeg.prob },
          ],
          combinedProb: prob,
          note: `Both gate open · Signals ${a.signal} & ${b.signal}`,
        });
      }
    }

    // 3-leg cross-game
    for (let i = 0; i < Math.min(pool.length, 8); i++) {
      for (let j = i + 1; j < Math.min(pool.length, 8); j++) {
        for (let k = j + 1; k < Math.min(pool.length, 8); k++) {
          const a = pool[i], b = pool[j], c = pool[k];
          const prob = parlayProb([a.bestLeg.prob, b.bestLeg.prob, c.bestLeg.prob]);
          if (prob < 0.25) continue;
          results.push({
            type: "parlay",
            title: "3-Game Parlay",
            subtitle: `${a.game} + ${b.game} + ${c.game}`,
            legs: [
              { player: a.name, team: a.team, pos: a.pos, prop: a.bestLeg.prop, prob: a.bestLeg.prob },
              { player: b.name, team: b.team, pos: b.pos, prop: b.bestLeg.prop, prob: b.bestLeg.prob },
              { player: c.name, team: c.team, pos: c.pos, prop: c.bestLeg.prop, prob: c.bestLeg.prob },
            ],
            combinedProb: prob,
            note: `All gate open`,
          });
        }
      }
    }

    return results.sort((a, b) => b.combinedProb - a.combinedProb).slice(0, 20);
  }, [data, minProb]);

  const sections = [
    { key: "all", label: "All Ideas", count: singles.length + sgps.length + parlays.length },
    { key: "singles", label: "Singles", count: singles.length },
    { key: "sgp", label: "Same Game Parlays", count: sgps.length },
    { key: "parlays", label: "Cross-Game Parlays", count: parlays.length },
  ];

  const displayed = activeSection === "singles" ? singles
    : activeSection === "sgp" ? sgps
    : activeSection === "parlays" ? parlays
    : [...singles, ...sgps, ...parlays].sort((a, b) => b.combinedProb - a.combinedProb).slice(0, 40);

  return (
    <div>
      {/* Header controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "16px", color: "#4b4a5c", whiteSpace: "nowrap" }}>Min Model Prob</span>
          <input
            type="number" min="20" max="90" value={minProb}
            onChange={(e) => setMinProb(Number(e.target.value))}
            style={{ width: "52px", background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "8px", color: "#26262c", padding: "7px 8px", fontSize: "20px", outline: "none", textAlign: "center" }}
          />
          <span style={{ fontSize: "16px", color: "#80828d" }}>%</span>
        </div>
        <div style={{ fontSize: "16px", color: "#80828d", fontStyle: "italic" }}>
          Gate-open players only · Probabilities are model estimates, not odds
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
        {sections.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
            padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "18px",
            fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 700,
            border: `1px solid ${activeSection === s.key ? "#16a34a" : "#e9e8f3"}`,
            background: activeSection === s.key ? "#dcfce7" : "#fff",
            color: activeSection === s.key ? "#15803d" : "#636977",
          }}>
            {s.label} <span style={{ opacity: 0.6 }}>({s.count})</span>
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {displayed.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#80828d", fontSize: "20px" }}>
          No ideas meet the {minProb}% threshold. Try lowering it.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "12px" }}>
          {displayed.map((idea, i) => (
            <BetCard key={i} {...idea} />
          ))}
        </div>
      )}

      <div style={{ marginTop: "16px", fontSize: "15px", color: "#80828d", textAlign: "center" }}>
        ⚠ Model probabilities only. Always verify lines at your sportsbook. Past performance doesn&apos;t guarantee future results.
      </div>
    </div>
  );
}

function getBestLeg(r) {
  const options = [
    { prop: "3+ Shots", prob: r.p3s },
    { prop: "4+ Shots", prob: r.p4s },
    { prop: "1+ Point", prob: r.p1p },
    { prop: "1+ Goal", prob: r.p1g },
    { prop: "5+ Shots", prob: r.p5s },
    { prop: "2+ Points", prob: r.p2p },
  ].filter((o) => o.prob > 0).sort((a, b) => b.prob - a.prob);
  return options[0] || null;
}

// ─── BETTING GUIDE ───────────────────────────────────────────────────────────

function GuideSection({ icon, title, accent, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${accent}33`, borderLeft: `4px solid ${accent}`, borderRadius: "10px", padding: "14px 16px" }}>
      <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 800, fontSize: "22px", color: accent, marginBottom: "10px" }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function ThreshRow({ label, tiers }) {
  const colors = {
    strong: { bg: "#dcfce7", fg: "#15803d" },
    playable: { bg: "#fef9c3", fg: "#b45309" },
    thin: { bg: "#ffedd5", fg: "#c2410c" },
    avoid: { bg: "#fee2e2", fg: "#991b1b" },
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "18px", fontWeight: 700, color: "#05011c", minWidth: "80px", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>{label}</span>
      {tiers.map((t, i) => (
        <span key={i} style={{
          fontSize: "16px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px",
          background: colors[t.type]?.bg || "#f2f2f8",
          color: colors[t.type]?.fg || "#636977",
        }}>{t.label}</span>
      ))}
    </div>
  );
}

function BettingGuide() {
  return (
    <div style={{ display: "grid", gap: "12px" }}>

      {/* Header */}
      <div style={{ background: "#05011c", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 900, fontSize: "30px", color: "#fff", letterSpacing: "0.05em" }}>BETTING GUIDE</div>
          <div style={{ fontSize: "16px", color: "#80828d", marginTop: "2px" }}>Model thresholds · Decision framework · Trap rules</div>
        </div>
        <div style={{ fontSize: "42px" }}>🎯</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

        {/* SHOTS */}
        <GuideSection icon="🎯" title="1. SHOTS — Primary Edge (Most Stable)" accent="#15803d">
          <ThreshRow label="3+ SOG" tiers={[{label:"≥65% → Strong play",type:"strong"},{label:"58–64% → Parlay anchor",type:"playable"},{label:"52–57% → Thin",type:"thin"}]} />
          <ThreshRow label="4+ SOG" tiers={[{label:"≥50% → Strong",type:"strong"},{label:"45–49% → Playable",type:"playable"},{label:"40–44% → Thin edge",type:"thin"}]} />
          <ThreshRow label="5+ SOG" tiers={[{label:"≥35% → Elite shooters only",type:"thin"},{label:"<35% → Noise",type:"avoid"}]} />
          <div style={{ fontSize: "16px", color: "#636977", marginTop: "8px", fontStyle: "italic" }}>Shots are volume-driven → iFF model is strongest here. Start here.</div>
        </GuideSection>

        {/* POINTS */}
        <GuideSection icon="🎯" title="2. POINTS — Core Signal Layer" accent="#2563eb">
          <ThreshRow label="1+ Point" tiers={[{label:"≥55% → Strong",type:"strong"},{label:"50–54% → Playable",type:"playable"},{label:"<50% → Avoid standalone",type:"avoid"}]} />
          <ThreshRow label="2+ Points" tiers={[{label:"≥30% → Strong ceiling",type:"strong"},{label:"25–29% → Good parlay piece",type:"playable"},{label:"<25% → Too thin",type:"avoid"}]} />
          <div style={{ fontSize: "16px", color: "#991b1b", marginTop: "8px", fontWeight: 700 }}>⚠ Critical: If 1P is weak → ignore ALL goal outputs, no matter what.</div>
        </GuideSection>

        {/* GOALS */}
        <GuideSection icon="🎯" title="3. GOALS — Derived, Volatile" accent="#b45309">
          <ThreshRow label="1+ Goal" tiers={[{label:"≥33% → Strong",type:"strong"},{label:"28–32% → Playable",type:"playable"},{label:"24–27% → Thin",type:"thin"},{label:"<24% → Ignore",type:"avoid"}]} />
          <ThreshRow label="2+ Goals" tiers={[{label:"≥14% → Legit ceiling",type:"playable"},{label:"10–13% → Long-shot sprinkle",type:"thin"},{label:"<10% → Noise",type:"avoid"}]} />
          <ThreshRow label="3+ Goals" tiers={[{label:"Almost always ignore pre-game",type:"avoid"},{label:"React live only",type:"avoid"}]} />
        </GuideSection>

        {/* KEY FILTER */}
        <GuideSection icon="🔥" title="4. KEY FILTER — Before Any Goal Bet" accent="#dc2626">
          <div style={{ fontSize: "18px", color: "#373449", marginBottom: "8px", fontWeight: 700 }}>You need ALL THREE:</div>
          {[
            { check: "✅", label: "1P ≥ 50%" },
            { check: "✅", label: "iSCF/G strong (≥ ~2.0)" },
            { check: "✅", label: "TOI ≥ ~16 min" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", background: "#fef2f2", borderRadius: "6px", padding: "5px 10px" }}>
              <span style={{ fontSize: "20px" }}>{r.check}</span>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#05011c" }}>{r.label}</span>
            </div>
          ))}
          <div style={{ fontSize: "16px", color: "#dc2626", marginTop: "8px", fontWeight: 700 }}>If one is missing → probability is inflated noise.</div>
        </GuideSection>

        {/* TRAP RULE */}
        <GuideSection icon="⚠️" title="5. TRAPS — What Not To Do" accent="#7c3aed">
          <div style={{ fontSize: "18px", color: "#373449", marginBottom: "8px" }}>Avoid these mistakes:</div>
          {[
            "Taking goals just because % looks high",
            "Ignoring the points layer",
            "Treating all 30% goal probabilities equally",
          ].map((t, i) => (
            <div key={i} style={{ fontSize: "18px", color: "#dc2626", marginBottom: "4px" }}>✗ {t}</div>
          ))}
          <div style={{ marginTop: "10px", background: "#f5f3ff", borderRadius: "8px", padding: "10px 12px" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#7c3aed", marginBottom: "4px" }}>Example</div>
            <div style={{ fontSize: "18px", color: "#373449" }}>30% goal + 55% 1P → <span style={{ color: "#15803d", fontWeight: 700 }}>GOOD ✅</span></div>
            <div style={{ fontSize: "18px", color: "#373449" }}>30% goal + 44% 1P → <span style={{ color: "#dc2626", fontWeight: 700 }}>TRAP ❌</span></div>
          </div>
        </GuideSection>

        {/* STACK */}
        <GuideSection icon="🧠" title="6. How To Use It — Simple Stack" accent="#0369a1">
          {[
            { step: "Step 1", label: "Lock Shots", items: ["3+ SOG ≥ 60%", "4+ SOG ≥ 45%"] },
            { step: "Step 2", label: "Filter Scorers", items: ["1P ≥ 55%", "Then check 1G ≥ 30%"] },
            { step: "Step 3", label: "Ceiling Adds", items: ["2P ≥ 28%", "2G ≥ 12%"] },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "15px", fontWeight: 800, background: "#dbeafe", color: "#1d4ed8", padding: "3px 7px", borderRadius: "999px", whiteSpace: "nowrap", fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>{s.step}</span>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#05011c", marginBottom: "2px" }}>{s.label}</div>
                {s.items.map((item, j) => <div key={j} style={{ fontSize: "16px", color: "#373449" }}>→ {item}</div>)}
              </div>
            </div>
          ))}
        </GuideSection>
      </div>

      {/* Bottom line */}
      <div style={{ background: "#05011c", borderRadius: "12px", padding: "16px 20px" }}>
        <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: 900, fontSize: "24px", color: "#22c55e", marginBottom: "8px" }}>🧾 BOTTOM LINE — One Clean Rule</div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { label: "1P ≥ 55%", color: "#22c55e" },
            { label: "1G ≥ 30%", color: "#22c55e" },
            { label: "iFF ≥ ~3.0 OR S/G ≥ ~2.5", color: "#22c55e" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#22c55e", fontSize: "21px" }}>✅</span>
              <span style={{ fontSize: "20px", fontWeight: 700, color: r.color, fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>{r.label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "16px", color: "#636977", marginTop: "8px" }}>Everything else is noise. Only bet goals when all three are present.</div>
      </div>

      {/* Clamp note */}
      <GuideSection icon="🧪" title="7. Clamp Calibration Note" accent="#636977">
        <div style={{ fontSize: "18px", color: "#373449", marginBottom: "6px" }}>Current clamp: <code style={{ background: "#f2f2f8", padding: "2px 5px", borderRadius: "4px" }}>1G ≤ 1P × 0.78</code></div>
        <div style={{ fontSize: "18px", color: "#373449", marginBottom: "4px" }}>More realistic NHL baseline: <strong>1G ≈ 0.55–0.65 of 1P</strong></div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "16px", color: "#dc2626" }}>→ Too many false positives? Lower to 0.65</div>
          <div style={{ fontSize: "16px", color: "#15803d" }}>→ Too few scorers surfacing? Keep 0.78</div>
        </div>
      </GuideSection>

    </div>
  );
}

function CheatTable({ headers, rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "18px" }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                textAlign: "left",
                padding: "10px",
                borderBottom: "1px solid #e9e8f3",
                color: "#636977",
                fontSize: "18px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {row.map((cell, cIdx) => (
              <td
                key={cIdx}
                style={{
                  padding: "10px",
                  borderBottom: "1px solid #fbfcfd",
                  color: cIdx === 0 ? "#05011c" : "#373449",
                  fontWeight: cIdx === 0 ? 700 : 500,
                  verticalAlign: "top",
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModelCheatSheet({ data }) {
  const [cheatTab, setCheatTab] = useState("guide");

  const defenseRows = [
    ["Leak score", "85+ = elite lane", "75–84 = strong lane", "< 75 = not a pure lane by itself"],
    ["Environment score", "82+ = top environment", "72–81 = positive", "< 72 = needs stronger player fit"],
    ["Shot lane state", "Open = 1.10x lane opp.", "Neutral = 1.00x", "Suppressed = 0.90x"],
    ["Goal lane state", "Open = 1.12x lane opp.", "Neutral = 1.00x", "Suppressed = 0.88x"],
  ];

  const paceRows = [
    ["Shots", "Elite pace: 1.075+ → 1.18x", "High pace: 1.035–1.074 → 1.10x", "Low pace: ≤ 0.965 → 0.90x"],
    ["Points", "Elite pace: 1.10x", "High pace: 1.05x", "Low pace: 0.93x"],
    ["Goals", "Elite pace: 1.05x", "High pace: 1.02x", "Low pace: 0.95x"],
  ];

  const styleRows = [
    ["Shooter", "Shots primary", "Shots ↑, goals slightly damped", "Best 4+/5+ path when TOI + iFF are there"],
    ["Shooter-Finisher", "Shots primary", "Shots + goals both live", "Best mixed shot/goal archetype"],
    ["Playmaker", "Points primary", "Shots capped hard", "Needs point lane; weak 4+/5+ path"],
    ["Playmaker-Shooter", "Points primary", "Points first, shots secondary", "Can support 3+, not automatic 4+"],
    ["Finisher", "Goals primary", "Shots damped, goals boosted", "Good 1G path, thin shot ceiling"],
    ["Finisher-Low Volume", "Goals primary", "Shots heavily capped", "Use for goal looks, not shot ladders"],
  ];

  const shotGateRows = [
    ["Elite shooter", "F: TOI 18+ · S/G 3.0+ · iFF 4.6+ | D: TOI 22.5+ · S/G 2.2+ · iFF 3.3+", "Unlocks strongest 4+/5+ path"],
    ["Strong shooter", "F: TOI 16+ · S/G 2.3+ · iFF 3.6+ | D: TOI 20+ · S/G 1.8+ · iFF 2.7+", "Keeps 3+ / 4+ live"],
    ["Playmaker drag", "Playmaker style", "4+ and 5+ capped down materially"],
    ["Finisher drag", "Finisher / low-volume finisher without strong shooter profile", "Shots damped; goal market preferred"],
  ];

  const floorRows = [
    ["Shot floor profile", "Elite: score 0.93+", "Good: 0.72–0.92", "Average: 0.50–0.71", "Weak: < 0.50"],
    ["Goal floor profile", "Elite: score 0.95+", "Good: 0.72–0.94", "Average: 0.52–0.71", "Weak: < 0.52"],
  ];

  const fourPlusRows = [
    ["Forwards elite 4+", "TOI 18.5+ · S/G 3.1+ · iFF 4.5+", "Best direct 4+ / 5+ gate"],
    ["Forwards Tier A 4+", "TOI 17.5+ · S/G 2.7+ · iFF 4.2+ + support (iCF 5.5+ or iSCF 2.1+)", "Strong 4+ path"],
    ["Forwards Tier B 4+", "TOI 17.5+ · S/G 2.7+ · iFF 3.9–4.19 + iCF 6.0+ + iSCF 2.3+", "Borderline but live"],
    ["Defense role path", "D top-2 pair · TOI 22+ · S/G 2.2+ · iCF 5.0+ · (iFF 3.0+ or iSCF 1.0+) + open env", "4+ viable only through role + environment"],
    ["5+ gate", "Needs elite 4+ path or explosion ceiling", "Never treat 5+ as independent from 4+"],
  ];

  const hotRows = [
    ["Shot spike", "L5 S/G ≥ season × 1.22 or +0.45 (F) / +0.25 (D)", "Counts as hot-role signal"],
    ["iFF spike", "L5 iFF ≥ season × 1.20 or +0.70 (F) / +0.45 (D)", "Counts as hot-role signal"],
    ["Danger spike", "L5 iSCF ≥ season × 1.16 or +0.28 (F) / +0.18 (D)", "Counts as hot-role signal"],
    ["Goal spike", "L5 G/G ≥ season × 1.35 or +0.16 (F) / +0.05 (D)", "Counts as hot-role signal"],
    ["Signals needed", "Strong matchup: 2", "Neutral matchup: 3", "Bad matchup: 4"],
  ];

  const goalRows = [
    ["Goal opportunity λ", "Base λ × compressed defense × role × venue × history × role-adj", "Main goal engine"],
    ["Finisher profile", "Built from scorer tier + goal share of points + danger + conversion + recent goals", "Caps how much opportunity turns into goals"],
    ["Anytime goal cap", "L1 max ~0.48 · L2 max ~0.36 · depth max ~0.24 · D max ~0.18", "Hard-capped by role/position"],
    ["2+ goal cap", "L1 max ~0.12 · L2 max ~0.08 · depth max ~0.045 · D max ~0.024", "Ceiling only, not default play"],
    ["Rank penalty", "Top defensive teams/lanes compress 1G and 2G", "Prevents weak leaks from inflating goals"],
  ];

  const historyRows = [
    ["Role history", "Use role venue sample first", "C1/C2/LW1/RW2 etc. matter more than broad position", ""],
    ["History support", "3+ support: ~40%+ on real sample", "4+ support: ~25%+ on real sample", "1G support: ~18%+ on real sample"],
    ["Priority rule", "Cheat-sheet creates possibility", "Role history decides whether it is actually repeatable", ""],
  ];

  const examples = data
    ? {
        shotNames: data
          .filter((r) => (r.p4s || 0) >= 0.25 || (r.p5s || 0) >= 0.10)
          .sort((a, b) => ((b.p4s || 0) + (b.p5s || 0)) - ((a.p4s || 0) + (a.p5s || 0)))
          .slice(0, 6)
          .map((r) => `${r.name} (${Math.round((r.p4s || 0) * 100)}% 4+)`)
          .join(", "),
        goalNames: data
          .filter((r) => (r.p1g || 0) >= 0.16)
          .sort((a, b) => (b.p1g || 0) - (a.p1g || 0))
          .slice(0, 6)
          .map((r) => `${r.name} (${Math.round((r.p1g || 0) * 100)}% 1G)`)
          .join(", "),
        hotNames: data
          .filter((r) => r.hotRoleLabel || (r.hotRoleScore || 0) >= 2)
          .slice(0, 6)
          .map((r) => `${r.name}${r.hotRoleLabel ? ` · ${r.hotRoleLabel}` : ""}`)
          .join(", "),
      }
    : null;


  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[["guide", "🧠 Betting Guide"], ["params", "⚙️ Model Params"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCheatTab(key)}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "'Outfit Variable','Outfit',sans-serif",
              fontWeight: 700,
              fontSize: "20px",
              border: `1px solid ${cheatTab === key ? "#16a34a" : "#e9e8f3"}`,
              background: cheatTab === key ? "#dcfce7" : "#fff",
              color: cheatTab === key ? "#15803d" : "#636977",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {cheatTab === "guide" && <BettingGuide />}

      {cheatTab === "params" && (
        <div style={{ background: "#ffffff", border: "1px solid #e9e8f3", borderRadius: "16px", padding: "18px" }}>
          <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "36px", fontWeight: 800, color: "#05011c", marginBottom: "4px" }}>
            Model cheat tab
          </div>
          <div style={{ fontSize: "21px", color: "#636977", marginBottom: "14px" }}>
            Updated to match the live engine: style gating, pace tiers, hot-role overrides, 4+ shot gate logic, and the compressed goal pipeline.
          </div>

          {examples && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
                <div style={{ fontWeight: 700, color: "#166534", marginBottom: "6px" }}>Current 4+ / 5+ shot names</div>
                <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.6 }}>{examples.shotNames || "No current strong shot ladders."}</div>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
                <div style={{ fontWeight: 700, color: "#b45309", marginBottom: "6px" }}>Current goal names</div>
                <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.6 }}>{examples.goalNames || "No current strong goal names."}</div>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
                <div style={{ fontWeight: 700, color: "#2563eb", marginBottom: "6px" }}>Current hot-role names</div>
                <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.6 }}>{examples.hotNames || "No current hot-role signals."}</div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>Defense lane thresholds</div>
              <CheatTable headers={["Metric", "Strong", "Neutral", "Fade"]} rows={defenseRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#0f766e", marginBottom: "8px" }}>Pace tier logic</div>
              <CheatTable headers={["Market", "Fast", "Positive", "Slow"]} rows={paceRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#7c3aed", marginBottom: "8px" }}>Capability styles</div>
              <CheatTable headers={["Style", "Primary market", "Engine effect", "Read"]} rows={styleRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>Shot gate logic</div>
              <CheatTable headers={["Path", "Trigger", "What it means"]} rows={shotGateRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>Player floor profiles</div>
              <CheatTable headers={["Profile", "Elite", "Good", "Average", "Weak"]} rows={floorRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>4+ / 5+ shot gate</div>
              <CheatTable headers={["Path", "Threshold", "Use"]} rows={fourPlusRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#2563eb", marginBottom: "8px" }}>Hot-role override</div>
              <CheatTable headers={["Signal", "Rule", "Effect"]} rows={hotRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#b45309", marginBottom: "8px" }}>Goal engine</div>
              <CheatTable headers={["Component", "Logic", "Why it matters"]} rows={goalRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#2563eb", marginBottom: "8px" }}>History priority</div>
              <CheatTable headers={["Layer", "Primary read", "Secondary read", "Note"]} rows={historyRows} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", marginTop: "14px" }}>
            <SummaryCard
              title="Fast read for shots"
              body="Start with style + shot floor + 4+ gate. Then confirm pace tier, lane state, and role history. A player can show a soft matchup and still fail 4+ if the shot gate is not open."
            />
            <SummaryCard
              title="Fast read for goals"
              body="Start with archetype. Finishers and shooter-finishers convert goal environments much better than pure shooters or playmakers. Then confirm the compressed goal pipeline and line/position cap."
              accent="#b45309"
            />
            <SummaryCard
              title="Fast read for hot roles"
              body="Use hot-role only when the player has multiple real L5 spikes and the matchup is at least neutral. Hot role is a boost layer, not a replacement for the main shot/goal gates."
              accent="#2563eb"
            />
          </div>
        </div>
      )}
    </div>
  );
}


// ─── UPLOAD CARD ─────────────────────────────────────────────────────────────


function computeGoalieBoards(data) {
  const gameMap = {};

  data.forEach((r) => {
    if (!gameMap[r.game]) gameMap[r.game] = {};
    if (!gameMap[r.game][r.team]) {
      gameMap[r.game][r.team] = {
        team: r.team,
        opponent: r.opponent,
        game: r.game,
        shots: 0,
        goals: 0,
        iff: 0,
        weightedDanger: 0,
        weightedConv: 0,
        weightedPace: 0,
        edgeMass: 0,
        players: [],
      };
    }

    const t = gameMap[r.game][r.team];
    t.shots += r.lambdaS || 0;
    t.goals += r.lambdaG || 0;
    t.iff += r.iffBlend || 0;
    t.weightedDanger += (r.dangerRate || 0) * Math.max(0.5, r.lambdaS || 0);
    t.weightedConv += (r.shotConv || 0) * Math.max(0.5, r.lambdaS || 0);
    t.weightedPace += (r.paceMult || 1) * Math.max(0.5, r.lambdaS || 0);
    t.edgeMass += r.signalScore || 0;
    t.players.push(r);
  });

  const boards = [];
  const saveLines = [24.5, 26.5, 28.5, 30.5, 32.5];

  Object.values(gameMap).forEach((teamMap) => {
    const teams = Object.values(teamMap);
    if (teams.length < 2) return;

    teams.forEach((offense) => {
      const againstGoalie = teams.find((t) => t.team !== offense.team);
      if (!againstGoalie) return;

      const shots = offense.shots;
      const weightedDen = Math.max(1, shots);
      const avgDanger = offense.weightedDanger / weightedDen;
      const avgConv = offense.weightedConv / weightedDen;
      const avgPace = offense.weightedPace / weightedDen;
      const quickGoalPct = clamp(0.075 + avgDanger * 0.055 + Math.max(0, avgConv - 0.66) * 0.05, 0.075, 0.14);
      const quickGoals = shots * quickGoalPct;
      const quickSaves = Math.max(0, shots - quickGoals);
      const modelSaves = Math.max(0, shots - offense.goals);
      const blendedSaves = 0.7 * modelSaves + 0.3 * quickSaves;
      const pressureScore = Math.round(
        Math.min(100, (shots / 36) * 50) +
        Math.min(25, Math.max(0, (avgPace - 0.95) * 100)) +
        Math.min(25, Math.max(0, againstGoalie.edgeMass / Math.max(6, againstGoalie.players.length) - 45))
      );
      const overLines = saveLines.map((line) => {
        const needed = Math.floor(line) + 1;
        const prob = poissonAtLeast(blendedSaves, needed);
        return {
          line,
          needed,
          prob,
          edge: +(blendedSaves - line).toFixed(1),
        };
      }).sort((a, b) => (b.signal + b.prob * 8) - (a.signal + a.prob * 8));

      const bestLine = overLines[0];

      boards.push({
        game: offense.game,
        offensiveTeam: offense.team,
        goalieTeam: againstGoalie.team,
        goalieLabel: `${againstGoalie.team} goalie`,
        expectedShotsAgainst: +shots.toFixed(1),
        expectedGoalsAllowed: +offense.goals.toFixed(2),
        modelSaves: +modelSaves.toFixed(1),
        quickSaves: +quickSaves.toFixed(1),
        blendedSaves: +blendedSaves.toFixed(1),
        avgDanger: +avgDanger.toFixed(3),
        avgConv: +avgConv.toFixed(3),
        avgPace: +avgPace.toFixed(3),
        pressureScore,
        bestLine,
        overLines,
        attackDrivers: offense.players
          .slice()
          .sort((a, b) => (b.lambdaS + b.signalScore * 0.02) - (a.lambdaS + a.signalScore * 0.02))
          .slice(0, 4)
          .map((r) => `${r.name} ${r.venue} ${r.lambdaS.toFixed(1)} SOG`),
      });
    });
  });

  return boards.sort((a, b) => (b.blendedSaves + b.pressureScore * 0.02) - (a.blendedSaves + a.pressureScore * 0.02));
}

function GoalieSavesBoard({ data }) {
    const boards = useMemo(() => computeGoalieBoards(data), [data]);
  const topCards = boards.slice(0, 8);

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        <SummaryCard
          title="Top blended saves"
          body={boards[0] ? `${boards[0].goalieLabel} projects for ${boards[0].blendedSaves} saves in ${boards[0].game}.` : "Run the model to see save projections."}
          accent="#2563eb"
        />
        <SummaryCard
          title="Quick shortcut formula"
          body="Projected saves ≈ opponent projected shots − shortcut goals. Shortcut goals are driven by danger rate and shot conversion, so high-volume but low-danger offenses create the cleanest saves overs."
          accent="#0f766e"
        />
        <SummaryCard
          title="Best use case"
          body="Save overs are strongest when a team projects for 30+ shots, pace is at least neutral, and the offense has enough volume without elite finishing efficiency."
          accent="#7c3aed"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px" }}>
        {topCards.map((g) => (
          <div key={`${g.game}-${g.goalieTeam}`} style={{ background: "#ffffff", border: "1px solid #e9e8f3", borderRadius: "16px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
              <div>
                <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "33px", fontWeight: 800, color: "#05011c" }}>
                  {g.goalieLabel}
                </div>
                <div style={{ fontSize: "18px", color: "#636977" }}>{g.game} · facing {g.offensiveTeam}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: "42px", color: "#2563eb" }}>{g.blendedSaves}</div>
                <div style={{ fontSize: "18px", color: "#636977" }}>blended saves</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "10px", padding: "10px" }}>
                <div style={{ fontSize: "16px", color: "#636977", textTransform: "uppercase", letterSpacing: "0.06em" }}>Shots against</div>
                <div style={{ fontWeight: 800, color: "#05011c" }}>{g.expectedShotsAgainst}</div>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "10px", padding: "10px" }}>
                <div style={{ fontSize: "16px", color: "#636977", textTransform: "uppercase", letterSpacing: "0.06em" }}>Model saves</div>
                <div style={{ fontWeight: 800, color: "#05011c" }}>{g.modelSaves}</div>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "10px", padding: "10px" }}>
                <div style={{ fontSize: "16px", color: "#636977", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pressure</div>
                <div style={{ fontWeight: 800, color: g.pressureScore >= 70 ? "#15803d" : g.pressureScore >= 55 ? "#b45309" : "#373449" }}>{g.pressureScore}</div>
              </div>
            </div>

            <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.65, marginBottom: "10px" }}>
              Best save line: <strong>Over {g.bestLine.line}</strong> · prob <strong>{Math.round(g.bestLine.prob * 100)}%</strong> · signal <strong>{g.bestLine.signal > 0 ? "+" : ""}{g.bestLine.edge}</strong>
            </div>

            <div style={{ fontSize: "18px", color: "#373449", lineHeight: 1.6, marginBottom: "10px" }}>
              Drivers: {g.attackDrivers.join(" · ")}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {g.overLines.slice(0, 4).map((line) => (
                <div key={`${g.game}-${g.goalieTeam}-${line.line}`} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "6px 10px", fontSize: "18px", color: "#1d4ed8", fontWeight: 700 }}>
                  O{line.line} {Math.round(line.prob * 100)}%
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export const NHL_UPLOAD_SLOTS = [
  { key: "season", title: "Season Matchups", sub: "NHL-Goal-Matchups-*.xlsx · season skater stats", accent: "#6633ee", required: true },
  { key: "l5", title: "L5 Matchups", sub: "NHL-Goal-Matchups-* (L5).xlsx · last 5 games", accent: "#6633ee", required: true },
  { key: "hist", title: "Historical Profiles", sub: "NHL_Player_History_vs_Teams.xlsx", accent: "#d97706" },
  { key: "playerStats", title: "Home / Away Stats", sub: "Player stats *.xlsx", accent: "#7c3aed" },
  { key: "lineups", title: "Today's Lineups", sub: "Lineups *.xlsx", accent: "#0284c7" },
  { key: "pace", title: "Pace Stats", sub: "MoneyPuck team pace (auto) · or NHL Pace Stats.xlsx", accent: "#0284c7" },
  { key: "rankings", title: "Defense Rankings", sub: "NHL-Defense-Rankings-2026.xlsx", accent: "#7c3aed" },
  { key: "boxScores", title: "Box Scores", sub: "Box Scores *.xlsx · unlocks Audit View", accent: "#dc2626" },
];

// Compact, JSON-safe description of a run for Run History.

function readBinaryString(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = (e) => res(e.target.result);
    fr.onerror = (e) => rej(new Error(`FileReader error reading ${file.name}: ${e.target?.error?.message || "unknown"}`));
    fr.readAsBinaryString(file);
  });
}

function UploadCard({ slot, file, onFile, disabled, auto }) {
  const [over, setOver] = useState(false);
  const inputId = `nhlx-upload-${slot.key}`;
  return (
    <label
      htmlFor={inputId}
      className={`nhlx-upload${file ? " is-filled" : ""}${over ? " is-over" : ""}${auto ? " is-auto" : ""}`}
      style={{ "--slot-accent": slot.accent }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer?.files?.[0];
        if (f && !disabled) onFile(slot.key, f);
      }}
    >
      <span className="nhlx-upload-tag">{auto ? "Auto · NHL data" : slot.required ? "Required" : "Optional"}</span>
      <span className="nhlx-upload-title">{slot.title}</span>
      <span className="nhlx-upload-sub">{slot.sub}</span>
      <span className="nhlx-upload-drop">
        {file ? (
          <>
            <span className="nhlx-upload-check" aria-hidden>✓</span>
            <span className="nhlx-upload-name">{file.name}</span>
          </>
        ) : (
          "Drop file or click to upload"
        )}
      </span>
      <input
        id={inputId}
        type="file"
        accept=".xlsx,.xls"
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(slot.key, f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

const CORE_SLOTS = new Set(["season", "l5", "hist", "playerStats", "lineups", "pace"]);

// ─── MAIN MODEL ──────────────────────────────────────────────────────────────
//
// loadRequest: { id, files: { slot: File }, runId } — replays a saved slate.
// onRunComplete({ files, results, matchups, runId }) — fired after each run.
// onFileAdded(slot, file) — fired when an input is added after a run.

export default function NhlModel({ loadRequest = null, onRunComplete, onFileAdded, onFilesChange, statusSlot = null, autoSlots = null }) {
  const [files, setFiles] = useState({});
  const [actualResults, setActualResults] = useState({});
  const [rankingsData, setRankingsData] = useState(null);
  const [results, setResults] = useState(null);
  const [matchups, setMatchups] = useState([]);
  const [gameLabels, setGameLabels] = useState([]);
  const [hasHist, setHasHist] = useState(false);
  const [hasPace, setHasPace] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);
  const resultsRef = useRef(results);
  useEffect(() => { resultsRef.current = results; }, [results]);

  const parseSideFile = useCallback(async (slot, f) => {
    if (slot === "rankings") {
      try {
        const wb = await readWorkbook(f);
        setRankingsData(parseRankingsFile(wb));
      } catch (err) {
        setError(`Rankings file parse error: ${err.message || "unknown"}`);
      }
    }
    if (slot === "boxScores") {
      try {
        const wb = await readWorkbook(f);
        setActualResults(parseBoxScoresWorkbook(wb) || {});
      } catch (err) {
        setError(`Box score parse error: ${err.message || "unknown"}`);
        setActualResults({});
      }
    }
  }, []);

  const onFile = useCallback((slot, f) => {
    setError("");
    const next = { ...filesRef.current, [slot]: f };
    filesRef.current = next;
    setFiles(next);
    onFilesChange?.(next);
    if (CORE_SLOTS.has(slot)) {
      setResults(null);
      setMatchups([]);
    }
    parseSideFile(slot, f);
    if (!CORE_SLOTS.has(slot) && resultsRef.current) onFileAdded?.(slot, f);
  }, [parseSideFile, onFileAdded, onFilesChange]);

  const run = useCallback(async (override = null) => {
    const fs = override?.files || filesRef.current;
    if (!fs.season || !fs.l5) {
      setError("Upload both matchup files (Season + L5) first.");
      return;
    }
    setLoading(true);
    setError("");
    setResults(null);
    setMatchups([]);

    try {
      const [wbS, wbL, wbH] = await Promise.all([
        readWorkbook(fs.season),
        readWorkbook(fs.l5),
        fs.hist ? readWorkbook(fs.hist) : Promise.resolve(null),
      ]);
      const games = parseMatchups(wbS, wbL);
      setMatchups(games);

      const playerHomeAway = fs.playerStats ? parsePlayerHomeAway(await readBinaryString(fs.playerStats)) : null;
      const lineupData = fs.lineups ? parseLineups(await readBinaryString(fs.lineups)) : null;

      let histProfiles = null;
      if (wbH) {
        try {
          histProfiles = parseHistoricalProfiles(wbH, playerHomeAway);
        } catch (he) {
          console.warn("History file parse failed:", he);
          setError(`Warning: history file couldn't be parsed (${he.message || "unknown error"}) — running without it.`);
        }
      }

      const paceData = fs.pace ? parsePaceWorkbook(await readBinaryString(fs.pace), games) : null;
      const projected = buildProjections(games, histProfiles, playerHomeAway, lineupData, paceData);

      setResults(projected);
      setShowInputs(false);
      setGameLabels(games.map((g) => g.label));
      setHasHist(!!(histProfiles && (histProfiles.profiles || histProfiles)));
      setHasPace(!!paceData);
      onRunComplete?.({ files: fs, results: projected, summary: { ...summarizeRun(fs, projected, games), ...(override?.meta || {}) }, runId: override?.runId || null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setError(`Error: ${msg || "Unknown error — check console"}`);
      console.error("Run error:", e);
    } finally {
      setLoading(false);
    }
  }, [onRunComplete]);

  // Replay a saved slate from Run History. `loadRequest` is a one-off command
  // from the parent (nonce in `at`), so the resets and the run happen here.
  useEffect(() => {
    if (!loadRequest?.files) return;
    const fs = loadRequest.files;
    filesRef.current = fs;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the workbench for a replayed run is the command itself, not derived state
    setFiles(fs);
    onFilesChange?.(fs);
    setRankingsData(null);
    setActualResults({});
    setActiveView("dashboard");
    if (fs.rankings) parseSideFile("rankings", fs.rankings);
    if (fs.boxScores) parseSideFile("boxScores", fs.boxScores);
    if (loadRequest.run === false) {
      setResults(null);
      setMatchups([]);
      return;
    }
    run({ files: fs, runId: loadRequest.runId, meta: loadRequest.meta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRequest]);

  const canRun = !!(files.season && files.l5);
  const loadedCount = NHL_UPLOAD_SLOTS.filter((x) => files[x.key]).length;
  const hasAudit = Object.keys(actualResults || {}).length > 0;

  const views = [
    ["dashboard", "Dashboard"],
    ["best", "Best by Game"],
    ["goalies", "Goalie Saves"],
    ["players", "All Players"],
    ["roles", "Defense Roles"],
    ["cheat", "Cheat Sheet"],
    ["bets", "Bet Ideas"],
    ...(hasAudit ? [["audit", "Audit View"]] : []),
  ];

  return (
    <div className="nhlx-model">
      <style>{css}</style>

      <details
        className="nhlx-inputs"
        open={showInputs}
        onToggle={(e) => setShowInputs(e.currentTarget.open)}
      >
        <summary className="nhlx-inputs-summary">
          <span className="nhlx-inputs-title">Model inputs</span>
          <span className="nhlx-inputs-count">{loadedCount}/{NHL_UPLOAD_SLOTS.length} loaded</span>
          <span className="nhlx-inputs-chips">
            {NHL_UPLOAD_SLOTS.map((slot) => (
              <span key={slot.key} className={`nhlx-inputs-chip${files[slot.key] ? " is-on" : ""}`}>{slot.title}</span>
            ))}
          </span>
          <span className="nhlx-inputs-toggle">{showInputs ? "Hide" : "Show / replace files"}</span>
        </summary>
        <div className="nhlx-upload-grid">
          {NHL_UPLOAD_SLOTS.map((slot) => (
            <UploadCard key={slot.key} slot={slot} file={files[slot.key]} onFile={onFile} disabled={loading} auto={!!(autoSlots && autoSlots[slot.key] && files[slot.key] === autoSlots[slot.key])} />
          ))}
        </div>
      </details>

      {error && <div className="nhlx-alert" role="alert">⚠ {error}</div>}

      <div className="nhlx-run-row">
        <button type="button" className={results ? "nhlx-btn nhlx-btn-ghost nhlx-btn-sm" : "nhlx-btn nhlx-btn-run"} onClick={() => run()} disabled={loading || !canRun}>
          {loading ? "Computing…" : results ? "Re-run model" : "Run Prop Model"}
        </button>
        {statusSlot}
      </div>

      {results && (
        <div className="fade-up" id="nhlx-results">
          <div className="nhlx-slate-strip">
            <span className="nhlx-slate-label">Tonight</span>
            <span className="nhlx-slate-games">{gameLabels.join(" · ")}</span>
            {hasHist && <span className="nhlx-chip nhlx-chip-amber">Historical profiles</span>}
            {hasPace && <span className="nhlx-chip nhlx-chip-blue">Pace active</span>}
            {rankingsData && <span className="nhlx-chip nhlx-chip-violet">Defense rankings</span>}
          </div>

          <div className="nhlx-tabs" role="tablist">
            {views.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeView === key}
                className={`nhlx-tab${activeView === key ? " is-active" : ""}`}
                onClick={() => setActiveView(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="nhlx-view">
            {activeView === "dashboard" && (
              <>
                <OverallBestBets data={results} />
                <ConclusionBoard data={results} />
                <BestByGame data={results} />
                <GoalieSavesBoard data={results} />
              </>
            )}
            {activeView === "best" && <BestByGame data={results} />}
            {activeView === "goalies" && <GoalieSavesBoard data={results} />}
            {activeView === "players" && (
              <>
                <OverallBestBets data={results} />
                <ResultsTable data={results} hasHist={hasHist} matchups={matchups} rankingsData={rankingsData} />
              </>
            )}
            {activeView === "roles" && <DefenseRoleProfiles data={results} />}
            {activeView === "cheat" && <ModelCheatSheet data={results} />}
            {activeView === "bets" && <BetIdeas data={results} />}
            {activeView === "audit" && <AuditView data={results} actualResults={actualResults} />}
          </div>
        </div>
      )}
    </div>
  );
}
