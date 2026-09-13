'use strict';

/**
 * @module views/stable-view-id-preflight
 * @role Registry-owned stable view-ID preflight before any group binding.
 *
 * Before the Thread Group domain binds a session to a view, the central
 * registry scans every discovered capsule under System/Views. A capsule that
 * has no `metadata.view-id` at all receives a new opaque ID through an atomic
 * Fusion-owned manifest-frontmatter write that preserves body, unrelated keys,
 * content root, state, styles, folder suffix, and order. Valid existing IDs are
 * grandfathered. Re-running is a no-op.
 *
 * A present-but-invalid ID, a parse failure, a duplicate effective ID, or a
 * write failure emits a repair-required diagnostic and stops activation; a
 * present identity is never silently rewritten (SPEC-01 §12 proof,
 * CHAT-RD-013, CHAT-I-004). The registry never falls back to the mutable folder
 * suffix and never picks arbitrarily.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const aiPaths = require('../workspace/ai-paths');
const { classifyEntrySync } = require('../fs/dirents');
const { parseSimpleYaml } = require('./simple-yaml');
const { parseCanonicalViewId, ViewIdentityError } = require('./view-id');
const {
  replaceNestedFrontmatterField,
} = require('./workspace-registry-writer');

const REPAIR_REQUIRED = 'view_id_preflight_repair_required';

function mintOpaqueViewId() {
  return `view-${randomUUID()}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function diagnostic(code, message, capsule) {
  return { code, message, ...(capsule ? { capsule } : {}) };
}

function readManifestFrontmatter(manifestPath) {
  let text;
  try {
    text = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return {};
    throw new Error(`View manifest is unreadable: ${error.message}`);
  }
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

/**
 * Discover every capsule folder in registry order. Unlike `listV2ViewFolders`
 * this never parses an identity, so an invalid/missing ID is observable rather
 * than fatal.
 */
function discoverCapsules(projectRoot) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  let dirents;
  try {
    dirents = fs.readdirSync(viewsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
    throw error;
  }
  return dirents
    .filter((entry) => classifyEntrySync(viewsRoot, entry).isDir && !entry.name.startsWith('.'))
    .map((entry) => {
      const match = entry.name.match(/^(\d+)-(.+)$/);
      return {
        folderName: entry.name,
        viewRoot: path.join(viewsRoot, entry.name),
        order: match ? Number(match[1]) : 999,
      };
    })
    .sort((left, right) => {
      const orderDiff = left.order - right.order;
      return orderDiff !== 0 ? orderDiff : left.folderName.localeCompare(right.folderName);
    });
}

/**
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {() => string} [options.mintId]
 * @returns {{ ok: boolean, viewIds: string[], assigned: Array<{capsule: string, viewId: string}>, diagnostics: object[] }}
 */
function runStableViewIdPreflight(projectRoot, options = {}) {
  const mintId = typeof options.mintId === 'function' ? options.mintId : mintOpaqueViewId;
  const diagnostics = [];
  const assigned = [];
  let capsules;
  try {
    capsules = discoverCapsules(projectRoot);
  } catch (error) {
    return { ok: false, viewIds: [], assigned: [], diagnostics: [diagnostic(REPAIR_REQUIRED, error.message)] };
  }
  if (capsules.length === 0) {
    return { ok: true, viewIds: [], assigned: [], diagnostics: [] };
  }

  const entries = capsules.map((capsule) => {
    const manifestPath = path.join(capsule.viewRoot, 'manifest.md');
    let manifest;
    try {
      manifest = readManifestFrontmatter(manifestPath);
    } catch (error) {
      return { ...capsule, manifestPath, parseError: error.message };
    }
    const metadata = isPlainObject(manifest.metadata) ? manifest.metadata : null;
    const manifestId = metadata && Object.hasOwn(metadata, 'view-id')
      ? metadata['view-id']
      : undefined;
    return { ...capsule, manifestPath, manifestId };
  });

  // Parse failures stop before any write so activation cannot half-bind.
  for (const entry of entries) {
    if (entry.parseError) {
      diagnostics.push(diagnostic(REPAIR_REQUIRED, entry.parseError, entry.folderName));
    }
  }

  // Classify each capsule identity:
  //   - valid      → grandfather (no write)
  //   - absent     → assign a minted opaque ID
  //   - invalid    → repair-required stop (SPEC-01 §12 proof, CHAT-RD-013,
  //                  CHAT-I-004): a present noncanonical identity is never
  //                  silently rewritten or downgraded.
  const effective = entries.map((entry) => {
    if (entry.manifestId === undefined) {
      return { ...entry, effectiveId: null, needsAssignment: true };
    }
    try {
      const viewId = parseCanonicalViewId(entry.manifestId, `View capsule ${entry.folderName}`);
      return { ...entry, effectiveId: viewId, needsAssignment: false };
    } catch (error) {
      if (!(error instanceof ViewIdentityError)) throw error;
      diagnostics.push(diagnostic(
        REPAIR_REQUIRED,
        `Invalid metadata.view-id for capsule ${entry.folderName}`,
        entry.folderName,
      ));
      return { ...entry, effectiveId: null, needsAssignment: false };
    }
  });

  // Duplicate detection runs against the pre-write set. Newly minted IDs are
  // unique; existing duplicates are an owner-visible repair.
  const seen = new Map();
  for (const entry of effective) {
    if (entry.effectiveId === null) continue;
    if (seen.has(entry.effectiveId)) {
      diagnostics.push(diagnostic(
        REPAIR_REQUIRED,
        `Duplicate metadata.view-id: ${entry.effectiveId}`,
        `${seen.get(entry.effectiveId)}, ${entry.folderName}`,
      ));
    } else {
      seen.set(entry.effectiveId, entry.folderName);
    }
  }
  if (diagnostics.length > 0) {
    return { ok: false, viewIds: [], assigned: [], diagnostics };
  }

  // Assignment phase: write each absent ID atomically.
  for (const entry of effective) {
    if (!entry.needsAssignment) continue;
    const viewId = mintId();
    try {
      replaceNestedFrontmatterField(entry.manifestPath, 'metadata', 'view-id', viewId);
    } catch (error) {
      diagnostics.push(diagnostic(
        REPAIR_REQUIRED,
        `Unable to assign metadata.view-id for ${entry.folderName}: ${error.message}`,
        entry.folderName,
      ));
      return { ok: false, viewIds: [], assigned, diagnostics };
    }
    entry.effectiveId = viewId;
    assigned.push({ capsule: entry.folderName, viewId });
  }

  const viewIds = effective.map((entry) => entry.effectiveId);
  return { ok: true, viewIds, assigned, diagnostics: [] };
}

module.exports = {
  REPAIR_REQUIRED,
  mintOpaqueViewId,
  runStableViewIdPreflight,
};
