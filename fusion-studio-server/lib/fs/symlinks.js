const fsPromises = require('fs').promises;
const path = require('path');
const { isInsidePath } = require('./dirents');

async function resolveSymlinkInfo(basePath, targetPath) {
  const logicalBase = path.resolve(basePath);
  const logicalTarget = path.resolve(targetPath);
  if (!isInsidePath(logicalBase, logicalTarget)) return {};

  const relative = path.relative(logicalBase, logicalTarget);
  const segments = relative ? relative.split(path.sep).filter(Boolean) : [];
  let currentPath = logicalBase;
  let hasSymlink = false;

  try {
    const baseStat = await fsPromises.lstat(currentPath);
    if (baseStat.isSymbolicLink()) hasSymlink = true;

    for (const segment of segments) {
      currentPath = path.join(currentPath, segment);
      const segmentStat = await fsPromises.lstat(currentPath);
      if (segmentStat.isSymbolicLink()) hasSymlink = true;
    }

    if (!hasSymlink) return {};

    return {
      isSymlink: true,
      symlinkTarget: await fsPromises.realpath(logicalTarget),
    };
  } catch {
    return {};
  }
}

module.exports = {
  resolveSymlinkInfo,
};
