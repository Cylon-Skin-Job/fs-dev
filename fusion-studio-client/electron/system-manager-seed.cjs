const fs = require('fs');
const path = require('path');

const GLOBAL_PALETTE_RELATIVE_PATH = path.join(
  'System_Manager',
  'global-configs',
  'office-custom-color-pallete',
  'colors.json',
);

function pathExists(candidate, fsModule) {
  try {
    fsModule.lstatSync(candidate);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function seedPackagedGlobalConfigs(options = {}) {
  const {
    resourcesPath,
    userDataPath,
    packaged = false,
    fsModule = fs,
  } = options;
  if (!packaged || !resourcesPath || !userDataPath) return { seeded: false, reason: 'development' };

  const source = path.join(path.resolve(resourcesPath), GLOBAL_PALETTE_RELATIVE_PATH);
  const destination = path.join(path.resolve(userDataPath), GLOBAL_PALETTE_RELATIVE_PATH);
  if (pathExists(destination, fsModule)) return { seeded: false, reason: 'existing', destination };

  fsModule.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  try {
    fsModule.copyFileSync(source, destination, fsModule.constants.COPYFILE_EXCL);
    return { seeded: true, destination };
  } catch (error) {
    if (error && error.code === 'EEXIST') return { seeded: false, reason: 'existing', destination };
    throw error;
  }
}

module.exports = { GLOBAL_PALETTE_RELATIVE_PATH, seedPackagedGlobalConfigs };
