/**
 * Wiki lifecycle hooks — watches ai/views/wiki-viewer/content/ tree for topic creation and page edits.
 *
 * The wiki tree has collections (project/, system/, etc.) each containing topic folders.
 * This module scans all collections, builds a merged topics.json at the wiki root,
 * and watches for changes across all collections.
 *
 * topics.json is the client-facing index — it merges all collections into one flat
 * topic map with a `collection` field per topic so file paths resolve correctly.
 *
 * Pure data-access + filesystem module (Layer 4).
 * Does not emit events or touch DOM.
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { on } = require('../event-bus');

const DEBOUNCE_MS = 500;
const pending = new Map();
let onIndexRebuilt = null;
let unsub = null;

const WIKI_CONTENT_PREFIX = 'ai/views/wiki-viewer/content/';

/**
 * Discover collections by reading the root index.json children array.
 * Falls back to scanning for directories if no index.json exists.
 */
async function discoverCollections(wikiRoot) {
  const indexPath = path.join(wikiRoot, 'index.json');
  try {
    const raw = JSON.parse(await fsPromises.readFile(indexPath, 'utf8'));
    if (raw.children && Array.isArray(raw.children)) {
      return raw.children;
    }
  } catch {}

  // Fallback: scan for directories that contain an index.json
  const entries = await fsPromises.readdir(wikiRoot, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(name => {
      try {
        fs.accessSync(path.join(wikiRoot, name, 'index.json'));
        return true;
      } catch { return false; }
    });
}

/**
 * Build the merged topics.json from all collections.
 * Each topic gets a `collection` field so the client knows the file path.
 * Topic IDs are prefixed with collection: "system/evidence-gated-execution"
 */
async function rebuildTopicsIndex(wikiRoot) {
  const collections = await discoverCollections(wikiRoot);
  const topics = {};
  const collectionMeta = [];

  for (const collectionId of collections) {
    const collectionPath = path.join(wikiRoot, collectionId);

    // Read collection index.json for metadata
    let collectionIndex = { label: formatSlug(collectionId), rank: 50, sort: 'ranked', frozen: false };
    try {
      const raw = JSON.parse(await fsPromises.readFile(path.join(collectionPath, 'index.json'), 'utf8'));
      collectionIndex = {
        label: raw.label || formatSlug(collectionId),
        rank: raw.rank ?? 50,
        sort: raw.sort || 'ranked',
        frozen: raw.frozen || false,
      };
    } catch {}

    collectionMeta.push({ id: collectionId, ...collectionIndex });

    // Scan for topic folders with PAGE.md
    let entries;
    try {
      entries = await fsPromises.readdir(collectionPath, { withFileTypes: true });
    } catch { continue; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pagePath = path.join(collectionPath, entry.name, 'PAGE.md');
      try {
        await fsPromises.access(pagePath);
      } catch { continue; }

      // Read topic's own index.json for metadata
      let topicIndex = {};
      try {
        topicIndex = JSON.parse(await fsPromises.readFile(
          path.join(collectionPath, entry.name, 'index.json'), 'utf8'
        ));
      } catch {}

      const topicId = `${collectionId}/${entry.name}`;
      topics[topicId] = {
        slug: topicIndex.label || formatSlug(entry.name),
        collection: collectionId,
        collectionLabel: collectionIndex.label,
        collectionRank: collectionIndex.rank,
        rank: topicIndex.rank ?? 10,
        frozen: topicIndex.frozen ?? collectionIndex.frozen,
        edges_out: topicIndex.edges_out || [],
        edges_in: topicIndex.edges_in || [],
        sources: topicIndex.sources || [],
      };
    }
  }

  // Sort collections by rank
  collectionMeta.sort((a, b) => a.rank - b.rank);

  const index = {
    version: '1.0',
    last_updated: new Date().toISOString(),
    collections: collectionMeta,
    topics,
  };

  const topicsPath = path.join(wikiRoot, 'topics.json');
  await fsPromises.writeFile(topicsPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`[WikiHooks] Rebuilt topics.json — ${Object.keys(topics).length} topics across ${collections.length} collections`);

  if (typeof onIndexRebuilt === 'function') {
    try { onIndexRebuilt(topicsPath); } catch (err) {
      console.error('[WikiHooks] onIndexRebuilt callback error:', err);
    }
  }

  return index;
}

/**
 * Format a folder name into a display slug.
 * "workspace-index" → "Workspace-Index"
 */
function formatSlug(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

/**
 * Append a dated entry to a topic's LOG.md.
 */
async function appendLog(topicPath, message) {
  const logPath = path.join(topicPath, 'LOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n## ${date} — ${message}\n`;

  try {
    await fsPromises.access(logPath);
    await fsPromises.appendFile(logPath, entry, 'utf8');
  } catch {
    const topicName = path.basename(topicPath);
    const header = `# ${formatSlug(topicName)} — Log\n${entry}`;
    await fsPromises.writeFile(logPath, header, 'utf8');
  }
  console.log(`[WikiHooks] Logged: ${path.basename(topicPath)} — ${message}`);
}

/**
 * Handle a wiki file change event from the UEB.
 */
function handleWikiChange(wikiRoot, event, filePath) {
  if (!filePath.endsWith('.md')) return;

  const relativeToWiki = filePath.slice(WIKI_CONTENT_PREFIX.length);
  const parts = relativeToWiki.split(path.sep);
  if (parts.length < 3) return; // need collection/topic/file.md

  const collectionId = parts[0];
  const topicName = parts[1];
  const key = `${collectionId}/${topicName}`;
  const folderPath = path.join(wikiRoot, collectionId, topicName);

  const debounceKey = `${key}/PAGE.md`;
  if (pending.has(debounceKey)) clearTimeout(pending.get(debounceKey));

  pending.set(debounceKey, setTimeout(async () => {
    pending.delete(debounceKey);
    console.log(`[WikiHooks] on_${event === 'create' ? 'create' : 'edit'}: ${key}`);
    await rebuildTopicsIndex(wikiRoot);
    await appendLog(folderPath, event === 'create' ? 'Created' : 'Updated');
  }, DEBOUNCE_MS));
}

/**
 * Start watching the wiki tree for changes.
 * Scans all collections, builds the initial topics.json,
 * and subscribes to UEB file:changed events.
 */
function start(wikiRoot) {
  if (!fs.existsSync(wikiRoot)) {
    console.error(`[WikiHooks] Wiki root not found: ${wikiRoot}`);
    return null;
  }

  // Discover collections synchronously for startup
  let collections;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(wikiRoot, 'index.json'), 'utf8'));
    collections = raw.children || [];
  } catch {
    collections = fs.readdirSync(wikiRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }

  // Build initial topics.json
  rebuildTopicsIndex(wikiRoot).catch(err => {
    console.error('[WikiHooks] Failed to build initial topics.json:', err);
  });

  // Subscribe to UEB file events
  unsub = on('file:changed', ({ filePath, event }) => {
    if (!filePath.startsWith(WIKI_CONTENT_PREFIX)) return;
    handleWikiChange(wikiRoot, event, filePath);
  });

  console.log(`[WikiHooks] Watching ${wikiRoot} — ${collections.length} collections`);

  return {
    close() {
      if (unsub) { unsub(); unsub = null; }
      pending.clear();
      console.log('[WikiHooks] Stopped watching');
    }
  };
}

/**
 * Register a callback to be called after every index rebuild.
 * @param {Function} fn - Receives the topicsPath as argument
 */
function setOnIndexRebuilt(fn) { onIndexRebuilt = fn; }

module.exports = { start, rebuildTopicsIndex, setOnIndexRebuilt };
