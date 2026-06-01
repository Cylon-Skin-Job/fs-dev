/**
 * Timing Constants — stable timing profile for reveal animations.
 *
 * Text and tool reveal speed is controlled by chunk queue lookahead
 * (real buffer depth), not segment backlog. This module provides the
 * stable timing contract used by all reveal controllers.
 */

/** Stable timing profile for all reveal phases */
export interface TimingProfile {
  // ── Shimmer phase ──
  /** ms for shimmer (fade-in + hold) before content starts */
  shimmerTotal: number;

  // ── Reveal phase ──
  /** ms between typed chunks */
  interChunkPause: number;
  /** ms per char when next chunk is buffered (lookahead available) */
  speedFast: number;
  /** ms per char when buffer is empty (no lookahead) */
  speedSlow: number;
  /** chars per tick at fast speed */
  batchSizeFast: number;

  // ── Post-reveal phase ──
  /** ms after reveal completes before collapse starts */
  postTypingPause: number;
  /** ms for the CSS collapse animation */
  collapseDuration: number;
  /** ms between segments (after collapse, before next mounts) */
  interSegmentPause: number;
}

/** Pause between typing chunks within a reveal (fallback for reveal orchestrator) */
export const INTER_CHUNK_PAUSE = 80;

/** Duration of the maxHeight fold animation (fallback for ToolCallBlock) */
export const COLLAPSE_DURATION = 300;
