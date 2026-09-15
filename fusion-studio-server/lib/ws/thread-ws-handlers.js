/**
 * @module thread-ws-handlers
 * @role Per-connection handlers for all thread: WebSocket messages.
 *
 * Factory — call once per connection inside createClientMessageRouter.
 * Returns a handler map keyed by message type. The router dispatches
 * any clientMsg.type that starts with 'thread:' through this map.
 *
 * Owns the wire-spawn sequence for thread:open-assistant. Thin delegations to
 * ThreadWebSocketHandler for list/search, plus the canonical `thread:action`
 * route (rename/delete/copy_link/resolve_link/view_markdown/
 * set_harness_selection). The raw `thread:copyLink` and `thread:touch` routes
 * were removed with no aliases (slices 01B/01C).
 */

const {
  RUNTIME_STATES,
  ThreadWebSocketHandler,
  threadRuntimeController,
  threadRuntimeManager,
} = require('../thread');
const { spawnThreadWire } = require('../harness/compat');
const {
  attachClientToWire,
  getWireForThread,
  unregisterWire,
} = require('../wire/process-manager');
const { terminateProviderProcessAndWait } = require('../thread/session-manager');
const { normalizeOpenAssistantRequest } = require('../thread/thread-harness-config-policy');
const {
  denyThreadFork,
  denyThreadMutation,
  requireTrustedThreadAuthority,
} = require('./privileged-thread-guard');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('./workspace-operation-lease');

function boundedActionError(code) {
  switch (code) {
    case 'group_busy': return 'Thread has an active conversation';
    case 'request_mismatch': return 'Request reused with different input';
    case 'not_found': return 'Thread not found';
    case 'invalid_name': return 'Thread name is invalid';
    case 'invalid_action': return 'Unsupported thread action';
    case 'invalid_link': return 'Thread link is invalid';
    case 'invalid_selection': return 'Model selection is not available';
    case 'selection_unavailable': return 'Model selection is not available';
    case 'request_invalid': return 'Action requires a bounded requestId';
    case 'invalid_request': return 'Action request is invalid';
    case 'not_primary': return 'Only the current Main Chat can be moved';
    case 'stale_primary': return 'The conversation changed; try again';
    case 'view_not_supported': return 'This view cannot host a Side Chat';
    case 'member_unavailable': return 'That Side Chat is not available';
    case 'placement_unavailable': return 'The Side Chat could not be opened';
    case 'view_id_preflight_repair_required': return 'View identity repair required';
    default: return 'Thread action failed';
  }
}

function buildActionErrorFrame(clientMsg, code) {
  return {
    type: 'thread:action:error',
    requestId: typeof clientMsg?.requestId === 'string' ? clientMsg.requestId : null,
    action: clientMsg?.action ?? null,
    threadGroupId: clientMsg?.threadGroupId ?? null,
    ...(clientMsg?.threadId ? { threadId: clientMsg.threadId } : {}),
    code,
    message: boundedActionError(code),
  };
}

/**
 * One canonical completion envelope. Durable identities only; `surfaceId` is
 * never built, persisted, echoed, or fanned out (`BRIDGE-02` §4.2/§4.5).
 */
function buildActionCompletedFrame(outcome, { requestId, action, fanOut = false }) {
  const result = outcome?.result || {};
  return {
    type: 'thread:action:completed',
    requestId,
    action,
    threadGroupId: result.threadGroupId ?? null,
    threadId: result.threadId ?? null,
    workspaceId: result.workspaceId ?? null,
    viewId: result.viewId ?? null,
    context: result.context ?? null,
    ...(fanOut ? { fanOut: true } : {}),
    ...(action === 'rename' ? { name: result.name ?? null } : {}),
    ...(action === 'delete'
      ? {
        deleted: true,
        recovered: Boolean(outcome?.recovered || result.recovered),
        replayed: Boolean(outcome?.replayed || result.replayed),
        cleanup: result.cleanup ?? null,
        viewStateCleanup: result.viewStateCleanup ?? null,
        members: result.members ?? [],
      }
      : {}),
    ...(action === 'copy_link'
      ? { link: result.link ?? null }
      : {}),
    ...(action === 'resolve_link'
      ? {
        resolved: true,
        ...(result.targetMemberThreadId
          ? {
            targetMemberThreadId: result.targetMemberThreadId,
            sideChatPlacementId: result.sideChatPlacementId ?? null,
            placementStatus: result.placementStatus ?? null,
          }
          : {}),
      }
      : {}),
    ...(action === 'view_markdown'
      ? { markdownPath: result.markdownPath ?? null }
      : {}),
    ...(action === 'set_harness_selection'
      ? {
        harnessId: result.harnessId ?? null,
        model: result.model ?? null,
        variant: result.variant ?? null,
      }
      : {}),
    ...(action === 'move_chat_to_side'
      ? {
        movedThreadId: result.movedThreadId ?? null,
        newMainThreadId: result.newMainThreadId ?? null,
        currentPrimarySequence: result.currentPrimarySequence ?? null,
        sideChatPlacementId: result.sideChatPlacementId ?? null,
        placementStatus: result.placementStatus ?? null,
        placement: result.placement ?? null,
        replayed: Boolean(outcome?.replayed || result.replayed),
      }
      : {}),
    ...(action === 'open_member_in_side'
      ? {
        sideChatPlacementId: result.sideChatPlacementId ?? null,
        placementStatus: result.placementStatus ?? null,
        focused: Boolean(result.focused),
        replayed: Boolean(outcome?.replayed || result.replayed),
      }
      : {}),
  };
}

/** Canonical durable `thread:action` names owned by this route. */
const DURABLE_THREAD_ACTIONS = Object.freeze(new Set([
  'rename',
  'delete',
  'copy_link',
  'resolve_link',
  'view_markdown',
  'set_harness_selection',
  'move_chat_to_side',
  'open_member_in_side',
]));

/**
 * Exact allowed payload key set for one member access (`SPEC-04 §8`). Like
 * Move, workspace and view authority are server-derived; only durable
 * group/member identities plus the fail-open `context` are accepted.
 */
const OPEN_MEMBER_ACTION_KEYS = Object.freeze(new Set([
  'type', 'action', 'requestId', 'threadGroupId', 'threadId', 'context',
]));

/**
 * Exact allowed payload key set for one Move (`SPEC-04 §4`). Redundant client
 * workspace/view authority fields are schema-rejected: workspace is
 * server-derived from the bound connection and view from the group. `context`
 * is the fail-open durable `ChatActionContext` portion only.
 */
const MOVE_ACTION_KEYS = Object.freeze(new Set([
  'type', 'action', 'requestId', 'threadGroupId', 'threadId',
  'expectedPrimarySequence', 'context',
]));

function hasRedundantMoveAuthority(clientMsg) {
  return Object.keys(clientMsg).some((key) => !MOVE_ACTION_KEYS.has(key));
}

function hasRedundantMemberAuthority(clientMsg) {
  return Object.keys(clientMsg).some((key) => !OPEN_MEMBER_ACTION_KEYS.has(key));
}

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {{ awaitHarnessReady: Function, initializeWire: Function, setupWireHandlers: Function }} deps.wireLifecycle
 * @param {string} deps.projectRoot
 * @param {Function} [deps.getWorkspaceRecipients] - other-window delivery provider
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createThreadWsHandlers({
  ws, session, wireLifecycle, projectRoot, getWorkspaceRecipients = () => [],
}) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  const currentBinding = () => {
    const state = ThreadWebSocketHandler.getState(ws);
    const manager = state?.threadManager;
    const currentRoot = session.projectRoot;
    const currentWorkspaceId = session.currentWorkspaceId;
    const currentWorkspaceEpoch = session.workspaceEpoch;
    if (!manager || typeof currentRoot !== 'string' || !currentRoot
      || typeof currentWorkspaceId !== 'string' || !currentWorkspaceId
      || typeof currentWorkspaceEpoch !== 'string' || !currentWorkspaceEpoch
      || (session.workspaceBindingState !== undefined
        && session.workspaceBindingState !== 'active')
      || manager.projectRoot !== currentRoot
      || manager.workspaceId !== currentWorkspaceId) {
      return null;
    }
    return {
      state,
      session,
      projectRoot: currentRoot,
      workspaceId: currentWorkspaceId,
      workspaceEpoch: currentWorkspaceEpoch,
    };
  };

  const runBoundMutation = async (binding, operation) => {
    try {
      return await runWorkspaceOperation(
        ws,
        () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
        operation,
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      denyThreadMutation(ws);
      return null;
    }
  };

  const denyUnavailableRead = () => {
    ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
  };

  const runBoundRead = async (binding, operation) => {
    if (!binding) {
      denyUnavailableRead();
      return null;
    }
    try {
      return await runWorkspaceOperation(
        ws,
        () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
        operation,
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      denyUnavailableRead();
      return null;
    }
  };

  const resumeLiveProvider = async (threadId, binding) => {
    const state = ThreadWebSocketHandler.getState(ws);
    const manager = state?.threadManager;
    const managedSession = typeof manager?.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    const runtimeKey = {
      workspaceId: binding.workspaceId,
      projectRoot: binding.projectRoot,
      workspaceEpoch: binding.workspaceEpoch,
      scope: 'project',
      threadId,
    };
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING
      || managedSession?.state === 'stopping') {
      throw new Error('Thread provider retirement is still pending');
    }
    const registeredWire = getWireForThread(threadId, binding);
    if (managedSession?.wireProcess && registeredWire
      && managedSession.wireProcess !== registeredWire) {
      throw new Error('Thread provider ownership is inconsistent');
    }
    const wire = managedSession?.wireProcess || registeredWire;
    const exited = wire && (
      (wire.exitCode !== undefined && wire.exitCode !== null)
      || (wire.signalCode !== undefined && wire.signalCode !== null)
    );
    if (!wire) return null;
    if (wire.killed || exited) {
      if (managedSession?.wireProcess === wire) {
        await manager.closeSession(threadId);
      }
      if (getWireForThread(threadId, binding) === wire) {
        unregisterWire(threadId, binding, wire);
      }
      return null;
    }

    const activeThreadId = state && Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
      ? state.activatedThreadId
      : state?.threadId;
    const ownsExactSession = activeThreadId === threadId
      && managedSession?.ws === ws
      && managedSession.wireProcess === wire;
    if (!ownsExactSession) {
      await ThreadWebSocketHandler.activateThreadSession(ws, threadId, wire, binding);
    }
    attachClientToWire(threadId, wire, binding.projectRoot, ws, {
      workspaceId: binding.workspaceId,
      projectRoot: binding.projectRoot,
      workspaceEpoch: binding.workspaceEpoch,
      viewId: null,
    });
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = 'project';
    session.currentViewId = null;
    ws.send(JSON.stringify({ type: 'wire_ready', threadId, scope: 'project' }));
    return wire;
  };

  return {
    async 'thread:open'(clientMsg) {
      const binding = currentBinding();
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadOpen(ws, clientMsg));
    },

    async 'thread:open-assistant'(clientMsg) {
      // Existing assistant resume marks the thread resumed and advances its
      // durable MRU timestamp, so this route is privileged for both branches.
      // Passive thread:open remains available to untrusted standalone clients.
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const acceptedRequest = normalizeOpenAssistantRequest(clientMsg);
      if (!acceptedRequest) {
        denyThreadMutation(ws);
        return;
      }
      const binding = currentBinding();
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      console.log('[WS] thread:open-assistant received, threadId:', acceptedRequest.threadId?.slice(0, 8) || '(new)');

      await runBoundMutation(binding, async () => {
        if (acceptedRequest.threadId) {
          const runtimeKey = {
            workspaceId: binding.workspaceId,
            projectRoot: binding.projectRoot,
            workspaceEpoch: binding.workspaceEpoch,
            scope: 'project',
            threadId: acceptedRequest.threadId,
          };
          const existingSession = binding.state.threadManager.getSession?.(acceptedRequest.threadId);
          if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING
            || existingSession?.state === 'stopping') {
            denyThreadMutation(ws);
            return;
          }
        }
        // Dispatcher: create or resume based on whether msg.threadId exists.
        const threadId = await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, acceptedRequest);
        if (!threadId) return;

        // Creation/resume, its response frames, and provider admission are one
        // workspace-leased operation. A queued workspace bind cannot split
        // durable metadata from activation.
        if (await resumeLiveProvider(threadId, binding)) return;
        await spawnAndSetupWire({
          ws,
          session,
          wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
          threadId,
          projectRoot: binding.projectRoot,
          expectedBinding: binding,
        });
      });
    },

    async 'thread:action'(clientMsg = {}) {
      // Durable group mutations require the accepted trusted-shell role in
      // addition to server-derived workspace and validated group ownership.
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const action = clientMsg.action;
      const requestId = clientMsg.requestId;
      if (!DURABLE_THREAD_ACTIONS.has(action)) {
        ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'invalid_action')));
        return;
      }
      if (typeof requestId !== 'string' || !requestId
        || Buffer.byteLength(requestId, 'utf8') > 128) {
        ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'request_invalid')));
        return;
      }
      if (action === 'move_chat_to_side' && hasRedundantMoveAuthority(clientMsg)) {
        ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'invalid_request')));
        return;
      }
      if (action === 'open_member_in_side' && hasRedundantMemberAuthority(clientMsg)) {
        ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'invalid_request')));
        return;
      }
      const binding = currentBinding();
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      await runBoundMutation(binding, async () => {
        const service = binding.state.threadManager?.threadGroups;
        if (!service || typeof service.performAction !== 'function') {
          ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'action_unavailable')));
          return;
        }
        let outcome;
        try {
          outcome = await service.performAction(action, {
            threadGroupId: clientMsg.threadGroupId ?? null,
            threadId: clientMsg.threadId ?? null,
            name: clientMsg.name,
            uri: clientMsg.uri ?? null,
            model: clientMsg.model ?? null,
            variant: clientMsg.variant === undefined ? null : clientMsg.variant,
            expectedPrimarySequence: clientMsg.expectedPrimarySequence ?? null,
            requestId,
            componentContext: clientMsg.context ?? null,
            workspaceEpoch: binding.workspaceEpoch,
          });
        } catch (_error) {
          ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'action_failed')));
          return;
        }
        if (!outcome?.ok) {
          ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, outcome?.code || 'action_failed')));
          return;
        }

        // Resolve Link opens Main Chat: the authoritative current primary is
        // hydrated through the canonical open path only on the original,
        // committed invocation (never on a replay). A URI that named an exact
        // non-primary member instead reopens/focuses its Side Chat placement
        // (server-side) and never promotes that member as Main Chat
        // (`SPEC-04 §8`). Legacy opens its explicit null-view host.
        if (action === 'resolve_link' && !outcome.replayed
          && !outcome.result?.targetMemberThreadId) {
          try {
            await ThreadWebSocketHandler.handleThreadOpen(ws, {
              threadGroupId: outcome.result?.threadGroupId ?? clientMsg.threadGroupId ?? null,
              threadId: outcome.result?.threadId ?? null,
            });
          } catch (_error) {
            // The resolve result is already durable; a failed open is a
            // requester-side read failure, not a mutation rollback.
          }
        }

        // Requester acknowledgement, then each other workspace window, then
        // any optional fact — separately failure-isolated so one failed
        // recipient cannot block another or rewrite the command result.
        try {
          ws.send(JSON.stringify(buildActionCompletedFrame(outcome, { requestId, action })));
        } catch (_error) {
          // The command is already committed; a dead requester socket cannot
          // roll it back or block peer delivery.
        }
        const fanOutFrame = buildActionCompletedFrame(outcome, {
          requestId, action, fanOut: true,
        });
        let recipients = [];
        try {
          recipients = getWorkspaceRecipients({
            workspaceId: binding.workspaceId,
            projectRoot: binding.projectRoot,
            workspaceEpoch: binding.workspaceEpoch,
            excludeWs: ws,
          }) || [];
        } catch (_error) {
          recipients = [];
        }
        for (const recipient of recipients) {
          try {
            if (recipient?.ws && recipient.ws !== ws) {
              recipient.ws.send(JSON.stringify(fanOutFrame));
            }
          } catch (_error) {
            // A failed recipient cannot block another delivery.
          }
        }
      });
    },

    async 'thread:fork'() {
      // SPEC-00 owns the unconditional unavailability of Fork. Thread Group
      // Foundation removes every Fork capability, composer, service, config,
      // and provider argument while this accepted denial remains the sole
      // bounded response and never reaches a service effect.
      denyThreadFork(ws);
    },

    async 'thread:warm'(clientMsg) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      await runBoundMutation(binding, () => threadRuntimeController.warmRuntimeForIntent({
        ws,
        session,
        clientMsg,
        wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
        projectRoot: binding.projectRoot,
        spawnAndSetupWire,
      }));
    },

    async 'thread:search'(clientMsg) {
      const binding = currentBinding();
      if (!binding) {
        denyUnavailableRead();
        return;
      }
      if (clientMsg.workspaceId !== undefined
        && clientMsg.workspaceId !== binding.workspaceId) {
        denyUnavailableRead();
        return;
      }
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadSearch(ws, {
        ...clientMsg,
        workspaceId: binding.workspaceId,
      }));
    },

    async 'thread:list'(clientMsg = {}) {
      const binding = currentBinding();
      await runBoundRead(binding, () => {
        let viewId = null;
        if (clientMsg.viewId !== undefined && clientMsg.viewId !== null) {
          const target = binding?.state?.threadManager?.threadGroups?.resolveViewTarget(clientMsg.viewId);
          if (!target || !target.ok) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'view_not_found',
              message: 'Requested view is not available',
            }));
            return;
          }
          viewId = target.viewId;
        }
        return ThreadWebSocketHandler.sendThreadList(ws, viewId);
      });
    },

    /**
     * `thread:members` — the registered qualified read for one validated group
     * (`SPEC-04 §8`). Workspace is server-derived from the bound connection and
     * the server returns the group's authoritative nullable view. It returns
     * ordered member projections only; transcript content is never included.
     */
    async 'thread:members'(clientMsg = {}) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      await runBoundRead(binding, async () => {
        const service = binding?.state?.threadManager?.threadGroups;
        if (!service || typeof service.listGroupMembers !== 'function') {
          ws.send(JSON.stringify({
            type: 'thread:members:error',
            threadGroupId: clientMsg.threadGroupId ?? null,
            code: 'action_unavailable',
            message: 'Thread members are unavailable',
          }));
          return;
        }
        let outcome;
        try {
          outcome = await service.listGroupMembers({
            threadGroupId: clientMsg.threadGroupId ?? null,
          });
        } catch (_error) {
          ws.send(JSON.stringify({
            type: 'thread:members:error',
            threadGroupId: clientMsg.threadGroupId ?? null,
            code: 'members_failed',
            message: 'Thread members are unavailable',
          }));
          return;
        }
        if (!outcome?.ok) {
          const code = outcome?.code || 'not_found';
          ws.send(JSON.stringify({
            type: 'thread:members:error',
            threadGroupId: clientMsg.threadGroupId ?? null,
            code,
            message: boundedActionError(code),
          }));
          return;
        }
        ws.send(JSON.stringify({
          type: 'thread:members',
          threadGroupId: outcome.result.threadGroupId,
          workspaceId: outcome.result.workspaceId,
          viewId: outcome.result.viewId,
          members: outcome.result.members,
        }));
      });
    },
  };
}

/**
 * Spawn and set up a wire for a thread. Extracted so the prompt recovery
 * path in client-message-router.js can reuse the same wire-spawn sequence
 * as thread:open-assistant without duplicating logic.
 *
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {{ awaitHarnessReady: Function, initializeWire: Function, setupWireHandlers: Function }} deps.wireLifecycle
 * @param {string} deps.threadId
 * @param {string} deps.projectRoot
 * @returns {Promise<import('child_process').ChildProcess>}
 */
async function spawnAndSetupWire({
  ws,
  session,
  wireLifecycle,
  threadId,
  projectRoot,
  expectedBinding = null,
}) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  console.log('[WS] Spawning wire for thread:', threadId);
  // CHAT_SCOPE_SPEC: workspace-universal scope — resolveScope() builds the
  // structured workspace string for every chat:* event this wire emits.
  const state = ThreadWebSocketHandler.getState(ws);
  const manager = state?.threadManager;
  if (!manager || manager.projectRoot !== projectRoot
    || manager.workspaceId !== session.currentWorkspaceId) {
    throw new Error('Workspace unavailable for thread activation');
  }
  const binding = {
    state,
    session,
    projectRoot,
    workspaceId: session.currentWorkspaceId,
    workspaceEpoch: session.workspaceEpoch,
  };
  const activationBinding = expectedBinding || binding;
  if (!ThreadWebSocketHandler.isActivationBindingCurrent(ws, activationBinding)) {
    throw new Error('Workspace unavailable for thread activation');
  }
  const scopeContext = {
    workspaceId: session.currentWorkspaceId,
    projectRoot,
    workspaceEpoch: session.workspaceEpoch,
    viewId: null,
  };
  const wire = spawnThreadWire(threadId, projectRoot, scopeContext);
  try {
    console.log('[WS] Wire spawned, awaiting harness ready...');
    await awaitHarnessReady(wire);
    console.log('[WS] Setting up handlers...');
    setupWireHandlers(wire, threadId, scopeContext);
    console.log('[WS] Initializing wire...');
    initializeWire(wire);
    console.log('[WS] Wire initialization complete');

    // Register with the workspace ThreadManager before claiming the session
    // or announcing readiness. A failed/stale activation is rolled back below.
    console.log('[WS] Registering with ThreadManager...');
    await ThreadWebSocketHandler.activateThreadSession(ws, threadId, wire, activationBinding);
    session.wire = wire;
    session.currentThreadId = threadId;
    session.currentScope = 'project';
    session.currentViewId = null;
    threadRuntimeManager.markReady({
      workspaceId: manager.workspaceId,
      projectRoot: manager.projectRoot,
      workspaceEpoch: activationBinding.workspaceEpoch,
      scope: 'project',
      threadId,
    });
    console.log('[WS] ThreadManager registration complete');

    // Fire wire_ready only after the serialized lifecycle owner commits.
    ws.send(JSON.stringify({ type: 'wire_ready', threadId, scope: 'project' }));

    return wire;
  } catch (error) {
    try {
      await ThreadWebSocketHandler.rollbackThreadActivation(
        ws,
        threadId,
        wire,
        activationBinding,
      );
    } catch (_rollbackError) {
      // Registry/provider teardown below remains mandatory even if durable
      // suspension reporting fails during rollback.
    }
    const managedSession = typeof manager.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    if (wire && managedSession?.wireProcess === wire) {
      // Rollback could not prove provider exit. Keep every ownership surface
      // discoverable and block replacement until a later bounded close wins.
      threadRuntimeManager.markState({
        workspaceId: manager.workspaceId,
        projectRoot: manager.projectRoot,
        workspaceEpoch: activationBinding.workspaceEpoch,
        scope: 'project',
        threadId,
      }, RUNTIME_STATES.STOPPING);
      throw error;
    }
    if (wire) await terminateProviderProcessAndWait(wire);

    // Clear delivery/runtime ownership only after actual child termination.
    if (getWireForThread(threadId, scopeContext) === wire) {
      unregisterWire(threadId, scopeContext, wire);
      threadRuntimeManager.markCold({
        workspaceId: manager.workspaceId,
        projectRoot: manager.projectRoot,
        workspaceEpoch: activationBinding.workspaceEpoch,
        scope: 'project',
        threadId,
      });
    }
    if (session.wire === wire) {
      session.wire = null;
      if (session.currentThreadId === threadId) {
        session.currentThreadId = null;
        session.currentScope = null;
        session.currentViewId = null;
      }
    }
    throw error;
  }
}

module.exports = { createThreadWsHandlers, spawnAndSetupWire };
