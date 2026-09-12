'use strict';

const path = require('path');
const fsPromises = require('fs').promises;

const aiPaths = require('../workspace/ai-paths');
const { validateCapsuleTree } = require('./relocation-content-roots');
const {
  assertDirectoryChainStable,
  captureSafeDirectoryChain,
  collectInventory,
} = require('./relocation-inventory');
const { createViewRelocationJournal } = require('./relocation-journal');
const {
  ViewRelocationCrashError,
  ViewRelocationError,
  toRelocationError,
} = require('./relocation-errors');
const {
  canonicalProjectRoot,
  parseMachineIdentity,
  parseWorkspaceId,
  rootIdentity,
} = require('./relocation-identity');

const CRASH_POINTS = Object.freeze([
  'after_destination_parent',
  'after_planned',
  'after_rename_before_moved',
  'after_moved',
  'after_verified',
]);

async function pathState(targetPath, fs) {
  try {
    const stat = await fs.lstat(targetPath, { bigint: true });
    return { exists: true, stat };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return { exists: false, stat: null };
    throw new ViewRelocationError('filesystem_error');
  }
}

function classifyRoots(sourceState, destinationState) {
  if (sourceState.exists && destinationState.exists) return 'both';
  if (sourceState.exists) return 'old_only';
  if (destinationState.exists) return 'new_only';
  return 'neither';
}

function assertDirectory(state, code) {
  if (!state.exists || state.stat.isSymbolicLink() || !state.stat.isDirectory()) {
    throw new ViewRelocationError(code);
  }
}

function assertRowIdentity(row, expected) {
  if (
    row.source_root_identity_sha256 !== expected.sourceRootIdentity
    || row.destination_root_identity_sha256 !== expected.destinationRootIdentity
  ) throw new ViewRelocationError('root_identity_mismatch');
}

function assertDirectoryIdentity(stat, row) {
  if (stat.dev.toString() !== row.directory_device || stat.ino.toString() !== row.directory_inode) {
    throw new ViewRelocationError('directory_identity_mismatch');
  }
}

function assertInventoryIdentity(inventory, stat) {
  if (
    inventory.directoryDevice !== stat.dev.toString()
    || inventory.directoryInode !== stat.ino.toString()
  ) throw new ViewRelocationError('inventory_changed');
}

async function syncDirectory(directory, fs) {
  if (typeof fs.open !== 'function') return;
  let handle;
  try {
    handle = await fs.open(directory, 'r');
    if (typeof handle.sync === 'function') await handle.sync();
  } finally {
    if (handle && typeof handle.close === 'function') await handle.close();
  }
}

function createViewRelocationService({
  db,
  fs = fsPromises,
  now = Date.now,
  crashInjector = async () => undefined,
} = {}) {
  if (typeof db !== 'function' || typeof crashInjector !== 'function') {
    throw new TypeError('view relocation service dependencies are required');
  }
  const journal = createViewRelocationJournal({ db, now });

  async function inject(point) {
    await crashInjector(point);
  }

  async function describe(input) {
    const workspaceId = parseWorkspaceId(input.workspaceId);
    const machineIdentity = parseMachineIdentity(input.machineIdentity);
    const projectRoot = canonicalProjectRoot(input.projectRoot);
    let realProjectRoot;
    try {
      realProjectRoot = await fs.realpath(projectRoot);
    } catch (_error) {
      throw new ViewRelocationError('workspace_unavailable');
    }
    if (path.resolve(realProjectRoot) !== projectRoot) {
      throw new ViewRelocationError('workspace_identity_mismatch');
    }
    const sourceRoot = aiPaths.getMigrationSourceViewsRoot(projectRoot, machineIdentity);
    const destinationRoot = aiPaths.getCanonicalMachineViewsRoot(projectRoot, machineIdentity);
    return Object.freeze({
      workspaceId,
      machineIdentity,
      projectRoot,
      sourceRoot,
      destinationRoot,
      sourceRootIdentity: rootIdentity(sourceRoot, 'source'),
      destinationRootIdentity: rootIdentity(destinationRoot, 'destination'),
      allowViewless: input.allowViewless === true,
    });
  }

  async function inspectRoots(context) {
    const [sourceState, destinationState] = await Promise.all([
      pathState(context.sourceRoot, fs),
      pathState(context.destinationRoot, fs),
    ]);
    return { sourceState, destinationState, classification: classifyRoots(sourceState, destinationState) };
  }

  async function inventoryAndValidate(context, currentRoot, projectedRoot) {
    const ancestry = await captureSafeDirectoryChain(context.projectRoot, currentRoot, fs);
    const inventory = await collectInventory({
      sourceRoot: currentRoot,
      destinationRoot: projectedRoot,
      fs,
    });
    const entries = await validateCapsuleTree({
      ...context,
      currentRoot,
      projectedRoot,
      fs,
    });
    await assertDirectoryChainStable(ancestry, fs);
    return { inventory, entries, ancestry };
  }

  async function prepareDestinationParent(context, sourceStat) {
    const destinationParentPath = path.dirname(context.destinationRoot);
    await fs.mkdir(destinationParentPath, { recursive: true });
    const destinationParent = await fs.lstat(destinationParentPath, { bigint: true });
    if (!destinationParent.isDirectory() || destinationParent.isSymbolicLink()) {
      throw new ViewRelocationError('destination_parent_invalid');
    }
    if (destinationParent.dev !== sourceStat.dev) throw new ViewRelocationError('cross_device');
    if ((await pathState(context.destinationRoot, fs)).exists) {
      throw new ViewRelocationError('destination_collision');
    }
    await Promise.all([
      syncDirectory(destinationParentPath, fs),
      syncDirectory(path.dirname(destinationParentPath), fs),
    ]);
    return captureSafeDirectoryChain(context.projectRoot, destinationParentPath, fs);
  }

  async function verifyDestination(context, row, { compareDigest }) {
    const roots = await inspectRoots(context);
    if (roots.classification !== 'new_only') {
      throw new ViewRelocationError(roots.classification === 'both' ? 'root_conflict' : 'recovery_root_mismatch');
    }
    assertDirectory(roots.destinationState, 'destination_not_directory');
    assertDirectoryIdentity(roots.destinationState.stat, row);
    if (compareDigest) {
      const { inventory } = await inventoryAndValidate(
        context,
        context.destinationRoot,
        context.destinationRoot,
      );
      if (inventory.digest !== row.inventory_sha256) {
        throw new ViewRelocationError('inventory_mismatch');
      }
    } else {
      const ancestry = await captureSafeDirectoryChain(
        context.projectRoot,
        context.destinationRoot,
        fs,
      );
      await validateCapsuleTree({
        ...context,
        currentRoot: context.destinationRoot,
        projectedRoot: context.destinationRoot,
        fs,
      });
      await assertDirectoryChainStable(ancestry, fs);
    }
  }

  async function finishMove(context, row, { sourceAlreadyMoved = false, ancestry = [] } = {}) {
    let currentRow = row;
    if (!sourceAlreadyMoved) {
      for (const snapshot of ancestry) await assertDirectoryChainStable(snapshot, fs);
      await fs.rename(context.sourceRoot, context.destinationRoot);
      await Promise.all([
        syncDirectory(path.dirname(context.sourceRoot), fs),
        syncDirectory(path.dirname(context.destinationRoot), fs),
      ]);
      await inject('after_rename_before_moved');
    }
    currentRow = await journal.transition(context, 'planned', 'moved');
    await inject('after_moved');
    await verifyDestination(context, currentRow, { compareDigest: true });
    currentRow = await journal.transition(context, 'moved', 'verified');
    await inject('after_verified');
    return currentRow;
  }

  async function migrateOldOnly(context) {
    const sourceState = await pathState(context.sourceRoot, fs);
    assertDirectory(sourceState, 'source_not_directory');
    const { inventory, ancestry: sourceAncestry } = await inventoryAndValidate(
      context,
      context.sourceRoot,
      context.destinationRoot,
    );
    assertInventoryIdentity(inventory, sourceState.stat);
    const destinationAncestry = await prepareDestinationParent(context, sourceState.stat);
    await inject('after_destination_parent');
    const row = await journal.createPlanned({
      ...context,
      directoryDevice: sourceState.stat.dev.toString(),
      directoryInode: sourceState.stat.ino.toString(),
      inventoryDigest: inventory.digest,
    });
    await inject('after_planned');
    return finishMove(context, row, { ancestry: [sourceAncestry, destinationAncestry] });
  }

  async function adoptNewOnly(context, destinationState) {
    assertDirectory(destinationState, 'destination_not_directory');
    const { inventory } = await inventoryAndValidate(
      context,
      context.destinationRoot,
      context.destinationRoot,
    );
    assertInventoryIdentity(inventory, destinationState.stat);
    const row = await journal.createVerified({
      ...context,
      directoryDevice: destinationState.stat.dev.toString(),
      directoryInode: destinationState.stat.ino.toString(),
      inventoryDigest: inventory.digest,
    });
    await inject('after_verified');
    return row;
  }

  async function adoptViewless(context) {
    if (!context.allowViewless) throw new ViewRelocationError('viewless_not_allowed');
    // A genuinely viewless workspace can be missing the whole machine tree.
    // Pin every existing lexical ancestor before mkdir so recursive creation
    // cannot follow a pre-existing workspace symlink and mutate another tree.
    const existingAncestry = await captureSafeDirectoryChain(
      context.projectRoot,
      context.destinationRoot,
      fs,
      { allowMissing: true },
    );
    await assertDirectoryChainStable(existingAncestry, fs);
    await fs.mkdir(path.dirname(context.destinationRoot), { recursive: true });
    await fs.mkdir(context.destinationRoot, { recursive: false });
    await syncDirectory(path.dirname(context.destinationRoot), fs);
    await captureSafeDirectoryChain(context.projectRoot, context.destinationRoot, fs);
    const destinationState = await pathState(context.destinationRoot, fs);
    return adoptNewOnly(context, destinationState);
  }

  async function recover(context, row, roots) {
    assertRowIdentity(row, context);
    if (row.status === 'failed') throw new ViewRelocationError('migration_already_failed', undefined, { journalFailure: false });
    if (row.status === 'verified') {
      await verifyDestination(context, row, { compareDigest: false });
      return row;
    }
    if (row.status === 'planned' && roots.classification === 'old_only') {
      assertDirectory(roots.sourceState, 'source_not_directory');
      assertDirectoryIdentity(roots.sourceState.stat, row);
      const { inventory, ancestry: sourceAncestry } = await inventoryAndValidate(
        context,
        context.sourceRoot,
        context.destinationRoot,
      );
      assertInventoryIdentity(inventory, roots.sourceState.stat);
      if (inventory.digest !== row.inventory_sha256) throw new ViewRelocationError('inventory_mismatch');
      const destinationAncestry = await prepareDestinationParent(context, roots.sourceState.stat);
      return finishMove(context, row, { ancestry: [sourceAncestry, destinationAncestry] });
    }
    if (row.status === 'planned' && roots.classification === 'new_only') {
      await verifyDestination(context, row, { compareDigest: true });
      return finishMove(context, row, { sourceAlreadyMoved: true });
    }
    if (row.status === 'moved' && roots.classification === 'new_only') {
      await verifyDestination(context, row, { compareDigest: true });
      const verified = await journal.transition(context, 'moved', 'verified');
      await inject('after_verified');
      return verified;
    }
    throw new ViewRelocationError(roots.classification === 'both' ? 'root_conflict' : 'recovery_root_mismatch');
  }

  async function ensureReady(input) {
    const context = await describe(input);
    let row = await journal.get(context);
    try {
      const roots = await inspectRoots(context);
      if (row) row = await recover(context, row, roots);
      else if (roots.classification === 'old_only') row = await migrateOldOnly(context);
      else if (roots.classification === 'new_only') row = await adoptNewOnly(context, roots.destinationState);
      else if (roots.classification === 'neither') row = await adoptViewless(context);
      else throw new ViewRelocationError('root_conflict');
      return Object.freeze({
        status: 'verified',
        workspaceId: context.workspaceId,
        machineIdentity: context.machineIdentity,
        projectRoot: context.projectRoot,
        destinationRoot: context.destinationRoot,
        journal: row,
      });
    } catch (error) {
      const normalized = toRelocationError(error);
      if (normalized instanceof ViewRelocationCrashError) throw normalized;
      row = row || await journal.get(context);
      if (row && ['planned', 'moved'].includes(row.status) && normalized.journalFailure !== false) {
        await journal.fail(context, normalized.code);
      }
      throw normalized;
    }
  }

  return Object.freeze({ CRASH_POINTS, ensureReady, journal });
}

module.exports = {
  CRASH_POINTS,
  classifyRoots,
  createViewRelocationService,
};
