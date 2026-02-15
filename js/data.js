import { state, minT } from './state.js';

// ===== DATA LOADING =====

export async function loadData() {
  // 1. Check localStorage first (user-uploaded Excel data)
  const stored = loadDataFromStorage();
  if (stored && stored.data) {
    state.DATA = stored.data;
    return;
  }

  // 2. Try fetching data.json (works on https://, not on file://)
  try {
    const resp = await fetch('data.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    state.DEFAULT_DATA = await resp.json();
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
      state.DATA = state.DEFAULT_DATA;
      return;
    }
  } catch (e) {
    console.warn('Could not load data.js fallback:', e.message);
  }

  // 4. If everything fails, show error
  throw new Error('No data available. Please upload an Excel file.');
}

// ===== DERIVE SORTED ARRAYS =====

export function deriveData() {
  state.players = state.DATA.players;
  state.byPoints = [...state.players].sort((a, b) => b.total_points - a.total_points);
  state.qualified = state.players.filter(p => p.tournaments >= minT);
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
  const stored = loadDataFromStorage();
  if (stored && stored.data) {
    const d = new Date(stored.uploadedAt);
    const dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    el.innerHTML = `Data: <strong>${stored.fileName}</strong> (uploaded ${dateStr})`;
  } else {
    el.textContent = 'Data: Default dataset (data.json)';
  }
  // Update subtitle counts
  const dates = Object.keys(state.DATA.attendance).sort();
  const firstYear = dates[0] ? dates[0].slice(0, 4) : '?';
  const lastYear = dates[dates.length - 1] ? dates[dates.length - 1].slice(0, 4) : '?';
  document.getElementById('header-subtitle').innerHTML =
    `Player Statistics &amp; Performance Dashboard &mdash; ${state.DATA.total_tournaments} Tournaments &bull; ${state.DATA.players.length} Players &bull; ${firstYear} &ndash; ${lastYear}`;
}
