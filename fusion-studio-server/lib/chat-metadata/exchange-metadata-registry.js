'use strict';

const collectors = [];

function registerCollector(collector) {
  if (!collector || !collector.id || typeof collector.collect !== 'function') {
    throw new Error('Invalid exchange metadata collector');
  }
  if (collectors.some((entry) => entry.id === collector.id)) return;
  collectors.push(collector);
}

function getCollectors() {
  return [...collectors];
}

function mergeMetadata(base, contribution) {
  const next = { ...(base || {}) };
  for (const [key, value] of Object.entries(contribution || {})) {
    if (Array.isArray(value)) {
      const existing = Array.isArray(next[key]) ? next[key] : [];
      next[key] = dedupeArray([...existing, ...value]);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = { ...(next[key] || {}), ...value };
    } else if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

function stableIdentity(item) {
  if (!item || typeof item !== 'object') return JSON.stringify(item);
  return [
    item.kind || '',
    item.event || '',
    item.path || '',
    item.label || '',
    item.source || '',
    item.ts || '',
  ].join('|');
}

function dedupeArray(items) {
  const seen = new Set();
  const next = [];
  for (const item of items) {
    const id = stableIdentity(item);
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(item);
  }
  return next;
}

module.exports = {
  registerCollector,
  getCollectors,
  mergeMetadata,
};
