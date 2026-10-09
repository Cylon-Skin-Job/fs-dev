/**
 * @module componentTabLocationPolicy
 * @role Pure SPEC-02 §7 omitTerminalNames display policy for tab location
 *       segments.
 *
 * Display-only projection: it never mutates the input segments, targetKey,
 * presenter identity, file path, permissions, fetching, saving, or
 * deduplication. Not wired into the shell in this slice — consumed by later
 * VIEW-02 slices.
 */

import type { TabBreadcrumbSegment } from './componentTabPresentationDomain';

/**
 * Remove an exact case-sensitive terminal-name match ONLY when it is the last
 * display segment AND at least one segment remains:
 *   - similarly named segments are NOT omitted (exact match);
 *   - one-segment paths are never omitted;
 *   - duplicate-label segments lose only the last occurrence;
 *   - the projected segments are never empty when the input is non-empty.
 */
export function projectTabLocationDisplaySegments(
  segments: ReadonlyArray<TabBreadcrumbSegment>,
  omitTerminalNames: ReadonlyArray<string>,
): ReadonlyArray<TabBreadcrumbSegment> {
  if (segments.length < 2) return segments;
  const terminal = segments[segments.length - 1];
  if (!omitTerminalNames.includes(terminal.label)) return segments;
  return segments.slice(0, segments.length - 1);
}
