/**
 * @module e2e/support/working-activity-wire
 * @role Typed server-shaped frame factories + shared scenario ids for the
 *       SPEC-04 @routing/@frontier cases (SPEC-04 §3 Slice D item 4).
 *
 * Every factory enforces the REQUIRED wire contract: real distinct
 * `threadId`/`turnId`, positive-integer `streamSeq` on the in-flight family,
 * plausible monotone-ish `activityRevision` where the field exists. Types are
 * imported from the real production modules (thread-bootstrap-order.spec.ts
 * precedent), so a drift in the accepted engine shapes fails compilation of
 * this file instead of silently breaking a case. No prompt text ever crosses
 * these factories — nothing here can trigger real harness work.
 */

import type {
  AssistantPart,
  ExchangeData,
  LiveTurnSnapshot,
  Thread,
  TurnTerminalError,
} from '../../src/types';

// ── Scenario identity constants ────────────────────────────────────────────

export const THREAD_A = 'wa-thread-a';
export const THREAD_B = 'wa-thread-b';
export const TURN_A1 = 'wa-turn-a1';
export const TURN_A2 = 'wa-turn-a2';
export const TURN_B1 = 'wa-turn-b1';
export const NAME_A = 'WA-THREAD-ALPHA';
export const NAME_B = 'WA-THREAD-BETA';

/** Server-shaped thread entry/list fixture (mirrors lib/db thread rows). */
export function threadListFrame(ids: Array<{ id: string; name: string }>): {
  type: 'thread:list';
  threads: Thread[];
} {
  return {
    type: 'thread:list',
    threads: ids.map(({ id, name }) => ({
      threadId: id,
      entry: {
        name,
        createdAt: '2026-08-01T00:00:00.000Z',
        messageCount: 0,
        status: 'active' as const,
        scope: 'project',
      },
    })),
  };
}

export interface OpenedReplySpec {
  threadId: string;
  /** Durable history exchanges hydrated before the live overlay. */
  exchanges?: ExchangeData[];
  /** Served live-turn snapshot overlay (SPEC-04 §2 hydration input). */
  liveTurn?: LiveTurnSnapshot | null;
  contextUsage?: number;
}

/** Server-shaped `thread:opened` reply authored per scenario. */
export function openedReply(spec: OpenedReplySpec): Record<string, unknown> {
  return {
    type: 'thread:opened',
    threadId: spec.threadId,
    thread: {
      name: spec.threadId === THREAD_B ? NAME_B : NAME_A,
      createdAt: '2026-08-01T00:00:00.000Z',
      messageCount: spec.exchanges?.length ?? 0,
      status: 'active',
      scope: 'project',
    },
    exchanges: spec.exchanges ?? [],
    contextUsage: spec.contextUsage ?? 0.1,
    ...(spec.liveTurn !== undefined ? { liveTurn: spec.liveTurn } : {}),
  };
}

/** Rich-history exchange fixture. */
export function exchange(
  user: string,
  parts: AssistantPart[],
  seq: number,
): ExchangeData {
  return { exchangeId: seq, seq, ts: 1_700_000_000_000 + seq, user, assistant: { parts } };
}

// ── LiveTurnSnapshot factory ───────────────────────────────────────────────

export interface SnapshotSpec {
  threadId: string;
  turnId: string;
  streamSeq: number;
  status?: LiveTurnSnapshot['status'];
  userInput?: string;
  parts?: AssistantPart[];
  fullText?: string;
  activityRevision?: number;
  seenStepIdentities?: string[];
  terminalError?: TurnTerminalError | null;
  activity?: LiveTurnSnapshot['activity'];
  stepCursor?: LiveTurnSnapshot['stepCursor'];
}

const SAMPLE_TERMINAL_ERROR: TurnTerminalError = {
  kind: 'runtime',
  code: 'MODEL_RESPONSE_FAILED',
  message: 'Model response failed',
  recoverable: true,
};

/** Frozen SPEC-03 §7 catalog-shaped envelope for error-terminal snapshots. */
export function sampleTerminalError(): TurnTerminalError {
  return { ...SAMPLE_TERMINAL_ERROR };
}

const TERMINAL_CATALOG: Record<TurnTerminalError['code'], TurnTerminalError> = {
  AUTHENTICATION_FAILED: {
    kind: 'authentication', code: 'AUTHENTICATION_FAILED', recoverable: true,
    message: 'Authentication failed. Check the configured harness credentials and try again.',
  },
  MODEL_TIMEOUT: {
    kind: 'runtime', code: 'MODEL_TIMEOUT', recoverable: true,
    message: 'The model response timed out before it completed.',
  },
  HARNESS_EXITED: {
    kind: 'runtime', code: 'HARNESS_EXITED', recoverable: true,
    message: 'The model process ended before the response completed.',
  },
  MODEL_RESPONSE_FAILED: {
    kind: 'runtime', code: 'MODEL_RESPONSE_FAILED', recoverable: true,
    message: 'The model response failed before it completed.',
  },
};

/** Exact closed-catalog envelope for dedicated SPEC-05 terminal cases. */
export function terminalError(
  code: TurnTerminalError['code'] = 'MODEL_RESPONSE_FAILED',
  diagnosticId?: string,
): TurnTerminalError {
  return { ...TERMINAL_CATALOG[code], ...(diagnosticId ? { diagnosticId } : {}) };
}

export interface DiagnosticReportSpec {
  threadId?: string;
  turnId?: string;
  diagnosticId: string;
  stderrExcerpt: string;
  message: string;
}

/**
 * Server-shaped `chat-turn:diagnostic:report` carrying deliberately
 * redaction-sensitive fields — every assertion around it proves they never
 * reach console or captured-log surfaces.
 */
export function diagnosticReportFrame(spec: DiagnosticReportSpec): Record<string, unknown> {
  return {
    type: 'chat-turn:diagnostic:report',
    ...(spec.threadId !== undefined ? { threadId: spec.threadId } : {}),
    ...(spec.turnId !== undefined ? { turnId: spec.turnId } : {}),
    diagnosticId: spec.diagnosticId,
    report: {
      version: 1,
      harnessId: 'opencode',
      category: 'runtime',
      message: spec.message,
      stderrExcerpt: spec.stderrExcerpt,
      hadRenderableOutput: false,
      hadToolCalls: false,
      truncatedFields: [],
    },
  };
}

/**
 * Authoritative snapshot at N — fills every REQUIRED LiveTurnSnapshot field
 * so the fixture cannot accidentally serve an invalid route/sequence.
 */
export function snapshot(spec: SnapshotSpec): LiveTurnSnapshot {
  const parts = spec.parts ?? [];
  return {
    workspaceId: 'wa-workspace',
    scope: 'project',
    threadId: spec.threadId,
    turnId: spec.turnId,
    userInput: spec.userInput ?? 'WA-PROMPT-SNAPSHOT',
    attachments: [],
    status: spec.status ?? 'in_flight',
    fullText: spec.fullText ?? '',
    parts,
    activity: spec.activity ?? null,
    stepCursor: spec.stepCursor ?? null,
    seenStepIdentities: spec.seenStepIdentities ?? [],
    activityRevision: spec.activityRevision ?? 0,
    usage: null,
    terminalError:
      spec.terminalError !== undefined ? spec.terminalError : null,
    streamSeq: spec.streamSeq,
    updatedAt: 1_700_000_000_000,
  };
}

// ── Routed in-flight family (every member carries positive-integer seq) ────

type Rev = { activityRevision?: number };

export function begin(threadId: string, turnId: string, streamSeq: number) {
  return { type: 'turn_begin', threadId, turnId, streamSeq };
}

export function content(threadId: string, turnId: string, streamSeq: number, text: string, rev: Rev = {}) {
  return { type: 'content', threadId, turnId, streamSeq, activityRevision: rev.activityRevision ?? streamSeq, text };
}

export function thinking(threadId: string, turnId: string, streamSeq: number, text: string, rev: Rev = {}) {
  return { type: 'thinking', threadId, turnId, streamSeq, activityRevision: rev.activityRevision ?? streamSeq, text };
}

export function stepBegin(
  threadId: string, turnId: string, streamSeq: number,
  opts: { identity: string; startedAt?: number; activityRevision?: number },
) {
  return {
    type: 'step_begin', threadId, turnId, streamSeq,
    identity: opts.identity,
    startedAt: opts.startedAt ?? 1_000,
    activityRevision: opts.activityRevision ?? streamSeq,
  };
}

export function toolCall(
  threadId: string, turnId: string, streamSeq: number,
  opts: { toolName: string; toolCallId: string; args?: Record<string, unknown>; activityRevision?: number },
) {
  return {
    type: 'tool_call', threadId, turnId, streamSeq,
    toolName: opts.toolName, toolCallId: opts.toolCallId,
    activityRevision: opts.activityRevision ?? streamSeq,
    ...(opts.args ? { toolArgs: opts.args } : {}),
  };
}

export function toolCallArgs(threadId: string, turnId: string, streamSeq: number, toolCallId: string, argsChunk: string) {
  return { type: 'tool_call_args', threadId, turnId, streamSeq, toolCallId, argsChunk };
}

export function toolResult(
  threadId: string, turnId: string, streamSeq: number,
  opts: { toolCallId: string; toolName?: string; output?: unknown },
) {
  return {
    type: 'tool_result', threadId, turnId, streamSeq,
    toolCallId: opts.toolCallId,
    ...(opts.toolName ? { toolName: opts.toolName } : {}),
    toolOutput: opts.output ?? 'ok',
    toolStatus: 'success',
  };
}

export function subagentEvent(
  threadId: string, turnId: string, streamSeq: number,
  parentToolCallId: string, agentId: string,
) {
  return {
    type: 'subagent_event', threadId, turnId, streamSeq,
    parentToolCallId, agentId,
    // Server vocabulary (opencode translator): intro lines emit on TurnBegin/ToolCall.
    subagentEventType: 'TurnBegin', subagentType: 'explorer',
  };
}

export function statusUpdate(
  threadId: string, turnId: string, streamSeq: number,
  fields: { contextUsage?: number; tokenUsage?: Record<string, unknown> } = {},
) {
  return { type: 'status_update', threadId, turnId, streamSeq, ...fields };
}

export function turnEnd(
  threadId: string, turnId: string, streamSeq: number,
  opts: {
    reason?: 'complete' | 'interrupted' | 'error';
    fullText?: string;
    partial?: boolean;
    terminalError?: TurnTerminalError;
  } = {},
) {
  // reason:'interrupted' flushes immediately through public mechanics — the
  // deterministic way to observe terminalization without reveal pacing.
  return {
    type: 'turn_end', threadId, turnId, streamSeq,
    activityRevision: streamSeq,
    reason: opts.reason ?? 'interrupted',
    partial: opts.partial ?? true,
    ...(opts.fullText !== undefined ? { fullText: opts.fullText } : {}),
    ...(opts.terminalError !== undefined ? { terminalError: opts.terminalError } : {}),
  };
}

// ── Post-terminal family (never carry streamSeq) ──────────────────────────

export function chatTurnSaved(
  threadId: string, turnId: string,
  payload: { exchangeId: number; seq?: number; metadata?: Record<string, unknown> },
) {
  return {
    type: 'chat-turn:saved', threadId, turnId,
    exchangeId: payload.exchangeId,
    seq: payload.seq ?? payload.exchangeId,
    ts: 1_700_000_100_000,
    ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
  };
}

export function metadataUpdated(threadId: string, exchangeId: number, metadata: Record<string, unknown>) {
  return { type: 'chat-turn:metadata:updated', threadId, exchangeId, metadata };
}

export function exchangeMetadata(threadId: string, userInput: string, metadata: Record<string, unknown>) {
  return { type: 'exchange_metadata', threadId, userInput, metadata, ts: 1_700_000_100_000 };
}
