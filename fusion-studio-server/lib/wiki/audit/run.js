/**
 * Audit orchestrator — the `audit` subcommand of scripts/wiki.js.
 *
 * Skeleton phase: marker fills (section-toc) + state file touch. Later
 * phases hook in here in run order: children markers, zone hashing and
 * change classification, computed edges, git freshness, versioning,
 * appears-in blocks (wiki-audit-decisions.md, Sections A/18).
 */

const path = require('path');

const { DEFAULT_WORKSPACE_ROOTS, resolveWikiRoot } = require('../wiki-tree');
const { syncWikiTOCs } = require('./toc-sync');
const { loadState, saveState } = require('./state');

/**
 * Resolve which wiki roots to audit. An explicit input path (workspace
 * root or direct Wiki root) wins; otherwise all known workspace roots
 * with an existing wiki.
 */
function resolveAuditRoots(inputPath) {
  if (inputPath) {
    const context = resolveWikiRoot(inputPath);
    if (!context.exists) {
      throw new Error(`Wiki root not found: ${context.wikiRoot}`);
    }
    return [context.wikiRoot];
  }

  const wikiRoots = [];
  for (const root of DEFAULT_WORKSPACE_ROOTS) {
    const context = resolveWikiRoot(root);
    if (context.exists) {
      wikiRoots.push(context.wikiRoot);
    }
  }
  if (wikiRoots.length === 0) {
    throw new Error('No wiki roots found.');
  }
  return wikiRoots;
}

function workspaceLabel(wikiRoot) {
  return path.basename(
    path.dirname(path.dirname(path.dirname(path.dirname(wikiRoot))))
  );
}

/**
 * Run the audit across one or more wikis.
 *
 * @param {string|null} inputPath - Workspace root or Wiki root; null = all known roots.
 * @returns {{ wikis: Array, totals: { created, updated, skipped } }}
 */
function runAudit(inputPath) {
  const wikiRoots = resolveAuditRoots(inputPath);
  const wikis = [];
  const totals = { created: 0, updated: 0, skipped: 0 };

  for (const wikiRoot of wikiRoots) {
    const result = syncWikiTOCs(wikiRoot);

    const state = loadState(wikiRoot);
    saveState(wikiRoot, state);

    totals.created += result.created;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
    wikis.push({ wikiRoot, label: workspaceLabel(wikiRoot), ...result });
  }

  return { wikis, totals };
}

module.exports = {
  runAudit,
};
