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
