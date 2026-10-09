'use strict';

const path = require('path');
const { parseCanonicalViewId } = require('./view-id');

const VIEW_CAPSULE_PROJECTION_VERSION = 1;
const MAX_VIEW_CAPSULE_PROJECTION_ENTRIES = 256;
const MACHINE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function parseProjectionWorkspaceId(value) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || Buffer.byteLength(value, 'utf8') > 256
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('View capsule projection requires a canonical workspace id');
  }
  return value;
}

function parseProjectionFolderName(value) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || Buffer.byteLength(value, 'utf8') > 255
    || value === '.'
    || value === '..'
    || path.basename(value) !== value
    || value.includes('/')
    || value.includes('\\')
    || value.includes('\0')
  ) {
    throw new Error('View capsule projection contains an invalid folder basename');
  }
  return value;
}

function buildViewCapsulesProjection({ workspaceId, machineIdentity, entries }) {
  const canonicalWorkspaceId = parseProjectionWorkspaceId(workspaceId);
  if (
    typeof machineIdentity !== 'string'
    || machineIdentity === '.'
    || machineIdentity === '..'
    || Buffer.byteLength(machineIdentity, 'utf8') > 128
    || !MACHINE_ID_PATTERN.test(machineIdentity)
  ) {
    throw new Error('View capsule projection requires a canonical machine identity');
  }
  if (!Array.isArray(entries) || entries.length > MAX_VIEW_CAPSULE_PROJECTION_ENTRIES) {
    throw new Error('View capsule projection exceeds the supported entry limit');
  }

  const seenFolders = new Set();
  const capsules = entries.map((entry) => {
    const folderName = parseProjectionFolderName(entry.folderName);
    if (seenFolders.has(folderName)) {
      throw new Error('View capsule projection contains a duplicate folder basename');
    }
    seenFolders.add(folderName);
    return Object.freeze({ viewId: parseCanonicalViewId(entry.id), folderName });
  });

  return Object.freeze({
    version: VIEW_CAPSULE_PROJECTION_VERSION,
    workspaceId: canonicalWorkspaceId,
    machineIdentity,
    entries: Object.freeze(capsules),
  });
}

module.exports = {
  VIEW_CAPSULE_PROJECTION_VERSION,
  MAX_VIEW_CAPSULE_PROJECTION_ENTRIES,
  buildViewCapsulesProjection,
  parseProjectionFolderName,
  parseProjectionWorkspaceId,
};
