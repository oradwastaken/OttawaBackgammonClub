import { state, initials } from './state.js';

// ===== HELPERS =====

export function getSpotlightData() {
  if (!state.spotlightPlayer) return null;
  // Try filtered players first, fall back to all-time data
  return state.players.find(p => p.player === state.spotlightPlayer)
    || state.DATA.players.find(p => p.player === state.spotlightPlayer)
    || null;
}

export function getSpotlightRank(sortedArray) {
  if (!state.spotlightPlayer) return -1;
  return sortedArray.findIndex(p => p.player === state.spotlightPlayer);
}

// ===== STAT CARD =====

export function renderSpotlightCard() {
  const card = document.getElementById('spotlight-card');
  if (!card) return;

  if (!state.spotlightPlayer) {
    card.style.display = 'none';
    return;
  }

  const p = getSpotlightData();
  if (!p) {
    card.style.display = 'none';
    return;
  }

  const rank = state.byPoints.findIndex(x => x.player === p.player) + 1;
  const inFilter = rank > 0;

  document.getElementById('spotlight-avatar').textContent = initials(p.player);
  document.getElementById('spotlight-name').textContent = p.player;
  const rankEl = document.getElementById('spotlight-rank');
  if (inFilter) {
    rankEl.textContent = `Rank #${rank} of ${state.byPoints.length} players`;
    rankEl.classList.remove('spotlight-not-active');
  } else {
    rankEl.textContent = 'Not active in selected season — showing all-time stats';
    rankEl.classList.add('spotlight-not-active');
  }

  document.getElementById('spotlight-stats').innerHTML = `
    <div class="spotlight-stat"><span class="ss-val" style="color:var(--accent-gold)">${Math.round(p.total_points)}</span><span class="ss-label">Points</span></div>
    <div class="spotlight-stat"><span class="ss-val" style="color:var(--accent-emerald)">${p.win_pct}%</span><span class="ss-label">Win Rate</span></div>
    <div class="spotlight-stat"><span class="ss-val" style="color:var(--accent-cyan)">${p.ppt}</span><span class="ss-label">PPT</span></div>
    <div class="spotlight-stat"><span class="ss-val" style="color:var(--accent-blue)">${p.wins}-${p.losses}</span><span class="ss-label">W-L</span></div>
    <div class="spotlight-stat"><span class="ss-val" style="color:var(--accent-purple)">${p.placed_pct}%</span><span class="ss-label">Placed</span></div>
    <div class="spotlight-stat"><span class="ss-val" style="color:var(--accent-orange)">${p.tournaments}</span><span class="ss-label">Tourn.</span></div>
  `;

  card.style.display = '';
}

// ===== SEARCH =====

export function initSpotlightSearch(rebuildFn) {
  const input = document.getElementById('spotlight-search');
  const dropdown = document.getElementById('spotlight-dropdown');
  const clearBtn = document.getElementById('spotlight-clear');
  if (!input || !dropdown || !clearBtn) return;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const matches = state.DATA.players
      .filter(p => p.player.toLowerCase().includes(query))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 8);

    if (!matches.length) {
      dropdown.innerHTML = '<div class="spotlight-dropdown-item" style="color:var(--text-muted);cursor:default;">No players found</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = matches.map(p => {
      const rank = state.byPoints.findIndex(x => x.player === p.player) + 1;
      const detail = rank > 0
        ? `#${rank} &middot; ${Math.round(p.total_points)} pts`
        : `${Math.round(p.total_points)} pts (all-time)`;
      return `<div class="spotlight-dropdown-item" data-name="${p.player}">
        <span>${p.player}</span>
        <span class="spotlight-dropdown-rank">${detail}</span>
      </div>`;
    }).join('');
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.spotlight-dropdown-item[data-name]').forEach(el => {
      el.addEventListener('click', () => {
        selectSpotlight(el.dataset.name, rebuildFn);
        input.value = el.dataset.name;
        dropdown.style.display = 'none';
      });
    });
  });

  clearBtn.addEventListener('click', () => {
    clearSpotlight(rebuildFn);
    input.value = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSpotlight(rebuildFn);
      input.value = '';
      input.blur();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.spotlight-search-wrap')) {
      dropdown.style.display = 'none';
    }
  });
}

function selectSpotlight(name, rebuildFn) {
  state.spotlightPlayer = name;
  document.getElementById('spotlight-clear')?.classList.add('visible');
  try { localStorage.setItem('bgclub-spotlight', name); } catch (e) { /* ignore */ }
  rebuildFn();
  renderSpotlightCard();
}

export function clearSpotlight(rebuildFn) {
  state.spotlightPlayer = null;
  document.getElementById('spotlight-clear')?.classList.remove('visible');
  try { localStorage.removeItem('bgclub-spotlight'); } catch (e) { /* ignore */ }
  rebuildFn();
  renderSpotlightCard();
}

// ===== PERSISTENCE =====

export function restoreSpotlight() {
  try {
    const saved = localStorage.getItem('bgclub-spotlight');
    if (saved && state.DATA.players.some(p => p.player === saved)) {
      state.spotlightPlayer = saved;
      const input = document.getElementById('spotlight-search');
      if (input) input.value = saved;
      document.getElementById('spotlight-clear')?.classList.add('visible');
    }
  } catch (e) { /* ignore */ }
}
