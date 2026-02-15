import { state, COLORS, firstName } from './state.js';

let modalChart = null;

export function openModal(playerName) {
  const p = state.players.find(x => x.player === playerName);
  if (!p) return;

  document.getElementById('modal-name').textContent = p.player;
  document.getElementById('modal-subtitle').textContent = `${p.tournaments} tournaments attended | ${p.total_games} games played`;

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

  document.getElementById('playerModal').classList.add('active');
}

export function closeModal() {
  document.getElementById('playerModal').classList.remove('active');
}
