/**
 * @module types/chat
 * @role Chat domain types — messages, stream segments, panel chat state,
 * assistant exchange history, live-turn snapshot projections, and the
 * RCC-0108 activity/cursor/terminal-envelope transport shapes.
 *
 * Split out of the former monolithic types module (SPEC-04 Slice A).
 * Pure type surface: no runtime logic.
 */

// Todo types for the bottom drawer
export type TodoItemStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  id: string;
  content: string;
  status: TodoItemStatus;
  priority?: 'low' | 'medium' | 'high';
}

export interface TodoDrawerState {
  items: TodoItem[];
  updatedAt: number;
  open: boolean;
}

export interface UniversalDiffDisplay {
  type: 'diff';
  path: string;
  oldText: string;
  newText: string;
  oldStart: number;
  newStart: number;
  removedLines: number;
  addedLines: number;
  isSummary?: boolean;
}

export type UniversalToolDisplay = UniversalDiffDisplay | {
  type?: string;
  [key: string]: unknown;
};

// All segment types that can appear in the ordered stream
export type SegmentType =
  | 'think' | 'text'
  | 'shell' | 'read' | 'write' | 'edit'
  | 'glob' | 'grep' | 'web_search' | 'fetch'
  | 'subagent' | 'todo';

// Stream segment — one contiguous block in arrival order
export interface StreamSegment {
  type: SegmentType;
  content: string;
  icon?: string;
  label?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  toolDisplay?: UniversalToolDisplay[];
  toolStatus?: string;
  returnedDiff?: boolean;
  isError?: boolean;
  /** Number of tool calls collapsed into this live grouped segment. */
  groupCount?: number;
  /** True when the closing tag has arrived — content is final */
  complete?: boolean;
}

// Message Types
export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Ordered segments (think + text inline) for assistant messages */
  segments?: StreamSegment[];
  /** Queue position when added to history; used for consistent render */
  releasedSegmentCount?: number;
  /**
   * Explicit identity for an unfinished, already-revealed snapshot baseline.
   * It renders normal instant assistant/tool output, but is not a completed
   * assistant reply and therefore must not own terminal error or reply chrome.
   */
  projection?: 'in-flight-snapshot-baseline';
  exchangeId?: number;
  exchangeSeq?: number;
  /**
   * Immediate client-validated terminal envelope for a just-finalized live or
   * terminal-snapshot turn. Presentation prefers this field over the durable
   * metadata fallback and therefore mounts at most one error row.
   */
  terminalError?: TurnTerminalError;
  /**
   * RCC-0108 §4.13: free-form exchange metadata. A persisted/saved/merged
   * envelope MAY carry `metadata.terminalError` (`TurnTerminalError`) under
   * absent-key semantics — the key is omitted entirely on non-error terminals
   * and client ingress reconstructs it from the closed catalog before state
   * or presentation consumes it.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Saved-exchange acknowledgement payload (`chat-turn:saved`). Its `metadata`
 * merges into the completed message per absent-key semantics and may carry
 * `terminalError`; nothing in this record forbids that key.
 */
export interface MessageExchangeSavedPayload {
  exchangeId?: number;
  seq?: number;
  ts?: number;
  metadata?: Record<string, unknown>;
}

export type ChatTurnBookmarkType = 'flag' | 'star' | 'heart';

export interface ChatTurnMetadataPatch {
  bookmark?: { type: ChatTurnBookmarkType } | null;
  note?: { body: string } | null;
}

export interface AssistantTurn {
  id: string;
  content: string;
  status: 'streaming' | 'complete';
  hasThinking: boolean;
  thinkingContent: string;
}

export interface PendingPromptAcceptance {
  text: string;
  composerText: string;
  workspaceId: string;
  attachmentIds: string[];
}

// Panel State
export interface PanelState {
  // Messages
  messages: Message[];
  currentTurn: AssistantTurn | null;

  pendingTurnEnd: boolean;
  /** Server-owned prompt acceptance awaiting correlated sent/failure. */
  pendingPromptAcceptance: PendingPromptAcceptance | null;
  /** Exact draft retained after a correlated acceptance failure for retry. */
  retryPromptDraft: PendingPromptAcceptance | null;
  /** Message to add when typing completes; set at turn_end, cleared by finalizeTurn */
  pendingMessage: Message | null;

  // Ordered stream of segments (think and text inline, in arrival order)
  segments: StreamSegment[];

  /** Captured at finalize; used when adding to messages at turn_begin */
  lastReleasedSegmentCount: number;

  /** Per-thread todo drawer state (TODO_DRAWER_SPEC) */
  todoDrawer?: TodoDrawerState;

  /** Saved-exchange acks that arrived before live reveal finalization. */
  pendingSavedExchanges?: Record<string, MessageExchangeSavedPayload>;

  /** Current turn waiting for SQLite saved-exchange acknowledgement. */
  pendingExchangeSaveTurnId?: string | null;

  /**
   * RCC-0108 SPEC-05 Slice A (parent §4.1/§4.9): observable transient Working
   * activity for the CURRENT turn, keyed by threadId+turnId. Never a
   * StreamSegment/AssistantPart, never persisted, never rendered by history
   * (InstantSegmentRenderer). `activityRevision` orders only Working-state
   * transitions — `streamSeq` stays the sole whole-turn order (§5.2).
   */
  activity: TurnActivity | null;

}

// Rich History Format (part family). Tool-call part result shape is fixed
// parity with the served `LiveTurnSnapshot.parts` tool_call variant
// (SPEC-02 §9): {type:'tool_call', toolCallId, name, arguments, result}.
export interface ToolCallPart {
  type: 'tool_call';
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: {
    output?: string;
    statusMessage?: string;
    display?: UniversalToolDisplay[];
    returnedDiff?: boolean;
    isError?: boolean;
    error?: string;
    files?: string[];
  };
  duration_ms?: number;
}

export interface TextPart {
  type: 'text';
  content: string;
}

export interface ThinkPart {
  type: 'think';
  content: string;
}

export type AssistantPart = TextPart | ThinkPart | ToolCallPart;

export interface TokenUsage {
  input_other?: number;
  input_cache_read?: number;
  input_cache_creation?: number;
  input_total?: number;
  output?: number;
  total?: number;
  context_pct?: number;
}

export interface ExchangeData {
  exchangeId?: number;
  seq: number;
  ts: number;
  user: string;
  assistant: {
    parts: AssistantPart[];
  };
  metadata?: Record<string, unknown>;
}

/*
 * ---------------------------------------------------------------------------
 * RCC-0108 parent §4.1 — provider-neutral transient activity shapes.
 *
 * Transport-truth declarations shared by routed `step_begin`/`step_cursor`
 * payloads and `LiveTurnSnapshot`. `activityRevision` orders only Working-
 * state transitions; `streamSeq` remains the sole whole-turn order and the
 * revision never substitutes for it (roadmap §5.2). Observable presentation
 * transitions belong to SPEC-05.
 * ---------------------------------------------------------------------------
 */

/** One fresh model generation/API call within the active assistant turn. */
export interface TurnActivity {
  kind: 'working';
  turnId: string;
  identity: string;
  stepId?: string;
  messageId?: string;
  startedAt: number;
  activityRevision: number;
}

/** Transient bookkeeping for the most recently accepted step identity/time. */
export interface TurnStepCursor {
  identity: string;
  startedAt: number;
}

export type TurnTerminalErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'MODEL_TIMEOUT'
  | 'HARNESS_EXITED'
  | 'MODEL_RESPONSE_FAILED';

/**
 * Parent §4.13 closed safe terminal catalog entry.
 *
 * BINDING AVAILABILITY CONTRACT (accepted SPEC-03 §7):
 * - `diagnosticId` is PRESENT only after genuine diagnostic persistence
 *   success; OMITTED otherwise; NEVER serialized as null.
 * - Wire frames and persisted/saved metadata omit this envelope entirely on
 *   non-error terminals (absent-key = no envelope).
 * - `LiveTurnSnapshot.terminalError` ALWAYS carries the field (null-init);
 *   on that type the field is non-optional and may be null.
 * - Every catalog outcome is recoverable, so the literal type is `true`.
 * - `message` is the exact fixed catalog constant — clients must never
 *   parse or interpolate it.
 */
export interface TurnTerminalError {
  kind: 'runtime' | 'authentication';
  code: TurnTerminalErrorCode;
  message: string;
  recoverable: true;
  diagnosticId?: string;
}

export type LiveTurnStatus = 'in_flight' | 'complete' | 'interrupted' | 'error';

/**
 * Usage/status projection mirrored onto the live snapshot (SPEC-02 R-FINDING-2
 * repair). Fields are nullable on the wire (the server mirror serializes
 * explicit nulls); treat null and undefined equivalently. Never read usage
 * from terminal snapshots — terminal clears the mirror (SPEC-02 S2-D9).
 */
export interface TurnUsageProjection {
  contextUsage?: number | null;
  tokenUsage?: TokenUsage | null;
  messageId?: string | null;
  planMode?: boolean;
}

/**
 * Authoritative live-turn reconstruction baseline (SPEC-02 §9 final shape).
 * Served verbatim on thread-open. `streamSeq` starts at 1 and is the sole
 * whole-turn sequence — there is exactly one frontier counter per turn.
 */
export interface LiveTurnSnapshot {
  workspaceId: string;
  scope: string;
  threadId: string;
  turnId: string;
  userInput: string;
  /** Attachments accepted with the prompt (deep-cloned structured data; opaque to routing). */
  attachments: unknown[];
  status: LiveTurnStatus;
  fullText: string;
  parts: AssistantPart[];
  activity: TurnActivity | null;
  stepCursor: TurnStepCursor | null;
  /** Serializable projection of the full-turn step-identity ledger. */
  seenStepIdentities: string[];
  /** Monotonic Working-transition revision; initialized 0 at turn start. */
  activityRevision: number;
  usage: TurnUsageProjection | null;
  /** ALWAYS carried; null unless status === 'error' (parent §4.9). */
  terminalError: TurnTerminalError | null;
  streamSeq: number;
  updatedAt: number;
}
