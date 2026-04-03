/**
 * Cloudflare Worker proxy for Ottawa Backgammon Club dashboard.
 * Allows trusted uploaders to publish data.json to GitHub
 * using a shared PIN instead of individual GitHub tokens.
 *
 * Environment secrets (set via `wrangler secret put`):
 *   GITHUB_TOKEN    — Fine-grained PAT with contents:write on the repo
 *   GITHUB_REPO     — owner/repo (e.g. "JohnSmith/OttawaBackgammonClub")
 *   UPLOAD_PASSWORD  — Shared PIN that uploaders enter in the dashboard
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const body = await request.json();
      const { password, content } = body;

      // Validate password
      if (!password || password !== env.UPLOAD_PASSWORD) {
        return json({ error: 'Invalid PIN. Please check your access code or contact the club admin.' }, 401);
      }

      // Validate content
      if (!content) {
        return json({ error: 'No data provided.' }, 400);
      }

      // Verify it's valid JSON
      try {
        JSON.parse(content);
      } catch {
        return json({ error: 'Invalid data format.' }, 400);
      }

      const repo = env.GITHUB_REPO;
      const token = env.GITHUB_TOKEN;
      const apiBase = `https://api.github.com/repos/${repo}/contents/data.json`;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'OttawaBackgammonClub-Worker',
      };

      // Get current file SHA
      let sha = null;
      const existing = await fetch(apiBase, { headers });
      if (existing.ok) {
        const info = await existing.json();
        sha = info.sha;
      } else if (existing.status === 401 || existing.status === 403) {
        return json({ error: 'Server token error. Please contact the club admin.' }, 500);
      }

      // Commit the file
      const commitBody = {
        message: 'Update data.json \u2014 ' + new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        }),
        content: btoa(unescape(encodeURIComponent(content))),
      };
      if (sha) commitBody.sha = sha;

      const resp = await fetch(apiBase, {
        method: 'PUT',
        headers,
        body: JSON.stringify(commitBody),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return json({ error: err.message || `GitHub API error (HTTP ${resp.status})` }, 502);
      }

      return json({ ok: true, message: 'Published! The site will update in about a minute.' });

    } catch (e) {
      return json({ error: 'Unexpected error: ' + e.message }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
