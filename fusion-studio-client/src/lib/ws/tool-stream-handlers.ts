/**
 * @module tool-stream-handlers
 * @role Tool-call family domain logic — tool_call / tool_call_args /
 *       tool_result application to segments, extracted from the routed
 *       dispatcher (SPEC-04 Slice B).
 *
 * Every entry point receives an ALREADY-VALIDATED route: the dispatcher has
 * confirmed explicit threadId + matching current turn + valid streamSeq
 * BEFORE calling in here, and passes the addressed turn's helper namespace
 * explicitly (parent §4.12). No inference from selected UI state; argument
 * buffers live inside the namespace so interleave isolation holds by
 * construction.
 *
 * Behavior below is a verbatim port of the former monolithic cases in
 * stream-handlers.ts; only state residency changed (module-global maps →
 * per thread+turn namespace).
 */

import { usePanelStore } from '../../state/panelStore';
import type { UniversalToolDisplay } from '../../types';
import { toolNameToSegmentType } from '../instructions';
import { parseTodoArgs, parseTodoDisplay } from '../todo-output';
import type { StreamHelperNamespace } from './stream-helper-registry';
import {
  appendUniqueLine,
  formatGroupedSummaryLine,
  normalizeToolResultForSegment,
  parseToolArgs,
} from './tool-result-helpers';
import { formatReadFileSummary } from '../read-output';
import { formatGrepResultSection } from '../grep-output';
import { formatGlobResultSection } from '../glob-output';
import {
  buildSubagentCompletedLine,
  buildSubagentResultFallbackLines,
  buildSubagentIntroLine,
  getSubagentTypeFromArgs,
} from '../subagent-output';

function readChatState(threadId: string) {
  return usePanelStore.getState().projectChats[threadId];
}

/**
 * A tool_call arrived for this validated route. Registers it with the
 * namespace's two-layer grouper and pushes/extends the segment.
 */
export function handleToolCall(
  msg: { toolName?: string; toolCallId?: string; toolArgs?: Record<string, unknown> },
  ns: StreamHelperNamespace,
): void {
  const store = usePanelStore.getState();
  const threadId = ns.threadId;
  const segType = toolNameToSegmentType(msg.toolName || '');
  const toolCallId = msg.toolCallId || '';
  const segCount = readChatState(threadId)?.segments.length ?? 0;
  if (toolCallId) {
    ns.toolArgBuffers.set(toolCallId, '');
  }

  const action = ns.grouper.onToolCall(segType, toolCallId, segCount);

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
}

/**
 * An args chunk arrived. Buffers per toolCallId INSIDE this turn's namespace
 * and updates parseable projections (todo drawer, subagent intro line).
 */
export function handleToolCallArgs(
  msg: { toolCallId?: string; argsChunk?: string },
  ns: StreamHelperNamespace,
): void {
  const store = usePanelStore.getState();
  const threadId = ns.threadId;
  const toolCallId = msg.toolCallId || '';
  if (!toolCallId || !msg.argsChunk) return;

  const nextBuffer = (ns.toolArgBuffers.get(toolCallId) || '') + msg.argsChunk;
  ns.toolArgBuffers.set(toolCallId, nextBuffer);

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
}

/** Merges a status line into an existing grouped segment's status text. */
function appendOptionalLine(content: string | undefined, line: string): string {
  return content ? appendUniqueLine(content, line) : line;
}

/**
 * A tool_result arrived. Resolves its group through layer 2 of THIS turn's
 * grouper (survives thinking interleaving), formats render-ready content,
 * and frees the namespace's arg buffer for the completed call.
 */
export function handleToolResult(
  msg: {
    toolCallId?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolOutput?: unknown;
    toolStatus?: string;
    toolDisplay?: UniversalToolDisplay[];
    returnedDiff?: boolean;
    isError?: boolean;
  },
  ns: StreamHelperNamespace,
): void {
  const store = usePanelStore.getState();
  const threadId = ns.threadId;
  const toolCallId = msg.toolCallId || '';
  const groupLookup = ns.grouper.getGroupForResult(toolCallId);
  const existingSegment = readChatState(threadId)?.segments.find(seg => seg.toolCallId === toolCallId);
  const segType = existingSegment?.type ?? toolNameToSegmentType(msg.toolName || '');
  const resultArgs = msg.toolArgs
    ?? parseToolArgs(ns.toolArgBuffers.get(toolCallId) || '')
    ?? existingSegment?.toolArgs;
  const normalizedResult = normalizeToolResultForSegment(segType, msg.toolOutput, msg.isError, msg.toolStatus);
  const toolContent = normalizedResult.content;
  ns.toolArgBuffers.delete(toolCallId);

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
    const groupedSegment = readChatState(threadId)?.segments[groupLookup.segmentIndex];
    const existing = groupedSegment?.content;
    const prefix = existing ? '\n' : '';
    store.appendSegmentContentByIndex(threadId, groupLookup.segmentIndex, prefix + appendedContent);

    const completion = ns.grouper.recordGroupResult(toolCallId);
    if (completion) {
      const mergedStatus = normalizedResult.status
        ? appendOptionalLine(groupedSegment?.toolStatus, normalizedResult.status)
        : groupedSegment?.toolStatus;
      store.updateSegmentByIndex(threadId, completion.segmentIndex, {
        toolArgs: resultArgs,
        toolDisplay: msg.toolDisplay,
        toolStatus: mergedStatus,
        returnedDiff: msg.returnedDiff,
        isError: Boolean(groupedSegment?.isError || msg.isError),
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
      const subagentContent = existingContent
        ? appendUniqueLine(existingContent, completionLine)
        : buildSubagentResultFallbackLines(toolContent, resultArgs).join('\n');

      store.updateSegmentByToolCallId(threadId, toolCallId, {
        content: subagentContent,
        toolArgs: resultArgs,
        toolDisplay: msg.toolDisplay,
        toolStatus: normalizedResult.status,
        returnedDiff: msg.returnedDiff,
        isError: msg.isError,
        complete: true,
      });
      return;
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
}
