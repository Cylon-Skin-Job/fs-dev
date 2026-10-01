export function observerBootstrap() {
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


