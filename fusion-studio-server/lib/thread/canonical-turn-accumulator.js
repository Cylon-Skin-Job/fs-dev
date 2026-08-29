/**
 * @module canonical-turn-accumulator
 * @role Create and settle the non-serializable canonical turn accumulator.
 *
 * SPEC-01 Slice C (RCC-0108): ThreadRuntimeManager is the sole mutable owner
 * of canonical turn state. The LiveTurnSnapshot is its serializable
 * projection; this accumulator holds the mutable, non-serializable pieces of
 * one accepted turn (streaming tool argument buffers, tool name correlation,
 * bounce suppression, usage metadata, terminalization flag) beside that
 * snapshot on the active drain record.
 *
 * The accumulator must never be cloned into, or sent with, a snapshot.
 */

/**
 * Create a fresh turn accumulator for one accepted canonical turn.
 *
 * SPEC-02 Slice B (RCC-0108): `seenStepIdentities` is the authoritative O(1)
 * full-turn step-dedupe ledger (parent §4.7). The snapshot's
 * `seenStepIdentities` array is its JSON-safe projection, mirrored inside
 * gated mutations. No side evicts identities during an active turn.
 *
 * @returns {{
 *   toolArgsBuffers: Map<string, string>,
 *   toolNamesById: Record<string, string>,
 *   bouncedToolCalls: Set<string>,
 *   hasToolCalls: boolean,
 *   usage: { contextUsage: null, tokenUsage: null, messageId: null, planMode: boolean },
 *   seenStepIdentities: Set<string>,
 *   terminalized: boolean,
 * }}
 */
function createTurnAccumulator() {
  return {
    toolArgsBuffers: new Map(),
    toolNamesById: {},
    bouncedToolCalls: new Set(),
    hasToolCalls: false,
    usage: {
      contextUsage: null,
      tokenUsage: null,
      messageId: null,
      planMode: false,
    },
    seenStepIdentities: new Set(),
    terminalized: false,
  };
}

/**
 * Settle the accumulator at terminalization: clear the mutable streaming
 * buffer, reset usage metadata, clear the full-turn step-identity ledger
 * (SPEC-02 Slice B: seenStepIdentities is cleared on every terminal path,
 * matching the snapshot projection cleared by completeLiveTurn), and mark
 * the record terminalized so repeated terminalization and post-terminal
 * mutations are rejected upstream.
 *
 * Bounce suppression and hasToolCalls are intentionally retained until the
 * active drain record is cleared: chat:turn_end assembly still reads
 * hasToolCalls after terminalization, and a late duplicate tool result must
 * stay suppressed for the lifetime of the record.
 *
 * @param {ReturnType<typeof createTurnAccumulator>} turn
 */
function settleAccumulatorForTerminal(turn) {
  turn.toolArgsBuffers.clear();
  turn.seenStepIdentities.clear();
  turn.usage.contextUsage = null;
  turn.usage.tokenUsage = null;
  turn.usage.messageId = null;
  turn.usage.planMode = false;
  turn.terminalized = true;
}

module.exports = {
  createTurnAccumulator,
  settleAccumulatorForTerminal,
};
