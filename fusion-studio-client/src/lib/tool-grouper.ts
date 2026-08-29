/**
 * Tool Grouper — manages grouping of consecutive same-type tool calls
 * and correlates tool_call → tool_result by toolCallId.
 *
 * WHY THIS EXISTS:
 *
 * Groupable tools (read, glob, grep, web_search, fetch) collapse
 * consecutive same-type calls into one visual segment. The grouper
 * tracks which tool calls belong to which group, and which segment
 * index each group writes to.
 *
 * The critical invariant: tool_result must ALWAYS find its group,
 * even if thinking/content tokens interleaved between tool_call
 * and tool_result. The wire protocol does not guarantee that
 * tool_result arrives immediately after tool_call — thinking
 * tokens, status updates, and other events can appear between them.
 *
 * KNOWN PAST BUG (DO NOT REINTRODUCE):
 * The old code used a single `group` variable that was set to null
 * on every content/thinking event. If thinking interleaved between
 * tool_call and tool_result, the group was lost. tool_result fell
 * to a non-grouped path and dumped full file contents as segment
 * content instead of the file path summary.
 *
 * THE FIX (two-layer tracking):
 *   1. `activeGroup` — tracks the CURRENT sequence for segment-building.
 *      Set to null on content/thinking (sequence is broken). Used by
 *      tool_call to decide: extend current group or start new one.
 *
 *   2. `toolCallMap` — maps EVERY toolCallId to its group info.
 *      NOT cleared by content/thinking. Only cleared on turn_end.
 *      Used by tool_result to always find its group.
 *
 * Layer 1 answers: "should this new tool_call join the current group?"
 * Layer 2 answers: "which group does this tool_result belong to?"
 *
 * LIFECYCLE (RCC-0108 SPEC-04 Slice B — parent §4.12):
 *   turn_begin (addressed pair) → createToolGrouper() via the
 *                                  stream-helper-registry namespace
 *   tool_call   → onToolCall() — registers in both layers
 *   content     → breakSequence() — clears layer 1 only
 *   thinking    → breakSequence() — clears layer 1 only
 *   tool_result → getGroupForResult() — reads layer 2
 *   turn_end / new-turn supersede (addressed pair only) → reset()
 *
 * RCC-0108 §4.12: each thread+turn gets its OWN grouper instance held in
 * the stream-helper-registry keyed namespace, so one turn's terminalization
 * or another thread's content can never clear this turn's correlation map.
 */

import type { SegmentType } from '../types';
import { isGroupable } from './catalog-visual';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Shared grouped state for both sequence decisions and result routing. */
export interface GroupState {
  type: SegmentType;
  segmentIndex: number;
  toolCallIds: Set<string>;
  expected: number;
  completed: number;
}

/** Layer 1: the current sequence being built. */
type ActiveGroup = GroupState;

/** Result of onToolCall — tells the caller what to do. */
export interface ToolCallAction {
  /** 'extend' = add to existing segment. 'new' = push a new segment. */
  action: 'extend' | 'new';
  /** For 'new': the segment type to push. For 'extend': ignored. */
  segmentType: SegmentType;
  /** For 'extend': the segment index to append content to. */
  segmentIndex?: number;
  /** Number of tool calls expected in this group after this call. */
  groupCount?: number;
}

/** Result of getGroupForResult — tells the caller how to handle tool_result. */
export interface ToolResultLookup {
  /** Whether this tool_result belongs to a grouped segment. */
  grouped: boolean;
  /** The segment type. */
  type: SegmentType;
  /** The segment index to append summary content to (grouped only). */
  segmentIndex: number;
  /** Number of tool calls expected in this group. */
  expected: number;
  /** Number of tool results completed in this group before recording this result. */
  completed: number;
}

/** Result of recording a grouped tool_result. */
export interface ToolResultCompletion {
  segmentIndex: number;
  expected: number;
  completed: number;
  complete: boolean;
}

/**
 * One turn's two-layer grouping/correlation state. Instances are per
 * `threadId + turnId` (created/held/released by stream-helper-registry);
 * every entry point accepts explicit state from its caller and never infers
 * selected UI context.
 */
export interface ToolGrouper {
  onToolCall(
    segType: SegmentType,
    toolCallId: string,
    currentSegmentCount: number,
  ): ToolCallAction;
  getGroupForResult(toolCallId: string): ToolResultLookup | null;
  recordGroupResult(toolCallId: string): ToolResultCompletion | null;
  breakSequence(): void;
  reset(): void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Instance factory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createToolGrouper(): ToolGrouper {
  /** Layer 1: current group sequence. Cleared by content/thinking. */
  let activeGroup: ActiveGroup | null = null;

  /** Layer 2: every toolCallId → group info. Survives interleaving. Cleared on turn_end. */
  const toolCallMap = new Map<string, GroupState>();

  return {
    /**
     * A new tool_call arrived. Register it and decide whether to
     * extend the current group or start a new segment.
     *
     * @param segType — canonical segment type (from toolNameToSegmentType)
     * @param toolCallId — unique ID for correlation
     * @param currentSegmentCount — current segments.length in the store (for new segment index)
     * @returns action telling the caller what to do
     */
    onToolCall(segType, toolCallId, currentSegmentCount): ToolCallAction {
      if (isGroupable(segType)) {
        if (activeGroup && activeGroup.type === segType) {
          // Extend current group
          activeGroup.toolCallIds.add(toolCallId);
          activeGroup.expected++;
          toolCallMap.set(toolCallId, activeGroup);
          return {
            action: 'extend',
            segmentType: segType,
            segmentIndex: activeGroup.segmentIndex,
            groupCount: activeGroup.expected,
          };
        } else {
          // Start new group
          activeGroup = {
            type: segType,
            segmentIndex: currentSegmentCount,
            toolCallIds: new Set([toolCallId]),
            expected: 1,
            completed: 0,
          };
          toolCallMap.set(toolCallId, activeGroup);
          return { action: 'new', segmentType: segType, groupCount: 1 };
        }
      } else {
        // Non-groupable — always a new segment, breaks any active group
        activeGroup = null;
        return { action: 'new', segmentType: segType };
      }
    },

    /**
     * A tool_result arrived. Look up which group it belongs to.
     * Uses layer 2 (toolCallMap) which survives interleaving.
     *
     * @returns lookup info, or null if this toolCallId was never registered
     */
    getGroupForResult(toolCallId): ToolResultLookup | null {
      const entry = toolCallMap.get(toolCallId);
      if (!entry) return null;
      return {
        grouped: true,
        type: entry.type,
        segmentIndex: entry.segmentIndex,
        expected: entry.expected,
        completed: entry.completed,
      };
    },

    /**
     * Record that a grouped tool_result has been applied to its segment.
     */
    recordGroupResult(toolCallId): ToolResultCompletion | null {
      const entry = toolCallMap.get(toolCallId);
      if (!entry) return null;

      entry.completed++;
      return {
        segmentIndex: entry.segmentIndex,
        expected: entry.expected,
        completed: entry.completed,
        complete: entry.completed >= entry.expected,
      };
    },

    /**
     * A non-tool event arrived (content, thinking).
     * Breaks the current sequence (layer 1) but preserves
     * the toolCallId registry (layer 2).
     */
    breakSequence(): void {
      activeGroup = null;
    },

    /**
     * Turn ended or a newer turn supersedes this one.
     * Clears BOTH layers — called only for THIS thread/turn pair.
     */
    reset(): void {
      activeGroup = null;
      toolCallMap.clear();
    },
  };
}
