/**
 * @module stream-handlers
 * @role Handle stream-related WebSocket messages (turn lifecycle, tool grouping, timing).
 *
 * Extracted from ws-client.ts (spec 05a) so the most fragile part of the
 * message router is isolated and testable. Everything else stays in ws-client.
 *
 * Live stream messages route only by explicit server threadId.
 * Missing route metadata is a contract violation and is dropped with a diagnostic.
 */

import { usePanelStore } from '../../state/panelStore';
import { toolNameToSegmentType } from '../instructions';
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
  getSubagentTypeFromArgs,
} from '../subagent-output';
import { showToast } from '../toast';
import type { WebSocketMessage, WebSocketMessageType } from '../../types';
import { handleSubagentEvent, resetSubagentStreams } from './subagent-stream';
import { handleTurnBegin, handleTurnEnd } from './turn-lifecycle';
import {
  appendUniqueLine,
  formatGroupedSummaryLine,
  normalizeToolResultForSegment,
  parseToolArgs,
} from './tool-result-helpers';

interface TimingProbe {
  firstTokenAt?: number;
  firstTokenType?: string;
  sendAt?: number;
}

const toolArgBuffers = new Map<string, string>();

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

function getStreamRoute(msg: WebSocketMessage): { threadId: string } | null {
  if (!ROUTED_STREAM_TYPES.has(msg.type)) return null;
  if (!msg.threadId) {
    console.warn('[WS] Dropping stream message without explicit route metadata', {
      type: msg.type,
      threadId: msg.threadId,
    });
    return null;
  }
  return { threadId: msg.threadId };
}

/**
 * Read the active chat state slot for a threadId.
 * PER_THREAD_CHAT_STATE: chat slots are keyed by threadId.
 */
function readChatState(threadId: string) {
  const state = usePanelStore.getState();
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
  const threadId = route?.threadId;

  switch (msg.type) {
    case 'turn_begin': {
      if (!threadId) return true;
      handleTurnBegin(msg, threadId, resetStreamState);
      return true;
    }

    case 'content':
      if (!threadId) return true;
      if (msg.text) {
        const t = (window as Window & { __TIMING?: TimingProbe }).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'content';
          const ttft = t.sendAt === undefined ? 0 : t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (content) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        breakSequence();
        store.appendSegment(threadId, 'text', msg.text);

        const turn = readChatState(threadId)?.currentTurn;
        if (turn) {
          store.updateTurnContent(threadId, turn.content + msg.text);
        }
      }
      return true;

    case 'thinking':
      if (!threadId) return true;
      if (msg.text) {
        const t = (window as Window & { __TIMING?: TimingProbe }).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'thinking';
          const ttft = t.sendAt === undefined ? 0 : t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (thinking) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        breakSequence();
        store.appendSegment(threadId, 'think', msg.text);
      }
      return true;

    case 'tool_call': {
      if (!threadId) return true;
      const segType = toolNameToSegmentType(msg.toolName || '');
      const toolCallId = msg.toolCallId || '';
      const segCount = readChatState(threadId)?.segments.length ?? 0;
      if (toolCallId) {
        toolArgBuffers.set(toolCallId, '');
      }

      const action = onToolCall(segType, toolCallId, segCount);

      if (action.action === 'new') {
        store.pushSegment(threadId, {
          type: segType,
          content: '',
          toolCallId,
          toolArgs: msg.toolArgs,
          groupCount: action.groupCount,
        });
      } else if (action.segmentIndex !== undefined) {
        store.updateSegmentByIndex(threadId, action.segmentIndex, {
          groupCount: action.groupCount,
          complete: false,
        });
      }
      // 'extend' = tool was added to existing group segment; title count updated above.

      return true;
    }

    case 'tool_call_args': {
      if (!threadId) return true;
      const toolCallId = msg.toolCallId || '';
      if (!toolCallId || !msg.argsChunk) return true;

      const nextBuffer = (toolArgBuffers.get(toolCallId) || '') + msg.argsChunk;
      toolArgBuffers.set(toolCallId, nextBuffer);

      const parsedArgs = parseToolArgs(nextBuffer);
      if (parsedArgs) {
        store.updateSegmentByToolCallId(threadId, toolCallId, {
          toolArgs: parsedArgs,
        });

        // Update todo drawer immediately when todo args are parseable.
        // Note: some harnesses send empty arguments and put todo data in
        // toolDisplay instead; that's handled on tool_result.
        const segType = readChatState(threadId)?.segments.find(
          (s) => s.toolCallId === toolCallId
        )?.type;
        if (segType === 'subagent') {
          const existingContent = readChatState(threadId)?.segments.find(
            (s) => s.toolCallId === toolCallId
          )?.content;
          if (!existingContent) {
            store.updateSegmentByToolCallId(threadId, toolCallId, {
              content: buildSubagentIntroLine(undefined, getSubagentTypeFromArgs(parsedArgs)),
            });
          }
        }
        if (segType === 'todo') {
          const items = parseTodoArgs(parsedArgs);
          if (items.length > 0) {
            const currentDrawer = readChatState(threadId)?.todoDrawer;
            store.setTodoDrawer(threadId, {
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
      if (!threadId) return true;
      const toolCallId = msg.toolCallId || '';
      const groupLookup = getGroupForResult(toolCallId);
      const existingSegment = readChatState(threadId)?.segments.find(seg => seg.toolCallId === toolCallId);
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
        const existing = readChatState(threadId)?.segments[groupLookup.segmentIndex]?.content;
        const prefix = existing ? '\n' : '';
        store.appendSegmentContentByIndex(threadId, groupLookup.segmentIndex, prefix + appendedContent);

        const completion = recordGroupResult(toolCallId);
        if (completion) {
          store.updateSegmentByIndex(threadId, completion.segmentIndex, {
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
          const currentDrawer = readChatState(threadId)?.todoDrawer;
          if (items.length > 0) {
            store.setTodoDrawer(threadId, {
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

          store.updateSegmentByToolCallId(threadId, toolCallId, {
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

        store.updateSegmentByToolCallId(threadId, toolCallId, {
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
      if (!threadId) return true;
      handleSubagentEvent(msg, threadId);
      return true;

    case 'turn_end': {
      if (!threadId) return true;
      handleTurnEnd(msg, threadId);
      return true;
    }

    case 'status_update':
      if (!threadId) return true;
      if (msg.contextUsage !== undefined) {
        store.setContextUsage(msg.contextUsage);
      }
      return true;

    case 'request':
      console.log('[WS] Agent request:', msg.requestType);
      return true;

    case 'auth_error':
      if (!threadId) return true;
      window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed', {
        detail: { threadId, message: msg.message || 'Authentication failed' },
      }));
      {
        const chatState = readChatState(threadId);
        const currentTurn = chatState?.currentTurn;
        if (currentTurn && !currentTurn.content && (chatState?.segments.length ?? 0) === 0) {
          store.setCurrentTurn(threadId, null);
          store.setPendingTurnEnd(threadId, false);
          store.resetSegments(threadId);
        }
      }
      showToast(msg.message || 'Authentication failed. Run `kimi login` in your terminal.');
      return true;

    case 'error':
      console.error('[WS] Wire error:', msg.error);
      window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed', {
        detail: { threadId: msg.threadId, message: msg.message || msg.error || 'Prompt failed' },
      }));
      return true;

    default:
      return false;
  }
}

/**
 * Reset stream state (called on reconnect from ws-client.ts).
 * Exported so the connection lifecycle can reset grouper on reconnect.
 */
export function resetStreamState(): void {
  resetGrouper();
  toolArgBuffers.clear();
  resetSubagentStreams();
}
