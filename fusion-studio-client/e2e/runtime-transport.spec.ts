import { expect, test } from '@playwright/test';
import {
  createRuntimeTransport,
  validateRuntimeDescriptor,
} from '../src/lib/runtime-transport';
import { fetchPanelFile } from '../src/lib/panels';
import {
  abandonWsResponseTracking,
  handleMessage,
  onFusionResponse,
  redactMessageForLog,
} from '../src/lib/ws-client';
import { requestChatTurnDiagnostic } from '../src/lib/ws/chat-diagnostic-handlers';
import { usePanelStore } from '../src/state/panelStore';
import { useFileDataStore } from '../src/state/fileDataStore';

const first = Object.freeze({
  generation: 'generation_000001',
  httpOrigin: 'http://127.0.0.1:41001',
  webSocketUrl: 'ws://127.0.0.1:41001',
});
const second = Object.freeze({
  generation: 'generation_000002',
  httpOrigin: 'http://127.0.0.1:41002',
  webSocketUrl: 'ws://127.0.0.1:41002',
});

class FakeSocket extends EventTarget {
  closeCount = 0;
  readyState = WebSocket.OPEN;
  send() {}
  close() {
    this.closeCount += 1;
    this.dispatchEvent(new Event('close'));
  }
}

function createHarness(initial: unknown = first) {
  let onChange: ((value: unknown) => void) | null = null;
  const urls: string[] = [];
  const sockets: FakeSocket[] = [];
  const pendingSignals: AbortSignal[] = [];
  const transport = createRuntimeTransport({
    getElectronApi: () => ({
      getRuntimeDescriptor: async () => initial,
      onRuntimeDescriptorChanged(callback) { onChange = callback; return () => { onChange = null; }; },
    }),
    createWebSocket(url) {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    fetch: ((input: URL | RequestInfo, init?: RequestInit) => {
      urls.push(String(input));
      const signal = init?.signal;
      if (!signal) throw new Error('generation signal missing');
      pendingSignals.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }) as typeof fetch,
  });
  return {
    transport,
    urls,
    sockets,
    pendingSignals,
    change: (value: unknown) => onChange?.(value),
  };
}

test('validates the exact closed runtime descriptor contract', () => {
  expect(validateRuntimeDescriptor(first)).toEqual(first);
  let getterCalls = 0;
  const accessorDescriptor = { ...first } as Record<string, unknown>;
  Object.defineProperty(accessorDescriptor, 'generation', {
    enumerable: true,
    get() { getterCalls += 1; return first.generation; },
  });
  const symbolDescriptor = { ...first, [Symbol('extra')]: true };
  const invalid = [
    null,
    [],
    { ...first, extra: true },
    { ...first, generation: 'short' },
    { ...first, httpOrigin: 'http://localhost:41001' },
    { ...first, httpOrigin: 'https://127.0.0.1:41001' },
    { ...first, httpOrigin: 'http://127.0.0.1:41002' },
    { ...first, httpOrigin: 'http://127.0.0.1:41001/' },
    { ...first, webSocketUrl: 'ws://127.0.0.1:41001/socket' },
    { ...first, webSocketUrl: 'ws://127.0.0.1:41001?query=1' },
    { ...first, webSocketUrl: 'ws://user@127.0.0.1:41001' },
    { ...first, webSocketUrl: 'wss://127.0.0.1:41001' },
    accessorDescriptor,
    symbolDescriptor,
  ];
  for (const value of invalid) expect(validateRuntimeDescriptor(value)).toBeNull();
  expect(getterCalls).toBe(0);
});

test('ordinary inbound application frames expose only type to renderer diagnostics', () => {
  const frame = {
    type: 'thread:opened',
    threadId: 'THREAD_CANARY_00B',
    history: [{ role: 'user', content: 'PROMPT_PROOF_NONCE_CANARY_00B' }],
    payload: {
      generation: 'GENERATION_CANARY_00B',
      serverNonce: 'SERVER_NONCE_CANARY_00B',
    },
  };
  expect(redactMessageForLog(frame)).toEqual({ type: 'thread:opened' });
  expect(JSON.stringify(redactMessageForLog(frame))).not.toContain('CANARY_00B');
});

test('downstream renderer diagnostics cannot serialize echoed WebSocket fields', () => {
  const canary = 'ECHOED_DOCUMENT_PROOF_NONCE_CANARY_00B';
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    handleMessage({
      type: 'office:thumbnail_error',
      documentPath: canary,
      error: canary,
    });
  } finally {
    console.warn = originalWarn;
  }
  expect(warnings).toEqual([['[WS] handler_warning']]);
  expect(JSON.stringify(warnings)).not.toContain(canary);
});

test('owns socket, HTTP, and resource endpoints without a page-origin fallback', async () => {
  const fixture = createHarness();
  await fixture.transport.start();
  expect(fixture.transport.getSnapshot()).toEqual({ status: 'ready', descriptor: first });
  expect(fixture.transport.serverResourceUrl('/api/panel-file/view/file.png?v=1'))
    .toBe('http://127.0.0.1:41001/api/panel-file/view/file.png?v=1');
  expect(() => fixture.transport.serverResourceUrl('//example.com/file')).toThrow(/active runtime origin/);
  fixture.transport.createWebSocket();
  const pending = fixture.transport.fetchServer('/api/harnesses');
  expect(fixture.urls).toEqual([
    'ws://127.0.0.1:41001',
    'http://127.0.0.1:41001/api/harnesses',
  ]);

  fixture.change(second);
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fixture.pendingSignals[0].aborted).toBe(true);
  expect(fixture.sockets[0].closeCount).toBe(1);
  expect(fixture.transport.getSnapshot()).toEqual({ status: 'ready', descriptor: second });
});

test('publishes one transition per generation and fails disconnected on malformed updates', async () => {
  const fixture = createHarness();
  const snapshots: string[] = [];
  fixture.transport.subscribe(() => snapshots.push(fixture.transport.getSnapshot().status));
  await fixture.transport.start();
  fixture.change(first);
  fixture.change(second);
  fixture.change({ ...second, httpOrigin: 'http://localhost:41002' });
  expect(snapshots).toEqual(['ready', 'ready', 'disconnected']);
  expect(fixture.transport.getSnapshot()).toEqual({ status: 'disconnected', descriptor: null });
  expect(() => fixture.transport.createWebSocket()).toThrow(/disconnected/);
  await expect(fixture.transport.fetchServer('/api/harnesses')).rejects.toThrow(/disconnected/);
});

test('rotation aborts a response body after headers before stale data can resolve', async () => {
  let onChange: ((value: unknown) => void) | null = null;
  let bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const transport = createRuntimeTransport({
    getElectronApi: () => ({
      getRuntimeDescriptor: async () => first,
      onRuntimeDescriptorChanged(callback) { onChange = callback; return () => { onChange = null; }; },
    }),
    createWebSocket: () => new FakeSocket() as unknown as WebSocket,
    fetch: (async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { bodyController = controller; },
    }))) as typeof fetch,
  });
  await transport.start();
  const response = await transport.fetchServer('/api/delayed');
  const body = response.text();
  onChange?.(second);
  await expect(body).rejects.toMatchObject({ name: 'AbortError' });
  expect(() => bodyController?.enqueue(new TextEncoder().encode('stale'))).toThrow();
});

test('rotation suppresses queued events from the retired native socket', async () => {
  const fixture = createHarness();
  await fixture.transport.start();
  const socket = fixture.transport.createWebSocket();
  const nativeSocket = fixture.sockets[0] as FakeSocket & {
    onopen?: (event: Event) => void;
    onmessage?: (event: Event) => void;
  };
  let propertyDeliveries = 0;
  let listenerDeliveries = 0;
  socket.onopen = () => { propertyDeliveries += 1; };
  socket.onmessage = () => { propertyDeliveries += 1; };
  socket.addEventListener('message', () => { listenerDeliveries += 1; });

  nativeSocket.onopen?.(new Event('open'));
  nativeSocket.dispatchEvent(new Event('message'));
  expect(propertyDeliveries).toBe(1);
  expect(listenerDeliveries).toBe(1);

  fixture.change(second);
  nativeSocket.onopen?.(new Event('open'));
  nativeSocket.onmessage?.(new Event('message'));
  nativeSocket.dispatchEvent(new Event('message'));
  expect(propertyDeliveries).toBe(1);
  expect(listenerDeliveries).toBe(1);
  expect(socket.readyState).toBe(WebSocket.CLOSED);
});

test('rotation rejects socket-bound panel requests instead of leaving response listeners alive', async () => {
  const fixture = createHarness();
  await fixture.transport.start();
  const socket = fixture.transport.createWebSocket();
  const pending = fetchPanelFile(socket, '__panels__', 'example/index.json');
  fixture.change(second);
  await expect(pending).rejects.toThrow(/Connection retired/);
});

test('retiring response trackers removes generation-bound Fusion listeners', () => {
  let deliveries = 0;
  let retirements = 0;
  onFusionResponse('clipboard:list', () => { deliveries += 1; }, () => { retirements += 1; });
  abandonWsResponseTracking();
  handleMessage({ type: 'clipboard:list', items: [], total: 0 });
  expect(retirements).toBe(1);
  expect(deliveries).toBe(0);
});

test('retiring response trackers settles diagnostic requests immediately', async () => {
  const socket = new FakeSocket() as unknown as WebSocket;
  usePanelStore.setState({ ws: socket });
  const pending = requestChatTurnDiagnostic({
    threadId: 'thread-1',
    turnId: 'turn-1',
    diagnosticId: 'diagnostic-12345678',
  });
  abandonWsResponseTracking();
  await expect(pending).resolves.toBeNull();
  usePanelStore.setState({ ws: null });
});

test('file connection retirement clears tree and content correlations synchronously', () => {
  const generation = useFileDataStore.getState().generation;
  useFileDataStore.setState({
    pendingTrees: new Map([['file-viewer:', { requestId: 'tree-old' } as never]]),
    pendingContents: new Map([['file-viewer:old.md', { requestId: 'content-old' } as never]]),
  });
  useFileDataStore.getState().retireConnectionGeneration();
  const retired = useFileDataStore.getState();
  expect(retired.generation).toBe(generation + 1);
  expect(retired.pendingTrees.size).toBe(0);
  expect(retired.pendingContents.size).toBe(0);
});

test('fails disconnected when preload runtime authority is unavailable', async () => {
  const transport = createRuntimeTransport({
    getElectronApi: () => undefined,
    createWebSocket: () => { throw new Error('must not connect'); },
    fetch,
  });
  await transport.start();
  expect(transport.getSnapshot()).toEqual({ status: 'disconnected', descriptor: null });
});
