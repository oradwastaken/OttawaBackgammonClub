import { state } from './state.js';
import { loadData, deriveData, updateDataSourceInfo } from './data.js';
import { restoreTheme, applyChartDefaults, isDark } from './theme.js';
import { rebuildCharts, rebuildAll, buildPodium, buildLeaderboardTable, buildPointsBreakdown,
         buildAllMiniBoards, buildCumulativeChart, buildAttendanceChart, buildWinRateDistribution,
         buildPPTDistribution, buildYearlyPoints, buildYearlyOverview, buildWinLossChart,
         buildRadarFilters, updateRadar, toggleRadarPlayer, animateNumber } from './charts.js';
import { openModal, closeModal } from './modal.js';
import { openUploadModal, closeUploadModal, handleFileUpload, applyUploadedData } from './upload.js';
import { publishToGitHub, toggleGitHubSettings, saveGitHubSettings } from './github.js';

// Expose functions to HTML onclick handlers
Object.assign(window, {
  openModal, closeModal,
  openUploadModal, closeUploadModal,
  handleFileUpload, applyUploadedData,
  publishToGitHub, toggleGitHubSettings, saveGitHubSettings,
  toggleRadarPlayer,
});

// Theme toggle (wired here to avoid circular deps between theme.js and charts.js)
function toggleTheme() {
  const goLight = isDark();
  document.documentElement.style.colorScheme = goLight ? 'light' : 'dark';
  document.getElementById('themeToggle').innerHTML = goLight ? '&#9728;' : '&#9790;';
  localStorage.setItem('theme', goLight ? 'light' : 'dark');
  rebuildCharts();
}
window.toggleTheme = toggleTheme;

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
  deriveData();

  restoreTheme();
  applyChartDefaults();
  buildPodium();
  buildLeaderboardTable();
  buildPointsBreakdown();
  buildAllMiniBoards();
  buildCumulativeChart();
  buildAttendanceChart();
  buildWinRateDistribution();
  buildPPTDistribution();
  buildYearlyPoints();
  buildYearlyOverview();
  buildWinLossChart();
  buildRadarFilters();
  updateRadar();
  updateDataSourceInfo();

  // Animate summary numbers
  const totalGames = state.players.reduce((s, p) => s + p.total_games, 0);
  animateNumber(document.getElementById('stat-tournaments'), state.DATA.total_tournaments);
  animateNumber(document.getElementById('stat-players'), state.DATA.players.length);
  animateNumber(document.getElementById('stat-games'), totalGames);
  animateNumber(document.getElementById('stat-years'), state.DATA.years.length);

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
