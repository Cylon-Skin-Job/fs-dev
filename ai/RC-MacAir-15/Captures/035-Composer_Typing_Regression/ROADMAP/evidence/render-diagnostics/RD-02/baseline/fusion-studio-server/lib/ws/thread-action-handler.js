'use strict';

// Authenticated durable action dispatch with isolated result delivery.
const { requireTrustedThreadAuthority, denyThreadMutation } = require('./privileged-thread-guard');
const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');
const { buildActionErrorFrame, buildActionCompletedFrame, DURABLE_THREAD_ACTIONS,
  hasRedundantMoveAuthority, hasRedundantMemberAuthority } = require('./thread-action-protocol');
function createThreadActionHandler({ ws, session, currentBinding, runBoundMutation, getWorkspaceRecipients }) {
  return async function handleThreadAction(clientMsg = {}) {
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
        if (action === 'prompt_receipt_status') {
          const allowed = new Set(['type', 'action', 'requestId', 'threadId']);
          if (Object.keys(clientMsg).some((key) => !allowed.has(key))) {
            ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, 'invalid_request')));
            return;
          }
          const receipt = await require('../thread/prompt-submission-service').status({
            workspaceId: binding.workspaceId,
            threadId: clientMsg.threadId,
            requestId,
          });
          if (!receipt.ok) {
            ws.send(JSON.stringify(buildActionErrorFrame(clientMsg, receipt.code)));
            return;
          }
          ws.send(JSON.stringify({ type: 'thread:action:completed', action, requestId,
            workspaceId: binding.workspaceId, threadId: clientMsg.threadId,
            receipt: receipt.receipt }));
          return;
        }
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
    };
}
module.exports = { createThreadActionHandler };
