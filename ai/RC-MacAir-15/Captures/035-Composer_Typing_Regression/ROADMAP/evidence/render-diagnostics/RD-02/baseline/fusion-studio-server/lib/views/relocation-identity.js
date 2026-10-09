'use strict';

const crypto = require('crypto');
const path = require('path');

const WORKSPACE_ID_MAX_BYTES = 128;
const MACHINE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function parseWorkspaceId(value) {
  if (
    typeof value !== 'string'
    || Buffer.byteLength(value, 'utf8') < 1
    || Buffer.byteLength(value, 'utf8') > WORKSPACE_ID_MAX_BYTES
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw new TypeError('workspace identity is invalid');
  return value;
}

function parseMachineIdentity(value) {
  if (
    typeof value !== 'string'
    || value === '.'
    || value === '..'
    || Buffer.byteLength(value, 'utf8') < 1
    || Buffer.byteLength(value, 'utf8') > 128
    || !MACHINE_ID_PATTERN.test(value)
  ) throw new TypeError('machine identity is invalid');
  return value;
}

function canonicalProjectRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) {
    throw new TypeError('project root is invalid');
  }
  return path.resolve(value);
}

function rootIdentity(rootPath, role) {
  const hash = crypto.createHash('sha256');
  hash.update('fusion-view-relocation-root-v1\0', 'utf8');
  hash.update(String(role), 'utf8');
  hash.update('\0', 'utf8');
  hash.update(canonicalProjectRoot(rootPath), 'utf8');
  return hash.digest('hex');
}

function readinessKey(workspaceId, machineIdentity) {
  return `${parseWorkspaceId(workspaceId)}\0${parseMachineIdentity(machineIdentity)}`;
}

module.exports = {
  MACHINE_ID_PATTERN,
  WORKSPACE_ID_MAX_BYTES,
  canonicalProjectRoot,
  parseMachineIdentity,
  parseWorkspaceId,
  readinessKey,
  rootIdentity,
};
