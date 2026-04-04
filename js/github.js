import { state } from './state.js';
import { clearStoredData } from './data.js';

const PROXY_URL = 'https://bgclub-publish.oradwastaken.workers.dev';

class TokenError extends Error {
  constructor(detail) {
    super('Your GitHub token is invalid or expired.');
    this.detail = detail;
  }
}

// ── Settings ──────────────────────────────────

export function getGitHubSettings() {
  try {
    const s = localStorage.getItem('bgclub-github');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function isProxyMode(settings) {
  return settings && settings.mode === 'proxy';
}

export function saveGitHubSettings() {
  const mode = document.querySelector('input[name="gh-mode"]:checked')?.value || 'direct';

  if (mode === 'proxy') {
    const password = document.getElementById('gh-proxy-pin').value.trim();
    if (!password) {
      alert('PIN is required.');
      return;
    }
    localStorage.setItem('bgclub-github', JSON.stringify({ mode: 'proxy', password }));
  } else {
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
    localStorage.setItem('bgclub-github', JSON.stringify({ mode: 'direct', repo, token }));
  }

  document.getElementById('github-settings').style.display = 'none';
  showPublishAlert('', '');
  showPublishStatus('Settings saved!', 'success');
  updatePublishUI();
}

export function toggleGitHubSettings() {
  const el = document.getElementById('github-settings');
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const settings = getGitHubSettings();
    if (settings && isProxyMode(settings)) {
      const radio = document.getElementById('gh-mode-proxy');
      if (radio) radio.checked = true;
      document.getElementById('gh-proxy-pin').value = settings.password || '';
      switchSettingsMode('proxy');
    } else if (settings) {
      const radio = document.getElementById('gh-mode-direct');
      if (radio) radio.checked = true;
      document.getElementById('gh-repo').value = settings.repo || '';
      document.getElementById('gh-token').value = settings.token || '';
      switchSettingsMode('direct');
    }
  }
}

export function switchSettingsMode(mode) {
  document.getElementById('gh-direct-fields').style.display = mode === 'direct' ? 'block' : 'none';
  document.getElementById('gh-proxy-fields').style.display = mode === 'proxy' ? 'block' : 'none';
}

// ── Status display ────────────────────────────

export function showPublishStatus(msg, type) {
  const el = document.getElementById('publish-status');
  if (el) { el.textContent = msg; el.className = 'publish-status ' + (type || ''); }
}

function showPublishAlert(html, type) {
  const el = document.getElementById('publish-alert');
  if (!el) return;
  el.innerHTML = html;
  el.className = 'publish-alert' + (type ? ' ' + type : '');
  el.style.display = html ? 'block' : 'none';
}

export function updatePublishUI() {
  const el = document.getElementById('publish-actions');
  if (el) el.style.display = getGitHubSettings() ? 'block' : 'none';
}

// ── Show publish actions + validate ───────────

export async function showPublishActions(show) {
  showPublishAlert('', '');
  if (show && getGitHubSettings()) {
    document.getElementById('publish-actions').style.display = 'block';
    showPublishStatus('', '');
    const settings = getGitHubSettings();
    // Only validate proactively for direct mode (proxy validates on publish)
    if (!isProxyMode(settings)) {
      await validateToken();
    }
  } else if (show) {
    document.getElementById('publish-actions').style.display = 'block';
    showPublishAlert(
      '<strong>GitHub not configured</strong>' +
      'To publish updates for everyone, <a class="publish-alert-link" onclick="toggleGitHubSettings()">set up your connection</a> first.',
      'warning'
    );
  } else {
    showPublishStatus('', '');
  }
}

// ── Token validation (direct mode only) ───────

async function validateToken() {
  const settings = getGitHubSettings();
  if (!settings || isProxyMode(settings)) return true;

  try {
    const resp = await fetch('https://api.github.com/repos/' + settings.repo, {
      headers: {
        'Authorization': 'Bearer ' + settings.token,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (resp.status === 401) {
      showTokenError('expired or invalid');
      return false;
    }
    if (resp.status === 403) {
      showTokenError('revoked or has insufficient permissions');
      return false;
    }
    if (resp.status === 404) {
      showTokenError('missing access to this repository');
      return false;
    }
    const data = await resp.json();
    if (data.permissions && !data.permissions.push) {
      showTokenError('read-only — it needs write permission');
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

function showTokenError(reason) {
  const btn = document.getElementById('publish-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Publish (token issue)';
  }

  showPublishAlert(
    '<strong>Cannot publish — your access token is ' + reason + '</strong>' +
    'The data was applied locally on your device, but it has <em>not</em> been published for other members. ' +
    'Please <a class="publish-alert-link" onclick="toggleGitHubSettings()">update your token</a> ' +
    'or contact the club admin for a new one.',
    'error'
  );
}

// ── Publish ───────────────────────────────────

export async function publishToGitHub() {
  const settings = getGitHubSettings();
  if (!settings) {
    toggleGitHubSettings();
    return;
  }

  if (isProxyMode(settings)) {
    return publishViaProxy(settings);
  }
  return publishDirect(settings);
}

async function publishViaProxy(settings) {
  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';
  showPublishStatus('Publishing...', 'loading');
  showPublishAlert('', '');

  try {
    state.DATA.last_updated = new Date().toISOString();
    const content = JSON.stringify(state.DATA, null, 2);
    const resp = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: settings.password, content }),
    });

    const result = await resp.json().catch(() => ({}));

    if (resp.status === 401) {
      showPublishStatus('', '');
      showPublishAlert(
        '<strong>Invalid PIN</strong>' +
        'Your access code was rejected. Please <a class="publish-alert-link" onclick="toggleGitHubSettings()">check your PIN</a> ' +
        'or contact the club admin for the current one.',
        'error'
      );
      btn.disabled = false;
      btn.textContent = 'Publish';
      return;
    }

    if (!resp.ok) {
      throw new Error(result.error || 'HTTP ' + resp.status);
    }

    clearStoredData();
    showPublishStatus(result.message || 'Published! The site will update in about a minute.', 'success');
  } catch (e) {
    showPublishStatus('Error: ' + e.message, 'error');
    showPublishAlert(
      '<strong>Publish failed</strong>' +
      'Your data is saved locally but has not been published for other members. Please try again or contact the club admin.',
      'error'
    );
  } finally {
    if (btn.textContent !== 'Publish (token issue)') {
      btn.disabled = false;
      btn.textContent = 'Publish';
    }
  }
}

async function publishDirect(settings) {
  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';
  showPublishStatus('Publishing...', 'loading');
  showPublishAlert('', '');

  try {
    const { repo, token } = settings;
    const apiBase = 'https://api.github.com/repos/' + repo + '/contents/data.json';
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    // Get current file SHA
    let sha = null;
    try {
      const existing = await fetch(apiBase, { headers });
      if (existing.status === 401 || existing.status === 403) {
        throw new TokenError(existing.status === 401 ? 'expired or invalid' : 'revoked or has insufficient permissions');
      }
      if (existing.ok) {
        const info = await existing.json();
        sha = info.sha;
      }
    } catch (e) {
      if (e instanceof TokenError) throw e;
    }

    state.DATA.last_updated = new Date().toISOString();
    const content = JSON.stringify(state.DATA, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(content)));

    const body = {
      message: 'Update data.json \u2014 ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      content: base64
    };
    if (sha) body.sha = sha;

    const resp = await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(body) });

    if (resp.status === 401 || resp.status === 403) {
      throw new TokenError(resp.status === 401 ? 'expired or invalid' : 'revoked or has insufficient permissions');
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'HTTP ' + resp.status);
    }

    clearStoredData();
    showPublishStatus('Published! The site will update in about a minute.', 'success');
  } catch (e) {
    if (e instanceof TokenError) {
      showPublishStatus('', '');
      showTokenError(e.detail);
      toggleGitHubSettings();
      return;
    }
    showPublishStatus('Error: ' + e.message, 'error');
    showPublishAlert(
      '<strong>Publish failed</strong>' +
      'Your data is saved locally but has not been published for other members. Please try again or contact the club admin.',
      'error'
    );
  } finally {
    if (btn.textContent !== 'Publish (token issue)') {
      btn.disabled = false;
      btn.textContent = 'Publish';
    }
  }
}
