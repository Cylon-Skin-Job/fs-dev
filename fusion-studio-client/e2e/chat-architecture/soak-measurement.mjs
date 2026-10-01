import { summarizePreciseCoverage } from './coverage-observation.mjs';
const maxOutboundEvidence = 64;
export function observerBootstrap() {
  const maxTrafficEvidence = 2_048;
  window.__chatArchSustained = {
    documentId:crypto.randomUUID(),
    commits: 0,
    outboundSequence: 0,
    trafficSequence: 0,
    trafficEvidence: [],
    trafficEvidenceOverflow: 0,
    sockets: [], socketSequence:0, fetchRecords:[],
  };
  const state = window.__chatArchSustained;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async (...args)=>{
    const caller=new Error().stack;
    const response=await nativeFetch(...args);
    state.fetchRecords.push({url:response.url,status:response.status,at:performance.now(),caller});
    if(state.fetchRecords.length>128)state.fetchRecords.shift();
    return response;
  };
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
    const type = decodeType(value);
    if (direction === 'inbound' && type === 'content') {
      state.contentFrames = (state.contentFrames || 0) + 1;
      state.lastContentAt = performance.now();
    }
    if (state.bootstrapComplete) return;
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
      this.__fixtureId=++state.socketSequence;
      state.sockets.push(this);
      this.addEventListener('close', () => { state.sockets = state.sockets.filter(socket => socket !== this); });
      this.addEventListener('message', (event) => {
        const type=decodeType(event.data);if(type==='connected')this.__fixtureAuthenticated=true;
        recordTraffic('inbound',event.data);
      });
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


export async function waitForScreenshotBootstrapQuiescence(page) {
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
        documentId: state.documentId ?? null,
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
      await page.evaluate(() => { window.__chatArchSustained.bootstrapComplete = true; });
      return {
        requiredLifecycle: ['screenshot:capture', 'screenshot:updated', 'screenshot:request', 'screenshot:data'],
        quietMs,
        documentId: observation.documentId,
        finalTrafficSequence: observation.sequence,
        lifecycle: observation.lifecycle,
      };
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`screenshot bootstrap did not quiesce: ${JSON.stringify(lastObservation)}`);
}


export async function takePreciseCoverage(page, action, targetNames) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  try {
    const value = await action();
    await page.waitForTimeout(100);
    const coverage = await cdp.send('Profiler.takePreciseCoverage');
    return { value, summary: summarizePreciseCoverage(coverage.result, targetNames) };
  } finally {
    await cdp.send('Profiler.stopPreciseCoverage').catch(() => {});
    await cdp.send('Profiler.disable').catch(() => {});
    await cdp.detach().catch(() => {});
  }
}


export async function installMeasurement(page) {
  await page.evaluate((outboundEvidenceLimit) => {
    stateCleanup();
    function stateCleanup() { window.__chatArchSustained.cleanupMeasurement?.(); }
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


export async function readMeasurement(page) {
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
