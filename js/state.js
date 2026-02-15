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
};

export const minT = 5;

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

export function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function firstName(name) {
  const parts = name.split(' ');
  return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : name;
}
