// NHL Prop Probability Model — the pure pipeline, split out of NhlModel.jsx so the
// server's automatic run (lib/nhl-data/autorun.js) can execute the same code the
// Model tab runs in the browser. Nothing here touches React or the DOM.
//
// Ported from Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx. Model logic is
// unchanged: when the local app changes, port the functions here (and the UI
// pieces in NhlModel.jsx). Everything below is exported at the bottom.
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

/**
 * The model's "on fire" flame on a result row: a 1+ point probability of at least 50%,
 * 2.0+ individual scoring chances per game this season, and 16+ minutes of (effective) ice time.
 */
const ON_FIRE = { p1p: 0.5, iscf: 2.0, toi: 16 };
function isOnFire(r) {
  if (!r) return false;
  return (r.p1p ?? 0) >= ON_FIRE.p1p && (r.playerIscf ?? 0) >= ON_FIRE.iscf && (r.effectiveToi ?? r.playerToi ?? 0) >= ON_FIRE.toi;
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
          // PropFinder's season per-game rates as the run saw them (the scorecard's baselines).
          shotsSeason: +(skater.shotsSeason ?? 0),
          goalsSeason: +(skater.goalsSeason ?? 0),
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

// Team key (normTeam) → NHL abbreviation, for run summaries and logos.
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

function teamAbbr(name) {
  return TEAM_LOGO_ABBR[normTeam(name || "")] || null;
}

/** "Penguins @ Flyers" → ["Penguins", "Flyers"]; anything else → [null, null]. */
function splitGameLabel(label) {
  const m = String(label || "").split(/\s+(?:@|vs\.?|v\.?|at|-|–)\s+/i);
  return m.length === 2 ? m : [null, null];
}

// The market the model would call for a row: the highest probability after the
// role overlays (RW goal-first, hot role, defense-role market). Shared by the
// Model tab and the scorecard, so a saved run is graded on the same call it showed.
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

// The Best bets boards' rule, shared by the Model tab, the scorecard's replay and the strip
// above each rink on Matchups: a shots play needs the gate open and 4+ SOG ≥ 40% or 3+ SOG
// ≥ 60%, ranked by its 4+ and 5+ odds and attack score; a goal play needs 1+ G ≥ 18%,
// ranked by its 1+ and 2+ odds and a slice of attack score.
const shotsPlayFloor = (r) => !!r?.gateOpen && ((r.p4s || 0) >= 0.40 || (r.p3s || 0) >= 0.60);
const shotsPlayRank = (r) => (r.p4s || 0) * 100 + (r.p5s || 0) * 60 + (r.attackScore || 0);
const goalPlayFloor = (r) => (r?.p1g || 0) >= 0.18;
const goalPlayRank = (r) => (r.p1g || 0) * 100 + (r.p2g || 0) * 70 + (r.attackScore || 0) * 0.35;

/** The top `n` shots plays and goal plays among `rows` (result rows, or anything carrying the same fields). */
function boardPlays(rows, n = 5) {
  const list = (rows || []).filter(Boolean);
  const top = (floor, rank) => list.filter(floor).sort((a, b) => rank(b) - rank(a)).slice(0, n);
  return { shots: top(shotsPlayFloor, shotsPlayRank), goals: top(goalPlayFloor, goalPlayRank) };
}

/** The market a play is called on: the shots floor it cleared (4+ first), or 1+ goal. */
function playMarket(r, kind) {
  if (kind === 'goals') return { label: '1+ G', prob: r.p1g || 0, stat: 'g', min: 1 };
  return (r.p4s || 0) >= 0.40 ? { label: '4+ SOG', prob: r.p4s || 0, stat: 'sog', min: 4 } : { label: '3+ SOG', prob: r.p3s || 0, stat: 'sog', min: 3 };
}

/** The Model tab's play tier, from the row's attack score. */
function playTier(score) {
  const v = Number(score || 0);
  if (v >= 85) return 'Auto';
  if (v >= 72) return 'Strong';
  if (v >= 58) return 'Lean';
  return 'Thin';
}

function summarizeRun(files, results, games) {
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

export {
  PLAYER_NAME_ALIASES,
  TEAM_LOGO_ABBR,
  POSITIONS,
  TEAM_ALIASES,
  TEAM_SHORT,
  activePlayersFromPace,
  applyDefenseProfilePriorityResolver,
  applyShotLadderHierarchy,
  average,
  blendDefensemanProbability,
  buildArchetypeEnforcement,
  buildCapabilityBaseFloors,
  buildCeilingEngine,
  buildDefenseRoleMarketBoost,
  buildFeatureNarrative,
  buildFinisherGoalModel,
  buildFinisherShooterGate,
  buildGoalProbabilityFromPipeline,
  buildHotRoleOverride,
  buildProjections,
  buildShotAllocationContext,
  buildShotExplosionEngine,
  buildShotVolumeGate,
  buildTeamOpportunityContext,
  buildVenueTrendImpact,
  capabilityStageMultiplier,
  capabilityStyleMultipliers,
  cheatSheetMajorMultiplier,
  clamp,
  classifyCapabilityStyle,
  classifyDefenseLaneState,
  computeDefenseEnvironment,
  dFallbackBaseRate,
  defenseGoalExceptional,
  defenseGoalMultiplier,
  defensemanBaselineProbabilities,
  defensemanCapabilityProfile,
  defensemanEnvironmentTier,
  defensemanTierBaseline,
  environmentTierFromScore,
  fourPlusShotGateContext,
  getHistoricalShotRoleWeight,
  getShotPositionOpportunityScore,
  goalCapsForTier,
  goalTierFromProb,
  histAdj,
  historyMajorMultiplier,
  isPlayerConfirmedInLineup,
  laneIsNumericallyOpenForRole,
  laneModifier,
  laneOpportunityMultiplier,
  last5GoalFormMultiplier,
  leakScoreFromRank,
  leakTierFromScore,
  lineHistoryStageMultiplier,
  lineRoleOpportunityMultiplier,
  majorFactorProbabilityBlend,
  normShort,
  normTeam,
  normalizeName,
  normalizePlayerName,
  paceCeilingMultiplier,
  paceRankMultiplier,
  paceTierProfile,
  parseBoxScoresWorkbook,
  parseHistoricalProfiles,
  parseLineups,
  parseMatchups,
  parsePaceWorkbook,
  parsePlayerHomeAway,
  parseRankingsFile,
  pickVenueProfile,
  playerGoalFloorProfile,
  playerShotFloorProfile,
  poissonAtLeast,
  poissonPMF,
  positionBudgetStageMultiplier,
  positionGoalLeakOverride,
  profileRate,
  projectedToiFromLineup,
  resolvePaceTier,
  resolveRoleLabelAgainstCheatSheet,
  roleGoalAccessMultiplier,
  roleHistorySupportsSecondaryVolume,
  roleLabelStrengthMultiplier,
  roleWeight,
  rwShotFilterContext,
  safeRatio,
  scorerTierInfo,
  shotTierFromLeak,
  isOnFire,
  summarizeRecentVenueForm,
  bestBetLabel,
  boardPlays,
  playMarket,
  playTier,
  shotsPlayFloor,
  goalPlayFloor,
  summarizeRun,
  weightedAverage,
};
