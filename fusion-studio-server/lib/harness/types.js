/**
 * Canonical event types emitted by harness translators and consumed by the
 * event bus / websocket broadcaster. All harnesses (Kimi, Claude, Codex, etc.)
 * must translate their wire protocol into these events.
 *
 * @typedef {'turn_begin' | 'step_begin' | 'content' | 'thinking' | 'tool_call' | 'tool_call_args' | 'tool_result' | 'tool_snapshot' | 'subagent_event' | 'status_update' | 'turn_end'} CanonicalEventType
 */

/**
 * @typedef {Object} CanonicalEvent
 * @property {CanonicalEventType} type
 * @property {number} timestamp
 * @property {'provider_reported'|'host_observed'} [timestampSource]
 * @property {number} [observedAt]
 * @property {number} [reportedAt]
 * @property {string} [turnId]
 */

/**
 * Atomic terminal ToolPart emitted only by the OpenCode adapter. The complete
 * input is the sole provenance extraction source; result file hints stay inert.
 * @typedef {Object} ToolSnapshotEvent
 * @property {'tool_snapshot'} type
 * @property {'terminal_snapshot'} origin
 * @property {'opencode'} harnessId
 * @property {'opencode'} provider
 * @property {number} timestamp
 * @property {'provider_reported'|'host_observed'} timestampSource
 * @property {number} observedAt
 * @property {number} [reportedAt]
 * @property {string} toolCallId
 * @property {string} toolName
 * @property {string} nativeToolName
 * @property {'completed'|'error'} status
 * @property {boolean} hasInput
 * @property {*} [input]
 * @property {number} [executionStartedReportedAt]
 * @property {number} [terminalReportedAt]
 * @property {number} [terminalSnapshotReportedAt]
 * @property {Object} result
 */

/**
 * @typedef {Object} TurnBeginEvent
 * @property {'turn_begin'} type
 * @property {number} timestamp
 * @property {string} turnId
 * @property {string} userInput
 */

/**
 * One fresh model generation/API call within the active assistant turn.
 * Provider-neutral translation of a harness's native model-step-begin
 * notification. The adapter preserves only a present finite numeric native
 * timestamp (never synthesized) and non-empty step/message identifiers;
 * temporal normalization and identity derivation happen applier-side.
 *
 * @typedef {Object} StepBeginEvent
 * @property {'step_begin'} type
 * @property {number} [timestamp]
 * @property {string} [stepId]
 * @property {string} [messageId]
 */

/**
 * @typedef {Object} ContentEvent
 * @property {'content'} type
 * @property {number} timestamp
 * @property {string} text
 * @property {string} [turnId]
 */

/**
 * @typedef {Object} ThinkingEvent
 * @property {'thinking'} type
 * @property {number} timestamp
 * @property {string} text
 * @property {string} [turnId]
 */

/**
 * @typedef {Object} ToolCallEvent
 * @property {'tool_call'} type
 * @property {number} timestamp
 * @property {string} toolCallId
 * @property {string} toolName
 * @property {string} [turnId]
 */

/**
 * @typedef {Object} ToolCallArgsEvent
 * @property {'tool_call_args'} type
 * @property {number} timestamp
 * @property {string} toolCallId
 * @property {string} argsChunk
 * @property {string} [turnId]
 */

/**
 * @typedef {Object} ToolResultEvent
 * @property {'tool_result'} type
 * @property {number} timestamp
 * @property {string} toolCallId
 * @property {string} toolName
 * @property {string} output
 * @property {string} [statusMessage] - Optional displayable diagnostic/status
 *   text. Harness adapters should omit non-diagnostic titles, command labels,
 *   and text already present in output.
 * @property {unknown[]} display
 * @property {boolean} returnedDiff
 * @property {boolean} isError
 * @property {string[]} [files]
 * @property {string} [turnId]
 *
 * NOTE: Field name mismatch between layers:
 *   - Translator events use: output, statusMessage, display, returnedDiff, isError, files
 *   - Current legacy bus/websocket events use: toolOutput, toolStatus, toolDisplay, returnedDiff, isError
 *   RECOMMENDATION (Slice G): Keep the canonical event applier on this field shape,
 *   then adapt explicitly at the websocket boundary if the client message contract
 *   still needs tool-prefixed names.
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} [input_other]
 * @property {number} [input_cache_read]
 * @property {number} [input_cache_creation]
 * @property {number} [output]
 */

/**
 * @typedef {Object} TurnEndEventMeta
 * @property {string} [messageId]
 * @property {TokenUsage} [tokenUsage]
 * @property {number} [contextUsage]
 * @property {boolean} [planMode]
 * @property {string} [harnessId]
 * @property {string} [provider]
 * @property {string} [model]
 */

/**
 * @typedef {Object} TurnEndEvent
 * @property {'turn_end'} type
 * @property {number} timestamp
 * @property {string} turnId
 * @property {string} fullText
 * @property {boolean} hasToolCalls
 * @property {TurnEndEventMeta} [_meta]
 */

/**
 * @typedef {Object} StatusUpdateEvent
 * @property {'status_update'} type
 * @property {number} timestamp
 * @property {number} [contextUsage]
 * @property {TokenUsage} [tokenUsage]
 * @property {string} [messageId]
 * @property {boolean} [planMode]
 * @property {string} [turnId]
 */

/**
 * @typedef {Object} SubagentEvent
 * @property {'subagent_event'} type
 * @property {number} timestamp
 * @property {string} parentToolCallId
 * @property {string} agentId
 * @property {string} subagentType
 * @property {string} subagentEventType
 * @property {Object} subagentPayload
 * @property {string} [turnId]
 */

/**
 * @typedef {Object} ChatMessage
 * @property {'user' | 'assistant' | 'system'} role
 * @property {string} content
 */

/**
 * @typedef {Object} SendOptions
 * @property {string} [system]
 * @property {ChatMessage[]} [history]
 */

/**
 * @typedef {Object} HarnessConfig
 * @property {string} [cliPath]
 * @property {string} [apiKey]
 * @property {string} [baseUrl]
 * @property {string} [model]
 * @property {number} [maxSteps]
 */

/**
 * @typedef {Object} HarnessSession
 * @property {string} threadId
 * @property {(message: string, options?: SendOptions) => AsyncIterable<CanonicalEvent>} sendMessage
 * @property {() => Promise<void>} stop
 */

/**
 * @typedef {Object} AIHarness
 * @property {string} id
 * @property {string} name
 * @property {string} provider
 * @property {(config: HarnessConfig) => Promise<void>} initialize
 * @property {(threadId: string, projectRoot: string) => Promise<HarnessSession>} startThread
 * @property {() => Promise<void>} dispose
 */

module.exports = {};
