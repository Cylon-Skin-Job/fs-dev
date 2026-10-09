/**
 * Screenshot WebSocket handlers.
 *
 * Handles client messages for capturing and retrieving screenshots.
 * Returns a map keyed by message type for delegation from client-message-router.
 */

const fs = require('fs');
const path = require('path');
const screenshotService = require('../workspace/screenshot-service');
const workspaceState = require('../workspace/workspace-state');
const workspaceController = require('../workspace/workspace-controller');
const aiPaths = require('../workspace/ai-paths');
const sourceFolderService = require('./source-folder-service');
const hotkeyScreenshotWatcher = require('./hotkey-screenshot-watcher');
const { assertGenericViewMutationAllowed } = require('../views/protected-path-policy');

async function prepareFileScreenshot(workspaceId) {
  const activeWorkspace = workspaceController.getActiveWorkspaceSync();
  if (!activeWorkspace || activeWorkspace.id !== workspaceId || !activeWorkspace.repo_path) {
    throw new Error('Workspace mismatch or no active workspace');
  }
  const targetDir = path.join(aiPaths.getMachineAiRoot(activeWorkspace.repo_path), 'Data', 'Screenshots');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetPath = path.join(targetDir, `fusion-capture-${timestamp}.png`);
  await assertGenericViewMutationAllowed({
    projectRoot: activeWorkspace.repo_path,
    paths: [targetDir, targetPath],
  });
  return { targetDir, targetPath };
}

async function saveFileScreenshot(dataUrl, { targetDir, targetPath }) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  await fs.promises.mkdir(targetDir, { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);

  return targetPath;
}

function createScreenshotHandlers({ getAllClients }) {
  return {
    'screenshot:capture': async (ws, msg) => {
      const { workspaceId, dataUrl, panelId } = msg;
      if (!workspaceId || typeof dataUrl !== 'string') {
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          message: 'screenshot:capture requires workspaceId and dataUrl',
        }));
        return;
      }

      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      await screenshotService.save(workspaceId, buffer, panelId || null);

      ws.send(JSON.stringify({
        type: 'screenshot:updated',
        workspaceId,
        panelId: panelId || null,
        capturedAt: Date.now(),
      }));
    },

    'screenshot:request': async (ws, msg) => {
      const { workspaceId } = msg;
      if (!workspaceId) {
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          message: 'screenshot:request requires workspaceId',
        }));
        return;
      }

      const row = await screenshotService.get(workspaceId);
      const workspaces = await workspaceController.listWorkspaces();
      const workspace = workspaces.find((item) => item.id === workspaceId);
      const repoPath = workspace ? (workspace.repoPath || workspace.repo_path) : null;
      const savedState = workspaceState.get(workspaceId, { repoPath });
      if (!row || !row.screenshot_png) {
        ws.send(JSON.stringify({
          type: 'screenshot:missing',
          workspaceId,
          activePanelId: savedState ? savedState.currentPanel : null,
        }));
        return;
      }

      const dataUrl = `data:image/png;base64,${row.screenshot_png.toString('base64')}`;
      ws.send(JSON.stringify({
        type: 'screenshot:data',
        workspaceId,
        panelId: row.panel_id,
        activePanelId: savedState?.currentPanel || row.panel_id || null,
        dataUrl,
        capturedAt: row.captured_at,
      }));
    },

    'screenshot:list': async (ws, _msg) => {
      const rows = await screenshotService.list();
      const workspaces = await workspaceController.listWorkspaces();
      const workspaceStates = workspaceState.loadAll(workspaces);
      ws.send(JSON.stringify({
        type: 'screenshot:list',
        screenshots: rows.map((r) => ({
          workspaceId: r.workspace_id,
          panelId: r.panel_id,
          activePanelId: workspaceStates[r.workspace_id]?.currentPanel || r.panel_id || null,
          capturedAt: r.captured_at,
        })),
        activePanels: Object.entries(workspaceStates).map(([workspaceId, state]) => ({
          workspaceId,
          activePanelId: state.currentPanel || null,
        })),
      }));
    },

    'screenshot:file-capture': async (ws, msg) => {
      const { workspaceId, dataUrl, requestId } = msg;
      if (!workspaceId || typeof dataUrl !== 'string') {
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          ...(requestId ? { requestId } : {}),
          message: 'screenshot:file-capture requires workspaceId and dataUrl',
        }));
        return;
      }

      try {
        const prepared = await prepareFileScreenshot(workspaceId);
        await sourceFolderService.refresh();
        await hotkeyScreenshotWatcher.refresh();
        const savedPath = await saveFileScreenshot(dataUrl, prepared);
        ws.send(JSON.stringify({
          type: 'screenshot:file-captured',
          ...(requestId ? { requestId } : {}),
          workspaceId,
          savedPath,
          capturedAt: Date.now(),
        }));
      } catch (err) {
        console.error('[ScreenshotHandler] file-capture failed:', err.message);
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          ...(requestId ? { requestId } : {}),
          message: err.message,
        }));
      }
    },

    'screenshot:refresh-source': async (ws, _msg) => {
      try {
        const sourcePath = await sourceFolderService.refresh();
        await hotkeyScreenshotWatcher.refresh();
        ws.send(JSON.stringify({
          type: 'screenshot:source-refreshed',
          sourcePath,
        }));
      } catch (err) {
        console.error('[ScreenshotHandler] refresh-source failed:', err.message);
        ws.send(JSON.stringify({
          type: 'screenshot:error',
          message: err.message,
        }));
      }
    },
  };
}

module.exports = createScreenshotHandlers;
