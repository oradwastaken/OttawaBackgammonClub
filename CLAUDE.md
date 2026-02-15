# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dashboard for the Ottawa Area Backgammon Club. Tracks player statistics and tournament performance across ~85 players and ~396 weekly tournaments (2017-2026). No build system, no backend, no package manager. Hosted on GitHub Pages. Uses ES modules for JavaScript organization.

## File Structure

```
index.html                    HTML shell (~230 lines, no inline CSS/JS)
css/
  variables.css               CSS custom properties & theming
  styles.css                  Dashboard component styles (layout, cards, podium, tables, charts)
  modals.css                  Modal styles + upload UI + loading/error states
js/
  main.js                     Entry point — init(), event wiring, window exposure for onclick
  state.js                    Shared mutable state object, constants (COLORS, PALETTE), helpers
  data.js                     loadData(), deriveData(), localStorage functions
  excel.js                    parseExcelToData() — SheetJS integration
  theme.js                    isDark(), applyChartDefaults(), restoreTheme()
  charts.js                   All 12 chart builders + rebuildCharts/rebuildAll + animateNumber
  github.js                   GitHub publish workflow (API calls, settings)
  upload.js                   Upload modal logic (file handling, apply data)
  modal.js                    Player detail modal (stats display + yearly chart)
data.json                     Canonical dataset (pretty-printed, git-tracked)
data.js                       Generated file:// fallback (gitignored, root only)
scripts/
  generate-data-js.js         Generates data.js from data.json
.github/
  workflows/
    deploy.yml                GitHub Pages deployment (generates data.js at build time)
```

## Development

Serve via HTTP (ES modules require it):
```
python -m http.server
```

To regenerate `data.js` locally after editing `data.json`:
```
node scripts/generate-data-js.js
```

There is no build step, no test suite, and no linter configured.

## Architecture

### ES Module Pattern
All JavaScript uses ES modules (`import`/`export`). `js/main.js` is the entry point loaded via `<script type="module">`. Functions needed by HTML `onclick` attributes are exposed via `Object.assign(window, {...})` in `main.js`.

### State Management
`js/state.js` exports a mutable `state` object. All modules import and mutate `state.DATA`, `state.byPoints`, etc. Constants (`COLORS`, `PALETTE`, `minT`) and helpers (`initials()`, `firstName()`) are also exported from `state.js`.

### Data Loading Chain (`loadData()` in `js/data.js`)
1. Check LocalStorage (`bgclub-data` key) for previously uploaded Excel data
2. Try `fetch('data.json')` — works on HTTPS (GitHub Pages)
3. Fallback: inject `<script src="data.js">` — works on `file://` protocol (but modules won't load)
4. If all fail: show error with upload button

### Data Flow
1. `loadData()` sets `state.DATA` (and optionally `state.DEFAULT_DATA`)
2. `deriveData()` produces sorted/filtered arrays from `state.DATA.players`
3. 12 Chart.js visualizations render from derived data
4. User can upload Excel → data persists to LocalStorage
5. User clicks "Publish to GitHub" → commits `data.json` directly via GitHub API → auto-redeploys

### Module Dependency Graph
```
main.js → state, data, theme, charts, modal, upload, github
charts.js → state, theme, data (for deriveData/updateDataSourceInfo)
upload.js → state, data, excel, github, charts
modal.js → state
github.js → state, data (for clearStoredData)
data.js → state
theme.js → (no internal imports, uses global Chart)
excel.js → (no imports, uses global XLSX)
state.js → (leaf node, no imports)
```

### Avoiding Circular Dependencies
`theme.js` exports utilities only (`isDark`, `applyChartDefaults`). The `toggleTheme()` function lives in `main.js` where both `theme.js` and `charts.js` are available — no cycle.

### Player Data Shape
Each player object: `{ player, total_points, wins, losses, total_matches, win_pct, tournaments, ppt, placed_count, placed_pct, placing_pts, participation_pct }`

### CDN Dependencies
- **Chart.js 4.4.7** — all chart rendering (loaded as classic script, `Chart` global)
- **SheetJS (XLSX) 0.20.3** — Excel file parsing (loaded as classic script, `XLSX` global)
- **Google Fonts (Inter)** — typography

### Excel Import
`parseExcelToData(workbook)` in `js/excel.js` expects columns: Date, Player, Wins, Losses, and optional Placing. Column detection is case-insensitive. The parser handles Date objects, Excel serial dates, and ISO strings.

## Deployment

Hosted on GitHub Pages. On push to `main`, the GitHub Action:
1. Generates `data.js` from `data.json`
2. Deploys all files to GitHub Pages

To update data: upload Excel on the dashboard → click "Publish to GitHub". This commits `data.json` via the GitHub API and triggers auto-deploy.

### GitHub Publish (in-browser)
- Token and repo stored in LocalStorage (`bgclub-github` key)
- One-time setup: click "GitHub Settings" in the upload modal, enter `owner/repo` and a fine-grained PAT with `contents:write` scope
- Uses `PUT /repos/{owner}/{repo}/contents/data.json` to commit directly

## Conventions
- Glassmorphism design with `backdrop-filter: blur` and semi-transparent cards
- Theming via CSS `light-dark()` — toggle switches `color-scheme` between `dark` and `light` on `:root`
- Charts are destroyed and rebuilt on data changes (no update-in-place)
- Modal charts (`modalChart`, `radarChart`) are module-private variables in their respective files
- `init()` is async — data loading happens before any chart rendering
- `.gitignore` uses `/data.js` (leading slash) to only ignore root-level generated file, not `js/data.js`
