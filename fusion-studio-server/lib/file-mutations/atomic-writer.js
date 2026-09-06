'use strict';

const fs = require('fs');
const path = require('path');
const { fingerprint, isInside } = require('./path-authority');
const { sha256 } = require('./text-codec');
const { MAX_SNAPSHOT_BYTES } = require('./file-version-repository');
const { readFileHandleBounded } = require('./bounded-file-read');

class AtomicWriteError extends Error {
  constructor(message, { code, renamed = false, tempPath = null } = {}) {
    super(message);
    this.name = 'AtomicWriteError';
    this.code = code || (renamed ? 'mutation_outcome_unknown' : 'write_prepare_failed');
    this.renamed = renamed;
    this.tempPath = tempPath;
  }
}

function classifyFsFailure(error, fallback) {
  return ['EACCES', 'EPERM', 'EROFS'].includes(error?.code) ? 'permission_denied' : fallback;
}

function createAtomicWriter({ fsPromises = fs.promises } = {}) {
  function tempPathFor(target, operationId) {
    return path.join(path.dirname(target.targetPath), `.fusion-save-${operationId}.tmp`);
  }

  function sameDirectoryIdentity(expected, actual) {
    return expected
      && String(actual.dev) === expected.dev
      && String(actual.ino) === expected.ino
      && actual.isDirectory();
  }

  function sameFileIdentity(expected, actual) {
    return expected
      && String(actual.dev) === expected.dev
      && String(actual.ino) === expected.ino
      && actual.isFile();
  }

  async function verifyParent(target, directoryHandle = null) {
    const parentPath = path.dirname(target.targetPath);
    const parentAgain = await fsPromises.realpath(parentPath);
    if (
      parentAgain !== target.parentReal
      || !isInside(target.workspaceReal, parentAgain)
      || !isInside(target.panelReal, parentAgain)
    ) throw new AtomicWriteError('Target parent authority changed.', { code: 'preimage_conflict' });
    const pathStat = await fsPromises.lstat(parentAgain);
    if (pathStat.isSymbolicLink() || !sameDirectoryIdentity(target.parentFingerprint, pathStat)) {
      throw new AtomicWriteError('Target parent identity changed.', { code: 'preimage_conflict' });
    }
    if (directoryHandle) {
      const openedStat = await directoryHandle.stat();
      if (!sameDirectoryIdentity(target.parentFingerprint, openedStat)) {
        throw new AtomicWriteError('Opened target parent identity changed.', { code: 'preimage_conflict' });
      }
    }
    return parentAgain;
  }

  async function verifyWrittenTemp(tempPath, expectedFingerprint, expectedBytes) {
    let verifyHandle = null;
    try {
      const noFollow = fs.constants.O_NOFOLLOW;
      if (!Number.isInteger(noFollow)) throw new Error('no-follow open is unavailable');
      const pathStat = await fsPromises.lstat(tempPath);
      if (
        pathStat.isSymbolicLink()
        || !pathStat.isFile()
        || String(pathStat.dev) !== expectedFingerprint.dev
        || String(pathStat.ino) !== expectedFingerprint.ino
        || pathStat.size !== expectedBytes.length
      ) throw new Error('operation temp identity changed');
      verifyHandle = await fsPromises.open(tempPath, fs.constants.O_RDONLY | noFollow);
      const openedStat = await verifyHandle.stat();
      if (
        !openedStat.isFile()
        || String(openedStat.dev) !== expectedFingerprint.dev
        || String(openedStat.ino) !== expectedFingerprint.ino
        || openedStat.size !== expectedBytes.length
      ) throw new Error('opened operation temp identity changed');
      const observedBytes = await readFileHandleBounded(verifyHandle);
      if (!observedBytes.equals(expectedBytes)) throw new Error('operation temp bytes changed');
      const pathAgain = await fsPromises.lstat(tempPath);
      if (!sameFileIdentity(expectedFingerprint, pathAgain) || pathAgain.size !== expectedBytes.length) {
        throw new Error('operation temp pathname changed');
      }
      return verifyHandle;
    } catch (_error) {
      try { await verifyHandle?.close(); } catch (_closeError) {}
      throw new AtomicWriteError('Operation temp changed before replacement.', {
        code: 'preimage_conflict', tempPath,
      });
    }
  }

  async function verifyFinalTarget({ target, mutationKind, preimageSha256, tempPath }) {
    let current = null;
    try {
      current = await fsPromises.lstat(target.targetPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (mutationKind === 'create') {
      if (current) throw new AtomicWriteError('Target appeared before replacement.', {
        code: 'preimage_conflict', tempPath,
      });
      return;
    }
    if (!current || current.isSymbolicLink() || !sameFileIdentity(target.fingerprint, current)) {
      throw new AtomicWriteError('Target identity changed before replacement.', {
        code: 'preimage_conflict', tempPath,
      });
    }
    if (!Number.isInteger(fs.constants.O_NOFOLLOW)) {
      throw new AtomicWriteError('Safe target recheck is unavailable.', {
        code: 'preimage_conflict', tempPath,
      });
    }
    let currentHandle;
    try {
      currentHandle = await fsPromises.open(
        target.targetPath,
        fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
      );
      const openedStat = await currentHandle.stat();
      if (!sameFileIdentity(target.fingerprint, openedStat) || openedStat.size > MAX_SNAPSHOT_BYTES) {
        throw new Error('target is no longer a supported regular file');
      }
      const currentBytes = await readFileHandleBounded(currentHandle);
      const pathAgain = await fsPromises.lstat(target.targetPath);
      const openedAgain = await currentHandle.stat();
      if (
        !sameFileIdentity(target.fingerprint, pathAgain)
        || !sameFileIdentity(target.fingerprint, openedAgain)
        || sha256(currentBytes) !== preimageSha256
      ) throw new Error('target changed during final verification');
      await currentHandle.close();
      currentHandle = null;
    } catch (error) {
      try { await currentHandle?.close(); } catch (_closeError) {}
      throw new AtomicWriteError('Target changed before replacement.', {
        code: classifyFsFailure(error, 'preimage_conflict'), tempPath,
      });
    }
  }

  async function replace({ target, operationId, bytes, mutationKind, preimageSha256 }) {
    const tempPath = tempPathFor(target, operationId);
    let handle = null;
    let directory = null;
    let verifiedTempHandle = null;
    let renamed = false;
    let writtenFingerprint = null;
    try {
      await verifyParent(target);
      directory = await fsPromises.open(target.parentReal, 'r');
      await verifyParent(target, directory);
      handle = await fsPromises.open(tempPath, 'wx', 0o600);
      // Recheck after pathname-based creation and before any intended bytes are
      // disclosed. The held directory handle pins the authorized identity for
      // all subsequent checks and directory durability.
      await verifyParent(target, directory);
      await handle.writeFile(bytes);
      await handle.sync();
      writtenFingerprint = fingerprint(await handle.stat());
      await handle.close();
      handle = null;

      verifiedTempHandle = await verifyWrittenTemp(tempPath, writtenFingerprint, bytes);
      await verifyParent(target, directory);
      await verifyFinalTarget({ target, mutationKind, preimageSha256, tempPath });
      try {
        await fsPromises.rename(tempPath, target.targetPath);
        renamed = true;
      } catch (error) {
        throw new AtomicWriteError('Atomic replacement failed.', {
          code: classifyFsFailure(error, 'replace_failed'), tempPath,
        });
      }

      try {
        const replacedStat = await fsPromises.lstat(target.targetPath);
        const openedTempStat = await verifiedTempHandle.stat();
        if (
          !sameFileIdentity(writtenFingerprint, replacedStat)
          || !sameFileIdentity(writtenFingerprint, openedTempStat)
          || replacedStat.size !== bytes.length
          || openedTempStat.size !== bytes.length
        ) throw new Error('renamed target identity changed');
        await verifiedTempHandle.close();
        verifiedTempHandle = null;
      } catch (_error) {
        try { await verifiedTempHandle?.close(); } catch (_closeError) {}
        verifiedTempHandle = null;
        throw new AtomicWriteError('Replacement identity is uncertain.', {
          code: 'mutation_outcome_unknown', renamed: true, tempPath,
        });
      }

      try {
        await directory.sync();
      } catch (_error) {
        try { await directory?.close(); } catch (_closeError) {}
        throw new AtomicWriteError('Replacement durability is uncertain.', {
          code: 'mutation_outcome_unknown', renamed: true, tempPath,
        });
      }
      // A close failure after a successful directory sync cannot revoke the
      // already-established durability claim.
      try { await directory.close(); } catch (_closeError) {}
      directory = null;
      return Object.freeze({ tempPath, renamed: true, fingerprint: writtenFingerprint });
    } catch (error) {
      if (handle) {
        try { await handle.close(); } catch (_closeError) {}
      }
      if (directory) {
        try { await directory.close(); } catch (_closeError) {}
      }
      if (verifiedTempHandle) {
        try { await verifiedTempHandle.close(); } catch (_closeError) {}
      }
      if (error instanceof AtomicWriteError) throw error;
      throw new AtomicWriteError('Atomic write preparation failed.', {
        code: renamed ? 'mutation_outcome_unknown' : classifyFsFailure(error, 'write_prepare_failed'),
        renamed,
        tempPath,
      });
    }
  }

  async function cleanup({ target, operationId }) {
    const tempPath = tempPathFor(target, operationId);
    try {
      await verifyParent(target);
      await fsPromises.unlink(tempPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  return Object.freeze({ cleanup, replace, tempPathFor });
}

module.exports = { AtomicWriteError, createAtomicWriter };
