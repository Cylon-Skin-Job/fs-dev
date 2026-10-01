/** View readiness, workspace view mutations, and panel ingress for one connection. */
const path = require('path');
const { ThreadWebSocketHandler } = require('../thread');
const views = require('../views');
const registry = require('../workspace/registry-service');
const { isWorkspaceOperationLeaseError, runWorkspaceOperation } = require('./workspace-operation-lease');
const { buildViewRegistryUpdatedUnderLease } = require('./connection-init');
const { requireTrustedViewAuthority } = require('./trusted-shell-authority');
const viewReadiness = require('../views/readiness-runtime');

function createViewWorkspaceWsHandlers({ ws, session, sessions, setSessionRoot }) {
  function fanViewRegistryUpdated(message, binding) {
    for (const [client, clientSession] of sessions.entries()) {
      if (client.readyState !== 1
        || clientSession.workspaceBindingState !== 'active'
        || clientSession.currentWorkspaceId !== binding.workspaceId
        || clientSession.projectRoot !== binding.projectRoot
        || typeof clientSession.workspaceEpoch !== 'string') continue;
      const recipientMessage = {
        ...message,
        workspaceEpoch: clientSession.workspaceEpoch,
      };
      try { client.send(JSON.stringify(recipientMessage)); } catch (_error) {}
    }
  }

  const runReadyViewOperation = async (operation) => {
    const readinessContext = Object.freeze({
      workspaceId: session.currentWorkspaceId,
      projectRoot: session.projectRoot,
    });
    try {
      await viewReadiness.ensureWorkspaceViewReadiness(readinessContext);
      return await viewReadiness.withViewReadinessLease(
        readinessContext,
        (lease) => operation(readinessContext, lease),
      );
    } catch (error) {
      if (error?.name === 'ViewRelocationError') {
        const unavailable = new Error('View registry unavailable');
        unavailable.code = 'view_registry_unavailable';
        throw unavailable;
      }
      throw error;
    }
  };

  const captureConnectionWorkspaceBinding = () => Object.freeze({
    workspaceId: session.currentWorkspaceId,
    projectRoot: session.projectRoot,
    workspaceEpoch: session.workspaceEpoch,
    workspaceBindingState: session.workspaceBindingState,
  });

  const isConnectionWorkspaceBindingCurrent = (binding) => (
    session.currentWorkspaceId === binding.workspaceId
    && session.projectRoot === binding.projectRoot
    && session.workspaceEpoch === binding.workspaceEpoch
    && session.workspaceBindingState === binding.workspaceBindingState
  );

  const runWorkspaceBoundViewOperation = (binding, operation) => runWorkspaceOperation(
    ws,
    () => isConnectionWorkspaceBindingCurrent(binding),
    () => runReadyViewOperation((readinessContext, lease) => (
      operation(readinessContext, lease, binding)
    )),
  );

  const sendViewDiscoveryUnavailable = (responseType, message) => {
    ws.send(JSON.stringify({
      type: responseType,
      panel: message.panel,
      ...(responseType === 'recent_files_response' ? {} : { path: message.path || '' }),
      ...(typeof message.requestId === 'string' ? { requestId: message.requestId } : {}),
      ...(typeof message.workspaceId === 'string' || message.workspaceId === null
        ? { workspaceId: message.workspaceId }
        : {}),
      ...(Number.isSafeInteger(message.generation) ? { generation: message.generation } : {}),
      success: false,
      error: 'View registry unavailable',
      code: 'view_registry_unavailable',
    }));
  };

  const runViewDiscoveryRequest = async (responseType, message, operation) => {
    const binding = captureConnectionWorkspaceBinding();
    try {
      await runWorkspaceOperation(
        ws,
        () => isConnectionWorkspaceBindingCurrent(binding),
        () => runReadyViewOperation(operation),
      );
    } catch (error) {
      if (error?.code !== 'view_registry_unavailable' && !isWorkspaceOperationLeaseError(error)) throw error;
      sendViewDiscoveryUnavailable(responseType, message);
    }
  };

  const viewMutationRejection = (message, error, binding = {}) => ({
    type: 'workspace:view_update_rejected',
    ...(typeof binding.workspaceId === 'string' ? { workspaceId: binding.workspaceId } : {}),
    ...(typeof binding.workspaceEpoch === 'string' ? { workspaceEpoch: binding.workspaceEpoch } : {}),
    ...(error?.code === 'view_registry_unavailable'
      ? { code: 'view_registry_unavailable' }
      : {}),
    message,
  });

  async function handle(clientMsg) {
      if (clientMsg.type === 'workspace:state_push') {
        if (!requireTrustedViewAuthority(ws, session)) return;
        const workspaceState = require('../workspace/workspace-state');
        const workspace = await registry.getById(clientMsg.workspaceId);
        if (!workspace || workspace.ribbonVisible === false) {
          return;
        }
        const repoPath = workspace.repoPath || workspace.repo_path;
        try {
          await viewReadiness.ensureWorkspaceViewReadiness({
            workspaceId: clientMsg.workspaceId,
            projectRoot: repoPath,
          });
          await viewReadiness.withViewReadinessLease({
            workspaceId: clientMsg.workspaceId,
            projectRoot: repoPath,
          }, async () => {
            const allowedViewIds = repoPath
              ? views.listViews(repoPath, { strictReadiness: true })
              : [];
            await workspaceState.save(clientMsg.workspaceId, clientMsg.state, { repoPath, allowedViewIds });
          });
        } catch (error) {
          if (error?.name !== 'ViewRelocationError') throw error;
          ws.send(JSON.stringify({
            type: 'error',
            code: 'view_registry_unavailable',
            message: 'View registry unavailable',
          }));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_update_requested') {
        if (!requireTrustedViewAuthority(ws, session)) return;
        const binding = captureConnectionWorkspaceBinding();
        try {
          await runWorkspaceBoundViewOperation(binding, async (readinessContext, lease) => {
            const registry = views.updateWorkspaceViewRegistry(readinessContext.projectRoot, clientMsg);
            fanViewRegistryUpdated(buildViewRegistryUpdatedUnderLease(
              readinessContext.projectRoot,
              registry,
              lease,
              binding,
            ), binding);
          });
        } catch (err) {
          if (isWorkspaceOperationLeaseError(err) || !isConnectionWorkspaceBindingCurrent(binding)) return;
          ws.send(JSON.stringify(viewMutationRejection('Unable to update view', err, binding)));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_options_requested') {
        const binding = captureConnectionWorkspaceBinding();
        try {
          await runWorkspaceBoundViewOperation(binding, async (readinessContext) => {
            const options = views.getWorkspaceViewOptions(readinessContext.projectRoot);
            ws.send(JSON.stringify({
              type: 'workspace:view_options',
              workspaceId: binding.workspaceId,
              workspaceEpoch: binding.workspaceEpoch,
              hiddenViews: options.hiddenViews,
              availableTemplates: options.availableTemplates,
            }));
          });
        } catch (err) {
          if (isWorkspaceOperationLeaseError(err) || !isConnectionWorkspaceBindingCurrent(binding)) return;
          ws.send(JSON.stringify(viewMutationRejection('Unable to load view options', err, binding)));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_restore_requested') {
        if (!requireTrustedViewAuthority(ws, session)) return;
        const binding = captureConnectionWorkspaceBinding();
        try {
          await runWorkspaceBoundViewOperation(binding, async (readinessContext, lease) => {
            const registry = views.restoreWorkspaceView(readinessContext.projectRoot, clientMsg.viewId);
            fanViewRegistryUpdated(buildViewRegistryUpdatedUnderLease(
              readinessContext.projectRoot,
              registry,
              lease,
              binding,
            ), binding);
          });
        } catch (err) {
          if (isWorkspaceOperationLeaseError(err) || !isConnectionWorkspaceBindingCurrent(binding)) return;
          ws.send(JSON.stringify(viewMutationRejection('Unable to restore view', err, binding)));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_add_requested') {
        if (!requireTrustedViewAuthority(ws, session)) return;
        const binding = captureConnectionWorkspaceBinding();
        try {
          await runWorkspaceBoundViewOperation(binding, async (readinessContext, lease) => {
            const registry = views.addWorkspaceView(readinessContext.projectRoot, clientMsg.templateId);
            fanViewRegistryUpdated(buildViewRegistryUpdatedUnderLease(
              readinessContext.projectRoot,
              registry,
              lease,
              binding,
            ), binding);
          });
        } catch (err) {
          if (isWorkspaceOperationLeaseError(err) || !isConnectionWorkspaceBindingCurrent(binding)) return;
          ws.send(JSON.stringify(viewMutationRejection('Unable to add view', err, binding)));
        }
        return;
      }

      if (clientMsg.type === 'set_panel') {
        const { panel, rootFolder } = clientMsg;
        if (panel) {
          // Panel installation replaces ThreadWebSocketHandler's connection
          // state object. Keep it on the same queue as privileged thread work
          // and workspace binding so it cannot invalidate an admitted lease
          // halfway through persistence or provider activation.
          try {
            await runWorkspaceOperation(ws, () => true, async () => {
              const projectRoot = session.projectRoot;
              if (!projectRoot) {
                ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
                return;
              }
              await runReadyViewOperation(async () => {
              setSessionRoot(ws, panel, rootFolder || null);

                // RCC-0095: chat is a workspace-level feature. Set up threads
                // unconditionally — a missing or malformed view folder must not
                // remove the workspace chat. resolveChatConfig() is only used
                // below for the declarative chatType/chatPosition payload fields.
                ThreadWebSocketHandler.setPanel(ws, panel, {
                  projectRoot,
                  viewName: panel,
                  workspaceId: session.currentWorkspaceId,
                  workspaceEpoch: session.workspaceEpoch,
                });
                await ThreadWebSocketHandler.sendThreadList(ws);

                const chatConfig = views.resolveChatConfig(projectRoot, panel);

                // Send view config to client (includes content.json + layout.json)
                const viewConfig = views.loadView(projectRoot, panel);
                // CLI_CONFIG_SPEC §7d: per-view override delta (may be {}).
                const { resolveViewDelta } = require('../cli-config');
                const cliConfigDelta = await resolveViewDelta(projectRoot, panel);
                ws.send(JSON.stringify({
                  type: 'panel_changed',
                  panel,
                  rootFolder: rootFolder || projectRoot,
                  contentConfig: viewConfig?.content || null,
                  layoutConfig: viewConfig?.layout || null,
                  hasChat: !!chatConfig,
                  chatType: chatConfig?.chatType || null,
                  chatPosition: chatConfig?.chatPosition || null,
                  cliConfigDelta,
                }));

                if (rootFolder) {
                  ws.send(JSON.stringify({
                    type: 'panel_config',
                    panel,
                    projectRoot: rootFolder,
                    projectName: path.basename(rootFolder)
                  }));
                }
              });
            });
          } catch (error) {
            if (error?.code !== 'view_registry_unavailable') throw error;
            ws.send(JSON.stringify({
              type: 'error',
              code: 'view_registry_unavailable',
              message: 'View registry unavailable',
            }));
          }
        }
        return;
      }

  }

  return { handle, runViewDiscoveryRequest };
}

module.exports = { createViewWorkspaceWsHandlers };
