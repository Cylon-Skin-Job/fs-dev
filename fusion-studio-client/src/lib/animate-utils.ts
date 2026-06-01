/**
 * Animation Utilities — shared helpers for typing animations.
 *
 * Used by:
 *   - text-animate.ts (text segment typing loop)
 *   - LiveSegmentRenderer.tsx (tool segment animations)
 *
 * No React. No DOM manipulation. Pure helpers.
 */

/** Promise-based delay. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
