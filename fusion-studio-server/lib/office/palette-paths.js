'use strict';

const path = require('path');
const resourcesResolver = require('../resources/resolver');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIRECTORY = 'office-custom-color-pallete';

function environmentUserDataRoot() {
  return process.env.FUSION_APP_PACKAGED === '1'
    ? process.env.FUSION_APP_USER_DATA || null
    : null;
}

function createPalettePathHelper(options = {}) {
  const getResourcesRoot = options.getResourcesRoot || resourcesResolver.getResourcesRoot;
  const getUserDataRoot = options.getUserDataRoot || environmentUserDataRoot;
  const repoRoot = path.resolve(options.repoRoot || REPO_ROOT);

  function getSystemManagerRoot() {
    const userDataRoot = getUserDataRoot();
    return userDataRoot
      ? path.join(path.resolve(userDataRoot), 'System_Manager')
      : path.join(repoRoot, 'System_Manager');
  }

  function getGlobalLocation() {
    const userDataRoot = getUserDataRoot();
    const trustedRoot = userDataRoot ? path.resolve(userDataRoot) : path.join(repoRoot, 'System_Manager');
    const systemManagerRoot = userDataRoot
      ? path.join(trustedRoot, 'System_Manager')
      : trustedRoot;
    return {
      trustedRoot,
      filePath: path.join(systemManagerRoot, 'global-configs', GLOBAL_DIRECTORY, 'colors.json'),
    };
  }

  function getPackagedSeedLocation() {
    const resourcesRoot = path.resolve(getResourcesRoot());
    return {
      trustedRoot: resourcesRoot,
      filePath: path.join(
        resourcesRoot,
        'System_Manager',
        'global-configs',
        GLOBAL_DIRECTORY,
        'colors.json',
      ),
    };
  }

  function getLocalLocation(workspaceRoot, configRoot) {
    return {
      trustedRoot: path.resolve(workspaceRoot),
      filePath: path.join(path.resolve(configRoot), 'colors.json'),
    };
  }

  return Object.freeze({
    getSystemManagerRoot,
    getGlobalLocation,
    getPackagedSeedLocation,
    getLocalLocation,
  });
}

module.exports = { GLOBAL_DIRECTORY, createPalettePathHelper };
