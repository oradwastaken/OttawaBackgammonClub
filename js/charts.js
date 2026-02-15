import { state, COLORS, PALETTE, firstName, initials } from './state.js';
import { isDark, applyChartDefaults } from './theme.js';
import { deriveData, updateDataSourceInfo } from './data.js';

// ===== RADAR STATE (module-private) =====
let radarChart = null;
export const radarSelected = new Set();

// ===== REBUILD =====

export function rebuildCharts() {
  Chart.helpers.each(Chart.instances, (chart) => chart.destroy());
  applyChartDefaults();
  buildAllMiniBoards();
  buildPointsBreakdown();
  buildCumulativeChart();
  buildAttendanceChart();
  buildWinRateDistribution();
  buildPPTDistribution();
  buildYearlyPoints();
  buildYearlyOverview();
  buildWinLossChart();
  radarChart = null;
  updateRadar();
}

export function rebuildAll() {
  deriveData();
  buildPodium();
  buildLeaderboardTable();
  radarSelected.clear();
  state.byPoints.slice(0, 3).forEach(p => radarSelected.add(p.player));
  buildRadarFilters();
  rebuildCharts();
  const totalGames = state.players.reduce((s, p) => s + p.total_games, 0);
  animateNumber(document.getElementById('stat-tournaments'), state.DATA.total_tournaments);
  animateNumber(document.getElementById('stat-players'), state.DATA.players.length);
  animateNumber(document.getElementById('stat-games'), totalGames);
  animateNumber(document.getElementById('stat-years'), state.DATA.years.length);
  updateDataSourceInfo();
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

// ===== 1. PODIUM =====

export function buildPodium() {
  const top3 = state.byPoints.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd
  const podiumEl = document.getElementById('podium');
  podiumEl.innerHTML = order.map((p, i) => {
    const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
    const crown = rank === 1 ? '<span class="crown">&#9813;</span>' : '';
    return `
      <div class="podium-slot clickable" onclick="openModal('${p.player}')">
        <div class="podium-avatar">${crown}${initials(p.player)}</div>
        <div class="podium-name">${p.player}</div>
        <div class="podium-pts">${Math.round(p.total_points)}</div>
        <div class="podium-sub">${p.wins}W - ${p.losses}L</div>
        <div class="podium-bar"></div>
      </div>`;
  }).join('');
}

// ===== 2. LEADERBOARD TABLE (4-10) =====

export function buildLeaderboardTable() {
  const rest = state.byPoints.slice(3, 10);
  const el = document.getElementById('leaderboard-table');
  el.innerHTML = rest.map((p, i) => `
    <div class="table-row clickable" onclick="openModal('${p.player}')">
      <span class="rank">${i + 4}</span>
      <span class="name">${p.player}</span>
      <span class="stat-val" style="color: var(--accent-gold);">${Math.round(p.total_points)}</span>
      <span class="stat-val" style="color: var(--text-secondary);">${p.wins}-${p.losses}</span>
      <span class="stat-val" style="color: var(--accent-cyan);">${p.ppt}</span>
    </div>`).join('');
}

// ===== 3. POINTS BREAKDOWN CHART =====

export function buildPointsBreakdown() {
  const top10 = state.byPoints.slice(0, 10);
  new Chart(document.getElementById('pointsBreakdownChart'), {
    type: 'bar',
    data: {
      labels: top10.map(p => firstName(p.player)),
      datasets: [
        {
          label: 'Wins',
          data: top10.map(p => p.wins),
          backgroundColor: COLORS.blue + 'cc',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Placing Bonus',
          data: top10.map(p => p.placing_pts),
          backgroundColor: COLORS.gold + 'cc',
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
        legend: { position: 'top', align: 'end' },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const idx = ctx[0].dataIndex;
              const p = top10[idx];
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
}

// ===== 4. MINI BOARDS =====

function buildMiniBoard(elId, data, valFn, subFn, color, count = 10) {
  const el = document.getElementById(elId);
  const dark = isDark();
  const rankColors = ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.15)', 'rgba(217,119,6,0.15)',
    dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'];
  el.innerHTML = data.slice(0, count).map((p, i) => `
    <li class="clickable" onclick="openModal('${p.player}')">
      <div class="mini-left">
        <span class="mini-rank" style="background: ${rankColors[i] || rankColors[4]}; color: ${i < 3 ? color : 'var(--text-muted)'};">${i + 1}</span>
        <span class="mini-name">${p.player}</span>
      </div>
      <div class="mini-right">
        <span class="mini-val" style="color: ${color};">${valFn(p)}</span>
        <span class="mini-sub">${subFn(p)}</span>
      </div>
    </li>`).join('');
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
}

// ===== 5. CUMULATIVE CHART =====

export function buildCumulativeChart() {
  const years = state.DATA.years;
  const datasets = Object.entries(state.DATA.cumulative).map(([name, series], i) => ({
    label: firstName(name),
    data: series.map(s => s.cumulative),
    borderColor: PALETTE[i],
    backgroundColor: PALETTE[i] + '15',
    borderWidth: 2.5,
    pointRadius: 4,
    pointHoverRadius: 7,
    pointBackgroundColor: PALETTE[i],
    tension: 0.3,
    fill: false,
  }));

  new Chart(document.getElementById('cumulativeChart'), {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 10 } } }
      },
      scales: {
        y: { title: { display: true, text: 'Cumulative Points' } }
      }
    }
  });
}

// ===== 6. ATTENDANCE CHART =====

export function buildAttendanceChart() {
  const dates = Object.keys(state.DATA.attendance).sort();
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

// ===== 7. WIN RATE DISTRIBUTION =====

export function buildWinRateDistribution() {
  const buckets = ['0-20%', '20-30%', '30-40%', '40-50%', '50-60%', '60-70%', '70%+'];
  const bucketRanges = [[0,20],[20,30],[30,40],[40,50],[50,60],[60,70],[70,101]];
  const counts = bucketRanges.map(([lo, hi]) => state.qualified.filter(p => p.win_pct >= lo && p.win_pct < hi).length);

  const gradColors = ['#f43f5e', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981', '#06b6d4'];

  new Chart(document.getElementById('winRateDistChart'), {
    type: 'bar',
    data: {
      labels: buckets,
      datasets: [{
        label: 'Players',
        data: counts,
        backgroundColor: gradColors.map(c => c + 'bb'),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const [lo, hi] = bucketRanges[ctx.dataIndex];
              const names = state.qualified.filter(p => p.win_pct >= lo && p.win_pct < hi).map(p => `${p.player} (${p.win_pct}%)`);
              return names.length <= 6 ? names.join('\n') : names.slice(0, 5).join('\n') + `\n+${names.length - 5} more`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          title: { display: true, text: 'Players' }
        }
      }
    }
  });
}

// ===== 8. PPT DISTRIBUTION =====

export function buildPPTDistribution() {
  const buckets = ['0-0.5', '0.5-1.0', '1.0-1.5', '1.5-2.0', '2.0-2.5', '2.5-3.0', '3.0+'];
  const bucketRanges = [[0,0.5],[0.5,1],[1,1.5],[1.5,2],[2,2.5],[2.5,3],[3,10]];
  const counts = bucketRanges.map(([lo, hi]) => state.qualified.filter(p => p.ppt >= lo && p.ppt < hi).length);

  const gradColors = ['#64748b', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'];

  new Chart(document.getElementById('pptDistChart'), {
    type: 'bar',
    data: {
      labels: buckets,
      datasets: [{
        label: 'Players',
        data: counts,
        backgroundColor: gradColors.map(c => c + 'bb'),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const [lo, hi] = bucketRanges[ctx.dataIndex];
              const names = state.qualified.filter(p => p.ppt >= lo && p.ppt < hi).map(p => `${p.player} (${p.ppt})`);
              return names.length <= 6 ? names.join('\n') : names.slice(0, 5).join('\n') + `\n+${names.length - 5} more`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          title: { display: true, text: 'Players' }
        }
      }
    }
  });
}

// ===== 9. YEARLY POINTS (Top 5) =====

export function buildYearlyPoints() {
  const top5 = Object.keys(state.DATA.yearly_performance).slice(0, 5);
  const years = state.DATA.years;

  new Chart(document.getElementById('yearlyPointsChart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: top5.map((name, i) => ({
        label: firstName(name),
        data: state.DATA.yearly_performance[name].map(y => y.points),
        borderColor: PALETTE[i],
        backgroundColor: PALETTE[i] + '22',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 10 } } }
      },
      scales: {
        y: { title: { display: true, text: 'Points' } }
      }
    }
  });
}

// ===== 10. CLUB YEARLY OVERVIEW =====

export function buildYearlyOverview() {
  const yearlyStats = state.DATA.years.map(y => {
    const yearDates = Object.keys(state.DATA.attendance).filter(d => d.startsWith(y));
    const totalAttendance = yearDates.reduce((s, d) => s + state.DATA.attendance[d], 0);
    const avgAttendance = totalAttendance / yearDates.length;
    return { year: y, tournaments: yearDates.length, avgAttendance: +avgAttendance.toFixed(1) };
  });

  new Chart(document.getElementById('yearlyOverviewChart'), {
    type: 'bar',
    data: {
      labels: state.DATA.years,
      datasets: [
        {
          label: 'Tournaments',
          data: yearlyStats.map(y => y.tournaments),
          backgroundColor: COLORS.blue + 'bb',
          borderRadius: 4,
          borderSkipped: false,
          yAxisID: 'y',
        },
        {
          label: 'Avg Attendance',
          data: yearlyStats.map(y => y.avgAttendance),
          type: 'line',
          borderColor: COLORS.gold,
          backgroundColor: COLORS.gold + '22',
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: COLORS.gold,
          tension: 0.3,
          yAxisID: 'y1',
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12 } }
      },
      scales: {
        y: {
          position: 'left',
          title: { display: true, text: 'Tournaments' },
          beginAtZero: true,
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Avg Players/Week' },
          beginAtZero: true,
          grid: { drawOnChartArea: false },
        }
      }
    }
  });
}

// ===== 11. WIN vs LOSS CHART =====

export function buildWinLossChart() {
  const top10 = state.byPoints.slice(0, 10);

  new Chart(document.getElementById('winLossChart'), {
    type: 'bar',
    data: {
      labels: top10.map(p => firstName(p.player)),
      datasets: [
        {
          label: 'Wins',
          data: top10.map(p => p.wins),
          backgroundColor: COLORS.emerald + 'cc',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Losses',
          data: top10.map(p => -p.losses),
          backgroundColor: COLORS.rose + '99',
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
              const p = top10[idx];
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
          title: { display: true, text: 'Games' }
        }
      }
    }
  });
}

// ===== 12. RADAR CHART =====

export function buildRadarFilters() {
  const el = document.getElementById('radar-filters');
  const top10 = state.byPoints.slice(0, 10);
  el.innerHTML = top10.map(p => {
    const active = radarSelected.has(p.player) ? 'active' : '';
    return `<button class="filter-btn ${active}" data-player="${p.player}" onclick="toggleRadarPlayer(this)">${firstName(p.player)}</button>`;
  }).join('');
}

export function toggleRadarPlayer(btn) {
  const name = btn.dataset.player;
  if (radarSelected.has(name)) {
    radarSelected.delete(name);
    btn.classList.remove('active');
  } else {
    radarSelected.add(name);
    btn.classList.add('active');
  }
  updateRadar();
}

export function updateRadar() {
  const selected = [...radarSelected].map(name => state.players.find(p => p.player === name)).filter(Boolean);
  if (!selected.length) return;

  const maxPts = Math.max(...state.players.map(p => p.total_points));
  const maxT = Math.max(...state.players.map(p => p.tournaments));
  const maxPPT = Math.max(...state.qualified.map(p => p.ppt));

  const labels = ['Win Rate', 'PPT', 'Total Points', 'Attendance', 'Placed %', 'Games Played'];

  const datasets = selected.map((p, i) => {
    const idx = state.byPoints.findIndex(bp => bp.player === p.player);
    const color = PALETTE[idx] || PALETTE[i];
    return {
      label: firstName(p.player),
      data: [
        p.win_pct,
        (p.ppt / maxPPT) * 100,
        (p.total_points / maxPts) * 100,
        p.participation_pct,
        p.placed_pct,
        (p.total_games / Math.max(...state.players.map(x => x.total_games))) * 100,
      ],
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: color,
    };
  });

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 10 } } }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 20, color: isDark() ? '#64748b' : '#64748b', backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: isDark() ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)' },
          angleLines: { color: isDark() ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)' },
          pointLabels: { color: isDark() ? '#94a3b8' : '#374151', font: { size: 11, weight: '500' } }
        }
      }
    }
  });
}
