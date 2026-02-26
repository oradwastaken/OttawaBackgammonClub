// Mutable state — properties can be mutated by any importing module
export const state = {
  DATA: null,
  DEFAULT_DATA: null,
  players: null,
  byPoints: null,
  qualified: null,
  byWinPct: null,
  byPPT: null,
  byPlaced: null,
  byAttendance: null,
  pendingParsedData: null,
  selectedYears: null,    // null = "All Time", or Set of year strings e.g. new Set(["2026"])
  minTournaments: 1,      // adjustable via slider (set dynamically on init/filter change)
  cumulativeSelected: null, // Set of player names shown on cumulative chart (null = use defaults)
  breakdownSelected: null,  // Set of player names shown on points breakdown chart (null = use defaults)
  trendSelected: null,      // Set of player names shown on win % trend chart (null = use defaults)
  trendWindowSize: 50,      // Rolling average window for trend chart (10-200 matches)
  spotlightPlayer: null,    // string (player name) or null — set by spotlight search
};

/** Compute a sensible default: 1/3 of tournaments, capped at 8, minimum 1 */
export function getDefaultMinTournaments(totalTournaments) {
  return Math.max(1, Math.min(Math.floor(totalTournaments / 3), 8));
}

export const COLORS = {
  gold: '#f59e0b', blue: '#3b82f6', cyan: '#06b6d4', emerald: '#10b981',
  purple: '#8b5cf6', rose: '#f43f5e', orange: '#f97316', lime: '#84cc16',
  pink: '#ec4899', teal: '#14b8a6'
};

export const PALETTE = [
  COLORS.gold, COLORS.blue, COLORS.cyan, COLORS.emerald, COLORS.purple,
  COLORS.rose, COLORS.orange, COLORS.lime, COLORS.pink, COLORS.teal
];

export const PALETTE_BG = PALETTE.map(c => c + '33');

export function toTitleCase(str) {
  return str.replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function firstName(name) {
  const parts = name.split(' ');
  return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : name;
}

/** Standard competition ranking (1224): tied players share the same rank, next rank skips. */
export function competitionRank(sortedArray, index, key) {
  if (index < 0 || index >= sortedArray.length) return index + 1;
  const val = sortedArray[index][key];
  let rank = index;
  while (rank > 0 && sortedArray[rank - 1][key] === val) rank--;
  return rank + 1;
}

/** Podium rank colors (1-indexed). Used by main podium and monthly recap. */
export const PODIUM_COLORS = {
  1: { bg: 'light-dark(rgba(217,119,6,0.2), rgba(245,158,11,0.2))', border: 'var(--accent-gold)', color: 'var(--accent-gold-light)', barGrad: 'light-dark(rgba(217,119,6,0.45), rgba(245,158,11,0.3)), light-dark(rgba(217,119,6,0.1), rgba(245,158,11,0.05))' },
  2: { bg: 'light-dark(rgba(100,116,139,0.15), rgba(148,163,184,0.15))', border: 'light-dark(#64748b, #94a3b8)', color: 'light-dark(#475569, #cbd5e1)', barGrad: 'light-dark(rgba(100,116,139,0.4), rgba(148,163,184,0.3)), light-dark(rgba(100,116,139,0.1), rgba(148,163,184,0.05))' },
  3: { bg: 'light-dark(rgba(180,83,9,0.15), rgba(217,119,6,0.15))', border: 'light-dark(#b45309, #d97706)', color: 'light-dark(#92400e, #fbbf24)', barGrad: 'light-dark(rgba(180,83,9,0.4), rgba(217,119,6,0.25)), light-dark(rgba(180,83,9,0.1), rgba(217,119,6,0.05))' },
  4: { bg: 'light-dark(rgba(37,99,235,0.12), rgba(59,130,246,0.12))', border: 'light-dark(#2563eb, #3b82f6)', color: 'light-dark(#1e40af, #93c5fd)', barGrad: 'light-dark(rgba(37,99,235,0.35), rgba(59,130,246,0.2)), light-dark(rgba(37,99,235,0.08), rgba(59,130,246,0.05))' },
  5: { bg: 'light-dark(rgba(124,58,237,0.12), rgba(139,92,246,0.12))', border: 'light-dark(#7c3aed, #8b5cf6)', color: 'light-dark(#5b21b6, #c4b5fd)', barGrad: 'light-dark(rgba(124,58,237,0.35), rgba(139,92,246,0.2)), light-dark(rgba(124,58,237,0.08), rgba(139,92,246,0.05))' },
};
