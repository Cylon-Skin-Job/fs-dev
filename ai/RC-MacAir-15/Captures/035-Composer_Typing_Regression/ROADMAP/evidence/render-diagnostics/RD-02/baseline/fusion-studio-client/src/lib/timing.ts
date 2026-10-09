/**
 * Timing Constants — stable timing profile for reveal animations.
 *
 * Text and tool reveal speed is controlled by chunk queue lookahead
 * (real buffer depth). This module provides the stable timing contract
 * used by all reveal controllers.
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

/** Default timing profile used by all reveal controllers */
export const DEFAULT_TIMING_PROFILE: TimingProfile = {
  shimmerTotal: 400,
  interChunkPause: 80,
  speedFast: 1,
  speedSlow: 6,
  batchSizeFast: 5,
  postTypingPause: 500,
  collapseDuration: 300,
  interSegmentPause: 100,
};
