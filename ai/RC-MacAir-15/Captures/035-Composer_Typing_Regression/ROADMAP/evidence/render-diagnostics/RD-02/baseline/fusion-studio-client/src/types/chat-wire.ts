/**
 * @module types/chat-wire
 * @role Routed chat wire contracts — REQUIRED-shape interfaces for the
 * sequenced in-flight family, the post-terminal acknowledgement family, and
 * the frozen diagnostic retrieval frames (accepted SPEC-03 §7).
 *
 * Split out of the former monolithic types module (SPEC-04 Slice A); kept as
 * its own module so the legacy broad wire surface (`./websocket`) and the
 * typed routed-dispatch surface each stay one job under the roadmap §5.7
 * line bound.
 *
 * Transport truth: declarations only, no runtime logic.
 */

import type {
  AssistantPart,
  TokenUsage,
  TurnTerminalError,
  UniversalToolDisplay,
} from './chat';

/*
 * ---------------------------------------------------------------------------
 * REQUIRED-shape routed chat family (SPEC-02 §9 final wire union).
 *
 * Every member below carries a REQUIRED positive-integer `streamSeq` through
 * `turn_end`. Dispatch-side validation of that contract belongs to the routed
 * frontier gates (roadmap §5.3); sequence-less emissions from disabled legacy
 * adapters are tolerated by diagnose-and-drop handling, never by loosening
 * these shapes (SPEC-02 decision #11). `scope:'project'` is stamped on every
 * outbound chat-derived frame for compatibility and must be ignored for
 * routing.
 * ---------------------------------------------------------------------------
 */

export interface WsTurnBeginMessage {
  type: 'turn_begin';
  threadId: string;
  turnId: string;
  /** Positive integer; sole authoritative whole-turn order. */
  streamSeq: number;
  scope?: string;
  userInput?: string;
}

export interface WsStepBeginMessage {
  type: 'step_begin';
  threadId: string;
  turnId: string;
  streamSeq: number;
  identity: string;
  startedAt: number;
  activityRevision: number;
  stepId?: string;
  messageId?: string;
}

/** Empty initial chunks are suppressed server-side; continuation whitespace arrives verbatim. */
export interface WsContentMessage {
  type: 'content';
  threadId: string;
  turnId: string;
  streamSeq: number;
  activityRevision: number;
  text: string;
}

export interface WsThinkingMessage {
  type: 'thinking';
  threadId: string;
  turnId: string;
  streamSeq: number;
  activityRevision: number;
  text: string;
}

export interface WsToolCallMessage {
  type: 'tool_call';
  threadId: string;
  turnId: string;
  streamSeq: number;
  toolName: string;
  toolCallId: string;
  activityRevision: number;
  toolArgs?: Record<string, unknown>;
}

export interface WsToolCallArgsMessage {
  type: 'tool_call_args';
  threadId: string;
  turnId: string;
  streamSeq: number;
  toolCallId: string;
  argsChunk: string;
}

export interface WsToolResultMessage {
  type: 'tool_result';
  threadId: string;
  turnId: string;
  streamSeq: number;
  toolCallId: string;
  /** Optional fallback name when no segment exists yet for this call. */
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: unknown;
  toolStatus?: string;
  toolDisplay?: UniversalToolDisplay[];
  returnedDiff?: boolean;
  isError?: boolean;
}

export interface WsSubagentEventMessage {
  type: 'subagent_event';
  threadId: string;
  turnId: string;
  streamSeq: number;
  parentToolCallId: string;
  agentId: string;
  subagentEventType: string;
  subagentType?: string;
  subagentPayload?: unknown;
}

export interface WsStatusUpdateMessage {
  type: 'status_update';
  threadId: string;
  turnId: string;
  streamSeq: number;
  contextUsage?: number;
  tokenUsage?: TokenUsage | null;
}

export interface WsTurnEndMessage {
  type: 'turn_end';
  threadId: string;
  turnId: string;
  streamSeq: number;
  activityRevision: number;
  reason?: 'complete' | 'interrupted' | 'error';
  partial?: boolean;
  fullText?: string;
  userInput?: string;
  hasToolCalls?: boolean;
  parts?: AssistantPart[];
  /**
   * Absent-key semantics (parent §4.13 / accepted SPEC-03 §7): this key is
   * PRESENT only on an error terminal (`reason === 'error'`) and is OMITTED
   * on complete/interrupted terminals — never serialized as null. The
   * envelope's own `diagnosticId` follows the same never-null rule.
   */
  terminalError?: TurnTerminalError;
}

/** Discriminated union over the sequenced in-flight chat family. */
export type ChatInFlightWireMessage =
  | WsTurnBeginMessage
  | WsStepBeginMessage
  | WsContentMessage
  | WsThinkingMessage
  | WsToolCallMessage
  | WsToolCallArgsMessage
  | WsToolResultMessage
  | WsSubagentEventMessage
  | WsStatusUpdateMessage
  | WsTurnEndMessage;

/*
 * Post-terminal acknowledgement family. These correlating messages NEVER
 * carry `streamSeq` (SPEC-02 §9); they cannot mutate live helpers or
 * activity and survive after `currentTurn` has cleared (parent §4.6/§4.12).
 */

export interface WsExchangeMetadataMessage {
  type: 'exchange_metadata';
  threadId: string;
  turnId?: string;
  ts?: number;
  userInput?: string;
  metadata?: Record<string, unknown>;
}

export interface WsChatTurnSavedMessage {
  type: 'chat-turn:saved';
  threadId: string;
  turnId: string;
  exchangeId?: number;
  seq?: number;
  ts?: number;
  partial?: boolean;
  reason?: string;
  /** Merge metadata; may carry `terminalError` under absent-key semantics. */
  metadata?: Record<string, unknown>;
}

export type PostTerminalChatAckMessage =
  | WsExchangeMetadataMessage
  | WsChatTurnSavedMessage;

/*
 * ---------------------------------------------------------------------------
 * Diagnostic retrieval frames — FROZEN from accepted SPEC-03 §7.
 * Do not loosen these shapes.
 *
 * MANDATORY client obligation when consuming a report frame: suppress EVERY
 * report field before console logging or captured-log forwarding. Only the
 * message type, the fixed unavailable marker, and opaque route/diagnostic
 * identifiers may ever be logged (roadmap §5.5 sentence 2).
 * ---------------------------------------------------------------------------
 */

/** Closed V1 validated report object served inside `diagnostic:report`. */
export interface ChatTurnDiagnosticReport {
  version: 1;
  harnessId: string;
  modelId?: string;
  category: 'authentication' | 'timeout' | 'process_exit' | 'runtime';
  providerCode?: string;
  errorName?: string;
  exitCode?: number;
  signal?: string;
  message?: string;
  stderrExcerpt?: string;
  lastCanonicalEventType?: string;
  hadRenderableOutput: boolean;
  hadToolCalls: boolean;
  truncatedFields: string[];
}

export interface WsChatDiagnosticGetRequest {
  type: 'chat-turn:diagnostic:get';
  threadId: string;
  turnId: string;
  diagnosticId: string;
  /** Optional echo; must agree with the server-resolved value or be omitted. */
  workspaceId?: string;
}

export interface WsChatDiagnosticReportMessage {
  type: 'chat-turn:diagnostic:report';
  threadId?: string;
  turnId?: string;
  diagnosticId?: string;
  /** Closed V1 report; server-guaranteed ≤24KiB serialized. Never log its contents. */
  report: ChatTurnDiagnosticReport;
}

/**
 * ONE fixed value-free denial frame for every denial class. Echoed
 * identifiers are present-but-null when the request field was absent or
 * non-string — clients MUST code to this null-echo convention.
 */
export interface WsChatDiagnosticUnavailableMessage {
  type: 'chat-turn:diagnostic:unavailable';
  threadId: string | null;
  turnId: string | null;
  diagnosticId: string | null;
}
