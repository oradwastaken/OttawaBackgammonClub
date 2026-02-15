import { state } from './state.js';
import { clearStoredData } from './data.js';

export function getGitHubSettings() {
  try {
    const s = localStorage.getItem('bgclub-github');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function saveGitHubSettings() {
  const repo = document.getElementById('gh-repo').value.trim();
  const token = document.getElementById('gh-token').value.trim();
  if (!repo || !token) {
    alert('Both repository and token are required.');
    return;
  }
  if (!repo.includes('/')) {
    alert('Repository must be in owner/repo format (e.g. JohnSmith/OttawaBackgammonClub)');
    return;
  }
  localStorage.setItem('bgclub-github', JSON.stringify({ repo, token }));
  document.getElementById('github-settings').style.display = 'none';
  showPublishStatus('Settings saved!', 'success');
  updatePublishUI();
}

export function toggleGitHubSettings() {
  const el = document.getElementById('github-settings');
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const settings = getGitHubSettings();
    if (settings) {
      document.getElementById('gh-repo').value = settings.repo;
      document.getElementById('gh-token').value = settings.token;
    }
  }
}

export function showPublishStatus(msg, type) {
  const el = document.getElementById('publish-status');
  if (el) { el.textContent = msg; el.className = 'publish-status ' + (type || ''); }
}

export function updatePublishUI() {
  const el = document.getElementById('publish-actions');
  if (el) el.style.display = getGitHubSettings() ? 'block' : 'none';
}

export function showPublishActions(show) {
  if (show && getGitHubSettings()) {
    document.getElementById('publish-actions').style.display = 'block';
  }
  showPublishStatus('', '');
}

export async function publishToGitHub() {
  const settings = getGitHubSettings();
  if (!settings) {
    toggleGitHubSettings();
    return;
  }

  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';
  showPublishStatus('Publishing...', 'loading');

  try {
    const { repo, token } = settings;
    const apiBase = 'https://api.github.com/repos/' + repo + '/contents/data.json';
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    // Get current file SHA (needed to update existing file)
    let sha = null;
    try {
      const existing = await fetch(apiBase, { headers });
      if (existing.ok) {
        const info = await existing.json();
        sha = info.sha;
      }
    } catch {}

    // Encode content as base64
    const content = JSON.stringify(state.DATA, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(content)));

    const body = {
      message: 'Update data.json — ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      content: base64
    };
    if (sha) body.sha = sha;

    const resp = await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(body) });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'HTTP ' + resp.status);
    }

    clearStoredData();
    showPublishStatus('Published! The site will update in about a minute.', 'success');
  } catch (e) {
    showPublishStatus('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish';
  }
}
