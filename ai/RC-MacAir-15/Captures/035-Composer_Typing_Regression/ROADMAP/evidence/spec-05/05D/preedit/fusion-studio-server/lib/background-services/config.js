/**
 * Background service config.
 *
 * Defaults are fail-closed. Users can opt in through data/config.json
 * (server-root data/, alongside fusion.db):
 *
 * {
 *   "settings": {
 *     "backgroundServices": {
 *       "calendar": {
 *         "apple": { "enabled": true },
 *         "google": { "enabled": true }
 *       }
 *     }
 *   }
 * }
 *
 * Environment variables are accepted for development and packaged-app
 * troubleshooting:
 *   FUSION_CALENDAR_APPLE_ENABLED=1
 *   FUSION_CALENDAR_GOOGLE_ENABLED=1
 *
 * The data/config.json loader lives here because this module is its only
 * consumer. It is the last living job of the legacy root config.js
 * persistence layer — settings, project registry, panel state, and chat
 * history all moved to SQLite, view-state, and the thread system.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'config.json');

let cachedConfig = null;

function getConfig() {
  if (!cachedConfig) {
    try {
      cachedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      // Missing or unparseable file → fail closed (all services disabled)
      cachedConfig = {};
    }
  }
  return cachedConfig;
}

const ENV_KEYS = {
  'calendar.apple': 'FUSION_CALENDAR_APPLE_ENABLED',
  'calendar.google': 'FUSION_CALENDAR_GOOGLE_ENABLED',
};

function envEnabled(name) {
  const key = ENV_KEYS[name];
  if (!key) return null;
  const raw = process.env[key];
  if (raw == null) return null;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function readPath(obj, parts) {
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function isEnabled(name, defaultValue = false) {
  const fromEnv = envEnabled(name);
  if (fromEnv !== null) return fromEnv;

  const config = getConfig();
  const value = readPath(config, ['settings', 'backgroundServices', ...name.split('.'), 'enabled']);
  return typeof value === 'boolean' ? value : defaultValue;
}

module.exports = { isEnabled };
