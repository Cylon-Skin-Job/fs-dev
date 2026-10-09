import assert from 'node:assert/strict';

export const R1_ZERO_COVERAGE_TARGETS = Object.freeze([
  'renderTextInstant',
  'MessageList',
  'InstantSegmentRenderer',
  'ChatAreaHeader',
  'ThreadRail',
  'ContentArea',
]);

export const R1_COVERAGE_TARGETS = Object.freeze([
  ...R1_ZERO_COVERAGE_TARGETS,
  'ChatAreaFooter',
]);

export function summarizePreciseCoverage(result, targetNames = R1_COVERAGE_TARGETS) {
  const targets = new Set(targetNames);
  const counts = Object.fromEntries(targetNames.map((name) => [name, 0]));
  const discovered = new Set();
  for (const script of result) {
    for (const fn of script.functions) {
      if (!targets.has(fn.functionName)) continue;
      discovered.add(fn.functionName);
      counts[fn.functionName] += Math.max(0, ...fn.ranges.map((range) => range.count));
    }
  }
  return { counts, discovered: [...discovered].sort() };
}

export function assertCoverageTargetsDiscovered(
  discovered,
  required = R1_ZERO_COVERAGE_TARGETS,
) {
  const found = new Set(discovered);
  const missing = required.filter((name) => !found.has(name));
  assert.deepEqual(missing, [], `CDP coverage targets were not calibrated: ${missing.join(', ')}`);
}

export function assertCoverageTargetsCalibrated(
  summary,
  required = R1_COVERAGE_TARGETS,
) {
  assertCoverageTargetsDiscovered(summary.discovered, required);
  const nonPositive = required.filter((name) => !Number.isFinite(summary.counts[name]) || summary.counts[name] <= 0);
  assert.deepEqual(
    nonPositive,
    [],
    `CDP coverage targets had no positive calibration invocation: ${nonPositive.join(', ')}`,
  );
}
