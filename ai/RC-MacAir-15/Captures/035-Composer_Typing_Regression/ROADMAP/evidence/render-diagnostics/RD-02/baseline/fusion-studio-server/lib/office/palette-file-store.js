'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MAX_PALETTE_BYTES } = require('./palette-codec');
const { PaletteError, toPaletteError } = require('./palette-errors');

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function createPaletteFileStore(options = {}) {
  const fsModule = options.fsModule || fs;
  const fsp = fsModule.promises;

  async function inspectPath({ trustedRoot, filePath }, createParents) {
    const root = path.resolve(trustedRoot);
    const target = path.resolve(filePath);
    if (!contained(root, target) || target === root) throw new PaletteError('PATH_REJECTED');

    let rootStat;
    try {
      rootStat = await fsp.lstat(root);
    } catch (error) {
      throw toPaletteError(error, createParents ? 'DIRECTORY_CREATE_FAILED' : 'READ_FAILED');
    }
    if (rootStat.isSymbolicLink()) throw new PaletteError('SYMLINK_REJECTED');
    if (!rootStat.isDirectory()) throw new PaletteError('PATH_REJECTED');

    const parts = path.relative(root, path.dirname(target)).split(path.sep).filter(Boolean);
    let current = root;
    for (const part of parts) {
      current = path.join(current, part);
      let stat;
      try {
        stat = await fsp.lstat(current);
      } catch (error) {
        if (error && error.code === 'ENOENT' && !createParents) return false;
        if (error && error.code === 'ENOENT') {
          try {
            await fsp.mkdir(current);
            stat = await fsp.lstat(current);
          } catch (mkdirError) {
            throw toPaletteError(mkdirError, 'DIRECTORY_CREATE_FAILED');
          }
        } else {
          throw toPaletteError(error);
        }
      }
      if (stat.isSymbolicLink()) throw new PaletteError('SYMLINK_REJECTED');
      if (!stat.isDirectory()) throw new PaletteError('PATH_REJECTED');
    }
    return true;
  }

  async function read(location, options = {}) {
    const enforceSizeLimit = options.enforceSizeLimit !== false;
    if (!(await inspectPath(location, false))) return null;
    let stat;
    try {
      stat = await fsp.lstat(location.filePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw toPaletteError(error);
    }
    if (stat.isSymbolicLink()) throw new PaletteError('SYMLINK_REJECTED');
    if (!stat.isFile()) throw new PaletteError('NOT_REGULAR_FILE');
    if (enforceSizeLimit && stat.size > MAX_PALETTE_BYTES) throw new PaletteError('FILE_TOO_LARGE');

    let handle;
    try {
      const noFollow = fsModule.constants.O_NOFOLLOW || 0;
      handle = await fsp.open(location.filePath, fsModule.constants.O_RDONLY | noFollow);
      const opened = await handle.stat();
      if (!opened.isFile()) throw new PaletteError('NOT_REGULAR_FILE');
      if (enforceSizeLimit && opened.size > MAX_PALETTE_BYTES) throw new PaletteError('FILE_TOO_LARGE');
      const raw = await handle.readFile();
      if (enforceSizeLimit && raw.length > MAX_PALETTE_BYTES) throw new PaletteError('FILE_TOO_LARGE');
      return raw;
    } catch (error) {
      throw toPaletteError(error);
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }

  async function write(location, document) {
    await inspectPath(location, true);
    const raw = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
    if (raw.length > MAX_PALETTE_BYTES) throw new PaletteError('FILE_TOO_LARGE');

    try {
      const existing = await fsp.lstat(location.filePath).catch((error) => {
        if (error && error.code === 'ENOENT') return null;
        throw error;
      });
      if (existing && existing.isSymbolicLink()) throw new PaletteError('SYMLINK_REJECTED');
      if (existing && !existing.isFile()) throw new PaletteError('NOT_REGULAR_FILE');
      if (existing && (existing.mode & 0o222) === 0) throw new PaletteError('READ_ONLY');
    } catch (error) {
      throw toPaletteError(error, 'WRITE_FAILED');
    }

    const temporaryPath = path.join(
      path.dirname(location.filePath),
      `.${path.basename(location.filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
    );
    try {
      await fsp.writeFile(temporaryPath, raw, { flag: 'wx', mode: 0o600 });
      await fsp.rename(temporaryPath, location.filePath);
    } catch (error) {
      await fsp.unlink(temporaryPath).catch(() => {});
      throw toPaletteError(error, 'WRITE_FAILED');
    }
  }

  return Object.freeze({ read, write });
}

module.exports = { createPaletteFileStore };
