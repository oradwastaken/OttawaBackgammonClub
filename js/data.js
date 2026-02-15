import { state, toTitleCase } from './state.js';

// ===== DATA LOADING =====

export async function loadData() {
  // 1. Check localStorage first (user-uploaded Excel data)
  const stored = loadDataFromStorage();
  if (stored && stored.data) {
    state.DATA = stored.data;
    sanitizeNames(state.DATA);
    return;
  }

  // 2. Try fetching data.json (works on https://, not on file://)
  try {
    const resp = await fetch('data.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    state.DEFAULT_DATA = await resp.json();
    sanitizeNames(state.DEFAULT_DATA);
    state.DATA = state.DEFAULT_DATA;
    return;
  } catch (e) {
    console.warn('Could not fetch data.json:', e.message);
  }

  // 3. Fallback: inject <script src=data.js> (works on file://)
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'data.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    if (window.__BACKGAMMON_DATA__) {
      state.DEFAULT_DATA = window.__BACKGAMMON_DATA__;
      sanitizeNames(state.DEFAULT_DATA);
      state.DATA = state.DEFAULT_DATA;
      return;
    }
  } catch (e) {
    console.warn('Could not load data.js fallback:', e.message);
  }

  // 4. If everything fails, show error
  throw new Error('No data available. Please upload an Excel file.');
}

// ===== NAME SANITIZATION =====

function sanitizeNames(data) {
  if (!data || !data.players) return;

  // Merge players with same name after title-casing
  const merged = {};
  for (const p of data.players) {
    const name = toTitleCase(p.player);
    if (!merged[name]) {
      merged[name] = { ...p, player: name };
    } else {
      const m = merged[name];
      m.wins += p.wins;
      m.losses += p.losses;
      m.placing_pts += p.placing_pts;
      m.tournaments += p.tournaments;
      m.placed_count += p.placed_count;
      m.total_matches = m.wins + m.losses;
      m.total_points = m.wins + m.placing_pts;
      m.win_pct = m.total_matches > 0 ? +((m.wins / m.total_matches) * 100).toFixed(1) : 0;
      m.ppt = m.tournaments > 0 ? +(m.total_points / m.tournaments).toFixed(2) : 0;
      m.placed_pct = m.tournaments > 0 ? +((m.placed_count / m.tournaments) * 100).toFixed(1) : 0;
      m.participation_pct = data.total_tournaments > 0 ? +((m.tournaments / data.total_tournaments) * 100).toFixed(1) : 0;
    }
  }
  data.players = Object.values(merged);

  // Normalize keys in cumulative and yearly_performance
  for (const key of ['cumulative', 'yearly_performance']) {
    if (!data[key]) continue;
    const norm = {};
    for (const [name, val] of Object.entries(data[key])) {
      norm[toTitleCase(name)] = norm[toTitleCase(name)] || val;
    }
    data[key] = norm;
  }

  // Normalize tournament_history keys (merge + re-sort on duplicate names)
  if (data.tournament_history) {
    const norm = {};
    for (const [name, history] of Object.entries(data.tournament_history)) {
      const key = toTitleCase(name);
      if (norm[key]) {
        norm[key] = [...norm[key], ...history].sort((a, b) => a.date.localeCompare(b.date));
      } else {
        norm[key] = history;
      }
    }
    data.tournament_history = norm;
  }
}

// ===== YEAR FILTERING =====

/** Count tournaments in selected years using attendance keys */
export function getFilteredTournamentCount() {
  if (!state.selectedYears) return state.DATA.total_tournaments;
  return Object.keys(state.DATA.attendance)
    .filter(d => state.selectedYears.has(d.slice(0, 4)))
    .length;
}

/**
 * Apply year filter: reconstruct player objects from yearly_performance
 * when specific years are selected, or use all-time DATA.players for "All Time".
 */
export function applyFilters() {
  if (!state.selectedYears) {
    state.players = state.DATA.players;
    return;
  }

  const yp = state.DATA.yearly_performance;
  const totalT = getFilteredTournamentCount();
  const filtered = [];

  for (const [name, yearlyArr] of Object.entries(yp)) {
    const entries = yearlyArr.filter(y => state.selectedYears.has(y.year));
    if (!entries.length) continue;

    const wins = entries.reduce((s, y) => s + y.wins, 0);
    const losses = entries.reduce((s, y) => s + y.losses, 0);
    const tournaments = entries.reduce((s, y) => s + y.tournaments, 0);
    if (tournaments === 0) continue;

    const placing_pts = entries.reduce((s, y) =>
      s + (y.placing_pts != null ? y.placing_pts : (y.points - y.wins)), 0);
    const placed_count = entries.reduce((s, y) =>
      s + (y.placed_count != null ? y.placed_count : 0), 0);
    const tournament_win_pts = entries.reduce((s, y) =>
      s + (y.tournament_win_pts != null ? y.tournament_win_pts : 0), 0);
    const advancement_pts = entries.reduce((s, y) =>
      s + (y.advancement_pts != null ? y.advancement_pts : 0), 0);
    const total_points = wins + placing_pts;
    const total_matches = wins + losses;
    const win_pct = total_matches > 0 ? +((wins / total_matches) * 100).toFixed(1) : 0;
    const ppt = tournaments > 0 ? +(total_points / tournaments).toFixed(2) : 0;
    const placed_pct = tournaments > 0 ? +((placed_count / tournaments) * 100).toFixed(1) : 0;
    const participation_pct = totalT > 0 ? +((tournaments / totalT) * 100).toFixed(1) : 0;

    filtered.push({
      player: name, total_points, wins, losses, total_matches, win_pct,
      tournaments, ppt, placed_count, placed_pct, placing_pts,
      tournament_win_pts, advancement_pts, participation_pct
    });
  }

  state.players = filtered;
}

// ===== DERIVE SORTED ARRAYS =====

export function deriveData() {
  state.byPoints = [...state.players].sort((a, b) => b.total_points - a.total_points);
  state.qualified = state.players.filter(p => p.tournaments >= state.minTournaments);
  state.byWinPct = [...state.qualified].sort((a, b) => b.win_pct - a.win_pct);
  state.byPPT = [...state.qualified].sort((a, b) => b.ppt - a.ppt);
  state.byPlaced = [...state.qualified].sort((a, b) => b.placed_pct - a.placed_pct);
  state.byAttendance = [...state.players].sort((a, b) => b.tournaments - a.tournaments);
}

// ===== LOCAL STORAGE =====

export function saveDataToStorage(data, fileName) {
  try {
    localStorage.setItem('bgclub-data', JSON.stringify({
      data, fileName, uploadedAt: new Date().toISOString()
    }));
  } catch (e) { /* quota exceeded -- data will not persist */ }
}

export function loadDataFromStorage() {
  try {
    const stored = localStorage.getItem('bgclub-data');
    return stored ? JSON.parse(stored) : null;
  } catch (e) { return null; }
}

export function clearStoredData() {
  localStorage.removeItem('bgclub-data');
}

// ===== DATA SOURCE INDICATOR =====

export function updateDataSourceInfo() {
  const el = document.getElementById('data-source-info');
  if (!el) return;
  const allDates = Object.keys(state.DATA.attendance).sort();
  const latestTournament = allDates.length ? new Date(allDates[allDates.length - 1] + 'T00:00:00') : null;
  const stored = loadDataFromStorage();
  if (stored && stored.data) {
    const uploadDate = new Date(stored.uploadedAt);
    const best = latestTournament && latestTournament > uploadDate ? latestTournament : uploadDate;
    const dateStr = best.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    el.innerHTML = `Updated <strong>${dateStr}</strong>`;
  } else {
    const updatedStr = latestTournament
      ? latestTournament.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'unknown';
    el.innerHTML = `Updated <strong>${updatedStr}</strong>`;
  }
  // Update subtitle counts
  const dates = allDates;
  const firstYear = dates[0] ? dates[0].slice(0, 4) : '?';
  const lastYear = dates[dates.length - 1] ? dates[dates.length - 1].slice(0, 4) : '?';
  document.getElementById('header-subtitle').innerHTML =
    `Player Statistics &amp; Performance Dashboard &mdash; ${state.DATA.total_tournaments} Tournaments &bull; ${state.DATA.players.length} Players &bull; ${firstYear} &ndash; ${lastYear}`;
}
