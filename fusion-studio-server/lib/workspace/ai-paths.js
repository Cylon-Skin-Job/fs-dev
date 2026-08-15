const os = require('os');
const path = require('path');

const LOCAL_MACHINE_CONFIG_KEY = 'local_machine_name';
let localMachineNameCache = null;

function sanitizeMachineName(value) {
  const fallback = 'local-machine';
  const sanitized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || fallback;
}

function getLocalMachineName() {
  if (process.env.FUSION_LOCAL_MACHINE) {
    return sanitizeMachineName(process.env.FUSION_LOCAL_MACHINE);
  }
  if (localMachineNameCache) return localMachineNameCache;
  return sanitizeMachineName(process.env.FUSION_LOCAL_MACHINE || os.hostname());
}

async function initializeLocalMachineIdentity(options = {}) {
  const db = options.db || require('../db').getDb();
  const fallback = sanitizeMachineName(options.fallback || os.hostname());
  const row = await db('system_config').where('key', LOCAL_MACHINE_CONFIG_KEY).first();
  const machineName = sanitizeMachineName(row?.value || fallback);

  if (!row || row.value !== machineName) {
    await db('system_config')
      .insert({
        key: LOCAL_MACHINE_CONFIG_KEY,
        value: machineName,
        updated_at: Date.now(),
      })
      .onConflict('key')
      .merge(['value', 'updated_at']);
  }

  localMachineNameCache = machineName;
  return machineName;
}

async function setLocalMachineName(machineName, options = {}) {
  const db = options.db || require('../db').getDb();
  const sanitized = sanitizeMachineName(machineName);
  await db('system_config')
    .insert({
      key: LOCAL_MACHINE_CONFIG_KEY,
      value: sanitized,
      updated_at: Date.now(),
    })
    .onConflict('key')
    .merge(['value', 'updated_at']);
  localMachineNameCache = sanitized;
  return sanitized;
}

function getMachineAiRoot(projectRoot, machineName = getLocalMachineName()) {
  return path.join(projectRoot, 'ai', sanitizeMachineName(machineName));
}

function getMachineViewsRoot(projectRoot, machineName = getLocalMachineName()) {
  return path.join(getMachineAiRoot(projectRoot, machineName), 'Views');
}

function hasMachineAiRoot(projectRoot, machineName = getLocalMachineName()) {
  const fs = require('fs');
  try {
    return fs.lstatSync(getMachineAiRoot(projectRoot, machineName)).isDirectory();
  } catch {
    return false;
  }
}

function getSystemRoot(projectRoot, machineName = getLocalMachineName()) {
  return path.join(getMachineAiRoot(projectRoot, machineName), 'System');
}

function getSystemConfigRoot(projectRoot, machineName = getLocalMachineName()) {
  return path.join(getSystemRoot(projectRoot, machineName), 'config');
}

function getSystemStateRoot(projectRoot, machineName = getLocalMachineName()) {
  return path.join(getSystemRoot(projectRoot, machineName), 'state');
}

function getSystemStylesRoot(projectRoot, machineName = getLocalMachineName()) {
  return path.join(getSystemRoot(projectRoot, machineName), 'styles');
}

module.exports = {
  LOCAL_MACHINE_CONFIG_KEY,
  sanitizeMachineName,
  getLocalMachineName,
  initializeLocalMachineIdentity,
  setLocalMachineName,
  getMachineAiRoot,
  getMachineViewsRoot,
  hasMachineAiRoot,
  getSystemRoot,
  getSystemConfigRoot,
  getSystemStateRoot,
  getSystemStylesRoot,
};
