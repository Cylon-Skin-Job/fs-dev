/**
 * @module stream-handlers
 * @role Handle stream-related WebSocket messages (turn lifecycle, tool grouping, timing).
 *
 * Extracted from ws-client.ts (spec 05a) so the most fragile part of the
 * message router is isolated and testable. Everything else stays in ws-client.
 *
 * Live stream messages route only by explicit server scope + threadId.
 * Missing route metadata is a contract violation and is dropped with a diagnostic.
 */

import { usePanelStore } from '../../state/panelStore';
import { toolNameToSegmentType } from '../instructions';
import { getSummaryField } from '../catalog-visual';
import { normalizeToolOutput, visibleToolText } from '../tool-output';
import { parseTodoArgs, parseTodoDisplay } from '../todo-output';
import {
  onToolCall,
  getGroupForResult,
  recordGroupResult,
  breakSequence,
  reset as resetGrouper,
} from '../tool-grouper';
import { formatReadFileSummary } from '../read-output';
import { formatGrepResultSection } from '../grep-output';
import { formatGlobResultSection } from '../glob-output';
import {
  buildSubagentCompletedLine,
  buildSubagentResultFallbackLines,
  buildSubagentIntroLine,
  buildSubagentToolLine,
  getSubagentTypeFromArgs,
} from '../subagent-output';
import { showToast } from '../toast';
import type { WebSocketMessage, WebSocketMessageType, Scope } from '../../types';

interface TimingProbe {
  firstTokenAt?: number;
  firstTokenType?: string;
  sendAt?: number;
}

const toolArgBuffers = new Map<string, string>();
const MAX_SHELL_OUTPUT_LINES = 12;
const MAX_SHELL_OUTPUT_LINE_LENGTH = 180;

const ROUTED_STREAM_TYPES = new Set<WebSocketMessageType>([
  'turn_begin',
  'content',
  'thinking',
  'tool_call',
  'tool_call_args',
  'tool_result',
  'subagent_event',
  'turn_end',
  'status_update',
  'auth_error',
]);

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

function getStreamRoute(msg: WebSocketMessage): { scope: Scope; threadId: string } | null {
  if (!ROUTED_STREAM_TYPES.has(msg.type)) return null;
  if ((msg.scope !== 'project' && msg.scope !== 'view') || !msg.threadId) {
    console.warn('[WS] Dropping stream message without explicit route metadata', {
      type: msg.type,
      scope: msg.scope,
      threadId: msg.threadId,
    });
    return null;
  }
  return { scope: msg.scope, threadId: msg.threadId };
}

/**
 * Read the active chat state slot for a given scope + threadId.
 * PER_THREAD_CHAT_STATE: project slots are keyed by threadId.
 */
function readChatState(scope: Scope, threadId: string) {
  const state = usePanelStore.getState();
  if (scope === 'view') return state.panels[state.currentPanel];
  return state.projectChats[threadId];
}

/**
 * Handle stream-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 *
 * PER_THREAD_CHAT_STATE: every write is routed via msg.threadId so primary
 * and secondary streams stay isolated into their own chat slots. Server
 * stamps threadId on every outbound chat:* event (wire-broadcaster.js).
 */
export function handleStreamMessage(msg: WebSocketMessage): boolean {
  const store = usePanelStore.getState();
  const route = getStreamRoute(msg);
  if (ROUTED_STREAM_TYPES.has(msg.type) && !route) return true;
  const scope = route?.scope;
  const threadId = route?.threadId;

  switch (msg.type) {
    case 'turn_begin': {
      if (!scope || !threadId) return true;
      console.log('[WS] Turn begin scope=', scope, 'threadId=', threadId?.slice(0, 8));
      // Safety net: if the previous turn wasn't finalized (edge case —
      // finalizeTurn normally handles this), snapshot it now. In the
      // normal flow, currentTurn is already null by this point because
      // finalizeTurn cleared it.
      const chatState = readChatState(scope, threadId);
      if (chatState) {
        const prevTurn = chatState.currentTurn;
        const segments = chatState.segments;

        if (prevTurn) {
          console.warn('[WS] turn_begin: previous turn was not finalized — snapshotting now');
          store.addMessage(scope, threadId, {
            id: prevTurn.id,
            type: 'assistant',
            content: prevTurn.content,
            timestamp: Date.now(),
            segments: segments.length > 0 ? [...segments] : undefined,
          });
        }
      }

      store.resetSegments(scope, threadId);
      resetGrouper();
      toolArgBuffers.clear();
      subagentStreams.clear();

      // CRITICAL: Clear pendingTurnEnd from the PREVIOUS turn.
      //
      // If the old turn's renderer hadn't finished revealing when this
      // turn_begin arrives, pendingTurnEnd is still true. Without this
      // clear, the NEW turn would inherit it — causing premature
      // finalization as soon as the first segment of the new turn
      // finishes revealing.
      //
      // KNOWN PAST BUG (DO NOT REMOVE):
      // Omitting this line caused new turns to finalize immediately
      // after their first segment, because the stale pendingTurnEnd
      // from the previous turn was still set.
      store.setPendingTurnEnd(scope, threadId, false);

      store.setCurrentTurn(scope, threadId, {
        id: msg.turnId || '',
        content: '',
        status: 'streaming',
        hasThinking: false,
        thinkingContent: '',
      });

      return true;
    }

    case 'content':
      if (!scope || !threadId) return true;
      if (msg.text) {
        const t = (window as Window & { __TIMING?: TimingProbe }).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'content';
          const ttft = t.sendAt === undefined ? 0 : t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (content) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        breakSequence();
        store.appendSegment(scope, threadId, 'text', msg.text);

        const turn = readChatState(scope, threadId)?.currentTurn;
        if (turn) {
          store.updateTurnContent(scope, threadId, turn.content + msg.text);
        }
      }
      return true;

    case 'thinking':
      if (!scope || !threadId) return true;
      if (msg.text) {
        const t = (window as Window & { __TIMING?: TimingProbe }).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'thinking';
          const ttft = t.sendAt === undefined ? 0 : t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (thinking) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        breakSequence();
        store.appendSegment(scope, threadId, 'think', msg.text);
      }
      return true;

    case 'tool_call': {
      if (!scope || !threadId) return true;
      const segType = toolNameToSegmentType(msg.toolName || '');
      const toolCallId = msg.toolCallId || '';
      const segCount = readChatState(scope, threadId)?.segments.length ?? 0;
      if (toolCallId) {
        toolArgBuffers.set(toolCallId, '');
      }

      const action = onToolCall(segType, toolCallId, segCount);

      if (action.action === 'new') {
        store.pushSegment(scope, threadId, {
          type: segType,
          content: '',
          toolCallId,
          toolArgs: msg.toolArgs,
          groupCount: action.groupCount,
        });
      } else if (action.segmentIndex !== undefined) {
        store.updateSegmentByIndex(scope, threadId, action.segmentIndex, {
          groupCount: action.groupCount,
          complete: false,
        });
      }
      // 'extend' = tool was added to existing group segment; title count updated above.

      return true;
    }

    case 'tool_call_args': {
      if (!scope || !threadId) return true;
      const toolCallId = msg.toolCallId || '';
      if (!toolCallId || !msg.argsChunk) return true;

      const nextBuffer = (toolArgBuffers.get(toolCallId) || '') + msg.argsChunk;
      toolArgBuffers.set(toolCallId, nextBuffer);

      const parsedArgs = parseToolArgs(nextBuffer);
      if (parsedArgs) {
        store.updateSegmentByToolCallId(scope, threadId, toolCallId, {
          toolArgs: parsedArgs,
        });

        // Update todo drawer immediately when todo args are parseable.
        // Note: some harnesses send empty arguments and put todo data in
        // toolDisplay instead; that's handled on tool_result.
        const segType = readChatState(scope, threadId)?.segments.find(
          (s) => s.toolCallId === toolCallId
        )?.type;
        if (segType === 'subagent') {
          const existingContent = readChatState(scope, threadId)?.segments.find(
            (s) => s.toolCallId === toolCallId
          )?.content;
          if (!existingContent) {
            store.updateSegmentByToolCallId(scope, threadId, toolCallId, {
              content: buildSubagentIntroLine(undefined, getSubagentTypeFromArgs(parsedArgs)),
            });
          }
        }
        if (segType === 'todo') {
          const items = parseTodoArgs(parsedArgs);
          if (items.length > 0) {
            const currentDrawer = readChatState(scope, threadId)?.todoDrawer;
            store.setTodoDrawer(scope, threadId, {
              items,
              updatedAt: Date.now(),
              open: currentDrawer?.open ?? false,
            });
          }
        }
      }

      return true;
    }

    case 'tool_result': {
      if (!scope || !threadId) return true;
      const toolCallId = msg.toolCallId || '';
      const groupLookup = getGroupForResult(toolCallId);
      const existingSegment = readChatState(scope, threadId)?.segments.find(seg => seg.toolCallId === toolCallId);
      const segType = existingSegment?.type ?? toolNameToSegmentType(msg.toolName || '');
      const resultArgs = msg.toolArgs
        ?? parseToolArgs(toolArgBuffers.get(toolCallId) || '')
        ?? existingSegment?.toolArgs;
      const normalizedResult = normalizeToolResultForSegment(segType, msg.toolOutput, msg.isError, msg.toolStatus);
      const toolContent = normalizedResult.content;
      toolArgBuffers.delete(toolCallId);

      if (groupLookup) {
        // Grouped tool — append render-ready content to the group's segment.
        // Uses layer 2 (toolCallMap) which survives thinking interleaving.
        const appendedContent =
          groupLookup.type === 'read'
            ? formatReadFileSummary(resultArgs)
            : groupLookup.type === 'grep'
              ? formatGrepResultSection(resultArgs, msg.toolOutput)
              : groupLookup.type === 'glob'
                ? formatGlobResultSection(resultArgs, msg.toolOutput)
                : formatGroupedSummaryLine(groupLookup.type, resultArgs, toolContent);
        const existing = readChatState(scope, threadId)?.segments[groupLookup.segmentIndex]?.content;
        const prefix = existing ? '\n' : '';
        store.appendSegmentContentByIndex(scope, threadId, groupLookup.segmentIndex, prefix + appendedContent);

        const completion = recordGroupResult(toolCallId);
        if (completion) {
          store.updateSegmentByIndex(scope, threadId, completion.segmentIndex, {
            toolArgs: resultArgs,
            toolDisplay: msg.toolDisplay,
            toolStatus: normalizedResult.status,
            returnedDiff: msg.returnedDiff,
            isError: msg.isError,
            groupCount: completion.expected,
            complete: completion.complete,
          });
        }
      } else if (toolCallId) {
        // Non-grouped tool — set full content on the segment.
        let content = toolContent;

        if (segType === 'todo') {
          // Parse final args and update the todo drawer.
          // Fallback to toolDisplay when args are empty (common for SetTodoList).
          let items = parseTodoArgs(resultArgs);
          if (items.length === 0 && msg.toolDisplay) {
            items = parseTodoDisplay(msg.toolDisplay);
          }
          const currentDrawer = readChatState(scope, threadId)?.todoDrawer;
          if (items.length > 0) {
            store.setTodoDrawer(scope, threadId, {
              items,
              updatedAt: Date.now(),
              open: currentDrawer?.open ?? false,
            });
            content = `Updated ${items.length} task${items.length === 1 ? '' : 's'}`;
          } else {
            content = 'Todo list updated';
          }
        }

        if (segType === 'subagent') {
          const existingContent = existingSegment?.content?.trim() || '';
          const completionLine = buildSubagentCompletedLine();
          const content = existingContent
            ? appendUniqueLine(existingContent, completionLine)
            : buildSubagentResultFallbackLines(toolContent, resultArgs).join('\n');

          store.updateSegmentByToolCallId(scope, threadId, toolCallId, {
            content,
            toolArgs: resultArgs,
            toolDisplay: msg.toolDisplay,
            toolStatus: normalizedResult.status,
            returnedDiff: msg.returnedDiff,
            isError: msg.isError,
            complete: true,
          });
          return true;
        }

        store.updateSegmentByToolCallId(scope, threadId, toolCallId, {
          content,
          toolArgs: resultArgs,
          toolDisplay: msg.toolDisplay,
          toolStatus: normalizedResult.status,
          returnedDiff: msg.returnedDiff,
          isError: msg.isError,
          complete: true,
        });
      }

      return true;
    }

    case 'subagent_event':
      if (!scope || !threadId) return true;
      handleSubagentEvent(msg, scope, threadId);
      return true;

    case 'turn_end': {
      if (!scope || !threadId) return true;
      // turn_end signals that the API has finished producing content.
      // Normal completion keeps the paced reveal gate: set pendingTurnEnd and
      // let LiveSegmentRenderer finalize after it catches up.
      //
      // Interrupted/error terminal turns mimic CLI Escape: flush immediately
      // into history so Stop does not sit behind typing/collapse delays.
      //
      // LIFECYCLE:
      //   turn_end arrives → setPendingTurnEnd(true)
      //                    → MessageList passes onRevealComplete to LiveSegmentRenderer
      //                    → LiveSegmentRenderer's completion effect checks:
      //                        revealedCount >= segments.length AND onRevealComplete defined
      //                    → When both true: finalizeTurn() fires ONCE
      //                    → currentTurn.status = 'complete', pendingTurnEnd = false
      //
      // EITHER ORDER IS SAFE:
      //   Stream finishes first: pendingTurnEnd set, renderer catches up later, effect fires.
      //   Renderer catches up first: all revealed, then turn_end arrives, effect fires.
      //
      // See LiveSegmentRenderer.tsx completion detection comments for the
      // full explanation of why this is an effect and not a callback.
      const currentTurn = readChatState(scope, threadId)?.currentTurn;

      if (currentTurn) {
        const flushImmediately = msg.partial === true ||
          msg.reason === 'interrupted' ||
          msg.reason === 'error';

        // Mark last segment complete (closing tag) so reveal knows it's done
        const segs = readChatState(scope, threadId)?.segments || [];
        if (segs.length > 0) {
          const lastSeg = segs[segs.length - 1];
          if (!lastSeg.complete) {
            store.updateLastSegment(scope, threadId, { complete: true });
          }
        }
        store.setPendingTurnEnd(scope, threadId, true);
        window.dispatchEvent(new CustomEvent('fusion:turn-ended', {
          detail: { scope, threadId, reason: msg.reason, partial: msg.partial },
        }));

        if (flushImmediately) {
          store.finalizeTurn(scope, threadId);
        }
      }

      return true;
    }

    case 'status_update':
      if (!scope || !threadId) return true;
      if (msg.contextUsage !== undefined) {
        store.setContextUsage(msg.contextUsage);
      }
      return true;

    case 'request':
      console.log('[WS] Agent request:', msg.requestType);
      return true;

    case 'auth_error':
      if (!scope || !threadId) return true;
      window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed', {
        detail: { scope, threadId, message: msg.message || 'Authentication failed' },
      }));
      {
        const chatState = readChatState(scope, threadId);
        const currentTurn = chatState?.currentTurn;
        if (currentTurn && !currentTurn.content && (chatState?.segments.length ?? 0) === 0) {
          store.setCurrentTurn(scope, threadId, null);
          store.setPendingTurnEnd(scope, threadId, false);
          store.resetSegments(scope, threadId);
        }
      }
      showToast(msg.message || 'Authentication failed. Run `kimi login` in your terminal.');
      return true;

    case 'error':
      console.error('[WS] Wire error:', msg.error);
      window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed', {
        detail: { scope: msg.scope, threadId: msg.threadId, message: msg.message || msg.error || 'Prompt failed' },
      }));
      return true;

    default:
      return false;
  }
}

function normalizeToolResultForSegment(
  type: ReturnType<typeof toolNameToSegmentType>,
  output: unknown,
  isError?: boolean,
  toolStatus?: string,
): { content: string; status?: string } {
  if (type === 'shell') {
    const parts = normalizeToolOutput(output);
    const content = compactShellOutput(parts
      .filter(part => part.kind === 'text')
      .map(part => part.text)
      .join(''));
    const status = parts
      .filter(part => part.kind === 'system')
      .map(part => stripSystemTag(part.text).trim())
      .filter(Boolean)
      .join('\n');

    return {
      content: content || (isError ? status : ''),
      status: status || undefined,
    };
  }

  if (toolStatus) return { content: visibleToolText(output), status: toolStatus };
  if (type === 'fetch') return { content: visibleToolText(output, true) };
  return { content: visibleToolText(output) };
}

function compactShellOutput(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  if (!normalized) return '';

  const lines = normalized.split('\n').map(compactShellLine);
  if (lines.length <= MAX_SHELL_OUTPUT_LINES) return lines.join('\n');

  const headCount = 6;
  const tailCount = MAX_SHELL_OUTPUT_LINES - headCount - 1;
  const omitted = lines.length - headCount - tailCount;
  return [
    ...lines.slice(0, headCount),
    `... ${omitted} more output line${omitted === 1 ? '' : 's'}`,
    ...lines.slice(lines.length - tailCount),
  ].join('\n');
}

function compactShellLine(line: string): string {
  if (line.length <= MAX_SHELL_OUTPUT_LINE_LENGTH) return line;
  return `${line.slice(0, MAX_SHELL_OUTPUT_LINE_LENGTH - 3)}...`;
}

function formatGroupedSummaryLine(
  type: ReturnType<typeof toolNameToSegmentType>,
  args: Record<string, unknown> | undefined,
  content: string,
): string {
  const summaryFieldName = getSummaryField(type);
  const summaryValue = summaryFieldName && args?.[summaryFieldName];
  const summaryLine = typeof summaryValue === 'string'
    ? summaryValue
    : content.slice(0, 80) || type;
  return `${summaryLine}\n`;
}

function parseToolArgs(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ToolCallPart can arrive as partial JSON. Keep buffering until parseable.
  }
  return undefined;
}

function stripSystemTag(text: string): string {
  return text
    .trim()
    .replace(/^<system>/, '')
    .replace(/<\/system>$/, '');
}

/**
 * Reset stream state (called on reconnect from ws-client.ts).
 * Exported so the connection lifecycle can reset grouper on reconnect.
 */
export function resetStreamState(): void {
  resetGrouper();
  toolArgBuffers.clear();
  subagentStreams.clear();
}

function handleSubagentEvent(msg: WebSocketMessage, scope: Scope, threadId: string): void {
  const parentToolCallId = msg.parentToolCallId || '';
  if (!parentToolCallId) return;

  const streamKey = `${parentToolCallId}:${msg.agentId || ''}`;
  const stream = getSubagentStream(streamKey);
  const eventType = msg.subagentEventType || '';
  const payload = objectValue(msg.subagentPayload);

  if (eventType === 'TurnBegin') {
    emitSubagentIntro(scope, threadId, parentToolCallId, stream, msg.agentId, msg.subagentType);
    return;
  }

  if (eventType === 'ToolCall') {
    emitSubagentIntro(scope, threadId, parentToolCallId, stream, msg.agentId, msg.subagentType);

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
    emitSubagentToolIfReady(scope, threadId, parentToolCallId, toolState);
    return;
  }

  if (eventType === 'ToolCallPart') {
    const activeTool = stream.activeToolId ? stream.tools.get(stream.activeToolId) : undefined;
    const argsPart = stringValue(payload.arguments_part);
    if (!activeTool || !argsPart) return;

    activeTool.argsRaw += argsPart;
    emitSubagentToolIfReady(scope, threadId, parentToolCallId, activeTool);
    return;
  }

  if (eventType === 'ToolResult') {
    const toolId = stringValue(payload.tool_call_id) || stream.activeToolId || '';
    const toolState = toolId ? stream.tools.get(toolId) : undefined;
    if (toolState && !toolState.emitted) {
      appendSubagentLine(
        scope,
        threadId,
        parentToolCallId,
        buildSubagentToolLine(toolState.name, parseToolArgs(toolState.argsRaw))
      );
      toolState.emitted = true;
    }
    return;
  }

  if (eventType === 'TurnEnd') {
    emitSubagentIntro(scope, threadId, parentToolCallId, stream, msg.agentId, msg.subagentType);
    appendSubagentLine(scope, threadId, parentToolCallId, buildSubagentCompletedLine());
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
  scope: Scope,
  threadId: string,
  parentToolCallId: string,
  stream: SubagentStreamState,
  agentId?: string,
  subagentType?: string,
): void {
  if (stream.introEmitted) return;
  appendSubagentLine(scope, threadId, parentToolCallId, buildSubagentIntroLine(agentId, subagentType));
  stream.introEmitted = true;
}

function emitSubagentToolIfReady(
  scope: Scope,
  threadId: string,
  parentToolCallId: string,
  toolState: SubagentToolState,
): void {
  if (toolState.emitted) return;

  if (!toolState.argsRaw) return;

  const args = parseToolArgs(toolState.argsRaw);
  if (!args) return;

  appendSubagentLine(scope, threadId, parentToolCallId, buildSubagentToolLine(toolState.name, args));
  toolState.emitted = true;
}

function appendSubagentLine(scope: Scope, threadId: string, toolCallId: string, line: string): void {
  const store = usePanelStore.getState();
  const segment = readChatState(scope, threadId)?.segments.find(seg => seg.toolCallId === toolCallId);
  const prefix = segment?.content ? '\n' : '';
  store.updateSegmentByToolCallId(scope, threadId, toolCallId, {
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

function appendUniqueLine(content: string, line: string): string {
  const lines = content.split('\n').map(item => item.trim()).filter(Boolean);
  return lines.includes(line) ? content : `${content}\n${line}`;
}
