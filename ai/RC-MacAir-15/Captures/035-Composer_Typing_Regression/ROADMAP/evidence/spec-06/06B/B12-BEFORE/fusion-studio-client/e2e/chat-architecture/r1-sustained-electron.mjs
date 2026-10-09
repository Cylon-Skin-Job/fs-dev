import { seedHistory } from './r1-sustained-fixture.mjs';
import { prepareOwnerForeground } from './owner-foreground.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupFixture, closeOwnedApp, createChat, createProject, selectPanel, stageAndLaunch, waitFor, withDb,
} from './electron-case-helpers.mjs';
import { buildF2Exchanges, materializeF3Workspace } from './fixture-workloads.mjs';
import { R1_COVERAGE_TARGETS, assertCoverageTargetsCalibrated, summarizePreciseCoverage } from './coverage-observation.mjs';
import { assertFocusedBeforeTyping, establishFocusedWindow } from './window-focus.mjs';
import { installOwnedFocusObservation,readOwnedFocusObservation,focusIntervalEvidence } from './owned-focus-observation.mjs';

const [token, evidenceRoot, tempRoot, variant] = process.argv.slice(2);
assert.ok(variant===undefined||variant==='--setup-only');
const setupOnly=variant==='--setup-only';
if (!token || !evidenceRoot || !tempRoot) throw new Error('R1 sustained scenario arguments are required');
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const projectPath = path.join(tempRoot, 'r1-sustained-project');
const resultPath = path.join(evidenceRoot, setupOnly?'watched-setup-result.json':'r1-sustained-result.json');
const configuredDurationMs = 300_000;
const configuredCharacters = 9_520;
const configuredDelayMs = 32;
const configuredWallBudgetMs = configuredCharacters * configuredDelayMs * 1.5;
const maxOutboundEvidence = 64;
const seed = 'the quick brown fox jumps over the lazy dog and then types some more ';
const text = seed.repeat(Math.ceil(configuredCharacters / seed.length)).slice(0, configuredCharacters);
const f2 = buildF2Exchanges();
let fixture = null;
let runtime = null;
let failure = null;
let result = { status: 'setup-pending', measurementStarted: false,scope:setupOnly?'watched-setup-only; no R1/performance credit':'five-minute-typing' };
let lingering = [];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function observerBootstrap() {
  const maxTrafficEvidence = 2_048;
  window.__chatArchSustained = {
    commits: 0,
    outboundSequence: 0,
    trafficSequence: 0,
    trafficEvidence: [],
    trafficEvidenceOverflow: 0,
    sockets: [],
  };
  const state = window.__chatArchSustained;
  const decodeType = (value) => {
    if (typeof value !== 'string') return '[non-json]';
    try {
      const decoded = JSON.parse(value);
      return typeof decoded?.type === 'string' ? decoded.type : '[missing-type]';
    } catch {
      return '[invalid-json]';
    }
  };
  const recordTraffic = (direction, value) => {
    state.trafficSequence += 1;
    if (state.trafficEvidence.length < maxTrafficEvidence) {
      state.trafficEvidence.push({
        sequence: state.trafficSequence,
        atMs: Math.round(performance.now() * 10) / 10,
        direction,
        type: decodeType(value),
      });
    } else {
      state.trafficEvidenceOverflow += 1;
    }
  };
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = class extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      state.sockets.push(this);
      this.addEventListener('message', (event) => recordTraffic('inbound', event.data));
      const nativeSend = this.send.bind(this);
      this.send = (...sendArgs) => {
        state.outboundSequence += 1;
        recordTraffic('outbound', sendArgs[0]);
        if (state.measurement?.captureOutbound) {
          const measurement = state.measurement;
          measurement.outboundFrameCount += 1;
          if (measurement.outboundEvidence.length < measurement.maxOutboundEvidence) {
            const value = sendArgs[0];
            measurement.outboundEvidence.push({
              atMs: Math.round((performance.now() - measurement.outboundStartedAt) * 10) / 10,
              type: decodeType(value),
            });
          } else {
            measurement.outboundEvidenceOverflow += 1;
          }
        }
        return nativeSend(...sendArgs);
      };
    }
  };
  let nextRenderer = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) { const id = ++nextRenderer; this.renderers.set(id, renderer); return id; },
    onCommitFiberRoot() { state.commits += 1; },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
  };
}

async function waitForScreenshotBootstrapQuiescence(page) {
  const timeoutMs = 30_000;
  const quietMs = 500;
  const startedAt = Date.now();
  let lastSequence = -1;
  let stableSince = Date.now();
  let lastObservation = null;
  while (Date.now() - startedAt < timeoutMs) {
    const observation = await page.evaluate(() => {
      const state = window.__chatArchSustained;
      const evidence = state.trafficEvidence;
      const capture = evidence.find((item) => (
        item.direction === 'outbound' && item.type === 'screenshot:capture'
      ));
      const updated = capture && evidence.find((item) => (
        item.sequence > capture.sequence
        && item.direction === 'inbound'
        && item.type === 'screenshot:updated'
      ));
      const request = updated && evidence.find((item) => (
        item.sequence > updated.sequence
        && item.direction === 'outbound'
        && item.type === 'screenshot:request'
      ));
      const data = request && evidence.find((item) => (
        item.sequence > request.sequence
        && item.direction === 'inbound'
        && item.type === 'screenshot:data'
      ));
      return {
        sequence: state.trafficSequence,
        overflow: state.trafficEvidenceOverflow,
        lifecycle: [capture, updated, request, data].filter(Boolean),
        complete: Boolean(capture && updated && request && data),
      };
    });
    lastObservation = observation;
    if (observation.overflow !== 0) throw new Error('screenshot bootstrap traffic evidence overflowed');
    if (observation.sequence !== lastSequence) {
      lastSequence = observation.sequence;
      stableSince = Date.now();
    } else if (observation.complete && Date.now() - stableSince >= quietMs) {
      return {
        requiredLifecycle: ['screenshot:capture', 'screenshot:updated', 'screenshot:request', 'screenshot:data'],
        quietMs,
        finalTrafficSequence: observation.sequence,
        lifecycle: observation.lifecycle,
      };
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`screenshot bootstrap did not quiesce: ${JSON.stringify(lastObservation)}`);
}


async function takePreciseCoverage(page, action) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  try {
    const value = await action();
    await page.waitForTimeout(100);
    const coverage = await cdp.send('Profiler.takePreciseCoverage');
    return { value, summary: summarizePreciseCoverage(coverage.result) };
  } finally {
    await cdp.send('Profiler.stopPreciseCoverage').catch(() => {});
    await cdp.send('Profiler.disable').catch(() => {});
    await cdp.detach().catch(() => {});
  }
}

async function hydrate(page, groupId) {
  const panel = await selectPanel(page, 'capture-viewer', 'Captures');
  await panel.locator(`.rv-chat-item[data-thread-group-id="${groupId}"]`).click();
  await waitFor(page, () => panel.locator('.rv-message').count().then((count) => count === 60),
    '60 rendered sustained F2 messages', 90_000);
  return panel;
}

async function observeFocus(requestFocus) {
  return runtime.app.evaluate(({ BrowserWindow, app }, shouldRequestFocus) => {
    const target = BrowserWindow.getAllWindows().find((window) => (
      !window.isDestroyed() && window.webContents.getURL().startsWith('fusion-shell://app/')
    ));
    if (!target) return { available: false, focused: false, windowCount: BrowserWindow.getAllWindows().length };
    if (shouldRequestFocus) {
      if (target.isMinimized()) target.restore();
      target.show();
      target.moveTop();
      app.focus({ steal: true });
      target.focus();
      target.webContents.focus();
    }
    return {
      available: true,
      focused: target.isFocused(),
      visible: target.isVisible(),
      minimized: target.isMinimized(),
      windowId: target.id,
      title: target.getTitle(),
      url: target.webContents.getURL(),
    };
  }, requestFocus);
}

async function calibrate(page, groupId) {
  const observed = await takePreciseCoverage(page, async () => {
    await page.reload();
    await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
    return hydrate(page, groupId);
  });
  assertCoverageTargetsCalibrated(observed.summary, R1_COVERAGE_TARGETS);
  return { discovered: observed.summary.discovered, invocationCounts: observed.summary.counts };
}

async function installMeasurement(page) {
  await page.evaluate((outboundEvidenceLimit) => {
    const root = document.querySelector('.rv-panel.active');
    const textarea = root?.querySelector('textarea.rv-chat-input');
    if (!root || !textarea) throw new Error('sustained composer observation root unavailable');
    const state = window.__chatArchSustained;
    const measurement = {
      inputs: [], frames: [], longTasks: [], captureOutbound: false,
      outboundFrameCount: 0, outboundEvidence: [], outboundEvidenceOverflow: 0,
      outboundStartedAt: 0, maxOutboundEvidence: outboundEvidenceLimit,
      commitsBefore: state.commits, mutations: 0,
    };
    state.measurement = measurement;
    const mutationObserver = new MutationObserver((records) => { measurement.mutations += records.length; });
    mutationObserver.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    const keydown = () => {
      const started = performance.now();
      requestAnimationFrame(() => measurement.frames.push(performance.now() - started));
      textarea.addEventListener('input', () => measurement.inputs.push(performance.now() - started), { once: true });
    };
    textarea.addEventListener('keydown', keydown);
    const longTaskSupported = PerformanceObserver.supportedEntryTypes?.includes('longtask') === true;
    const performanceObserver = longTaskSupported
      ? new PerformanceObserver((list) => measurement.longTasks.push(...list.getEntries().map((entry) => entry.duration)))
      : null;
    performanceObserver?.observe({ type: 'longtask', buffered: false });
    state.cleanupMeasurement = () => {
      textarea.removeEventListener('keydown', keydown);
      mutationObserver.disconnect();
      performanceObserver?.disconnect();
    };
    measurement.longTaskSupported = longTaskSupported;
  }, maxOutboundEvidence);
}

async function readMeasurement(page) {
  return page.evaluate(() => {
    const state = window.__chatArchSustained;
    const measurement = state.measurement;
    const percentile = (values, fraction) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : null;
    };
    state.cleanupMeasurement?.();
    state.cleanupMeasurement = null;
    return {
      inputCount: measurement.inputs.length,
      inputP95Ms: percentile(measurement.inputs, 0.95),
      inputMaxMs: percentile(measurement.inputs, 1),
      nextRafCount: measurement.frames.length,
      nextRafP95Ms: percentile(measurement.frames, 0.95),
      nextRafMaxMs: percentile(measurement.frames, 1),
      longTaskObserverSupported: measurement.longTaskSupported,
      longTaskCount: measurement.longTasks.filter((duration) => duration > 50).length,
      longTaskMaxMs: measurement.longTasks.length ? Math.max(...measurement.longTasks) : 0,
      reactCommitCount: state.commits - measurement.commitsBefore,
      domMutations: measurement.mutations,
      wsSent: measurement.outboundFrameCount,
      outboundEvidence: measurement.outboundEvidence,
      outboundEvidenceOverflow: measurement.outboundEvidenceOverflow,
    };
  });
}

try {
  fixture = await stageAndLaunch({ repoRoot, tempRoot, token, casePrefix: 'r1-sustained', evidenceRoot, initScript: observerBootstrap });
  runtime = await fixture.launch();
  await createProject(runtime.app, runtime.page, projectPath, 'R1 Sustained Fixture');
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await createChat(runtime.page, fixture.dbPath);
  const identity = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => db.prepare(
    'SELECT current_primary_thread_id AS threadId, group_id AS threadGroupId FROM thread_groups ORDER BY rowid DESC LIMIT 1',
  ).get());
  lingering.push(...await closeOwnedApp(runtime));
  runtime = null;
  const f3 = materializeF3Workspace(projectPath);
  seedHistory(fixture.dbPath, identity.threadId, f2.exchanges);
  runtime = await fixture.launch();
  await installOwnedFocusObservation(runtime);
  await prepareOwnerForeground(runtime,fixture,{token,evidenceRoot,requirePointer:setupOnly});
  const coverageCalibration = await calibrate(runtime.page, identity.threadGroupId);
  const panel = await hydrate(runtime.page, identity.threadGroupId);
  const focusEstablishment = await establishFocusedWindow({
    observeAndFocus: async () => {await runtime.page.bringToFront();return observeFocus(true);},
    wait: ms => runtime.page.waitForTimeout(ms),
  });
  const composer = panel.locator('textarea.rv-chat-input');
  await composer.fill('');
  await composer.focus();
  const preMeasurementQuiescence = await waitForScreenshotBootstrapQuiescence(runtime.page);
  const observerCalibration = await runtime.page.evaluate(async () => {
    if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) throw Error('longtask observer unavailable');
    const samples=[]; const observer=new PerformanceObserver(list=>samples.push(...list.getEntries().map(e=>e.duration)));
    observer.observe({type:'longtask'});
    await new Promise(resolve=>setTimeout(resolve,50));
    const start=performance.now(); while(performance.now()-start<75) {}
    await new Promise(resolve=>setTimeout(resolve,100)); observer.disconnect(); return samples;
  });
  assert.ok(observerCalibration.some(duration=>duration>=50), 'positive long-task observation calibration');
  await runtime.page.waitForTimeout(45_000);
  if(!setupOnly)await installMeasurement(runtime.page);
  result = {
    ...result,status: 'focus-prerequisite-pending', measurementStarted: false,
    configuredDurationMs, configuredCharacters, configuredDelayMs, configuredWallBudgetMs,
    fixture: { f2: f2.manifest, f3: { ...f3, files: undefined, supportFiles: undefined } },
    identity, coverageCalibration, preMeasurementQuiescence, observerCalibration, settleMs:45_000,
  };
  const beforeTyping = assertFocusedBeforeTyping(await observeFocus(false), setupOnly?'WATCHED-SETUP':'R1-FIVE-MINUTE-TYPING');
  if(setupOnly){result.status='setup-only-passed';result.focusEvidence={establishment:focusEstablishment,beforeTyping};}
  else {
  result.measurementStarted = true;
  const startedAt = Date.now();
  const covered = await takePreciseCoverage(runtime.page, async () => {
    await runtime.page.evaluate(() => {
      const measurement = window.__chatArchSustained.measurement;
      measurement.outboundStartedAt = performance.now();
      measurement.captureOutbound = true;
    });
    try { await runtime.page.keyboard.type(text, { delay: configuredDelayMs }); }
    finally { await runtime.page.evaluate(() => { window.__chatArchSustained.measurement.captureOutbound = false; }); }
  });
  const endedAt=Date.now(),wallMs=endedAt-startedAt;
  const focusInterval=focusIntervalEvidence(await readOwnedFocusObservation(runtime),startedAt,endedAt);
  const metrics = await readMeasurement(runtime.page);
  const retained = await composer.inputValue();
  const afterTyping = await observeFocus(false);
  const renderCounts = Object.fromEntries(
    ['MessageList', 'InstantSegmentRenderer', 'ChatAreaHeader', 'ThreadRail', 'ContentArea', 'renderTextInstant']
      .map((name) => [name, covered.summary.counts[name] ?? 0]),
  );
  const violations = [
    !focusInterval.valid ? 'focus interval interrupted/incomplete' : null,
    afterTyping.focused !== true ? 'completion focus lost; timing inconclusive' : null,
    retained !== text ? 'exact text retention' : null,
    metrics.inputCount !== text.length || metrics.nextRafCount !== text.length ? 'incomplete input/rAF samples' : null,
    metrics.inputP95Ms > 3 ? 'input p95' : null,
    metrics.nextRafP95Ms > 20 || metrics.nextRafMaxMs > 50 ? 'rAF latency' : null,
    metrics.longTaskObserverSupported !== true || metrics.longTaskCount !== 0 ? 'long tasks unavailable/nonzero' : null,
    metrics.wsSent !== 0 ? 'typing-time outbound WebSocket frames' : null,
    wallMs < configuredDurationMs || wallMs > configuredWallBudgetMs ? 'five-minute wall budget' : null,
    Object.values(renderCounts).some((count) => count !== 0) ? 'draft-induced sibling/history/formatter work' : null,
    await panel.locator('.rv-message').count() !== 60 ? 'history identity changed' : null,
  ].filter(Boolean);
  result = {
    ...result, status: violations.length ? 'failed' : 'passed', wallMs, exactRetention: retained === text,
    promptSha256: sha256(text), promptContentRecorded: false, metrics, renderCounts,
    focusEvidence: { interval:focusInterval, establishment: focusEstablishment, beforeTyping, afterTyping }, violations,
  };
  if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') assert.deepEqual(violations, [], violations.join(', '));
  }
} catch (error) {
  failure = error;
  result = {
    ...result,
    status: error.code === 'R1_FOCUS_UNAVAILABLE' ? 'focus-unavailable' : 'failed',
    failure: { name: error.name, message: error.message, code: error.code ?? null, observation: error.observation ?? null },
  };
} finally {
  const ownedFocus=await readOwnedFocusObservation(runtime);
  if (runtime) lingering.push(...await closeOwnedApp(runtime));
  const cleanup = fixture ? cleanupFixture(fixture, token) : null;
  result = { ...result, ownedFocus, cleanup, lingeringOwnedPids: [...new Set(lingering)] };
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (failure) throw failure;
process.stdout.write(setupOnly?'CHAT_ARCH_WATCHED_SETUP_ONLY_OK\n':'CHAT_ARCH_R1_SUSTAINED_OK\n');
