# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dashboard for the Ottawa Area Backgammon Club. Tracks player statistics and tournament performance across ~85 players and ~396 weekly tournaments (2017-2026). No build system, no backend, no package manager. Hosted on GitHub Pages.

## File Structure

```
index.html                    Main dashboard (HTML + CSS + JS)
data.json                     Canonical dataset (pretty-printed, git-tracked)
data.js                       Generated file:// fallback (gitignored)
README.md                     Admin-facing instructions
scripts/
  generate-data-js.js         Generates data.js from data.json
.github/
  workflows/
    deploy.yml                GitHub Pages deployment (generates data.js at build time)
```

## Development

Open `index.html` in a browser. For `fetch()` to work, serve via HTTP:
```
python -m http.server
```
Or open directly via `file://` — the `data.js` script-tag fallback handles this.

To regenerate `data.js` locally after editing `data.json`:
```
node scripts/generate-data-js.js
```

There is no build step, no test suite, and no linter configured.

## Architecture

### Data Loading Chain (`loadData()`)
1. Check LocalStorage (`bgclub-data` key) for previously uploaded Excel data
2. Try `fetch('data.json')` — works on HTTPS (GitHub Pages)
3. Fallback: inject `<script src="data.js">` — works on `file://` protocol
4. If all fail: show error with upload button

### Data Flow
1. `loadData()` sets `DATA` (and optionally `DEFAULT_DATA`)
2. `deriveData()` produces sorted/filtered arrays from `DATA.players`
3. 12+ Chart.js visualizations render from derived data
4. User can upload Excel → data persists to LocalStorage
5. User clicks "Publish to GitHub" → commits `data.json` directly via GitHub API → auto-redeploys

### index.html Structure (top to bottom)
- **Lines 10-930**: CSS styles (includes loading overlay/error state styles)
- **Lines 930-1100**: HTML structure — loading overlay, header, dashboard grid, charts, modals
- **Lines 1100+**: JavaScript — async data loading, parsing, charts, UI logic

### Key Globals
- `DATA` / `DEFAULT_DATA` — the full dataset (players, attendance, cumulative, yearly_performance, years)
- `players`, `byPoints`, `qualified`, `byWinPct`, `byPPT`, `byPlaced`, `byAttendance` — derived sorted arrays
- `minT = 5` — minimum tournaments to be "qualified" for rate-based leaderboards
- `radarSelected` — Set tracking which players are toggled on the radar chart

### Player Data Shape
Each player object: `{ player, total_points, wins, losses, total_games, win_pct, tournaments, ppt, placed_count, placed_pct, placing_pts, participation_pct }`

### CDN Dependencies
- **Chart.js 4.4.7** — all chart rendering
- **SheetJS (XLSX) 0.20.3** — Excel file parsing
- **Google Fonts (Inter)** — typography

### Excel Import
`parseExcelToData(workbook)` expects columns: Date, Player, Wins, Losses, and optional Placing. Column detection is case-insensitive. The parser handles Date objects, Excel serial dates, and ISO strings.

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
- Modal charts (`modalChart`, `radarChart`) are stored globally for cleanup before recreation
- `init()` is async — data loading happens before any chart rendering
