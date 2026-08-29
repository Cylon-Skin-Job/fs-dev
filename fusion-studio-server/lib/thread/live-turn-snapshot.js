/**
 * @module live-turn-snapshot
 * @role Mutate canonical live turn snapshots for in-memory thread runtimes.
 */

const { validateTurnTerminalError } = require('./turn-terminal-error');

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function bump(snapshot) {
  snapshot.streamSeq += 1;
  snapshot.updatedAt = Date.now();
}

/**
 * Begin a live-turn snapshot. SPEC-01 Slice C adds the accepted prompt's
 * structured attachments as plain deep-copied data (SPEC §7.1: the snapshot
 * stays a JSON-safe serializable projection; frozen route-derived copies are
 * cloned in so later mutation of any source cannot rewrite history).
 *
 * SPEC-02 Slice B (RCC-0108): initializes the transient Working-activity
 * projection — `activity`, `stepCursor`, the JSON-safe `seenStepIdentities`
 * mirror of the runtime ledger, and `activityRevision` — all JSON-safe.
 *
 * SPEC-02 Slice D repair R-FINDING-2 (roadmap §5.2): `usage` starts null and
 * becomes a JSON-safe projection of the accumulator's status metadata inside
 * the gated mutation that accepts each status_update, so every published
 * usage/status state is reconstructible from the snapshot at its sequence.
 *
 * SPEC-03 Slice B (RCC-0108 parent §4.9): `terminalError` starts null at
 * turn start; only an error-terminal completion may retain a normalized
 * safe envelope (see completeLiveTurn).
 */
function beginLiveTurn(key, payload) {
  return {
    workspaceId: key.workspaceId,
    scope: key.scope,
    threadId: key.threadId,
    turnId: payload.turnId,
    userInput: payload.userInput || '',
    attachments: cloneJson(Array.isArray(payload.attachments) ? payload.attachments : []),
    status: 'in_flight',
    fullText: '',
    parts: [],
    activity: null,
    stepCursor: null,
    seenStepIdentities: [],
    activityRevision: 0,
    usage: null,
    terminalError: null,
    streamSeq: 1,
    updatedAt: Date.now(),
  };
}

function appendContent(snapshot, text) {
  if (!snapshot || !text) return;
  snapshot.fullText += text;
  const lastPart = snapshot.parts[snapshot.parts.length - 1];
  if (lastPart && lastPart.type === 'text') {
    lastPart.content += text;
  } else {
    snapshot.parts.push({ type: 'text', content: text });
  }
  bump(snapshot);
}

function appendThinking(snapshot, text) {
  if (!snapshot || !text) return;
  const lastPart = snapshot.parts[snapshot.parts.length - 1];
  if (lastPart && lastPart.type === 'think') {
    lastPart.content += text;
  } else {
    snapshot.parts.push({ type: 'think', content: text });
  }
  bump(snapshot);
}

function appendToolCall(snapshot, payload) {
  if (!snapshot) return;
  snapshot.parts.push({
    type: 'tool_call',
    toolCallId: payload.toolCallId || '',
    name: payload.toolName || 'unknown',
    arguments: {},
    result: {
      output: '',
      display: [],
      isError: false,
    },
  });
  bump(snapshot);
}

function applyToolArgs(snapshot, toolCallId, parsedArgs) {
  if (!snapshot || !toolCallId || !parsedArgs) return;
  const part = snapshot.parts.find(item => item.type === 'tool_call' && item.toolCallId === toolCallId);
  if (!part) return;
  part.arguments = parsedArgs;
  bump(snapshot);
}

function applyToolResult(snapshot, payload) {
  if (!snapshot) return;
  const toolCallId = payload.toolCallId || '';
  const part = snapshot.parts.find(item => item.type === 'tool_call' && item.toolCallId === toolCallId);
  if (!part) return;
  part.arguments = payload.toolArgs || part.arguments || {};
  part.result = {
    output: payload.output || '',
    statusMessage: payload.statusMessage,
    display: Array.isArray(payload.display) ? payload.display : [],
    returnedDiff: Boolean(payload.returnedDiff),
    isError: Boolean(payload.isError),
    error: payload.isError ? (payload.output || payload.statusMessage || 'Tool failed') : undefined,
    files: Array.isArray(payload.files) ? payload.files : [],
    // SPEC-01 Slice C: enforcement bounces carry their phase on the persisted
    // result. Conditional spread keeps ordinary results byte-identical to the
    // pre-drain snapshot shape; bump timing is unchanged.
    ...(payload.enforcementPhase ? { enforcementPhase: payload.enforcementPhase } : {}),
  };
  bump(snapshot);
}

function touchStatus(snapshot) {
  if (!snapshot) return;
  bump(snapshot);
}

/**
 * Mirror the accumulator's usage/status metadata onto the snapshot as a
 * JSON-safe deep clone and bump once. SPEC-02 Slice D repair R-FINDING-2
 * (roadmap §5.2): usage published by chat:status_update at seq N must be
 * reconstructible from the snapshot at N, so the mirror is written inside
 * the same gated mutation that accepts the status — one call, exactly one
 * frontier advance. The accumulator keeps the authoritative mutable copy;
 * the snapshot never aliases it (cloneJson breaks all references).
 */
function setUsage(snapshot, usage) {
  if (!snapshot) return;
  snapshot.usage = {
    contextUsage: usage?.contextUsage ?? null,
    tokenUsage: cloneJson(usage?.tokenUsage ?? null),
    messageId: usage?.messageId ?? null,
    planMode: Boolean(usage?.planMode),
  };
  bump(snapshot);
}

/**
 * Complete the live turn. SPEC-02 Slice B: every terminal path routes here
 * (terminalizeTurn and the legacy manager.completeLiveTurn), so this is the
 * single Working-clear site. A non-null `activity` is a real Working→cleared
 * transition and bumps `activityRevision` exactly once; then the transient
 * activity, cursor, and seen-ledger projection are cleared. The revision
 * never resets within a turn.
 *
 * SPEC-02 Slice D repair R-FINDING-2 — terminal usage retention decision:
 * usage is transient in-flight status metadata whose authoritative
 * accumulator copy settleAccumulatorForTerminal already resets on every
 * terminal path, so the snapshot mirror clears too, keeping both
 * representations in exact agreement.
 *
 * SPEC-03 Slice B (parent §4.9/§4.13): the ONE existing terminal bump also
 * writes the terminal envelope — `terminalError` retains only a VALIDATED
 * safe envelope when status is 'error' (re-validated here defensively; the
 * canonical applier owns first-pass validation), and forces null for every
 * other status. Error-terminal snapshots retain the envelope until that
 * snapshot is superseded. No second bump: this stays inside the same
 * completeLiveTurn mutation.
 */
function completeLiveTurn(snapshot, status = 'complete', terminalError = null) {
  if (!snapshot) return;
  if (snapshot.activity !== null) {
    snapshot.activityRevision += 1;
  }
  snapshot.activity = null;
  snapshot.stepCursor = null;
  snapshot.seenStepIdentities = [];
  snapshot.usage = null;
  snapshot.status = status;
  snapshot.terminalError = status === 'error'
    ? validateTurnTerminalError(terminalError)
    : null;
  bump(snapshot);
}

function cloneLiveTurn(snapshot) {
  return cloneJson(snapshot);
}

module.exports = {
  appendContent,
  appendThinking,
  appendToolCall,
  applyToolArgs,
  applyToolResult,
  beginLiveTurn,
  cloneLiveTurn,
  completeLiveTurn,
  setUsage,
  touchStatus,
};
