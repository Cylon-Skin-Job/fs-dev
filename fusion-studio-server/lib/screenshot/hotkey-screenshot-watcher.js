/**
 * @module hotkey-screenshot-watcher
 * @role Watch the macOS screenshot folder and copy new shots into the active workspace.
 *
 * Uses the centralized chokidar watcher (lib/watch/core.js). Only copies
 * files while the Fusion Studio app is focused, and only while an active
 * workspace is available.
 */

const fs = require('fs');
const path = require('path');
const { subscribe, unsubscribe } = require('../watch/core');
const sourceFolderService = require('./source-folder-service');
const workspaceController = require('../workspace/workspace-controller');
const aiPaths = require('../workspace/ai-paths');

const SUBSCRIBER_ID = 'macos-screenshots';
const SCREENSHOT_NAME_REGEX = /^Screenshot .*\.(png|jpg|jpeg)$/i;

let currentWatchPath = null;

function getFocusStateFilePath() {
  return process.env.FUSION_FOCUS_STATE_PATH || null;
}

function readAppFocused() {
  const filePath = getFocusStateFilePath();
  if (!filePath) return false;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const state = JSON.parse(raw);
    return state.focused === true;
  } catch {
    return false;
  }
}

function getWorkspaceScreenshotsDir() {
  const activeWorkspace = workspaceController.getActiveWorkspaceSync();
  if (!activeWorkspace || !activeWorkspace.repo_path) return null;
  return path.join(aiPaths.getMachineAiRoot(activeWorkspace.repo_path), 'Data', 'Screenshots');
}

async function ensureDir(dir) {
  if (fs.existsSync(dir)) return;
  await fs.promises.mkdir(dir, { recursive: true });
}

async function copyToWorkspace(sourcePath) {
  const targetDir = getWorkspaceScreenshotsDir();
  if (!targetDir) {
    console.log('[ScreenshotWatcher] No active workspace — skipping screenshot');
    return;
  }

  if (!readAppFocused()) {
    console.log('[ScreenshotWatcher] App not focused — skipping screenshot');
    return;
  }

  const fileName = path.basename(sourcePath);
  const targetPath = path.join(targetDir, fileName);

  await ensureDir(targetDir);
  await fs.promises.copyFile(sourcePath, targetPath);
  console.log(`[ScreenshotWatcher] Copied ${fileName} to workspace screenshots`);
}

function handleFileEvent(event, filePath) {
  if (event !== 'add') return;
  if (!SCREENSHOT_NAME_REGEX.test(path.basename(filePath))) return;
  copyToWorkspace(filePath).catch((err) => {
    console.error('[ScreenshotWatcher] Failed to copy screenshot:', err.message);
  });
}

async function start() {
  const watchPath = await sourceFolderService.refresh();
  if (!watchPath || !fs.existsSync(watchPath)) {
    console.warn('[ScreenshotWatcher] Screenshot source folder does not exist:', watchPath);
    return;
  }

  if (currentWatchPath === watchPath) {
    return;
  }

  if (currentWatchPath) {
    unsubscribe(SUBSCRIBER_ID);
  }

  currentWatchPath = watchPath;
  subscribe({
    id: SUBSCRIBER_ID,
    path: watchPath,
    options: { depth: 0, ignoreInitial: true },
    handler: handleFileEvent,
  });

  console.log(`[ScreenshotWatcher] Watching ${watchPath}`);
}

async function refresh() {
  await start();
}

function stop() {
  if (currentWatchPath) {
    unsubscribe(SUBSCRIBER_ID);
    currentWatchPath = null;
  }
}

module.exports = {
  start,
  refresh,
  stop,
};
