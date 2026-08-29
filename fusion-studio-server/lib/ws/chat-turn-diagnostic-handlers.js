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

function nonEmptyStringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {(socket: import('ws').WebSocket) => object|undefined} [deps.getThreadState]
 *        Per-connection thread state reader (defaults to
 *        ThreadWebSocketHandler.getState); injectable for focused tests.
 * @param {Function} [deps.getReport] - defaults to the real
 *        harness-diagnostic-service getDiagnosticReport; injectable for
 *        focused tests.
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createChatTurnDiagnosticHandlers({
  ws,
  getThreadState = (socket) => ThreadWebSocketHandler.getState(socket),
  getReport = getDiagnosticReport,
}) {
  return {
    async 'chat-turn:diagnostic:get'(clientMsg) {
      const threadId = nonEmptyStringOrNull(clientMsg?.threadId);
      const turnId = nonEmptyStringOrNull(clientMsg?.turnId);
      const diagnosticId = nonEmptyStringOrNull(clientMsg?.diagnosticId);

      let outcome = null;
      try {
        if (threadId && turnId && diagnosticId) {
          // Server-side authoritative workspace resolution. The thread
          // manager is bound at panel/workspace selection time and can
          // change across switches, so resolve it per request.
          const workspaceId = nonEmptyStringOrNull(
            getThreadState(ws)?.threadManager?.workspaceId,
          );
          // A supplied client workspaceId must AGREE with the
          // server-resolved value; any disagreement (or a missing
          // server-side binding) is unavailable.
          const clientWorkspaceId = clientMsg?.workspaceId;
          const workspaceAgrees = workspaceId !== null
            && (clientWorkspaceId === undefined || clientWorkspaceId === workspaceId);
          if (workspaceAgrees) {
            outcome = await getReport({ workspaceId, threadId, turnId, diagnosticId });
          }
        }
      } catch {
        // Defensive: getDiagnosticReport never throws by contract, but ANY
        // failure on this path collapses to the same fixed unavailable
        // response — never a generic error frame, never a reason string.
        outcome = null;
      }

      if (outcome && outcome.status === 'available') {
        ws.send(JSON.stringify({
          type: 'chat-turn:diagnostic:report',
          threadId,
          turnId,
          diagnosticId,
          report: outcome.report,
        }));
        return;
      }

      // ONE fixed value-free unavailable response for every denial class.
      ws.send(JSON.stringify({
        type: 'chat-turn:diagnostic:unavailable',
        threadId,
        turnId,
        diagnosticId,
      }));
    },
  };
}

module.exports = { createChatTurnDiagnosticHandlers };
