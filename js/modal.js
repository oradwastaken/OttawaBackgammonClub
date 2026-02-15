import { state, COLORS } from './state.js';

let modalChart = null;
let modalTrendChart = null;
let currentModalPlayer = null;
let modalSelectedYears = null; // null = all-time, Set of year strings = filtered
let modalYearsExpanded = false;
const MODAL_VISIBLE_YEARS = 4;

function getModalPlayer() {
  if (!currentModalPlayer) return null;

  // All-time: use unfiltered player data
  if (!modalSelectedYears) {
    return state.DATA.players.find(x => x.player === currentModalPlayer) || null;
  }

  // Filtered: compute from yearly_performance
  const yp = state.DATA.yearly_performance[currentModalPlayer];
  if (!yp) return null;

  const entries = yp.filter(y => modalSelectedYears.has(y.year));
  if (!entries.length) return null;

  const wins = entries.reduce((s, y) => s + y.wins, 0);
  const losses = entries.reduce((s, y) => s + y.losses, 0);
  const tournaments = entries.reduce((s, y) => s + y.tournaments, 0);
  if (tournaments === 0) return null;

  const placing_pts = entries.reduce((s, y) =>
    s + (y.placing_pts != null ? y.placing_pts : (y.points - y.wins)), 0);
  const placed_count = entries.reduce((s, y) =>
    s + (y.placed_count != null ? y.placed_count : 0), 0);
  const total_points = wins + placing_pts;
  const total_matches = wins + losses;
  const win_pct = total_matches > 0 ? +((wins / total_matches) * 100).toFixed(1) : 0;
  const ppt = tournaments > 0 ? +(total_points / tournaments).toFixed(2) : 0;
  const placed_pct = tournaments > 0 ? +((placed_count / tournaments) * 100).toFixed(1) : 0;

  return {
    player: currentModalPlayer, total_points, wins, losses, total_matches,
    win_pct, tournaments, ppt, placed_count, placed_pct, placing_pts
  };
}

function buildModalToggle() {
  const el = document.getElementById('modal-year-toggle');
  if (!el) return;

  const reversed = [...state.DATA.years].reverse();
  const hasMore = reversed.length > MODAL_VISIBLE_YEARS;
  const visible = modalYearsExpanded ? reversed : reversed.slice(0, MODAL_VISIBLE_YEARS);
  const isAllTime = !modalSelectedYears;

  let html = visible.map(y =>
    `<button class="modal-year-pill${!isAllTime && modalSelectedYears.has(y) ? ' active' : ''}" onclick="onModalYearToggle('${y}')">${y}</button>`
  ).join('');

  if (hasMore && !modalYearsExpanded) {
    html += `<button class="modal-year-pill year-pill-more" onclick="onModalYearsExpand()">${reversed.length - MODAL_VISIBLE_YEARS} more&hellip;</button>`;
  } else if (hasMore && modalYearsExpanded) {
    html += `<button class="modal-year-pill year-pill-more" onclick="onModalYearsCollapse()">less</button>`;
  }

  html += `<button class="modal-year-pill${isAllTime ? ' active' : ''}" onclick="onModalYearToggle('all')">All Time</button>`;

  el.style.display = 'flex';
  el.innerHTML = html;
}

function renderModalStats() {
  const p = getModalPlayer();
  if (!p) return;

  document.getElementById('modal-name').textContent = p.player;
  document.getElementById('modal-subtitle').textContent = `${p.tournaments} tournaments attended | ${p.total_matches} matches played`;

  document.getElementById('modal-stats').innerHTML = `
    <div class="modal-stat"><div class="ms-val" style="color: var(--accent-gold);">${Math.round(p.total_points)}</div><div class="ms-label">Total Points</div></div>
    <div class="modal-stat"><div class="ms-val" style="color: var(--accent-emerald);">${p.win_pct}%</div><div class="ms-label">Win Rate</div></div>
    <div class="modal-stat"><div class="ms-val" style="color: var(--accent-cyan);">${p.ppt}</div><div class="ms-label">Points/Tournament</div></div>
    <div class="modal-stat"><div class="ms-val" style="color: var(--accent-blue);">${p.wins}</div><div class="ms-label">Total Wins</div></div>
    <div class="modal-stat"><div class="ms-val" style="color: var(--accent-rose);">${p.losses}</div><div class="ms-label">Total Losses</div></div>
    <div class="modal-stat"><div class="ms-val" style="color: var(--accent-purple);">${p.placed_pct}%</div><div class="ms-label">Placed Rate</div></div>
  `;
}

export function openModal(playerName) {
  currentModalPlayer = playerName;
  modalSelectedYears = state.selectedYears ? new Set(state.selectedYears) : null;
  modalYearsExpanded = false;

  buildModalToggle();
  renderModalStats();

  // Show modal first so chart canvases have real dimensions (fixes mobile rendering)
  document.getElementById('playerModal').classList.add('active');

  // Build charts after modal is visible and laid out
  const yearly = state.DATA.yearly_performance[playerName];
  if (modalChart) modalChart.destroy();

  const trendEl = document.getElementById('modal-trend');
  const hasTrend = state.DATA.tournament_history && state.DATA.tournament_history[playerName];

  if (hasTrend && trendEl) {
    trendEl.style.display = 'block';
    const slider = document.getElementById('modal-trend-slider');
    if (slider) slider.value = state.trendWindowSize || 50;
    const valEl = document.getElementById('modal-trend-slider-value');
    if (valEl) valEl.textContent = state.trendWindowSize || 50;
  } else if (trendEl) {
    trendEl.style.display = 'none';
    if (modalTrendChart) { modalTrendChart.destroy(); modalTrendChart = null; }
  }

  requestAnimationFrame(() => {
    if (yearly) {
      document.querySelector('.modal-chart').style.display = 'block';
      modalChart = new Chart(document.getElementById('modalChart'), {
        type: 'bar',
        data: {
          labels: yearly.map(y => y.year),
          datasets: [
            {
              label: 'Points',
              data: yearly.map(y => y.points),
              backgroundColor: COLORS.gold + 'bb',
              borderRadius: 4,
              borderSkipped: false,
              yAxisID: 'y',
            },
            {
              label: 'Win %',
              data: yearly.map(y => y.win_pct),
              type: 'line',
              borderColor: COLORS.emerald,
              backgroundColor: COLORS.emerald + '22',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: COLORS.emerald,
              tension: 0.3,
              yAxisID: 'y1',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          scales: {
            y: { position: 'left', title: { display: true, text: 'Points' }, beginAtZero: true },
            y1: { position: 'right', title: { display: true, text: 'Win %' }, beginAtZero: true, max: 100, grid: { drawOnChartArea: false } }
          }
        }
      });
    } else {
      document.querySelector('.modal-chart').style.display = 'none';
    }

    if (hasTrend && trendEl) {
      buildModalTrendChart(playerName, state.trendWindowSize || 50);
    }
  });
}

function buildModalTrendChart(playerName, windowSize) {
  if (modalTrendChart) modalTrendChart.destroy();

  const history = state.DATA.tournament_history[playerName];
  if (!history || history.length === 0) return;

  const data = history.map((t, i) => {
    let totalWins = 0, totalLosses = 0;
    for (let j = i; j >= 0; j--) {
      totalWins += history[j].wins;
      totalLosses += history[j].losses;
      if (totalWins + totalLosses >= windowSize) break;
    }
    const totalMatches = totalWins + totalLosses;
    if (totalMatches === 0) return null;
    return { x: t.date, y: +((totalWins / totalMatches) * 100).toFixed(1) };
  }).filter(Boolean);

  modalTrendChart = new Chart(document.getElementById('modalTrendChart'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Win %',
        data,
        borderColor: COLORS.emerald,
        backgroundColor: COLORS.emerald + '22',
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: COLORS.emerald,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Win %: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'quarter', displayFormats: { quarter: 'MMM yyyy' } },
          title: { display: true, text: 'Tournament Date' }
        },
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Win % (Rolling Avg)' }
        }
      }
    }
  });
}

export function onModalYearToggle(year) {
  if (year === 'all') {
    modalSelectedYears = null;
  } else if (!modalSelectedYears) {
    modalSelectedYears = new Set([year]);
  } else if (modalSelectedYears.has(year)) {
    modalSelectedYears.delete(year);
    if (modalSelectedYears.size === 0) modalSelectedYears = null;
  } else {
    modalSelectedYears.add(year);
  }
  buildModalToggle();
  renderModalStats();
}

export function onModalYearsExpand() {
  modalYearsExpanded = true;
  buildModalToggle();
}

export function onModalYearsCollapse() {
  modalYearsExpanded = false;
  buildModalToggle();
}

export function onModalTrendSlider(value) {
  const windowSize = parseInt(value) || 50;
  const valEl = document.getElementById('modal-trend-slider-value');
  if (valEl) valEl.textContent = windowSize;
  if (currentModalPlayer && state.DATA.tournament_history?.[currentModalPlayer]) {
    buildModalTrendChart(currentModalPlayer, windowSize);
  }
}

export function closeModal() {
  document.getElementById('playerModal').classList.remove('active');
  currentModalPlayer = null;
  modalSelectedYears = null;
  if (modalTrendChart) { modalTrendChart.destroy(); modalTrendChart = null; }
}
