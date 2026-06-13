import { usePanelStore } from '../../state/panelStore';
import type { WebSocketMessage } from '../../types';
import {
  buildSubagentCompletedLine,
  buildSubagentIntroLine,
  buildSubagentToolLine,
} from '../subagent-output';
import { parseToolArgs } from './tool-result-helpers';

interface SubagentToolState {
  id: string;
  name: string;
  argsRaw: string;
  emitted: boolean;
}

interface SubagentStreamState {
  introEmitted: boolean;
  activeToolId?: string;
  tools: Map<string, SubagentToolState>;
}

const subagentStreams = new Map<string, SubagentStreamState>();

export function resetSubagentStreams(): void {
  subagentStreams.clear();
}

export function handleSubagentEvent(msg: WebSocketMessage, threadId: string): void {
  const parentToolCallId = msg.parentToolCallId || '';
  if (!parentToolCallId) return;

  const streamKey = `${parentToolCallId}:${msg.agentId || ''}`;
  const stream = getSubagentStream(streamKey);
  const eventType = msg.subagentEventType || '';
  const payload = objectValue(msg.subagentPayload);

  if (eventType === 'TurnBegin') {
    emitSubagentIntro(threadId, parentToolCallId, stream, msg.agentId, msg.subagentType);
    return;
  }

  if (eventType === 'ToolCall') {
    emitSubagentIntro(threadId, parentToolCallId, stream, msg.agentId, msg.subagentType);

    const toolId = stringValue(payload.id) || `${streamKey}:tool:${stream.tools.size + 1}`;
    const toolName = stringValue(objectValue(payload.function).name) || 'Tool';
    const argsRaw = rawToolArguments(payload);
    const toolState: SubagentToolState = {
      id: toolId,
      name: toolName,
      argsRaw,
      emitted: false,
    };

    stream.activeToolId = toolId;
    stream.tools.set(toolId, toolState);
    emitSubagentToolIfReady(threadId, parentToolCallId, toolState);
    return;
  }

  if (eventType === 'ToolCallPart') {
    const activeTool = stream.activeToolId ? stream.tools.get(stream.activeToolId) : undefined;
    const argsPart = stringValue(payload.arguments_part);
    if (!activeTool || !argsPart) return;

    activeTool.argsRaw += argsPart;
    emitSubagentToolIfReady(threadId, parentToolCallId, activeTool);
    return;
  }

  if (eventType === 'ToolResult') {
    const toolId = stringValue(payload.tool_call_id) || stream.activeToolId || '';
    const toolState = toolId ? stream.tools.get(toolId) : undefined;
    if (toolState && !toolState.emitted) {
      appendSubagentLine(
        threadId,
        parentToolCallId,
        buildSubagentToolLine(toolState.name, parseToolArgs(toolState.argsRaw))
      );
      toolState.emitted = true;
    }
    return;
  }

  if (eventType === 'TurnEnd') {
    emitSubagentIntro(threadId, parentToolCallId, stream, msg.agentId, msg.subagentType);
    appendSubagentLine(threadId, parentToolCallId, buildSubagentCompletedLine());
  }
}

function getSubagentStream(key: string): SubagentStreamState {
  let stream = subagentStreams.get(key);
  if (!stream) {
    stream = {
      introEmitted: false,
      tools: new Map<string, SubagentToolState>(),
    };
    subagentStreams.set(key, stream);
  }
  return stream;
}

function emitSubagentIntro(
  threadId: string,
  parentToolCallId: string,
  stream: SubagentStreamState,
  agentId?: string,
  subagentType?: string,
): void {
  if (stream.introEmitted) return;
  appendSubagentLine(threadId, parentToolCallId, buildSubagentIntroLine(agentId, subagentType));
  stream.introEmitted = true;
}

function emitSubagentToolIfReady(
  threadId: string,
  parentToolCallId: string,
  toolState: SubagentToolState,
): void {
  if (toolState.emitted) return;

  if (!toolState.argsRaw) return;

  const args = parseToolArgs(toolState.argsRaw);
  if (!args) return;

  appendSubagentLine(threadId, parentToolCallId, buildSubagentToolLine(toolState.name, args));
  toolState.emitted = true;
}

function appendSubagentLine(threadId: string, toolCallId: string, line: string): void {
  const store = usePanelStore.getState();
  const segment = store.projectChats[threadId]?.segments.find(seg => seg.toolCallId === toolCallId);
  const prefix = segment?.content ? '\n' : '';
  store.updateSegmentByToolCallId(threadId, toolCallId, {
    content: `${segment?.content || ''}${prefix}${line}`,
  });
}

function rawToolArguments(payload: Record<string, unknown>): string {
  const fn = objectValue(payload.function);
  const args = fn.arguments;
  if (typeof args === 'string') return args;
  if (args && typeof args === 'object') {
    try {
      return JSON.stringify(args);
    } catch {
      return '';
    }
  }
  return '';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
