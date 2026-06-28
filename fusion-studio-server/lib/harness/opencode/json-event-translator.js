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
  const normalized = String(toolName || 'unknown').toLowerCase();
  return TOOL_NAME_MAP[normalized] || normalized;
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
  constructor() {
    this.fullText = '';
    this.hasToolCalls = false;
    this.startedToolCallIds = new Set();
    this.emittedToolArgsIds = new Set();
  }

  beginTurn(userInput, timestamp = Date.now()) {
    this.fullText = '';
    this.hasToolCalls = false;
    this.startedToolCallIds.clear();
    this.emittedToolArgsIds.clear();

    return {
      type: 'turn_begin',
      timestamp,
      userInput: String(userInput || ''),
    };
  }

  translate(event) {
    if (!event || typeof event !== 'object') {
      return [];
    }

    const timestamp = event.timestamp || Date.now();
    const part = event.part || {};

    if (event.type === 'text' || part.type === 'text') {
      return this.translateText(part, timestamp);
    }

    if (part.type === 'reasoning') {
      return this.translateReasoning(part, timestamp);
    }

    if (event.type === 'tool_use' || part.type === 'tool') {
      return this.translateToolUse(part, timestamp);
    }

    if (event.type === 'step_finish' || part.type === 'step-finish') {
      return this.translateStepFinish(part, timestamp);
    }

    return [];
  }

  translateText(part, timestamp) {
    const text = String(part.text || '');
    this.fullText += text;
    return [{ type: 'content', timestamp, text }];
  }

  translateReasoning(part, timestamp) {
    return [{ type: 'thinking', timestamp, text: String(part.text || '') }];
  }

  translateToolUse(part, timestamp) {
    const toolCallId = String(part.callID || part.id || '');
    const toolName = mapOpenCodeToolName(part.tool);
    const state = part.state || {};
    const events = [];

    this.hasToolCalls = true;

    if (!this.startedToolCallIds.has(toolCallId)) {
      this.startedToolCallIds.add(toolCallId);
      events.push({ type: 'tool_call', timestamp, toolCallId, toolName });
    }

    if (state.input && !this.emittedToolArgsIds.has(toolCallId)) {
      this.emittedToolArgsIds.add(toolCallId);
      events.push({
        type: 'tool_call_args',
        timestamp,
        toolCallId,
        argsChunk: JSON.stringify(state.input),
      });
    }

    if (state.status !== 'completed' && state.status !== 'error') {
      return events;
    }

    const exit = state.metadata?.exit;
    const isError = typeof exit === 'number' ? exit !== 0 : state.status === 'error';
    const output = String(state.output || state.metadata?.output || '');
    const statusMessage = normalizeStatusMessage(toolName, state, output, isError);

    events.push({
      type: 'tool_result',
      timestamp,
      toolCallId,
      toolName,
      output,
      statusMessage,
      display: [],
      returnedDiff: false,
      isError,
      files: [],
    });

    return events;
  }

  translateStepFinish(part, timestamp) {
    const events = [];
    const tokenUsage = mapOpenCodeTokenUsage(part.tokens || {});

    events.push({
      type: 'status_update',
      timestamp,
      tokenUsage,
      messageId: part.messageID,
    });

    if (part.reason === 'tool-calls') {
      return events;
    }

    events.push({
      type: 'turn_end',
      timestamp,
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
