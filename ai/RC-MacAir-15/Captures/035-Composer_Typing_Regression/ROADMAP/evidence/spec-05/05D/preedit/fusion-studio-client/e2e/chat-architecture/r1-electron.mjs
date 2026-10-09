import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  cleanupFixture, closeOwnedApp, createChat, createProject, selectPanel, stageAndLaunch, waitFor, withDb,
} from './electron-case-helpers.mjs';
import { buildF2Exchanges, f4Manifest, F5_MANIFEST, materializeF3Workspace } from './fixture-workloads.mjs';
import {
  assertCoverageTargetsCalibrated,
  R1_COVERAGE_TARGETS,
  summarizePreciseCoverage,
} from './coverage-observation.mjs';
import { assertFocusedBeforeTyping, establishFocusedWindow } from './window-focus.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
if (!token || !evidenceRoot || !tempRoot) throw new Error('R1 scenario arguments are required');
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const projectPath = path.join(tempRoot, 'r1-project');
const resultPath = path.join(evidenceRoot, 'r1-result.json');
const text = 'the quick brown fox jumps over the lazy dog and then types some more';
const settleMs = Number(process.env.FUSION_CHAT_ARCH_R1_SETTLE_MS || 45_000);
const repeatTrials = Number(process.env.FUSION_CHAT_ARCH_R1_REPEAT_TRIALS || 3);
if (!Number.isSafeInteger(settleMs) || settleMs < 0
  || !Number.isSafeInteger(repeatTrials) || repeatTrials < 1) {
  throw new Error('R1 settle/repeat overrides must be non-negative/positive safe integers');
}
const f2 = buildF2Exchanges();
let fixture = null;
let runtime = null;
let failure = null;
let result = null;
let lingering = [];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function observerBootstrap() {
  window.__chatArchObservation = { commits: 0, outboundSequence: 0, sockets: [] };
  const state = window.__chatArchObservation;
  const NativeWebSocket = window.WebSocket;
  const classifyOutboundFrame = (payload) => {
    if (typeof payload === 'string') {
      try {
        const decoded = JSON.parse(payload);
        if (typeof decoded?.type === 'string') return decoded.type;
        if (typeof decoded?.action === 'string') return decoded.action;
        return 'json:unclassified';
      } catch {
        return 'text:unclassified';
      }
    }
    if (payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)) return 'binary:unclassified';
    if (payload instanceof Blob) return 'blob:unclassified';
    return `unclassified:${typeof payload}`;
  };
  window.WebSocket = class extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      state.sockets.push(this);
      const nativeSend = this.send.bind(this);
      this.send = (...sendArgs) => {
        state.outboundSequence += 1;
        if (state.window?.captureOutboundFrames) {
          state.window.outboundFrameTypes.push(classifyOutboundFrame(sendArgs[0]));
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
    onCommitFiberRoot(_id, root) {
      state.commits += 1;
    },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
  };
}

async function seedHistory(dbPath, threadId, exchanges) {
  withDb(dbPath, {}, (db) => {
    const insert = db.prepare('INSERT INTO exchanges (thread_id,seq,ts,user_input,assistant,metadata) VALUES (?,?,?,?,?,?)');
    db.transaction(() => {
      for (const exchange of exchanges) {
        insert.run(threadId, exchange.seq, 1_780_000_000_000 + exchange.seq,
          exchange.user, JSON.stringify(exchange.assistant), JSON.stringify(exchange.metadata));
      }
      db.prepare('UPDATE threads SET message_count = ?, updated_at = ? WHERE thread_id = ?')
        .run(exchanges.length, 1_780_000_000_000 + exchanges.length, threadId);
    })();
  });
}

async function waitForRenderQuiescence(page) {
  let previous = null;
  let stableSamples = 0;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const snapshot = await page.evaluate(() => JSON.stringify({
      commits: window.__chatArchObservation.commits,
      outboundSequence: window.__chatArchObservation.outboundSequence,
    }));
    stableSamples = snapshot === previous ? stableSamples + 1 : 0;
    if (stableSamples >= 5) return;
    previous = snapshot;
    await page.waitForTimeout(100);
  }
  throw new Error('R1 render/network activity did not become quiescent before draft observation');
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

async function calibrateCoverageTargets(page, groupId, expectedMessages) {
  const calibration = await takePreciseCoverage(page, async () => {
    await page.reload();
    await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
    return hydrateThread(page, groupId, expectedMessages, 'coverage calibration');
  });
  assertCoverageTargetsCalibrated(calibration.summary, R1_COVERAGE_TARGETS);
  return {
    discovered: calibration.summary.discovered,
    invocationCounts: calibration.summary.counts,
    hydrationRetries: calibration.value.retries,
  };
}

async function observeStagedWindowFocus(app, requestFocus) {
  return app.evaluate(({ BrowserWindow, app: electronApp }, shouldRequestFocus) => {
    const target = BrowserWindow.getAllWindows().find((window) => (
      !window.isDestroyed() && window.webContents.getURL().startsWith('fusion-shell://app/')
    ));
    if (!target) return { available: false, focused: false, windowCount: BrowserWindow.getAllWindows().length };
    if (shouldRequestFocus) {
      if (target.isMinimized()) target.restore();
      target.show();
      target.moveTop();
      electronApp.focus({ steal: true });
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

async function focusStagedWindow(app, page) {
  return establishFocusedWindow({
    observeAndFocus: async () => {
      await page.bringToFront();
      return observeStagedWindowFocus(app, true);
    },
    wait: (ms) => page.waitForTimeout(ms),
  });
}

async function measureWindow(app, page, panel, id, trial, coverageCalibration) {
  const composer = panel.locator('textarea.rv-chat-input');
  await waitForRenderQuiescence(page);
  await composer.fill('');
  await composer.focus();
  await waitForRenderQuiescence(page);
  await page.evaluate(() => {
    const root = document.querySelector('.rv-panel.active');
    const textarea = root?.querySelector('textarea.rv-chat-input');
    const state = window.__chatArchObservation;
    state.cleanupWindow?.();
    state.window = { keys: [], frames: [], mutations: 0, longTasks: [],
      captureOutboundFrames: false, outboundFrameTypes: [],
      commitsBefore: state.commits };
    const mutationObserver = new MutationObserver((records) => { state.window.mutations += records.length; });
    mutationObserver.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    const keydownListener = (event) => {
      const started = performance.now();
      requestAnimationFrame(() => state.window.frames.push(performance.now() - started));
      textarea.addEventListener('input', () => state.window.keys.push(performance.now() - started), { once: true });
    };
    textarea.addEventListener('keydown', keydownListener);
    state.window.longTaskObserverSupported = PerformanceObserver.supportedEntryTypes?.includes('longtask') === true;
    let performanceObserver = null;
    if (state.window.longTaskObserverSupported) {
      performanceObserver = new PerformanceObserver((list) => state.window.longTasks.push(...list.getEntries().map((entry) => entry.duration)));
      performanceObserver.observe({ type: 'longtask', buffered: false });
    }
    state.cleanupWindow = () => {
      textarea.removeEventListener('keydown', keydownListener);
      mutationObserver.disconnect();
      performanceObserver?.disconnect();
    };
  });
  const focusEstablishment = await focusStagedWindow(app, page);
  const measured = await takePreciseCoverage(page, async () => {
    const beforeTyping = assertFocusedBeforeTyping(
      await observeStagedWindowFocus(app, false),
      `${id} trial ${trial}`,
    );
    const wallStarted = Date.now();
    await page.evaluate(() => { window.__chatArchObservation.window.captureOutboundFrames = true; });
    try {
      await page.keyboard.type(text, { delay: 25 });
    } finally {
      await page.evaluate(() => { window.__chatArchObservation.window.captureOutboundFrames = false; });
    }
    return {
      wallMs: Date.now() - wallStarted,
      beforeTyping,
      afterTyping: await observeStagedWindowFocus(app, false),
    };
  });
  const wallMs = measured.value.wallMs;
  const coverageFunctions = measured.summary.counts;
  const metrics = await page.evaluate(() => {
    const state = window.__chatArchObservation;
    const win = state.window;
    const sorted = [...win.keys].sort((a, b) => a - b);
    const frames = [...win.frames].sort((a, b) => a - b);
    const percentile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * p))] : null;
    const result = {
      inputCount: sorted.length, inputP95Ms: percentile(sorted, 0.95), inputMaxMs: sorted.at(-1) ?? null,
      nextRafCount: frames.length, nextRafP95Ms: percentile(frames, 0.95), nextRafMaxMs: frames.at(-1) ?? null,
      domMutations: win.mutations, longTaskObserverSupported: win.longTaskObserverSupported,
      longTaskCount: win.longTaskObserverSupported ? win.longTasks.length : null,
      longTaskMaxMs: win.longTaskObserverSupported && win.longTasks.length ? Math.max(...win.longTasks) : null,
      reactCommitCount: state.commits - win.commitsBefore,
      wsSent: win.outboundFrameTypes.length,
      outboundFrameTypes: [...win.outboundFrameTypes],
      outboundFrameObservationInterval: 'keyboard.type',
      visibilityState: document.visibilityState,
    };
    state.cleanupWindow?.();
    state.cleanupWindow = null;
    return result;
  });
  const retained = await composer.inputValue();
  assert.equal(retained, text, `${id} did not retain exact input`);
  const componentRenderEvidence = Object.fromEntries(
    ['MessageList', 'InstantSegmentRenderer', 'ChatAreaHeader', 'ThreadRail', 'ContentArea']
      .map((name) => [name, coverageFunctions[name]]),
  );
  const formatterInvocationEvidence = { renderTextInstant: coverageFunctions.renderTextInstant };
  const formatterInvocationCount = coverageFunctions.renderTextInstant;
  return {
    id, trial, configuredCharacters: text.length, configuredDelayMs: 25, wallMs, exactRetention: true,
    promptSha256: sha256(text), promptContentRecorded: false, ...metrics, componentRenderEvidence,
    formatterInvocationEvidence, coveragePositiveControl: { ChatAreaFooter: coverageFunctions.ChatAreaFooter },
    coverageTargetsDiscovered: coverageCalibration.discovered,
    formatterFunctionsObserved: coverageCalibration.discovered.filter((name) => name === 'renderTextInstant'),
    formatterInvocationCount,
    formatterCountMethod: 'cdp-precise-function-coverage',
    formatterObservationAvailable: true,
    focusEvidence: {
      establishment: focusEstablishment,
      beforeTyping: measured.value.beforeTyping,
      afterTyping: measured.value.afterTyping,
    },
    observationStatus: metrics.longTaskObserverSupported
      ? 'measured'
      : 'inconclusive-performance-observer-unavailable',
  };
}

async function hydrateThread(page, groupId, expectedMessages, label) {
  let panel = await selectPanel(page, 'capture-viewer', 'Captures');
  await panel.locator(`.rv-chat-item[data-thread-group-id="${groupId}"]`).click();
  let retries = 0;
  try {
    await waitFor(page, () => panel.locator('.rv-message').count().then((count) => count === expectedMessages),
      `${expectedMessages} rendered ${label} messages`, 12_000);
  } catch {
    // A selected group may occasionally remain unhydrated after the first
    // Electron reload. Retire that page generation once, then retry the same
    // immutable fixture/group; the retry is recorded in startup evidence.
    retries = 1;
    await page.reload();
    await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
    panel = await selectPanel(page, 'capture-viewer', 'Captures');
    await panel.locator(`.rv-chat-item[data-thread-group-id="${groupId}"]`).click();
    await waitFor(page, () => panel.locator('.rv-message').count().then((count) => count === expectedMessages),
      `${expectedMessages} rendered ${label} messages after bounded reload`, 78_000);
  }
  return { panel, retries };
}

try {
  fixture = await stageAndLaunch({ repoRoot, tempRoot, token, casePrefix: 'r1', evidenceRoot, initScript: observerBootstrap });
  runtime = await fixture.launch();
  await createProject(runtime.app, runtime.page, projectPath, `R1 F2 F3 ${token.slice(-8)}`);
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await createChat(runtime.page, fixture.dbPath);
  const identity = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => db.prepare(
    'SELECT current_primary_thread_id AS threadId, group_id AS threadGroupId FROM thread_groups ORDER BY rowid DESC LIMIT 1',
  ).get());
  await createChat(runtime.page, fixture.dbPath);
  const denseIdentity = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => db.prepare(
    'SELECT current_primary_thread_id AS threadId, group_id AS threadGroupId FROM thread_groups ORDER BY rowid DESC LIMIT 1',
  ).get());
  assert.notEqual(denseIdentity.threadGroupId, identity.threadGroupId);
  lingering.push(...await closeOwnedApp(runtime));
  runtime = null;
  const f3 = materializeF3Workspace(projectPath);
  await seedHistory(fixture.dbPath, identity.threadId, f2.exchanges);
  await seedHistory(fixture.dbPath, denseIdentity.threadId, f2.dense);
  runtime = await fixture.launch();
  const coverageCalibration = await calibrateCoverageTargets(runtime.page, identity.threadGroupId, 60);
  result = {
    status: 'focus-prerequisite-pending',
    characterization: true,
    repeatTrials,
    coverageCalibration,
    measurements: [],
  };
  const startupHydrationMs = [];
  const startupHydrationRetries = [];
  const settleObservedMs = [];
  const measurements = [];
  result.measurements = measurements;
  let loadedPanel = null;
  for (let trial = 1; trial <= repeatTrials; trial += 1) {
    const startupAt = Date.now();
    await runtime.page.reload();
    await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
    const hydration = await hydrateThread(runtime.page, identity.threadGroupId, 60, `F2 trial ${trial}`);
    loadedPanel = hydration.panel;
    startupHydrationRetries.push(hydration.retries);
    startupHydrationMs.push(Date.now() - startupAt);
    measurements.push(await measureWindow(runtime.app, runtime.page, loadedPanel, 'R1-STARTUP-F2-F3', trial, coverageCalibration));
    measurements.push(await measureWindow(runtime.app, runtime.page, loadedPanel, 'R1-WARM-F2-F3', trial, coverageCalibration));
    const settleStartedAt = Date.now();
    await runtime.page.waitForTimeout(settleMs);
    const settled = await measureWindow(runtime.app, runtime.page, loadedPanel, 'R1-SETTLED45-F2-F3', trial, coverageCalibration);
    settleObservedMs.push(Date.now() - settleStartedAt - settled.wallMs - 100);
    measurements.push(settled);
  }
  const denseStartupAt = Date.now();
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  const denseHydration = await hydrateThread(runtime.page, denseIdentity.threadGroupId, 4, 'dense F2');
  loadedPanel = denseHydration.panel;
  const denseStartupHydrationMs = Date.now() - denseStartupAt;
  const denseMeasurement = await measureWindow(runtime.app, runtime.page, loadedPanel, 'R1-DENSE-F2', 1, coverageCalibration);
  measurements.push(denseMeasurement);
  const denseDomTextBytes = Buffer.byteLength(await loadedPanel.locator('.rv-message-assistant').first().innerText());
  const denseStoredPayloadBytes = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => {
    const row = db.prepare('SELECT assistant FROM exchanges WHERE thread_id = ? AND seq = 1').get(denseIdentity.threadId);
    return Buffer.byteLength(JSON.parse(row.assistant).parts[0].content);
  });
  assert.equal(denseStoredPayloadBytes, f2.manifest.dense.assistantPayloadBytes);
  assert.ok(denseDomTextBytes >= f2.manifest.dense.assistantPayloadBytes - 1);
  const runtimeFacts = await runtime.app.evaluate(({ BrowserWindow, app }) => ({
    focused: BrowserWindow.getAllWindows()[0]?.isFocused() === true,
    visible: BrowserWindow.getAllWindows()[0]?.isVisible() === true,
    profile: app.getPath('userData'), electron: process.versions.electron, node: process.versions.node,
  }));
  result = {
    status: 'passed', characterization: true, repeatTrials, coverageCalibration,
    startupHydrationMs, startupHydrationRetries,
    settle: { configuredMs: settleMs, observedMs: settleObservedMs },
    identity, denseIdentity, renderedMessages: f2.manifest.renderedMessages, measurements,
    dense: { renderedMessages: 4, startupHydrationMs: denseStartupHydrationMs,
      startupHydrationRetries: denseHydration.retries, storedPayloadBytes: denseStoredPayloadBytes, domTextBytes: denseDomTextBytes },
    fixtures: { f2: f2.manifest, f3, f4: f4Manifest(), f5: F5_MANIFEST }, runtime: runtimeFacts,
    source: { head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim() },
  };
  fs.writeFileSync(path.join(evidenceRoot, 'f2-manifest.json'), `${JSON.stringify(f2.manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceRoot, 'f3-manifest.json'), `${JSON.stringify(f3, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceRoot, 'f4-manifest.json'), `${JSON.stringify(f4Manifest(), null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceRoot, 'f5-manifest.json'), `${JSON.stringify(F5_MANIFEST, null, 2)}\n`);
  if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
    const violations = result.measurements.flatMap((measurement) => [
      measurement.inputCount !== text.length || measurement.nextRafCount !== text.length
        || !Number.isFinite(measurement.inputP95Ms)
        || !Number.isFinite(measurement.inputMaxMs) || !Number.isFinite(measurement.nextRafP95Ms)
        || !Number.isFinite(measurement.nextRafMaxMs)
        ? `${measurement.id} trial ${measurement.trial}: key/input/rAF samples unavailable or incomplete` : null,
      measurement.formatterObservationAvailable !== true || measurement.formatterInvocationCount !== 0
        ? `${measurement.id} trial ${measurement.trial}: formatter unavailable/invocations` : null,
      R1_COVERAGE_TARGETS.some((name) => !measurement.coverageTargetsDiscovered.includes(name))
        ? `${measurement.id}: CDP target discovery unavailable` : null,
      (measurement.coveragePositiveControl.ChatAreaFooter || 0) < text.length
        ? `${measurement.id}: CDP function coverage positive control unavailable` : null,
      (measurement.componentRenderEvidence.MessageList || 0) !== 0 ? `${measurement.id}: MessageList renders` : null,
      (measurement.componentRenderEvidence.InstantSegmentRenderer || 0) !== 0
        ? `${measurement.id}: completed-history renderer renders` : null,
      (measurement.componentRenderEvidence.ChatAreaHeader || 0) !== 0
        ? `${measurement.id}: sibling header renders` : null,
      (measurement.componentRenderEvidence.ThreadRail || 0) !== 0
        ? `${measurement.id}: sibling rail renders` : null,
      (measurement.componentRenderEvidence.ContentArea || 0) !== 0
        ? `${measurement.id}: sibling ContentArea renders` : null,
      measurement.outboundFrameObservationInterval !== 'keyboard.type'
        || measurement.outboundFrameTypes.length !== 0 || measurement.wsSent !== 0
        ? `${measurement.id}: typing-time outbound WebSocket frames (${measurement.outboundFrameTypes.join(', ')})` : null,
      measurement.focusEvidence.beforeTyping.focused !== true
        || measurement.focusEvidence.afterTyping.focused !== true
        ? `${measurement.id}: staged Electron focus unavailable/lost during typing` : null,
      measurement.inputP95Ms > 3 ? `${measurement.id}: input p95` : null,
      measurement.nextRafP95Ms > 20 || measurement.nextRafMaxMs > 50 ? `${measurement.id}: rAF latency` : null,
      measurement.longTaskObserverSupported !== true || measurement.longTaskCount !== 0 ? `${measurement.id}: long tasks unavailable/nonzero` : null,
      measurement.wallMs > text.length * 25 * 1.5 ? `${measurement.id}: wall budget` : null,
    ].filter(Boolean));
    assert.deepEqual(violations, [], `R1 enforce violations: ${violations.join(', ')}`);
  }
} catch (error) {
  failure = error;
  if (runtime?.page) await runtime.page.screenshot({ path: path.join(evidenceRoot, 'r1-failure.png'), fullPage: true }).catch(() => {});
} finally {
  if (runtime) lingering.push(...await closeOwnedApp(runtime));
  const cleanup = fixture ? cleanupFixture(fixture, token) : null;
  fs.writeFileSync(resultPath, `${JSON.stringify({ ...result, cleanup: { lingering, ...cleanup },
    failure: failure ? {
      name: failure.name,
      code: failure.code || null,
      message: failure.message,
      observation: failure.observation || null,
      stack: failure.stack,
    } : null }, null, 2)}\n`);
}

assert.deepEqual(lingering, []);
if (failure) throw failure;
process.stdout.write('CHAT_ARCH_R1_OK\n');
