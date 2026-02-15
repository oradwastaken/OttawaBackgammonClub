import { state, COLORS, PALETTE, firstName, initials } from './state.js';
import { isDark, applyChartDefaults } from './theme.js';
import { applyFilters, deriveData, getFilteredTournamentCount, updateDataSourceInfo } from './data.js';
import { renderSpotlightCard } from './spotlight.js';

// ===== MODULE-PRIVATE STATE =====
let cumulativeChartInstance = null;

function saveSelectedPlayers(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

function loadSelectedPlayers(key) {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr) && arr.length) return new Set(arr);
    }
  } catch {}
  return null;
}
let trendChartInstance = null;

// ===== REBUILD =====

export function rebuildCharts() {
  Chart.helpers.each(Chart.instances, (chart) => chart.destroy());
  cumulativeChartInstance = null;
  breakdownChartInstance = null;
  trendChartInstance = null;
  applyChartDefaults();
  buildAllMiniBoards();
  buildPointsBreakdown();
  buildCumulativeChart();
  buildAttendanceChart();
  buildYearlyPoints();
  buildYearlyOverview();
  buildWinLossChart();
  buildTrendChart();
}

/** Label for the current filter state, e.g. "2026" or "2025-2026" or "All-Time" */
export function getFilterLabel() {
  if (!state.selectedYears) return 'All-Time';
  const sorted = [...state.selectedYears].sort();
  if (sorted.length === 1) return sorted[0];
  return sorted.join(', ');
}

export function rebuildAll() {
  applyFilters();
  deriveData();
  buildPodium();
  buildLeaderboardTable();
  rebuildCharts();

  // Update summary stats to reflect filtered data
  const totalMatches = state.players.reduce((s, p) => s + p.total_matches, 0);
  const filteredTournaments = getFilteredTournamentCount();
  animateNumber(document.getElementById('stat-tournaments'), filteredTournaments);
  animateNumber(document.getElementById('stat-players'), state.players.length);
  animateNumber(document.getElementById('stat-matches'), totalMatches);
  animateNumber(document.getElementById('stat-years'), state.selectedYears ? state.selectedYears.size : state.DATA.years.length);

  // Update leaderboard title
  const titleEl = document.getElementById('leaderboard-title');
  if (titleEl) {
    titleEl.innerHTML = `<span class="dot" style="background: var(--accent-gold);"></span> ${getFilterLabel()} Points Leaderboard`;
  }

  // Rebuild year pills (in case years changed after upload)
  if (typeof window.buildYearPills === 'function') window.buildYearPills();

  updateDataSourceInfo();
  renderSpotlightCard();
}

// ===== ANIMATE NUMBERS =====

export function animateNumber(el, target, duration = 1200) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ===== 1. PODIUM (Top 5) =====

export function buildPodium() {
  const top5 = state.byPoints.slice(0, 5);
  if (!top5.length) return;
  // Left to right: 1st, 2nd, 3rd, 4th, 5th
  const order = top5;
  const podiumEl = document.getElementById('podium');
  const barHeights = { 1: 110, 2: 88, 3: 70, 4: 55, 5: 44 };
  const avatarColors = {
    1: { bg: 'light-dark(rgba(217,119,6,0.2), rgba(245,158,11,0.2))', border: 'var(--accent-gold)', color: 'var(--accent-gold-light)' },
    2: { bg: 'light-dark(rgba(100,116,139,0.15), rgba(148,163,184,0.15))', border: 'light-dark(#64748b, #94a3b8)', color: 'light-dark(#475569, #cbd5e1)' },
    3: { bg: 'light-dark(rgba(180,83,9,0.15), rgba(217,119,6,0.15))', border: 'light-dark(#b45309, #d97706)', color: 'light-dark(#92400e, #fbbf24)' },
    4: { bg: 'light-dark(rgba(37,99,235,0.12), rgba(59,130,246,0.12))', border: 'light-dark(#2563eb, #3b82f6)', color: 'light-dark(#1e40af, #93c5fd)' },
    5: { bg: 'light-dark(rgba(124,58,237,0.12), rgba(139,92,246,0.12))', border: 'light-dark(#7c3aed, #8b5cf6)', color: 'light-dark(#5b21b6, #c4b5fd)' },
  };
  const barGrads = {
    1: 'light-dark(rgba(217,119,6,0.45), rgba(245,158,11,0.3)), light-dark(rgba(217,119,6,0.1), rgba(245,158,11,0.05))',
    2: 'light-dark(rgba(100,116,139,0.4), rgba(148,163,184,0.3)), light-dark(rgba(100,116,139,0.1), rgba(148,163,184,0.05))',
    3: 'light-dark(rgba(180,83,9,0.4), rgba(217,119,6,0.25)), light-dark(rgba(180,83,9,0.1), rgba(217,119,6,0.05))',
    4: 'light-dark(rgba(37,99,235,0.35), rgba(59,130,246,0.2)), light-dark(rgba(37,99,235,0.08), rgba(59,130,246,0.05))',
    5: 'light-dark(rgba(124,58,237,0.35), rgba(139,92,246,0.2)), light-dark(rgba(124,58,237,0.08), rgba(139,92,246,0.05))',
  };

  podiumEl.innerHTML = order.map(p => {
    const rank = top5.indexOf(p) + 1;
    const crown = rank === 1 ? '<span class="crown">&#9813;</span>' : '';
    const ac = avatarColors[rank];
    const isFirst = rank === 1;
    const avatarSize = isFirst ? 68 : 56;
    const fontSize = isFirst ? 22 : 18;
    return `
      <div class="podium-slot clickable" onclick="openModal('${p.player}')">
        <div class="podium-avatar" style="background:${ac.bg};border-color:${ac.border};color:${ac.color};width:${avatarSize}px;height:${avatarSize}px;font-size:${fontSize}px;">${crown}${initials(p.player)}</div>
        <div class="podium-name">${p.player}</div>
        <div class="podium-pts">${Math.round(p.total_points)} pts</div>
        <div class="podium-sub"><span style="color:${COLORS.blue}">${getBreakdownData(p).wins}</span> MW · <span style="color:${COLORS.gold}">${Math.round(getBreakdownData(p).tournamentWins / 4)}</span> TW · <span style="color:${COLORS.emerald}">${Math.round(getBreakdownData(p).advancements / 2)}</span> TA</div>
        <div class="podium-bar" style="height:${barHeights[rank]}px;background:linear-gradient(180deg,${barGrads[rank]});"></div>
      </div>`;
  }).join('');

  // Legend for abbreviations
  const legendEl = document.getElementById('podium-legend');
  if (legendEl) {
    legendEl.innerHTML = `<span style="color:${COLORS.blue}">MW</span> Match Wins · <span style="color:${COLORS.gold}">TW</span> Tournament Wins · <span style="color:${COLORS.emerald}">TA</span> Tournament Advancements`;
  }

  // Spotlight: highlight matching podium slot
  if (state.spotlightPlayer) {
    podiumEl.querySelectorAll('.podium-slot').forEach(slot => {
      if (slot.querySelector('.podium-name')?.textContent === state.spotlightPlayer) {
        slot.classList.add('spotlight-active');
      }
    });
  }
}

// ===== 2. LEADERBOARD TABLE (6-10) =====

let leaderboardExpanded = false;
const LEADERBOARD_PAGE = 10; // extra rows per expansion

export function toggleLeaderboardExpand() {
  leaderboardExpanded = !leaderboardExpanded;
  buildLeaderboardTable();
}

export function buildLeaderboardTable() {
  const endIdx = leaderboardExpanded ? Math.min(5 + LEADERBOARD_PAGE * 2, state.byPoints.length) : 10;
  const rest = state.byPoints.slice(5, endIdx);
  const el = document.getElementById('leaderboard-table');

  el.innerHTML = rest.map((p, i) => `
    <div class="table-row clickable" onclick="openModal('${p.player}')">
      <span class="rank">${i + 6}</span>
      <span class="name">${p.player}</span>
      <span class="stat-val" style="color: var(--accent-gold);">${Math.round(p.total_points)}</span>
      <span class="stat-val" style="color: var(--text-secondary);">${p.wins}-${p.losses}</span>
      <span class="stat-val" style="color: var(--accent-cyan);">${p.ppt}</span>
    </div>`).join('');

  // Show more / Show less toggle
  if (state.byPoints.length > 10) {
    const label = leaderboardExpanded ? 'Show less' : `Show all ${state.byPoints.length} players`;
    el.insertAdjacentHTML('beforeend', `
      <div class="table-row leaderboard-toggle clickable" onclick="toggleLeaderboardExpand()">
        <span class="rank">${leaderboardExpanded ? '−' : '+'}</span>
        <span class="name" style="color: var(--text-muted); font-style: italic;">${label}</span>
        <span class="stat-val"></span><span class="stat-val"></span><span class="stat-val"></span>
      </div>`);
  }

  // Spotlight: highlight or inject
  if (state.spotlightPlayer) {
    const inVisible = state.byPoints.slice(0, endIdx).some(p => p.player === state.spotlightPlayer);
    if (inVisible) {
      el.querySelectorAll('.table-row:not(.leaderboard-toggle)').forEach(row => {
        if (row.querySelector('.name')?.textContent === state.spotlightPlayer) {
          row.classList.add('spotlight-active');
        }
      });
    } else {
      const idx = state.byPoints.findIndex(p => p.player === state.spotlightPlayer);
      if (idx !== -1) {
        const p = state.byPoints[idx];
        const escaped = p.player.replace(/'/g, "\\'");
        // Insert before the toggle button
        const toggle = el.querySelector('.leaderboard-toggle');
        const html = `
          <div class="table-row clickable spotlight-injected" onclick="openModal('${escaped}')">
            <span class="rank">${idx + 1}</span>
            <span class="name">${p.player}</span>
            <span class="stat-val" style="color: var(--accent-gold);">${Math.round(p.total_points)}</span>
            <span class="stat-val" style="color: var(--text-secondary);">${p.wins}-${p.losses}</span>
            <span class="stat-val" style="color: var(--accent-cyan);">${p.ppt}</span>
          </div>`;
        if (toggle) {
          toggle.insertAdjacentHTML('beforebegin', html);
        } else {
          el.insertAdjacentHTML('beforeend', html);
        }
      }
    }
  }
}

// ===== 3. POINTS BREAKDOWN CHART =====

let breakdownChartInstance = null;

/**
 * Derive the 3-way points split for a player:
 * - Match Wins (1 pt each)
 * - Tournament Wins (4 pts each — the tournament champion)
 * - Tournament Advancements (2 pts each — semifinalist / consolation winner)
 */
export function getBreakdownData(p) {
  // New parser data has explicit fields
  if (p.tournament_win_pts != null && (p.tournament_win_pts > 0 || p.advancement_pts > 0)) {
    return { wins: p.wins, tournamentWins: p.tournament_win_pts, advancements: p.advancement_pts || 0 };
  }

  const placingPts = p.placing_pts || 0;
  const placedCount = p.placed_count || 0;

  // Derive from placed_count: each placement is either 4 (win) or 2 (advancement)
  if (placedCount > 0 && placingPts > 0) {
    const twCount = Math.max(0, Math.round((placingPts - 2 * placedCount) / 2));
    const twPts = twCount * 4;
    const advPts = Math.max(0, placingPts - twPts);
    return { wins: p.wins, tournamentWins: twPts, advancements: advPts };
  }

  // Fallback for year-filtered legacy data: use all-time ratio
  if (placingPts > 0) {
    const allTimePlayer = state.DATA.players.find(ap => ap.player === p.player);
    if (allTimePlayer && allTimePlayer.placed_count > 0 && allTimePlayer.placing_pts > 0) {
      const atTwCount = Math.max(0, Math.round((allTimePlayer.placing_pts - 2 * allTimePlayer.placed_count) / 2));
      const twRatio = (atTwCount * 4) / allTimePlayer.placing_pts;
      const twPts = Math.round(placingPts * twRatio);
      const advPts = placingPts - twPts;
      return { wins: p.wins, tournamentWins: twPts, advancements: advPts };
    }
  }

  return { wins: p.wins, tournamentWins: 0, advancements: 0 };
}

export function buildPointsBreakdown() {
  if (breakdownChartInstance) {
    breakdownChartInstance.destroy();
    breakdownChartInstance = null;
  }

  // Spotlight: auto-add to breakdown selection
  if (state.spotlightPlayer && state.players.some(p => p.player === state.spotlightPlayer)) {
    if (!state.breakdownSelected) state.breakdownSelected = new Set(state.byPoints.slice(0, 10).map(p => p.player));
    state.breakdownSelected.add(state.spotlightPlayer);
  }

  // Initialize selected players: restore from storage or default to top 10
  if (!state.breakdownSelected) {
    state.breakdownSelected = loadSelectedPlayers('bgclub-breakdown-players')
      || new Set(state.byPoints.slice(0, 10).map(p => p.player));
  }

  const selected = [...state.breakdownSelected]
    .map(name => state.players.find(p => p.player === name))
    .filter(Boolean)
    .sort((a, b) => b.total_points - a.total_points);

  if (!selected.length) return;

  // Adjust chart height based on player count
  const container = document.getElementById('pointsBreakdownChart').parentElement;
  container.style.minHeight = Math.max(400, selected.length * 36) + 'px';

  // Spotlight: per-bar highlighting
  const spIdx = state.spotlightPlayer
    ? selected.findIndex(p => p.player === state.spotlightPlayer) : -1;
  const spBorder = selected.map((_, i) => i === spIdx ? COLORS.gold : 'transparent');
  const spBorderW = selected.map((_, i) => i === spIdx ? 2.5 : 0);

  breakdownChartInstance = new Chart(document.getElementById('pointsBreakdownChart'), {
    type: 'bar',
    data: {
      labels: selected.map(p => firstName(p.player)),
      datasets: [
        {
          label: 'Match Wins',
          data: selected.map(p => p.wins),
          backgroundColor: COLORS.blue + 'cc',
          borderColor: spBorder,
          borderWidth: spBorderW,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Tourn. Wins',
          data: selected.map(p => getBreakdownData(p).tournamentWins),
          backgroundColor: COLORS.gold + 'cc',
          borderColor: spBorder,
          borderWidth: spBorderW,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Advancements',
          data: selected.map(p => getBreakdownData(p).advancements),
          backgroundColor: COLORS.emerald + 'cc',
          borderColor: spBorder,
          borderWidth: spBorderW,
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const idx = ctx[0].dataIndex;
              const p = selected[idx];
              return `Total: ${Math.round(p.total_points)} pts`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: 'Points' }
        },
        y: {
          stacked: true,
          ticks: { font: { weight: '500' } }
        }
      }
    }
  });

  renderBreakdownChips();
}

function renderBreakdownChips() {
  const container = document.getElementById('breakdown-chips');
  if (!container || !state.breakdownSelected) return;

  container.innerHTML = [...state.breakdownSelected]
    .map(name => state.players.find(p => p.player === name))
    .filter(Boolean)
    .sort((a, b) => b.total_points - a.total_points)
    .map((p, i) => {
      const color = (p.player === state.spotlightPlayer) ? COLORS.gold : PALETTE[i % PALETTE.length];
      const escaped = p.player.replace(/'/g, "\\'");
      return `<span class="cumulative-chip" style="border-color: ${color}; color: ${color};">
        ${firstName(p.player)}
        <span class="cumulative-chip-x" onclick="removeBreakdownPlayer('${escaped}')">&times;</span>
      </span>`;
    }).join('');
}

export function addBreakdownPlayer(name) {
  if (!state.breakdownSelected) state.breakdownSelected = new Set();
  state.breakdownSelected.add(name);
  saveSelectedPlayers('bgclub-breakdown-players', state.breakdownSelected);
  buildPointsBreakdown();
}

export function removeBreakdownPlayer(name) {
  if (state.breakdownSelected) {
    state.breakdownSelected.delete(name);
    saveSelectedPlayers('bgclub-breakdown-players', state.breakdownSelected);
    buildPointsBreakdown();
  }
}

export function initBreakdownSearch() {
  const input = document.getElementById('breakdown-search');
  const dropdown = document.getElementById('breakdown-dropdown');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const matches = state.players
      .filter(p => p.player.toLowerCase().includes(query) && !state.breakdownSelected?.has(p.player))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = matches.map(p =>
      `<div class="cumulative-dropdown-item" data-name="${p.player}">${p.player} (${Math.round(p.total_points)} pts)</div>`
    ).join('');
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.cumulative-dropdown-item').forEach(el => {
      el.addEventListener('click', () => {
        addBreakdownPlayer(el.dataset.name);
        input.value = '';
        dropdown.style.display = 'none';
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#breakdown-search') && !e.target.closest('#breakdown-dropdown')) {
      dropdown.style.display = 'none';
    }
  });
}

// ===== 4. MINI BOARDS =====

function buildMiniBoard(elId, data, valFn, subFn, color, count = 10) {
  const el = document.getElementById(elId);
  const dark = isDark();
  const rankColors = [
    'light-dark(rgba(217,119,6,0.2), rgba(245,158,11,0.2))',
    'light-dark(rgba(100,116,139,0.15), rgba(148,163,184,0.15))',
    'light-dark(rgba(180,83,9,0.15), rgba(217,119,6,0.15))',
    dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'];

  const items = data.slice(0, count);
  const sp = state.spotlightPlayer;
  const spInList = sp ? items.findIndex(p => p.player === sp) : -1;
  // Find spotlight player in full array if not in top N
  const spFullIdx = (sp && spInList === -1) ? data.findIndex(p => p.player === sp) : -1;

  let html = items.map((p, i) => {
    const highlight = (p.player === sp) ? ' spotlight-active' : '';
    return `
    <li class="clickable${highlight}" onclick="openModal('${p.player}')">
      <div class="mini-left">
        <span class="mini-rank" style="background: ${rankColors[i] || rankColors[4]}; color: ${i < 3 ? color : 'var(--text-muted)'};">${i + 1}</span>
        <span class="mini-name">${p.player}</span>
      </div>
      <div class="mini-right">
        <span class="mini-val" style="color: ${color};">${valFn(p)}</span>
        <span class="mini-sub">${subFn(p)}</span>
      </div>
    </li>`;
  }).join('');

  // Inject spotlight player at bottom if not already in list
  if (spFullIdx !== -1) {
    const p = data[spFullIdx];
    html += `
    <li class="clickable spotlight-injected" onclick="openModal('${p.player}')">
      <div class="mini-left">
        <span class="mini-rank" style="background: light-dark(rgba(217,119,6,0.15), rgba(245,158,11,0.15)); color: var(--accent-gold);">${spFullIdx + 1}</span>
        <span class="mini-name">${p.player}</span>
      </div>
      <div class="mini-right">
        <span class="mini-val" style="color: ${color};">${valFn(p)}</span>
        <span class="mini-sub">${subFn(p)}</span>
      </div>
    </li>`;
  }

  el.innerHTML = html;
}

export function buildAllMiniBoards() {
  buildMiniBoard('board-winrate', state.byWinPct,
    p => p.win_pct + '%',
    p => `${p.wins}W/${p.losses}L`,
    'var(--accent-emerald)'
  );
  buildMiniBoard('board-ppt', state.byPPT,
    p => p.ppt.toFixed(2),
    p => `${p.tournaments} tourn.`,
    'var(--accent-cyan)'
  );
  buildMiniBoard('board-placed', state.byPlaced,
    p => p.placed_pct + '%',
    p => `${p.placed_count}/${p.tournaments}`,
    'var(--accent-purple)'
  );
  buildMiniBoard('board-attendance', state.byAttendance,
    p => p.tournaments.toString(),
    p => `${p.participation_pct}%`,
    'var(--accent-orange)',
    10
  );
  // Update min-tournament notes
  const minT = state.minTournaments;
  document.querySelectorAll('.mini-board-note').forEach(el => {
    el.textContent = `Min. ${minT} tournament${minT !== 1 ? 's' : ''}`;
  });
}

// ===== 5. CUMULATIVE CHART =====

function getCumulativeData(name) {
  // Use precomputed data if available
  if (state.DATA.cumulative[name]) {
    return state.DATA.cumulative[name].map(s => s.cumulative);
  }
  // Compute from yearly_performance
  const yp = state.DATA.yearly_performance?.[name];
  if (!yp) return null;
  let running = 0;
  return state.DATA.years.map(year => {
    const yearData = yp.find(y => y.year === year);
    running += yearData ? (yearData.points || 0) : 0;
    return running;
  });
}

export function buildCumulativeChart() {
  if (cumulativeChartInstance) {
    cumulativeChartInstance.destroy();
    cumulativeChartInstance = null;
  }

  const years = state.DATA.years;

  // Initialize selected players: restore from storage or default to top 10
  if (!state.cumulativeSelected) {
    state.cumulativeSelected = loadSelectedPlayers('bgclub-cumulative-players');
    if (!state.cumulativeSelected) {
      const top10 = [...state.DATA.players]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 10)
        .map(p => p.player);
      state.cumulativeSelected = new Set(top10);
    }
  }

  // Spotlight: auto-add to cumulative selection (after init so set exists)
  if (state.spotlightPlayer && state.cumulativeSelected) {
    state.cumulativeSelected.add(state.spotlightPlayer);
  }

  // Detect if the last year in the dataset is the current (incomplete) year
  const currentYear = String(new Date().getFullYear());
  const lastYearIsPartial = years.length > 0 && years[years.length - 1] === currentYear;
  // Index of the last complete year (the segment *to* this index is the last solid one)
  const lastCompleteIdx = lastYearIsPartial ? years.length - 2 : years.length - 1;

  const datasets = [...state.cumulativeSelected].map((name, i) => {
    const rawData = getCumulativeData(name);
    if (!rawData) return null;

    // Skip dots where player earned 0 points that year
    const data = rawData.map((cumVal, idx) => {
      const prev = idx > 0 ? rawData[idx - 1] : 0;
      return (cumVal - prev) === 0 ? null : cumVal;
    });

    const isSp = name === state.spotlightPlayer;
    const color = isSp ? COLORS.gold : PALETTE[i % PALETTE.length];
    const bw = isSp ? 4 : 2.5;
    const pr = isSp ? 6 : 4;
    return {
      label: firstName(name),
      data,
      borderColor: color,
      backgroundColor: color + '15',
      borderWidth: bw,
      pointRadius: data.map((_, idx) => idx === years.length - 1 && lastYearIsPartial ? pr + 1 : pr),
      pointHoverRadius: isSp ? 9 : 7,
      pointBackgroundColor: data.map((_, idx) =>
        idx === years.length - 1 && lastYearIsPartial ? 'transparent' : color
      ),
      pointBorderWidth: data.map((_, idx) =>
        idx === years.length - 1 && lastYearIsPartial ? 2 : 0
      ),
      pointBorderColor: color,
      tension: 0.3,
      fill: false,
      spanGaps: true,
      order: isSp ? 0 : 1, // draw spotlight on top
      // Dash the line segment leading into the current (incomplete) year
      segment: lastYearIsPartial ? {
        borderDash: ctx => ctx.p1DataIndex >= lastCompleteIdx + 1 ? [6, 4] : [],
        borderWidth: ctx => ctx.p1DataIndex >= lastCompleteIdx + 1 ? bw * 0.8 : bw,
      } : undefined,
    };
  }).filter(Boolean);

  cumulativeChartInstance = new Chart(document.getElementById('cumulativeChart'), {
    type: 'line',
    data: {
      labels: years.map(y => y === currentYear && lastYearIsPartial ? `${y}*` : y),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            title: items => {
              const label = items[0]?.label || '';
              return label.endsWith('*') ? `${label.replace('*', '')} (year in progress)` : label;
            }
          }
        }
      },
      scales: {
        y: { title: { display: true, text: 'Cumulative Points' } }
      }
    }
  });

  renderCumulativeChips();
}

function renderCumulativeChips() {
  const container = document.getElementById('cumulative-chips');
  if (!container || !state.cumulativeSelected) return;

  container.innerHTML = [...state.cumulativeSelected].map((name, i) => {
    const color = (name === state.spotlightPlayer) ? COLORS.gold : PALETTE[i % PALETTE.length];
    const escaped = name.replace(/'/g, "\\'");
    return `<span class="cumulative-chip" style="border-color: ${color}; color: ${color};">
      ${firstName(name)}
      <span class="cumulative-chip-x" onclick="removeCumulativePlayer('${escaped}')">&times;</span>
    </span>`;
  }).join('');
}

export function addCumulativePlayer(name) {
  if (!state.cumulativeSelected) state.cumulativeSelected = new Set();
  state.cumulativeSelected.add(name);
  saveSelectedPlayers('bgclub-cumulative-players', state.cumulativeSelected);
  buildCumulativeChart();
}

export function removeCumulativePlayer(name) {
  if (state.cumulativeSelected) {
    state.cumulativeSelected.delete(name);
    saveSelectedPlayers('bgclub-cumulative-players', state.cumulativeSelected);
    buildCumulativeChart();
  }
}

export function initCumulativeSearch() {
  const input = document.getElementById('cumulative-search');
  const dropdown = document.getElementById('cumulative-dropdown');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    // Search across yearly_performance (has per-year data needed for cumulative lines)
    const available = Object.keys(state.DATA.yearly_performance || state.DATA.cumulative || {});
    const matches = available
      .filter(name => name.toLowerCase().includes(query) && !state.cumulativeSelected?.has(name))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = matches.map(name =>
      `<div class="cumulative-dropdown-item" data-name="${name}">${name}</div>`
    ).join('');
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.cumulative-dropdown-item').forEach(el => {
      el.addEventListener('click', () => {
        addCumulativePlayer(el.dataset.name);
        input.value = '';
        dropdown.style.display = 'none';
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cumulative-search-wrap')) {
      dropdown.style.display = 'none';
    }
  });
}

// ===== 6. ATTENDANCE CHART =====

export function buildAttendanceChart() {
  const allDates = Object.keys(state.DATA.attendance).sort();
  // Filter by selected years if active
  const dates = state.selectedYears
    ? allDates.filter(d => state.selectedYears.has(d.slice(0, 4)))
    : allDates;
  const values = dates.map(d => state.DATA.attendance[d]);

  // Group by quarter for cleaner view
  const quarterData = {};
  dates.forEach((d, i) => {
    const [y, m] = d.split('-');
    const q = `${y} Q${Math.ceil(parseInt(m) / 3)}`;
    if (!quarterData[q]) quarterData[q] = [];
    quarterData[q].push(values[i]);
  });

  const quarterLabels = Object.keys(quarterData);
  const quarterAvg = quarterLabels.map(q => {
    const vals = quarterData[q];
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  });

  new Chart(document.getElementById('attendanceChart'), {
    type: 'bar',
    data: {
      labels: quarterLabels,
      datasets: [
        {
          label: 'Avg Players/Week',
          data: quarterAvg,
          backgroundColor: quarterLabels.map(q => {
            const yr = parseInt(q);
            const colors = { 2017: COLORS.blue, 2018: COLORS.cyan, 2019: COLORS.emerald, 2020: COLORS.rose, 2021: COLORS.purple, 2022: COLORS.orange, 2023: COLORS.gold, 2024: COLORS.lime, 2025: COLORS.pink, 2026: COLORS.teal };
            return (colors[yr] || COLORS.blue) + '99';
          }),
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Avg: ${ctx.raw} players/week`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Players per Week' }
        },
        x: {
          ticks: { maxRotation: 45, font: { size: 9 } }
        }
      }
    }
  });
}

// ===== 7. YEARLY TOP 5 TABLE =====

export function buildYearlyPoints() {
  const yp = state.DATA.yearly_performance;
  const years = state.DATA.years;
  const container = document.getElementById('yearlyPointsTable');
  if (!container) return;

  // Pass 1: compute top 5 per year and total appearances per player
  const totals = {};     // player -> total top-5 appearances across all years
  const yearData = years.map(year => {
    const players = [];
    for (const [name, data] of Object.entries(yp)) {
      const yd = data.find(y => y.year === year);
      if (yd && yd.tournaments > 0) {
        players.push({ name, points: yd.points });
      }
    }
    players.sort((a, b) => b.points - a.points);
    const top5 = players.slice(0, 5);
    top5.forEach(p => { totals[p.name] = (totals[p.name] || 0) + 1; });
    return { year, top5 };
  });

  // Assign unique colors via golden-angle HSL spacing
  const playerColors = {};
  let colorIdx = 0;
  for (const { top5 } of yearData) {
    for (const p of top5) {
      if (!(p.name in playerColors)) {
        const hue = (colorIdx * 137.508) % 360;
        playerColors[p.name] = `hsl(${hue.toFixed(0)}, 60%, 55%)`;
        colorIdx++;
      }
    }
  }

  // Pass 2: build table with running counts as (N/total)
  const running = {};
  const ranks = ['1st', '2nd', '3rd', '4th', '5th'];
  let html = '<table class="yearly-top5"><thead><tr><th class="yt5-year">Year</th>';
  ranks.forEach(r => { html += `<th>${r}</th>`; });
  html += '</tr></thead><tbody>';

  const currentYear = new Date().getFullYear().toString();
  for (const { year, top5 } of yearData) {
    if (year === currentYear) {
      html += `<tr class="yt5-separator"><td colspan="${ranks.length + 1}"></td></tr>`;
    }
    html += `<tr><td class="yt5-year">${year}</td>`;
    for (let i = 0; i < 5; i++) {
      const p = top5[i];
      if (p) {
        running[p.name] = (running[p.name] || 0) + 1;
        const color = playerColors[p.name];
        html += `<td class="yt5-player" style="--pc: ${color}">`;
        html += `<span class="yt5-name">${firstName(p.name)}</span>`;
        html += `<span class="yt5-meta">(${running[p.name]}/${totals[p.name]}) &middot; ${p.points} pts</span>`;
        html += '</td>';
      } else {
        html += '<td></td>';
      }
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  // Spotlight: highlight cells matching the spotlight player
  if (state.spotlightPlayer) {
    const target = firstName(state.spotlightPlayer);
    container.querySelectorAll('.yt5-name').forEach(el => {
      if (el.textContent === target) {
        el.closest('.yt5-player')?.classList.add('spotlight-active');
      }
    });
  }
}

// ===== 10. CLUB YEARLY OVERVIEW =====

export function buildYearlyOverview() {
  const years = state.DATA.years;
  const currentYear = String(new Date().getFullYear());
  const lastYearIsPartial = years.length > 0 && years[years.length - 1] === currentYear;
  const lastCompleteIdx = lastYearIsPartial ? years.length - 2 : years.length - 1;

  const yearlyStats = years.map(y => {
    const yearDates = Object.keys(state.DATA.attendance).filter(d => d.startsWith(y));
    return { year: y, tournaments: yearDates.length };
  });

  const datasets = [
    {
      label: 'Tournaments',
      data: yearlyStats.map(y => y.tournaments),
      backgroundColor: yearlyStats.map((_, i) =>
        lastYearIsPartial && i === years.length - 1 ? COLORS.blue + '55' : COLORS.blue + 'bb'
      ),
      borderRadius: 4,
      borderSkipped: false,
      yAxisID: 'y',
    }
  ];

  const hasUnique = state.DATA.unique_players_per_year;
  if (hasUnique) {
    const lineData = years.map(y => hasUnique[y] || 0);
    datasets.push({
      label: 'Unique Players',
      data: lineData,
      type: 'line',
      borderColor: COLORS.emerald,
      backgroundColor: COLORS.emerald + '22',
      borderWidth: 2.5,
      pointRadius: lineData.map((_, i) => lastYearIsPartial && i === years.length - 1 ? 6 : 5),
      pointBackgroundColor: lineData.map((_, i) =>
        lastYearIsPartial && i === years.length - 1 ? 'transparent' : COLORS.emerald
      ),
      pointBorderWidth: lineData.map((_, i) =>
        lastYearIsPartial && i === years.length - 1 ? 2 : 0
      ),
      pointBorderColor: COLORS.emerald,
      tension: 0.3,
      yAxisID: 'y1',
      fill: true,
      segment: lastYearIsPartial ? {
        borderDash: ctx => ctx.p1DataIndex >= lastCompleteIdx + 1 ? [6, 4] : [],
        borderWidth: ctx => ctx.p1DataIndex >= lastCompleteIdx + 1 ? 2 : 2.5,
      } : undefined,
    });
  }

  const scales = {
    y: {
      position: 'left',
      title: { display: true, text: 'Tournaments' },
      beginAtZero: true,
    }
  };
  if (hasUnique) {
    scales.y1 = {
      position: 'right',
      title: { display: true, text: 'Unique Players' },
      beginAtZero: true,
      grid: { drawOnChartArea: false },
    };
  }

  new Chart(document.getElementById('yearlyOverviewChart'), {
    type: 'bar',
    data: { labels: years.map(y => y === currentYear && lastYearIsPartial ? `${y}*` : y), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: !!hasUnique, position: 'bottom', labels: { padding: 12 } },
        tooltip: {
          callbacks: {
            title: items => {
              const label = items[0]?.label || '';
              return label.endsWith('*') ? `${label.replace('*', '')} (year in progress)` : label;
            }
          }
        }
      },
      scales
    }
  });
}

// ===== 11. WIN vs LOSS CHART =====

export function buildWinLossChart() {
  let entries = state.byPoints.slice(0, 10);
  let spotlightIdx = -1;

  if (state.spotlightPlayer) {
    spotlightIdx = entries.findIndex(p => p.player === state.spotlightPlayer);
    if (spotlightIdx === -1) {
      const sp = state.byPoints.find(p => p.player === state.spotlightPlayer);
      if (sp) {
        entries = [...entries, sp];
        spotlightIdx = entries.length - 1;
      }
    }
  }

  const winBg = entries.map((_, i) =>
    i === spotlightIdx ? COLORS.gold + 'cc' : COLORS.emerald + 'cc');
  const lossBg = entries.map((_, i) =>
    i === spotlightIdx ? COLORS.gold + '66' : COLORS.rose + '99');
  const borderCol = entries.map((_, i) =>
    i === spotlightIdx ? COLORS.gold : 'transparent');
  const borderW = entries.map((_, i) =>
    i === spotlightIdx ? 2 : 0);

  new Chart(document.getElementById('winLossChart'), {
    type: 'bar',
    data: {
      labels: entries.map((p, i) => {
        const label = firstName(p.player);
        if (i === spotlightIdx && i >= 10) {
          const rank = state.byPoints.indexOf(p) + 1;
          return `#${rank} ${label}`;
        }
        return label;
      }),
      datasets: [
        {
          label: 'Wins',
          data: entries.map(p => p.wins),
          backgroundColor: winBg,
          borderColor: borderCol,
          borderWidth: borderW,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Losses',
          data: entries.map(p => -p.losses),
          backgroundColor: lossBg,
          borderColor: borderCol,
          borderWidth: borderW,
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Math.abs(ctx.raw);
              return `${ctx.dataset.label}: ${val}`;
            },
            afterBody: (ctx) => {
              const idx = ctx[0].dataIndex;
              const p = entries[idx];
              return `Win Rate: ${p.win_pct}%`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          ticks: {
            callback: v => Math.abs(v)
          },
          title: { display: true, text: 'Matches' }
        }
      }
    }
  });
}

// ===== 12. WIN % TREND CHART =====

/** Compute rolling win% using a match-based window */
function computeRollingWinPct(history, matchWindow) {
  if (!history || history.length === 0) return [];
  return history.map((t, i) => {
    let totalWins = 0, totalLosses = 0;
    for (let j = i; j >= 0; j--) {
      totalWins += history[j].wins;
      totalLosses += history[j].losses;
      if (totalWins + totalLosses >= matchWindow) break;
    }
    const totalMatches = totalWins + totalLosses;
    if (totalMatches === 0) return null;
    return { x: t.date, y: +((totalWins / totalMatches) * 100).toFixed(1) };
  }).filter(Boolean);
}

/** Fallback: yearly win % when tournament_history is unavailable */
function getYearlyWinPctData(name) {
  const yp = state.DATA.yearly_performance?.[name];
  if (!yp) return null;
  return yp.filter(y => y.tournaments > 0).map(y => ({ x: y.year, y: y.win_pct }));
}

function hasTournamentHistory() {
  return state.DATA.tournament_history && Object.keys(state.DATA.tournament_history).length > 0;
}

export function buildTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  const windowSize = state.trendWindowSize || 50;
  const hasHistory = hasTournamentHistory();

  // Show/hide slider and fallback note
  const sliderWrap = document.getElementById('trend-slider-wrap');
  const fallbackNote = document.getElementById('trend-fallback-note');
  if (sliderWrap) sliderWrap.style.display = hasHistory ? 'flex' : 'none';
  if (fallbackNote) fallbackNote.style.display = hasHistory ? 'none' : 'block';

  // Initialize selection: restore from storage or default to top 5 by win%
  if (!state.trendSelected) {
    state.trendSelected = loadSelectedPlayers('bgclub-trend-players');
    if (!state.trendSelected) {
      const top5 = (state.byWinPct || []).slice(0, 5).map(p => p.player);
      state.trendSelected = new Set(top5);
    }
  }

  // Spotlight: auto-add to trend selection (after init so set exists)
  if (state.spotlightPlayer && state.trendSelected) {
    state.trendSelected.add(state.spotlightPlayer);
  }

  const datasets = [...state.trendSelected].map((name, i) => {
    let data;
    if (hasHistory && state.DATA.tournament_history[name]) {
      data = computeRollingWinPct(state.DATA.tournament_history[name], windowSize);
    } else {
      data = getYearlyWinPctData(name);
    }
    if (!data || data.length === 0) return null;

    const isSp = name === state.spotlightPlayer;
    const color = isSp ? COLORS.gold : PALETTE[i % PALETTE.length];
    return {
      label: firstName(name),
      data,
      borderColor: color,
      backgroundColor: color + '15',
      borderWidth: isSp ? 4 : 2.5,
      pointRadius: isSp ? (hasHistory ? 4 : 6) : (hasHistory ? 2 : 4),
      pointHoverRadius: isSp ? 8 : 6,
      pointBackgroundColor: color,
      tension: 0.3,
      fill: false,
      order: isSp ? 0 : 1,
    };
  }).filter(Boolean);

  const xScale = hasHistory
    ? { type: 'time', time: { unit: 'quarter', displayFormats: { quarter: 'MMM yyyy' } }, title: { display: true, text: 'Tournament Date' } }
    : { type: 'category', title: { display: true, text: 'Year' } };

  trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              const raw = items[0].raw?.x;
              if (raw instanceof Date || (typeof raw === 'string' && raw.includes('-'))) {
                return new Date(raw).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
              }
              return String(raw);
            },
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: xScale,
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Win %' }
        }
      }
    }
  });

  renderTrendChips();
}

function renderTrendChips() {
  const container = document.getElementById('trend-chips');
  if (!container || !state.trendSelected) return;

  container.innerHTML = [...state.trendSelected].map((name, i) => {
    const color = (name === state.spotlightPlayer) ? COLORS.gold : PALETTE[i % PALETTE.length];
    const escaped = name.replace(/'/g, "\\'");
    return `<span class="cumulative-chip" style="border-color: ${color}; color: ${color};">
      ${firstName(name)}
      <span class="cumulative-chip-x" onclick="removeTrendPlayer('${escaped}')">&times;</span>
    </span>`;
  }).join('');
}

export function addTrendPlayer(name) {
  if (!state.trendSelected) state.trendSelected = new Set();
  state.trendSelected.add(name);
  saveSelectedPlayers('bgclub-trend-players', state.trendSelected);
  buildTrendChart();
}

export function removeTrendPlayer(name) {
  if (state.trendSelected) {
    state.trendSelected.delete(name);
    saveSelectedPlayers('bgclub-trend-players', state.trendSelected);
    buildTrendChart();
  }
}

export function initTrendSearch() {
  const input = document.getElementById('trend-search');
  const dropdown = document.getElementById('trend-dropdown');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const matches = state.players
      .filter(p => p.player.toLowerCase().includes(query) && !state.trendSelected?.has(p.player))
      .sort((a, b) => b.win_pct - a.win_pct)
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = matches.map(p =>
      `<div class="cumulative-dropdown-item" data-name="${p.player}">${p.player} (${p.win_pct}%)</div>`
    ).join('');
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.cumulative-dropdown-item').forEach(el => {
      el.addEventListener('click', () => {
        addTrendPlayer(el.dataset.name);
        input.value = '';
        dropdown.style.display = 'none';
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#trend-search') && !e.target.closest('#trend-dropdown')) {
      dropdown.style.display = 'none';
    }
  });
}

export function onTrendWindowChange(value) {
  state.trendWindowSize = parseInt(value) || 50;
  const valueEl = document.getElementById('trend-slider-value');
  if (valueEl) valueEl.textContent = state.trendWindowSize;
  buildTrendChart();
}
