#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

const palette = {
  colors: {
    bg: "#F5F5F7",
    surface: "#FFFFFF",
    surfaceSoft: "#FAFAFA",
    border: "rgba(0, 0, 0, 0.09)",
    ink: "#1D1D1F",
    muted: "#6E6E73",
    brandPrimary: "#9B59D0",
    brandSecondary: "#E8409C",
    brandTertiary: "#C84B9E",
    brandSoft: "#F5EEFF",
    gradient: "linear-gradient(90deg, #9B59D0, #E8409C)",
    gradientDiagonal: "linear-gradient(135deg, #9B59D0, #E8409C)",
  },
  fonts: {
    ui: "Inter",
    display: "Unbounded",
  },
  tokens: {
    globalsFile: "app/globals.css",
    layoutFile: "app/layout.js",
    mainUiFile: "components/IdeaWheel.jsx",
  },
};

const trackedDirs = ["app", "components", "lib"];
const allowedLiteralFiles = new Set([
  path.join(ROOT, "app/globals.css"),
  path.join(ROOT, "migrate-palette.js"),
]);

const forbiddenBrandLiterals = [
  "#9B59D0",
  "#E8409C",
  "#C84B9E",
  "#F5F5F7",
  "#1D1D1F",
  "#6E6E73",
  "family=Barlow",
  "'Barlow'",
  '"Barlow"',
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next", ".vercel"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function audit() {
  const failures = [];
  const globalsCss = read("app/globals.css");
  const layoutJs = read("app/layout.js");
  const ideaWheel = read("components/IdeaWheel.jsx");

  const requiredGlobalSnippets = [
    "--iw-color-brand-primary: #9B59D0;",
    "--iw-color-brand-secondary: #E8409C;",
    "--iw-color-brand-tertiary: #C84B9E;",
    "--iw-color-bg: #F5F5F7;",
    "--iw-font-ui: 'Inter'",
    "--iw-font-display: 'Unbounded'",
  ];

  for (const snippet of requiredGlobalSnippets) {
    if (!globalsCss.includes(snippet)) {
      failures.push(`Missing palette token in app/globals.css: ${snippet}`);
    }
  }

  if (!layoutJs.includes("family=Inter") || !layoutJs.includes("family=Unbounded")) {
    failures.push("app/layout.js is not loading the Inter + Unbounded palette fonts.");
  }

  if (layoutJs.includes("Barlow")) {
    failures.push("app/layout.js still references Barlow.");
  }

  if (!ideaWheel.includes("--bg:        var(--iw-color-bg);")) {
    failures.push("components/IdeaWheel.jsx is not consuming global palette tokens.");
  }

  const scannedFiles = trackedDirs.flatMap((dir) => walk(path.join(ROOT, dir)));
  for (const file of scannedFiles) {
    if (allowedLiteralFiles.has(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const literal of forbiddenBrandLiterals) {
      if (text.includes(literal)) {
        failures.push(`${path.relative(ROOT, file)} still contains forbidden palette literal: ${literal}`);
      }
    }
  }

  if (failures.length) {
    console.error("\nPalette audit failed:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("\nPalette audit passed.");
  console.log(`- Fonts: ${palette.fonts.display} + ${palette.fonts.ui}`);
  console.log(`- Primary gradient: ${palette.colors.gradient}`);
  console.log(`- UI files audited: ${trackedDirs.join(", ")}`);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(palette, null, 2));
} else {
  audit();
}
