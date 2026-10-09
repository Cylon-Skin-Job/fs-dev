/** Transport adapter: capture workspace-qualified operations without exporting a manager. */
const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');

function captureActivationBinding(state, session, projectRoot) {
  return Object.freeze({ state, session, projectRoot,
    workspaceId: session.currentWorkspaceId, workspaceEpoch: session.workspaceEpoch });
}

function activationBindingIsCurrent(ws, binding) {
  const state = ThreadWebSocketHandler.getState(ws);
  return state === binding.state
    && state?.threadManager?.projectRoot === binding.projectRoot
    && state?.threadManager?.workspaceId === binding.workspaceId
    && binding.session.projectRoot === binding.projectRoot
    && binding.session.currentWorkspaceId === binding.workspaceId
    && binding.session.workspaceEpoch === binding.workspaceEpoch
    && (binding.session.workspaceBindingState === undefined
      || binding.session.workspaceBindingState === 'active');
}

function captureRuntimeTarget(ws, session, projectRoot) {
  const state = ThreadWebSocketHandler.getState(ws);
  const manager = state?.threadManager;
  if (!manager) return null;
  const binding = captureActivationBinding(state, session, projectRoot);
  const sessions = captureSessionOperations(manager);
  return Object.freeze({ workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
    binding, sessions,
    getThread: manager.getThread.bind(manager),
    updateHarnessConfig: manager.updateHarnessConfig?.bind(manager),
    activateGroups: manager.threadGroups?.activate?.bind(manager.threadGroups),
    promptActivity: Object.freeze({ recordPromptAccepted: manager.threadGroups?.recordPromptAccepted?.bind(manager.threadGroups) }),
    isCurrent: () => activationBindingIsCurrent(ws, binding),
    ownsSession(threadId, wire) {
      const activeId = Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
        ? state.activatedThreadId : state.threadId;
      const managed = sessions.getSession?.(threadId);
      return activeId === threadId && managed?.ws === ws && managed?.wireProcess === wire;
    },
    activate: (threadId, wire) => ThreadWebSocketHandler.activateThreadSession(ws, threadId, wire, binding),
    trackMessage: message => ThreadWebSocketHandler.handleMessageSend(ws, message),
    select(threadId) { if (activationBindingIsCurrent(ws, binding)) state.threadId = threadId; },
  });
}

function captureSessionOperations(manager) {
  if (!manager) return null;
  return Object.freeze({ workspaceId: manager.workspaceId, projectRoot: manager.projectRoot,
    getSession: manager.getSession?.bind(manager), closeSession: manager.closeSession?.bind(manager),
    touchSession: manager.touchSession?.bind(manager),
    beginSessionRetirement: manager.beginSessionRetirement?.bind(manager),
    completeStoppedSession: manager.completeStoppedSession?.bind(manager) });
}
function captureStopTarget(ws) {
  return captureSessionOperations(ThreadWebSocketHandler.getState(ws)?.threadManager);
}

module.exports = { captureStopTarget, captureRuntimeTarget, captureActivationBinding, activationBindingIsCurrent };
