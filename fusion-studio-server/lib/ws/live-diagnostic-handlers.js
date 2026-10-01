'use strict';

const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');
const { hasTrustedShellAuthority } = require('./trusted-shell-authority');
const { runWorkspaceOperation } = require('./workspace-operation-lease');
const { subscribeDiagnostic } = require('../thread/live-diagnostic-service');
const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256;

// Connection-owned sibling of stored report retrieval; subscription never activates a harness.
function createLiveDiagnosticHandlers({ ws, session }) {
  const subscriptions = new Map();
  const pending = new Map();
  let closed = false;
  function dispose() {
    closed = true;
    for (const cancel of subscriptions.values()) cancel();
    subscriptions.clear();
    pending.clear();
  }
  return {
    dispose,
    async 'chat-turn:diagnostic:subscribe'(msg) {
      const { subscriptionId, threadId, workspaceId } = msg;
      if (!id(subscriptionId) || !id(threadId) || !id(workspaceId)) return;
      subscriptions.get(subscriptionId)?.();
      subscriptions.delete(subscriptionId);
      const unavailable = () => {
        try { ws.send(JSON.stringify({ type: 'chat-turn:diagnostic:stream', subscriptionId,
          threadId, workspaceId, availability: 'unavailable' })); } catch { /* closed */ }
      };
      if (closed || !hasTrustedShellAuthority(session) || (!pending.has(subscriptionId) && pending.size >= 16)) { unavailable(); return; }
      const token = {};
      pending.set(subscriptionId, token);
      let installed = false;
      const binding = ThreadWebSocketHandler.captureActivationBinding(ws, session);
      const current = () => !closed && pending.get(subscriptionId) === token && hasTrustedShellAuthority(session)
        && ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding);
      if (!binding || binding.workspaceId !== workspaceId) { pending.delete(subscriptionId); unavailable(); return; }
      try {
        await runWorkspaceOperation(ws, current, async () => {
          const thread = await binding.state.threadManager.getThread(threadId);
          if (!current()) return;
          if (!thread || subscriptions.size >= 16) { unavailable(); return; }
          const cancel = subscribeDiagnostic({ ws, subscriptionId, isCurrent: current,
            onDispose() {
              if (pending.get(subscriptionId) === token) { pending.delete(subscriptionId); subscriptions.delete(subscriptionId); }
            },
            route: { workspaceId, projectRoot: binding.projectRoot,
              workspaceEpoch: binding.workspaceEpoch, threadId } });
          if (current()) { subscriptions.set(subscriptionId, cancel); installed = true; }
          else cancel();
        });
      } catch { if (current()) unavailable(); }
      finally { if (!installed && pending.get(subscriptionId) === token) pending.delete(subscriptionId); }
    },
    async 'chat-turn:diagnostic:unsubscribe'(msg) {
      if (!id(msg.subscriptionId)) return;
      pending.delete(msg.subscriptionId);
      subscriptions.get(msg.subscriptionId)?.();
      subscriptions.delete(msg.subscriptionId);
    },
  };
}
module.exports = { createLiveDiagnosticHandlers };
