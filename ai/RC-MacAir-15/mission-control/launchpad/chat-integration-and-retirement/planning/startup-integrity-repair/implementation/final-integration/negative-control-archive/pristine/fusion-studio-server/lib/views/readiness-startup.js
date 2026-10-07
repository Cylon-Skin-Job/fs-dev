'use strict';

const viewReadiness = require('./readiness-runtime');

async function startWorkspacePipelineWhenReady({
  sessions,
  getProjectRoot,
  getWorkspaceId,
  startPipeline,
  warn = console.warn,
}) {
  if (
    typeof getProjectRoot !== 'function'
    || typeof getWorkspaceId !== 'function'
    || typeof startPipeline !== 'function'
  ) throw new TypeError('view-owned startup pipeline dependencies are required');

  const projectRoot = getProjectRoot();
  const workspaceId = getWorkspaceId();
  if (!projectRoot || !workspaceId) {
    startPipeline({ sessions, projectRoot, workspaceId });
    return Object.freeze({ started: false, reason: 'no_active_workspace' });
  }
  const readinessContext = Object.freeze({ projectRoot, workspaceId });
  try {
    await viewReadiness.ensureWorkspaceViewReadiness(readinessContext);
    await viewReadiness.withViewReadinessLease(readinessContext, async () => {
      startPipeline({ sessions, projectRoot, workspaceId });
    });
    return Object.freeze({ started: true, reason: null });
  } catch (error) {
    if (error?.name !== 'ViewRelocationError') throw error;
    warn('[Server] View-owned startup pipeline unavailable');
    return Object.freeze({ started: false, reason: 'view_registry_unavailable' });
  }
}

module.exports = { startWorkspacePipelineWhenReady };
