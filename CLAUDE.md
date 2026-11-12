# CLAUDE.md

This repo is the picks site served at https://ideareels.io: a start screen with three sports
(`/` → `components/site/Start.jsx`), the NHL Model 3.0 app at `/nhl`, the NFL board at `/nfl` and the NBA
board at `/nba`. It replaced the former IdeaReels startup-idea product; that code is in git history before the
"Replace IdeaReels with NHL Model 3.0" commit.

## The project notes: read only the area you touch

This file is loaded into every session and every subagent, so it stays short. The detailed notes (every
decision, Vincent's calls with their dates, the constants and why) live in `docs/claude/`, one file per area.
**Read the file for the area a task touches before changing it, and only that file** (grep it for the function
or file name when you need one passage: `grep -n 'ladderOf' docs/claude/*.md`).

| File | Read it when the task touches |
| --- | --- |
| `docs/claude/site.md` | the start screen, the gate, the header / sport nav, hash tabs, the NFL / NBA page layouts, player search |
| `docs/claude/picks-core.md` | `lib/picks/*`: value / EV, the board builder, markets, cheat-sheet parsing (PDF, OCR), the cocktail, shuffle, scorecard, calibration, PropFinder pulls, injuries, rotations, store |
| `docs/claude/nfl.md` | `lib/nfl/*`, `components/nfl/*`: week, ESPN, the detailed sheet, projections / ladders / TDs, big games, the defense snapshot |
| `docs/claude/nba.md` | `lib/nba/*`, `components/nba/*`: the NBA sheet, courts, player card, first basket, boards, big games, cheat-sheet view |
| `docs/claude/nhl.md` | `/nhl`, `lib/nhl-data/*`, `components/nhl/*`: data pulls, lineups, the model and its ports, Defense / Matchups / Best bets / shuffle / patterns, goalies, calibration, scorecard |
| `docs/claude/scheduler.md` | `lib/scheduler.js`, `lib/schedule-jobs.js`, the GitHub data workflows |
| `docs/claude/performance.md` | memoisation (`lib/memo.js`), store caching, anything a page waits on |
| `docs/claude/audits.md` | `tools/audit/`, `tools/predictors/`, `docs/audits/`: what was measured and what changed |

**Writing the notes**: a new decision or behaviour goes into its area file, in the style already there.
Add to `CLAUDE.md` only what every session needs (a new rule, a new area file in the table above). Keep it
under ~150 lines.

## Working without wasting context

- **Large files: grep, then read a range.** Never read these whole: `components/nhl/model-core.js` (258 KB),
  `components/nhl/NhlModel.jsx` (193 KB), `app/globals.css` (178 KB), `lib/picks/board.js` (92 KB),
  `docs/shots-goals-predictors.md` (94 KB), `lib/nhl-data/patterns-rules.json`, `lib/nhl-data/seed/*`,
  `package-lock.json`, and everything in `__tests__/fixtures/` (real payloads up to 146 KB). Use
  `grep -n` for the symbol, then `Read` with `offset` / `limit` (or `sed -n 'a,bp'`).
- **Tests: run the files you touched, quietly.** `npx jest __tests__/nba-board.test.js --silent` while working;
  the full `npm test -- --silent` (105 test files) once before committing, and look at the failures only
  (`npm test -- --silent 2>&1 | grep -E '✕|●|Tests:'`). Do not paste the whole run into the conversation.
- **Build output**: `npm run build 2>&1 | tail -30` is enough unless it fails.
- **Find before you open**: `grep -rn` / Glob for the function name; the area file names the module for most
  features. Use an Explore subagent for a broad sweep so only its conclusion comes back.
- **History**: `git log --oneline -- <file>` and `git show <sha> --stat` before a full diff.

## Canonical locations

- Local repo: `/Users/vincent/.openclaw/workspace/projects/idea-wheel`
- GitHub: `https://github.com/vincentploum-cmyk/idea-wheel`
- Production: `https://ideareels.io` (Cloudflare in front)
- Hosting: Render web service, auto-builds from GitHub `main` (`render.yaml`)
- Model source of truth for new logic: `~/Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx`

## Workflow

1. Edit files in this repo.
2. `npm test` and `npm run build`.
3. Check `/`, `/nfl`, `/nba` and `/nhl` at 1440 and 390 widths (landing signed out; the start screen and
   the boards via `NHL_DEV_USER_EMAIL=... NHL_STORE_DRIVER=fs npm run dev`).
4. Commit, push `main`; Render deploys in ~2-3 min. CI smoke checks `/`, `/auth/login`,
   `/api/health` (commit match) and that `/api/nhl/runs` returns 401 when signed out.

## Design

- Design context, brand words, palette and type rules live in `.impeccable.md`; read it
  before any visual change. Tokens only (`globals.css`), no hard-coded tints, no nested
  cards, no gradient text, no side-stripe borders.

## Rules

- The site is admin-only: `NHL_ADMIN_EMAILS` on Render when set, else `DEFAULT_ADMIN_EMAILS` in `lib/nhl-admin.js`
  (both lists must carry a new person). Every `/api/nhl/*`, `/api/nfl/*` and `/api/site/*` route must call
  `requireNhlAdmin()` or `authorize()`.
- Last season means the regular season: `loadRows` (`rowsBefore` in `lib/nhl-data/build.js`) drops the previous
  season's playoff rows (`isPlayoffGame` in `util.js`) from every base; this season's rows come whole. The
  opponent's table in any number is this season's (`positionAllowed`, `defenseBlocks`, the Defense tab's
  `seasonDefense`). (Vincent's call, 2026-10-27.)
- Keep the model's math untouched when restyling; port logic changes from the local app into
  `components/nhl/model-core.js` (pipeline) and `NhlModel.jsx` (UI). Five changes went the other way and must
  be ported into `App.jsx` (`node tools/port-model-core.mjs`): read "Porting model changes" at the end of
  `docs/claude/nhl.md` before touching the model.
- Never change the NHL model's parsers to fit the automation; change the builders instead (`docs/claude/nhl.md`).
- PropFinder field spellings not yet seen in a real pull are read through `FIELDS` and reported in
  `fieldsSeen.unread`; never guess silently (`docs/claude/picks-core.md`).
- Secrets stay out of git (Render env + `.env.local`).
- Site is `noindex` by design (robots.txt disallow + X-Robots-Tag).
