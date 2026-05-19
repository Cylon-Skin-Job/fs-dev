const secrets = require('../../secrets');

async function post(action, params = {}) {
  const [url, key] = await Promise.all([
    secrets.get('GOOGLE_BRIDGE_URL'),
    secrets.get('GOOGLE_BRIDGE_KEY'),
  ]);

  if (!url || !key) return null; // adapter not configured

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, action, ...params }),
  });

  if (!res.ok) throw new Error(`Google bridge HTTP ${res.status}`);
  return res.json();
}

module.exports = { post };
