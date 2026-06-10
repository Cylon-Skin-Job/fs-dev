/**
 * @module live-turn-snapshot
 * @role Mutate canonical live turn snapshots for in-memory thread runtimes.
 */

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function bump(snapshot) {
  snapshot.streamSeq += 1;
  snapshot.updatedAt = Date.now();
}

function beginLiveTurn(key, payload) {
  return {
    workspaceId: key.workspaceId,
    scope: key.scope,
    viewId: key.scope === 'view' ? (key.viewId || null) : null,
    threadId: key.threadId,
    turnId: payload.turnId,
    userInput: payload.userInput || '',
    status: 'in_flight',
    fullText: '',
    parts: [],
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
  };
  bump(snapshot);
}

function touchStatus(snapshot) {
  if (!snapshot) return;
  bump(snapshot);
}

function completeLiveTurn(snapshot, status = 'complete') {
  if (!snapshot) return;
  snapshot.status = status;
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
  touchStatus,
};
