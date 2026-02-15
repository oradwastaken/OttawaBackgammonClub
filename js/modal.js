import { state, COLORS, firstName } from './state.js';

let modalChart = null;
let modalTrendChart = null;
let currentModalPlayer = null;

export function openModal(playerName) {
  const p = state.players.find(x => x.player === playerName);
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

  // Build yearly chart if we have data
  const yearly = state.DATA.yearly_performance[p.player];
  if (modalChart) modalChart.destroy();

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

  // Build rolling win % trend chart if tournament_history exists
  currentModalPlayer = playerName;
  const trendEl = document.getElementById('modal-trend');
  const hasTrend = state.DATA.tournament_history && state.DATA.tournament_history[playerName];

  if (hasTrend && trendEl) {
    trendEl.style.display = 'block';
    const ws = state.trendWindowSize || 50;
    buildModalTrendChart(playerName, ws);
    const slider = document.getElementById('modal-trend-slider');
    if (slider) slider.value = ws;
    const valEl = document.getElementById('modal-trend-slider-value');
    if (valEl) valEl.textContent = ws;
  } else if (trendEl) {
    trendEl.style.display = 'none';
    if (modalTrendChart) { modalTrendChart.destroy(); modalTrendChart = null; }
  }

  document.getElementById('playerModal').classList.add('active');
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
  if (modalTrendChart) { modalTrendChart.destroy(); modalTrendChart = null; }
}
