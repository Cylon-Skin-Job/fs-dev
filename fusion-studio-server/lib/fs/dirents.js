'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

async function classifyEntry(parentDir, dirent) {
  const name = dirent.name;
  const fullPath = path.join(parentDir, name);
  let isDir = dirent.isDirectory();
  let isFile = dirent.isFile();
  let isSymlink = dirent.isSymbolicLink();

  if (!isSymlink && (isDir || isFile)) {
    try {
      const lstat = await fsPromises.lstat(fullPath);
      if (lstat.isSymbolicLink()) {
        isSymlink = true;
      }
    } catch (_) {}
  }

  if (isSymlink) {
    try {
      const realStat = await fsPromises.stat(fullPath);
      const realPath = await fsPromises.realpath(fullPath);
      return {
        name,
        isDir: realStat.isDirectory(),
        isFile: realStat.isFile(),
        isSymlink: true,
        realPath,
      };
    } catch (_) {
      return {
        name,
        isDir: false,
        isFile: false,
        isSymlink: true,
        realPath: null,
      };
    }
  }

  return {
    name,
    isDir,
    isFile,
    isSymlink: false,
    realPath: undefined,
  };
}

function classifyEntrySync(parentDir, dirent) {
  const name = dirent.name;
  const fullPath = path.join(parentDir, name);
  let isDir = dirent.isDirectory();
  let isFile = dirent.isFile();
  let isSymlink = dirent.isSymbolicLink();

  if (!isSymlink && (isDir || isFile)) {
    try {
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) {
        isSymlink = true;
      }
    } catch (_) {}
  }

  if (isSymlink) {
    try {
      const realStat = fs.statSync(fullPath);
      const realPath = fs.realpathSync(fullPath);
      return {
        name,
        isDir: realStat.isDirectory(),
        isFile: realStat.isFile(),
        isSymlink: true,
        realPath,
      };
    } catch (_) {
      return {
        name,
        isDir: false,
        isFile: false,
        isSymlink: true,
        realPath: null,
      };
    }
  }

  return {
    name,
    isDir,
    isFile,
    isSymlink: false,
    realPath: undefined,
  };
}

function isInsidePath(rootPath, targetPath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

module.exports = {
  classifyEntry,
  classifyEntrySync,
  isInsidePath,
};
