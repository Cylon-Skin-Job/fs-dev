/**
 * @module stream-handlers
 * @role Handle stream-related WebSocket messages (turn lifecycle, tool grouping, timing).
 *
 * Extracted from ws-client.ts (spec 05a) so the most fragile part of the
 * message router is isolated and testable. Everything else stays in ws-client.
 *
 * SPEC-26c: stream messages route by scope. The wire is single-scope at any
 * given moment — whichever side (project or view) owns the live wire is the
 * one whose chat state receives the stream. Prefer msg.scope (set server-side
 * in 26b), fall back to store.currentScope.
 */

import { usePanelStore } from '../../state/panelStore';
import { toolNameToSegmentType } from '../instructions';
import { getSummaryField } from '../catalog-visual';
import {
  onToolCall,
  getGroupForResult,
  breakSequence,
  reset as resetGrouper,
} from '../tool-grouper';
import { showToast } from '../toast';
import type { WebSocketMessage, Scope } from '../../types';

/**
 * Resolve the target scope for a stream message.
 *  - Prefer msg.scope (server-side wire tag, 26b+).
 *  - Fall back to store.currentScope (set by wire_ready / thread:opened).
 *  - Final fallback: 'project' — SECONDARY_CHAT_SPEC narrowed view-scope to
 *    agents-viewer only; everything else is project.
 */
function resolveScope(msg: WebSocketMessage): Scope {
  if (msg.scope === 'project' || msg.scope === 'view') return msg.scope;
  const current = usePanelStore.getState().currentScope;
  if (current) return current;
  return 'project';
}

/**
 * Read the active chat state slot for a given scope + threadId.
 * PER_THREAD_CHAT_STATE: project slots are keyed by threadId.
 */
function readChatState(scope: Scope, threadId: string | null) {
  const state = usePanelStore.getState();
  if (scope === 'view') return state.panels[state.currentPanel];
  const tid = threadId ?? state.currentThreadIds.project;
  if (!tid) return undefined;
  return state.projectChats[tid];
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
  const scope = resolveScope(msg);
  const threadId: string | null = msg.threadId ?? null;

  switch (msg.type) {
    case 'turn_begin': {
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
      if (msg.text) {
        const t = (window as any).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'content';
          const ttft = t.firstTokenAt - t.sendAt;
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
      if (msg.text) {
        const t = (window as any).__TIMING;
        if (t && !t.firstTokenAt) {
          t.firstTokenAt = performance.now();
          t.firstTokenType = 'thinking';
          const ttft = t.firstTokenAt - t.sendAt;
          console.log(`[TIMING] FIRST TOKEN (thinking) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
        }
        breakSequence();
        store.appendSegment(scope, threadId, 'think', msg.text);
      }
      return true;

    case 'tool_call': {
      const segType = toolNameToSegmentType(msg.toolName || '');
      const toolCallId = msg.toolCallId || '';
      const segCount = readChatState(scope, threadId)?.segments.length ?? 0;

      const action = onToolCall(segType, toolCallId, segCount);

      if (action.action === 'new') {
        store.pushSegment(scope, threadId, {
          type: segType,
          content: '',
          toolCallId,
          toolArgs: msg.toolArgs,
        });
      }
      // 'extend' = tool was added to existing group segment. No store action needed.

      return true;
    }

    case 'tool_result': {
      const toolCallId = msg.toolCallId || '';
      const groupLookup = getGroupForResult(toolCallId);

      if (groupLookup) {
        // Grouped tool — append summary line to the group's segment.
        // Uses layer 2 (toolCallMap) which survives thinking interleaving.
        const summaryFieldName = getSummaryField(groupLookup.type);
        const summaryValue = summaryFieldName && msg.toolArgs?.[summaryFieldName];
        const summaryLine = typeof summaryValue === 'string'
          ? summaryValue
          : msg.toolOutput?.slice(0, 80) || groupLookup.type;
        const existing = readChatState(scope, threadId)?.segments[groupLookup.segmentIndex]?.content;
        const prefix = existing ? '\n' : '';
        store.appendSegmentContentByIndex(scope, threadId, groupLookup.segmentIndex, prefix + summaryLine);
      } else if (toolCallId) {
        // Non-grouped tool — set full content on the segment.
        store.updateSegmentByToolCallId(scope, threadId, toolCallId, {
          content: msg.toolOutput || '',
          toolArgs: msg.toolArgs,
          toolDisplay: msg.toolDisplay,
          isError: msg.isError,
          complete: true,
        });
      }

      return true;
    }

    case 'turn_end': {
      // turn_end signals that the API has finished producing content.
      // All segments and their content have been delivered.
      //
      // We do NOT finalize the turn here. Instead we set pendingTurnEnd,
      // which tells the renderer "whenever you finish revealing, call
      // finalizeTurn." This decouples stream completion from render
      // completion — the renderer might be far behind the stream.
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
        // Mark last segment complete (closing tag) so reveal knows it's done
        const segs = readChatState(scope, threadId)?.segments || [];
        if (segs.length > 0) {
          const lastSeg = segs[segs.length - 1];
          if (!lastSeg.complete) {
            store.updateSegmentByToolCallId(scope, threadId, lastSeg.toolCallId || '', {
              complete: true,
            });
            if (!lastSeg.toolCallId) {
              store.updateLastSegment(scope, threadId, { complete: true });
            }
          }
        }
        store.setPendingTurnEnd(scope, threadId, true);
      }

      return true;
    }

    case 'status_update':
      if (msg.contextUsage !== undefined) {
        store.setContextUsage(msg.contextUsage);
      }
      return true;

    case 'request':
      console.log('[WS] Agent request:', msg.requestType);
      return true;

    case 'auth_error':
      showToast(msg.message || 'Authentication failed. Run `kimi login` in your terminal.');
      return true;

    case 'error':
      console.error('[WS] Wire error:', msg.error);
      return true;

    default:
      return false;
  }
}

/**
 * Reset stream state (called on reconnect from ws-client.ts).
 * Exported so the connection lifecycle can reset grouper on reconnect.
 */
export { reset as resetStreamState } from '../tool-grouper';
