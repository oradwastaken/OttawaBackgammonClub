import { state } from './state.js';
import { loadData, applyFilters, deriveData, getFilteredTournamentCount, updateDataSourceInfo } from './data.js';
import { restoreTheme, applyChartDefaults, isDark } from './theme.js';
import { rebuildCharts, rebuildAll, buildPodium, buildLeaderboardTable, buildPointsBreakdown,
         buildAllMiniBoards, buildCumulativeChart, buildAttendanceChart,
         buildYearlyPoints, buildYearlyOverview, buildWinLossChart,
         animateNumber, getFilterLabel,
         initCumulativeSearch, removeCumulativePlayer,
         initBreakdownSearch, removeBreakdownPlayer,
         buildTrendChart, initTrendSearch, removeTrendPlayer, onTrendWindowChange } from './charts.js';
import { openModal, closeModal, onModalTrendSlider, onModalYearToggle, onModalYearsExpand, onModalYearsCollapse } from './modal.js';
import { openUploadModal, closeUploadModal, handleFileUpload, applyUploadedData } from './upload.js';
import { publishToGitHub, toggleGitHubSettings, saveGitHubSettings } from './github.js';
import { initSpotlightSearch, restoreSpotlight, renderSpotlightCard } from './spotlight.js';

// Expose functions to HTML onclick handlers
Object.assign(window, {
  openModal, closeModal,
  openUploadModal, closeUploadModal,
  handleFileUpload, applyUploadedData,
  publishToGitHub, toggleGitHubSettings, saveGitHubSettings,
  removeCumulativePlayer,
  removeBreakdownPlayer,
  removeTrendPlayer,
  onTrendWindowChange,
  onModalTrendSlider,
  onModalYearToggle,
  onModalYearsExpand,
  onModalYearsCollapse,
});

// Spotlight: open player modal for the spotlighted player
function openSpotlightModal() {
  if (state.spotlightPlayer) openModal(state.spotlightPlayer);
}
window.openSpotlightModal = openSpotlightModal;

// Theme toggle (wired here to avoid circular deps between theme.js and charts.js)
function toggleTheme() {
  const goLight = isDark();
  document.documentElement.style.colorScheme = goLight ? 'light' : 'dark';
  document.getElementById('themeToggle').innerHTML = goLight ? '&#9728;' : '&#9790;';
  localStorage.setItem('theme', goLight ? 'light' : 'dark');
  rebuildCharts();
}
window.toggleTheme = toggleTheme;

// ===== FILTER BAR =====

const VISIBLE_YEARS = 4; // Show last N years by default
let yearPillsExpanded = false;

function buildYearPills() {
  const pillsEl = document.getElementById('year-pills');
  if (!pillsEl) return;
  const years = state.DATA.years;
  const isAllTime = !state.selectedYears;

  // Reverse: newest first
  const reversed = [...years].reverse();
  const visible = yearPillsExpanded ? reversed : reversed.slice(0, VISIBLE_YEARS);
  const hasMore = reversed.length > VISIBLE_YEARS;

  let html = visible.map(y =>
    `<button class="year-pill${!isAllTime && state.selectedYears && state.selectedYears.has(y) ? ' active' : ''}" data-year="${y}" onclick="onYearToggle('${y}')">${y}</button>`
  ).join('');

  if (hasMore && !yearPillsExpanded) {
    html += `<button class="year-pill year-pill-more" onclick="onExpandYears()">${reversed.length - VISIBLE_YEARS} more&hellip;</button>`;
  } else if (hasMore && yearPillsExpanded) {
    html += `<button class="year-pill year-pill-more" onclick="onCollapseYears()">less</button>`;
  }

  pillsEl.innerHTML = html;
  const allTimeBtn = document.getElementById('all-time-btn');
  if (allTimeBtn) allTimeBtn.classList.toggle('active', isAllTime);
}

window.buildYearPills = buildYearPills;

function initFilters() {
  // Default to latest year
  const years = state.DATA.years;
  const latestYear = years[years.length - 1];
  state.selectedYears = new Set([latestYear]);

  buildYearPills();
  updateFilterUI();
}

function updateFilterUI() {
  buildYearPills();

  // Update min-t slider
  const slider = document.getElementById('min-t-slider');
  const valueEl = document.getElementById('min-t-value');
  if (slider) slider.value = state.minTournaments;
  if (valueEl) valueEl.textContent = state.minTournaments;
}

function onYearToggle(year) {
  if (!state.selectedYears) {
    // Switching from All Time → single year
    state.selectedYears = new Set([year]);
  } else if (state.selectedYears.has(year)) {
    state.selectedYears.delete(year);
    if (state.selectedYears.size === 0) {
      // No years selected → go to All Time
      state.selectedYears = null;
    }
  } else {
    state.selectedYears.add(year);
  }
  updateFilterUI();
  rebuildAll();
}
window.onYearToggle = onYearToggle;

function onAllTimeToggle() {
  state.selectedYears = null;
  updateFilterUI();
  rebuildAll();
}

window.onAllTimeToggle = onAllTimeToggle;

function onExpandYears() {
  yearPillsExpanded = true;
  buildYearPills();
}
window.onExpandYears = onExpandYears;

function onCollapseYears() {
  yearPillsExpanded = false;
  buildYearPills();
}
window.onCollapseYears = onCollapseYears;

function onMinTChange(value) {
  state.minTournaments = parseInt(value) || 1;
  document.getElementById('min-t-value').textContent = state.minTournaments;
  deriveData();
  rebuildCharts();
  buildPodium();
  buildLeaderboardTable();
  // Update the min-tournament notes
  buildAllMiniBoards();
}
window.onMinTChange = onMinTChange;

// ===== INIT =====

async function init() {
  const loadingEl = document.getElementById('loading-overlay');
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    await loadData();
  } catch (e) {
    if (loadingEl) loadingEl.style.display = 'none';
    const errEl = document.getElementById('data-error');
    if (errEl) {
      errEl.style.display = 'flex';
      document.getElementById('data-error-msg').textContent = e.message;
    }
    return;
  }

  if (loadingEl) loadingEl.style.display = 'none';

  // Set up filters (defaults to latest year)
  initFilters();
  applyFilters();
  deriveData();

  restoreSpotlight();

  restoreTheme();
  applyChartDefaults();
  buildPodium();
  buildLeaderboardTable();
  buildPointsBreakdown();
  initBreakdownSearch();
  buildAllMiniBoards();
  buildCumulativeChart();
  initCumulativeSearch();
  buildAttendanceChart();
  buildYearlyPoints();
  buildYearlyOverview();
  buildWinLossChart();
  buildTrendChart();
  initTrendSearch();
  initSpotlightSearch(rebuildAll);
  renderSpotlightCard();
  updateDataSourceInfo();

  // Update leaderboard title
  const titleEl = document.getElementById('leaderboard-title');
  if (titleEl) {
    titleEl.innerHTML = `<span class="dot" style="background: var(--accent-gold);"></span> ${getFilterLabel()} Points Leaderboard`;
  }

  // Animate summary numbers
  const totalMatches = state.players.reduce((s, p) => s + p.total_matches, 0);
  animateNumber(document.getElementById('stat-tournaments'), getFilteredTournamentCount());
  animateNumber(document.getElementById('stat-players'), state.players.length);
  animateNumber(document.getElementById('stat-matches'), totalMatches);
  animateNumber(document.getElementById('stat-years'), state.selectedYears ? state.selectedYears.size : state.DATA.years.length);

  // Upload modal: drag-and-drop
  const dropZone = document.getElementById('upload-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
    });
  }

  // Modal close handlers
  document.getElementById('playerModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('uploadModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeUploadModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeUploadModal(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
