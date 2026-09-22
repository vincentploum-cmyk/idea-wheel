'use client';

// NHL Prop Probability Model — ported from Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx
// and restyled to the Flowbit theme used on ideareels.io. Model logic is unchanged.

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

// ─── POISSON ─────────────────────────────────────────────────────────────────

function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function poissonAtLeast(lambda, n) {
  if (n <= 0) return 1;
  let cumulative = 0;
  for (let k = 0; k < n; k++) cumulative += poissonPMF(lambda, k);
  return Math.max(0, Math.min(1, 1 - cumulative));
}

// ─── TEAM NORMALIZATION ──────────────────────────────────────────────────────

const TEAM_ALIASES = {
  "maple leafs": "toronto",
  "toronto maple leafs": "toronto",
  "golden knights": "vegas",
  "vegas golden knights": "vegas",
  "red wings": "detroit",
  "detroit red wings": "detroit",
  "blue jackets": "cbj",
  "columbus blue jackets": "cbj",
  "new jersey devils": "devils",

  // short team names as they appear in defBlock headers (e.g. "Blackhawks Defense")
  blackhawks: "chicago",
  panthers: "florida",
  predators: "nashville",
  avalanche: "colorado",
  "maple leafs": "toronto",
  oilers: "oilers",
  flames: "flames",
  canucks: "canucks",
  kraken: "kraken",
  sharks: "sharks",
  ducks: "ducks",
  kings: "kings",
  mammoth: "mammoth",
  senators: "senators",
  sabres: "sabres",
  bruins: "bruins",
  canadiens: "canadiens",
  rangers: "rangers",
  islanders: "islanders",
  flyers: "flyers",
  capitals: "capitals",
  penguins: "penguins",
  lightning: "lightning",
  hurricanes: "hurricanes",
  stars: "stars",
  jets: "jets",
  blues: "blues",
  wild: "wild",
  devils: "devils",

  // common abbreviations / short forms
  tor: "toronto",
  nyi: "islanders",
  sea: "kraken",
  ana: "ducks",
  bos: "bruins",
  buf: "sabres",
  car: "hurricanes",
  cbj: "cbj",
  cgy: "flames",
  chi: "chicago",
  col: "colorado",
  dal: "stars",
  det: "detroit",
  edm: "oilers",
  fla: "florida",
  lak: "kings",
  la: "kings",
  min: "wild",
  mtl: "canadiens",
  nj: "devils",
  njd: "devils",
  nsh: "nashville",
  ott: "senators",
  phi: "flyers",
  pit: "penguins",
  sj: "sharks",
  sjs: "sharks",
  stl: "blues",
  tb: "lightning",
  tbl: "lightning",
  vgs: "vegas",
  vgk: "vegas",
  van: "canucks",
  wpg: "jets",
  wsh: "capitals",
  uta: "mammoth",
  utah: "mammoth",
  nyr: "rangers",
  "new york rangers": "rangers",
  "new york islanders": "islanders",
  "los angeles kings": "kings",
  "st. louis blues": "blues",
  "st louis blues": "blues",
  "colorado avalanche": "colorado",
  "calgary flames": "flames",
  "edmonton oilers": "oilers",
  "vancouver canucks": "canucks",
  "seattle kraken": "kraken",
  "anaheim ducks": "ducks",
  "san jose sharks": "sharks",
  "chicago blackhawks": "chicago",
  "minnesota wild": "wild",
  "dallas stars": "stars",
  "nashville predators": "nashville",
  "winnipeg jets": "jets",
  "montreal canadiens": "canadiens",
  "ottawa senators": "senators",
  "buffalo sabres": "sabres",
  "boston bruins": "bruins",
  "philadelphia flyers": "flyers",
  "washington capitals": "capitals",
  "pittsburgh penguins": "penguins",
  "florida panthers": "florida",
  "tampa bay lightning": "lightning",
  "carolina hurricanes": "hurricanes",
  "utah mammoth": "mammoth",
};

function normTeam(name) {
  if (!name) return "";
  const l = String(name).toLowerCase().trim();
  return TEAM_ALIASES[l] || l;
}

const TEAM_SHORT = {
  "maple leafs": "Maple Leafs",
  "toronto maple leafs": "Maple Leafs",
  rangers: "Rangers",
  "new york rangers": "Rangers",
  panthers: "Panthers",
  "florida panthers": "Panthers",
  "blue jackets": "Blue Jackets",
  "columbus blue jackets": "Blue Jackets",
  mammoth: "Mammoth",
  "utah mammoth": "Mammoth",
  flyers: "Flyers",
  "philadelphia flyers": "Flyers",
  sabres: "Sabres",
  "buffalo sabres": "Sabres",
  penguins: "Penguins",
  "pittsburgh penguins": "Penguins",
  lightning: "Lightning",
  "tampa bay lightning": "Lightning",
  jets: "Jets",
  "winnipeg jets": "Jets",
  bruins: "Bruins",
  "boston bruins": "Bruins",
  predators: "Predators",
  "nashville predators": "Predators",
  senators: "Senators",
  "ottawa senators": "Senators",
  flames: "Flames",
  "calgary flames": "Flames",
  islanders: "Islanders",
  "new york islanders": "Islanders",
  kings: "Kings",
  "los angeles kings": "Kings",
  oilers: "Oilers",
  "edmonton oilers": "Oilers",
  canucks: "Canucks",
  "vancouver canucks": "Canucks",
  wild: "Wild",
  "minnesota wild": "Wild",
  ducks: "Ducks",
  "anaheim ducks": "Ducks",
  sharks: "Sharks",
  "san jose sharks": "Sharks",
  devils: "Devils",
  "new jersey devils": "Devils",
  capitals: "Capitals",
  "washington capitals": "Capitals",
  blackhawks: "Blackhawks",
  "chicago blackhawks": "Blackhawks",
  avalanche: "Avalanche",
  "colorado avalanche": "Avalanche",
  "red wings": "Red Wings",
  "detroit red wings": "Red Wings",
  "golden knights": "Golden Knights",
  "vegas golden knights": "Golden Knights",
  kraken: "Kraken",
  "seattle kraken": "Kraken",
  hurricanes: "Hurricanes",
  "carolina hurricanes": "Hurricanes",
  stars: "Stars",
  "dallas stars": "Stars",
  blues: "Blues",
  "st. louis blues": "Blues",
  "st louis blues": "Blues",
  canadiens: "Canadiens",
  "montreal canadiens": "Canadiens",
};

function normShort(name) {
  if (!name) return "";
  const key = String(name).toLowerCase().trim();
  return TEAM_SHORT[key] || name;
}


const TEAM_LOGO_ABBR = {
  toronto: "TOR",
  rangers: "NYR",
  florida: "FLA",
  panthers: "FLA",
  cbj: "CBJ",
  mammoth: "UTA",
  utah: "UTA",
  flyers: "PHI",
  sabres: "BUF",
  penguins: "PIT",
  lightning: "TBL",
  jets: "WPG",
  bruins: "BOS",
  nashville: "NSH",
  predators: "NSH",
  senators: "OTT",
  flames: "CGY",
  islanders: "NYI",
  kings: "LAK",
  oilers: "EDM",
  canucks: "VAN",
  capitals: "WSH",
  hurricanes: "CAR",
  ducks: "ANA",
  sharks: "SJS",
  devils: "NJD",
  blackhawks: "CHI",
  chicago: "CHI",
  avalanche: "COL",
  colorado: "COL",
  "red wings": "DET",
  detroit: "DET",
  kraken: "SEA",
  stars: "DAL",
  blues: "STL",
  canadiens: "MTL",
  wild: "MIN",
  vegas: "VGK",
  "golden knights": "VGK",
};

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

// ─── PARSE RANKINGS FILE ─────────────────────────────────────────────────────
// Reads NHL-Defense-Rankings-2026.xlsx (tabs: All, RW, LW, C, D)
// Returns: { All: { "florida": { goalsRank:1, ... }, ... }, RW: {...}, ... }

function parseRankingsFile(wb) {
  const tabs = ["All", "RW", "LW", "C", "D"];
  const result = {};

  for (const sheetName of tabs) {
    if (!wb.Sheets[sheetName]) continue;
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    const teamRanks = {};

    // Find header row (contains "Team")
    let headerRow = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && raw[i].some((c) => String(c || "").trim() === "Team")) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) continue;

    const headers = raw[headerRow].map((h) => String(h || "").trim());
    const idx = (name) => headers.indexOf(name);

    const teamCol       = idx("Team");
    const rankGoals     = idx("Goals/G Rank");
    const rankAssists   = idx("Assists/G Rank");
    const rankShots     = idx("Shots/G Rank");
    const rankIcf       = idx("iCF/G Rank");
    const rankIff       = idx("iFF/G Rank");
    const rankIscf      = idx("iSCF/G Rank");

    for (let i = headerRow + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || !row[teamCol]) continue;
      const team = String(row[teamCol]).trim();
      if (!team || team === "null") continue;
      const tk = normTeam(team);
      if (!tk) continue;
      teamRanks[tk] = {
        goalsRank:   parseInt(row[rankGoals],   10) || null,
        assistsRank: parseInt(row[rankAssists], 10) || null,
        shotsRank:   parseInt(row[rankShots],   10) || null,
        icfRank:     parseInt(row[rankIcf],     10) || null,
        iffRank:     parseInt(row[rankIff],     10) || null,
        iscfRank:    parseInt(row[rankIscf],    10) || null,
      };
    }
    result[sheetName] = teamRanks;
  }
  return result;
}

// ─── PARSE MATCHUPS ──────────────────────────────────────────────────────────
// Defense block columns:
// 0=POSITION, 1=GOALS/G, 2=ASSISTS/G, 3=SHOTS/G, 4=ICF/G, 5=IFF/G, 6=ISCF/G
// Skater block columns:
// 0=Player, 1=Pos, 2=GP, 3=TOI/G, 4=Goals/G, 5=AST/G, 6=Shots/G, 7=iCF/G, 8=iFF/G, 9=iSCF/G


function parseMatchups(wbSeason, wbL5) {
  function parseSheet(wb, sn) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
      header: 1,
      defval: null,
    });

    const defBlocks = [];
    const skaterBlocks = [];
    let i = 0;

    while (i < raw.length) {
      const row = raw[i];
      const cell = row && row[0] ? String(row[0]).trim() : "";

      if (!cell) {
        i++;
        continue;
      }

      if (cell.includes("Defense (Last") || cell.includes("Defense (Season")) {
        const team = cell.replace(/\s*Defense.*/, "").trim();
        i += 2;
        const posStats = {};
        const VALID_POS = new Set(["D","C","RW","LW","ALL"]);

        while (i < raw.length && raw[i] && raw[i][0]) {
          const pos = String(raw[i][0]).trim().toUpperCase();
          // Stop if we hit a section header (Skaters, Defense) or an unrecognised position
          if (!VALID_POS.has(pos)) break;
          const pf = (v) => { const n = parseFloat(String(v ?? "").trim()); return isNaN(n) ? 0 : n; };
          posStats[pos] = {
            goalsAllowed: pf(raw[i][1]),
            assistsAllowed: pf(raw[i][2]),
            shotsAllowed: pf(raw[i][3]),
            icfAllowed: pf(raw[i][4]),
            iffAllowed: pf(raw[i][5]),
            iscfAllowed: pf(raw[i][6]),
            ranks: {
              goals: parseInt(raw[i][8], 10) || null,
              assists: parseInt(raw[i][9], 10) || null,
              shots: parseInt(raw[i][10], 10) || null,
              icf: parseInt(raw[i][11], 10) || null,
              iff: parseInt(raw[i][12], 10) || null,
              iscf: parseInt(raw[i][13], 10) || null,
            },
          };
          i++;
        }

        defBlocks.push({ team, posStats });
        continue;
      }

      if (cell.includes("Skaters (")) {
        const team = cell.replace(/\s*Skaters.*/, "").trim();
        i += 2;
        const players = [];

        while (i < raw.length && raw[i] && raw[i][0]) {
          const pos = String(raw[i][1] || "").trim().toUpperCase();

          if (pos && pos !== "G") {
            players.push({
              name: String(raw[i][0]).trim(),
              pos,
              gp: parseFloat(raw[i][2]) || 0,
              toi: parseFloat(raw[i][3]) || 0,
              goals: parseFloat(raw[i][4]) || 0,
              assists: parseFloat(raw[i][5]) || 0,
              shots: parseFloat(raw[i][6]) || 0,
              icf: parseFloat(raw[i][7]) || 0,
              iff: parseFloat(raw[i][8]) || 0,
              iscf: parseFloat(raw[i][9]) || 0,
            });
          }

          i++;
        }

        skaterBlocks.push({ team, players });
        continue;
      }

      i++;
    }

    return { defBlocks, skaterBlocks };
  }

  function buildLabel(sn, season) {
    if (/^.+@.+$/.test(sn)) return sn;
    const teams = [
      ...season.skaterBlocks.map((x) => x.team),
      ...season.defBlocks.map((x) => x.team),
    ].filter(Boolean);
    const uniq = [...new Set(teams)];
    if (uniq.length >= 2) return `${uniq[0]} @ ${uniq[1]}`;
    return sn;
  }

  const games = [];

  for (const sn of wbSeason.SheetNames) {
    const season = parseSheet(wbSeason, sn);
    if (!season.defBlocks.length || !season.skaterBlocks.length) continue;

    const l5 = parseSheet(wbL5, sn);

    const l5Map = {};
    for (const sb of l5.skaterBlocks) {
      for (const p of sb.players) {
        l5Map[p.name.toLowerCase()] = {
          toi: p.toi,
          goals: p.goals,
          assists: p.assists,
          shots: p.shots,
          icf: p.icf,
          iff: p.iff,
          iscf: p.iscf,
          gp: p.gp,
        };
      }
    }

    const label = buildLabel(sn, season);
    const labelTeams = label.includes("@")
      ? label.split("@").map((x) => normTeam(x.trim()))
      : [];
    const defBlocks = season.defBlocks;

    const annotated = season.skaterBlocks.map((sb) => {
      let oppDef = null;
      const sbKey = normTeam(sb.team);

      if (labelTeams.length === 2) {
        // Find which label team is NOT the skater's team
        const oppKey = labelTeams.find((t) => t !== sbKey);
        oppDef =
          defBlocks.find((db) => normTeam(db.team) === oppKey) ||
          defBlocks.find((db) => normTeam(db.team) !== sbKey) ||
          null;
      }

      if (!oppDef) {
        oppDef =
          defBlocks.find((db) => normTeam(db.team) !== sbKey) || null;
      }

      return {
        ...sb,
        oppDef,
        players: sb.players.map((p) => {
          const l5p = l5Map[p.name.toLowerCase()] || {};
          return {
            ...p,
            iffSeason: p.iff,
            icfSeason: p.icf,
            iscfSeason: p.iscf,
            goalsSeason: p.goals,
            astSeason: p.assists,
            shotsSeason: p.shots,
            toiSeason: p.toi,
            iffL5: l5p.iff ?? p.iff,
            icfL5: l5p.icf ?? p.icf,
            iscfL5: l5p.iscf ?? p.iscf,
            goalsL5: l5p.goals ?? p.goals,
            astL5: l5p.assists ?? p.assists,
            shotsL5: l5p.shots ?? p.shots,
            toiL5: l5p.toi ?? p.toi,
            gpL5: l5p.gp ?? 0,
          };
        }),
      };
    });

    games.push({ label, defBlocks, skaterBlocks: annotated });
  }

  return games;
}


// ─── PARSE HISTORICAL PROFILES ───────────────────────────────────────────────

const POSITIONS = ["C", "LW", "RW", "D"];

const PLAYER_NAME_ALIASES = {
  "jakob chychrun": "jakub chychrun",
  "jakub chychrun": "jakub chychrun",
  "rickard rakell": "rickard rakell",
  "richard rakell": "rickard rakell",
};

function normalizePlayerName(name) {
  if (!name) return "";
  const normalized = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:C|LW|RW|D)\b$/i, "")
    .replace(/\b(?:JR|SR|III|II|IV)\b/gi, "")
    .replace(/[-]/g, " ")
    .replace(/[.,'’‘`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return PLAYER_NAME_ALIASES[normalized] || normalized;
}

function normalizeName(name) {
  return normalizePlayerName(name);
}

function summarizeRecentVenueForm(games) {
  const n = games.length;
  const rate = (fn) => (n ? games.filter(fn).length / n : null);
  const s3 = rate((g) => (g.shots || 0) >= 3);
  const s4 = rate((g) => (g.shots || 0) >= 4);
  const s5 = rate((g) => (g.shots || 0) >= 5);
  const p1 = rate((g) => (g.points || 0) >= 1);
  const g1 = rate((g) => (g.goals || 0) >= 1);
  let tag = "Neutral";
  if (n >= 4) {
    if ((s4 ?? 0) >= 0.5 || (s5 ?? 0) >= 0.3 || ((s3 ?? 0) >= 0.7 && (s4 ?? 0) >= 0.4)) tag = "Hot";
    else if ((s4 ?? 0) < 0.3 && (s3 ?? 0) < 0.5) tag = "Cold";
  }
  return { n, s3, s4, s5, p1, g1, tag };
}

function buildVenueTrendImpact(form) {
  if (!form || !form.n) return { shotMult: 1, pointMult: 1, goalMult: 1, label: "Neutral", reason: "No venue sample" };
  let shotMult = 1;
  let pointMult = 1;
  let goalMult = 1;
  const s3 = form.s3 || 0;
  const s4 = form.s4 || 0;
  const s5 = form.s5 || 0;
  const p1 = form.p1 || 0;
  const g1 = form.g1 || 0;
  if (form.tag === "Hot") {
    shotMult = 1 + Math.min(0.11, Math.max(0, (s4 - 0.45) * 0.18 + (s5 - 0.2) * 0.08));
    pointMult = 1 + Math.min(0.06, Math.max(0, (p1 - 0.5) * 0.12));
    goalMult = 1 + Math.min(0.05, Math.max(0, (g1 - 0.22) * 0.10));
  } else if (form.tag === "Cold") {
    shotMult = 1 - Math.min(0.10, Math.max(0, (0.3 - s4) * 0.2 + (0.5 - s3) * 0.08));
    pointMult = 1 - Math.min(0.06, Math.max(0, (0.45 - p1) * 0.10));
    goalMult = 1 - Math.min(0.05, Math.max(0, (0.18 - g1) * 0.10));
  }
  return {
    shotMult: clamp(shotMult, 0.9, 1.12),
    pointMult: clamp(pointMult, 0.94, 1.06),
    goalMult: clamp(goalMult, 0.95, 1.05),
    label: form.tag,
    reason: `${Math.round(s3 * 100)}% 3+ · ${Math.round(s4 * 100)}% 4+ · ${Math.round(s5 * 100)}% 5+`
  };
}

function parseHistoricalProfiles(wb, playerHomeAway = null) {
  function parseSheetName(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return null;

    if (POSITIONS.includes(parts[0].toUpperCase())) {
      return { pos: parts[0].toUpperCase(), team: parts.slice(1).join(" ") };
    }

    if (POSITIONS.includes(parts[parts.length - 1].toUpperCase())) {
      return {
        pos: parts[parts.length - 1].toUpperCase(),
        team: parts.slice(0, -1).join(" "),
      };
    }

    return null;
  }

  function buildLastNGamesSummary(recs, n = 7) {
    const avg = (arr) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const games = [...(recs || [])]
      .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))
      .slice(0, n);
    if (!games.length) return null;
    return {
      n: games.length,
      avgS: +avg(games.map((r) => r.shots)).toFixed(2),
      avgG: +avg(games.map((r) => r.goals)).toFixed(3),
    };
  }

  function buildPropProfiles(recs) {
    const avg = (arr) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const propDefs = [
      { key: "s3", col: "shots", thresh: 3 },
      { key: "s4", col: "shots", thresh: 4 },
      { key: "s5", col: "shots", thresh: 5 },
      { key: "p1", col: "points", thresh: 1 },
      { key: "p2", col: "points", thresh: 2 },
      { key: "g1", col: "goals", thresh: 1 },
      { key: "g2", col: "goals", thresh: 2 },
    ];

    const result = {};

    for (const { key, col, thresh } of propDefs) {
      const achievers = recs.filter((r) => r[col] >= thresh);
      if (!achievers.length) continue;

      result[key] = {
        n: achievers.length,
        total: recs.length,
        hitRate: achievers.length / recs.length,
        avgToi: +avg(achievers.map((r) => r.toi)).toFixed(1),
        minToi: +Math.min(...achievers.map((r) => r.toi)).toFixed(1),
        avgShots: +avg(achievers.map((r) => r.shots)).toFixed(2),
        avgGoals: +avg(achievers.map((r) => r.goals)).toFixed(3),
        avgPoints: +avg(achievers.map((r) => r.points)).toFixed(3),
      };
    }

    result._venue = {
      n: recs.length,
      avgS: +avg(recs.map((r) => r.shots)).toFixed(2),
      avgG: +avg(recs.map((r) => r.goals)).toFixed(3),
      avgP: +avg(recs.map((r) => r.points)).toFixed(3),
      avgT: +avg(recs.map((r) => r.toi)).toFixed(1),
      s3Rate: recs.length ? recs.filter((r) => r.shots >= 3).length / recs.length : 0,
      s4Rate: recs.length ? recs.filter((r) => r.shots >= 4).length / recs.length : 0,
      s5Rate: recs.length ? recs.filter((r) => r.shots >= 5).length / recs.length : 0,
      p1Rate: recs.length ? recs.filter((r) => r.points >= 1).length / recs.length : 0,
      p2Rate: recs.length ? recs.filter((r) => r.points >= 2).length / recs.length : 0,
      g1Rate: recs.length ? recs.filter((r) => r.goals >= 1).length / recs.length : 0,
      g2Rate: recs.length ? recs.filter((r) => r.goals >= 2).length / recs.length : 0,
      toiS3: recs.filter((r) => r.shots >= 3).length ? +avg(recs.filter((r) => r.shots >= 3).map((r) => r.toi)).toFixed(1) : null,
      toiS4: recs.filter((r) => r.shots >= 4).length ? +avg(recs.filter((r) => r.shots >= 4).map((r) => r.toi)).toFixed(1) : null,
      toiS5: recs.filter((r) => r.shots >= 5).length ? +avg(recs.filter((r) => r.shots >= 5).map((r) => r.toi)).toFixed(1) : null,
      toiP1: recs.filter((r) => r.points >= 1).length ? +avg(recs.filter((r) => r.points >= 1).map((r) => r.toi)).toFixed(1) : null,
      toiP2: recs.filter((r) => r.points >= 2).length ? +avg(recs.filter((r) => r.points >= 2).map((r) => r.toi)).toFixed(1) : null,
      toiG1: recs.filter((r) => r.goals >= 1).length ? +avg(recs.filter((r) => r.goals >= 1).map((r) => r.toi)).toFixed(1) : null,
    };

    return result;
  }

  const profiles = {};
  const byPlayerVenue = {};
  const teamRoleBuckets = {};
  const globalRoleBuckets = {};
  const dedupe = new Set();

  for (const sn of wb.SheetNames) {
    const parsed = parseSheetName(sn);
    if (!parsed) continue;

    const { pos, team } = parsed;
    const tk = normTeam(team);
    if (!tk) continue;
    const ws = wb.Sheets[sn];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (!raw.length) continue;

    const recs = [];
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      const dateRaw = r[0];
      const playerRaw = r[3];
      if (!dateRaw || !playerRaw) continue;
      const playerName = String(playerRaw).trim();
      if (!playerName || POSITIONS.includes(playerName.toUpperCase())) continue;

      const playerKey = normalizePlayerName(playerName);
      if (!playerKey) continue;
      const shots = parseInt(r[9], 10);
      const goals = parseInt(r[6], 10);
      const assists = parseInt(r[7], 10);
      const pointsRaw = parseInt(r[8], 10);
      const toi = parseFloat(r[5]);
      const ha = r[2] ? String(r[2]).trim().toUpperCase() : null;
      if (!Number.isFinite(shots) || !Number.isFinite(toi) || !ha) continue;

      const points = Number.isFinite(pointsRaw) ? pointsRaw : ((Number.isFinite(goals) ? goals : 0) + (Number.isFinite(assists) ? assists : 0));
      const goalsN = Number.isFinite(goals) ? goals : 0;
      const assistsN = Number.isFinite(assists) ? assists : 0;
      const dateKey = dateRaw instanceof Date ? dateRaw.toISOString().slice(0, 10) : String(dateRaw).slice(0, 10);
      const uniqueKey = `${playerKey}|${dateKey}|${ha}|${shots}|${goalsN}|${points}`;
      if (dedupe.has(uniqueKey)) continue;
      dedupe.add(uniqueKey);

      const rawLower = String(playerRaw).trim().toLowerCase();
      const compactKey = playerKey.replace(/\s+/g, "");
      const mapped =
        playerHomeAway?.[playerKey] ||
        playerHomeAway?.[rawLower] ||
        playerHomeAway?.[compactKey] ||
        playerHomeAway?.[playerName.toLowerCase()] ||
        null;
      const role = (mapped?.role || "").toUpperCase() || null;
      const mappedPos = (mapped?.pos || "").toUpperCase() || pos;
      const rec = {
        dateKey,
        player: playerName,
        playerKey,
        role,
        pos: mappedPos,
        toi,
        goals: goalsN,
        assists: assistsN,
        points,
        shots,
        ha,
      };
      recs.push(rec);

      if (!byPlayerVenue[playerKey]) byPlayerVenue[playerKey] = { H: [], A: [] };
      byPlayerVenue[playerKey][ha].push(rec);

      if (role) {
        if (!teamRoleBuckets[tk]) teamRoleBuckets[tk] = {};
        if (!teamRoleBuckets[tk][role]) teamRoleBuckets[tk][role] = [];
        teamRoleBuckets[tk][role].push(rec);

        if (!globalRoleBuckets[role]) globalRoleBuckets[role] = [];
        globalRoleBuckets[role].push(rec);
      }
    }

    if (!recs.length) continue;

    if (!profiles[tk]) profiles[tk] = {};
    if (!profiles[tk][pos]) profiles[tk][pos] = {};

    const homeRecs = recs.filter((r) => r.ha === "H");
    const awayRecs = recs.filter((r) => r.ha === "A");

    Object.assign(profiles[tk][pos], buildPropProfiles(recs));
    profiles[tk][pos]._home = homeRecs.length >= 3 ? buildPropProfiles(homeRecs) : null;
    profiles[tk][pos]._away = awayRecs.length >= 3 ? buildPropProfiles(awayRecs) : null;
    profiles[tk][pos]._last7 = {
      H: buildLastNGamesSummary(homeRecs, 7),
      A: buildLastNGamesSummary(awayRecs, 7),
    };

    const byRole = {};
    recs.filter((r) => r.role).forEach((r) => {
      if (!byRole[r.role]) byRole[r.role] = [];
      byRole[r.role].push(r);
    });
    profiles[tk][pos]._byRole = {};
    Object.entries(byRole).forEach(([role, roleRecs]) => {
      const roleHomeRecs = roleRecs.filter((r) => r.ha === "H");
      const roleAwayRecs = roleRecs.filter((r) => r.ha === "A");
      profiles[tk][pos]._byRole[role] = {
        ...buildPropProfiles(roleRecs),
        _home: roleHomeRecs.length >= 3 ? buildPropProfiles(roleHomeRecs) : null,
        _away: roleAwayRecs.length >= 3 ? buildPropProfiles(roleAwayRecs) : null,
        _last7: {
          H: buildLastNGamesSummary(roleHomeRecs, 7),
          A: buildLastNGamesSummary(roleAwayRecs, 7),
        },
      };
    });
  }

  const recentForm = {};
  Object.entries(byPlayerVenue).forEach(([playerKey, venueMap]) => {
    recentForm[playerKey] = {};
    ["H", "A"].forEach((venue) => {
      const games = [...(venueMap[venue] || [])].sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey))).slice(0, 7);
      recentForm[playerKey][venue] = summarizeRecentVenueForm(games);
    });
  });

  const globalRoleSummary = {};
  Object.entries(globalRoleBuckets).forEach(([role, recs]) => {
    const prof = buildPropProfiles(recs);
    globalRoleSummary[role] = {
      s4: prof?._venue?.s4Rate || 0,
      s5: prof?._venue?.s5Rate || 0,
      p1: prof?._venue?.p1Rate || 0,
      p2: prof?._venue?.p2Rate || 0,
      g1: prof?._venue?.g1Rate || 0,
      n: prof?._venue?.n || recs.length || 0,
    };
  });

  const teamRoleProfiles = {};
  Object.entries(teamRoleBuckets).forEach(([tk, roleMap]) => {
    const labels = [];
    const byRole = {};
    Object.entries(roleMap).forEach(([role, recs]) => {
      if (!recs.length) return;
      const prof = buildPropProfiles(recs);
      const n = prof?._venue?.n || recs.length;
      const s4 = prof?._venue?.s4Rate || 0;
      const s5 = prof?._venue?.s5Rate || 0;
      const p1 = prof?._venue?.p1Rate || 0;
      const p2 = prof?._venue?.p2Rate || 0;
      const g1 = prof?._venue?.g1Rate || 0;
      const base = globalRoleSummary[role] || { s4: 0, s5: 0, p1: 0, p2: 0, g1: 0 };
      const out = { role, n, s4, s5, p1, p2, g1, baselineS4: base.s4, baselineP1: base.p1, baselineG1: base.g1 };
      if (n >= 5 && s4 >= Math.max(0.34, base.s4 + 0.08)) {
        out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
        out.strength = (s4 - base.s4) + Math.max(0, s5 - base.s5) * 0.6 + (n >= 8 ? 0.03 : 0);
        labels.push({ type: "shots", text: out.shotLabel, strength: out.strength, role, n, s4, p1, g1 });
      } else if (n >= 5 && s4 <= Math.max(0.05, base.s4 - 0.08)) {
        out.shotLabel = `Suppresses ${role.toLowerCase()} shots`;
        out.strength = (base.s4 - s4) + (n >= 8 ? 0.02 : 0);
        labels.push({ type: "shots", text: out.shotLabel, strength: out.strength, role, n, s4, p1, g1 });
      }
      if (n >= 5 && p1 >= Math.max(0.40, base.p1 + 0.09)) {
        out.pointLabel = `Allows points from ${role.toLowerCase()}`;
        out.pointStrength = (p1 - base.p1) + Math.max(0, p2 - base.p2) * 0.55 + (n >= 8 ? 0.02 : 0);
        labels.push({ type: "points", text: out.pointLabel, strength: out.pointStrength, role, n, s4, p1, g1 });
      } else if (n >= 5 && p1 <= Math.max(0.08, base.p1 - 0.08)) {
        out.pointLabel = `Suppresses ${role.toLowerCase()} points`;
        out.pointStrength = (base.p1 - p1) + (n >= 8 ? 0.015 : 0);
        labels.push({ type: "points", text: out.pointLabel, strength: out.pointStrength, role, n, s4, p1, g1 });
      }
      if (n >= 5 && g1 >= Math.max(0.18, base.g1 + 0.08)) {
        out.goalLabel = `Allows goals from ${role.toLowerCase()}`;
        out.goalStrength = (g1 - base.g1) + (n >= 8 ? 0.02 : 0);
        labels.push({ type: "goals", text: out.goalLabel, strength: out.goalStrength, role, n, s4, p1, g1 });
      } else if (n >= 5 && g1 <= Math.max(0.02, base.g1 - 0.07)) {
        out.goalLabel = `Suppresses ${role.toLowerCase()} goals`;
        out.goalStrength = (base.g1 - g1) + (n >= 8 ? 0.015 : 0);
        labels.push({ type: "goals", text: out.goalLabel, strength: out.goalStrength, role, n, s4, p1, g1 });
      }
      byRole[role] = out;
    });
    const topLabels = labels.sort((a, b) => b.strength - a.strength).slice(0, 8);
    const topByType = (type) => topLabels.filter((x) => x.type === type).slice(0, 3);
    const shotsLabels = topByType("shots");
    const pointsLabels = topByType("points");
    const goalsLabels = topByType("goals");
    const summaryParts = [];
    if (shotsLabels.length) summaryParts.push(`Shots: ${shotsLabels.map((x) => x.text).join(", ")}`);
    if (pointsLabels.length) summaryParts.push(`Points: ${pointsLabels.map((x) => x.text).join(", ")}`);
    if (goalsLabels.length) summaryParts.push(`Goals: ${goalsLabels.map((x) => x.text).join(", ")}`);
    teamRoleProfiles[tk] = {
      labels: topLabels,
      shotsLabels,
      pointsLabels,
      goalsLabels,
      summary: summaryParts.join(" · "),
      byRole,
    };
  });

  return { profiles, recentForm, teamRoleProfiles, byPlayerVenue };
}



function roleLabelStrengthMultiplier(label, strength = 0) {
  if (!label) return 1;
  const isAllow = /^Allows /i.test(label);
  const mag = Math.max(0, strength || 0);
  if (/shots/i.test(label)) {
    return isAllow ? clamp(1.08 + mag * 0.45, 1.08, 1.22) : clamp(0.95 - mag * 0.25, 0.82, 0.95);
  }
  if (/points/i.test(label)) {
    return isAllow ? clamp(1.10 + mag * 0.50, 1.10, 1.24) : clamp(0.94 - mag * 0.26, 0.82, 0.94);
  }
  if (/goals/i.test(label)) {
    return isAllow ? clamp(1.12 + mag * 0.60, 1.12, 1.30) : clamp(0.93 - mag * 0.28, 0.80, 0.93);
  }
  return 1;
}

function classifyDefenseLaneState(posStats, market) {
  const ranks = posStats?.ranks || {};
  const shotsRank = ranks.shots ?? null;
  const assistsRank = ranks.assists ?? null;
  const goalsRank = ranks.goals ?? null;
  const icfRank = ranks.icf ?? null;
  const iffRank = ranks.iff ?? null;
  const iscfRank = ranks.iscf ?? null;

  if (market === 'shots') {
    const openSignals = [shotsRank, icfRank, iffRank, iscfRank].filter((v) => v != null && v <= 12).length;
    const suppressSignals = [shotsRank, icfRank, iffRank, iscfRank].filter((v) => v != null && v >= 23).length;
    if (openSignals >= 2 || (shotsRank != null && shotsRank <= 12) || (iscfRank != null && iscfRank <= 12)) return 'open';
    if (suppressSignals >= 3 || ((shotsRank != null && shotsRank >= 23) && (iscfRank != null && iscfRank >= 23))) return 'suppressed';
    return 'neutral';
  }

  if (market === 'points') {
    const openSignals = [assistsRank, shotsRank, icfRank, iffRank, iscfRank].filter((v) => v != null && v <= 16).length;
    const suppressSignals = [assistsRank, shotsRank, icfRank, iffRank, iscfRank].filter((v) => v != null && v >= 23).length;
    if (openSignals >= 2 || (assistsRank != null && assistsRank <= 16) || ((shotsRank != null && shotsRank <= 12) && (iscfRank != null && iscfRank <= 12))) return 'open';
    if (suppressSignals >= 3 || ((assistsRank != null && assistsRank >= 23) && (shotsRank != null && shotsRank >= 23))) return 'suppressed';
    return 'neutral';
  }

  if (market === 'goals') {
    const openSignals = [goalsRank, iscfRank, shotsRank].filter((v) => v != null && v <= 16).length;
    const suppressSignals = [goalsRank, iscfRank, shotsRank].filter((v) => v != null && v >= 23).length;
    if (openSignals >= 2 || (goalsRank != null && goalsRank <= 16) || (iscfRank != null && iscfRank <= 12)) return 'open';
    if (suppressSignals >= 2 || ((goalsRank != null && goalsRank >= 23) && (iscfRank != null && iscfRank >= 23))) return 'suppressed';
    return 'neutral';
  }

  return 'neutral';
}


function resolveRoleLabelAgainstCheatSheet(label, posStats, market) {
  if (!label) return '';
  const laneState = classifyDefenseLaneState(posStats, market);
  const isAllow = /^Allows /i.test(label);
  const isSuppress = /^Suppresses /i.test(label);

  if (isSuppress && laneState === 'open') return '';
  if (isAllow && laneState === 'suppressed') return '';
  return label;
}

function laneIsNumericallyOpenForRole(posStats, posKey, market = 'shots') {
  const shotsAllowed = posStats?.shotsAllowed || 0;
  const iffAllowed = posStats?.iffAllowed || 0;
  const iscfAllowed = posStats?.iscfAllowed || 0;
  const goalsAllowed = posStats?.goalsAllowed || 0;
  const laneState = classifyDefenseLaneState(posStats, market);

  if (market === 'shots') {
    if (laneState === 'open') return true;
    if (posKey === 'RW') return shotsAllowed >= 7.0 || iffAllowed >= 11.0 || iscfAllowed >= 7.8;
    if (posKey === 'LW') return shotsAllowed >= 6.8 || iffAllowed >= 10.8 || iscfAllowed >= 7.2;
    if (posKey === 'C') return shotsAllowed >= 6.9 || iffAllowed >= 10.8 || iscfAllowed >= 7.4;
    if (posKey === 'D') return shotsAllowed >= 7.8 || iffAllowed >= 12.0 || iscfAllowed >= 4.2;
  }

  if (market === 'goals') {
    if (laneState === 'open') return true;
    if (posKey === 'D') return goalsAllowed >= 0.55 || iscfAllowed >= 4.5;
    return goalsAllowed >= 1.0 || iscfAllowed >= 6.8;
  }

  if (market === 'points') {
    if (laneState === 'open') return true;
    return shotsAllowed >= 6.8 || iffAllowed >= 10.5 || iscfAllowed >= 6.8;
  }

  return false;
}

function roleHistorySupportsSecondaryVolume({ currentRole, roleS3Rate, roleS4Rate, roleVenueSample, effectiveToi }) {
  const role = String(currentRole || '').toUpperCase();
  const sample = roleVenueSample || 0;
  const secondaryWing = role === 'RW2' || role === 'LW2';
  if (!secondaryWing) return false;
  if (sample < 3) return false;
  if (effectiveToi < 13.5 || effectiveToi > 18.8) return false;
  return (roleS3Rate || 0) >= 0.22 || (roleS4Rate || 0) >= 0.10;
}

function applyDefenseProfilePriorityResolver({
  boost,
  oppTK,
  posKey,
  todayLine,
  currentRole,
  effectiveToi,
  posStats,
  roleS3Rate,
  roleS4Rate,
  roleVenueSample,
}) {
  const out = {
    ...(boost || {}),
    p4Floor: boost?.p4Floor || 0,
    enable5Ceiling: !!boost?.enable5Ceiling,
    priorityNotes: [...(boost?.priorityNotes || [])],
    resolvedSummary: boost?.resolvedSummary || '',
  };

  const role = String(currentRole || `${posKey}${todayLine || ''}`).toUpperCase();
  const laneOpenShots = laneIsNumericallyOpenForRole(posStats, posKey, 'shots');
  const laneOpenGoals = laneIsNumericallyOpenForRole(posStats, posKey, 'goals');
  const laneOpenPoints = laneIsNumericallyOpenForRole(posStats, posKey, 'points');
  const shotsAllowed = posStats?.shotsAllowed || 0;
  const iffAllowed = posStats?.iffAllowed || 0;
  const iscfAllowed = posStats?.iscfAllowed || 0;
  const goalsAllowed = posStats?.goalsAllowed || 0;
  const laneStateShots = classifyDefenseLaneState(posStats, 'shots');
  const laneStateGoals = classifyDefenseLaneState(posStats, 'goals');
  const secondaryHistory = roleHistorySupportsSecondaryVolume({
    currentRole: role,
    roleS3Rate,
    roleS4Rate,
    roleVenueSample,
    effectiveToi,
  });

  const suppressesShots = /^Suppresses /i.test(out.shotLabel || '');
  const suppressesGoals = /^Suppresses /i.test(out.goalLabel || '');
  const suppressesPoints = /^Suppresses /i.test(out.pointLabel || '');
  const isSecondaryWing = role === 'RW2' || role === 'LW2';
  const isTopWing = role === 'RW1' || role === 'LW1';
  const isCenter = posKey === 'C';
  const isDefense = posKey === 'D';
  const isTopCenter = role === 'C1';
  const isSecondaryCenter = role === 'C2';
  const isDepthCenter = role === 'C3' || role === 'C4';
  const isTopDefense = role === 'D1';
  const isSecondaryDefense = role === 'D2';
  const strongShotLane =
    laneStateShots === 'open' ||
    (posKey === 'RW' && (shotsAllowed >= 7.0 || iffAllowed >= 11.0 || iscfAllowed >= 7.8)) ||
    (posKey === 'LW' && (shotsAllowed >= 6.8 || iffAllowed >= 10.8 || iscfAllowed >= 7.2)) ||
    (posKey === 'C' && (shotsAllowed >= 6.9 || iffAllowed >= 10.8 || iscfAllowed >= 7.4)) ||
    (posKey === 'D' && (shotsAllowed >= 7.8 || iffAllowed >= 12.0 || iscfAllowed >= 4.2));
  const distributedWingSignal =
    (isTopWing || isSecondaryWing) &&
    strongShotLane &&
    (secondaryHistory || laneStateShots === 'open' || (shotsAllowed >= 7.1 && iffAllowed >= 10.9));
  const centerSignal =
    isCenter &&
    strongShotLane &&
    (
      laneStateShots === 'open' ||
      laneOpenPoints ||
      shotsAllowed >= 7.0 ||
      iffAllowed >= 10.8 ||
      iscfAllowed >= 7.4 ||
      (roleVenueSample || 0) >= 3
    );
  const defenseSignal =
    isDefense &&
    strongShotLane &&
    (
      laneStateShots === 'open' ||
      shotsAllowed >= 7.9 ||
      iffAllowed >= 12.1 ||
      iscfAllowed >= 4.3 ||
      (roleVenueSample || 0) >= 3
    );
  const strongGoalLane =
    laneStateGoals === 'open' ||
    (posKey === 'D' ? (goalsAllowed >= 0.55 || iscfAllowed >= 4.5) : (goalsAllowed >= 1.0 || iscfAllowed >= 6.8));

  if (suppressesShots && (laneOpenShots || secondaryHistory || distributedWingSignal || centerSignal || defenseSignal)) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(
      out.shotAdj || 1,
      defenseSignal ? 1.14 : centerSignal ? 1.12 : distributedWingSignal ? 1.14 : secondaryHistory ? 1.12 : 1.08
    );
    out.priorityNotes.push('shot-suppression-cleared');
  }
  if (suppressesGoals && (laneOpenGoals || strongGoalLane)) {
    out.goalLabel = `Allows goals from ${role.toLowerCase()}`;
    out.goalAdj = Math.max(out.goalAdj || 1, isDefense ? 1.10 : 1.08);
    out.priorityNotes.push('goal-suppression-cleared');
  }
  if (suppressesPoints && (laneOpenPoints || distributedWingSignal || centerSignal || defenseSignal)) {
    out.pointLabel = `Allows points from ${role.toLowerCase()}`;
    out.pointAdj = Math.max(out.pointAdj || 1, defenseSignal ? 1.10 : centerSignal ? 1.09 : distributedWingSignal ? 1.08 : 1.06);
    out.priorityNotes.push('point-suppression-cleared');
  }

  if (role === 'RW2' && strongShotLane && effectiveToi >= 14.0) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(out.shotAdj || 1, secondaryHistory ? 1.16 : 1.10);
    out.p3Floor = Math.max(out.p3Floor || 0, effectiveToi >= 15 ? 0.34 : 0.28);
    out.signalBoost = Math.max(out.signalBoost || 0, (out.signalBoost || 0) + (secondaryHistory ? 4 : 2));
    out.priorityNotes.push('generic-rw2-volume-lock');
    out.resolvedSummary = 'Distributed wing volume override · RW2 volume active';
  }

  if (role === 'LW1' && strongShotLane && effectiveToi >= 17.0) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(out.shotAdj || 1, 1.14);
    out.p3Floor = Math.max(out.p3Floor || 0, effectiveToi >= 18 ? 0.38 : 0.32);
    out.p4Floor = Math.max(out.p4Floor || 0, effectiveToi >= 18 ? 0.28 : 0.22);
    out.enable5Ceiling = effectiveToi >= 17.5 && (laneStateShots === 'open' || shotsAllowed >= 7.0 || iffAllowed >= 10.8);
    out.priorityNotes.push('generic-lw1-ceiling-lock');
    out.resolvedSummary = 'Distributed wing volume override · LW1 spike lane active';
  }

  if (role === 'LW2' && strongGoalLane && effectiveToi >= 15.0) {
    out.goalLabel = `Allows goals from ${role.toLowerCase()}`;
    out.goalAdj = Math.max(out.goalAdj || 1, 1.10);
    out.p1GoalFloor = Math.max(out.p1GoalFloor || 0, goalsAllowed >= 1.1 ? 0.20 : 0.16);
    out.priorityNotes.push('generic-lw2-goal-lock');
    if (!out.resolvedSummary) out.resolvedSummary = 'Distributed wing goal override · LW2 goal lane active';
  }

  if (isTopCenter && strongShotLane && effectiveToi >= 17.0) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(out.shotAdj || 1, 1.12);
    out.pointAdj = Math.max(out.pointAdj || 1, laneOpenPoints ? 1.08 : 1.04);
    out.p3Floor = Math.max(out.p3Floor || 0, effectiveToi >= 18.5 ? 0.38 : 0.32);
    out.p4Floor = Math.max(out.p4Floor || 0, effectiveToi >= 18.5 && (laneStateShots === 'open' || shotsAllowed >= 7.1) ? 0.24 : 0.18);
    out.enable5Ceiling = effectiveToi >= 19.0 && (laneStateShots === 'open' || shotsAllowed >= 7.2 || iscfAllowed >= 7.8);
    out.priorityNotes.push('generic-c1-volume-lock');
    if (!out.resolvedSummary) out.resolvedSummary = 'Center volume override · C1 shot lane active';
  }

  if (isSecondaryCenter && strongShotLane && effectiveToi >= 15.0) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(out.shotAdj || 1, 1.10);
    out.pointAdj = Math.max(out.pointAdj || 1, laneOpenPoints ? 1.08 : 1.04);
    out.p3Floor = Math.max(out.p3Floor || 0, effectiveToi >= 16.0 ? 0.30 : 0.24);
    out.p4Floor = Math.max(out.p4Floor || 0, effectiveToi >= 17.0 && laneStateShots === 'open' ? 0.16 : 0.0);
    out.priorityNotes.push('generic-c2-volume-lock');
    if (!out.resolvedSummary) out.resolvedSummary = 'Center volume override · C2 shot lane active';
  }

  if ((isTopCenter || isSecondaryCenter || isDepthCenter) && strongGoalLane && effectiveToi >= (isDepthCenter ? 12.0 : 15.0)) {
    out.goalLabel = `Allows goals from ${role.toLowerCase()}`;
    out.goalAdj = Math.max(out.goalAdj || 1, isTopCenter ? 1.12 : 1.08);
    const goalFloor = isTopCenter ? (goalsAllowed >= 1.15 ? 0.22 : 0.18) : isSecondaryCenter ? (goalsAllowed >= 1.1 ? 0.16 : 0.13) : 0.10;
    out.p1GoalFloor = Math.max(out.p1GoalFloor || 0, goalFloor);
    out.priorityNotes.push(isTopCenter ? 'generic-c1-goal-lock' : isSecondaryCenter ? 'generic-c2-goal-lock' : 'generic-c-depth-goal-lock');
    if (!out.resolvedSummary) out.resolvedSummary = isTopCenter ? 'Center goal override · C1 goal lane active' : isSecondaryCenter ? 'Center goal override · C2 goal lane active' : 'Center goal override · depth-C goal lane active';
  }

  if (isTopDefense && strongShotLane && effectiveToi >= 21.0) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(out.shotAdj || 1, 1.14);
    out.pointAdj = Math.max(out.pointAdj || 1, laneOpenPoints ? 1.08 : 1.04);
    out.p3Floor = Math.max(out.p3Floor || 0, effectiveToi >= 22.5 ? 0.28 : 0.22);
    out.p4Floor = Math.max(out.p4Floor || 0, effectiveToi >= 23.0 && (laneStateShots === 'open' || shotsAllowed >= 8.1) ? 0.16 : 0.10);
    out.enable5Ceiling = effectiveToi >= 24.0 && (laneStateShots === 'open' || shotsAllowed >= 8.3 || iffAllowed >= 12.3);
    out.priorityNotes.push('generic-d1-volume-lock');
    if (!out.resolvedSummary) out.resolvedSummary = 'Defense volume override · D1 shot lane active';
  }

  if (isSecondaryDefense && strongShotLane && effectiveToi >= 19.0) {
    out.shotLabel = `Allows shots from ${role.toLowerCase()}`;
    out.shotAdj = Math.max(out.shotAdj || 1, 1.10);
    out.pointAdj = Math.max(out.pointAdj || 1, laneOpenPoints ? 1.07 : 1.03);
    out.p3Floor = Math.max(out.p3Floor || 0, effectiveToi >= 20.0 ? 0.20 : 0.16);
    out.p4Floor = Math.max(out.p4Floor || 0, effectiveToi >= 21.0 && laneStateShots === 'open' ? 0.10 : 0.0);
    out.priorityNotes.push('generic-d2-volume-lock');
    if (!out.resolvedSummary) out.resolvedSummary = 'Defense volume override · D2 shot lane active';
  }

  if ((isTopDefense || isSecondaryDefense) && strongGoalLane && effectiveToi >= (isTopDefense ? 21.0 : 19.0)) {
    out.goalLabel = `Allows goals from ${role.toLowerCase()}`;
    out.goalAdj = Math.max(out.goalAdj || 1, 1.10);
    out.p1GoalFloor = Math.max(out.p1GoalFloor || 0, isTopDefense ? 0.08 : 0.05);
    out.p2GoalFloor = Math.max(out.p2GoalFloor || 0, isTopDefense ? 0.015 : 0.008);
    out.priorityNotes.push(isTopDefense ? 'generic-d1-goal-lock' : 'generic-d2-goal-lock');
    if (!out.resolvedSummary) out.resolvedSummary = isTopDefense ? 'Defense goal override · D1 goal lane active' : 'Defense goal override · D2 goal lane active';
  }

  if (!out.resolvedSummary) {
    out.resolvedSummary = [out.shotLabel, out.pointLabel, out.goalLabel].filter(Boolean).join(' · ');
  }

  return out;
}

function buildDefenseRoleMarketBoost({ oppRoleProfile, posStats, currentRole, posKey, todayLine, effectiveToi, skater }) {
  const rawShotLabel = oppRoleProfile?.shotLabel || '';
  const rawPointLabel = oppRoleProfile?.pointLabel || '';
  const rawGoalLabel = oppRoleProfile?.goalLabel || '';
  const shotLabel = resolveRoleLabelAgainstCheatSheet(rawShotLabel, posStats, 'shots');
  const pointLabel = resolveRoleLabelAgainstCheatSheet(rawPointLabel, posStats, 'points');
  const goalLabel = resolveRoleLabelAgainstCheatSheet(rawGoalLabel, posStats, 'goals');
  const shotStrength = shotLabel ? (oppRoleProfile?.strength || 0) : 0;
  const pointStrength = pointLabel ? (oppRoleProfile?.pointStrength || 0) : 0;
  const goalStrength = goalLabel ? (oppRoleProfile?.goalStrength || 0) : 0;
  const shots = skater?.shotsSeason || 0;
  const points = (skater?.goalsSeason || 0) + (skater?.astSeason || 0);
  const goals = skater?.goalsSeason || 0;
  const iscf = skater?.iscfSeason || 0;
  const iff = skater?.iffSeason || 0;

  const shotAdj = roleLabelStrengthMultiplier(shotLabel, shotStrength);
  const pointAdj = roleLabelStrengthMultiplier(pointLabel, pointStrength);
  const goalAdj = roleLabelStrengthMultiplier(goalLabel, goalStrength);

  let p3Floor = 0;
  let p1PointFloor = 0;
  let p2PointFloor = 0;
  let p1GoalFloor = 0;
  let p2GoalFloor = 0;
  let signalBoost = 0;
  let attackBoost = 0;
  let primaryMarket = null;
  let tag = null;

  const allowsShots = /^Allows shots/i.test(shotLabel);
  const allowsPoints = /^Allows points/i.test(pointLabel);
  const allowsGoals = /^Allows goals/i.test(goalLabel);

  const isTopRole = todayLine <= 2;
  const roleKey = currentRole || `${posKey}${todayLine}`;
  const isDepthRole = todayLine >= 3;

  const shotCapable = shots >= 1.8 || iff >= 2.6;
  const pointCapable = points >= 0.28 || iff >= 2.2 || iscf >= 1.3;
  const goalCapable = goals >= 0.14 || iscf >= 1.35 || shots >= 1.6;
  const premiumVolume = shots >= 2.4 || iff >= 3.4 || iscf >= 1.9;

  const qualityScore =
    (effectiveToi >= (isDepthRole ? 12.0 : 14.5) ? 1 : 0) +
    (shotCapable ? 1 : 0) +
    (pointCapable ? 1 : 0) +
    (goalCapable ? 1 : 0) +
    (premiumVolume ? 1 : 0);

  let boostScale = 0.22;
  if (effectiveToi >= (isTopRole ? 15.0 : 12.0) && qualityScore >= 4) boostScale = 1.0;
  else if (effectiveToi >= (isTopRole ? 14.0 : 11.5) && qualityScore >= 3) boostScale = 0.78;
  else if (effectiveToi >= (isTopRole ? 13.0 : 11.0) && qualityScore >= 2) boostScale = 0.56;
  else if (effectiveToi >= 10.5 && qualityScore >= 1) boostScale = 0.38;

  const topRoleWeak = isTopRole && effectiveToi < 13.5 && qualityScore < 2;
  if (topRoleWeak) boostScale = Math.min(boostScale, 0.30);
  if (isDepthRole && effectiveToi < 11.5 && qualityScore < 2) boostScale = Math.min(boostScale, 0.24);

  const scaleBase = (value, cap) => Math.min(cap, Math.round(value * boostScale));
  const scaleFloor = (value, floorCap) => +(Math.min(floorCap, value * boostScale).toFixed(3));
  const scaleFloorWithMin = (value, floorCap, minFloor = 0) => {
    const scaled = Math.min(floorCap, value * boostScale);
    return +Math.max(minFloor, scaled).toFixed(3);
  };

  if (allowsShots) {
    signalBoost += scaleBase(todayLine === 1 ? 6 : todayLine === 2 ? 5 : 3, 6);
    attackBoost += scaleBase(todayLine === 1 ? 8 : todayLine === 2 ? 6 : 4, 8);

    if ((roleKey === 'C1' || roleKey === 'LW1' || roleKey === 'RW1' || roleKey === 'D1') && effectiveToi >= (posKey === 'D' ? 20.5 : 15.5) && shotCapable) {
      p3Floor = Math.max(p3Floor, scaleFloor(roleKey === 'D1' ? 0.24 : 0.38, roleKey === 'D1' ? 0.24 : 0.38));
    } else if (isTopRole && effectiveToi >= 14.0 && (shots >= 1.5 || iff >= 2.4)) {
      p3Floor = Math.max(p3Floor, scaleFloor(0.28, 0.28));
    }
  }

  if (allowsPoints) {
    signalBoost += scaleBase(todayLine === 1 ? 10 : todayLine === 2 ? 8 : 6, 10);
    attackBoost += scaleBase(todayLine === 1 ? 12 : todayLine === 2 ? 10 : 7, 12);

    if (roleKey === 'C3' && effectiveToi >= 12.0 && pointCapable) {
      p1PointFloor = Math.max(p1PointFloor, scaleFloorWithMin(0.30, 0.30, boostScale >= 0.75 ? 0.22 : 0));
      p2PointFloor = Math.max(p2PointFloor, scaleFloor(0.08, 0.08));
      primaryMarket = primaryMarket || 'points';
      tag = tag || 'C3 Point Leak';
    } else if (roleKey === 'C4' && effectiveToi >= 10.5 && pointCapable) {
      p1PointFloor = Math.max(p1PointFloor, scaleFloor(0.22, 0.22));
      primaryMarket = primaryMarket || 'points';
      tag = tag || 'C4 Point Leak';
    } else if (isTopRole && effectiveToi >= 14.0 && pointCapable) {
      p1PointFloor = Math.max(p1PointFloor, scaleFloor(todayLine === 1 ? 0.40 : 0.30, todayLine === 1 ? 0.40 : 0.30));
      p2PointFloor = Math.max(p2PointFloor, scaleFloor(todayLine === 1 ? 0.12 : 0.06, todayLine === 1 ? 0.12 : 0.06));
      primaryMarket = primaryMarket || 'points';
      tag = tag || `${roleKey} Point Leak`;
    }
  }

  if (allowsGoals) {
    signalBoost += scaleBase(todayLine === 1 ? 14 : todayLine === 2 ? 11 : 9, 14);
    attackBoost += scaleBase(todayLine === 1 ? 18 : todayLine === 2 ? 14 : 11, 18);

    if (roleKey === 'RW1' && effectiveToi >= 15.0 && goalCapable) {
      p1GoalFloor = Math.max(p1GoalFloor, scaleFloorWithMin((goals >= 0.22 || iscf >= 1.8) ? 0.36 : 0.30, 0.36, boostScale >= 0.78 ? 0.24 : 0));
      p2GoalFloor = Math.max(p2GoalFloor, scaleFloor(0.08, 0.08));
      primaryMarket = 'goal';
      tag = 'RW1 Goal Leak';
    } else if (roleKey === 'RW2' && effectiveToi >= 14.0 && goalCapable) {
      p1GoalFloor = Math.max(p1GoalFloor, scaleFloor((goals >= 0.18 || iscf >= 1.5) ? 0.28 : 0.24, 0.28));
      p2GoalFloor = Math.max(p2GoalFloor, scaleFloor(0.05, 0.05));
      primaryMarket = primaryMarket || 'goal';
      tag = tag || 'RW2 Goal Leak';
    } else if (roleKey === 'C3' && effectiveToi >= 12.0 && goalCapable) {
      p1GoalFloor = Math.max(p1GoalFloor, scaleFloor((goals >= 0.12 || iscf >= 1.3) ? 0.24 : 0.18, 0.24));
      p2GoalFloor = Math.max(p2GoalFloor, scaleFloor(0.03, 0.03));
      primaryMarket = 'goal';
      tag = 'C3 Goal Leak';
    } else if (roleKey === 'C4' && effectiveToi >= 10.5 && goalCapable) {
      p1GoalFloor = Math.max(p1GoalFloor, scaleFloor((goals >= 0.10 || iscf >= 1.1) ? 0.18 : 0.14, 0.18));
      primaryMarket = primaryMarket || 'goal';
      tag = tag || 'C4 Goal Leak';
    } else if (isTopRole && effectiveToi >= 14.0 && (goalCapable || pointCapable)) {
      p1GoalFloor = Math.max(p1GoalFloor, scaleFloor(todayLine === 1 ? 0.30 : 0.23, todayLine === 1 ? 0.30 : 0.23));
      p2GoalFloor = Math.max(p2GoalFloor, scaleFloor(todayLine === 1 ? 0.06 : 0.035, todayLine === 1 ? 0.06 : 0.035));
      primaryMarket = primaryMarket || 'goal';
      tag = tag || `${roleKey} Goal Leak`;
    }
  }

  // Prevent weak leak tags from overpowering stronger baseline players.
  if (boostScale < 0.55) {
    p3Floor = Math.min(p3Floor, posKey === 'D' ? 0.16 : 0.22);
    p1PointFloor = Math.min(p1PointFloor, 0.24);
    p2PointFloor = Math.min(p2PointFloor, 0.05);
    p1GoalFloor = Math.min(p1GoalFloor, 0.22);
    p2GoalFloor = Math.min(p2GoalFloor, 0.035);
  }

  return {
    shotAdj,
    pointAdj,
    goalAdj,
    p3Floor: +p3Floor.toFixed(3),
    p1PointFloor: +p1PointFloor.toFixed(3),
    p2PointFloor: +p2PointFloor.toFixed(3),
    p1GoalFloor: +p1GoalFloor.toFixed(3),
    p2GoalFloor: +p2GoalFloor.toFixed(3),
    signalBoost,
    attackBoost,
    primaryMarket,
    tag,
    boostScale: +boostScale.toFixed(3),
    qualityScore,
    shotLabel,
    pointLabel,
    goalLabel,
  };
}

// ─── PARSE LINEUPS
// ─── PARSE LINEUPS ───────────────────────────────────────────────────────────


function projectedToiFromLineup(posKey, todayLine, playerToi) {
  const p = (posKey || "").toUpperCase();
  const current = playerToi || 0;

  if (p === "D") {
    if (todayLine === 1) return Math.max(current, 21.0);
    if (todayLine === 2) return Math.max(current, 18.5);
    return Math.max(current, 16.0);
  }

  if (todayLine === 1) return Math.max(current, 18.5);
  if (todayLine === 2) return Math.max(current, 16.0);
  if (todayLine === 3) return Math.max(current, 13.5);
  return Math.max(current, 11.0);
}


function positionGoalLeakOverride({ posKey, todayLine, effectiveToi, skater, teamPos }) {
  if (!teamPos) return null;
  if (posKey === "D") return null;
  if (todayLine < 1 || todayLine > 2) return null;

  const goalsAllow = teamPos.goals || 0;
  const shotsAllow = teamPos.shots || 0;
  const iscfAllow = teamPos.iscf || 0;

  const shots = skater.shotsSeason || 0;
  const iff = skater.iffSeason || 0;
  const iscf = skater.iscfSeason || 0;
  const gpg = skater.goalsSeason || 0;

  if (posKey === "RW") {
    const rwGoalLeakActive = goalsAllow >= 1.30 && iscfAllow >= 7.5;
    if (!rwGoalLeakActive) return null;

    const strength =
      goalsAllow >= 1.75 ? "extreme" :
      goalsAllow >= 1.50 ? "strong" :
      "standard";

    const supportSignals =
      (shotsAllow >= 6.8 ? 1 : 0) +
      (iscfAllow >= 8.0 ? 1 : 0) +
      (iff >= 3.2 ? 1 : 0);

    const rwEliteVolume =
      effectiveToi >= 18.5 &&
      shots >= 3.0 &&
      iff >= 4.2 &&
      iscf >= 2.4;

    if (
      todayLine === 1 &&
      effectiveToi >= 18.5 &&
      (iscf >= 2.4 || gpg >= 0.35)
    ) {
      const baseFloor =
        strength === "extreme" ? 0.39 :
        strength === "strong" ? 0.36 :
        0.33;
      const p2Base =
        strength === "extreme" ? 0.14 :
        strength === "strong" ? 0.12 :
        0.10;
      return {
        flag: true,
        tier: strength,
        p1gFloor: Math.min(0.42, baseFloor + supportSignals * 0.005),
        p2gFloor: Math.min(0.16, p2Base + Math.max(0, supportSignals - 1) * 0.01),
        suppressShotPrimary: !rwEliteVolume,
        bypassGoalCaps: true,
        routeToGoal: true,
        reason: `RW goal leak override · RW1 ${strength}`,
      };
    }

    if (
      todayLine === 2 &&
      effectiveToi >= 16.0 &&
      (iscf >= 2.0 || gpg >= 0.28)
    ) {
      const baseFloor =
        strength === "extreme" ? 0.31 :
        strength === "strong" ? 0.29 :
        0.27;
      const p2Base =
        strength === "extreme" ? 0.07 :
        strength === "strong" ? 0.06 :
        0.05;
      return {
        flag: true,
        tier: strength,
        p1gFloor: Math.min(0.34, baseFloor + Math.min(0.01, supportSignals * 0.003)),
        p2gFloor: Math.min(0.08, p2Base + Math.max(0, supportSignals - 1) * 0.005),
        suppressShotPrimary: !rwEliteVolume,
        bypassGoalCaps: true,
        routeToGoal: true,
        reason: `RW goal leak override · RW2 ${strength}`,
      };
    }

    return null;
  }

  const posCfg = {
    LW: {
      goalGate: 1.15,
      toiL1: 18.0,
      toiL2: 16.5,
      playerL1: () => gpg >= 0.28 || iscf >= 2.2 || shots >= 2.2 || iff >= 3.0,
      playerL2: () => gpg >= 0.24 || iscf >= 2.0 || shots >= 1.9 || iff >= 2.8,
      baseL1: 0.31,
      baseL2: 0.21,
      p2L1: 0.07,
      p2L2: 0.03,
      bonusScale: 0.20,
      p2BonusScale: 0.05,
      maxL1: 0.39,
      maxL2: 0.28,
      maxP2L1: 0.13,
      maxP2L2: 0.06,
    },
    C: {
      goalGate: 1.00,
      toiL1: 19.0,
      toiL2: 17.5,
      playerL1: () => gpg >= 0.28 || iscf >= 2.4 || shots >= 2.4 || iff >= 3.3,
      playerL2: () => gpg >= 0.24 || iscf >= 2.1 || shots >= 2.0 || iff >= 3.0,
      baseL1: 0.29,
      baseL2: 0.20,
      p2L1: 0.06,
      p2L2: 0.02,
      bonusScale: 0.18,
      p2BonusScale: 0.05,
      maxL1: 0.36,
      maxL2: 0.25,
      maxP2L1: 0.11,
      maxP2L2: 0.05,
    },
  }[posKey];

  if (!posCfg || goalsAllow < posCfg.goalGate) return null;

  const supportSignals =
    (shotsAllow >= 5.2 ? 1 : 0) +
    (iscfAllow >= (posKey === "C" ? 6.2 : 6.8) ? 1 : 0);

  if (todayLine === 1 && effectiveToi >= posCfg.toiL1 && posCfg.playerL1()) {
    const bonus = Math.max(0, goalsAllow - posCfg.goalGate) * posCfg.bonusScale;
    return {
      flag: true,
      tier: "primary",
      p1gFloor: Math.min(posCfg.maxL1, posCfg.baseL1 + bonus + supportSignals * 0.01),
      p2gFloor: Math.min(posCfg.maxP2L1, posCfg.p2L1 + Math.max(0, goalsAllow - posCfg.goalGate) * posCfg.p2BonusScale),
      reason: `${posKey} goal leak override · L1 priority`,
    };
  }

  if (todayLine === 2 && effectiveToi >= posCfg.toiL2 && posCfg.playerL2()) {
    const bonus = Math.max(0, goalsAllow - posCfg.goalGate) * (posCfg.bonusScale * 0.8);
    return {
      flag: true,
      tier: "secondary",
      p1gFloor: Math.min(posCfg.maxL2, posCfg.baseL2 + bonus + supportSignals * 0.005),
      p2gFloor: Math.min(posCfg.maxP2L2, posCfg.p2L2 + Math.max(0, goalsAllow - posCfg.goalGate) * (posCfg.p2BonusScale * 0.7)),
      reason: `${posKey} goal leak override · L2 secondary`,
    };
  }

  return null;
}

function defenseGoalExceptional(skater, playerToi) {
  const shots = skater.shotsSeason || 0;
  const iff = skater.iffSeason || 0;
  const iscf = skater.iscfSeason || 0;
  const goals = skater.goalsSeason || 0;

  return (
    playerToi >= 22 &&
    shots >= 2.0 &&
    iff >= 3.0 &&
    (iscf >= 1.2 || goals >= 0.12)
  );
}


function parseBoxScoresWorkbook(wb) {
  const out = {};
  const teamHints = [
    "lightning","bruins","senators","islanders","capitals","penguins","oilers","kings","devils","red wings",
    "blues","blackhawks","wild","predators","rangers","stars","hurricanes","mammoth","panthers","maple leafs",
    "blue jackets","canadiens","flyers","jets","flames","kraken","golden knights","avalanche","canucks","sharks",
    "ducks","sabres","leafs"
  ];

  const addPlayer = (teamName, playerName, g, a, s) => {
    const key = normalizePlayerName(playerName);
    if (!key) return;
    const goals = Number(g || 0);
    const assists = Number(a || 0);
    const shots = Number(s || 0);
    out[key] = { name: String(playerName || ""), team: String(teamName || ""), goals, assists, points: goals + assists, shots };
  };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    let i = 0;
    while (i < raw.length) {
      const teamName = String(raw[i]?.[0] || "").trim();
      if (!teamName) { i += 1; continue; }

      let forwardsHeader = -1;
      for (let r = i; r < Math.min(i + 8, raw.length); r++) {
        if (String(raw[r]?.[0] || "").trim().toLowerCase() === "forwards") { forwardsHeader = r; break; }
      }
      if (forwardsHeader === -1) { i += 1; continue; }

      const fHeaders = (raw[forwardsHeader] || []).map((h) => String(h || "").trim());
      const fG = fHeaders.indexOf("G"), fA = fHeaders.indexOf("A"), fS = fHeaders.indexOf("S");
      let r = forwardsHeader + 1;
      while (r < raw.length) {
        const label = String(raw[r]?.[0] || "").trim().toLowerCase();
        if (!label) { r += 1; continue; }
        if (label === "defensemen" || label === "goalies") break;
        addPlayer(teamName, raw[r][0], raw[r][fG], raw[r][fA], raw[r][fS]);
        r += 1;
      }

      if (r < raw.length && String(raw[r]?.[0] || "").trim().toLowerCase() === "defensemen") {
        const dHeaders = (raw[r] || []).map((h) => String(h || "").trim());
        const dG = dHeaders.indexOf("G"), dA = dHeaders.indexOf("A"), dS = dHeaders.indexOf("S");
        r += 1;
        while (r < raw.length) {
          const label = String(raw[r]?.[0] || "").trim().toLowerCase();
          if (!label) { r += 1; continue; }
          if (label === "goalies") break;
          if (teamHints.some((t) => label.includes(t))) break;
          addPlayer(teamName, raw[r][0], raw[r][dG], raw[r][dA], raw[r][dS]);
          r += 1;
        }
      }

      i = Math.max(r, forwardsHeader + 1);
    }
  }
  return out;
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


function parseLineups(buf) {
  const wb = XLSX.read(buf, { type: "binary" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const out = {};
  let currentTeam = null;
  let fwdLineNum = 0;
  let defPairNum = 0;
  let fwdCount = 0;

  for (const row of raw) {
    const cell = row[0] ? String(row[0]).replace(/\u00a0/g, " ").replace(/ +/g, " ").trim() : "";
    if (!cell) continue;

    if (cell.toLowerCase().includes("projected lineup")) {
      currentTeam = cell.replace(/projected lineup/i, "").trim();
      fwdLineNum = 0;
      defPairNum = 0;
      fwdCount = 0;
      continue;
    }

    if (!currentTeam) continue;

    if (
      cell.startsWith("Scratched:") ||
      cell.startsWith("Injured:") ||
      cell.startsWith("Note:")
    ) {
      continue;
    }

    const normalizedLine = cell
      .replace(/\s+[–—-]{1,2}\s+/g, " -- ")
      .replace(/\s*--\s*/g, " -- ")
      .trim();

    if (normalizedLine.includes("--")) {
      const players = normalizedLine
        .split("--")
        .map((p) => p.trim())
        .filter(Boolean);

      if (players.length === 3 && fwdCount < 12) {
        fwdLineNum++;
        const positions = ["LW", "C", "RW"];

        players.forEach((p, i) => {
          const key = normalizePlayerName(p);
          out[key] = {
            line: fwdLineNum,
            pos: positions[i],
            team: currentTeam,
          };
        });

        fwdCount += 3;
      } else if (players.length === 2) {
        defPairNum++;
        players.forEach((p) => {
          const key = normalizePlayerName(p);
          out[key] = {
            line: defPairNum,
            pos: "D",
            team: currentTeam,
          };
        });
      }
    }
  }

  return out;
}

// ─── PARSE PLAYER HOME/AWAY STATS ────────────────────────────────────────────


function isPlayerConfirmedInLineup(skaterName, lineupData) {
  if (!lineupData) return true;
  return !!lineupData[normalizePlayerName(skaterName)];
}

function parsePlayerHomeAway(buf) {
  const wb = XLSX.read(buf, { type: "binary" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const out = {};
  const sf = (v) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };
  const ratio = (a, b, fb = 0) => (b > 0 ? a / b : fb);

  for (const r of raw.slice(2)) {
    const cleanNameRaw = r[3] || r[2];
    if (!cleanNameRaw) continue;

    const cleanName = String(cleanNameRaw).trim();
    const name = normalizePlayerName(cleanName);

    const allSog = sf(r[11]);
    const allIcf = sf(r[13]);
    const allIff = sf(r[14]);
    const allIscf = sf(r[15]);
    const awaySog = sf(r[20]);
    const awayIcf = sf(r[22]);
    const awayIff = sf(r[23]);
    const awayIscf = sf(r[24]);
    const homeSog = sf(r[29]);
    const homeIcf = sf(r[31]);
    const homeIff = sf(r[32]);
    const homeIscf = sf(r[33]);
    const homeL5Sog = sf(r[38]);
    const homeL5Icf = sf(r[45]);
    const homeL5Iff = sf(r[46]);
    const homeL5Iscf = sf(r[47]);
    const awayL5Sog = sf(r[52]);
    const awayL5Icf = sf(r[59]);
    const awayL5Iff = sf(r[60]);
    const awayL5Iscf = sf(r[61]);

    const allConv = ratio(allSog, allIff, 0.68);
    const homeConv = ratio(homeSog, homeIff, allConv || 0.68);
    const awayConv = ratio(awaySog, awayIff, allConv || 0.68);
    const homeL5Conv = ratio(homeL5Sog, homeL5Iff, homeConv || allConv || 0.68);
    const awayL5Conv = ratio(awayL5Sog, awayL5Iff, awayConv || allConv || 0.68);

    const allDanger = ratio(allIscf, allIff, 0.4);
    const homeDanger = ratio(homeIscf, homeIff, allDanger || 0.4);
    const awayDanger = ratio(awayIscf, awayIff, allDanger || 0.4);
    const homeL5Danger = ratio(homeL5Iscf, homeL5Iff, homeDanger || allDanger || 0.4);
    const awayL5Danger = ratio(awayL5Iscf, awayL5Iff, awayDanger || allDanger || 0.4);

    const homeVol = homeSog > 0 ? Math.abs(homeL5Sog - homeSog) / homeSog : 0;
    const awayVol = awaySog > 0 ? Math.abs(awayL5Sog - awaySog) / awaySog : 0;
    const pos = String(r[1] || "").trim().toUpperCase().replace(/[^A-Z]/g, "") || null;
    const role = String(r[2] || "").trim().toUpperCase() || null;

    const rec = {
      rawName: String(r[0] || "").trim(),
      cleanName,
      team: r[5] ? String(r[5]).trim() : "",
      pos,
      role,
      base_shots_home: sf(r[6]),
      base_shots_away: sf(r[7]),
      iff_all: allIff,
      icf_all: allIcf,
      iscf_all: allIscf,
      sog_all: allSog,
      conv_all: allConv,
      danger_all: allDanger,
      iff_home: homeIff,
      iff_away: awayIff,
      icf_home: homeIcf,
      icf_away: awayIcf,
      iscf_home: homeIscf,
      iscf_away: awayIscf,
      sog_home: homeSog,
      sog_away: awaySog,
      conv_home: homeConv,
      conv_away: awayConv,
      danger_home: homeDanger,
      danger_away: awayDanger,
      iff_l5_home: homeL5Iff,
      iff_l5_away: awayL5Iff,
      icf_l5_home: homeL5Icf,
      icf_l5_away: awayL5Icf,
      iscf_l5_home: homeL5Iscf,
      iscf_l5_away: awayL5Iscf,
      sog_l5_home: homeL5Sog,
      sog_l5_away: awayL5Sog,
      conv_l5_home: homeL5Conv,
      conv_l5_away: awayL5Conv,
      danger_l5_home: homeL5Danger,
      danger_l5_away: awayL5Danger,
      g_home: sf(r[28]),
      g_away: sf(r[19]),
      g_l5_home: sf(r[37]),
      g_l5_away: sf(r[51]),
      toi_home: sf(r[27]),
      toi_away: sf(r[18]),
      form_apply_home: sf(r[41]),
      form_apply_away: sf(r[55]),
      form_adjust_home: sf(r[42]),
      form_adjust_away: sf(r[56]),
      base_plus_form_home: sf(r[43]),
      base_plus_form_away: sf(r[57]),
      volatility_home: homeVol,
      volatility_away: awayVol,
    };

    out[name] = rec;
    out[cleanName.toLowerCase()] = rec;
    const rawPlayer = String(r[0] || "").trim();
    if (rawPlayer) out[normalizePlayerName(rawPlayer)] = rec;
  }

  return out;
}


function parsePaceWorkbook(buf, games) {
  const wb = XLSX.read(buf, { type: "binary" });
  const PACE_COL = 64; // 0-indexed; exported pace workbook column that tracks player pace proxy
  const NAME_COL = 2;
  const TOI_COL = 5;

  const playerToTeam = {};
  games.forEach((game) => {
    game.skaterBlocks.forEach((block) => {
      block.players.forEach((p) => {
        playerToTeam[p.name.toLowerCase()] = block.team;
      });
    });
  });

  const parseSheet = (sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return {};
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const out = {};

    raw.forEach((r) => {
      const name = r?.[NAME_COL] ? String(r[NAME_COL]).trim().toLowerCase() : "";
      if (!name) return;

      const pace = parseFloat(r[PACE_COL]);
      const toi = parseFloat(r[TOI_COL]) || 0;

      if (!Number.isFinite(pace) || pace < 25 || pace > 130) return;

      out[name] = {
        pace,
        toi,
      };
    });

    return out;
  };

  const seasonMap = parseSheet("Pace Season");
  const l10Map = parseSheet("Pace L10");
  const names = new Set([...Object.keys(seasonMap), ...Object.keys(l10Map)]);
  const players = {};

  names.forEach((name) => {
    const season = seasonMap[name];
    const l10 = l10Map[name];
    const paceSeason = season?.pace ?? null;
    const paceL10 = l10?.pace ?? null;
    const weight = Math.max(season?.toi || 0, l10?.toi || 0, 1);
    const paceBlend =
      paceSeason != null && paceL10 != null
        ? 0.58 * paceSeason + 0.42 * paceL10
        : paceSeason != null
        ? paceSeason
        : paceL10 != null
        ? paceL10
        : null;

    if (paceBlend == null) return;

    players[name] = {
      paceSeason,
      paceL10,
      paceBlend,
      weight,
      team: playerToTeam[name] || "",
    };
  });

  const teamBuckets = {};
  Object.entries(players).forEach(([name, p]) => {
    const team = p.team;
    if (!team) return;
    if (!teamBuckets[team]) {
      teamBuckets[team] = {
        weighted: 0,
        weight: 0,
      };
    }
    teamBuckets[team].weighted += p.paceBlend * Math.max(1, p.weight);
    teamBuckets[team].weight += Math.max(1, p.weight);
  });

  const teamMap = {};
  Object.entries(teamBuckets).forEach(([team, agg]) => {
    teamMap[team] = agg.weight > 0 ? agg.weighted / agg.weight : null;
  });

  const leagueVals = Object.values(players)
    .map((p) => ({ pace: p.paceBlend, weight: Math.max(1, p.weight) }))
    .filter((p) => Number.isFinite(p.pace));
  const leagueAvg =
    leagueVals.reduce((acc, p) => acc + p.pace * p.weight, 0) /
      Math.max(1, leagueVals.reduce((acc, p) => acc + p.weight, 0)) || 60;

  return {
    players,
    teamMap,
    leagueAvg,
    source: "uploaded pace workbook",
  };
}

// ─── DEFENSE ENVIRONMENT ENGINE ──────────────────────────────────────────────

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function safeRatio(a, b, fallback = 0) {
  return b > 0 ? a / b : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function weightedAverage(items, valueKey, weightKey = "toiSeason") {
  const num = items.reduce(
    (acc, item) => acc + (item[valueKey] || 0) * Math.max(1, item[weightKey] || 0),
    0
  );
  const den = items.reduce((acc, item) => acc + Math.max(1, item[weightKey] || 0), 0);
  return den > 0 ? num / den : 0;
}

function buildFeatureNarrative(r) {
  const notes = [];

  if ((r.leakScore ?? 0) >= 85) notes.push("Leak is doing heavy lifting");
  else if ((r.leakScore ?? 0) >= 75) notes.push("Soft positional defense");

  if ((r.shotConv ?? 0) >= 0.72) notes.push("Strong iFF→SOG converter");
  else if ((r.shotConv ?? 0) <= 0.58) notes.push("Weak shot conversion");

  if ((r.lineShare ?? 0) >= 0.4) notes.push("Primary shooter on line");
  else if ((r.lineShare ?? 0) <= 0.24) notes.push("Secondary shot share");

  if ((r.dangerRate ?? 0) >= 0.48) notes.push("High-danger shot mix");
  if ((r.paceMult ?? 1) >= 1.06) notes.push("Fast game environment / pace support");
  if ((r.blockMult ?? 1) <= 0.94) notes.push("Block-heavy defense");
  if ((r.volatilityPenalty ?? 0) >= 0.08) notes.push("Volatile recent form");

  return notes.slice(0, 4).join(" · ");
}

function computeDefenseEnvironment(games) {
  const positions = ["C", "LW", "RW", "D"];
  const byTeamPos = {};

  for (const game of games) {
    for (const db of game.defBlocks) {
      const teamName = normShort(db.team);
      if (!byTeamPos[teamName]) byTeamPos[teamName] = {};

      for (const pos of positions) {
        const s = db.posStats?.[pos];
        if (!s) continue;

        if (!byTeamPos[teamName][pos]) {
          byTeamPos[teamName][pos] = {
            shots: [],
            icf: [],
            iff: [],
            iscf: [],
            goals: [],
          };
        }

        byTeamPos[teamName][pos].shots.push(s.shotsAllowed || 0);
        byTeamPos[teamName][pos].icf.push(s.icfAllowed || 0);
        byTeamPos[teamName][pos].iff.push(s.iffAllowed || 0);
        byTeamPos[teamName][pos].iscf.push(s.iscfAllowed || 0);
        byTeamPos[teamName][pos].goals.push(s.goalsAllowed || 0);
      }
    }
  }

  const teamPosAvg = {};
  for (const [team, posMap] of Object.entries(byTeamPos)) {
    teamPosAvg[team] = {};

    for (const pos of positions) {
      const entry = posMap[pos];
      if (!entry) continue;

      teamPosAvg[team][pos] = {
        shots: average(entry.shots),
        icf: average(entry.icf),
        iff: average(entry.iff),
        iscf: average(entry.iscf),
        goals: average(entry.goals),
      };
    }
  }

  const rankMap = {};
  const avgMap = {};
  const teamCountMap = {};

  for (const pos of positions) {
    const entries = Object.entries(teamPosAvg)
      .filter(([, posMap]) => posMap[pos])
      .map(([team, stats]) => ({
        team,
        shots: stats[pos].shots,
        icf: stats[pos].icf,
        iff: stats[pos].iff,
        iscf: stats[pos].iscf,
        goals: stats[pos].goals,
      }));

    teamCountMap[pos] = entries.length;

    avgMap[pos] = {
      shots: average(entries.map((e) => e.shots)),
      icf: average(entries.map((e) => e.icf)),
      iff: average(entries.map((e) => e.iff)),
      iscf: average(entries.map((e) => e.iscf)),
      goals: average(entries.map((e) => e.goals)),
    };

    const metricRanks = {};

    for (const metric of ["shots", "icf", "iff", "iscf"]) {
      metricRanks[metric] = {};

      [...entries]
        .sort((a, b) => b[metric] - a[metric])
        .forEach((e, idx) => {
          metricRanks[metric][e.team] = idx + 1;
        });
    }

    const composite = entries.map((e) => ({
      team: e.team,
      composite:
        0.3 * metricRanks.shots[e.team] +
        0.25 * metricRanks.icf[e.team] +
        0.25 * metricRanks.iff[e.team] +
        0.2 * metricRanks.iscf[e.team],
      shotsRank: metricRanks.shots[e.team],
      icfRank: metricRanks.icf[e.team],
      iffRank: metricRanks.iff[e.team],
      iscfRank: metricRanks.iscf[e.team],
    }));

    composite.sort((a, b) => a.composite - b.composite);

    composite.forEach((e, idx) => {
      rankMap[`${e.team}|${pos}`] = {
        compositeRank: idx + 1,
        compositeScore: e.composite,
        shotsRank: e.shotsRank,
        icfRank: e.icfRank,
        iffRank: e.iffRank,
        iscfRank: e.iscfRank,
      };
    });
  }

  return {
    teamPosAvg,
    rankMap,
    avgMap,
    teamCountMap,
  };
}

// ─── LEAK HELPERS ────────────────────────────────────────────────────────────

function leakScoreFromRank(rank, totalTeams = 32) {
  if (!rank || !totalTeams || totalTeams < 2) return null;
  return Math.round(((totalTeams - rank) / (totalTeams - 1)) * 100);
}

function leakTierFromScore(score) {
  if (score == null) return "Unknown";
  if (score >= 90) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Neutral+";
  if (score >= 35) return "Neutral";
  return "Suppressive";
}

function shotTierFromLeak(score) {
  if (score == null) return "—";
  if (score >= 85) return "5+ lane";
  if (score >= 75) return "4+ lane";
  if (score >= 65) return "3+ lane";
  return "No auto lane";
}

function goalTierFromProb(p1g, p2g) {
  if ((p2g ?? 0) >= 0.15) return "2G live";
  if ((p1g ?? 0) >= 0.35) return "1G live";
  if ((p1g ?? 0) >= 0.2) return "Thin 1G";
  return "Avoid";
}

function scorerTierInfo(skater, todayLine, effectiveToi, posKey) {
  const goalsSeason = skater.goalsSeason || 0;
  const goalsL5 = skater.goalsL5 ?? goalsSeason;
  const shotsSeason = skater.shotsSeason || 0;
  const shotsL5 = skater.shotsL5 ?? shotsSeason;
  const iscfSeason = skater.iscfSeason || 0;
  const iscfL5 = skater.iscfL5 ?? iscfSeason;
  const toiSeason = skater.toiSeason || effectiveToi || 0;
  const toiL5 = skater.toiL5 ?? toiSeason;

  const goalsBlend = 0.78 * goalsSeason + 0.22 * goalsL5;
  const shotsBlend = 0.68 * shotsSeason + 0.32 * shotsL5;
  const iscfBlend = 0.68 * iscfSeason + 0.32 * iscfL5;
  const toiBlend = 0.75 * (effectiveToi || toiSeason) + 0.25 * (toiL5 || toiSeason || effectiveToi || 0);

  let score = goalsBlend * 1.55 + Math.min(4.5, iscfBlend) * 0.16 + Math.min(5.5, shotsBlend) * 0.06;
  if (todayLine === 1) score += 0.08;
  else if (todayLine === 2) score += 0.03;
  else if (todayLine >= 3) score -= 0.06;
  if (toiBlend >= 19) score += 0.05;
  else if (toiBlend < 15.5) score -= 0.06;
  if (posKey === "D") score -= 0.18;

  let tier = "low";
  let baseMult = 0.86;
  if (score >= 0.95) {
    tier = "elite";
    baseMult = 1.18;
  } else if (score >= 0.67) {
    tier = "good";
    baseMult = 1.06;
  } else if (score >= 0.42) {
    tier = "average";
    baseMult = 0.96;
  }

  return {
    tier,
    score: +score.toFixed(3),
    baseMult: +baseMult.toFixed(3),
    goalsBlend: +goalsBlend.toFixed(3),
    shotsBlend: +shotsBlend.toFixed(3),
    iscfBlend: +iscfBlend.toFixed(3),
  };
}

function last5GoalFormMultiplier(skater) {
  const shotsSeason = skater.shotsSeason || 0;
  const shotsL5 = skater.shotsL5 ?? shotsSeason;
  const iscfSeason = skater.iscfSeason || 0;
  const iscfL5 = skater.iscfL5 ?? iscfSeason;
  const toiSeason = skater.toiSeason || 0;
  const toiL5 = skater.toiL5 ?? toiSeason;
  const goalsSeason = skater.goalsSeason || 0;
  const goalsL5 = skater.goalsL5 ?? goalsSeason;

  const oppTrend = 0.45 * safeRatio(shotsL5, Math.max(0.25, shotsSeason), 1)
    + 0.40 * safeRatio(iscfL5, Math.max(0.2, iscfSeason), 1)
    + 0.15 * safeRatio(toiL5, Math.max(8, toiSeason), 1);
  let mult = clamp(0.9 + (oppTrend - 1) * 0.28, 0.88, 1.14);

  const rawGoalSpike = goalsL5 > goalsSeason * 1.45;
  if (rawGoalSpike && oppTrend < 1.02) mult = Math.min(mult, 1.02);
  if (!rawGoalSpike && oppTrend > 1.08) mult = Math.max(mult, 1.05);
  return +mult.toFixed(3);
}

function defenseGoalMultiplier(teamPos, defenseAvg, posKey) {
  if (!teamPos || !defenseAvg) return 1;
  const goalsRatio = safeRatio(teamPos.goals || 0, Math.max(0.65, defenseAvg.goals || 0.65), 1);
  const iscfRatio = safeRatio(teamPos.iscf || 0, Math.max(3.5, defenseAvg.iscf || 3.5), 1);
  const shotsRatio = safeRatio(teamPos.shots || 0, Math.max(3.5, defenseAvg.shots || 3.5), 1);

  let composite = 0.5 * goalsRatio + 0.3 * iscfRatio + 0.2 * shotsRatio;
  if (posKey === "D") composite = 0.35 * goalsRatio + 0.35 * iscfRatio + 0.3 * shotsRatio;
  return +clamp(composite, 0.82, 1.22).toFixed(3);
}

function roleGoalAccessMultiplier(todayLine, effectiveToi) {
  let mult = 1;
  if (todayLine === 1) mult += 0.1;
  else if (todayLine === 2) mult += 0.04;
  else if (todayLine >= 3) mult -= 0.12;
  if (effectiveToi >= 19) mult += 0.03;
  else if (effectiveToi < 15.5) mult -= 0.08;
  return +clamp(mult, 0.68, 1.18).toFixed(3);
}

function goalCapsForTier(tier, posKey, todayLine, leakOverrideActive = false) {
  let p1 = 0.16;
  let p2 = 0.02;
  if (tier === "average") {
    p1 = 0.24;
    p2 = 0.04;
  } else if (tier === "good") {
    p1 = 0.31;
    p2 = 0.08;
  } else if (tier === "elite") {
    p1 = 0.38;
    p2 = 0.12;
  }

  if (todayLine >= 3) {
    p1 -= 0.04;
    p2 -= 0.02;
  } else if (todayLine === 2) {
    p1 -= 0.03;
    p2 -= 0.01;
  }

  if (leakOverrideActive && tier !== "low") {
    p1 += 0.01;
    if (tier === "elite") p2 += 0.01;
  }

  if (posKey === "D") {
    p1 = Math.min(p1, 0.10);
    p2 = Math.min(p2, 0.02);
  }

  return { p1: +clamp(p1, 0.05, 0.42).toFixed(3), p2: +clamp(p2, 0.002, 0.12).toFixed(3) };
}


function applyShotLadderHierarchy({
  p3,
  p4,
  p5,
  posKey,
  shotFloorLevel,
  fourPlusGate,
  defenseRoleBoost,
  ceilingEngine,
  archetype,
  isShotDriver,
  isEliteShotDriver,
  isSecondaryShooter,
}) {
  let nextP3 = Math.max(0, p3 || 0);
  let nextP4 = Math.max(0, p4 || 0);
  let nextP5 = Math.max(0, p5 || 0);

  const dman = posKey === 'D';
  const cap4 = Math.max(
    fourPlusGate?.maxP4 || 0,
    archetype?.p4Cap || 0,
    defenseRoleBoost?.p4Floor || 0,
    ceilingEngine?.p4Floor || 0,
  );
  const cap5 = Math.max(
    fourPlusGate?.maxP5 || 0,
    archetype?.p5Cap || 0,
    ceilingEngine?.p5Floor || 0,
    defenseRoleBoost?.enable5Ceiling ? (dman ? 0.08 : 0.18) : 0,
  );

  const driver3Floor =
    shotFloorLevel === 'elite' ? (dman ? 0.34 : 0.56) :
    shotFloorLevel === 'good' ? (dman ? 0.24 : 0.42) :
    shotFloorLevel === 'average' ? (dman ? 0.14 : 0.24) :
    0;

  if (!isSecondaryShooter && !dman && shotFloorLevel !== 'weak') {
    nextP3 = Math.max(nextP3, Math.min(driver3Floor, cap4 > 0 ? cap4 + 0.18 : driver3Floor));
  }

  // 4+ should be conditional on real 3+ strength, not independent.
  const p4FloorFromP3 =
    nextP3 >= (dman ? 0.34 : 0.58) ? nextP3 * (dman ? 0.42 : 0.52) :
    nextP3 >= (dman ? 0.24 : 0.44) ? nextP3 * (dman ? 0.32 : 0.40) :
    nextP3 >= (dman ? 0.16 : 0.28) ? nextP3 * (dman ? 0.22 : 0.28) :
    0;

  const p4CapFromP3 = nextP3 * (isEliteShotDriver ? 0.88 : isShotDriver ? 0.80 : dman ? 0.62 : 0.68);
  nextP4 = Math.max(nextP4, p4FloorFromP3, defenseRoleBoost?.p4Floor || 0, ceilingEngine?.p4Floor || 0);
  nextP4 = Math.min(nextP4, p4CapFromP3, Math.max(cap4, p4CapFromP3));

  // 5+ should come off 4+, with ceiling logic only increasing the tail.
  const p5FloorFromP4 =
    nextP4 >= (dman ? 0.16 : 0.30) ? nextP4 * (dman ? 0.22 : 0.34) :
    nextP4 >= (dman ? 0.10 : 0.20) ? nextP4 * (dman ? 0.14 : 0.24) :
    0;

  const p5CapFromP4 = nextP4 * (isEliteShotDriver ? 0.68 : isShotDriver ? 0.54 : dman ? 0.38 : 0.42);
  nextP5 = Math.max(nextP5, p5FloorFromP4, ceilingEngine?.p5Floor || 0);
  if (defenseRoleBoost?.enable5Ceiling) {
    nextP5 = Math.max(nextP5, Math.min(dman ? 0.08 : 0.18, nextP4 * (dman ? 0.26 : 0.38)));
  }
  nextP5 = Math.min(nextP5, p5CapFromP4, Math.max(cap5, p5CapFromP4));

  // Monotonic safety.
  nextP4 = Math.min(nextP4, nextP3 * (dman ? 0.92 : 0.95));
  nextP5 = Math.min(nextP5, nextP4 * (dman ? 0.88 : 0.92));

  return {
    p3: +clamp(nextP3, 0, dman ? 0.82 : 0.96).toFixed(4),
    p4: +clamp(nextP4, 0, dman ? 0.46 : 0.78).toFixed(4),
    p5: +clamp(nextP5, 0, dman ? 0.16 : 0.42).toFixed(4),
  };
}

function buildGoalProbabilityFromPipeline({
  posKey,
  todayLine,
  style = 'Balanced',
  finisherGate = null,
  scorerTier,
  p1p,
  p2p,
  baseLambdaG,
  expectedGoalsBudget,
  playerGoalShare,
  goalShareOfPoints,
  dangerRate,
  convBlend,
  effectiveToi,
  goalsSeason,
  goalsL5,
  shotsSeason,
  roleGoalAdj,
  venueGoalMult,
  teamRoleGoalAdj,
  defenseGoalMult,
  roleGoalMult,
  histGoalMult1,
  histGoalMult2,
  broadGoalEnv,
  distributedGoalEnv,
  goalRankTeam,
  goalRankPos,
}) {
  const compressedDefense = 1 + (defenseGoalMult - 1) * 0.34;
  const compressedRole = 1 + (roleGoalMult - 1) * 0.24;
  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18;
  const compressedTeamRole = 1 + (teamRoleGoalAdj - 1) * 0.24;
  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22;
  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18;
  const compressedRoleAdj = 1 + (roleGoalAdj - 1) * 0.22;

  const environmentBoost =
    distributedGoalEnv ? 1.10 :
    broadGoalEnv ? 1.05 :
    1.0;

  const opportunityLambda = clamp(
    baseLambdaG *
      compressedDefense *
      compressedRole *
      compressedVenue *
      compressedTeamRole *
      compressedHist1 *
      compressedRoleAdj *
      environmentBoost,
    0.012,
    posKey === "D" ? 0.24 : todayLine === 1 ? 0.72 : todayLine === 2 ? 0.56 : 0.40
  );

  const opportunityProb = poissonAtLeast(opportunityLambda, 1);
  const expectedGoalProb = clamp(
    expectedGoalsBudget * (distributedGoalEnv ? 1.20 : broadGoalEnv ? 1.10 : 0.98),
    0.01,
    posKey === "D" ? 0.20 : todayLine === 1 ? 0.56 : todayLine === 2 ? 0.42 : 0.28
  );

  const goalsBlend = 0.78 * goalsSeason + 0.22 * goalsL5;
  const shotsBlend = shotsSeason || 0;
  const finisherProfile = clamp(
    0.12 +
      scorerTier.score * 0.050 +
      goalShareOfPoints * 0.30 +
      (dangerRate - 0.34) * 0.24 +
      (convBlend - 0.60) * 0.12 +
      goalsBlend * 0.22 +
      (shotsBlend >= 3.0 ? 0.018 : shotsBlend >= 2.0 ? 0.010 : 0),
    posKey === "D" ? 0.07 : 0.14,
    posKey === "D" ? 0.26 : 0.46
  );

  const pointGate = clamp(
    p1p * (posKey === "D" ? 0.58 : todayLine === 1 ? 0.72 : todayLine === 2 ? 0.66 : 0.56),
    0.01,
    posKey === "D" ? 0.24 : todayLine === 1 ? 0.54 : todayLine === 2 ? 0.42 : 0.28
  );

  const finishingAccess = clamp(
    0.38 * opportunityProb +
    0.30 * expectedGoalProb +
    0.18 * (playerGoalShare * (distributedGoalEnv ? 1.18 : broadGoalEnv ? 1.10 : 1.0)) +
    0.14 * pointGate,
    0.01,
    posKey === "D" ? 0.22 : todayLine === 1 ? 0.62 : todayLine === 2 ? 0.48 : 0.32
  );

  let p1 = clamp(
    finishingAccess * finisherProfile,
    0.0005,
    posKey === "D" ? 0.18 : todayLine === 1 ? 0.48 : todayLine === 2 ? 0.36 : 0.24
  );

  const teamRankPenalty =
    goalRankTeam <= 2 ? 1.0 :
    goalRankTeam <= 4 ? 0.94 :
    distributedGoalEnv && goalRankTeam <= 6 ? 0.88 :
    broadGoalEnv && goalRankTeam <= 5 ? 0.84 :
    0.76;
  const posRankPenalty =
    goalRankPos <= 1 ? 1.0 :
    goalRankPos <= 2 ? 0.92 :
    distributedGoalEnv ? 0.86 : 0.76;

  p1 *= teamRankPenalty * posRankPenalty;

  const hardCap1 =
    posKey === "D" ? 0.14 :
    todayLine === 1 ? (distributedGoalEnv ? 0.44 : broadGoalEnv ? 0.41 : 0.38) :
    todayLine === 2 ? (distributedGoalEnv ? 0.34 : broadGoalEnv ? 0.31 : 0.28) :
    (distributedGoalEnv ? 0.24 : 0.22);

  p1 = clamp(p1, 0.0005, hardCap1);

  const multiGoalSkill = clamp(
    0.07 + scorerTier.score * 0.032 + goalShareOfPoints * 0.10 + (dangerRate - 0.34) * 0.06 + goalsBlend * 0.08,
    posKey === "D" ? 0.02 : 0.04,
    posKey === "D" ? 0.09 : 0.19
  );

  let p2 = Math.min(
    poissonAtLeast(opportunityLambda * compressedHist2 * 0.72, 2),
    p1 * multiGoalSkill,
    p2p * (posKey === "D" ? 0.28 : 0.44)
  );

  const hardCap2 =
    posKey === "D" ? 0.024 :
    todayLine === 1 ? 0.12 :
    todayLine === 2 ? 0.08 :
    0.045;
  p2 = clamp(p2, 0.0001, hardCap2);

  let p3 = Math.min(
    poissonAtLeast(opportunityLambda * 0.58, 3),
    p2 * 0.26,
    posKey === "D" ? 0.003 : 0.016
  );
  p3 = clamp(p3, 0.00001, posKey === "D" ? 0.003 : 0.016);

  return {
    p1: +p1.toFixed(4),
    p2: +p2.toFixed(4),
    p3: +p3.toFixed(4),
    opportunityLambda: +opportunityLambda.toFixed(4),
    opportunityProb: +opportunityProb.toFixed(4),
    expectedGoalProb: +expectedGoalProb.toFixed(4),
    finisherProfile: +finisherProfile.toFixed(4),
    pointGate: +pointGate.toFixed(4),
  };
}



function buildFinisherGoalModel({
  posKey,
  todayLine,
  effectiveToi,
  goalsSeason = 0,
  goalsL5 = 0,
  shotsSeason = 0,
  iscfSeason = 0,
  dangerRate = 0,
  convBlend = 0,
  leakScore = 0,
  environmentScore = 0,
  goalRankTeam = 99,
  goalRankPos = 99,
  hotRole = null,
}) {
  const dman = posKey === 'D';
  const topRole = todayLine <= 2;

  const goalsBlend = 0.74 * goalsSeason + 0.26 * goalsL5;
  const scoringSpike = goalsL5 >= Math.max(goalsSeason * 1.35, goalsSeason + (dman ? 0.04 : 0.14));

  const strongFinisherBase =
    goalsSeason >= (dman ? 0.10 : 0.24) ||
    goalsL5 >= (dman ? 0.12 : 0.32) ||
    iscfSeason >= (dman ? 0.9 : 1.7) ||
    dangerRate >= (dman ? 0.36 : 0.42) ||
    convBlend >= (dman ? 0.62 : 0.76);

  const safeLeakScore = Number.isFinite(Number(leakScore)) ? Number(leakScore) : 0;
  const matchupGood = environmentScore >= 72 || safeLeakScore >= 72 || goalRankPos <= 12 || goalRankTeam <= 10;
  const matchupNeutral = environmentScore >= 60 || safeLeakScore >= 60 || goalRankPos <= 18 || goalRankTeam <= 16;

  const active =
    effectiveToi >= (dman ? 20.0 : topRole ? 14.5 : 13.0) &&
    strongFinisherBase &&
    (matchupNeutral || scoringSpike || (hotRole?.primaryMarket === 'goals' && hotRole?.active));

  if (!active) {
    return {
      active: false,
      p1: 0,
      p2: 0,
      p3: 0,
      profile: 'off',
      label: '',
    };
  }

  let profile = 'finisher';
  if (
    goalsBlend >= (dman ? 0.14 : 0.30) &&
    (
      dangerRate >= (dman ? 0.40 : 0.46) ||
      convBlend >= (dman ? 0.68 : 0.80) ||
      goalsL5 >= (dman ? 0.16 : 0.38)
    )
  ) {
    profile = 'elite_finisher';
  }

  let p1 =
    (dman ? 0.05 : topRole ? 0.14 : 0.10) +
    Math.max(0, goalsBlend - (dman ? 0.08 : 0.18)) * 0.34 +
    Math.max(0, dangerRate - (dman ? 0.34 : 0.40)) * 0.12 +
    Math.max(0, convBlend - (dman ? 0.58 : 0.70)) * 0.18 +
    (scoringSpike ? (dman ? 0.025 : 0.10) : 0) +
    ((hotRole?.active && hotRole?.primaryMarket === 'goals') ? (profile === 'elite_finisher' ? 0.05 : 0.03) : 0);

  if (matchupGood) p1 += dman ? 0.01 : 0.03;
  else if (!matchupNeutral) p1 -= dman ? 0.01 : 0.02;

  if (todayLine === 1) p1 += 0.03;
  else if (todayLine >= 3) p1 -= 0.03;

  if (effectiveToi >= (dman ? 23.0 : 18.0)) p1 += 0.02;
  else if (effectiveToi < (dman ? 20.5 : 14.5)) p1 -= 0.015;

  if (
    !dman &&
    goalsL5 >= 0.30 &&
    shotsSeason < 2.5 &&
    effectiveToi >= 14.0
  ) {
    p1 += 0.04;
  }

  p1 += (!dman && (profile === 'finisher' || profile === 'elite_finisher')) ? 0.03 : 0;
  p1 = clamp(p1, dman ? 0.01 : 0.04, dman ? 0.22 : (profile === 'elite_finisher' ? 0.40 : 0.30));

  let p2 =
    (dman ? 0.006 : 0.016) +
    Math.max(0, goalsBlend - (dman ? 0.10 : 0.24)) * (dman ? 0.10 : 0.20) +
    ((!dman && scoringSpike) ? 0.016 : 0) +
    ((hotRole?.active && hotRole?.primaryMarket === 'goals' && profile === 'elite_finisher') ? 0.02 : 0);

  if (!dman && profile === 'elite_finisher' && (goalsL5 >= 0.4 || goalsSeason >= 0.30)) {
    p2 *= 1.18;
  }
  p2 = clamp(p2, 0.0005, dman ? 0.04 : (profile === 'elite_finisher' ? 0.12 : 0.075));
  const p3 = clamp(p2 * (dman ? 0.10 : 0.12), 0.00001, dman ? 0.008 : 0.016);

  return {
    active: true,
    p1: +p1.toFixed(4),
    p2: +p2.toFixed(4),
    p3: +p3.toFixed(4),
    profile,
    label: profile === 'elite_finisher' ? 'Elite Finisher Path' : 'Finisher Path',
  };
}


function playerShotFloorProfile(skater, posKey, todayLine, effectiveToi, iffAnchor, convBlend, dangerRate) {
  const shotsSeason = skater.shotsSeason || 0;
  const shotsL5 = skater.shotsL5 ?? shotsSeason;
  const iffSeason = skater.iffSeason || iffAnchor || 0;
  const iffL5 = skater.iffL5 ?? iffSeason;
  const iscfSeason = skater.iscfSeason || 0;
  const iscfL5 = skater.iscfL5 ?? iscfSeason;
  const toiSeason = skater.toiSeason || effectiveToi || 0;
  const toiL5 = skater.toiL5 ?? toiSeason;

  const shotBlend = 0.72 * shotsSeason + 0.28 * shotsL5;
  const iffBlendLocal = 0.72 * iffSeason + 0.28 * iffL5;
  const iscfBlend = 0.72 * iscfSeason + 0.28 * iscfL5;
  const toiBlend = 0.7 * toiSeason + 0.3 * toiL5;

  let score = 0;
  score += Math.min(1.8, shotBlend / (posKey === 'D' ? 2.2 : 3.0)) * 0.34;
  score += Math.min(1.8, iffBlendLocal / (posKey === 'D' ? 4.3 : 5.8)) * 0.25;
  score += Math.min(1.8, iscfBlend / (posKey === 'D' ? 1.0 : 2.2)) * 0.18;
  score += Math.min(1.4, toiBlend / (posKey === 'D' ? 22 : 18.5)) * 0.12;
  score += Math.min(1.2, convBlend / (posKey === 'D' ? 0.56 : 0.66)) * 0.06;
  score += Math.min(1.2, dangerRate / 0.42) * 0.05;

  if (todayLine === 1) score += 0.06;
  else if (todayLine === 2) score += 0.01;
  else if (todayLine >= 3) score -= 0.08;
  if (posKey === 'D') score -= 0.08;

  const level = score >= 0.93 ? 'elite' : score >= 0.72 ? 'good' : score >= 0.5 ? 'average' : 'weak';
  const defDamp = level === 'elite' ? 1.0 : level === 'good' ? 0.82 : level === 'average' ? 0.64 : 0.48;
  const max4 = level === 'elite' ? 0.8 : level === 'good' ? 0.68 : level === 'average' ? 0.5 : 0.34;
  const max5 = level === 'elite' ? 0.62 : level === 'good' ? 0.42 : level === 'average' ? 0.24 : 0.12;
  const premium4Open = level === 'elite' || level === 'good' || (level === 'average' && shotBlend >= (posKey === 'D' ? 1.8 : 2.35) && toiBlend >= (posKey === 'D' ? 21 : 17));

  return {
    level,
    score: +score.toFixed(3),
    defDamp: +defDamp.toFixed(3),
    max4: +max4.toFixed(3),
    max5: +max5.toFixed(3),
    premium4Open,
    shotBlend: +shotBlend.toFixed(3),
    iffBlend: +iffBlendLocal.toFixed(3),
    iscfBlend: +iscfBlend.toFixed(3),
    toiBlend: +toiBlend.toFixed(3),
  };
}

function playerGoalFloorProfile(skater, posKey, todayLine, effectiveToi) {
  const goalsSeason = skater.goalsSeason || 0;
  const goalsL5 = skater.goalsL5 ?? goalsSeason;
  const shotsSeason = skater.shotsSeason || 0;
  const shotsL5 = skater.shotsL5 ?? shotsSeason;
  const iscfSeason = skater.iscfSeason || 0;
  const iscfL5 = skater.iscfL5 ?? iscfSeason;
  const toiSeason = skater.toiSeason || effectiveToi || 0;
  const toiL5 = skater.toiL5 ?? toiSeason;

  const goalBlend = 0.76 * goalsSeason + 0.24 * goalsL5;
  const shotBlend = 0.72 * shotsSeason + 0.28 * shotsL5;
  const iscfBlend = 0.68 * iscfSeason + 0.32 * iscfL5;
  const toiBlend = 0.7 * toiSeason + 0.3 * toiL5;

  let score = 0;
  score += Math.min(1.8, goalBlend / (posKey === 'D' ? 0.12 : 0.34)) * 0.42;
  score += Math.min(1.8, iscfBlend / (posKey === 'D' ? 0.9 : 2.1)) * 0.28;
  score += Math.min(1.5, shotBlend / (posKey === 'D' ? 1.8 : 2.7)) * 0.18;
  score += Math.min(1.4, toiBlend / (posKey === 'D' ? 21 : 18)) * 0.12;

  if (todayLine === 1) score += 0.05;
  else if (todayLine >= 3) score -= 0.07;
  if (posKey === 'D') score -= 0.18;

  const level = score >= 0.95 ? 'elite' : score >= 0.72 ? 'good' : score >= 0.52 ? 'average' : 'weak';
  const defDamp = level === 'elite' ? 1.0 : level === 'good' ? 0.84 : level === 'average' ? 0.66 : 0.48;
  const max1 = level === 'elite' ? 0.5 : level === 'good' ? 0.4 : level === 'average' ? 0.3 : 0.22;
  const max2 = level === 'elite' ? 0.22 : level === 'good' ? 0.12 : level === 'average' ? 0.06 : 0.02;
  const premium1Open = level === 'elite' || level === 'good' || (level === 'average' && goalBlend >= (posKey === 'D' ? 0.1 : 0.24) && iscfBlend >= (posKey === 'D' ? 0.8 : 1.8));

  return {
    level,
    score: +score.toFixed(3),
    defDamp: +defDamp.toFixed(3),
    max1: +max1.toFixed(3),
    max2: +max2.toFixed(3),
    premium1Open,
    goalBlend: +goalBlend.toFixed(3),
    shotBlend: +shotBlend.toFixed(3),
    iscfBlend: +iscfBlend.toFixed(3),
    toiBlend: +toiBlend.toFixed(3),
  };
}

function rwShotFilterContext({ skater, effectiveToi, todayLine, lineShare, histS3Rate, histS4Rate, histS5Rate, iffAnchor, goalLeakOverride }) {
  const shots = skater.shotsSeason || 0;
  const iff = skater.iffSeason || iffAnchor || 0;
  const icf = skater.icfSeason || 0;
  const iscf = skater.iscfSeason || 0;
  const goals = skater.goalsSeason || 0;

  const eliteVolume =
    effectiveToi >= 19.0 &&
    shots >= 3.2 &&
    iff >= 4.8 &&
    icf >= 6.5 &&
    iscf >= 2.5;

  const volumeCapable =
    !eliteVolume &&
    effectiveToi >= 17.0 &&
    shots >= 2.5 &&
    iff >= 4.0 &&
    icf >= 5.0 &&
    iscf >= 2.0;

  const finisher =
    !eliteVolume &&
    (
      (effectiveToi >= 15.0 && (goals >= 0.28 || iscf >= 2.1) && (shots < 2.5 || iff < 4.0)) ||
      (!volumeCapable && iff < 4.0)
    );

  const can3 =
    eliteVolume ||
    (
      volumeCapable &&
      effectiveToi >= 17.0 &&
      shots >= 2.5 &&
      iff >= 4.0 &&
      ((histS3Rate || 0) >= 0.40 || icf >= 5.4)
    );

  const can4 =
    eliteVolume &&
    effectiveToi >= 18.5 &&
    shots >= 3.0 &&
    iff >= 4.5;

  const can5 =
    eliteVolume &&
    effectiveToi >= 19.5 &&
    shots >= 3.5 &&
    iff >= 5.0 &&
    iscf >= 2.8;

  let p3Mult = 1;
  let p4Mult = 1;
  let p5Mult = 1;

  if (!eliteVolume) {
    p3Mult *= volumeCapable ? 0.72 : 0.42;
    p4Mult *= 0.22;
    p5Mult *= 0.08;
  }

  if (finisher) {
    p3Mult *= 0.55;
    p4Mult *= 0.35;
    p5Mult *= 0.20;
  }

  if (goalLeakOverride?.flag && goalLeakOverride?.routeToGoal && !eliteVolume) {
    p3Mult *= 0.58;
    p4Mult *= 0.32;
    p5Mult *= 0.12;
  }

  const maxP3 = eliteVolume ? 1 : can3 ? 0.62 : volumeCapable ? 0.38 : 0.16;
  const maxP4 = eliteVolume ? 0.72 : 0.08;
  const maxP5 = eliteVolume ? 0.42 : 0.03;

  const primaryMarket = goalLeakOverride?.flag && !eliteVolume
    ? 'goal'
    : eliteVolume
    ? 'shots'
    : finisher
    ? 'goal'
    : volumeCapable
    ? 'point'
    : 'goal';

  return {
    eliteVolume,
    volumeCapable,
    balanced: volumeCapable,
    finisher,
    can3,
    can4,
    can5,
    p3Mult: +p3Mult.toFixed(3),
    p4Mult: +p4Mult.toFixed(3),
    p5Mult: +p5Mult.toFixed(3),
    maxP3: +maxP3.toFixed(3),
    maxP4: +maxP4.toFixed(3),
    maxP5: +maxP5.toFixed(3),
    primaryMarket,
    reason: eliteVolume
      ? 'RW elite-volume shooter'
      : volumeCapable
      ? (can3 ? 'RW volume-capable 3+ only' : 'RW volume-capable but blocked')
      : 'RW finisher route — no SOG',
  };
}

function fourPlusShotGateContext({ skater, effectiveToi, iffAnchor, posKey = "C", todayLine = 1, teamPos = null, leakScore = null, environmentScore = null, histS4Rate = null, histS5Rate = null }) {
  const shots = skater.shotsSeason || 0;
  const iff = skater.iffSeason || iffAnchor || 0;
  const icf = skater.icfSeason || 0;
  const iscf = skater.iscfSeason || 0;

  const elite4 =
    effectiveToi >= 18.5 &&
    shots >= 3.1 &&
    iff >= 4.5;

  const support4 = icf >= 5.5 || iscf >= 2.1;
  const borderBand4 = iff >= 3.9 && iff < 4.2;
  const tierBSupport = icf >= 6.0 && iscf >= 2.3;
  const tierA4 =
    effectiveToi >= 17.5 &&
    shots >= 2.7 &&
    iff >= 4.2 &&
    support4;
  const tierB4 =
    effectiveToi >= 17.5 &&
    shots >= 2.7 &&
    borderBand4 &&
    tierBSupport;

  const dSuppressed =
    posKey === 'D' && (
      (leakScore != null && leakScore < 34) ||
      ((teamPos?.shots || 0) > 0 && (teamPos?.shots || 0) < 7.0 && (teamPos?.icf || 0) < 18.0)
    );
  const dEnvOpen =
    posKey === 'D' && !dSuppressed && (
      (environmentScore != null && environmentScore >= 56) ||
      (leakScore != null && leakScore >= 45) ||
      (teamPos?.shots || 0) >= 7.8 ||
      (teamPos?.icf || 0) >= 19.0 ||
      (teamPos?.iff || 0) >= 12.0 ||
      (histS4Rate || 0) >= 0.12
    );
  const dRolePath4 =
    posKey === 'D' &&
    todayLine <= 2 &&
    effectiveToi >= 22.0 &&
    shots >= 2.2 &&
    icf >= 5.0 &&
    (iff >= 3.0 || iscf >= 1.0);
  const dRolePath5 =
    dRolePath4 &&
    effectiveToi >= 23.5 &&
    shots >= 2.5 &&
    icf >= 5.8 &&
    iff >= 3.4;
  const dPath2_4 = dRolePath4 && dEnvOpen;
  const dPath2_5 = dRolePath5 && ((histS5Rate || 0) >= 0.04 || ((teamPos?.shots || 0) >= 8.3 && (teamPos?.icf || 0) >= 20.0));

  const core4 = tierA4 || tierB4 || dPath2_4;
  const can4 = elite4 || core4;
  const can5 =
    (elite4 &&
      effectiveToi >= 19.5 &&
      shots >= 3.5 &&
      iff >= 5.0 &&
      iscf >= 2.8) ||
    dPath2_5;

  const tier = elite4
    ? 'eliteVolume'
    : tierA4
    ? 'strongVolume'
    : tierB4
    ? 'borderlineVolume'
    : dPath2_4
    ? 'roleEnvironmentD'
    : iff >= 3.2
    ? 'marginalVolume'
    : 'finisher';

  let p4Mult = 1;
  let p5Mult = 1;
  if (!can4) {
    if (posKey === 'D' && dRolePath4 && !dSuppressed) p4Mult *= 0.34;
    else p4Mult *= tier === 'marginalVolume' ? 0.22 : 0.06;
  } else if (tier === 'borderlineVolume') {
    p4Mult *= 0.94;
  } else if (tier === 'roleEnvironmentD') {
    p4Mult *= 1.08;
  }
  if (!can5) {
    if (posKey === 'D' && dRolePath5 && !dSuppressed) p5Mult *= 0.16;
    else p5Mult *= elite4 ? 0.22 : tier === 'marginalVolume' ? 0.08 : 0.03;
  } else if (tier === 'roleEnvironmentD') {
    p5Mult *= 0.86;
  }

  const maxP4 =
    elite4 ? 0.72 :
    tierA4 ? 0.58 :
    tierB4 ? 0.52 :
    dPath2_4 ? Math.max(0.18, Math.min(0.34, 0.16 + Math.max(0, ((histS4Rate || 0) - 0.10)) * 1.2 + ((teamPos?.shots || 0) >= 8.3 ? 0.06 : 0.0))) :
    tier === 'marginalVolume' ? 0.12 : 0.05;
  const maxP5 =
    can5 ? (elite4 ? 0.42 : 0.12) :
    elite4 ? 0.10 :
    dRolePath5 && !dSuppressed ? 0.06 : 0.03;

  return {
    tier,
    elite4,
    tierA4,
    tierB4,
    dPath2_4,
    dPath2_5,
    can4,
    can5,
    p4Mult: +p4Mult.toFixed(3),
    p5Mult: +p5Mult.toFixed(3),
    maxP4: +maxP4.toFixed(3),
    maxP5: +maxP5.toFixed(3),
    reason: can4
      ? elite4
        ? '4+ gate open — elite-volume profile'
        : tierA4
        ? '4+ gate open — Tier A strong-volume profile'
        : tierB4
        ? '4+ gate open — Tier B borderline profile'
        : '4+ gate open — D role + environment path'
      : posKey === 'D' && dRolePath4 && dSuppressed
      ? '4+ gate blocked — D suppression environment'
      : '4+ gate blocked — iFF / support profile short',
  };
}

function histAdj(playerToi, profile) {
  if (!profile || !playerToi) return { mult: 1, delta: null };

  const ratio = playerToi / profile.avgToi;
  const mult = Math.max(0.7, Math.min(1.25, 0.7 + ratio * 0.55));

  return {
    mult: +mult.toFixed(3),
    delta: +(ratio - 1).toFixed(2),
    histAvgToi: profile.avgToi,
    n: profile.n,
    total: profile.total,
    hitRate: profile.hitRate,
  };
}


function environmentTierFromScore(score) {
  if (score >= 82) return "S";
  if (score >= 72) return "A";
  if (score >= 62) return "B";
  if (score >= 52) return "C";
  return "D";
}

function pickVenueProfile(histPos, isHome) {
  const venueProfile = isHome ? histPos?._home : histPos?._away;
  return venueProfile || histPos || null;
}


function dFallbackBaseRate(key, teamPos, defenseAvg) {
  const shotsRatio = safeRatio(teamPos?.shots || 0, Math.max(6.5, defenseAvg?.shots || 6.5), 1);
  const icfRatio = safeRatio(teamPos?.icf || 0, Math.max(17, defenseAvg?.icf || 17), 1);
  const iffRatio = safeRatio(teamPos?.iff || 0, Math.max(11, defenseAvg?.iff || 11), 1);
  const goalRatio = safeRatio(teamPos?.goals || 0, Math.max(0.4, defenseAvg?.goals || 0.4), 1);
  const volumeIdx = clamp(0.42 * shotsRatio + 0.33 * icfRatio + 0.25 * iffRatio, 0.65, 1.70);
  const scoringIdx = clamp(0.55 * goalRatio + 0.25 * shotsRatio + 0.20 * icfRatio, 0.60, 1.85);
  if (key === 's3') return clamp(0.19 + (volumeIdx - 1) * 0.20, 0.11, 0.38);
  if (key === 's4') return clamp(0.085 + (volumeIdx - 1) * 0.12, 0.03, 0.22);
  if (key === 's5') return clamp(0.025 + (volumeIdx - 1) * 0.055, 0.006, 0.10);
  if (key === 'p1') return clamp(0.26 + (volumeIdx - 1) * 0.16 + (scoringIdx - 1) * 0.07, 0.14, 0.48);
  if (key === 'p2') return clamp(0.055 + (volumeIdx - 1) * 0.06 + (scoringIdx - 1) * 0.045, 0.012, 0.16);
  if (key === 'g1') return clamp(0.085 + (scoringIdx - 1) * 0.10, 0.025, 0.24);
  if (key === 'g2') return clamp(0.012 + (scoringIdx - 1) * 0.025, 0.002, 0.05);
  return 0;
}

function defensemanEnvironmentTier(teamPos, defenseAvg, environmentScore) {
  const shotsRatio = safeRatio(teamPos?.shots || 0, Math.max(6.8, defenseAvg?.shots || 6.8), 1);
  const icfRatio = safeRatio(teamPos?.icf || 0, Math.max(17.5, defenseAvg?.icf || 17.5), 1);
  const iffRatio = safeRatio(teamPos?.iff || 0, Math.max(11.2, defenseAvg?.iff || 11.2), 1);
  const goalsRatio = safeRatio(teamPos?.goals || 0, Math.max(0.42, defenseAvg?.goals || 0.42), 1);
  const volumeIdx = 0.42 * shotsRatio + 0.33 * icfRatio + 0.25 * iffRatio;
  const scoringIdx = 0.58 * goalsRatio + 0.22 * shotsRatio + 0.20 * icfRatio;

  const shotTier =
    (environmentScore >= 74 || (teamPos?.shots || 0) >= 8.7 || volumeIdx >= 1.18) ? 'high' :
    (environmentScore >= 60 || (teamPos?.shots || 0) >= 7.7 || volumeIdx >= 1.03) ? 'neutral' :
    'suppressed';

  const pointTier =
    (environmentScore >= 72 || volumeIdx >= 1.15) ? 'high' :
    (environmentScore >= 58 || volumeIdx >= 0.99) ? 'neutral' :
    'suppressed';

  const goalTier =
    (environmentScore >= 68 || (teamPos?.goals || 0) >= 0.72 || scoringIdx >= 1.15) ? 'high' :
    (environmentScore >= 56 || (teamPos?.goals || 0) >= 0.52 || scoringIdx >= 1.00) ? 'neutral' :
    'suppressed';

  return { shotTier, pointTier, goalTier, volumeIdx, scoringIdx };
}

function defensemanTierBaseline(key, tier) {
  const map = {
    s3: { high: 0.23, neutral: 0.20, suppressed: 0.16 },
    s4: { high: 0.12, neutral: 0.09, suppressed: 0.055 },
    s5: { high: 0.05, neutral: 0.032, suppressed: 0.015 },
    p1: { high: 0.40, neutral: 0.34, suppressed: 0.28 },
    p2: { high: 0.09, neutral: 0.065, suppressed: 0.04 },
    g1: { high: 0.17, neutral: 0.13, suppressed: 0.09 },
    g2: { high: 0.025, neutral: 0.014, suppressed: 0.007 },
  };
  return map[key]?.[tier] ?? 0;
}

function defensemanCapabilityProfile(skater, effectiveToi, todayLine) {
  const shots = skater.shotsSeason || 0;
  const icf = skater.icfSeason || 0;
  const iff = skater.iffSeason || 0;
  const iscf = skater.iscfSeason || 0;
  const goals = skater.goalsSeason || 0;
  const assists = skater.astSeason || 0;
  const points = goals + assists;

  let shotScore = 0;
  if (effectiveToi >= 22) shotScore += 1.2;
  else if (effectiveToi >= 20) shotScore += 0.8;
  else if (effectiveToi >= 18) shotScore += 0.35;
  if (shots >= 2.8) shotScore += 1.2;
  else if (shots >= 2.4) shotScore += 0.95;
  else if (shots >= 2.1) shotScore += 0.65;
  else if (shots >= 1.8) shotScore += 0.35;
  if (icf >= 6.5) shotScore += 1.1;
  else if (icf >= 5.5) shotScore += 0.85;
  else if (icf >= 5.0) shotScore += 0.65;
  else if (icf >= 4.4) shotScore += 0.35;
  if (iff >= 4.0) shotScore += 0.6;
  else if (iff >= 3.2) shotScore += 0.35;
  if (iscf >= 1.4) shotScore += 0.25;
  else if (iscf >= 1.0) shotScore += 0.12;
  if (todayLine <= 1) shotScore += 0.25;
  else if (todayLine >= 3) shotScore -= 0.20;

  let pointScore = 0;
  if (effectiveToi >= 22) pointScore += 1.0;
  else if (effectiveToi >= 20) pointScore += 0.7;
  if (points >= 0.55) pointScore += 1.1;
  else if (points >= 0.40) pointScore += 0.8;
  else if (points >= 0.28) pointScore += 0.5;
  if (assists >= 0.28) pointScore += 0.45;
  else if (assists >= 0.18) pointScore += 0.25;
  if (icf >= 5.0) pointScore += 0.35;
  if (todayLine <= 1) pointScore += 0.2;

  let goalScore = 0;
  if (effectiveToi >= 22) goalScore += 0.8;
  else if (effectiveToi >= 20) goalScore += 0.45;
  if (goals >= 0.18) goalScore += 1.15;
  else if (goals >= 0.12) goalScore += 0.8;
  else if (goals >= 0.08) goalScore += 0.45;
  if (iscf >= 1.4) goalScore += 0.6;
  else if (iscf >= 1.0) goalScore += 0.35;
  if (shots >= 2.2) goalScore += 0.2;
  if (todayLine <= 1) goalScore += 0.15;

  const shotTier = shotScore >= 4.0 ? 'elite' : shotScore >= 3.1 ? 'strong' : shotScore >= 2.2 ? 'active' : shotScore >= 1.5 ? 'thin' : 'weak';
  const pointTier = pointScore >= 2.5 ? 'elite' : pointScore >= 1.9 ? 'strong' : pointScore >= 1.25 ? 'active' : pointScore >= 0.8 ? 'thin' : 'weak';
  const goalTier = goalScore >= 2.2 ? 'elite' : goalScore >= 1.55 ? 'strong' : goalScore >= 1.0 ? 'active' : goalScore >= 0.6 ? 'thin' : 'weak';

  const shotMult3 = shotTier === 'elite' ? 1.22 : shotTier === 'strong' ? 1.10 : shotTier === 'active' ? 0.96 : shotTier === 'thin' ? 0.62 : 0.28;
  const shotMult4 = shotTier === 'elite' ? 1.38 : shotTier === 'strong' ? 1.22 : shotTier === 'active' ? 1.00 : shotTier === 'thin' ? 0.55 : 0.18;
  const shotMult5 = shotTier === 'elite' ? 1.50 : shotTier === 'strong' ? 1.16 : shotTier === 'active' ? 0.78 : shotTier === 'thin' ? 0.28 : 0.06;
  const pointMult1 = pointTier === 'elite' ? 1.30 : pointTier === 'strong' ? 1.18 : pointTier === 'active' ? 1.00 : pointTier === 'thin' ? 0.68 : 0.30;
  const pointMult2 = pointTier === 'elite' ? 1.24 : pointTier === 'strong' ? 1.06 : pointTier === 'active' ? 0.82 : pointTier === 'thin' ? 0.40 : 0.10;
  const goalMult1 = goalTier === 'elite' ? 1.34 : goalTier === 'strong' ? 1.16 : goalTier === 'active' ? 0.92 : goalTier === 'thin' ? 0.52 : 0.15;
  const goalMult2 = goalTier === 'elite' ? 1.16 : goalTier === 'strong' ? 0.96 : goalTier === 'active' ? 0.62 : goalTier === 'thin' ? 0.22 : 0.05;

  return {
    shotTier,
    pointTier,
    goalTier,
    shotMult3, shotMult4, shotMult5,
    pointMult1, pointMult2,
    goalMult1, goalMult2,
  };
}

function defensemanBaselineProbabilities({ histVenue, histPos, teamPos, defenseAvg, effectiveToi, todayLine, skater, environmentScore }) {
  const histSample = histVenue?._venue?.n ?? histPos?._venue?.n ?? 0;
  const confidence = histSample >= 12 ? 1 : histSample >= 8 ? 0.9 : histSample >= 5 ? 0.78 : histSample >= 3 ? 0.62 : 0.42;
  const caps = defensemanCapabilityProfile(skater, effectiveToi, todayLine);
  const env = defensemanEnvironmentTier(teamPos, defenseAvg, environmentScore);
  const readRate = (key) => {
    const histRate = profileRate(histVenue, key) ?? profileRate(histPos, key);
    const tier =
      key.startsWith('s') ? env.shotTier :
      key.startsWith('p') ? env.pointTier :
      env.goalTier;
    const tierBase = defensemanTierBaseline(key, tier);
    const fallback = dFallbackBaseRate(key, teamPos, defenseAvg);
    const structural = Math.max(tierBase, fallback);

    if (histRate == null) return structural;

    if (histSample >= 8) {
      return Math.max(histRate, tierBase * 0.92);
    }
    if (histSample >= 4) {
      return Math.max(histRate * 0.68 + structural * 0.32, tierBase * 0.96);
    }
    return structural;
  };

  const envShot = env.shotTier === 'high' ? 1.08 : env.shotTier === 'neutral' ? 1.02 : 0.98;
  const envPoint = env.pointTier === 'high' ? 1.08 : env.pointTier === 'neutral' ? 1.03 : 0.98;
  const envGoal = env.goalTier === 'high' ? 1.10 : env.goalTier === 'neutral' ? 1.04 : 0.98;

  return {
    confidence,
    histSample,
    env,
    caps,
    s3: clamp(readRate('s3') * caps.shotMult3 * envShot, 0.04, 0.74),
    s4: clamp(readRate('s4') * caps.shotMult4 * envShot, 0.015, 0.46),
    s5: clamp(readRate('s5') * caps.shotMult5 * envShot, 0.003, 0.22),
    p1: clamp(readRate('p1') * caps.pointMult1 * envPoint, 0.05, 0.66),
    p2: clamp(readRate('p2') * caps.pointMult2 * envPoint, 0.004, 0.26),
    g1: clamp(readRate('g1') * caps.goalMult1 * envGoal, 0.008, 0.34),
    g2: clamp(readRate('g2') * caps.goalMult2 * envGoal, 0.0008, 0.08),
  };
}

function blendDefensemanProbability(current, baseline, confidence) {
  const weight = clamp(0.45 + confidence * 0.45, 0.45, 0.88);
  return Math.max(current, current * (1 - weight) + baseline * weight);
}

function profileRate(profile, key) {
  return profile?.[key]?.hitRate ?? null;
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

// ─── BUILD PROJECTIONS ───────────────────────────────────────────────────────



function roleWeight(posKey, todayLine, isDefensemanLike = false) {
  let w = 1;
  if (todayLine === 1) w += 0.10;
  else if (todayLine === 2) w += 0.03;
  else if (todayLine >= 3) w -= 0.08;

  if (posKey === "RW" || posKey === "LW") w += 0.03;
  if (posKey === "D" || isDefensemanLike) w -= 0.08;

  return clamp(w, 0.72, 1.22);
}

function laneModifier(posKey, teamPos) {
  if (!teamPos) return 1;

  let mod = 1;
  if (posKey === "C") {
    if ((teamPos.shots || 0) >= 7.2) mod += 0.05;
    if ((teamPos.iff || 0) >= 11.0) mod += 0.05;
  } else if (posKey === "RW") {
    if ((teamPos.shots || 0) >= 7.2) mod += 0.05;
    if ((teamPos.iff || 0) >= 10.0) mod += 0.05;
  } else if (posKey === "LW") {
    if ((teamPos.shots || 0) >= 7.0) mod += 0.05;
    if ((teamPos.iff || 0) >= 10.5) mod += 0.05;
  } else if (posKey === "D") {
    if ((teamPos.shots || 0) >= 8.0) mod += 0.05;
    if ((teamPos.iff || 0) >= 12.0) mod += 0.05;
  }

  return clamp(mod, 0.92, 1.15);
}

function lineRoleOpportunityMultiplier(todayLine, posKey, market = "shots") {
  let mult = 1;
  if (market === "shots") {
    if (todayLine === 1) mult += 0.18;
    else if (todayLine === 2) mult += 0.05;
    else if (todayLine === 3) mult -= 0.10;
    else mult -= 0.22;
    if (posKey === "D") mult -= 0.04;
  } else if (market === "goals") {
    if (todayLine === 1) mult += 0.24;
    else if (todayLine === 2) mult += 0.08;
    else if (todayLine === 3) mult -= 0.14;
    else mult -= 0.30;
    if (posKey === "D") mult -= 0.14;
  } else {
    if (todayLine === 1) mult += 0.16;
    else if (todayLine === 2) mult += 0.05;
    else if (todayLine === 3) mult -= 0.10;
    else mult -= 0.24;
    if (posKey === "D") mult -= 0.06;
  }
  return clamp(mult, market === "goals" ? 0.55 : 0.6, market === "goals" ? 1.38 : 1.32);
}

function laneOpportunityMultiplier(posStats, market = "shots") {
  const state = classifyDefenseLaneState(posStats, market);
  if (market === "shots") {
    if (state === "open") return 1.10;
    if (state === "suppressed") return 0.90;
    return 1.0;
  }
  if (market === "goals") {
    if (state === "open") return 1.12;
    if (state === "suppressed") return 0.88;
    return 1.0;
  }
  if (state === "open") return 1.08;
  if (state === "suppressed") return 0.92;
  return 1.0;
}


function getShotPositionOpportunityScore({ posKey, laneStats, blockPaceMult }) {
  const shotsAllowed = laneStats?.shotsAllowed || 0;
  const icfAllowed = laneStats?.icfAllowed || 0;
  const iffAllowed = laneStats?.iffAllowed || 0;
  const iscfAllowed = laneStats?.iscfAllowed || 0;
  const ranks = laneStats?.ranks || {};

  let score = 1;
  if (posKey === 'D') {
    if (shotsAllowed >= 8.2) score += 0.22;
    else if (shotsAllowed >= 7.6) score += 0.12;
    else if (shotsAllowed <= 6.8) score -= 0.14;

    if (icfAllowed >= 19.5) score += 0.14;
    else if (icfAllowed <= 17.0) score -= 0.08;

    if (iffAllowed >= 12.2) score += 0.12;
    else if (iffAllowed <= 10.6) score -= 0.08;
  } else {
    if (shotsAllowed >= 7.2) score += 0.22;
    else if (shotsAllowed >= 6.7) score += 0.12;
    else if (shotsAllowed <= 6.0) score -= 0.14;

    if (icfAllowed >= 14.2) score += 0.10;
    else if (icfAllowed <= 12.0) score -= 0.06;

    if (iffAllowed >= 10.5) score += 0.16;
    else if (iffAllowed <= 9.1) score -= 0.10;

    if (iscfAllowed >= 7.2) score += 0.08;
    else if (iscfAllowed <= 6.0) score -= 0.05;
  }

  if ((ranks.shots ?? 99) <= 10) score += 0.12;
  else if ((ranks.shots ?? 0) >= 23) score -= 0.12;

  if ((ranks.iff ?? 99) <= 10) score += 0.10;
  else if ((ranks.iff ?? 0) >= 23) score -= 0.08;

  if ((ranks.icf ?? 99) <= 12) score += 0.08;
  if ((ranks.iscf ?? 99) <= 12) score += 0.05;

  if (blockPaceMult >= 1.06) score *= 1.08;
  else if (blockPaceMult >= 1.03) score *= 1.04;
  else if (blockPaceMult <= 0.97) score *= 0.94;

  return clamp(score, 0.58, 1.68);
}

function getHistoricalShotRoleWeight({ histProfiles, oppTK, posKey, currentRole, isHome, todayLine }) {
  const histPos = histProfiles?.[oppTK]?.[posKey] || null;
  const roleProfile = histPos?._byRole?.[currentRole] || null;
  const roleVenueProfile = pickVenueProfile(roleProfile, isHome);
  const overallVenueProfile = pickVenueProfile(histPos, isHome);

  const overallS3 = profileRate(overallVenueProfile, 's3') ?? profileRate(histPos, 's3');
  const overallS4 = profileRate(overallVenueProfile, 's4') ?? profileRate(histPos, 's4');
  const roleS3 = profileRate(roleVenueProfile, 's3') ?? profileRate(roleProfile, 's3');
  const roleS4 = profileRate(roleVenueProfile, 's4') ?? profileRate(roleProfile, 's4');
  const sample = roleVenueProfile?._venue?.n ?? roleProfile?._venue?.n ?? roleProfile?.s3?.total ?? 0;

  let weight = todayLine === 1 ? 1.06 : todayLine === 2 ? 0.98 : todayLine === 3 ? 0.84 : 0.72;

  if (sample >= 3 && roleS3 != null) {
    const baseS3 = overallS3 != null ? overallS3 : roleS3;
    const baseS4 = overallS4 != null ? overallS4 : (roleS4 != null ? roleS4 : 0);
    const diff3 = roleS3 - baseS3;
    const diff4 = (roleS4 != null ? roleS4 : 0) - baseS4;
    const sampleStrength = sample >= 10 ? 1.0 : sample >= 7 ? 0.82 : sample >= 5 ? 0.64 : 0.40;
    const roleLift = diff3 * 0.65 + diff4 * 1.05 + (roleS4 != null ? roleS4 : 0) * 0.18;
    weight *= 1 + clamp(roleLift * sampleStrength, -0.28, 0.42);

    if (sample >= 5 && roleS4 != null) {
      if (roleS4 >= 0.40) weight *= 1.12;
      else if (roleS4 >= 0.28) weight *= 1.06;
      else if (roleS4 <= 0.12) weight *= 0.86;
    }
  }

  return clamp(weight, 0.52, 1.62);
}

function buildShotAllocationContext({ preppedPlayers, oppDef, blockPaceMult, histProfiles, isHome }) {
  const positions = ['C', 'LW', 'RW', 'D'];
  const oppTK = normTeam(oppDef?.team || '');
  const positionScores = {};
  const roleScoresByPos = { C: {}, LW: {}, RW: {}, D: {} };
  const playerScoresByRole = {};
  const lineScores = { L1: 0, L2: 0, L3: 0, L4: 0 };
  const playerScoresByLine = { L1: {}, L2: {}, L3: {}, L4: {} };

  positions.forEach((posKey) => {
    const laneStats = oppDef?.posStats?.[posKey] || null;
    const players = preppedPlayers.filter((p) => ((p.skater.pos || '').toUpperCase() === posKey));
    if (!players.length) {
      positionScores[posKey] = 0;
      return;
    }

    positionScores[posKey] = getShotPositionOpportunityScore({ posKey, laneStats, blockPaceMult });

    players.forEach((p) => {
      const key = p.skater.name.toLowerCase();
      const currentRole = `${posKey}${Math.max(1, Math.min(p.todayLine, 3))}`.toUpperCase();
      const histWeight = getHistoricalShotRoleWeight({
        histProfiles,
        oppTK,
        posKey,
        currentRole,
        isHome,
        todayLine: p.todayLine,
      });
      const shots = Math.max(0.1, p.skater.shotsSeason || 0.1);
      const iff = Math.max(0.1, p.iffAnchor || p.skater.iffSeason || 0.1);
      const icf = Math.max(0.1, p.skater.icfSeason || 0.1);
      const iscf = Math.max(0.05, p.skater.iscfSeason || 0.05);
      const toi = Math.max(8.0, p.effectiveToi || p.playerToi || 8.0);
      const style = p.capabilityBase?.style || classifyCapabilityStyle({
        shotsBase: p.shotsAnchor || shots,
        goalsBase: p.skater.goalsSeason || 0,
        pointsBase: (p.skater.goalsSeason || 0) + (p.skater.astSeason || 0),
        shotsSeason: shots,
        goalsSeason: p.skater.goalsSeason || 0,
        assistsSeason: p.skater.astSeason || 0,
        iff,
        iscf,
      });
      const shotGate = buildShotVolumeGate({
        style,
        posKey,
        shotsSeason: shots,
        iffBlend: iff,
        icfSeason: icf,
        iscfSeason: iscf,
        effectiveToi: toi,
        todayLine: p.todayLine,
        lineShare: 0.33,
        expectedShotsBudget: shots,
        blockPaceMult,
      });

      const roleBase = (0.56 * iff + 0.22 * shots * 1.45 + 0.12 * icf * 0.55 + 0.10 * (toi / 14.5)) * shotGate.shotBias;
      roleScoresByPos[posKey][currentRole] = (roleScoresByPos[posKey][currentRole] || 0) + roleBase * histWeight;

      if (!playerScoresByRole[currentRole]) playerScoresByRole[currentRole] = {};
      const playerConvScore = Math.max(0.05,
        0.52 * iff +
        0.24 * shots * 1.55 +
        0.14 * icf * 0.52 +
        0.10 * (toi / 14.5)
      ) * shotGate.shotBias;
      playerScoresByRole[currentRole][key] = playerConvScore;

      const lineKey = `L${Math.max(1, Math.min(p.todayLine || 4, 4))}`;
      const lineBias = p.todayLine === 1 ? 1.14 : p.todayLine === 2 ? 1.07 : p.todayLine === 3 ? 0.90 : 0.78;
      const linePlayerScore = Math.max(0.03, playerConvScore * lineBias * (shotGate.strongShooter ? 1.10 : 1.0));
      playerScoresByLine[lineKey][key] = linePlayerScore;
      lineScores[lineKey] += linePlayerScore;
    });
  });

  const normalizeMap = (m) => {
    const total = Object.values(m).reduce((sum, v) => sum + v, 0) || 1;
    const out = {};
    Object.entries(m).forEach(([k, v]) => {
      out[k] = v / total;
    });
    return out;
  };
  const normalizeWithSharpen = (m, exp = 1.0) => {
    const powered = {};
    Object.entries(m).forEach(([k, v]) => {
      powered[k] = Math.pow(Math.max(0.0001, v), exp);
    });
    return normalizeMap(powered);
  };

  const shotLaneBudgetMap = normalizeMap(positionScores);
  const lineBiasMap = { L1: blockPaceMult >= 1.04 ? 1.10 : 1.06, L2: blockPaceMult >= 1.04 ? 1.04 : 1.00, L3: 0.86, L4: 0.72 };
  Object.keys(lineScores).forEach((k) => { lineScores[k] *= (lineBiasMap[k] || 1); });
  const lineBudgetMap = normalizeMap(lineScores);
  const shotLineBudgetShareMap = {};
  const shotConversionShareMap = {};
  const shotLaneShareMap = {};
  const shotAllocatedShareMap = {};
  const shotShareMap = {};

  positions.forEach((posKey) => {
    const roleShares = normalizeWithSharpen(roleScoresByPos[posKey], 1.08);
    Object.entries(roleShares).forEach(([role, roleShare]) => {
      const playerShares = normalizeWithSharpen(playerScoresByRole[role] || {}, 1.12);
      Object.entries(playerShares).forEach(([playerKey, convShare]) => {
        shotLineBudgetShareMap[playerKey] = roleShare;
        shotConversionShareMap[playerKey] = convShare;
        const posShare = (shotLaneBudgetMap[posKey] || 0) * roleShare * convShare;
        shotLaneShareMap[playerKey] = roleShare * convShare;
        shotShareMap[playerKey] = posShare;
      });
    });
  });

  Object.keys(playerScoresByLine).forEach((lineKey) => {
    const playerShares = normalizeWithSharpen(playerScoresByLine[lineKey], lineKey === 'L1' ? 1.20 : lineKey === 'L2' ? 1.12 : 1.04);
    Object.entries(playerShares).forEach(([playerKey, share]) => {
      shotAllocatedShareMap[playerKey] = (lineBudgetMap[lineKey] || 0) * share;
      shotShareMap[playerKey] = clamp(0.62 * (shotShareMap[playerKey] || 0) + 0.38 * shotAllocatedShareMap[playerKey], 0.003, 0.48);
    });
  });

  const rankedKeys = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const shotRankMap = {};
  const shotRankByPosMap = {};

  rankedKeys(shotShareMap).forEach((k, idx) => { shotRankMap[k] = idx + 1; });
  positions.forEach((posKey) => {
    const posPlayerShares = {};
    Object.keys(shotShareMap).forEach((playerKey) => {
      const p = preppedPlayers.find((x) => x.skater.name.toLowerCase() === playerKey);
      const pPos = p ? ((p.skater.pos || '').toUpperCase()) : null;
      if (pPos === posKey) posPlayerShares[playerKey] = shotShareMap[playerKey];
    });
    rankedKeys(posPlayerShares).forEach((k, idx) => { shotRankByPosMap[k] = idx + 1; });
  });

  return {
    shotLaneBudgetMap,
    shotLineBudgetShareMap,
    shotConversionShareMap,
    shotLaneShareMap,
    shotAllocatedShareMap,
    shotShareMap,
    shotRankMap,
    shotRankByPosMap,
  };
}

function buildTeamOpportunityContext({ preppedPlayers, oppDef, blockPaceMult, teamExpectedShots, isHome, histProfiles = null }) {
  const positions = ["C", "LW", "RW", "D"];
  const oppAll = oppDef?.posStats?.ALL || null;
  const shotOpenCount = positions.filter((pos) => classifyDefenseLaneState(oppDef?.posStats?.[pos], "shots") === "open").length;
  const goalOpenCount = positions.filter((pos) => classifyDefenseLaneState(oppDef?.posStats?.[pos], "goals") === "open").length;

  const distributedShotEnv =
    shotOpenCount >= 3 ||
    ((oppAll?.shotsAllowed || 0) >= 29.0 && (oppAll?.iffAllowed || 0) >= 44.0) ||
    (((oppAll?.shotsAllowed || 0) >= 28.0) && blockPaceMult >= 1.05);

  const shotDistributionIndex = clamp(
    0.28 +
      shotOpenCount * 0.16 +
      ((oppAll?.shotsAllowed || 0) >= 29.0 ? 0.12 : (oppAll?.shotsAllowed || 0) >= 27.5 ? 0.06 : -0.04) +
      ((oppAll?.iffAllowed || 0) >= 44.0 ? 0.10 : (oppAll?.iffAllowed || 0) >= 42.0 ? 0.05 : -0.03) +
      (blockPaceMult >= 1.05 ? 0.08 : blockPaceMult <= 0.97 ? -0.06 : 0),
    0.18,
    0.98
  );

  const broadGoalEnv =
    goalOpenCount >= 2 ||
    ((oppAll?.goalsAllowed || 0) >= 3.2) ||
    (((oppAll?.goalsAllowed || 0) >= 3.0) && blockPaceMult >= 1.03);

  const distributedGoalEnv =
    goalOpenCount >= 3 ||
    (((oppAll?.goalsAllowed || 0) >= 3.45) && goalOpenCount >= 2) ||
    (((oppAll?.goalsAllowed || 0) >= 3.2) && blockPaceMult >= 1.05 && goalOpenCount >= 2);

  const goalDistributionIndex = clamp(
    0.24 +
      goalOpenCount * 0.20 +
      ((oppAll?.goalsAllowed || 0) >= 3.3 ? 0.14 : (oppAll?.goalsAllowed || 0) >= 2.9 ? 0.07 : -0.04) +
      (distributedGoalEnv ? 0.08 : 0) +
      (blockPaceMult >= 1.05 ? 0.05 : blockPaceMult <= 0.97 ? -0.05 : 0),
    0.16,
    0.98
  );

  const teamBaselineGoals = preppedPlayers.reduce((sum, p) => {
    const venueGoals = p.pHA ? (isHome ? p.pHA.g_home : p.pHA.g_away) : null;
    const seasonGoals = p.skater.goalsSeason || 0;
    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueGoals : seasonGoals);
  }, 0);

  const goalPressureMult = clamp(
    0.96 +
      (blockPaceMult - 1) * 0.42 +
      (((oppAll?.goalsAllowed || 0) >= 3.2) ? 0.08 : ((oppAll?.goalsAllowed || 0) <= 2.6) ? -0.07 : 0) +
      (goalOpenCount >= 2 ? 0.05 : goalOpenCount === 0 ? -0.05 : 0),
    0.84,
    1.20
  );

  const teamExpectedGoals = clamp(
    (0.52 * teamBaselineGoals + 0.48 * (oppAll?.goalsAllowed || 3.0)) * goalPressureMult,
    1.55,
    distributedGoalEnv ? 5.30 : 5.00
  );

  const teamExpectedPoints = clamp(teamExpectedGoals * (goalOpenCount >= 2 ? 1.92 : 1.78), 2.5, 8.8);

  const shotAllocation = buildShotAllocationContext({
    preppedPlayers,
    oppDef,
    blockPaceMult,
    histProfiles,
    isHome,
  });

  const goalWeights = {};
  const pointWeights = {};
  const goalWeightsByPos = { C: {}, LW: {}, RW: {}, D: {} };
  const pointWeightsByPos = { C: {}, LW: {}, RW: {}, D: {} };
  const laneGoalScores = { C: 0, LW: 0, RW: 0, D: 0 };
  const lanePointScores = { C: 0, LW: 0, RW: 0, D: 0 };
  const lineScores = { L1: 0, L2: 0, L3: 0, L4: 0 };
  const playerScoresByLine = { L1: {}, L2: {}, L3: {}, L4: {} };

  preppedPlayers.forEach((p) => {
    const posKey = (["C", "LW", "RW", "D"].includes((p.skater.pos || "").toUpperCase()) ? (p.skater.pos || "C").toUpperCase() : "C");
    const laneStats = oppDef?.posStats?.[posKey] || null;
    const toi = Math.max(9.5, p.effectiveToi || p.playerToi || 9.5);
    const iff = Math.max(0.15, p.iffAnchor || p.skater.iffSeason || 0.15);
    const shots = Math.max(0.10, p.skater.shotsSeason || 0.10);
    const icf = Math.max(0.10, p.skater.icfSeason || 0.10);
    const iscf = Math.max(0.05, p.skater.iscfSeason || 0.05);
    const goals = Math.max(0.01, p.skater.goalsSeason || 0.01);

    const shotWeight =
      Math.max(0.05,
        (0.52 * iff + 0.18 * shots * 1.55 + 0.14 * icf * 0.55 + 0.16 * (toi / 14.5)) *
          lineRoleOpportunityMultiplier(p.todayLine, posKey, "shots") *
          laneOpportunityMultiplier(laneStats, "shots")
      );

    const style = p.capabilityBase?.style || classifyCapabilityStyle({
      shotsBase: p.shotsAnchor || shots,
      goalsBase: p.pHA ? (isHome ? p.pHA.g_home : p.pHA.g_away) : goals,
      pointsBase: (p.skater.goalsSeason || 0) + (p.skater.astSeason || 0),
      shotsSeason: shots,
      goalsSeason: goals,
      assistsSeason: p.skater.astSeason || 0,
      iff,
      iscf,
    });
    const gate = buildFinisherShooterGate({
      style,
      posKey,
      shotsSeason: shots,
      goalsSeason: goals,
      iscfSeason: iscf,
      assistsSeason: p.skater.astSeason || 0,
      effectiveToi: toi,
      todayLine: p.todayLine,
      lineShare: 0.33,
      dangerRate: safeRatio(iscf, Math.max(0.1, iff), 0.4),
      convBlend: safeRatio(shots, Math.max(0.1, iff), 0.65),
    });

    const goalWeight =
      Math.max(0.03,
        (0.50 * iscf * 1.60 + 0.34 * goals * 8.8 + 0.08 * shots * 0.82 + 0.08 * (toi / 15.5)) *
          lineRoleOpportunityMultiplier(p.todayLine, posKey, "goals") *
          laneOpportunityMultiplier(laneStats, "goals") *
          gate.goalBias *
          gate.allocationBias
      );

    const pointWeight = Math.max(0.04, 0.58 * goalWeight + 0.42 * shotWeight * laneOpportunityMultiplier(laneStats, "points"));

    const key = p.skater.name.toLowerCase();
    goalWeights[key] = goalWeight;
    pointWeights[key] = pointWeight;
    goalWeightsByPos[posKey][key] = goalWeight;
    pointWeightsByPos[posKey][key] = pointWeight;
    const lineKey = `L${Math.max(1, Math.min(p.todayLine || 4, 4))}`;
    const lineCompetitionBias =
      (p.todayLine === 1 ? (distributedGoalEnv ? 1.08 : 1.14) :
       p.todayLine === 2 ? (distributedGoalEnv ? 1.03 : 1.08) :
       p.todayLine === 3 ? 0.90 : 0.80);
    const linePlayerScore = Math.max(0.02, goalWeight * lineCompetitionBias);
    playerScoresByLine[lineKey][key] = linePlayerScore;
    lineScores[lineKey] += linePlayerScore;

    const laneGoalLift = clamp(
      laneOpportunityMultiplier(laneStats, "goals") *
      (1 + (((laneStats?.goalsAllowed || 0) >= 1.0 && posKey !== "D") ? 0.12 : 0) + (((laneStats?.iscfAllowed || 0) >= (posKey === "D" ? 5.0 : 7.0)) ? 0.08 : 0)),
      0.84,
      1.34
    );
    const lanePointLift = clamp(
      laneOpportunityMultiplier(laneStats, "points") *
      (1 + (((laneStats?.assistsAllowed || 0) >= 1.2) ? 0.08 : 0) + (((laneStats?.shotsAllowed || 0) >= (posKey === "D" ? 7.8 : 6.8)) ? 0.06 : 0)),
      0.86,
      1.28
    );
    laneGoalScores[posKey] += goalWeight * laneGoalLift;
    lanePointScores[posKey] += pointWeight * lanePointLift;
  });

  const normalizeMap = (m) => {
    const total = Object.values(m).reduce((sum, v) => sum + v, 0) || 1;
    const out = {};
    Object.entries(m).forEach(([k, v]) => {
      out[k] = v / total;
    });
    return out;
  };

  const rankedKeys = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const normalizeWithSharpen = (m, exp = 1.0) => {
    const powered = {};
    Object.entries(m).forEach(([k, v]) => {
      powered[k] = Math.pow(Math.max(0.0001, v), exp);
    });
    return normalizeMap(powered);
  };
  const amplifyLineWinner = (shares, leaderBoost = 1.12, followerCompression = 0.94) => {
    const entries = Object.entries(shares).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return shares;
    const out = {};
    entries.forEach(([k, v], idx) => {
      out[k] = idx === 0 ? v * leaderBoost : v * followerCompression;
    });
    return normalizeMap(out);
  };

  const shotLaneBudgetMap = shotAllocation.shotLaneBudgetMap;
  const shotLineBudgetShareMap = shotAllocation.shotLineBudgetShareMap;
  const shotConversionShareMap = shotAllocation.shotConversionShareMap;
  const shotShareMap = shotAllocation.shotShareMap;
  const shotLaneShareMap = shotAllocation.shotLaneShareMap;
  const shotRankMap = shotAllocation.shotRankMap;
  const shotRankByPosMap = shotAllocation.shotRankByPosMap;

  const goalLaneBudgetMap = normalizeMap(laneGoalScores);
  const pointLaneBudgetMap = normalizeMap(lanePointScores);
  const lineGoalBudgetMap = normalizeMap(lineScores);
  const goalLaneSharpenExp = distributedGoalEnv ? 1.08 : broadGoalEnv ? 1.18 : 1.32;
  const pointLaneSharpenExp = broadGoalEnv ? 1.08 : 1.16;

  const goalShareMap = {};
  const pointShareMap = {};
  const goalLaneShareMap = {};
  const goalLineShareMap = {};
  const goalAllocatedShareMap = {};
  const pointLaneShareMap = {};
  const goalRankMap = {};
  const pointRankMap = {};
  const goalRankByPosMap = {};
  const pointRankByPosMap = {};

  positions.forEach((pos) => {
    const laneGoalShares = normalizeWithSharpen(goalWeightsByPos[pos], goalLaneSharpenExp);
    const lanePointShares = normalizeWithSharpen(pointWeightsByPos[pos], pointLaneSharpenExp);
    Object.entries(laneGoalShares).forEach(([k, v]) => {
      goalLaneShareMap[k] = v;
      goalShareMap[k] = (goalLaneBudgetMap[pos] || 0) * v;
    });
    Object.entries(lanePointShares).forEach(([k, v]) => {
      pointLaneShareMap[k] = v;
      pointShareMap[k] = (pointLaneBudgetMap[pos] || 0) * v;
    });

    rankedKeys(goalWeightsByPos[pos]).forEach((k, idx) => {
      goalRankByPosMap[k] = idx + 1;
    });
    rankedKeys(pointWeightsByPos[pos]).forEach((k, idx) => {
      pointRankByPosMap[k] = idx + 1;
    });
  });

  Object.keys(playerScoresByLine).forEach((lineKey) => {
    const sharpenExp =
      lineKey === 'L1' ? (distributedGoalEnv ? 1.40 : 1.62) :
      lineKey === 'L2' ? (distributedGoalEnv ? 1.32 : 1.48) :
      lineKey === 'L3' ? 1.22 : 1.16;
    let playerShares = normalizeWithSharpen(playerScoresByLine[lineKey], sharpenExp);
    playerShares = amplifyLineWinner(
      playerShares,
      lineKey === 'L1' ? 1.16 : lineKey === 'L2' ? 1.13 : 1.10,
      lineKey === 'L1' ? 0.92 : 0.94
    );
    Object.entries(playerShares).forEach(([playerKey, share]) => {
      goalLineShareMap[playerKey] = share;
      goalAllocatedShareMap[playerKey] = (lineGoalBudgetMap[lineKey] || 0) * share;
      goalShareMap[playerKey] = clamp(
        0.36 * (goalShareMap[playerKey] || 0) + 0.64 * goalAllocatedShareMap[playerKey],
        0.0005,
        1
      );
    });
  });

  rankedKeys(goalShareMap).forEach((k, idx) => {
    goalRankMap[k] = idx + 1;
  });
  rankedKeys(pointShareMap).forEach((k, idx) => {
    pointRankMap[k] = idx + 1;
  });

  const maxGoalCandidates = distributedGoalEnv && teamExpectedGoals >= 3.35 ? 5 : broadGoalEnv && teamExpectedGoals >= 2.8 ? 4 : 3;

  return {
    teamExpectedShots,
    teamExpectedGoals,
    teamExpectedPoints,
    shotShareMap,
    goalShareMap: normalizeMap(goalShareMap),
    pointShareMap: normalizeMap(pointShareMap),
    shotLaneBudgetMap,
    goalLaneBudgetMap,
    pointLaneBudgetMap,
    lineGoalBudgetMap,
    shotLaneShareMap,
    shotLineBudgetShareMap,
    shotConversionShareMap,
    shotAllocatedShareMap: shotAllocation.shotAllocatedShareMap,
    goalLaneShareMap,
    goalLineShareMap,
    goalAllocatedShareMap,
    pointLaneShareMap,
    shotRankMap,
    goalRankMap,
    pointRankMap,
    shotRankByPosMap,
    goalRankByPosMap,
    pointRankByPosMap,
    shotDistributionIndex,
    goalDistributionIndex,
    distributedShotEnv,
    broadGoalEnv,
    distributedGoalEnv,
    maxGoalCandidates,
    shotOpenCount,
    goalOpenCount,
  };
}


function classifyCapabilityStyle({ shotsBase, goalsBase, pointsBase, shotsSeason, goalsSeason, assistsSeason, iff, iscf }) {
  const shotLevel = shotsBase || shotsSeason || 0;
  const goalLevel = goalsBase || goalsSeason || 0;
  const pointLevel = pointsBase || (goalsSeason || 0) + (assistsSeason || 0) || 0;
  const playmakerIndex = Math.max(0, (assistsSeason || 0) - (goalsSeason || 0) * 0.65) + Math.max(0, pointLevel - goalLevel - 0.18) * 0.7;
  const shooterIndex = shotLevel * 0.72 + (iff || 0) * 0.24 + (iscf || 0) * 0.10;
  const finisherIndex = goalLevel * 2.15 + (iscf || 0) * 0.28 - Math.max(0, shotLevel - 3.0) * 0.10;

  if (goalLevel >= 0.28 && shotLevel < 2.3) return 'Finisher-Low Volume';
  if (playmakerIndex >= 0.42 && shooterIndex >= 3.0) return 'Playmaker-Shooter';
  if (shooterIndex >= 3.25 && finisherIndex >= 0.9) return 'Shooter-Finisher';
  if (playmakerIndex >= shooterIndex * 0.16 && pointLevel >= 0.72 && shotLevel < 2.5) return 'Playmaker';
  if (finisherIndex >= 1.0 && goalLevel >= 0.24 && shotLevel < 2.8) return 'Finisher';
  return 'Shooter';
}

function capabilityStyleMultipliers(style) {
  switch (style) {
    case 'Shooter': return { shots: 1.08, points: 0.97, goals: 0.96 };
    case 'Shooter-Finisher': return { shots: 1.06, points: 1.00, goals: 1.08 };
    case 'Playmaker': return { shots: 0.90, points: 1.10, goals: 0.90 };
    case 'Playmaker-Shooter': return { shots: 0.98, points: 1.08, goals: 0.94 };
    case 'Finisher': return { shots: 0.78, points: 0.96, goals: 1.14 };
    case 'Finisher-Low Volume': return { shots: 0.62, points: 0.90, goals: 1.18 };
    default: return { shots: 1, points: 1, goals: 1 };
  }
}

function buildFinisherShooterGate({ style, posKey, shotsSeason = 0, goalsSeason = 0, iscfSeason = 0, assistsSeason = 0, effectiveToi = 0, todayLine = 1, lineShare = 0.33, dangerRate = 0.4, convBlend = 0.65 }) {
  const shots = shotsSeason || 0;
  const goals = goalsSeason || 0;
  const assists = assistsSeason || 0;
  const iscf = iscfSeason || 0;
  const topRole = todayLine <= 2;
  const shotHeavy = shots >= (posKey === 'D' ? 2.2 : 3.0);
  const trueFinisher = goals >= (posKey === 'D' ? 0.10 : 0.26) || iscf >= (posKey === 'D' ? 1.0 : 2.0);
  const opportunist = goals >= (posKey === 'D' ? 0.08 : 0.18) && shots < (posKey === 'D' ? 2.0 : 2.3);

  let goalBias = 1.0;
  let allocationBias = 1.0;
  let opportunityBias = 1.0;
  let label = 'Balanced';

  switch (style) {
    case 'Shooter':
      goalBias = shotHeavy ? 0.82 : 0.88;
      allocationBias = shotHeavy ? 0.84 : 0.90;
      opportunityBias = 0.90;
      label = 'Shooter';
      break;
    case 'Shooter-Finisher':
      goalBias = 1.06;
      allocationBias = 1.08;
      opportunityBias = 1.05;
      label = 'Shooter-Finisher';
      break;
    case 'Playmaker':
      goalBias = 0.78;
      allocationBias = 0.80;
      opportunityBias = 0.88;
      label = 'Playmaker';
      break;
    case 'Playmaker-Shooter':
      goalBias = 0.88;
      allocationBias = 0.90;
      opportunityBias = 0.95;
      label = 'Playmaker-Shooter';
      break;
    case 'Finisher':
      goalBias = 1.18;
      allocationBias = 1.22;
      opportunityBias = 1.14;
      label = 'Finisher';
      break;
    case 'Finisher-Low Volume':
      goalBias = 1.24;
      allocationBias = 1.20;
      opportunityBias = 1.18;
      label = 'Finisher-Low Volume';
      break;
    default:
      break;
  }

  if (trueFinisher) {
    goalBias *= 1.04;
    allocationBias *= 1.04;
  }
  if (opportunist) {
    goalBias *= 1.05;
    opportunityBias *= 1.06;
    label = label === 'Balanced' ? 'Opportunist' : `${label} Opportunist`;
  }
  if (style === 'Shooter' && goals < (posKey === 'D' ? 0.08 : 0.18) && assists > goals * 1.25) {
    goalBias *= 0.94;
    allocationBias *= 0.95;
  }
  if (!topRole && style !== 'Finisher-Low Volume') {
    goalBias *= 0.97;
    allocationBias *= 0.98;
  }
  if (lineShare < 0.24 && style !== 'Finisher' && style !== 'Finisher-Low Volume') {
    allocationBias *= 0.94;
  }
  if (dangerRate >= 0.48) goalBias *= 1.03;
  if (convBlend >= 0.72) goalBias *= 1.02;

  return {
    styleLabel: label,
    goalBias: clamp(goalBias, 0.72, 1.30),
    allocationBias: clamp(allocationBias, 0.74, 1.32),
    opportunityBias: clamp(opportunityBias, 0.84, 1.24),
    isFinisherStyle: style === 'Finisher' || style === 'Finisher-Low Volume' || style === 'Shooter-Finisher',
    isShooterStyle: style === 'Shooter' || style === 'Playmaker-Shooter',
    isOpportunist: opportunist,
  };
}

function resolvePaceTier(blockPaceMult) {
  if (blockPaceMult >= 1.075) return 'elite';
  if (blockPaceMult >= 1.035) return 'high';
  if (blockPaceMult <= 0.965) return 'low';
  return 'neutral';
}

function paceTierProfile(blockPaceMult, market = 'shots') {
  const tier = resolvePaceTier(blockPaceMult);
  if (market === 'shots') {
    if (tier === 'elite') return { tier, mult: 1.18, ceilingShift: 2, floorBoost: 0.08 };
    if (tier === 'high') return { tier, mult: 1.10, ceilingShift: 1, floorBoost: 0.04 };
    if (tier === 'low') return { tier, mult: 0.90, ceilingShift: -1, floorBoost: -0.03 };
    return { tier, mult: 1.0, ceilingShift: 0, floorBoost: 0 };
  }
  if (market === 'points') {
    if (tier === 'elite') return { tier, mult: 1.10, ceilingShift: 1, floorBoost: 0.04 };
    if (tier === 'high') return { tier, mult: 1.05, ceilingShift: 1, floorBoost: 0.02 };
    if (tier === 'low') return { tier, mult: 0.93, ceilingShift: -1, floorBoost: -0.02 };
    return { tier, mult: 1.0, ceilingShift: 0, floorBoost: 0 };
  }
  if (tier === 'elite') return { tier, mult: 1.05, ceilingShift: 1, floorBoost: 0.02 };
  if (tier === 'high') return { tier, mult: 1.02, ceilingShift: 0, floorBoost: 0.01 };
  if (tier === 'low') return { tier, mult: 0.95, ceilingShift: -1, floorBoost: -0.01 };
  return { tier, mult: 1.0, ceilingShift: 0, floorBoost: 0 };
}


function buildHotRoleOverride({ posKey, todayLine, effectiveToi, lineShare, shotsSeason = 0, shotsL5 = 0, iffSeason = 0, iffL5 = 0, iscfSeason = 0, iscfL5 = 0, goalsSeason = 0, goalsL5 = 0, environmentScore = 0, leakScore = 0 }) {
  const dman = posKey === 'D';
  const topRole = todayLine <= 2;
  const shotsSpike = shotsL5 >= Math.max(shotsSeason * 1.22, shotsSeason + (dman ? 0.25 : 0.45));
  const iffSpike = iffL5 >= Math.max(iffSeason * 1.20, iffSeason + (dman ? 0.45 : 0.70));
  const dangerSpike = iscfL5 >= Math.max(iscfSeason * 1.16, iscfSeason + (dman ? 0.18 : 0.28));
  const goalSpike = goalsL5 >= Math.max(goalsSeason * 1.35, goalsSeason + (dman ? 0.05 : 0.16));
  const liveShotRole = shotsL5 >= (dman ? 2.2 : 3.0) && iffL5 >= (dman ? 3.0 : 4.0);
  const matchupNeutralOrBetter = environmentScore >= 60 || leakScore >= 60;
  const matchupStrong = environmentScore >= 72 || leakScore >= 72;
  const liveGoalRole =
    topRole &&
    effectiveToi >= 15.5 &&
    matchupNeutralOrBetter &&
    (
      goalsL5 >= (dman ? 0.14 : 0.38) ||
      (goalSpike && dangerSpike) ||
      (dangerSpike && goalsSeason >= (dman ? 0.10 : 0.22)) ||
      (goalSpike && goalsSeason >= (dman ? 0.08 : 0.20) && matchupStrong)
    );
  const enoughToi = effectiveToi >= (dman ? 19.5 : 14.5);
  const spikeCount = [shotsSpike, iffSpike, dangerSpike, goalSpike].filter(Boolean).length;

  const requiredHotSignals =
    matchupStrong ? 2 :
    matchupNeutralOrBetter ? 3 :
    4;

  const active =
    enoughToi &&
    (
      spikeCount >= requiredHotSignals ||
      (liveShotRole && (shotsSpike || iffSpike) && matchupStrong) ||
      (liveGoalRole && (goalSpike || dangerSpike) && matchupNeutralOrBetter)
    );

  const strong = active && (spikeCount >= Math.max(requiredHotSignals, 3) || (liveShotRole && shotsSpike && iffSpike) || (liveGoalRole && goalSpike && dangerSpike));
  const extreme = strong && topRole && effectiveToi >= (dman ? 22.0 : 17.0) && (spikeCount >= Math.max(requiredHotSignals, 3) || (shotsL5 >= (dman ? 2.8 : 3.6) && iffL5 >= (dman ? 3.6 : 4.8)));

  let primaryMarket = 'points';
  if (liveGoalRole && goalSpike && !liveShotRole) primaryMarket = 'goals';
  else if (liveShotRole || shotsSpike || iffSpike) primaryMarket = 'shots';
  else if (liveGoalRole) primaryMarket = 'goals';

  const lineShareFloor = !active ? 0 : primaryMarket === 'shots'
    ? (matchupStrong ? (extreme ? 0.56 : strong ? 0.48 : 0.42) : matchupNeutralOrBetter ? (extreme ? 0.50 : strong ? 0.43 : 0.38) : 0.33)
    : primaryMarket === 'goals'
    ? (matchupStrong ? (extreme ? 0.40 : strong ? 0.35 : 0.31) : matchupNeutralOrBetter ? (extreme ? 0.36 : strong ? 0.31 : 0.28) : 0.24)
    : (matchupStrong ? (extreme ? 0.44 : strong ? 0.38 : 0.33) : matchupNeutralOrBetter ? 0.30 : 0.26);

  const hierarchyOverride = !!(active && matchupNeutralOrBetter && (strong || extreme || (primaryMarket === 'shots' && liveShotRole && spikeCount >= requiredHotSignals)));

  const matchupDampener =
    !active ? 1 :
    matchupStrong ? 1.00 :
    matchupNeutralOrBetter ? 0.90 :
    0.78;

  const lineShareOverrideMultBase = !active ? 1 : primaryMarket === 'shots'
    ? (extreme ? 1.55 : strong ? 1.40 : 1.24)
    : primaryMarket === 'goals'
    ? (extreme ? 1.34 : strong ? 1.22 : 1.12)
    : (extreme ? 1.30 : strong ? 1.18 : 1.10);

  return {
    active,
    strong,
    extreme,
    primaryMarket,
    hierarchyOverride,
    lineShareOverrideMult: clamp(lineShareOverrideMultBase * matchupDampener, 1, 1.55),
    lineShareFloor,
    shotsMult: active ? clamp((extreme ? 1.28 : strong ? 1.20 : 1.10) * matchupDampener, 1.0, 1.28) : 1,
    pointsMult: active ? clamp((primaryMarket === 'points' ? (extreme ? 1.22 : strong ? 1.16 : 1.09) : extreme ? 1.08 : strong ? 1.05 : 1.02) * matchupDampener, 1.0, 1.22) : 1,
    goalsMult: active ? clamp((primaryMarket === 'goals' ? (extreme ? 1.30 : strong ? 1.22 : 1.10) : goalSpike ? (extreme ? 1.12 : 1.08) : 1.0) * (matchupStrong ? 1.0 : matchupNeutralOrBetter ? 0.88 : 0.72), 1.0, 1.26) : 1,
    p3Floor: active && primaryMarket === 'shots' && !dman && topRole && shotsL5 >= 3.0 ? (matchupStrong ? (extreme ? 0.54 : strong ? 0.46 : 0.38) : matchupNeutralOrBetter ? (extreme ? 0.48 : strong ? 0.40 : 0.34) : 0.28) : 0,
    p4Floor: strong && primaryMarket === 'shots' && !dman && topRole && shotsL5 >= 3.4 ? (matchupStrong ? (extreme ? 0.34 : 0.24) : 0.18) : 0,
    p1GoalFloor: active && primaryMarket === 'goals' && liveGoalRole && !dman ? (matchupStrong ? (extreme ? 0.20 : strong ? 0.16 : 0.12) : matchupNeutralOrBetter ? (extreme ? 0.16 : strong ? 0.13 : 0.10) : 0.08) : 0,
    label: !active ? '' : primaryMarket === 'shots' ? (extreme ? 'Hot Shooter Spike' : strong ? 'Hot Shot Role' : 'Shot Role Rising') : primaryMarket === 'goals' ? (extreme ? 'Hot Finisher Spike' : strong ? 'Hot Goal Role' : 'Goal Role Rising') : 'Role Heating Up',
    score: spikeCount,
  };
}

function buildArchetypeEnforcement({ style, posKey, skater, effectiveToi, todayLine, lineShare, iffBlend, dangerRate }) {
  const shots = skater?.shotsSeason || 0;
  const goals = skater?.goalsSeason || 0;
  const iscf = skater?.iscfSeason || 0;
  const iff = Math.max(0, iffBlend || skater?.iffSeason || 0);
  const topRole = todayLine <= 2;
  const strongToi = effectiveToi >= (posKey === 'D' ? 21.5 : 17.5);
  const volumeProfile = shots >= (posKey === 'D' ? 2.1 : 2.7) || iff >= (posKey === 'D' ? 5.0 : 4.2);
  const eliteVolumeProfile = strongToi && (shots >= (posKey === 'D' ? 2.5 : 3.2)) && (iff >= (posKey === 'D' ? 5.8 : 4.8));
  const finisherProfile = goals >= (posKey === 'D' ? 0.10 : 0.24) || iscf >= (posKey === 'D' ? 0.9 : 2.0) || dangerRate >= 0.46;

  const out = {
    primaryMarket: 'shots',
    shotsMult: 1,
    pointsMult: 1,
    goalsMult: 1,
    p4Cap: posKey === 'D' ? 0.62 : 0.78,
    p5Cap: posKey === 'D' ? 0.28 : 0.54,
    p1GoalFloor: 0,
    p2GoalFloor: 0,
    p3ShotFloor: 0,
    ceilingEligible: eliteVolumeProfile || (volumeProfile && strongToi && topRole),
    ceilingBonus: 0,
  };

  switch (style) {
    case 'Shooter':
      out.primaryMarket = 'shots';
      out.shotsMult = eliteVolumeProfile ? 1.12 : 1.08;
      out.pointsMult = 0.98;
      out.goalsMult = 0.96;
      out.ceilingEligible = out.ceilingEligible || (volumeProfile && topRole);
      out.ceilingBonus = eliteVolumeProfile ? 2 : 1;
      out.p3ShotFloor = strongToi && topRole ? 0.42 : 0;
      out.p4Cap = posKey === 'D' ? 0.66 : 0.82;
      out.p5Cap = posKey === 'D' ? 0.32 : 0.62;
      break;
    case 'Shooter-Finisher':
      out.primaryMarket = 'shots';
      out.shotsMult = eliteVolumeProfile ? 1.10 : 1.05;
      out.pointsMult = 1.00;
      out.goalsMult = 1.10;
      out.ceilingEligible = out.ceilingEligible || topRole;
      out.ceilingBonus = eliteVolumeProfile ? 2 : 1;
      out.p1GoalFloor = finisherProfile && strongToi ? 0.16 : 0;
      out.p2GoalFloor = finisherProfile && eliteVolumeProfile ? 0.03 : 0;
      out.p4Cap = posKey === 'D' ? 0.68 : 0.84;
      out.p5Cap = posKey === 'D' ? 0.34 : 0.64;
      break;
    case 'Playmaker':
      out.primaryMarket = 'points';
      out.shotsMult = 0.82;
      out.pointsMult = 1.10;
      out.goalsMult = 0.88;
      out.ceilingEligible = false;
      out.p4Cap = posKey === 'D' ? 0.20 : 0.24;
      out.p5Cap = posKey === 'D' ? 0.05 : 0.08;
      break;
    case 'Playmaker-Shooter':
      out.primaryMarket = 'points';
      out.shotsMult = volumeProfile ? 0.96 : 0.90;
      out.pointsMult = 1.08;
      out.goalsMult = 0.94;
      out.ceilingEligible = topRole && strongToi && volumeProfile;
      out.ceilingBonus = out.ceilingEligible ? 1 : 0;
      out.p4Cap = posKey === 'D' ? 0.40 : 0.54;
      out.p5Cap = posKey === 'D' ? 0.12 : 0.22;
      break;
    case 'Finisher':
      out.primaryMarket = 'goals';
      out.shotsMult = volumeProfile ? 0.84 : 0.70;
      out.pointsMult = 0.98;
      out.goalsMult = 1.16;
      out.ceilingEligible = eliteVolumeProfile && topRole;
      out.ceilingBonus = out.ceilingEligible ? 1 : 0;
      out.p1GoalFloor = finisherProfile && topRole ? 0.18 : 0.12;
      out.p2GoalFloor = finisherProfile && strongToi ? 0.035 : 0.02;
      out.p4Cap = posKey === 'D' ? 0.18 : 0.26;
      out.p5Cap = posKey === 'D' ? 0.04 : 0.08;
      break;
    case 'Finisher-Low Volume':
      out.primaryMarket = 'goals';
      out.shotsMult = 0.54;
      out.pointsMult = 0.92;
      out.goalsMult = 1.22;
      out.ceilingEligible = false;
      out.p1GoalFloor = finisherProfile ? 0.20 : 0.14;
      out.p2GoalFloor = finisherProfile && topRole ? 0.04 : 0.02;
      out.p4Cap = posKey === 'D' ? 0.10 : 0.14;
      out.p5Cap = posKey === 'D' ? 0.02 : 0.04;
      break;
    default:
      break;
  }

  if (!topRole && style !== 'Shooter-Finisher') {
    out.shotsMult *= 0.92;
    out.goalsMult *= 0.96;
    out.ceilingEligible = false;
  }
  if (lineShare < 0.24 && style !== 'Playmaker') {
    out.shotsMult *= 0.92;
  }

  out.shotsMult = clamp(out.shotsMult, 0.48, 1.16);
  out.pointsMult = clamp(out.pointsMult, 0.88, 1.12);
  out.goalsMult = clamp(out.goalsMult, 0.84, 1.24);
  out.p4Cap = clamp(out.p4Cap, posKey === 'D' ? 0.10 : 0.12, posKey === 'D' ? 0.72 : 0.88);
  out.p5Cap = clamp(out.p5Cap, posKey === 'D' ? 0.02 : 0.03, posKey === 'D' ? 0.36 : 0.68);
  return out;
}


function buildShotVolumeGate({ style, posKey, shotsSeason, iffBlend, icfSeason, iscfSeason, effectiveToi, todayLine, lineShare, expectedShotsBudget, blockPaceMult }) {
  const shots = shotsSeason || 0;
  const iff = iffBlend || 0;
  const icf = icfSeason || 0;
  const iscf = iscfSeason || 0;
  const topSix = todayLine <= 2;
  const dman = posKey === 'D';
  const eliteShooter = effectiveToi >= (dman ? 22.5 : 18.0) && shots >= (dman ? 2.2 : 3.0) && iff >= (dman ? 3.3 : 4.6);
  const strongShooter = effectiveToi >= (dman ? 20.0 : 16.0) && shots >= (dman ? 1.8 : 2.3) && iff >= (dman ? 2.7 : 3.6);
  const playmaker = style === 'Playmaker';
  const finisher = style === 'Finisher' || style === 'Finisher-Low Volume';
  const shooter = style === 'Shooter' || style === 'Shooter-Finisher';
  let shotBias = 1;
  let p3Mult = 1;
  let p4Mult = 1;
  let p5Mult = 1;
  let cap4 = dman ? 0.62 : 0.78;
  let cap5 = dman ? 0.22 : 0.54;
  let floor4 = 0;
  let floor5 = 0;

  if (shooter || eliteShooter) {
    shotBias *= eliteShooter ? 1.14 : 1.08;
    p3Mult *= 1.04;
    p4Mult *= eliteShooter ? 1.20 : 1.12;
    p5Mult *= eliteShooter ? 1.42 : 1.22;
    cap4 = dman ? 0.68 : 0.84;
    cap5 = dman ? 0.26 : 0.64;
    if (topSix && expectedShotsBudget >= (dman ? 2.9 : 3.4)) floor4 = dman ? 0.12 : 0.22;
    if (eliteShooter && blockPaceMult >= 1.03 && expectedShotsBudget >= (dman ? 3.8 : 4.2)) floor5 = dman ? 0.05 : 0.12;
  }
  if (playmaker) {
    shotBias *= 0.84;
    p3Mult *= 0.92;
    p4Mult *= 0.72;
    p5Mult *= 0.52;
    cap4 = Math.min(cap4, dman ? 0.26 : 0.36);
    cap5 = Math.min(cap5, dman ? 0.08 : 0.14);
  }
  if (finisher && !strongShooter) {
    shotBias *= 0.88;
    p3Mult *= 0.94;
    p4Mult *= 0.80;
    p5Mult *= 0.62;
    cap4 = Math.min(cap4, dman ? 0.24 : 0.34);
    cap5 = Math.min(cap5, dman ? 0.06 : 0.12);
  }
  if (lineShare < (dman ? 0.20 : 0.22) && !eliteShooter) {
    p4Mult *= 0.86;
    p5Mult *= 0.70;
  }
  if (!topSix && !dman) {
    p4Mult *= 0.88;
    p5Mult *= 0.72;
  }
  if (iscf >= (dman ? 0.9 : 2.0) && icf >= (dman ? 4.8 : 5.4)) {
    p4Mult *= 1.04;
    p5Mult *= 1.08;
  }

  return {
    shotBias: clamp(shotBias, 0.74, 1.18),
    p3Mult: clamp(p3Mult, 0.86, 1.12),
    p4Mult: clamp(p4Mult, 0.60, 1.30),
    p5Mult: clamp(p5Mult, 0.42, 1.60),
    cap4,
    cap5,
    floor4,
    floor5,
    eliteShooter,
    strongShooter,
  };
}

function buildShotExplosionEngine({ posKey, shotsSeason, iffBlend, icfSeason, iscfSeason, effectiveToi, todayLine, blockPaceMult, teamPos, expectedShotsBudget, playerShotShare, opportunityContext }) {
  const dman = posKey === 'D';
  const shots = shotsSeason || 0;
  const iff = iffBlend || 0;
  const icf = icfSeason || 0;
  const iscf = iscfSeason || 0;
  const fastGame = blockPaceMult >= 1.04;
  const elitePace = blockPaceMult >= 1.08;
  const openLane = (teamPos?.shots || 0) >= (dman ? 8.0 : 6.9) || (teamPos?.iff || 0) >= (dman ? 12.0 : 10.8) || opportunityContext?.distributedShotEnv;
  const topUsage = effectiveToi >= (dman ? 22.0 : 17.0) && playerShotShare >= (dman ? 0.06 : 0.085);
  const explosionOn = fastGame && openLane && topUsage && shots >= (dman ? 1.9 : 2.7) && iff >= (dman ? 2.8 : 4.2);
  const extremeOn = explosionOn && elitePace && expectedShotsBudget >= (dman ? 3.6 : 4.1) && icf >= (dman ? 5.0 : 5.8) && iscf >= (dman ? 0.9 : 2.0);
  return {
    on: explosionOn,
    extreme: extremeOn,
    p3Mult: clamp(explosionOn ? 1.03 : 1.0, 1.0, 1.06),
    p4Mult: clamp(extremeOn ? 1.24 : explosionOn ? 1.14 : 1.0, 1.0, 1.28),
    p5Mult: clamp(extremeOn ? 1.55 : explosionOn ? 1.26 : 1.0, 1.0, 1.60),
    floor4: extremeOn ? (dman ? 0.16 : 0.28) : explosionOn ? (dman ? 0.10 : 0.18) : 0,
    floor5: extremeOn ? (dman ? 0.06 : 0.14) : explosionOn ? (dman ? 0.03 : 0.08) : 0,
  };
}

function buildCeilingEngine({ paceTier, paceShots, archetype, posKey, todayLine, effectiveToi, expectedShotsBudget, playerShotShare, iffBlend, shotBlend, iscfBlend, teamPos, opportunityContext }) {
  const laneOpen = classifyDefenseLaneState({ ranks: teamPos?.ranks || {} }, 'shots') === 'open';
  const highPace = paceTier === 'high' || paceTier === 'elite';
  const elitePace = paceTier === 'elite';
  const strongToi = effectiveToi >= (posKey === 'D' ? 22.0 : 18.0);
  const eliteToi = effectiveToi >= (posKey === 'D' ? 24.0 : 19.5);
  const volumeReady = shotBlend >= (posKey === 'D' ? 2.1 : 2.7) && iffBlend >= (posKey === 'D' ? 4.8 : 4.2);
  const eliteVolume = shotBlend >= (posKey === 'D' ? 2.5 : 3.2) && iffBlend >= (posKey === 'D' ? 5.8 : 4.8);
  const dangerSupport = iscfBlend >= (posKey === 'D' ? 0.9 : 2.1);
  const usageReady = playerShotShare >= (posKey === 'D' ? 0.07 : 0.09) && expectedShotsBudget >= (posKey === 'D' ? 2.8 : 3.2);
  const teamOpen = opportunityContext?.distributedShotEnv || laneOpen || (teamPos?.shots || 0) >= (posKey === 'D' ? 8.0 : 6.9);

  const engineOn = archetype?.ceilingEligible && highPace && strongToi && usageReady && (volumeReady || dangerSupport) && teamOpen;
  const fiveOn = engineOn && (elitePace || eliteVolume || eliteToi) && expectedShotsBudget >= (posKey === 'D' ? 3.7 : 4.2);
  const ceilingTier = !engineOn ? 'off' : fiveOn ? (elitePace ? 'elite' : 'high') : 'medium';

  let p3Boost = 1;
  let p4Boost = 1;
  let p5Boost = 1;
  let p4Floor = 0;
  let p5Floor = 0;

  if (engineOn) {
    p3Boost = 1 + (paceShots?.floorBoost || 0) * 0.7;
    p4Boost = elitePace ? 1.40 : 1.22;
    p5Boost = fiveOn ? (elitePace ? 1.95 : 1.55) : 1.12;
    p4Floor = posKey === 'D'
      ? Math.min(0.34, 0.14 + Math.max(0, expectedShotsBudget - 2.9) * 0.09)
      : Math.min(0.58, 0.22 + Math.max(0, expectedShotsBudget - 3.2) * 0.11);
    if (fiveOn) {
      p5Floor = posKey === 'D'
        ? Math.min(0.12, 0.03 + Math.max(0, expectedShotsBudget - 3.8) * 0.035)
        : Math.min(0.26, 0.08 + Math.max(0, expectedShotsBudget - 4.2) * 0.06);
    }
  } else if (paceTier === 'low' && archetype?.primaryMarket !== 'goals') {
    p3Boost = 0.94;
    p4Boost = 0.82;
    p5Boost = 0.68;
  }

  return {
    paceTier,
    ceilingTier,
    engineOn,
    fiveOn,
    p3Boost: +clamp(p3Boost, 0.88, 1.24).toFixed(3),
    p4Boost: +clamp(p4Boost, 0.70, 1.60).toFixed(3),
    p5Boost: +clamp(p5Boost, 0.55, 2.10).toFixed(3),
    p4Floor: +clamp(p4Floor, 0, posKey === 'D' ? 0.34 : 0.60).toFixed(3),
    p5Floor: +clamp(p5Floor, 0, posKey === 'D' ? 0.12 : 0.28).toFixed(3),
  };
}

function buildCapabilityBaseFloors({ skater, pHA, isHome, effectiveToi, playerToi, posKey, todayLine }) {
  const venueShotsBase = pHA ? (isHome ? (pHA.base_plus_form_home || pHA.base_shots_home || pHA.sog_home) : (pHA.base_plus_form_away || pHA.base_shots_away || pHA.sog_away)) : 0;
  const venueShotsL5 = pHA ? (isHome ? pHA.sog_l5_home : pHA.sog_l5_away) : null;
  const seasonShots = skater.shotsSeason || 0;
  const baseShots = Math.max(0.01,
    venueShotsBase > 0
      ? 0.72 * venueShotsBase + 0.18 * seasonShots + 0.10 * Math.max(0, venueShotsL5 || 0)
      : 0.78 * seasonShots + 0.22 * Math.max(0, skater.shotsL5 || seasonShots)
  );

  const venueGoalsBase = pHA ? (isHome ? pHA.g_home : pHA.g_away) : null;
  const venueGoalsL5 = pHA ? (isHome ? pHA.g_l5_home : pHA.g_l5_away) : null;
  const seasonGoals = skater.goalsSeason || 0;
  const baseGoals = Math.max(0.001,
    venueGoalsBase != null && venueGoalsBase > 0
      ? 0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)
      : 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals)
  );

  const venueToi = pHA ? (isHome ? pHA.toi_home : pHA.toi_away) : null;
  const toiScale = safeRatio(venueToi || effectiveToi || playerToi || 0, Math.max(10, playerToi || skater.toiSeason || effectiveToi || 10), 1);
  const assistsSeason = skater.astSeason || 0;
  const assistsL5 = skater.astL5 ?? assistsSeason;
  const assistBlend = 0.74 * assistsSeason + 0.26 * assistsL5;
  const venueAssistBase = assistBlend * clamp(toiScale, 0.82, 1.15);
  const basePoints = Math.max(0.01, baseGoals + venueAssistBase);

  const style = classifyCapabilityStyle({
    shotsBase: baseShots,
    goalsBase: baseGoals,
    pointsBase: basePoints,
    shotsSeason: seasonShots,
    goalsSeason: seasonGoals,
    assistsSeason,
    iff: pHA ? (isHome ? pHA.iff_home : pHA.iff_away) : skater.iffSeason,
    iscf: pHA ? (isHome ? pHA.iscf_home : pHA.iscf_away) : skater.iscfSeason,
  });

  const lineAdj = todayLine === 1 ? 1.04 : todayLine === 2 ? 1.0 : todayLine === 3 ? 0.94 : 0.88;
  const toiAdj = effectiveToi >= (posKey === 'D' ? 23 : 19) ? 1.04 : effectiveToi < (posKey === 'D' ? 18 : 13) ? 0.92 : 1;
  const styleMult = capabilityStyleMultipliers(style);

  return {
    style,
    baseShots: +(baseShots * lineAdj * toiAdj * styleMult.shots).toFixed(3),
    basePoints: +(basePoints * lineAdj * toiAdj * styleMult.points).toFixed(3),
    baseGoals: +(baseGoals * lineAdj * toiAdj * styleMult.goals).toFixed(3),
  };
}

function cheatSheetMajorMultiplier(posStats, market, posKey) {
  const ranks = posStats?.ranks || {};
  const goalRank = ranks.goals ?? null;
  const assistRank = ranks.assists ?? null;
  const shotRank = ranks.shots ?? null;
  const icfRank = ranks.icf ?? null;
  const iffRank = ranks.iff ?? null;
  const iscfRank = ranks.iscf ?? null;
  const open = (v, cut = 10) => v != null && v <= cut;
  const soft = (v, cut = 16) => v != null && v <= cut;
  const hard = (v, cut = 23) => v != null && v >= cut;
  let mult = 1;
  if (market === 'shots') {
    const openScore = [shotRank, icfRank, iffRank, iscfRank].filter((v) => soft(v)).length;
    const hardScore = [shotRank, icfRank, iffRank, iscfRank].filter((v) => hard(v)).length;
    if (open(shotRank, 8)) mult += 0.18;
    else if (soft(shotRank, 14)) mult += 0.08;
    if (open(iffRank, 10)) mult += 0.12;
    if (open(iscfRank, 10)) mult += 0.10;
    if (hardScore >= 3) mult -= 0.20;
    else if (hard(shotRank, 24)) mult -= 0.12;
    if (openScore >= 3) mult += 0.08;
  } else if (market === 'points') {
    const openScore = [assistRank, shotRank, icfRank, iffRank, iscfRank].filter((v) => soft(v, 16)).length;
    const hardScore = [assistRank, shotRank, icfRank, iffRank, iscfRank].filter((v) => hard(v)).length;
    if (open(assistRank, 10)) mult += 0.16;
    else if (soft(assistRank, 16)) mult += 0.08;
    if (open(shotRank, 12)) mult += 0.08;
    if (openScore >= 3) mult += 0.08;
    if (hardScore >= 3) mult -= 0.18;
    else if (hard(assistRank, 24)) mult -= 0.12;
  } else {
    const openScore = [goalRank, iscfRank, shotRank].filter((v) => soft(v, 16)).length;
    const hardScore = [goalRank, iscfRank, shotRank].filter((v) => hard(v)).length;
    if (open(goalRank, 10)) mult += 0.18;
    else if (soft(goalRank, 16)) mult += 0.09;
    if (open(iscfRank, 10)) mult += 0.12;
    if (openScore >= 2) mult += 0.07;
    if (hardScore >= 2) mult -= 0.18;
    else if (hard(goalRank, 24)) mult -= 0.12;
  }
  if (posKey === 'D' && market === 'goals') mult *= 0.88;
  return clamp(mult, market === 'goals' ? 0.74 : 0.76, market === 'goals' ? 1.34 : 1.30);
}

function historyMajorMultiplier({ market, roleRate, posRate, roleSample, venueSample }) {
  const sample = venueSample || roleSample || 0;
  if (roleRate == null && posRate == null) return 1;
  const anchor = roleRate != null ? roleRate : posRate;
  const baseline = posRate != null ? posRate : anchor;
  const diff = anchor - baseline;
  const strength = sample >= 12 ? 1 : sample >= 8 ? 0.82 : sample >= 5 ? 0.62 : sample >= 3 ? 0.38 : 0.22;
  let mult = 1 + diff * (market === 'goals' ? 1.15 : market === 'points' ? 1.05 : 0.95) * strength;
  if (roleRate != null && posRate != null && sample >= 5) {
    if (diff >= (market === 'goals' ? 0.08 : 0.10)) mult += market === 'goals' ? 0.05 : 0.06;
    if (diff <= (market === 'goals' ? -0.08 : -0.10)) mult -= market === 'goals' ? 0.05 : 0.06;
  }
  return clamp(mult, market === 'goals' ? 0.76 : 0.80, market === 'goals' ? 1.28 : 1.24);
}

function paceCeilingMultiplier({ market, blockPaceMult, opportunityContext, todayLine, rankTeam, rankPos }) {
  const paceProfile = paceTierProfile(blockPaceMult, market);
  let mult = paceProfile.mult;
  const topProtected = (rankTeam || 99) <= 3 || (rankPos || 99) <= 2;

  if (market === 'shots') {
    if (!opportunityContext?.distributedShotEnv && !topProtected && (rankTeam || 99) > 5) mult -= 0.05;
    if (!opportunityContext?.distributedShotEnv && !topProtected && todayLine >= 3) mult -= 0.04;
    if (paceProfile.ceilingShift >= 1 && todayLine <= 2) mult += 0.04;
    if (paceProfile.ceilingShift >= 2 && topProtected) mult += 0.08;
    if (opportunityContext?.distributedShotEnv && todayLine <= 2) mult += 0.03;
    if (topProtected) mult = Math.max(mult, blockPaceMult >= 1.0 ? 1.04 : 0.99);
    return clamp(mult, 0.92, 1.24);
  }

  if (market === 'points') {
    if (!(opportunityContext?.broadGoalEnv) && !topProtected && todayLine >= 3) mult -= 0.04;
    if (!topProtected && (rankTeam || 99) > 6) mult -= 0.03;
    if (paceProfile.ceilingShift >= 1 && todayLine <= 2) mult += 0.02;
    if (topProtected) mult = Math.max(mult, blockPaceMult >= 1.0 ? 1.02 : 0.98);
    return clamp(mult, 0.95, 1.14);
  }

  if (!opportunityContext?.distributedGoalEnv && !topProtected && (rankTeam || 99) > opportunityContext?.maxGoalCandidates) mult -= 0.06;
  if (!opportunityContext?.distributedGoalEnv && !topProtected && todayLine >= 3) mult -= 0.04;
  if (!topProtected && (rankPos || 99) > 2) mult -= 0.02;
  if (topProtected) mult = Math.max(mult, blockPaceMult >= 1.0 ? 1.01 : 0.98);
  return clamp(mult, 0.94, 1.10);
}


function activePlayersFromPace(blockPaceMult, market = 'shots') {
  const tier = resolvePaceTier(blockPaceMult);
  if (market === 'shots') {
    if (tier === 'elite') return 6;
    if (tier === 'high') return 5;
    if (tier === 'low') return 3;
    return 4;
  }
  if (market === 'points') {
    if (tier === 'elite') return 5;
    if (tier === 'high') return 4;
    if (tier === 'low') return 2;
    return 3;
  }
  if (tier === 'elite') return 4;
  if (tier === 'high') return 3;
  return 2;
}

function paceRankMultiplier({ rank, slots, market = 'shots', severity = 'base' }) {
  if (!rank || !slots) return 1;
  const over = rank - slots;
  const boost = severity === 'ceiling' ? 1.05 : severity === 'plus' ? 1.04 : 1.03;
  if (over <= 0) return boost;

  const map = {
    shots: {
      base: [0.94, 0.82, 0.68],
      plus: [0.88, 0.72, 0.54],
      ceiling: [0.78, 0.58, 0.40],
    },
    points: {
      base: [0.90, 0.76, 0.58],
      plus: [0.82, 0.64, 0.46],
      ceiling: [0.74, 0.54, 0.36],
    },
    goals: {
      base: [0.86, 0.68, 0.48],
      plus: [0.78, 0.56, 0.36],
      ceiling: [0.68, 0.46, 0.28],
    },
  };

  const arr = map[market]?.[severity] || map.shots.base;
  if (over === 1) return arr[0];
  if (over === 2) return arr[1];
  return arr[2];
}

function positionBudgetStageMultiplier({ laneBudgetShare, laneShare, market = 'shots', posKey = 'C' }) {
  const baseBudget = market === 'goals' ? (posKey === 'D' ? 0.10 : 0.22) : market === 'points' ? 0.24 : 0.25;
  const baseLaneShare = posKey === 'D' ? 0.45 : 0.34;
  const budget = laneBudgetShare == null ? baseBudget : laneBudgetShare;
  const share = laneShare == null ? baseLaneShare : laneShare;
  let mult = 1;
  mult += (budget - baseBudget) * (market === 'goals' ? 0.62 : market === 'points' ? 0.52 : 0.48);
  mult += (share - baseLaneShare) * (market === 'goals' ? 0.18 : 0.14);
  return clamp(mult, market === 'goals' ? 0.90 : 0.92, market === 'goals' ? 1.14 : 1.12);
}

function lineHistoryStageMultiplier({ roleRate, posRate, roleSample, venueSample, market = 'shots', todayLine = 1 }) {
  const sample = venueSample || roleSample || 0;
  if (roleRate == null && posRate == null) {
    return clamp(todayLine === 1 ? 1.02 : todayLine === 2 ? 1.0 : 0.98, 0.96, 1.03);
  }
  const anchor = roleRate != null ? roleRate : posRate;
  const base = posRate != null ? posRate : anchor;
  const diff = anchor - base;
  const strength = sample >= 12 ? 1 : sample >= 8 ? 0.84 : sample >= 5 ? 0.68 : sample >= 3 ? 0.48 : 0.26;
  let mult = 1 + diff * (market === 'goals' ? 0.96 : market === 'points' ? 0.88 : 0.84) * strength;

  if (roleRate != null && sample >= 5) {
    const strongLine = market === 'goals' ? roleRate >= 0.20 : market === 'points' ? roleRate >= 0.42 : roleRate >= 0.38;
    const weakLine = market === 'goals' ? roleRate <= 0.08 : market === 'points' ? roleRate <= 0.20 : roleRate <= 0.18;
    if (strongLine) mult += market === 'shots' ? 0.08 : 0.06;
    if (weakLine) mult -= market === 'shots' ? 0.06 : 0.05;
  }

  if (todayLine === 1 && (roleRate ?? 0) > (posRate ?? 0)) mult += market === 'shots' ? 0.03 : 0.02;
  return clamp(mult, market === 'goals' ? 0.88 : 0.90, market === 'goals' ? 1.24 : 1.22);
}

function capabilityStageMultiplier({ market = 'shots', baseProb = 0, primaryMarket = 'shots', posKey = 'C' }) {
  let mult = 1;
  if (market === 'shots') {
    if (baseProb >= (posKey === 'D' ? 0.34 : 0.52)) mult += 0.10;
    else if (baseProb <= (posKey === 'D' ? 0.10 : 0.16)) mult -= 0.08;
    if (primaryMarket === 'goals') mult -= 0.06;
    else if (primaryMarket === 'shots') mult += 0.06;
    return clamp(mult, 0.86, 1.18);
  }
  if (market === 'points') {
    if (baseProb >= 0.46) mult += 0.10;
    else if (baseProb <= 0.18) mult -= 0.08;
    if (primaryMarket === 'points') mult += 0.06;
    return clamp(mult, 0.88, 1.18);
  }
  if (baseProb >= (posKey === 'D' ? 0.05 : 0.14)) mult += 0.08;
  else if (baseProb <= (posKey === 'D' ? 0.015 : 0.05)) mult -= 0.08;
  if (primaryMarket === 'goals') mult += 0.06;
  return clamp(mult, 0.88, 1.18);
}

function majorFactorProbabilityBlend({ current, baseProb, cheatMult, historyMult, paceCeil, hardCap, floorProb = 0, preserve = 0.34 }) {
  const safeCurrent = Math.max(0, current || 0);
  const safeBase = Math.max(0, baseProb || 0);
  const boost = Math.max(0, safeBase * (cheatMult - 1)) + Math.max(0, safeBase * (historyMult - 1));
  const penalty = Math.max(0, safeBase * (1 - Math.min(1, cheatMult))) + Math.max(0, safeBase * (1 - Math.min(1, historyMult)));
  let blended =
    safeCurrent * preserve +
    safeBase * (1 - preserve) +
    boost * 0.90 -
    penalty * 0.40;

  if (floorProb > 0) {
    blended = Math.max(blended, floorProb);
  }

  // protect real signal from being compressed away
  if (safeCurrent >= hardCap * 0.62 || safeBase >= hardCap * 0.52) {
    blended = Math.max(blended, Math.max(safeCurrent, safeBase) * 0.96);
  }

  blended *= paceCeil;
  return clamp(blended, 0, hardCap);
}

function buildProjections(games, histData, playerHomeAway, lineupData, paceData) {
  const histProfiles = histData?.profiles || histData || null;
  const recentFormMap = histData?.recentForm || {};
  const teamRoleProfiles = histData?.teamRoleProfiles || {};
  const defenseEnv = computeDefenseEnvironment(games);
  const results = [];

  for (const game of games) {
    const awayLabelRaw = game.label.split("@")[0].trim();
    const homeLabelRaw = game.label.split("@")[1].trim();
    const awayNorm = normTeam(awayLabelRaw);
    const homeNorm = normTeam(homeLabelRaw);

    for (const block of game.skaterBlocks) {
      const oppDef = block.oppDef;

      const blockNorm = normTeam(block.team);
      const isHome = blockNorm === homeNorm;

      const teamOffIcf = weightedAverage(block.players, "icfSeason", "toiSeason");
      const teamOffIff = weightedAverage(block.players, "iffSeason", "toiSeason");

      let preppedPlayers = block.players.map((skater) => {
        const playerKey = normalizePlayerName(skater.name);
        const pHA = playerHomeAway?.[playerKey] || playerHomeAway?.[skater.name?.toLowerCase()];
        const playerToi = skater.toiL5 || skater.toiSeason || 0;
        const impliedLine =
          playerToi >= 17.5 ? 1 : playerToi >= 15.1 ? 2 : playerToi >= 12.3 ? 3 : 4;
        const luPlayer = lineupData?.[normalizePlayerName(skater.name)];
        const todayLine = luPlayer?.line ?? impliedLine;
        const lineupPosRaw = (luPlayer?.pos || "").replace(/\s/g, "").toUpperCase();
        const basePosRaw = (skater.pos || "C").replace(/\s/g, "").toUpperCase();
        const resolvedPosRaw = ["C", "LW", "RW", "D"].includes(lineupPosRaw) ? lineupPosRaw : basePosRaw;
        const posKeyForToi = ["C", "LW", "RW", "D"].includes(resolvedPosRaw) ? resolvedPosRaw : "C";
        const effectiveToi = projectedToiFromLineup(posKeyForToi, todayLine, playerToi);
        const venueIffSeason = pHA ? (isHome ? pHA.iff_home : pHA.iff_away) : 0;
        const iffAnchor =
          (venueIffSeason > 0 ? venueIffSeason : skater.iffSeason) || 0;
        const shotsAnchor =
          (pHA ? (isHome ? pHA.base_plus_form_home || pHA.base_shots_home : pHA.base_plus_form_away || pHA.base_shots_away) : 0) ||
          skater.shotsSeason ||
          Math.max(0.01, iffAnchor * 0.68);

        return {
          skater,
          pHA,
          playerToi,
          effectiveToi,
          impliedLine,
          todayLine,
          resolvedPos: posKeyForToi,
          iffAnchor,
          shotsAnchor,
          lineupConfirmed: isPlayerConfirmedInLineup(skater.name, lineupData),
          playerKey,
        };
      });

      // Lineup file is the source of truth for inclusion.
      // If a lineup file is uploaded, only confirmed players remain in the pool,
      // and shares are redistributed across that filtered set.
      if (lineupData) {
        preppedPlayers = preppedPlayers.filter((p) => p.lineupConfirmed);
      }

      if (!preppedPlayers.length) {
        continue;
      }

      const lineTotals = {};
      preppedPlayers.forEach((p) => {
        const key = `L${p.todayLine}`;
        lineTotals[key] = (lineTotals[key] || 0) + (p.iffAnchor || 0);
      });

      const oppShort = normShort(oppDef?.team || "");
      const oppAll = oppDef?.posStats?.ALL || null;
      const teamUploadedPace = paceData?.teamMap?.[block.team] ?? null;
      const oppUploadedPace = paceData?.teamMap?.[oppDef?.team || ""] ?? null;
      const paceLeagueAvg = paceData?.leagueAvg || 60;

      const paceBaseline = 4.9;
      const oppAllIcfPerSkater = oppAll?.icfAllowed ? oppAll.icfAllowed / 12 : 4.9;
      const proxyGamePace = (teamOffIcf + oppAllIcfPerSkater) / 2;
      const proxyPaceMult = clamp(proxyGamePace / paceBaseline, 0.9, 1.12);
      const uploadedGamePace =
        teamUploadedPace != null && oppUploadedPace != null
          ? (teamUploadedPace + oppUploadedPace) / 2
          : teamUploadedPace != null
          ? teamUploadedPace
          : oppUploadedPace != null
          ? oppUploadedPace
          : null;
      const uploadedPaceMult =
        uploadedGamePace != null
          ? clamp(uploadedGamePace / Math.max(1, paceLeagueAvg), 0.9, 1.15)
          : null;
      const blockPaceMult =
        uploadedPaceMult != null
          ? clamp(0.72 * uploadedPaceMult + 0.28 * proxyPaceMult, 0.9, 1.15)
          : proxyPaceMult;
      const paceShots = paceTierProfile(blockPaceMult, 'shots');
      const pacePoints = paceTierProfile(blockPaceMult, 'points');
      const paceGoals = paceTierProfile(blockPaceMult, 'goals');
      const paceTier = paceShots.tier;

      // Stage 1: team expected shots
      const teamBaselineShots = preppedPlayers.reduce(
        (sum, p) => sum + Math.max(0.01, p.shotsAnchor || p.skater.shotsSeason || 0),
        0
      );
      const oppAllShots = oppAll?.shotsAllowed || 28;
      const oppAllIff = oppAll?.iffAllowed || 43;
      const blockDefMult =
        1 +
        (oppAllShots >= 31 ? 0.06 : oppAllShots >= 29 ? 0.02 : -0.03) +
        (oppAllIff >= 45 ? 0.06 : oppAllIff >= 43 ? 0.02 : -0.03);
      const paceCeilingMult = clamp(1 + (blockPaceMult - 1) * 0.32, 0.95, 1.06);
      const teamExpectedShots = clamp(teamBaselineShots * blockDefMult * paceCeilingMult, 18, 42);

      const totalIFF = preppedPlayers.reduce((sum, p) => sum + Math.max(0.1, p.iffAnchor || 0.1), 0);
      const totalTOI = preppedPlayers.reduce((sum, p) => sum + Math.max(1, p.effectiveToi || p.playerToi || 1), 0);
      const totalSPG = preppedPlayers.reduce(
        (sum, p) => sum + Math.max(0.1, p.skater.shotsSeason || p.shotsAnchor || 0.1),
        0
      );

      const opportunityContext = buildTeamOpportunityContext({
        preppedPlayers,
        oppDef,
        blockPaceMult,
        teamExpectedShots,
        isHome,
        histProfiles,
      });

      const shareScores = preppedPlayers.map((p) => {
        const posKey = ["C", "LW", "RW", "D"].includes((p.resolvedPos || "").toUpperCase()) ? (p.resolvedPos || "").toUpperCase() : "C";
        const teamPos = defenseEnv.teamPosAvg[oppShort]?.[posKey] || null;
        const iffShare = safeRatio(Math.max(0.1, p.iffAnchor || 0.1), Math.max(0.1, totalIFF), 0.08);
        const toiShare = safeRatio(Math.max(1, p.effectiveToi || p.playerToi || 1), Math.max(1, totalTOI), 0.08);
        const spgShare = safeRatio(
          Math.max(0.1, p.skater.shotsSeason || p.shotsAnchor || 0.1),
          Math.max(0.1, totalSPG),
          0.08
        );
        let shareScore = 0.5 * iffShare + 0.3 * toiShare + 0.2 * spgShare;
        shareScore *= roleWeight(posKey, p.todayLine, posKey === "D");
        shareScore *= laneModifier(posKey, teamPos);
        return { name: p.skater.name, shareScore, posKey };
      });

      const totalShareScore = shareScores.reduce((sum, s) => sum + s.shareScore, 0) || 1;
      const shareMap = {};
      shareScores.forEach((s) => {
        shareMap[s.name.toLowerCase()] = s.shareScore / totalShareScore;
      });

      for (const prep of preppedPlayers) {
        const { skater, pHA, playerToi, effectiveToi, impliedLine, todayLine, resolvedPos, iffAnchor, playerKey } = prep;

        const posKey = ["C", "LW", "RW", "D"].includes((resolvedPos || "").toUpperCase()) ? (resolvedPos || "").toUpperCase() : "C";

        const venueIffL5 = pHA ? (isHome ? pHA.iff_l5_home : pHA.iff_l5_away) : 0;
        const venueGoalsSeason = pHA ? (isHome ? pHA.g_home : pHA.g_away) : null;
        const venueGoalsL5 = pHA ? (isHome ? pHA.g_l5_home : pHA.g_l5_away) : null;
        const venueConvSeason = pHA
          ? isHome
            ? pHA.conv_home
            : pHA.conv_away
          : safeRatio(skater.shotsSeason || 0, skater.iffSeason || 0, 0.68);
        const venueConvL5 = pHA
          ? isHome
            ? pHA.conv_l5_home
            : pHA.conv_l5_away
          : safeRatio(skater.shotsL5 || 0, skater.iffL5 || 0, venueConvSeason || 0.68);
        const venueDangerSeason = pHA
          ? isHome
            ? pHA.danger_home
            : pHA.danger_away
          : safeRatio(skater.iscfSeason || 0, skater.iffSeason || 0, 0.4);
        const venueDangerL5 = pHA
          ? isHome
            ? pHA.danger_l5_home
            : pHA.danger_l5_away
          : safeRatio(skater.iscfL5 || 0, skater.iffL5 || 0, venueDangerSeason || 0.4);
        const venueVolatility = pHA ? (isHome ? pHA.volatility_home : pHA.volatility_away) : 0;
        const baseShotsAnchor = pHA
          ? isHome
            ? pHA.base_plus_form_home || pHA.base_shots_home
            : pHA.base_plus_form_away || pHA.base_shots_away
          : 0;

        const iffL5Raw =
          venueIffL5 > 0 ? venueIffL5 : skater.iffL5 > 0 ? skater.iffL5 : iffAnchor;
        const iffL5Capped = Math.min(iffL5Raw, iffAnchor * 1.5);
        const isLowL5 = iffL5Capped < 1.5 && iffAnchor > 0;
        const isHotStreak = iffL5Capped > iffAnchor && iffL5Capped <= iffAnchor * 1.5;

        const rawBlend = isLowL5
          ? 0.9 * iffAnchor + 0.1 * iffL5Capped
          : isHotStreak
          ? 0.45 * iffAnchor + 0.55 * iffL5Capped
          : 0.6 * iffAnchor + 0.4 * iffL5Capped;
        const iffBlend = Math.max(0.65 * iffAnchor, rawBlend);

        const convBlend = clamp(
          0.65 * (venueConvSeason || 0.68) + 0.35 * (venueConvL5 || venueConvSeason || 0.68),
          posKey === "D" ? 0.42 : 0.5,
          posKey === "D" ? 0.72 : 0.88
        );
        const dangerRate = clamp(
          0.6 * (venueDangerSeason || 0.4) + 0.4 * (venueDangerL5 || venueDangerSeason || 0.4),
          0.15,
          0.8
        );

        const defenseRanks = defenseEnv.rankMap[`${oppShort}|${posKey}`] || null;
        const defenseAvg = defenseEnv.avgMap[posKey] || null;
        const teamPos = defenseEnv.teamPosAvg[oppShort]?.[posKey] || null;
        const rawTeamPosStats = oppDef?.posStats?.[posKey] || null;

        const shotFloor = playerShotFloorProfile(skater, posKey, todayLine, effectiveToi, iffAnchor, convBlend, dangerRate);
        const goalFloor = playerGoalFloorProfile(skater, posKey, todayLine, effectiveToi);

        let defMult = 1.0;
        if (teamPos && defenseAvg) {
          const shotsRatio = defenseAvg.shots > 0 ? teamPos.shots / defenseAvg.shots : 1;
          const icfRatio = defenseAvg.icf > 0 ? teamPos.icf / defenseAvg.icf : 1;
          const iffRatio = defenseAvg.iff > 0 ? teamPos.iff / defenseAvg.iff : 1;
          const iscfRatio = defenseAvg.iscf > 0 ? teamPos.iscf / defenseAvg.iscf : 1;
          const compositeRatio = 0.3 * shotsRatio + 0.25 * icfRatio + 0.25 * iffRatio + 0.2 * iscfRatio;
          const rawDefMult = clamp(compositeRatio, 0.55, 1.75);
          const dampStrength = shotFloor.defDamp;
          defMult = rawDefMult >= 1
            ? 1 + (rawDefMult - 1) * dampStrength
            : 1 - (1 - rawDefMult) * Math.max(0.9, 1.12 - 0.18 * dampStrength);
          defMult = clamp(defMult, 0.58, shotFloor.level === 'elite' ? 1.72 : shotFloor.level === 'good' ? 1.48 : shotFloor.level === 'average' ? 1.28 : 1.16);
        }

        const posBlockRate =
          teamPos && teamPos.iff > 0 ? 1 - teamPos.shots / teamPos.iff : 0.32;
        const avgBlockRate =
          defenseAvg && defenseAvg.iff > 0 ? 1 - defenseAvg.shots / defenseAvg.iff : 0.32;
        const blockMult = clamp(safeRatio(1 - posBlockRate, 1 - avgBlockRate, 1), 0.82, 1.12);

        const lineKey = `L${todayLine}`;
        const lineTotal = lineTotals[lineKey] || iffAnchor || 1;
        const lineShare = clamp(safeRatio(iffAnchor, lineTotal, 0.33), 0.08, 0.85);
        const hotRole = buildHotRoleOverride({
          posKey,
          todayLine,
          effectiveToi,
          lineShare,
          shotsSeason: skater.shotsSeason || 0,
          shotsL5: skater.shotsL5 || 0,
          iffSeason: iffAnchor || 0,
          iffL5: iffL5Raw || 0,
          iscfSeason: skater.iscfSeason || 0,
          iscfL5: skater.iscfL5 || 0,
          goalsSeason: skater.goalsSeason || 0,
          goalsL5: skater.goalsL5 || 0,
        });
        const dynamicLineShareBase = Math.max(lineShare, hotRole.lineShareFloor || 0);
        const dynamicLineShare = clamp(
          hotRole.hierarchyOverride
            ? Math.max(dynamicLineShareBase, clamp(lineShare * (hotRole.lineShareOverrideMult || 1), 0.08, 0.88))
            : dynamicLineShareBase,
          0.08,
          0.88
        );
        const shareMult =
          dynamicLineShare >= 0.50 ? 1.16 : dynamicLineShare >= 0.42 ? 1.10 : dynamicLineShare >= 0.36 ? 1.05 : dynamicLineShare <= 0.22 ? 0.9 : dynamicLineShare <= 0.27 ? 0.95 : 1.0;

        const volatilityPenalty = clamp(venueVolatility * 0.12, 0, 0.12);
        const volMult = 1 - volatilityPenalty;

        // Stage 2: player shot / goal / point opportunity allocation
        const playerKeyLower = skater.name.toLowerCase();
        const rawPlayerShotShare = shareMap[playerKeyLower] || safeRatio(iffAnchor, totalIFF, 0.08);
        const budgetShotShare = opportunityContext.shotShareMap[playerKeyLower] || rawPlayerShotShare;
        const budgetGoalShare = opportunityContext.goalShareMap[playerKeyLower] || rawPlayerShotShare;
        const budgetPointShare = opportunityContext.pointShareMap[playerKeyLower] || rawPlayerShotShare;
        const lineAllocatedShotShare = opportunityContext.shotAllocatedShareMap?.[playerKeyLower] || budgetShotShare;
        const playerShotShare = clamp(opportunityContext.distributedShotEnv ? 0.14 * rawPlayerShotShare + 0.46 * budgetShotShare + 0.40 * lineAllocatedShotShare : 0.18 * rawPlayerShotShare + 0.54 * budgetShotShare + 0.28 * lineAllocatedShotShare, 0.012, opportunityContext.distributedShotEnv ? 0.44 : 0.38);
        const lineAllocatedGoalShare = opportunityContext.goalAllocatedShareMap?.[playerKeyLower] || budgetGoalShare;
        const playerGoalShare = clamp(
          opportunityContext.distributedGoalEnv
            ? 0.28 * budgetGoalShare + 0.72 * lineAllocatedGoalShare
            : 0.36 * budgetGoalShare + 0.64 * lineAllocatedGoalShare,
          0.010,
          opportunityContext.distributedGoalEnv ? 0.48 : 0.42
        );
        const playerPointShare = clamp(budgetPointShare, 0.015, 0.38);
        const playerShotLaneShare = clamp(opportunityContext.shotLaneShareMap?.[playerKeyLower] || playerShotShare, 0.02, 0.88);
        const playerShotLineShare = clamp(opportunityContext.shotLineBudgetShareMap?.[playerKeyLower] || playerShotLaneShare, 0.02, 0.88);
        const playerShotConversionShare = clamp(opportunityContext.shotConversionShareMap?.[playerKeyLower] || safeRatio(playerShotLaneShare, Math.max(0.02, playerShotLineShare), 1), 0.05, 0.95);
        const playerGoalLaneShare = clamp(opportunityContext.goalLaneShareMap?.[playerKeyLower] || playerGoalShare, 0.02, 0.88);
        const playerPointLaneShare = clamp(opportunityContext.pointLaneShareMap?.[playerKeyLower] || playerPointShare, 0.02, 0.88);
        const shotLaneBudgetShare = opportunityContext.shotLaneBudgetMap?.[posKey] || 0;
        const goalLaneBudgetShare = opportunityContext.goalLaneBudgetMap?.[posKey] || 0;
        const pointLaneBudgetShare = opportunityContext.pointLaneBudgetMap?.[posKey] || 0;
        const shotRankTeam = opportunityContext.shotRankMap?.[playerKeyLower] || 99;
        const shotRankPos = opportunityContext.shotRankByPosMap?.[playerKeyLower] || 99;
        const goalRankTeam = opportunityContext.goalRankMap?.[playerKeyLower] || 99;
        const goalRankPos = opportunityContext.goalRankByPosMap?.[playerKeyLower] || 99;
        const pointRankTeam = opportunityContext.pointRankMap?.[playerKeyLower] || 99;
        const pointRankPos = opportunityContext.pointRankByPosMap?.[playerKeyLower] || 99;
        const positionShotPool = opportunityContext.teamExpectedShots * shotLaneBudgetShare;
        const lineAllocatedShots = positionShotPool * playerShotLineShare;
        const playerConvertedShots = lineAllocatedShots * playerShotConversionShare;
        const expectedShotsBudget = opportunityContext.teamExpectedShots * playerShotShare;
        const expectedGoalsBudget = opportunityContext.teamExpectedGoals * playerGoalShare;
        const expectedPointsBudget = opportunityContext.teamExpectedPoints * playerPointShare;
        const stage2PredShots = 0.78 * playerConvertedShots + 0.22 * expectedShotsBudget;

        const capabilityBase = buildCapabilityBaseFloors({ skater, pHA, isHome, effectiveToi, playerToi, posKey, todayLine });
        const archetype = buildArchetypeEnforcement({
          style: capabilityBase.style,
          posKey,
          skater,
          effectiveToi,
          todayLine,
          dynamicLineShare,
          iffBlend,
          dangerRate,
        });
        const shotGate = buildShotVolumeGate({
          style: capabilityBase.style,
          posKey,
          shotsSeason: skater.shotsSeason || 0,
          iffBlend,
          icfSeason: skater.icfSeason || 0,
          iscfSeason: skater.iscfSeason || 0,
          effectiveToi,
          todayLine,
          dynamicLineShare,
          expectedShotsBudget,
          blockPaceMult,
        });
        const shotExplosion = buildShotExplosionEngine({
          posKey,
          shotsSeason: skater.shotsSeason || 0,
          iffBlend,
          icfSeason: skater.icfSeason || 0,
          iscfSeason: skater.iscfSeason || 0,
          effectiveToi,
          todayLine,
          blockPaceMult,
          teamPos,
          expectedShotsBudget,
          playerShotShare,
          opportunityContext,
        });
        const paceFlowMult = clamp((1 + (blockPaceMult - 1) * 0.26) * paceShots.mult, 0.88, 1.16);
        const positionOpportunityMult = clamp(0.78 + shotLaneBudgetShare * 1.15, 0.72, 1.34);
        const lineAllocationMult = clamp(0.76 + playerShotLineShare * 1.05, 0.70, 1.28);
        const playerConversionMult = clamp(0.78 + playerShotConversionShare * 0.82 + (convBlend - 0.62) * 0.22, 0.76, 1.24);
        const rawLambdaS = Math.max(
          0.01,
          capabilityBase.baseShots * defMult * paceFlowMult * blockMult * volMult * positionOpportunityMult * lineAllocationMult * playerConversionMult * shotGate.shotBias * (shotExplosion.on ? 1.05 : 1)
        );
        const shotsSeasonVal = skater.shotsSeason || 0;
        const shotCapMult = shotFloor.level === 'elite' ? 1.12 : shotFloor.level === 'good' ? 1.0 : shotFloor.level === 'average' ? 0.9 : 0.78;
        const shotsCap = shotsSeasonVal > 0 ? shotsSeasonVal * defMult * blockPaceMult * shotCapMult : Infinity;
        const baseLambdaS = baseShotsAnchor > 0 ? 0.30 * rawLambdaS + 0.25 * baseShotsAnchor + 0.45 * stage2PredShots : 0.42 * rawLambdaS + 0.58 * stage2PredShots;
        let cappedLambdaS = Math.min(0.20 * rawLambdaS + 0.80 * baseLambdaS, shotsCap);

        // audit gates
        if ((skater.iffSeason || iffAnchor || 0) < 2.5) {
          cappedLambdaS = Math.min(cappedLambdaS, 3.1);
        }
        if (shotFloor.level === 'weak') cappedLambdaS = Math.min(cappedLambdaS, posKey === 'D' ? 2.15 : 2.35);
        else if (shotFloor.level === 'average') cappedLambdaS = Math.min(cappedLambdaS, posKey === 'D' ? 2.65 : 3.0);
        if (posKey === 'D' && shotFloor.level !== 'elite') cappedLambdaS = Math.min(cappedLambdaS, 2.9);

        const goalsL5 = (venueGoalsL5 !== null ? venueGoalsL5 : skater.goalsL5) ?? 0;
        const goalsSeason = (venueGoalsSeason !== null ? venueGoalsSeason : skater.goalsSeason) ?? 0;
        const rawGoalsBlend = 0.25 * goalsL5 + 0.75 * goalsSeason;
        const goalsFloor = goalsL5 === 0 ? 0.85 * goalsSeason : 0.9 * goalsSeason;
        const scorerTier = scorerTierInfo({
          ...skater,
          goalsL5,
          goalsSeason,
        }, todayLine, effectiveToi, posKey);
        const l5GoalFormMult = last5GoalFormMultiplier({
          ...skater,
          goalsL5,
          goalsSeason,
        });
        let defenseGoalMult = defenseGoalMultiplier(teamPos, defenseAvg, posKey);
        if (defenseGoalMult >= 1) {
          defenseGoalMult = 1 + (defenseGoalMult - 1) * goalFloor.defDamp;
        } else {
          defenseGoalMult = 1 - (1 - defenseGoalMult) * Math.max(0.92, 1.08 - 0.16 * goalFloor.defDamp);
        }
        defenseGoalMult = clamp(defenseGoalMult, 0.82, goalFloor.level === 'elite' ? 1.2 : goalFloor.level === 'good' ? 1.12 : goalFloor.level === 'average' ? 1.06 : 1.02);
        const roleGoalMult = roleGoalAccessMultiplier(todayLine, effectiveToi);
        const dangerMult = clamp(0.94 + (dangerRate - 0.42) * 0.55, 0.9, 1.12);
        const convGoalMult = clamp(0.93 + (convBlend - 0.68) * 0.35, 0.9, 1.12);
        const goalShareMult = clamp(0.95 + (lineShare - 0.28) * 0.35, 0.86, 1.1);
        const paceGoalMult = clamp((0.94 + (blockPaceMult - 1) * 0.45) * paceGoals.mult, 0.86, 1.12);

        const playerGoalBase = Math.max(
          0.001,
          Math.max(goalsFloor, rawGoalsBlend) * scorerTier.baseMult * l5GoalFormMult
        );
        const baseLambdaG = Math.max(
          0.001,
          playerGoalBase * defenseGoalMult * roleGoalMult * goalShareMult * dangerMult * convGoalMult * paceGoalMult
        );

        const astL5 = (skater.astL5 ?? skater.astSeason) ?? 0;
        const astSeason = skater.astSeason ?? 0;
        const pointsL5 = goalsL5 + astL5;
        const pointsSeason = goalsSeason + astSeason;
        const rawPointsBlend = 0.35 * pointsL5 + 0.65 * pointsSeason;
        const pointsFloor = pointsL5 === 0 ? 0.9 * pointsSeason : 0.92 * pointsSeason;
        const assistRatio = teamPos && defenseAvg
          ? safeRatio(teamPos.assists || 0, Math.max(0.75, defenseAvg.assists || 0.75), 1)
          : 1;
        const pointDefenseMult = clamp(
          0.45 * defenseGoalMult + 0.35 * assistRatio + 0.20 * safeRatio(teamPos?.shots || 0, Math.max(3.5, defenseAvg?.shots || 3.5), 1),
          0.84,
          1.22
        );
        const pointRoleMult = clamp(
          0.96 + (todayLine === 1 ? 0.10 : todayLine === 2 ? 0.05 : -0.08) + (effectiveToi >= 19 ? 0.03 : effectiveToi < 15 ? -0.06 : 0),
          0.76,
          1.16
        );
        const pointShareMult = clamp(0.97 + (lineShare - 0.28) * 0.45, 0.84, 1.14);
        const pacePointMult = clamp((0.95 + (blockPaceMult - 1) * 0.35) * pacePoints.mult, 0.88, 1.14);
        const pointPlayerBase = Math.max(0.001, Math.max(pointsFloor, rawPointsBlend));
        const baseLambdaP = Math.max(
          0.001,
          pointPlayerBase * pointDefenseMult * pointRoleMult * pointShareMult * pacePointMult
        );

        const lineShift = impliedLine - todayLine;
        const lineBoost = Math.max(0, Math.min(0.12, lineShift * 0.06));
        const lineBoostedS = cappedLambdaS * (1 + lineBoost);
        const lineBoostedG = baseLambdaG * (1 + lineBoost * 0.12);
        const lineBoostedP = baseLambdaP * (1 + lineBoost * 0.08);

        const oppTK = normTeam(oppDef?.team || "");
        const histPos = histProfiles?.[oppTK]?.[posKey] || null;
        const aS3 = histAdj(effectiveToi, histPos?.s3);
        const aS4 = histAdj(effectiveToi, histPos?.s4);
        const aS5 = histAdj(effectiveToi, histPos?.s5);
        const aG1 = histAdj(effectiveToi, histPos?.g1);
        const aG2 = histAdj(effectiveToi, histPos?.g2);
        const currentRole = `${posKey}${Math.max(1, Math.min(todayLine, 3))}`.toUpperCase();
        const roleProfile = histPos?._byRole?.[currentRole] || null;
        const roleVenueProfile = pickVenueProfile(roleProfile, isHome);
        const roleS3Rate = profileRate(roleVenueProfile, "s3") ?? profileRate(roleProfile, "s3");
        const roleS4Rate = profileRate(roleVenueProfile, "s4") ?? profileRate(roleProfile, "s4");
        const roleS5Rate = profileRate(roleVenueProfile, "s5") ?? profileRate(roleProfile, "s5");
        const roleP1Rate = profileRate(roleVenueProfile, "p1") ?? profileRate(roleProfile, "p1");
        const roleP2Rate = profileRate(roleVenueProfile, "p2") ?? profileRate(roleProfile, "p2");
        const overallS4Rate = profileRate(pickVenueProfile(histPos, isHome), "s4") ?? profileRate(histPos, "s4");
        const roleG1Rate = profileRate(roleVenueProfile, "g1") ?? profileRate(roleProfile, "g1");
        const roleG2Rate = profileRate(roleVenueProfile, "g2") ?? profileRate(roleProfile, "g2");
        const overallG1Rate = profileRate(pickVenueProfile(histPos, isHome), "g1") ?? profileRate(histPos, "g1");
        const roleSample = roleProfile?._venue?.n ?? roleProfile?.s4?.total ?? 0;
        const roleVenueSample = roleVenueProfile?._venue?.n ?? roleSample;
        const venueHistoryCode = isHome ? "H" : "A";
        const oppLast7Venue = roleProfile?._last7?.[venueHistoryCode] || null;
        let lineFit = "neutral";
        let roleShotAdj = 1;
        let roleGoalAdj = 1;
        if (roleSample >= 5 && roleS4Rate != null && overallS4Rate != null) {
          const diff = roleS4Rate - overallS4Rate;
          if (diff >= 0.12) { lineFit = "aligned"; roleShotAdj = 1.07; }
          else if (diff <= -0.12) { lineFit = "mismatch"; roleShotAdj = 0.93; }
          else if (Math.abs(diff) >= 0.05) { lineFit = "mixed"; roleShotAdj = diff > 0 ? 1.03 : 0.98; }
        }
        if (roleSample >= 5 && roleG1Rate != null && overallG1Rate != null) {
          const diffG = roleG1Rate - overallG1Rate;
          if (diffG >= 0.08) roleGoalAdj = 1.04;
          else if (diffG <= -0.08) roleGoalAdj = 0.96;
        }
        const venueForm = recentFormMap?.[playerKey]?.[isHome ? "H" : "A"] || null;
        const venueTrendImpact = buildVenueTrendImpact(venueForm);
        const oppRoleProfile = teamRoleProfiles?.[oppTK]?.byRole?.[currentRole] || null;
        const defenseRoleBoost = applyDefenseProfilePriorityResolver({
          boost: buildDefenseRoleMarketBoost({
            oppRoleProfile,
            posStats: rawTeamPosStats,
            currentRole,
            posKey,
            todayLine,
            effectiveToi,
            skater
          }),
          oppTK,
          posKey,
          todayLine,
          currentRole,
          effectiveToi,
          posStats: rawTeamPosStats,
          roleS3Rate,
          roleS4Rate,
          roleVenueSample,
        });
        const teamRoleShotAdj = defenseRoleBoost.shotAdj;
        const teamRolePointAdj = defenseRoleBoost.pointAdj;
        const teamRoleGoalAdj = defenseRoleBoost.goalAdj;

        const shotDriverIff = skater.iffSeason || iffAnchor || 0;
        const shotDriverShots = skater.shotsSeason || 0;
        const isShotDriver = shotDriverIff >= 3.5 || (shotDriverIff >= 3.0 && lineShare >= 0.35);
        const isEliteShotDriver = shotDriverIff >= 4.5 && shotDriverShots >= 3.0;
        const isSecondaryShooter = lineShare < 0.30;

        const rawShotEnvMult = roleShotAdj * venueTrendImpact.shotMult * teamRoleShotAdj;
        const cappedShotEnvMult = clamp(rawShotEnvMult, 0.90, 1.18);
        const shotLambda3 = lineBoostedS * aS3.mult * cappedShotEnvMult * 1.05;
        const shotLambda4 = lineBoostedS * aS4.mult * cappedShotEnvMult * 1.14;
        const shotLambda5 = lineBoostedS * aS5.mult * cappedShotEnvMult * (isEliteShotDriver ? 1.15 : 1.05);

        let p3s = poissonAtLeast((posKey === 'RW' && shotDriverIff >= 3.8 ? shotLambda3 * 1.08 : shotLambda3) * shotGate.p3Mult * shotExplosion.p3Mult, 3);
        let p4s = poissonAtLeast((posKey === 'RW' && shotDriverIff >= 3.8 ? shotLambda4 * 1.08 : shotLambda4) * shotGate.p4Mult * shotExplosion.p4Mult, 4);
        let p5s = poissonAtLeast((posKey === 'RW' && shotDriverIff >= 3.8 ? shotLambda5 * 1.08 : shotLambda5) * shotGate.p5Mult * shotExplosion.p5Mult, 5);
        let p1p = poissonAtLeast(lineBoostedP * venueTrendImpact.pointMult * teamRolePointAdj, 1);
        let p2p = poissonAtLeast(lineBoostedP * venueTrendImpact.pointMult * teamRolePointAdj, 2);

        // March 18 audit change:
        // goals are now derived from points first, then filtered by goal-finishing quality.
        const pointBaseForGoals = Math.max(0.001, p1p);
        const goalShareOfPointsSeason = safeRatio(goalsSeason, Math.max(0.01, pointsSeason), 0);
        const goalShareOfPointsL5 = safeRatio(goalsL5, Math.max(0.01, pointsL5), goalShareOfPointsSeason);
        const goalShareOfPoints = clamp(
          0.75 * goalShareOfPointsSeason + 0.25 * goalShareOfPointsL5,
          posKey === "D" ? 0.10 : 0.14,
          posKey === "D" ? 0.42 : 0.78
        );
        const finisherGate = buildFinisherShooterGate({
          style: capabilityBase.style,
          posKey,
          shotsSeason: skater.shotsSeason || 0,
          goalsSeason,
          iscfSeason: skater.iscfSeason || 0,
          assistsSeason: skater.astSeason || 0,
          effectiveToi,
          todayLine,
          dynamicLineShare,
          dangerRate,
          convBlend,
        });
        const goalProbModel = buildGoalProbabilityFromPipeline({
          posKey,
          todayLine,
          style: capabilityBase.style,
          finisherGate,
          scorerTier,
          p1p,
          p2p,
          baseLambdaG: lineBoostedG,
          expectedGoalsBudget,
          playerGoalShare,
          goalShareOfPoints,
          dangerRate,
          convBlend,
          effectiveToi,
          goalsSeason,
          goalsL5,
          shotsSeason: skater.shotsSeason || 0,
          roleGoalAdj,
          venueGoalMult: venueTrendImpact.goalMult,
          teamRoleGoalAdj,
          defenseGoalMult,
          roleGoalMult,
          histGoalMult1: aG1.mult,
          histGoalMult2: aG2.mult,
          broadGoalEnv: opportunityContext.broadGoalEnv,
          distributedGoalEnv: opportunityContext.distributedGoalEnv,
          goalRankTeam,
          goalRankPos,
        });
        const finisherGoalModel = buildFinisherGoalModel({
          posKey,
          todayLine,
          effectiveToi,
          goalsSeason,
          goalsL5,
          shotsSeason: skater.shotsSeason || 0,
          iscfSeason: skater.iscfSeason || 0,
          dangerRate,
          convBlend,
          leakScore: 0,
          environmentScore: 0,
          goalRankTeam,
          goalRankPos,
          hotRole,
        });
        const finisherFilter = goalProbModel.finisherProfile;
        const finisherP1Boost =
          finisherGoalModel?.active && finisherGoalModel?.profile === 'elite_finisher' ? 1.20 :
          finisherGoalModel?.active && finisherGoalModel?.profile === 'finisher' ? 1.10 :
          1.0;
        const finisherP2Boost =
          finisherGoalModel?.active && finisherGoalModel?.profile === 'elite_finisher' ? ((goalsL5 >= 0.4 || goalsSeason >= 0.30) ? 1.18 : 1.14) :
          finisherGoalModel?.active && finisherGoalModel?.profile === 'finisher' ? 1.06 :
          1.0;
        let p1g = Math.max(goalProbModel.p1, (finisherGoalModel.p1 || 0) * finisherP1Boost);
        let p2g = Math.max(goalProbModel.p2, (finisherGoalModel.p2 || 0) * finisherP2Boost);
        let p3g = Math.max(goalProbModel.p3, finisherGoalModel.p3 || 0);

        if (posKey === "D" && !defenseGoalExceptional(skater, effectiveToi)) {
          p1g = Math.min(p1g, 0.08);
          p2g = Math.min(p2g, 0.01);
          p3g = Math.min(p3g, 0.001);
        }

        const goalLeakOverride = positionGoalLeakOverride({
          posKey,
          todayLine,
          effectiveToi,
          skater,
          teamPos,
        });

        if (goalLeakOverride?.flag && (goalFloor.premium1Open || goalLeakOverride?.bypassGoalCaps)) {
          p1g = Math.max(p1g, goalLeakOverride.p1gFloor);
          p2g = Math.max(p2g, goalLeakOverride.p2gFloor);
        }

        const rwEliteVolumeForShots =
          posKey === 'RW' &&
          effectiveToi >= 18.5 &&
          (skater.shotsSeason || 0) >= 3.0 &&
          (skater.iffSeason || iffAnchor || 0) >= 4.2 &&
          (skater.icfSeason || 0) >= 6.0 &&
          (skater.iscfSeason || 0) >= 2.4;

        if (!shotFloor.premium4Open) p4s = Math.min(p4s, shotFloor.max4);
        p5s = Math.min(p5s, shotFloor.max5);
        if (posKey === 'D' && shotFloor.level !== 'elite') {
          p4s = Math.min(p4s, 0.42);
          p5s = Math.min(p5s, 0.18);
        }

        const goalCaps = goalCapsForTier(scorerTier.tier, posKey, todayLine, !!goalLeakOverride?.flag);
        const goalCap1 = Math.min(goalCaps.p1, goalFloor.max1);
        const goalCap2 = Math.min(goalCaps.p2, goalFloor.max2);
        if (!goalFloor.premium1Open) p1g = Math.min(p1g, Math.min(goalCap1, 0.33));
        p1g = Math.min(p1g, goalCap1);
        p2g = Math.min(p2g, goalCap2, p1g * 0.55);
        p3g = Math.min(p3g, p2g * 0.35, p1g * 0.18);
        const pointCap1 = posKey === 'D' ? 0.34 : todayLine === 1 ? 0.72 : todayLine === 2 ? 0.58 : 0.42;
        const pointCap2 = posKey === 'D' ? 0.08 : todayLine === 1 ? 0.32 : todayLine === 2 ? 0.20 : 0.10;
        if (effectiveToi < 14.5) {
          p1p = Math.min(p1p, 0.34);
          p2p = Math.min(p2p, 0.08);
        }
        const riskyVenueBoost = false;
        if (riskyVenueBoost && scorerTier.tier === 'low') {
          p1p *= 0.96;
          p2p *= 0.94;
        }
        p1p = Math.min(p1p, pointCap1);
        p2p = Math.min(p2p, pointCap2, p1p * 0.5);

        if (defenseRoleBoost.p1PointFloor > 0) {
          p1p = Math.max(p1p, Math.min(pointCap1, defenseRoleBoost.p1PointFloor));
        }
        if (defenseRoleBoost.p2PointFloor > 0) {
          p2p = Math.max(p2p, Math.min(pointCap2, defenseRoleBoost.p2PointFloor, p1p * 0.58));
        }

        // Goals should usually sit below points, but efficient finishers must keep access.
        const pointGoalCap1 = Math.max(0.06, p1p * (0.58 + finisherFilter * 0.85));
        const pointGoalCap2 = Math.max(0.01, p2p * (0.26 + finisherFilter * 0.34));
        p1g = Math.min(p1g, pointGoalCap1);
        p2g = Math.min(p2g, pointGoalCap2, p1g * (0.50 + finisherFilter * 0.14));
        p3g = Math.min(p3g, p2g * (0.24 + finisherFilter * 0.10));

        if (goalLeakOverride?.flag && goalLeakOverride?.bypassGoalCaps) {
          p1g = Math.max(p1g, goalLeakOverride.p1gFloor);
          p2g = Math.max(p2g, Math.min(goalLeakOverride.p2gFloor, p1g * 0.55));
        }
        if (defenseRoleBoost.p1GoalFloor > 0) {
          p1g = Math.max(p1g, Math.min(Math.max(goalCap1, defenseRoleBoost.p1GoalFloor), Math.max(p1p * 0.9, defenseRoleBoost.p1GoalFloor)));
        }
        if (defenseRoleBoost.p2GoalFloor > 0) {
          p2g = Math.max(p2g, Math.min(defenseRoleBoost.p2GoalFloor, p1g * 0.55, Math.max(p2p * 0.55, defenseRoleBoost.p2GoalFloor)));
        }

        if (defenseRoleBoost.primaryMarket === 'goal') {
          p1g = Math.max(p1g, Math.min(0.42, defenseRoleBoost.p1GoalFloor || 0));
          p1p = Math.max(p1p, Math.min(pointCap1, Math.max(defenseRoleBoost.p1PointFloor || 0, p1g * 1.02)));
          p2g = Math.max(p2g, Math.min(0.10, Math.max(defenseRoleBoost.p2GoalFloor || 0, p1g * 0.22)));
        } else if (defenseRoleBoost.primaryMarket === 'points') {
          p1p = Math.max(p1p, Math.min(pointCap1, defenseRoleBoost.p1PointFloor || 0));
          p2p = Math.max(p2p, Math.min(pointCap2, Math.max(defenseRoleBoost.p2PointFloor || 0, p1p * 0.22)));
          if ((defenseRoleBoost.p1GoalFloor || 0) > 0) {
            p1g = Math.max(p1g, Math.min(0.28, defenseRoleBoost.p1GoalFloor));
          }
        }

        const lambdaGDisplay = Math.max(0.001, lineBoostedP * finisherFilter * 0.9);
        let lambdaPDisplay = Math.max(0.001, -Math.log(Math.max(0.001, 1 - Math.min(0.98, p1p))));

        // audit probability controls
        if ((skater.iffSeason || iffAnchor || 0) < 2.5) p3s = Math.min(p3s, 0.65);
        if ((skater.shotsSeason || 0) < 3.5 || (skater.iffSeason || iffAnchor || 0) < 4.0) p5s = Math.min(p5s, 0.45);
        if ((skater.shotsSeason || 0) >= 3.2) {
          p3s *= 0.95;
          p4s *= 0.95;
          p5s *= 0.95;
        }
        p4s = Math.min(p4s, shotFloor.max4);
        p5s = Math.min(p5s, shotFloor.max5);
        if (!goalFloor.premium1Open && !goalLeakOverride?.bypassGoalCaps) {
          p1g = Math.min(p1g, Math.min(goalFloor.max1, 0.33));
          p2g = Math.min(p2g, Math.min(goalFloor.max2, 0.05));
          p3g = Math.min(p3g, 0.01);
        }
        if (goalLeakOverride?.flag && goalLeakOverride?.bypassGoalCaps) {
          p1g = Math.max(p1g, goalLeakOverride.p1gFloor);
          p2g = Math.max(p2g, Math.min(goalLeakOverride.p2gFloor, p1g * 0.55));
        }
        if (posKey === 'D') {
          p4s = Math.min(p4s, shotFloor.level === 'elite' ? 0.52 : 0.42);
          p5s = Math.min(p5s, shotFloor.level === 'elite' ? 0.28 : 0.16);
        }

        // Team-level opportunity budget controls
        const shotShareFloor3 = posKey === 'D'
          ? (opportunityContext.distributedShotEnv ? 0.065 : 0.075)
          : (opportunityContext.distributedShotEnv ? 0.075 : 0.085);
        const shotShareFloor4 = posKey === 'D'
          ? (opportunityContext.distributedShotEnv ? 0.078 : 0.088)
          : (opportunityContext.distributedShotEnv ? 0.095 : 0.110);
        const shotShareFloor5 = posKey === 'D' ? 0.095 : 0.130;
        const expShotsFloor3 = posKey === 'D' ? 2.05 : 2.35;
        const expShotsFloor4 = posKey === 'D' ? 2.85 : 3.25;
        const expShotsFloor5 = posKey === 'D' ? 3.65 : 4.15;

        if (playerShotShare < shotShareFloor3 || expectedShotsBudget < expShotsFloor3) {
          p3s *= playerShotShare < shotShareFloor3 ? 0.76 : 0.84;
          p3s = Math.min(p3s, posKey === 'D' ? 0.42 : 0.58);
        }
        if (playerShotShare < shotShareFloor4 || expectedShotsBudget < expShotsFloor4) {
          p4s *= playerShotShare < shotShareFloor4 ? 0.56 : 0.72;
          p4s = Math.min(p4s, posKey === 'D' ? 0.26 : 0.36);
        } else if (opportunityContext.distributedShotEnv && opportunityContext.teamExpectedShots >= 30.5 && expectedShotsBudget >= (expShotsFloor4 + 0.30)) {
          const multiShotFloor = posKey === 'D' ? 0.18 : 0.24;
          p4s = Math.max(p4s, Math.min(0.48, multiShotFloor + (expectedShotsBudget - expShotsFloor4) * 0.07));
        }
        if (playerShotShare < shotShareFloor5 || expectedShotsBudget < expShotsFloor5) {
          p5s *= playerShotShare < shotShareFloor5 ? 0.38 : 0.56;
          p5s = Math.min(p5s, posKey === 'D' ? 0.06 : 0.12);
        }

        const pointShareFloor = todayLine === 1 ? 0.115 : todayLine === 2 ? 0.095 : 0.075;
        const pointBudgetCap1 = clamp(expectedPointsBudget * (0.82 + Math.min(0.22, scorerTier.score * 0.08)), posKey === 'D' ? 0.10 : 0.14, posKey === 'D' ? 0.52 : 0.80);
        const pointBudgetCap2 = clamp(Math.max(0, expectedPointsBudget - 0.65) * (0.24 + scorerTier.score * 0.04), 0.01, posKey === 'D' ? 0.16 : 0.30);
        if (playerPointShare < pointShareFloor && expectedPointsBudget < 0.90) {
          p1p *= 0.82;
          p2p *= 0.68;
        }
        p1p = Math.min(p1p, pointBudgetCap1);
        p2p = Math.min(p2p, Math.min(pointBudgetCap2, p1p * 0.48));

        const distributedGoalAllowance = opportunityContext.distributedGoalEnv && opportunityContext.teamExpectedGoals >= 3.25;
        const broadGoalAllowance = opportunityContext.broadGoalEnv && opportunityContext.teamExpectedGoals >= 2.75;
        const expansionFloorAdj = distributedGoalAllowance ? -0.015 : broadGoalAllowance ? -0.008 : 0;
        const goalShareFloor1 = posKey === 'D'
          ? 0.060
          : todayLine === 1
          ? (opportunityContext.teamExpectedGoals >= 3.2 ? 0.10 : 0.12) + expansionFloorAdj
          : todayLine === 2
          ? (opportunityContext.teamExpectedGoals >= 3.2 ? 0.085 : 0.10) + expansionFloorAdj
          : 0.075 + Math.min(0, expansionFloorAdj * 0.7);
        const goalShareFloor2 = posKey === 'D' ? 0.080 : todayLine === 1 ? 0.145 + expansionFloorAdj : todayLine === 2 ? 0.115 + expansionFloorAdj : 0.10 + Math.min(0, expansionFloorAdj * 0.6);
        const expGoalFloor1 = posKey === 'D' ? 0.09 : todayLine === 1 ? (distributedGoalAllowance ? 0.18 : 0.22) : todayLine === 2 ? (distributedGoalAllowance ? 0.15 : 0.18) : (distributedGoalAllowance ? 0.12 : 0.14);
        const expGoalFloor2 = posKey === 'D' ? 0.16 : todayLine === 1 ? (distributedGoalAllowance ? 0.34 : 0.42) : (distributedGoalAllowance ? 0.26 : 0.32);
        const teamGoalCapMax = posKey === 'D' ? 0.20 : distributedGoalAllowance ? (todayLine === 1 ? 0.50 : todayLine === 2 ? 0.38 : 0.28) : todayLine === 1 ? 0.46 : todayLine === 2 ? 0.34 : 0.22;
        const goalBudgetCap1 = clamp(
          expectedGoalsBudget * (1.12 + Math.min(0.24, scorerTier.score * 0.10) + (goalLeakOverride?.flag ? 0.08 : 0)) * (goalRankTeam <= 2 ? 1.08 : goalRankTeam <= 4 && distributedGoalAllowance ? 1.02 : 0.96),
          posKey === 'D' ? 0.02 : 0.05,
          teamGoalCapMax
        );
        const goalBudgetCap2 = clamp(
          Math.max(0, expectedGoalsBudget - (posKey === 'D' ? 0.08 : 0.18)) * (0.34 + Math.min(0.12, scorerTier.score * 0.05)) * (goalRankTeam <= 2 ? 1.05 : goalRankTeam <= 4 && distributedGoalAllowance ? 1.00 : 0.92),
          0.002,
          posKey === 'D' ? 0.04 : distributedGoalAllowance ? (todayLine === 1 ? 0.13 : 0.085) : todayLine === 1 ? 0.12 : 0.075
        );

        if ((playerGoalShare < goalShareFloor1 || expectedGoalsBudget < expGoalFloor1) && !goalLeakOverride?.bypassGoalCaps) {
          p1g *= playerGoalShare < goalShareFloor1 ? 0.70 : 0.82;
          p1g = Math.min(p1g, posKey === 'D' ? 0.08 : distributedGoalAllowance ? 0.24 : 0.20);
        }
        if ((playerGoalShare < goalShareFloor2 || expectedGoalsBudget < expGoalFloor2) && !goalLeakOverride?.bypassGoalCaps) {
          p2g *= playerGoalShare < goalShareFloor2 ? 0.44 : 0.62;
          p2g = Math.min(p2g, posKey === 'D' ? 0.01 : distributedGoalAllowance ? 0.06 : 0.05);
        }

        if (!goalLeakOverride?.bypassGoalCaps) {
          if (goalRankTeam > opportunityContext.maxGoalCandidates) {
            p1g *= distributedGoalAllowance ? 0.68 : 0.52;
            p2g *= distributedGoalAllowance ? 0.42 : 0.28;
          } else if (goalRankTeam > 3 && !distributedGoalAllowance) {
            p1g *= 0.78;
            p2g *= 0.58;
          } else if (goalRankTeam > 4 && distributedGoalAllowance) {
            p1g *= 0.84;
            p2g *= 0.66;
          }

          if (goalRankPos > (distributedGoalAllowance ? 2 : 1)) {
            p1g *= goalRankPos === 2 ? 0.90 : distributedGoalAllowance ? 0.76 : 0.62;
            p2g *= goalRankPos === 2 ? 0.82 : distributedGoalAllowance ? 0.60 : 0.40;
          }

          if (goalLaneBudgetShare < (distributedGoalAllowance ? 0.16 : 0.20) && goalRankPos > 1) {
            p1g *= 0.86;
            p2g *= 0.74;
          }

          if (playerGoalLaneShare < (distributedGoalAllowance ? 0.22 : 0.26) && goalRankPos > 1) {
            p1g *= 0.88;
            p2g *= 0.76;
          }
        }

        p1g = Math.min(p1g, goalBudgetCap1);
        p2g = Math.min(p2g, Math.min(goalBudgetCap2, p1g * 0.44));
        p3g = Math.min(p3g, Math.min(goalBudgetCap2 * 0.32, p2g * 0.24));

        if (goalLeakOverride?.flag && goalLeakOverride?.bypassGoalCaps) {
          p1g = Math.max(p1g, Math.min(goalBudgetCap1 + 0.08, goalLeakOverride.p1gFloor));
          p2g = Math.max(p2g, Math.min(goalBudgetCap2 + 0.02, goalLeakOverride.p2gFloor, p1g * 0.55));
        }

        const histVenue = pickVenueProfile(histPos, isHome);
        const histS3Rate = profileRate(histVenue, "s3") ?? profileRate(histPos, "s3");
        const histS4Rate = profileRate(histVenue, "s4") ?? profileRate(histPos, "s4");
        const histS5Rate = profileRate(histVenue, "s5") ?? profileRate(histPos, "s5");
        const histP1Rate = profileRate(histVenue, "p1") ?? profileRate(histPos, "p1");
        const histP2Rate = profileRate(histVenue, "p2") ?? profileRate(histPos, "p2");
        const histG1Rate = profileRate(histVenue, "g1") ?? profileRate(histPos, "g1");
        const histG2Rate = profileRate(histVenue, "g2") ?? profileRate(histPos, "g2");
        const histSample = histVenue?._venue?.n ?? histPos?._venue?.n ?? histPos?.s3?.total ?? 0;

        const defRank = defenseRanks?.compositeRank || 99;
        const totalTeams = defenseEnv.teamCountMap[posKey] || 32;
        const leakScore = leakScoreFromRank(defRank, totalTeams);

        const cheatShotsMult = cheatSheetMajorMultiplier(rawTeamPosStats, 'shots', posKey);
        const cheatPointsMult = cheatSheetMajorMultiplier(rawTeamPosStats, 'points', posKey);
        const cheatGoalsMult = cheatSheetMajorMultiplier(rawTeamPosStats, 'goals', posKey);
        const histShotsMult = historyMajorMultiplier({ market: 'shots', roleRate: roleS3Rate ?? roleS4Rate, posRate: histS3Rate ?? histS4Rate, roleSample, venueSample: roleVenueSample });
        const histPointsMult = historyMajorMultiplier({ market: 'points', roleRate: roleP1Rate, posRate: histP1Rate, roleSample, venueSample: roleVenueSample });
        const histGoalsMult = historyMajorMultiplier({ market: 'goals', roleRate: roleG1Rate, posRate: histG1Rate, roleSample, venueSample: roleVenueSample });
        const paceShotCeil = paceCeilingMultiplier({ market: 'shots', blockPaceMult, opportunityContext, todayLine, rankTeam: goalRankTeam, rankPos: goalRankPos });
        const pacePointCeil = paceCeilingMultiplier({ market: 'points', blockPaceMult, opportunityContext, todayLine, rankTeam: pointRankTeam, rankPos: pointRankPos });
        const paceGoalCeil = paceCeilingMultiplier({ market: 'goals', blockPaceMult, opportunityContext, todayLine, rankTeam: goalRankTeam, rankPos: goalRankPos });

        const capabilityP3 = poissonAtLeast(capabilityBase.baseShots, 3);
        const capabilityP4 = poissonAtLeast(capabilityBase.baseShots, 4);
        const capabilityP5 = poissonAtLeast(capabilityBase.baseShots, 5);
        const capabilityP1Point = poissonAtLeast(capabilityBase.basePoints, 1);
        const capabilityP2Point = poissonAtLeast(capabilityBase.basePoints, 2);
        const capabilityP1Goal = poissonAtLeast(capabilityBase.baseGoals, 1);
        const capabilityP2Goal = poissonAtLeast(capabilityBase.baseGoals, 2);

        p3s = majorFactorProbabilityBlend({ current: p3s, baseProb: capabilityP3, cheatMult: cheatShotsMult, historyMult: histShotsMult, paceCeil: paceShotCeil, hardCap: posKey === 'D' ? 0.82 : 0.92, floorProb: defenseRoleBoost.p3Floor || 0 });
        p4s = majorFactorProbabilityBlend({ current: p4s, baseProb: capabilityP4, cheatMult: cheatShotsMult, historyMult: histShotsMult, paceCeil: paceShotCeil * shotExplosion.p4Mult, hardCap: Math.min(posKey === 'D' ? 0.72 : 0.88, shotGate.cap4), floorProb: Math.max(shotGate.floor4, shotExplosion.floor4) });
        p5s = majorFactorProbabilityBlend({ current: p5s, baseProb: capabilityP5, cheatMult: clamp(cheatShotsMult * 0.98, 0.76, 1.26), historyMult: clamp(histShotsMult * 0.98, 0.80, 1.22), paceCeil: paceShotCeil * shotExplosion.p5Mult, hardCap: Math.min(posKey === 'D' ? 0.34 : 0.68, shotGate.cap5), floorProb: Math.max(shotGate.floor5, shotExplosion.floor5), preserve: 0.42 });
        p1p = majorFactorProbabilityBlend({ current: p1p, baseProb: capabilityP1Point, cheatMult: cheatPointsMult, historyMult: histPointsMult, paceCeil: pacePointCeil, hardCap: posKey === 'D' ? 0.62 : 0.84, floorProb: defenseRoleBoost.p1PointFloor || 0 });
        p2p = majorFactorProbabilityBlend({ current: p2p, baseProb: capabilityP2Point, cheatMult: clamp(cheatPointsMult * 0.98, 0.76, 1.26), historyMult: clamp(histPointsMult * 0.96, 0.80, 1.20), paceCeil: pacePointCeil, hardCap: posKey === 'D' ? 0.24 : 0.38, floorProb: defenseRoleBoost.p2PointFloor || 0, preserve: 0.40 });
        p1g = majorFactorProbabilityBlend({ current: p1g, baseProb: capabilityP1Goal, cheatMult: cheatGoalsMult, historyMult: histGoalsMult, paceCeil: paceGoalCeil, hardCap: posKey === 'D' ? 0.22 : 0.52, floorProb: Math.max(defenseRoleBoost.p1GoalFloor || 0, goalLeakOverride?.p1gFloor || 0), preserve: 0.38 });
        p2g = majorFactorProbabilityBlend({ current: p2g, baseProb: capabilityP2Goal, cheatMult: clamp(cheatGoalsMult * 0.98, 0.74, 1.26), historyMult: clamp(histGoalsMult * 0.95, 0.78, 1.20), paceCeil: paceGoalCeil, hardCap: posKey === 'D' ? 0.045 : 0.16, floorProb: Math.max(defenseRoleBoost.p2GoalFloor || 0, goalLeakOverride?.p2gFloor || 0), preserve: 0.42 });

        p3s *= archetype.shotsMult;
        p4s *= archetype.shotsMult;
        p5s *= archetype.shotsMult;
        p1p *= archetype.pointsMult;
        p2p *= archetype.pointsMult;
        p1g *= archetype.goalsMult;
        p2g *= archetype.goalsMult;
        if (archetype.p1GoalFloor > 0) p1g = Math.max(p1g, archetype.p1GoalFloor);
        if (archetype.p2GoalFloor > 0) p2g = Math.max(p2g, Math.min(archetype.p2GoalFloor, p1g * 0.55));
        if (archetype.p3ShotFloor > 0) p3s = Math.max(p3s, archetype.p3ShotFloor);
        p3g = Math.min(p3g, p2g * 0.32, p1g * 0.18);

        const paceShotSlots = activePlayersFromPace(blockPaceMult, 'shots');
        const pacePointSlots = activePlayersFromPace(blockPaceMult, 'points');
        const paceGoalSlots = activePlayersFromPace(blockPaceMult, 'goals');
        const shotPaceMult3 = paceRankMultiplier({ rank: shotRankTeam, slots: paceShotSlots, market: 'shots', severity: 'base' });
        const shotPaceMult4 = paceRankMultiplier({ rank: shotRankTeam, slots: paceShotSlots, market: 'shots', severity: 'plus' });
        const shotPaceMult5 = paceRankMultiplier({ rank: shotRankTeam, slots: paceShotSlots, market: 'shots', severity: 'ceiling' });
        const pointPaceMult1 = paceRankMultiplier({ rank: pointRankTeam, slots: pacePointSlots, market: 'points', severity: 'base' });
        const pointPaceMult2 = paceRankMultiplier({ rank: pointRankTeam, slots: pacePointSlots, market: 'points', severity: 'plus' });
        const goalPaceMult1 = paceRankMultiplier({ rank: goalRankTeam, slots: paceGoalSlots, market: 'goals', severity: 'base' });
        const goalPaceMult2 = paceRankMultiplier({ rank: goalRankTeam, slots: paceGoalSlots, market: 'goals', severity: 'plus' });

        const shotPositionStage = positionBudgetStageMultiplier({ laneBudgetShare: shotLaneBudgetShare, laneShare: playerShotLaneShare, market: 'shots', posKey });
        const pointPositionStage = positionBudgetStageMultiplier({ laneBudgetShare: pointLaneBudgetShare, laneShare: playerPointLaneShare, market: 'points', posKey });
        const goalPositionStage = positionBudgetStageMultiplier({ laneBudgetShare: goalLaneBudgetShare, laneShare: playerGoalLaneShare, market: 'goals', posKey });

        const shotHistoryStage = lineHistoryStageMultiplier({ market: 'shots', roleRate: roleS4Rate ?? roleS3Rate, posRate: histS4Rate ?? histS3Rate, roleSample, venueSample: roleVenueSample, todayLine });
        const pointHistoryStage = lineHistoryStageMultiplier({ market: 'points', roleRate: roleP1Rate, posRate: histP1Rate, roleSample, venueSample: roleVenueSample, todayLine });
        const goalHistoryStage = lineHistoryStageMultiplier({ market: 'goals', roleRate: roleG1Rate, posRate: histG1Rate, roleSample, venueSample: roleVenueSample, todayLine });

        const shotCapabilityStage3 = capabilityStageMultiplier({ market: 'shots', baseProb: capabilityP3, primaryMarket: archetype.primaryMarket, posKey });
        const shotCapabilityStage4 = capabilityStageMultiplier({ market: 'shots', baseProb: capabilityP4, primaryMarket: archetype.primaryMarket, posKey });
        const shotCapabilityStage5 = capabilityStageMultiplier({ market: 'shots', baseProb: capabilityP5, primaryMarket: archetype.primaryMarket, posKey });
        const pointCapabilityStage1 = capabilityStageMultiplier({ market: 'points', baseProb: capabilityP1Point, primaryMarket: archetype.primaryMarket, posKey });
        const pointCapabilityStage2 = capabilityStageMultiplier({ market: 'points', baseProb: capabilityP2Point, primaryMarket: archetype.primaryMarket, posKey });
        const goalCapabilityStage1 = capabilityStageMultiplier({ market: 'goals', baseProb: capabilityP1Goal, primaryMarket: archetype.primaryMarket, posKey });
        const goalCapabilityStage2 = capabilityStageMultiplier({ market: 'goals', baseProb: capabilityP2Goal, primaryMarket: archetype.primaryMarket, posKey });

        const shotStageMult3 = clamp((shotPaceMult3 + shotPositionStage + shotHistoryStage + shotCapabilityStage3) / 4, 0.92, 1.16);
        const shotStageMult4 = clamp((shotPaceMult4 + shotPositionStage + shotHistoryStage + shotCapabilityStage4) / 4, 0.92, 1.18);
        const shotStageMult5 = clamp((shotPaceMult5 + shotPositionStage + shotHistoryStage + shotCapabilityStage5) / 4, 0.90, 1.20);
        const pointStageMult1 = clamp((pointPaceMult1 + pointPositionStage + pointHistoryStage + pointCapabilityStage1) / 4, 0.92, 1.18);
        const pointStageMult2 = clamp((pointPaceMult2 + pointPositionStage + pointHistoryStage + pointCapabilityStage2) / 4, 0.90, 1.16);
        const goalStageMult1 = clamp((goalPaceMult1 + goalPositionStage + goalHistoryStage + goalCapabilityStage1) / 4, 0.92, 1.16);
        const goalStageMult2 = clamp((goalPaceMult2 + goalPositionStage + goalHistoryStage + goalCapabilityStage2) / 4, 0.90, 1.14);

        p3s *= shotStageMult3;
        p4s *= shotStageMult4;
        p5s *= shotStageMult5;
        p1p *= pointStageMult1;
        p2p *= pointStageMult2;
        p1g *= goalStageMult1;
        p2g *= goalStageMult2;

        const topShotCandidate = shotRankTeam <= Math.max(2, Math.min(3, paceShotSlots - 1)) && shotRankPos <= 2;
        const topPointCandidate = pointRankTeam <= Math.max(2, Math.min(3, pacePointSlots)) && pointRankPos <= 2;
        const topGoalCandidate = goalRankTeam <= Math.max(2, opportunityContext?.maxGoalCandidates || 3) && goalRankPos <= 2;

        if (topShotCandidate && shotHistoryStage > 1.04) {
          p3s = Math.max(p3s, posKey === 'D' ? 0.40 : 0.56);
          p4s = Math.max(p4s, posKey === 'D' ? 0.18 : 0.34);
        }
        if (topPointCandidate && pointHistoryStage > 1.03) {
          p1p = Math.max(p1p, posKey === 'D' ? 0.36 : 0.52);
        }
        if (topGoalCandidate && goalHistoryStage > 1.03 && archetype.primaryMarket === 'goals') {
          p1g = Math.max(p1g, posKey === 'D' ? 0.10 : 0.22);
        }

        // repaired SOG ladder continuity: higher ladders continue from 3+ instead of resetting independently
        const cont4 = clamp(
          (archetype.primaryMarket === 'shots' ? 0.62 : archetype.primaryMarket === 'points' ? 0.48 : 0.34) *
          (shotHistoryStage > 1 ? 1.06 : 0.96) *
          (shotPaceMult4 > 1 ? 1.04 : 0.96),
          posKey === 'D' ? 0.18 : 0.24,
          posKey === 'D' ? 0.58 : 0.72
        );
        const cont5 = clamp(
          (archetype.primaryMarket === 'shots' ? 0.52 : archetype.primaryMarket === 'points' ? 0.36 : 0.24) *
          (shotHistoryStage > 1 ? 1.04 : 0.94) *
          (shotPaceMult5 > 1 ? 1.04 : 0.94),
          posKey === 'D' ? 0.08 : 0.12,
          posKey === 'D' ? 0.42 : 0.58
        );
        p4s = Math.max(p4s, Math.min(p3s * cont4, posKey === 'D' ? 0.62 : 0.80));
        p5s = Math.max(p5s, Math.min(p4s * cont5, posKey === 'D' ? 0.32 : 0.58));

        // tight-game control without flattening the whole slate
        if (paceTier === 'low' || (paceTier === 'neutral' && !opportunityContext?.distributedShotEnv)) {
          const shotTightMult = topShotCandidate ? 0.96 : 0.88;
          const pointTightMult = topPointCandidate ? 0.97 : 0.90;
          const goalTightMult = topGoalCandidate ? 0.97 : 0.90;
          p3s *= shotTightMult;
          p4s *= topShotCandidate ? 0.94 : 0.82;
          p5s *= topShotCandidate ? 0.90 : 0.72;
          p1p *= pointTightMult;
          p2p *= topPointCandidate ? 0.94 : 0.82;
          p1g *= goalTightMult;
          p2g *= topGoalCandidate ? 0.92 : 0.80;
        }

        p3g = Math.min(p3g, p2g * 0.32, p1g * 0.18);

        const edgeScoreBase = Math.round(
          (leakScore ?? 0) * 0.34 +
          Math.min(100, playerShotShare * 100 * 3.4) * 0.22 +
          Math.min(100, convBlend * 100) * 0.12 +
          Math.min(100, dangerRate * 100) * 0.12 +
          Math.min(100, (blockPaceMult - 0.9) / 0.22 * 100) * 0.10 +
          Math.min(100, (blockMult - 0.82) / 0.3 * 100) * 0.10
        );
        const edgeScore = Math.min(100, edgeScoreBase + (defenseRoleBoost.signalBoost || 0));
        const attackBoost = defenseRoleBoost.attackBoost || 0;

        const environmentScore = Math.round(
          (leakScore ?? 0) * 0.45 +
          Math.min(100, safeRatio(teamPos?.shots ?? 0, defenseAvg?.shots ?? 1, 1) * 55) * 0.2 +
          Math.min(100, safeRatio(teamPos?.iff ?? 0, defenseAvg?.iff ?? 1, 1) * 0.55 * 100) * 0.2 +
          Math.min(100, (blockPaceMult - 0.9) / 0.25 * 100) * 0.15
        );
        const environmentTier = environmentTierFromScore(environmentScore);

        const fourPlusGate = fourPlusShotGateContext({ skater, effectiveToi, iffAnchor, posKey, todayLine, teamPos, leakScore, environmentScore, histS4Rate, histS5Rate });

        const rwShotFilter = posKey === 'RW'
          ? rwShotFilterContext({
              skater,
              effectiveToi,
              todayLine,
              lineShare,
              histS3Rate,
              histS4Rate,
              histS5Rate,
              iffAnchor,
              goalLeakOverride,
            })
          : null;

        p4s *= fourPlusGate.p4Mult;
        p5s *= fourPlusGate.p5Mult;
        p4s = Math.min(p4s, fourPlusGate.maxP4);
        p5s = Math.min(p5s, fourPlusGate.maxP5);

        if (rwShotFilter) {
          p3s *= rwShotFilter.p3Mult;
          p4s *= rwShotFilter.p4Mult;
          p5s *= rwShotFilter.p5Mult;
          p3s = Math.min(p3s, rwShotFilter.maxP3);
          p4s = Math.min(p4s, Math.min(rwShotFilter.maxP4, fourPlusGate.maxP4));
          p5s = Math.min(p5s, Math.min(rwShotFilter.maxP5, fourPlusGate.maxP5));
          if (rwShotFilter.p3Floor > 0) {
            p3s = Math.max(p3s, rwShotFilter.p3Floor);
          }
        }
        if (defenseRoleBoost.p3Floor > 0) {
          p3s = Math.max(p3s, defenseRoleBoost.p3Floor);
        }
        if (defenseRoleBoost.p4Floor > 0) {
          p4s = Math.max(p4s, defenseRoleBoost.p4Floor);
        }

        if (!isShotDriver && archetype.primaryMarket !== 'goals') {
          p4s *= 0.74;
          p5s *= 0.48;
        }
        if (!isEliteShotDriver && archetype.primaryMarket !== 'goals') {
          p5s *= 0.72;
        }
        if (isSecondaryShooter && archetype.primaryMarket !== 'goals') {
          p4s *= 0.82;
          p5s *= 0.62;
        }

        const ceilingEngine = buildCeilingEngine({
          paceTier,
          paceShots,
          archetype,
          posKey,
          todayLine,
          effectiveToi,
          expectedShotsBudget,
          playerShotShare,
          iffBlend,
          shotBlend: shotFloor.shotBlend,
          iscfBlend: shotFloor.iscfBlend,
          teamPos: rawTeamPosStats,
          opportunityContext,
        });
        p3s *= ceilingEngine.p3Boost;
        p4s *= ceilingEngine.p4Boost;
        p5s *= ceilingEngine.p5Boost;
        if (ceilingEngine.p4Floor > 0) p4s = Math.max(p4s, ceilingEngine.p4Floor);
        if (ceilingEngine.p5Floor > 0) p5s = Math.max(p5s, ceilingEngine.p5Floor);

        p4s = Math.max(p4s, shotGate.floor4, shotExplosion.floor4);
        p5s = Math.max(p5s, shotGate.floor5, shotExplosion.floor5);
        const normalizedShotLadder = applyShotLadderHierarchy({
          p3: p3s,
          p4: p4s,
          p5: p5s,
          posKey,
          shotFloorLevel: shotFloor.level,
          fourPlusGate,
          defenseRoleBoost,
          ceilingEngine,
          archetype,
          isShotDriver,
          isEliteShotDriver,
          isSecondaryShooter,
        });
        p3s = normalizedShotLadder.p3;
        p4s = normalizedShotLadder.p4;
        p5s = normalizedShotLadder.p5;

        const dHighEventEnv =
          posKey === 'D' && (
            environmentScore >= 68 ||
            (blockPaceMult >= 1.04 && (oppAll?.shotsAllowed || 0) >= 29.5) ||
            ((teamPos?.shots || 0) >= 8.0 && (teamPos?.icf || 0) >= 19.5) ||
            ((histS4Rate || 0) >= 0.16) ||
            ((histS5Rate || 0) >= 0.05)
          );
        if (posKey === 'D' && fourPlusGate.dPath2_4 && dHighEventEnv) {
          p4s = Math.max(p4s, Math.min(0.30, p4s * 1.65 + 0.035));
        }
        if (posKey === 'D' && fourPlusGate.dPath2_5 && dHighEventEnv) {
          p5s = Math.max(p5s, Math.min(0.09, p5s * 2.4 + 0.018));
        }

        const leakTier = leakTierFromScore(leakScore);
        const shotTier = shotTierFromLeak(leakScore);
        const goalTier = goalTierFromProb(p1g, p2g);

        const dPointBoost =
          posKey === 'D' &&
          effectiveToi >= 22.0 &&
          todayLine <= 2 &&
          (
            environmentScore >= 58 ||
            dHighEventEnv ||
            (oppAll?.shotsAllowed || 0) >= 29.5 ||
            (teamPos?.shots || 0) >= 7.6 ||
            ((histVenue?._venue?.p1Rate ?? 0) >= 0.24) ||
            ((histVenue?._venue?.p2Rate ?? 0) >= 0.07)
          );
        if (dPointBoost) {
          p1p = Math.min(0.52, Math.max(p1p, Math.min(0.48, p1p * 1.14 + 0.035)));
          p2p = Math.min(0.18, Math.max(p2p, Math.min(0.15, p2p * 1.28 + 0.022)));
          lambdaPDisplay = Math.max(0.001, -Math.log(Math.max(0.001, 1 - Math.min(0.98, p1p))));
        }
        const dGoalBoost =
          posKey === 'D' &&
          effectiveToi >= 22.0 &&
          todayLine <= 2 &&
          (((skater.iscfSeason || 0) >= 1.0) || ((skater.goalsSeason || 0) >= 0.10)) &&
          (
            dHighEventEnv ||
            (goalLeakOverride?.flag) ||
            ((teamPos?.goals || 0) >= 0.60) ||
            ((histG1Rate || 0) >= 0.08)
          );
        if (dGoalBoost) {
          p1g = Math.min(0.22, Math.max(p1g, Math.min(0.20, p1g * 1.16 + 0.014)));
          p2g = Math.min(0.045, Math.max(p2g, Math.min(0.04, p2g * 1.18 + 0.004)));
        }

        if (posKey === 'D') {
          const dBaseline = defensemanBaselineProbabilities({
            histVenue,
            histPos,
            teamPos,
            defenseAvg,
            effectiveToi,
            todayLine,
            skater,
            environmentScore,
          });
          p3s = blendDefensemanProbability(p3s, dBaseline.s3, dBaseline.confidence);
          p4s = blendDefensemanProbability(p4s, dBaseline.s4, dBaseline.confidence);
          p5s = blendDefensemanProbability(p5s, dBaseline.s5, dBaseline.confidence);
          p1p = blendDefensemanProbability(p1p, dBaseline.p1, dBaseline.confidence);
          p2p = blendDefensemanProbability(p2p, dBaseline.p2, dBaseline.confidence);
          p1g = blendDefensemanProbability(p1g, dBaseline.g1, dBaseline.confidence);
          p2g = blendDefensemanProbability(p2g, dBaseline.g2, dBaseline.confidence);
          p3g = Math.min(Math.max(p3g, p2g * 0.18), p2g * 0.35);
          lambdaPDisplay = Math.max(0.001, -Math.log(Math.max(0.001, 1 - Math.min(0.98, p1p))));
        }

        if (hotRole.active) {
          p3s *= hotRole.shotsMult;
          p4s *= hotRole.shotsMult;
          p5s *= hotRole.shotsMult;
          p1p *= hotRole.pointsMult;
          p2p *= Math.max(1, hotRole.pointsMult - 0.02);
          p1g *= hotRole.goalsMult;
          p2g *= Math.max(1, hotRole.goalsMult - 0.04);
          if (hotRole.p3Floor > 0) p3s = Math.max(p3s, hotRole.p3Floor);
          if (hotRole.p4Floor > 0) p4s = Math.max(p4s, hotRole.p4Floor);
          if (hotRole.p1GoalFloor > 0) p1g = Math.max(p1g, hotRole.p1GoalFloor);
          p4s = Math.min(p4s, Math.max(archetype.p4Cap, hotRole.extreme ? 0.80 : hotRole.strong ? 0.70 : 0.62));
          p5s = Math.min(p5s, Math.max(archetype.p5Cap, hotRole.extreme ? 0.60 : hotRole.strong ? 0.44 : 0.32));
          lambdaPDisplay = Math.max(0.001, -Math.log(Math.max(0.001, 1 - Math.min(0.98, p1p))));
        }

        const aboveTOIFloor = playerToi === 0 || playerToi >= 14;
        const gateThresh = Math.max(4, Math.round(totalTeams * 0.6));
        const gateOpen =
          (defRank <= gateThresh || effectiveToi >= 21 || edgeScore >= 68) &&
          aboveTOIFloor;

        const rationaleBits = [];
        if (defenseRoleBoost?.tag) rationaleBits.push(defenseRoleBoost.tag);
        if (hotRole?.label) rationaleBits.push(hotRole.label);
        if (defenseRoleBoost?.resolvedSummary) rationaleBits.push(defenseRoleBoost.resolvedSummary);
        else if (teamRoleProfiles?.[oppTK]?.summary) rationaleBits.push(teamRoleProfiles[oppTK].summary);
        if (defenseRoleBoost?.shotLabel && posKey !== "D") rationaleBits.push(defenseRoleBoost.shotLabel);
        if (defenseRoleBoost?.goalLabel) rationaleBits.push(defenseRoleBoost.goalLabel);
        if (lineFit === "aligned") rationaleBits.push(`Historical role fit: ${currentRole}`);
        else if (lineFit === "mismatch") rationaleBits.push(`Historical mismatch for ${currentRole}`);
        if (venueForm?.n) rationaleBits.push(`${isHome ? "Home" : "Away"} form ${venueTrendImpact.label}: ${venueTrendImpact.reason}`);
        const featureSummary = buildFeatureNarrative({
          leakScore,
          shotConv: convBlend,
          dangerRate,
          paceMult: blockPaceMult,
          blockMult,
          volatilityPenalty,
        });

        // Final hard clamp after all overlays so rendered probabilities can never exceed 100%
        p3s = clamp(Number.isFinite(Number(p3s)) ? Number(p3s) : 0, 0, 0.999);
        p4s = clamp(Number.isFinite(Number(p4s)) ? Number(p4s) : 0, 0, 0.999);
        p5s = clamp(Number.isFinite(Number(p5s)) ? Number(p5s) : 0, 0, 0.999);
        p1p = clamp(Number.isFinite(Number(p1p)) ? Number(p1p) : 0, 0, 0.999);
        p2p = clamp(Number.isFinite(Number(p2p)) ? Number(p2p) : 0, 0, 0.999);
        p1g = clamp(Number.isFinite(Number(p1g)) ? Number(p1g) : 0, 0, 0.999);
        p2g = clamp(Number.isFinite(Number(p2g)) ? Number(p2g) : 0, 0, 0.999);
        p3g = clamp(Number.isFinite(Number(p3g)) ? Number(p3g) : 0, 0, 0.999);

        results.push({
          name: skater.name,
          team: block.team,
          pos: posKey,
          isHome,
          venue: isHome ? "H" : "A",
          venueLabel: isHome ? "HOME" : "AWAY",
          venueBaseSource: pHA ? (isHome ? "home split" : "away split") : "season fallback",
          capabilityStyle: capabilityBase.style,
          paceTier,
          archetypePrimaryMarket: archetype.primaryMarket,
          ceilingTier: ceilingEngine.ceilingTier,
          capabilityBaseShots: capabilityBase.baseShots,
          capabilityBasePoints: capabilityBase.basePoints,
          capabilityBaseGoals: capabilityBase.baseGoals,
          normalizedName: normalizeName(skater.name),
          venueHistorySource: histVenue ? (isHome ? "home sample" : "away sample") : "all-venue fallback",
          lineupFilterApplied: !!lineupData,
          game: game.label,
          opponent: oppDef?.team || "",
          defRank,
          leakScore,
          signalScore: edgeScore,
          environmentScore,
          environmentTier,
          leakTier,
          shotTier,
          goalTier,
          gateOpen,
          todayLine,
          impliedLine,
          lineBoost: +lineBoost.toFixed(3),
          iffSeason: +iffAnchor.toFixed(2),
          iffL5: +iffL5Raw.toFixed(2),
          iffBlend: +iffBlend.toFixed(2),
          shotDriverIff: +shotDriverIff.toFixed(2),
          shotDriverFlag: isShotDriver,
          eliteShotDriverFlag: isEliteShotDriver,
          secondaryShooterFlag: isSecondaryShooter,
          shotConv: +convBlend.toFixed(3),
          dangerRate: +dangerRate.toFixed(3),
          lineShare: +lineShare.toFixed(3),
          dynamicLineShare: +dynamicLineShare.toFixed(3),
          hotRoleActive: !!hotRole.active,
          hotRoleStrong: !!hotRole.strong,
          hotRoleExtreme: !!hotRole.extreme,
          hotRoleLabel: hotRole.label || '',
          hotRolePrimaryMarket: hotRole.primaryMarket || '',
          shotSharePct: +(playerShotShare * 100).toFixed(1),
          goalSharePct: +(playerGoalShare * 100).toFixed(1),
          pointSharePct: +(playerPointShare * 100).toFixed(1),
          shotLaneBudgetPct: +(shotLaneBudgetShare * 100).toFixed(1),
          goalLaneBudgetPct: +(goalLaneBudgetShare * 100).toFixed(1),
          pointLaneBudgetPct: +(pointLaneBudgetShare * 100).toFixed(1),
          shotLaneSharePct: +(playerShotLaneShare * 100).toFixed(1),
          goalLaneSharePct: +(playerGoalLaneShare * 100).toFixed(1),
          pointLaneSharePct: +(playerPointLaneShare * 100).toFixed(1),
          shotRankTeam,
          shotRankPos,
          goalRankTeam,
          goalRankPos,
          pointRankTeam,
          pointRankPos,
          expectedShotsBudget: +expectedShotsBudget.toFixed(2),
          positionShotPool: +positionShotPool.toFixed(2),
          lineAllocatedShots: +lineAllocatedShots.toFixed(2),
          playerConvertedShots: +playerConvertedShots.toFixed(2),
          expectedGoalsBudget: +expectedGoalsBudget.toFixed(3),
          expectedPointsBudget: +expectedPointsBudget.toFixed(3),
          teamExpectedShots: +opportunityContext.teamExpectedShots.toFixed(1),
          teamExpectedGoals: +opportunityContext.teamExpectedGoals.toFixed(2),
          teamExpectedPoints: +opportunityContext.teamExpectedPoints.toFixed(2),
          shotDistributionIndex: +opportunityContext.shotDistributionIndex.toFixed(3),
          goalDistributionIndex: +opportunityContext.goalDistributionIndex.toFixed(3),
          distributedShotEnv: !!opportunityContext.distributedShotEnv,
          broadGoalEnv: !!opportunityContext.broadGoalEnv,
          paceMult: +blockPaceMult.toFixed(3),
          uploadedTeamPace: teamUploadedPace != null ? +teamUploadedPace.toFixed(2) : null,
          uploadedOppPace: oppUploadedPace != null ? +oppUploadedPace.toFixed(2) : null,
          paceSource: uploadedPaceMult != null ? "uploaded" : "proxy",
          blockMult: +blockMult.toFixed(3),
          volatilityPenalty: +volatilityPenalty.toFixed(3),
          shotsL5: +(skater.shotsL5 ?? 0),
          goalsL5: +(skater.goalsL5 ?? 0),
          astL5: +(skater.astL5 ?? 0),
          playerToi: +playerToi.toFixed(1),
          effectiveToi: +effectiveToi.toFixed(1),
          baseLambdaS: +baseLambdaS.toFixed(2),
          lambdaS: +lineBoostedS.toFixed(2),
          lambdaP: +lambdaPDisplay.toFixed(3),
          lambdaG: +lambdaGDisplay.toFixed(3),
          goalOpportunityLambda: goalProbModel.opportunityLambda,
          goalOpportunityProb: goalProbModel.opportunityProb,
          goalExpectedBudgetProb: goalProbModel.expectedGoalProb,
          goalPointGate: goalProbModel.pointGate,
          goalPlayerTier: scorerTier.tier,
          goalPlayerScore: scorerTier.score,
          goalPlayerBase: +playerGoalBase.toFixed(3),
          goalFormMult: +l5GoalFormMult.toFixed(3),
          goalDefMult: +defenseGoalMult.toFixed(3),
          goalRoleMult: +roleGoalMult.toFixed(3),
          defMult: +defMult.toFixed(3),
          shotFloorLevel: shotFloor.level,
          goalFloorLevel: goalFloor.level,
          oppShotsAllowed: teamPos?.shots ?? null,
          oppIcfAllowed: teamPos?.icf ?? null,
          oppIffAllowed: teamPos?.iff ?? null,
          oppIscfAllowed: teamPos?.iscf ?? null,
          playerIscf: skater.iscfSeason ?? null,
          rankShots: defenseRanks?.shotsRank ?? null,
          rankIcf: defenseRanks?.icfRank ?? null,
          rankIff: defenseRanks?.iffRank ?? null,
          rankIscf: defenseRanks?.iscfRank ?? null,
          featureSummary,
          selectionRationale: rationaleBits.join(" · "),
          histS3Rate: histS3Rate != null ? +histS3Rate.toFixed(3) : null,
          histS4Rate: histS4Rate != null ? +histS4Rate.toFixed(3) : null,
          histS5Rate: histS5Rate != null ? +histS5Rate.toFixed(3) : null,
          histP1Rate: histP1Rate != null ? +histP1Rate.toFixed(3) : null,
          histP2Rate: histP2Rate != null ? +histP2Rate.toFixed(3) : null,
          histG1Rate: histG1Rate != null ? +histG1Rate.toFixed(3) : null,
          histG2Rate: histG2Rate != null ? +histG2Rate.toFixed(3) : null,
          histSample,
          histVenueKey: isHome ? "home" : "away",
          cheatShotsMult: +cheatShotsMult.toFixed(3),
          cheatPointsMult: +cheatPointsMult.toFixed(3),
          cheatGoalsMult: +cheatGoalsMult.toFixed(3),
          histShotsMult: +histShotsMult.toFixed(3),
          histPointsMult: +histPointsMult.toFixed(3),
          histGoalsMult: +histGoalsMult.toFixed(3),
          currentRole,
          lineFit,
          roleS3Rate: roleS3Rate != null ? +roleS3Rate.toFixed(3) : null,
          roleS4Rate: roleS4Rate != null ? +roleS4Rate.toFixed(3) : null,
          roleS5Rate: roleS5Rate != null ? +roleS5Rate.toFixed(3) : null,
          roleP1Rate: roleP1Rate != null ? +roleP1Rate.toFixed(3) : null,
          roleP2Rate: roleP2Rate != null ? +roleP2Rate.toFixed(3) : null,
          roleG1Rate: roleG1Rate != null ? +roleG1Rate.toFixed(3) : null,
          roleG2Rate: roleG2Rate != null ? +roleG2Rate.toFixed(3) : null,
          roleSample,
          roleVenueSample,
          venueFormTag: venueTrendImpact.label,
          venueFormReason: venueTrendImpact.reason,
          venueS3Rate: venueForm?.s3 != null ? +venueForm.s3.toFixed(3) : null,
          oppAvgShots: oppLast7Venue?.avgS != null ? +oppLast7Venue.avgS.toFixed(2) : null,
          oppAvgGoals: oppLast7Venue?.avgG != null ? +oppLast7Venue.avgG.toFixed(3) : null,
          oppAvgVenueSample: oppLast7Venue?.n || 0,
          venueS4Rate: venueForm?.s4 != null ? +venueForm.s4.toFixed(3) : null,
          venueS5Rate: venueForm?.s5 != null ? +venueForm.s5.toFixed(3) : null,
          venueP1Rate: venueForm?.p1 != null ? +venueForm.p1.toFixed(3) : null,
          venueG1Rate: venueForm?.g1 != null ? +venueForm.g1.toFixed(3) : null,
          venueFormSample: venueForm?.n || 0,
          venueShotMult: +venueTrendImpact.shotMult.toFixed(3),
          venuePointMult: +venueTrendImpact.pointMult.toFixed(3),
          venueGoalMult: +venueTrendImpact.goalMult.toFixed(3),
          paceShotSlots,
          pacePointSlots,
          paceGoalSlots,
          shotPaceStage3: +shotPaceMult3.toFixed(3),
          shotPaceStage4: +shotPaceMult4.toFixed(3),
          shotPaceStage5: +shotPaceMult5.toFixed(3),
          pointPaceStage1: +pointPaceMult1.toFixed(3),
          pointPaceStage2: +pointPaceMult2.toFixed(3),
          goalPaceStage1: +goalPaceMult1.toFixed(3),
          goalPaceStage2: +goalPaceMult2.toFixed(3),
          shotPositionStage: +shotPositionStage.toFixed(3),
          pointPositionStage: +pointPositionStage.toFixed(3),
          goalPositionStage: +goalPositionStage.toFixed(3),
          shotHistoryStage: +shotHistoryStage.toFixed(3),
          pointHistoryStage: +pointHistoryStage.toFixed(3),
          goalHistoryStage: +goalHistoryStage.toFixed(3),
          shotCapabilityStage3: +shotCapabilityStage3.toFixed(3),
          shotCapabilityStage4: +shotCapabilityStage4.toFixed(3),
          shotCapabilityStage5: +shotCapabilityStage5.toFixed(3),
          pointCapabilityStage1: +pointCapabilityStage1.toFixed(3),
          pointCapabilityStage2: +pointCapabilityStage2.toFixed(3),
          goalCapabilityStage1: +goalCapabilityStage1.toFixed(3),
          goalCapabilityStage2: +goalCapabilityStage2.toFixed(3),
          defenseRoleSummary: defenseRoleBoost?.resolvedSummary || [defenseRoleBoost?.shotLabel, defenseRoleBoost?.pointLabel, defenseRoleBoost?.goalLabel].filter(Boolean).join(' · ') || teamRoleProfiles?.[oppTK]?.summary || "",
          defenseRoleLabels: teamRoleProfiles?.[oppTK]?.labels || [],
          defenseRoleShotLabel: defenseRoleBoost?.shotLabel || null,
          defenseRoleGoalLabel: defenseRoleBoost?.goalLabel || null,
          defenseRolePointLabel: defenseRoleBoost?.pointLabel || null,
          defenseRoleMarketTag: defenseRoleBoost?.tag || null,
          defenseRoleSignalBoost: defenseRoleBoost?.signalBoost || 0,
          defenseRoleAttackBoost: defenseRoleBoost?.attackBoost || 0,
          defenseRolePrimaryMarket: defenseRoleBoost?.primaryMarket || null,
          goalLeakOverride: goalLeakOverride?.flag ? goalLeakOverride.reason : null,
          fourPlusGateTier: fourPlusGate?.tier || null,
          fourPlusGateReason: fourPlusGate?.reason || null,
          dShotPath2: !!fourPlusGate?.dPath2_4,
          dPointBoost: !!dPointBoost,
          rwShotFilterReason: rwShotFilter?.reason || null,
          rwPrimaryMarket: rwShotFilter?.primaryMarket || null,
          rwEliteVolumeForShots: !!rwShotFilter?.eliteVolume,
          hist: {
            s3: histPos?.s3 ? { ...histPos.s3, adj: aS3 } : null,
            s4: histPos?.s4 ? { ...histPos.s4, adj: aS4 } : null,
            s5: histPos?.s5 ? { ...histPos.s5, adj: aS5 } : null,
            g1: histPos?.g1 ? { ...histPos.g1, adj: aG1 } : null,
            g2: histPos?.g2 ? { ...histPos.g2, adj: aG2 } : null,
            _home: histPos?._home || null,
            _away: histPos?._away || null,
          },
          p3s: +p3s.toFixed(4),
          p4s: +p4s.toFixed(4),
          p5s: +p5s.toFixed(4),
          p1p: +p1p.toFixed(4),
          p2p: +p2p.toFixed(4),
          p1g: +p1g.toFixed(4),
          p2g: +p2g.toFixed(4),
          p3g: +p3g.toFixed(4),
          attackScore: Math.min(99, Math.round((
            0.16 * p3s +
            0.24 * p4s +
            0.12 * p5s +
            0.24 * p1p +
            0.12 * p2p +
            0.09 * p1g +
            0.025 * p2g +
            0.005 * p3g
          ) * 100 + attackBoost + Math.min(6, Math.max(0,
            (effectiveToi >= 16 ? 2 : effectiveToi >= 14 ? 1 : 0) +
            ((dangerRate >= 0.42 || (skater.iscfSeason || 0) >= 1.5) ? 2 : (dangerRate >= 0.34 ? 1 : 0)) +
            ((defenseRoleBoost.boostScale || 0) >= 0.78 ? 2 : (defenseRoleBoost.boostScale || 0) >= 0.56 ? 1 : 0)
          )))),
        });
      }
    }
  }

  const sorted = results.sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0));
  sorted._teamRoleProfiles = teamRoleProfiles || {};
  sorted._recentForm = recentFormMap || {};
  return sorted;
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
        <span style={{ fontSize: "21px", fontWeight: 700, color: "#636977", fontFamily: "'Outfit Variable','Outfit',sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Tonight's Player</span>
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
  const [activeGame, setActiveGame] = useState(null);
  const tableScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);

  const showTip = useCallback((hist, x, y) => setTooltip({ hist, x, y }), []);
  const hideTip = useCallback(() => setTooltip(null), []);

  const gameOptions = useMemo(
    () => ["ALL", ...new Set(data.map((d) => d.game))],
    [data]
  );

  const games = useMemo(() => [...new Set(data.map((d) => d.game))], [data]);

  const selectedMatchup = useMemo(() => {
    const selectedGameLabel = viewMode === "bygame" ? activeGame : gameF !== "ALL" ? gameF : null;
    if (!selectedGameLabel) return null;
    return matchups.find((m) => m.label === selectedGameLabel) || null;
  }, [viewMode, activeGame, gameF, matchups]);

  useEffect(() => {
    if (viewMode === "bygame" && !activeGame && games.length > 0) {
      setActiveGame(games[0]);
    }
  }, [viewMode, activeGame, games]);

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

  const Th = ({ col, label, title, width }) => (
    <th
      onClick={() => toggle(col)}
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

                <Th col="team" label="Team" width="90px" />
                <Th col="pos" label="Pos" width="56px" />
                <Th col="venue" label="H/A" width="64px" />
                <Th col="opponent" label="Opp" width="110px" />
                <Th
                  col="defRank"
                  label="Def Rnk"
                  width="86px"
                  title="Composite rank using Shots, ICF, IFF, ISCF"
                />
                <Th
                  col="attackScore"
                  label="Play Score"
                  width="120px"
                  title="Decision score that blends probability, role, confidence, and best-bet strength"
                />
                <Th
                  col="attackBadgeRank"
                  label="Play Tier"
                  width="100px"
                  title="Readable tier for the overall play score"
                />
                <Th col="oppAvgShots" label="Opp Avg Shots" width="94px" title="Average shots allowed by tonight's opponent over the last 7 venue-matched historical games for this player's current role." />
                <Th col="oppAvgGoals" label="Opp Avg Goals" width="94px" title="Average goals allowed by tonight's opponent over the last 7 venue-matched historical games for this player's current role." />
                <Th col="p3s" label="3+" width="74px" />
                <Th col="p4s" label="4+" width="74px" />
                <Th col="p5s" label="5+" width="74px" />
                <Th col="p1p" label="1P" width="74px" />
                <Th col="p2p" label="2P" width="74px" />
                <Th col="p1g" label="1G" width="74px" />
                <Th col="p2g" label="2G" width="74px" />
                <Th col="p3g" label="3G" width="74px" />
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
                      <ProbCell p={r.p1g} hist={r.hist.g1} highlight={sortCol === "p1g"} onHover={showTip} onLeave={hideTip} prop="p1g" fire={r.p1p >= 0.50 && (r.playerIscf ?? 0) >= 2.0 && (r.effectiveToi ?? r.playerToi) >= 16} />
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

  const Card = ({ title, accent, rows, market }) => (
    <div style={{ background: "#ffffff", border: "1px solid #e9e8f3", borderRadius: "16px", padding: "16px" }}>
      <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "28px", fontWeight: 800, color: accent, marginBottom: "10px" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rows.map((r, idx) => {
          const prob = market === "shots" ? Math.max(r.p4s || 0, r.p3s || 0) : (r.p1g || 0);
          return (
            <div key={`${market}-${r.name}-${idx}`} style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                <div style={{ fontSize: "19px", fontWeight: 800, color: "#05011c" }}>{idx + 1}. {r.name} <span style={{ color: "#636977", fontWeight: 600 }}>{r.venue}</span></div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: accent }}>{market === "shots" ? `${Math.round((r.p4s || 0) * 100)}% 4+` : `${Math.round((r.p1g || 0) * 100)}% 1G`}</div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "6px" }}>
                <span style={{ padding: "4px 8px", borderRadius: "999px", background: getPlayScoreLabel(r.attackScore).bg, color: getPlayScoreLabel(r.attackScore).fg, fontSize: "16px", fontWeight: 800, fontFamily: "'Outfit Variable','Outfit',sans-serif" }}>
                  Play Score {r.attackScore ?? "—"} · {getPlayScoreLabel(r.attackScore).label}
                </span>
                <span style={{ color: "#636977", fontSize: "17px" }}>{r.bestBetLabel || getPrimaryCall(r).replace("Best call: ", "")}</span>
                <span style={{ color: "#636977", fontSize: "17px" }}>{getLikelyLabel(prob)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px", marginBottom: "18px" }}>
      <Card title="Top 5 Shots Plays" accent="#166534" rows={shots} market="shots" />
      <Card title="Top 5 Goal Plays" accent="#b45309" rows={goals} market="goals" />
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
            Slate-aware and lineup-aware. Uses today's lineup role as the source of truth.
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
        ⚠ Model probabilities only. Always verify lines at your sportsbook. Past performance doesn't guarantee future results.
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

  const Table = ({ headers, rows }) => (
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
              <Table headers={["Metric", "Strong", "Neutral", "Fade"]} rows={defenseRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#0f766e", marginBottom: "8px" }}>Pace tier logic</div>
              <Table headers={["Market", "Fast", "Positive", "Slow"]} rows={paceRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#7c3aed", marginBottom: "8px" }}>Capability styles</div>
              <Table headers={["Style", "Primary market", "Engine effect", "Read"]} rows={styleRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>Shot gate logic</div>
              <Table headers={["Path", "Trigger", "What it means"]} rows={shotGateRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>Player floor profiles</div>
              <Table headers={["Profile", "Elite", "Good", "Average", "Weak"]} rows={floorRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#15803d", marginBottom: "8px" }}>4+ / 5+ shot gate</div>
              <Table headers={["Path", "Threshold", "Use"]} rows={fourPlusRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#2563eb", marginBottom: "8px" }}>Hot-role override</div>
              <Table headers={["Signal", "Rule", "Effect"]} rows={hotRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#b45309", marginBottom: "8px" }}>Goal engine</div>
              <Table headers={["Component", "Logic", "Why it matters"]} rows={goalRows} />
            </div>

            <div style={{ background: "#f8fafb", border: "1px solid #e9e8f3", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontFamily: "'Outfit Variable','Outfit',sans-serif", fontSize: "24px", fontWeight: 800, color: "#2563eb", marginBottom: "8px" }}>History priority</div>
              <Table headers={["Layer", "Primary read", "Secondary read", "Note"]} rows={historyRows} />
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
  { key: "pace", title: "Pace Stats", sub: "NHL Pace Stats.xlsx", accent: "#0284c7" },
  { key: "rankings", title: "Defense Rankings", sub: "NHL-Defense-Rankings-2026.xlsx", accent: "#7c3aed" },
  { key: "boxScores", title: "Box Scores", sub: "Box Scores *.xlsx · unlocks Audit View", accent: "#dc2626" },
];

function teamAbbr(name) {
  return TEAM_LOGO_ABBR[normTeam(name || "")] || null;
}

function splitGameLabel(label) {
  const m = String(label || "").split(/\s+(?:@|vs\.?|v\.?|at|-|–)\s+/i);
  return m.length === 2 ? m : [null, null];
}

// Compact, JSON-safe description of a run for Run History.
export function summarizeRun(files, results, games) {
  const rows = Array.isArray(results) ? results : [];
  const dateFrom = (f) => (f?.name || "").match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/);
  const m = dateFrom(files.season) || dateFrom(files.l5);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const slateDate = m ? `${m[1]}-${m[2]}-${m[3]}` : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const gameList = (games || []).map((g) => {
    const [a, b] = splitGameLabel(g.label);
    const away = g.away ?? g.awayTeam ?? a;
    const home = g.home ?? g.homeTeam ?? b;
    return { label: g.label || "", away: teamAbbr(away) || away || "", home: teamAbbr(home) || home || "" };
  });
  const shots = rows
    .filter((r) => r && r.gateOpen && Number.isFinite(r.p4s))
    .sort((a, b) => b.p4s - a.p4s)
    .slice(0, 3)
    .map((r) => ({ name: r.name, team: r.team || "", market: "4+ SOG", prob: r.p4s }));
  const goals = rows
    .filter((r) => r && Number.isFinite(r.p1g))
    .sort((a, b) => b.p1g - a.p1g)
    .slice(0, 3)
    .map((r) => ({ name: r.name, team: r.team || "", market: "1+ G", prob: r.p1g }));
  return {
    label: gameList.map((g) => g.label).join(" · ").slice(0, 120),
    slateDate,
    games: gameList,
    playerCount: rows.length,
    topPicks: [...shots, ...goals],
  };
}

function readBinaryString(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = (e) => res(e.target.result);
    fr.onerror = (e) => rej(new Error(`FileReader error reading ${file.name}: ${e.target?.error?.message || "unknown"}`));
    fr.readAsBinaryString(file);
  });
}

function UploadCard({ slot, file, onFile, disabled }) {
  const [over, setOver] = useState(false);
  const inputId = `nhlx-upload-${slot.key}`;
  return (
    <label
      htmlFor={inputId}
      className={`nhlx-upload${file ? " is-filled" : ""}${over ? " is-over" : ""}`}
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
      <span className="nhlx-upload-tag">{slot.required ? "Required" : "Optional"}</span>
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

export default function NhlModel({ loadRequest = null, onRunComplete, onFileAdded, onFilesChange, statusSlot = null }) {
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
  const filesRef = useRef(files);
  filesRef.current = files;
  const resultsRef = useRef(results);
  resultsRef.current = results;

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
      setGameLabels(games.map((g) => g.label));
      setHasHist(!!(histProfiles && (histProfiles.profiles || histProfiles)));
      setHasPace(!!paceData);
      onRunComplete?.({ files: fs, results: projected, summary: summarizeRun(fs, projected, games), runId: override?.runId || null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setError(`Error: ${msg || "Unknown error — check console"}`);
      console.error("Run error:", e);
    } finally {
      setLoading(false);
    }
  }, [onRunComplete]);

  // Replay a saved slate from Run History.
  useEffect(() => {
    if (!loadRequest?.files) return;
    const fs = loadRequest.files;
    setFiles(fs);
    onFilesChange?.(fs);
    setRankingsData(null);
    setActualResults({});
    setActiveView("dashboard");
    if (fs.rankings) parseSideFile("rankings", fs.rankings);
    if (fs.boxScores) parseSideFile("boxScores", fs.boxScores);
    run({ files: fs, runId: loadRequest.runId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRequest]);

  const canRun = !!(files.season && files.l5);
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

      <div className="nhlx-upload-grid">
        {NHL_UPLOAD_SLOTS.map((slot) => (
          <UploadCard key={slot.key} slot={slot} file={files[slot.key]} onFile={onFile} disabled={loading} />
        ))}
      </div>

      {error && <div className="nhlx-alert" role="alert">⚠ {error}</div>}

      <div className="nhlx-run-row">
        <button type="button" className="nhlx-btn nhlx-btn-run" onClick={() => run()} disabled={loading || !canRun}>
          {loading ? "Computing…" : "Run Prop Model"}
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
