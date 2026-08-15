/**
 * Audit state file — Wiki/.audit-state.json, one per workspace wiki.
 *
 * Holds only rebuildable data (wiki-audit-decisions.md, Decision 20):
 * hashes, indices, counters. Never versioned; a missing or corrupt file
 * is equivalent to a first run. Content history lives in per-page
 * .archive/ folders, not here.
 *
 * Skeleton schema (zone hashes, edges, and freshness land in later
 * phases and extend `pages`):
 *   { schemaVersion, lastRun, pages: { <realpath>: {...} } }
 */

const fs = require('fs');
const path = require('path');

const STATE_FILENAME = '.audit-state.json';
const SCHEMA_VERSION = 1;

function stateFilePath(wikiRoot) {
  return path.join(wikiRoot, STATE_FILENAME);
}

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, lastRun: null, pages: {} };
}

function loadState(wikiRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFilePath(wikiRoot), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...emptyState(), ...parsed };
    }
  } catch {
    // Missing or unreadable state = first run; everything is rebuildable.
  }
  return emptyState();
}

function saveState(wikiRoot, state) {
  const output = {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    lastRun: new Date().toISOString(),
  };
  fs.writeFileSync(stateFilePath(wikiRoot), `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

module.exports = {
  STATE_FILENAME,
  loadState,
  saveState,
};
