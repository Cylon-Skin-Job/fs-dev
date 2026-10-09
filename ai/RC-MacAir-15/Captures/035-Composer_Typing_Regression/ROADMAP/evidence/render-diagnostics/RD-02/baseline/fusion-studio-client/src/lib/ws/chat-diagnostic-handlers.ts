/**
 * @module chat-diagnostic-handlers
 * @role On-demand retrieval surface for redacted harness diagnostics
 *       (RCC-0108 parent §4.13.1; binding accepted SPEC-03 §7 obligations;
 *       roadmap §5.5 sentence 2 log-suppression boundary).
 *
 * Registration intent: these frames are handled AHEAD of generic metadata
 * dispatch, mirroring the server's client-message-router.js placement
 * (`chat-turn:diagnostic:*` is claimed with EXPLICITLY NO fallthrough into
 * `chat-turn:` metadata semantics). On the client the same frames are
 * claimed at the top of stream-handlers' dispatch chain and their report
 * payloads are stripped from logging in ws-client's redactMessageForLog()
 * BEFORE console.log / captured-log forwarding ever sees them.
 *
 * Binding rules implemented here:
 *  - Retrieval fires ONLY from an explicit future caller action carrying a
 *    valid diagnosticId (SPEC-05 builds the UI). NO automatic request exists
 *    anywhere — never on error-row mount, never during hydration.
 *  - A narrow pending-request registry keyed by diagnosticId resolves only
 *    when the echoed thread/turn/diagnostic tuple matches. Partial null-echo
 *    frames settle nothing; the bounded timeout yields the fixed denial.
 *  - This module emits no diagnostic logs. The central ws-client ingress
 *    emits the single allowlisted type/availability/opaque-ID record before
 *    dispatch; adding outcome-specific logs here would exceed that contract.
 */

import { usePanelStore } from '../../state/panelStore';
import type { WebSocketMessage } from '../../types';
import { isValidDiagnosticId } from '../chat/terminal-error';
import {
  validateChatTurnDiagnosticReport,
  type ValidatedChatTurnDiagnosticReport,
} from '../chat/diagnostic-report';

const DIAGNOSTIC_REQUEST_TIMEOUT_MS = 10_000;

interface PendingDiagnosticRequest {
  readonly threadId: string;
  readonly turnId: string;
  readonly promise: Promise<ValidatedChatTurnDiagnosticReport | null>;
  resolve: (report: ValidatedChatTurnDiagnosticReport | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingDiagnosticRequests = new Map<string, PendingDiagnosticRequest>();

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function settlePending(
  diagnosticId: string,
  report: ValidatedChatTurnDiagnosticReport | null,
): void {
  const pending = pendingDiagnosticRequests.get(diagnosticId);
  if (!pending) return;
  pendingDiagnosticRequests.delete(diagnosticId);
  clearTimeout(pending.timer);
  pending.resolve(report);
}

/** Retire every request owned by the socket generation that just closed. */
export function retirePendingChatDiagnosticRequests(): void {
  for (const diagnosticId of [...pendingDiagnosticRequests.keys()]) {
    settlePending(diagnosticId, null);
  }
}

export interface ChatDiagnosticRouteIds {
  threadId: string;
  turnId: string;
  diagnosticId: string;
}

/**
 * Explicit outbound typed sender for `WsChatDiagnosticGetRequest`
 * ({type:'chat-turn:diagnostic:get', threadId, turnId, diagnosticId,
 * workspaceId?}). Registers one waiting consumer for the given diagnosticId,
 * sends the typed request over the panel socket, and resolves with the
 * retrieved report — or null on unavailable/null-echo denial or timeout.
 * There is NO automatic invocation anywhere in the product; SPEC-05 owns
 * the UI action that calls this.
 */
export function requestChatTurnDiagnostic(
  request: ChatDiagnosticRouteIds & { workspaceId?: string },
): Promise<ValidatedChatTurnDiagnosticReport | null> {
  if (
    !isValidDiagnosticId(request.diagnosticId)
    || !nonEmptyString(request.threadId)
    || !nonEmptyString(request.turnId)
  ) {
    return Promise.resolve(null);
  }

  const existing = pendingDiagnosticRequests.get(request.diagnosticId);
  if (existing) {
    return existing.threadId === request.threadId && existing.turnId === request.turnId
      ? existing.promise
      : Promise.resolve(null);
  }

  let resolvePromise!: (report: ValidatedChatTurnDiagnosticReport | null) => void;
  const promise = new Promise<ValidatedChatTurnDiagnosticReport | null>((resolve) => {
    resolvePromise = resolve;
  });
  const timer = setTimeout(() => {
    settlePending(request.diagnosticId, null);
  }, DIAGNOSTIC_REQUEST_TIMEOUT_MS);

  pendingDiagnosticRequests.set(request.diagnosticId, {
    threadId: request.threadId,
    turnId: request.turnId,
    promise,
    resolve: resolvePromise,
    timer,
  });

  const ws = usePanelStore.getState().ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    // Socket not usable — treat as an immediate fixed denial of THIS
    // pending wait rather than leaking it past disconnects.
    settlePending(request.diagnosticId, null);
    return promise;
  }

  ws.send(JSON.stringify({
    type: 'chat-turn:diagnostic:get',
    threadId: request.threadId,
    turnId: request.turnId,
    diagnosticId: request.diagnosticId,
    ...(request.workspaceId !== undefined ? { workspaceId: request.workspaceId } : {}),
  }));
  return promise;
}

/**
 * Inbound `chat-turn:diagnostic:report`. Deliver the report to the waiting
 * consumer for the exact echoed route, or hold nothing observable and drop
 * silently. This module NEVER logs any report field.
 */
export function handleChatDiagnosticReportFrame(
  msg: WebSocketMessage,
): boolean {
  if (!nonEmptyString(msg.diagnosticId)) {
    return true;
  }
  const pending = pendingDiagnosticRequests.get(msg.diagnosticId);
  if (!pending) {
    // No pending consumer — hold nothing observable.
    return true;
  }
  if (msg.threadId !== pending.threadId || msg.turnId !== pending.turnId) {
    return true;
  }
  settlePending(msg.diagnosticId, readReportPayload(msg));
  return true;
}

/** Narrow the frame's report payload defensively without widening shared bag types. */
function readReportPayload(msg: WebSocketMessage): ValidatedChatTurnDiagnosticReport | null {
  const candidate = (msg as { report?: unknown }).report;
  return validateChatTurnDiagnosticReport(candidate);
}

/**
 * Inbound `chat-turn:diagnostic:unavailable` — ONE fixed value-free denial
 * frame for every denial class. Echoed identifiers may be null (null-echo
 * convention). Correlation is deterministic:
 * Only a complete echoed threadId+turnId+diagnosticId tuple can resolve a
 * wait. A partial/null echo cannot be attributed safely and expires through
 * the bounded timeout instead of mutating another route's visible state.
 */
export function handleChatDiagnosticUnavailableFrame(
  msg: WebSocketMessage,
): boolean {
  if (
    nonEmptyString(msg.diagnosticId)
    && nonEmptyString(msg.threadId)
    && nonEmptyString(msg.turnId)
  ) {
    const pending = pendingDiagnosticRequests.get(msg.diagnosticId);
    if (pending?.threadId === msg.threadId && pending.turnId === msg.turnId) {
      settlePending(msg.diagnosticId, null);
    }
  }

  return true;
}
