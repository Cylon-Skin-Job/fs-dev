'use strict';

/**
 * @module ws/chat-turn-diagnostic-handlers
 * @role Focused handler for `chat-turn:diagnostic:get` — on-demand retrieval
 *       of ONE stored, validated, redacted harness diagnostic report
 *       (RCC-0108 SPEC-03 Slice D; parent §4.13.1; owner decisions R5/R5A/R8).
 *
 * Binding rules implemented here:
 *  - The server owns the authoritative workspace binding: workspaceId is
 *    resolved from the connection's thread manager state at REQUEST time
 *    (precedent: thread-crud.js handleThreadSearch). A client-supplied
 *    workspaceId must agree with the server-resolved value or the request
 *    is unavailable.
 *  - Retrieval itself is delegated to the Slice C service
 *    (getDiagnosticReport), which enforces the exact
 *    workspaceId+threadId+turnId+diagnosticId match against the stored row.
 *  - At most ONE validated ≤24 KiB report per request. ANY missing /
 *    expired / mismatched / malformed / internal-failure case yields ONE
 *    fixed value-free unavailable response — identical shape regardless of
 *    cause, no reason strings, no distinguishing details.
 *  - The request is ID-only: no inbound redaction-map entry is required
 *    (R8). Report contents are NEVER logged here; only opaque route and
 *    diagnostic identifiers appear on the wire.
 *
 * Wire shapes (consumed by SPEC-04/SPEC-05 — do not loosen):
 *  - request:     { type: 'chat-turn:diagnostic:get',
 *                   threadId, turnId, diagnosticId, workspaceId? }
 *  - available:   { type: 'chat-turn:diagnostic:report',
 *                   threadId, turnId, diagnosticId, report }
 *                 where report is the validated closed V1 report object
 *                 (JSON.stringify(report) ≤ 24576 bytes, guaranteed by the
 *                 service's serialized cap).
 *  - unavailable: { type: 'chat-turn:diagnostic:unavailable',
 *                   threadId, turnId, diagnosticId }
 *                 echoing only the request's opaque identifiers (null when
 *                 a field was absent or not a non-empty string).
 */

const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');
const { getDiagnosticReport } = require('../thread/harness-diagnostic-service');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('./workspace-operation-lease');

function nonEmptyStringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session - live per-connection workspace binding
 * @param {Function} [deps.captureBinding] - exact central live binding capture.
 * @param {Function} [deps.isBindingCurrent] - exact central binding recheck.
 * @param {Function} [deps.getReport] - defaults to the real
 *        harness-diagnostic-service getDiagnosticReport; injectable for
 *        focused tests.
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createChatTurnDiagnosticHandlers({
  ws,
  session,
  captureBinding = (socket, liveSession) => (
    ThreadWebSocketHandler.captureActivationBinding(socket, liveSession)
  ),
  isBindingCurrent = (socket, binding) => (
    ThreadWebSocketHandler.isActivationBindingCurrent(socket, binding)
  ),
  getReport = getDiagnosticReport,
}) {
  return {
    async 'chat-turn:diagnostic:get'(clientMsg) {
      const threadId = nonEmptyStringOrNull(clientMsg?.threadId);
      const turnId = nonEmptyStringOrNull(clientMsg?.turnId);
      const diagnosticId = nonEmptyStringOrNull(clientMsg?.diagnosticId);

      const unavailable = {
        type: 'chat-turn:diagnostic:unavailable',
        threadId,
        turnId,
        diagnosticId,
      };
      let responded = false;
      try {
        if (threadId && turnId && diagnosticId) {
          // Capture the exact live session/root/manager/epoch tuple, then
          // serialize lookup and delivery against workspace replacement.
          // A retired manager must never disclose its workspace after the
          // session has begun binding another workspace.
          const binding = captureBinding(ws, session);
          const workspaceId = binding?.workspaceId || null;
          // A supplied client workspaceId must AGREE with the
          // server-resolved value; any disagreement (or a missing
          // server-side binding) is unavailable.
          const clientWorkspaceId = clientMsg?.workspaceId;
          const workspaceAgrees = workspaceId !== null
            && (clientWorkspaceId === undefined || clientWorkspaceId === workspaceId);
          if (binding && workspaceAgrees) {
            await runWorkspaceOperation(ws, () => isBindingCurrent(ws, binding), async () => {
              const outcome = await getReport({
                workspaceId,
                projectRoot: binding.projectRoot,
                workspaceEpoch: binding.workspaceEpoch,
                threadId,
                turnId,
                diagnosticId,
              });
              const response = outcome && outcome.status === 'available'
                ? {
                    type: 'chat-turn:diagnostic:report',
                    threadId,
                    turnId,
                    diagnosticId,
                    report: outcome.report,
                  }
                : unavailable;
              responded = true;
              ws.send(JSON.stringify(response));
            });
          }
        }
      } catch (error) {
        // Defensive: getDiagnosticReport never throws by contract, but ANY
        // failure on this path collapses to the same fixed unavailable
        // response — never a generic error frame, never a reason string.
        if (!isWorkspaceOperationLeaseError(error)) {
          // Deliberately collapse service and transport-independent failures.
        }
      }

      // ONE fixed value-free unavailable response for every denial class.
      if (!responded) ws.send(JSON.stringify(unavailable));
    },
  };
}

module.exports = { createChatTurnDiagnosticHandlers };
