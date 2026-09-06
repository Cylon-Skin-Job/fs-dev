const TOOL_NAME_MAP = {
  bash: 'shell',
  read: 'read',
  write: 'write',
  edit: 'edit',
  grep: 'grep',
  glob: 'glob',
  webfetch: 'fetch',
  websearch: 'search',
  todowrite: 'todo',
  task: 'subagent',
};

function mapOpenCodeToolName(toolName) {
  if (typeof toolName !== 'string') return 'unknown';
  const normalized = toolName.replace(/[A-Z]/g, (character) => character.toLowerCase());
  return TOOL_NAME_MAP[normalized] || 'unknown';
}

function validReportedTime(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function validScalarBounded(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function mapOpenCodeTokenUsage(tokens = {}) {
  return {
    input_other: tokens.input,
    input_cache_read: tokens.cache?.read,
    input_cache_creation: tokens.cache?.write,
    output: tokens.output,
  };
}

function stringValue(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Primitive shape selection for optional identifiers: returns the first
 * candidate that is a non-empty (after trim) string, preserving its value
 * exactly as received. Unlike stringValue(), this never rewrites content —
 * identity judgment belongs to the canonical applier, not this adapter.
 */
function selectPreservedIdentifier(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return undefined;
}

function normalizeComparableText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getShellCommand(state = {}) {
  return stringValue(state.input?.command);
}

function isShellCommandLabel(candidate, command) {
  const status = normalizeComparableText(candidate).replace(/^\$\s*/, '');
  const normalizedCommand = normalizeComparableText(command);
  if (!status || !normalizedCommand) return false;
  return status === normalizedCommand
    || status === `run ${normalizedCommand}`
    || status === `running ${normalizedCommand}`;
}

function shouldSuppressStatusMessage(toolName, candidate, state, output) {
  const status = normalizeComparableText(candidate);
  if (!status) return true;
  if (status === normalizeComparableText(output)) return true;

  if (toolName === 'shell') {
    const command = getShellCommand(state);
    if (command && isShellCommandLabel(candidate, command)) return true;
    if (status === 'completed') return true;
    if (status === 'error' && normalizeComparableText(output)) return true;
  }

  return false;
}

function normalizeStatusMessage(toolName, state, output, isError) {
  const candidates = [
    stringValue(state.title),
    stringValue(state.metadata?.description),
    stringValue(state.status),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!shouldSuppressStatusMessage(toolName, candidate, state, output)) {
      return candidate;
    }
  }

  const exit = state.metadata?.exit;
  if (toolName === 'shell' && isError && typeof exit === 'number' && !normalizeComparableText(output)) {
    return `Command failed with exit code ${exit}`;
  }

  return undefined;
}

class OpenCodeJsonEventTranslator {
  constructor({ now = () => Date.now(), onDiagnostic = () => {} } = {}) {
    this.now = now;
    this.onDiagnostic = onDiagnostic;
    this.fullText = '';
    this.hasToolCalls = false;
    this.nextLegacyToolId = 0;
  }

  beginTurn(userInput, timestamp = this.now()) {
    this.fullText = '';
    this.hasToolCalls = false;
    this.nextLegacyToolId = 0;

    return {
      type: 'turn_begin',
      timestamp,
      timestampSource: 'host_observed',
      observedAt: timestamp,
      userInput: String(userInput || ''),
    };
  }

  translate(event) {
    if (!event || typeof event !== 'object') {
      return [];
    }

    const part = event.part || {};

    // OpenCode emits two native spellings for the same signal: a top-level
    // `step_start` event and a message part with `type: 'step-start'`. Both
    // map to one canonical step_begin. This branch must stay ahead of the
    // synthesized `event.timestamp || Date.now()` fallback below: adapters
    // never synthesize time (parent contract §4.7), they only preserve a
    // present finite numeric native envelope timestamp.
    if (event.type === 'step_start' || part.type === 'step-start') {
      return [this.translateStepBegin(part, event)];
    }

    const observedAt = this.now();
    const reportedAt = validReportedTime(event.timestamp);
    const timestamp = reportedAt ?? observedAt;
    const timestampSource = reportedAt == null ? 'host_observed' : 'provider_reported';

    if (event.type === 'text' || part.type === 'text') {
      return this.translateText(part, timestamp, timestampSource, observedAt, reportedAt);
    }

    if (part.type === 'reasoning') {
      return this.translateReasoning(part, timestamp, timestampSource, observedAt, reportedAt);
    }

    if (event.type === 'tool_use' || part.type === 'tool') {
      return this.translateToolUse(event, part, timestamp, timestampSource, observedAt, reportedAt);
    }

    if (event.type === 'step_finish' || part.type === 'step-finish') {
      return this.translateStepFinish(part, timestamp, timestampSource, observedAt, reportedAt);
    }

    return [];
  }

  translateText(part, timestamp, timestampSource, observedAt, reportedAt) {
    const text = String(part.text || '');
    this.fullText += text;
    return [{ type: 'content', timestamp, timestampSource, observedAt, reportedAt, text }];
  }

  translateReasoning(part, timestamp, timestampSource, observedAt, reportedAt) {
    return [{ type: 'thinking', timestamp, timestampSource, observedAt, reportedAt, text: String(part.text || '') }];
  }

  translateToolUse(envelope, part, timestamp, timestampSource, observedAt, reportedAt) {
    const validCallId = Object.hasOwn(part, 'callID') && validScalarBounded(part.callID, 512);
    const validToolName = Object.hasOwn(part, 'tool') && validScalarBounded(part.tool, 128);
    if (!validCallId || !validToolName) {
      this.onDiagnostic('agent_tool_malformed_identity');
      return this.translateLegacyToolUse(part, {
        timestamp, timestampSource, observedAt, reportedAt,
        validCallId, validToolName,
      });
    }
    const toolCallId = part.callID;
    const nativeToolName = part.tool;
    const toolName = mapOpenCodeToolName(nativeToolName);
    const state = part.state || {};
    if (state.status !== 'completed' && state.status !== 'error') {
      this.onDiagnostic('agent_tool_terminal_status_invalid');
      return this.translateLegacyToolUse(part, {
        timestamp, timestampSource, observedAt, reportedAt,
        validCallId: true, validToolName: true,
      });
    }

    this.hasToolCalls = true;

    const exit = state.metadata?.exit;
    const isError = typeof exit === 'number' ? exit !== 0 : state.status === 'error';
    const output = String(state.output || state.metadata?.output || '');
    const statusMessage = normalizeStatusMessage(toolName, state, output, isError);

    return [{
      type: 'tool_snapshot',
      timestamp,
      timestampSource,
      observedAt,
      reportedAt,
      origin: 'terminal_snapshot',
      harnessId: 'opencode',
      provider: 'opencode',
      toolCallId,
      toolName,
      nativeToolName,
      status: state.status,
      hasInput: Object.hasOwn(state, 'input'),
      input: state.input,
      executionStartedReportedAt: validReportedTime(state.time?.start),
      terminalReportedAt: validReportedTime(state.time?.end),
      terminalSnapshotReportedAt: reportedAt,
      result: {
        output,
        statusMessage,
        display: [],
        returnedDiff: false,
        isError,
        files: [],
      },
    }];
  }

  translateLegacyToolUse(part, timing) {
    const state = part.state && typeof part.state === 'object' ? part.state : {};
    const isTerminal = state.status === 'completed' || state.status === 'error';
    const toolCallId = timing.validCallId
      ? part.callID
      : `legacy-chat-tool-${++this.nextLegacyToolId}`;
    const toolName = timing.validToolName ? mapOpenCodeToolName(part.tool) : 'unknown';
    const base = {
      timestamp: timing.timestamp,
      timestampSource: timing.timestampSource,
      observedAt: timing.observedAt,
      reportedAt: timing.reportedAt,
      origin: isTerminal ? 'terminal_chat_fail_open' : 'legacy_chat_fail_open',
      toolCallId,
      toolName,
    };
    const events = [{ type: 'tool_call', ...base }];
    if (Object.hasOwn(state, 'input')) {
      let argsChunk = '';
      try { argsChunk = JSON.stringify(state.input); } catch (_error) {}
      if (argsChunk) events.push({ type: 'tool_call_args', ...base, argsChunk });
    }
    if (isTerminal) {
      const exit = state.metadata?.exit;
      const isError = typeof exit === 'number' ? exit !== 0 : state.status === 'error';
      const output = String(state.output || state.metadata?.output || '');
      events.push({
        type: 'tool_result',
        ...base,
        output,
        statusMessage: normalizeStatusMessage(toolName, state, output, isError),
        display: [],
        returnedDiff: false,
        isError,
        files: [],
      });
    }
    this.hasToolCalls = true;
    return events;
  }

  /**
   * Translate either OpenCode step-start spelling into one canonical
   * step_begin event. Adapter duties are shape selection only:
   * - timestamp: preserve the native envelope value (`event.timestamp`) only
   *   when it is present and a finite number — exactly as received. Omit the
   *   key entirely for missing/string/NaN/Infinity values; never synthesize
   *   or default time here.
   * - stepId: `part.id`, falling back to `event.id`.
   * - messageId: `part.messageID`, falling back to `event.messageID`.
   *   Non-empty values pass through unchanged; empty/whitespace-only/
   *   non-string values are omitted.
   */
  translateStepBegin(part, event) {
    const stepBegin = { type: 'step_begin' };

    if (Number.isFinite(event.timestamp)) {
      stepBegin.timestamp = event.timestamp;
    }

    const stepId = selectPreservedIdentifier(part.id, event.id);
    if (stepId !== undefined) {
      stepBegin.stepId = stepId;
    }

    const messageId = selectPreservedIdentifier(part.messageID, event.messageID);
    if (messageId !== undefined) {
      stepBegin.messageId = messageId;
    }

    return stepBegin;
  }

  translateStepFinish(part, timestamp, timestampSource, observedAt, reportedAt) {
    const events = [];
    const tokenUsage = mapOpenCodeTokenUsage(part.tokens || {});

    events.push({
      type: 'status_update',
      timestamp,
      timestampSource,
      observedAt,
      reportedAt,
      tokenUsage,
      messageId: part.messageID,
    });

    if (part.reason === 'tool-calls') {
      return events;
    }

    events.push({
      type: 'turn_end',
      timestamp,
      timestampSource,
      observedAt,
      reportedAt,
      reason: part.reason || 'complete',
      fullText: this.fullText,
      hasToolCalls: this.hasToolCalls,
      _meta: {
        messageId: part.messageID,
        tokenUsage,
        harnessId: 'opencode',
        provider: 'opencode',
      },
    });

    return events;
  }

  getTerminalState() {
    return {
      fullText: this.fullText,
      hasToolCalls: this.hasToolCalls,
    };
  }
}

module.exports = {
  OpenCodeJsonEventTranslator,
  mapOpenCodeToolName,
  mapOpenCodeTokenUsage,
};
