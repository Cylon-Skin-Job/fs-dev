import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCoverageTargetsCalibrated,
  assertCoverageTargetsDiscovered,
  R1_COVERAGE_TARGETS,
  summarizePreciseCoverage,
} from './coverage-observation.mjs';

function coverage(functionNames, count = 1) {
  return [{ functions: functionNames.map((functionName) => ({
    functionName,
    ranges: [{ startOffset: 0, endOffset: 1, count }],
  })) }];
}

test('coverage discovery fails closed for a misspelled zero-count target', () => {
  const summary = summarizePreciseCoverage(coverage([
    'renderTextInstant',
    'MessageListTypo',
    'InstantSegmentRenderer',
    'ChatAreaHeader',
    'ThreadRail',
    'ContentArea',
    'ChatAreaFooter',
  ]));
  assert.throws(
    () => assertCoverageTargetsDiscovered(summary.discovered),
    /MessageList/,
  );
});

test('coverage discovery accepts every independently calibrated target', () => {
  const summary = summarizePreciseCoverage(coverage(R1_COVERAGE_TARGETS));
  assert.doesNotThrow(() => assertCoverageTargetsDiscovered(summary.discovered));
  assert.doesNotThrow(() => assertCoverageTargetsCalibrated(summary));
  assert.equal(summary.counts.ChatAreaFooter, 1);
});

test('coverage calibration fails closed when every target name is present but never invoked', () => {
  const summary = summarizePreciseCoverage(coverage(R1_COVERAGE_TARGETS, 0));
  assert.deepEqual(summary.discovered, [...R1_COVERAGE_TARGETS].sort());
  assert.throws(
    () => assertCoverageTargetsCalibrated(summary),
    /no positive calibration invocation/,
  );
});
