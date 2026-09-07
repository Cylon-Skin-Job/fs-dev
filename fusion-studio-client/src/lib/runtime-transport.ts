import type { FusionRuntimeDescriptor } from '../types/electron';

export type RuntimeTransportStatus = 'initializing' | 'ready' | 'disconnected';

export interface RuntimeTransportSnapshot {
  status: RuntimeTransportStatus;
  descriptor: FusionRuntimeDescriptor | null;
}

interface RuntimeElectronApi {
  getRuntimeDescriptor: () => Promise<unknown>;
  onRuntimeDescriptorChanged: (callback: (descriptor: unknown) => void) => (() => void);
}

interface RuntimeTransportDependencies {
  getElectronApi: () => RuntimeElectronApi | undefined;
  createWebSocket: (url: string) => WebSocket;
  fetch: typeof globalThis.fetch;
}

const DESCRIPTOR_KEYS = ['generation', 'httpOrigin', 'webSocketUrl'] as const;
const SORTED_DESCRIPTOR_KEYS = [...DESCRIPTOR_KEYS].sort();
const GENERATION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateRuntimeDescriptor(value: unknown): FusionRuntimeDescriptor | null {
  try {
    if (!isPlainRecord(value)) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (!ownKeys.every((key): key is string => typeof key === 'string')) return null;
    const keys = ownKeys.sort();
    if (keys.length !== DESCRIPTOR_KEYS.length) return null;
    if (!SORTED_DESCRIPTOR_KEYS.every((expected, index) => keys[index] === expected)) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (!DESCRIPTOR_KEYS.every((key) => {
      const descriptor = descriptors[key];
      return descriptor && descriptor.enumerable && 'value' in descriptor;
    })) return null;
    const generation = descriptors.generation.value;
    const httpOrigin = descriptors.httpOrigin.value;
    const webSocketUrl = descriptors.webSocketUrl.value;
    if (typeof generation !== 'string' || !GENERATION_PATTERN.test(generation)) return null;
    if (typeof httpOrigin !== 'string' || typeof webSocketUrl !== 'string') return null;

    const http = new URL(httpOrigin);
    const socket = new URL(webSocketUrl);
    if (http.protocol !== 'http:' || socket.protocol !== 'ws:') return null;
    if (http.hostname !== '127.0.0.1' || socket.hostname !== '127.0.0.1') return null;
    if (!http.port || http.port !== socket.port) return null;
    const port = Number(http.port);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) return null;
    if (httpOrigin !== `http://127.0.0.1:${port}`) return null;
    if (webSocketUrl !== `ws://127.0.0.1:${port}`) return null;

    return Object.freeze({
      generation,
      httpOrigin: httpOrigin as FusionRuntimeDescriptor['httpOrigin'],
      webSocketUrl: webSocketUrl as FusionRuntimeDescriptor['webSocketUrl'],
    });
  } catch {
    return null;
  }
}

function sameDescriptor(left: FusionRuntimeDescriptor, right: FusionRuntimeDescriptor): boolean {
  return left.generation === right.generation
    && left.httpOrigin === right.httpOrigin
    && left.webSocketUrl === right.webSocketUrl;
}

function resolveServerPath(descriptor: FusionRuntimeDescriptor, path: string): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('#')) {
    throw new TypeError('Server path must be an absolute path on the active runtime origin');
  }
  const url = new URL(path, descriptor.httpOrigin);
  if (url.origin !== descriptor.httpOrigin || url.username || url.password) {
    throw new TypeError('Server path escaped the active runtime origin');
  }
  return url.toString();
}

function createAbortError(): DOMException {
  return new DOMException('The runtime generation was retired', 'AbortError');
}

const WEB_SOCKET_EVENT_HANDLERS = new Set<PropertyKey>([
  'onopen',
  'onmessage',
  'onclose',
  'onerror',
]);

/**
 * Keep the native socket private and expose a generation-gated facade. Closing
 * a WebSocket does not revoke already queued native events, so merely closing
 * it during a server restart is insufficient: an old message can otherwise
 * reach any component listener after the new generation is active.
 */
function bindWebSocketToGeneration(socket: WebSocket, signal: AbortSignal): WebSocket {
  const listenerWrappers = new WeakMap<EventListenerOrEventListenerObject, Map<string, EventListener>>();
  const handlerWrappers = new Map<PropertyKey, EventListener | null>();
  let active = true;

  const invoke = (listener: EventListenerOrEventListenerObject, event: Event) => {
    if (!active) return;
    if (typeof listener === 'function') listener.call(facade, event);
    else listener.handleEvent(event);
  };

  const facade = new Proxy(socket, {
    get(target, property) {
      if (property === 'readyState' && !active) return WebSocket.CLOSED;
      if (property === 'addEventListener') {
        return (type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) => {
          if (!listener) return;
          let byType = listenerWrappers.get(listener);
          if (!byType) {
            byType = new Map();
            listenerWrappers.set(listener, byType);
          }
          let wrapped = byType.get(type);
          if (!wrapped) {
            wrapped = (event) => invoke(listener, event);
            byType.set(type, wrapped);
          }
          target.addEventListener(type, wrapped, options);
        };
      }
      if (property === 'removeEventListener') {
        return (type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) => {
          if (!listener) return;
          const wrapped = listenerWrappers.get(listener)?.get(type);
          if (wrapped) target.removeEventListener(type, wrapped, options);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (!WEB_SOCKET_EVENT_HANDLERS.has(property)) {
        return Reflect.set(target, property, value, target);
      }
      const handler = typeof value === 'function'
        ? ((event: Event) => {
            if (active) value.call(facade, event);
          })
        : null;
      handlerWrappers.set(property, handler);
      return Reflect.set(target, property, handler, target);
    },
  });

  signal.addEventListener('abort', () => {
    if (!active) return;
    // Deliver one synchronous close while this generation is still active so
    // request owners can cancel timers/promises. Any native close or already
    // queued message delivered afterward is suppressed by the facade.
    socket.dispatchEvent(new Event('close'));
    active = false;
  }, { once: true });

  return facade;
}

function bindResponseBodyToGeneration(
  response: Response,
  signal: AbortSignal,
  release: () => void,
): Response {
  if (!response.body) {
    release();
    return response;
  }

  const reader = response.body.getReader();
  let settled = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const finish = () => {
    if (settled) return false;
    settled = true;
    signal.removeEventListener('abort', abort);
    release();
    return true;
  };
  const abort = () => {
    if (!finish()) return;
    const error = createAbortError();
    void reader.cancel(error).catch(() => {});
    streamController?.error(error);
  };

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      if (settled) return;
      try {
        const chunk = await reader.read();
        if (settled) return;
        if (chunk.done) {
          finish();
          controller.close();
        } else {
          controller.enqueue(chunk.value);
        }
      } catch (error) {
        if (!finish()) return;
        controller.error(error);
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function createRuntimeTransport(dependencies: RuntimeTransportDependencies) {
  let snapshot: RuntimeTransportSnapshot = Object.freeze({ status: 'initializing', descriptor: null });
  let generationAbortController = new AbortController();
  let startPromise: Promise<void> | null = null;
  let descriptorRevision = 0;
  const listeners = new Set<() => void>();
  const sockets = new Set<WebSocket>();

  const publish = (status: RuntimeTransportStatus, descriptor: FusionRuntimeDescriptor | null) => {
    snapshot = Object.freeze({ status, descriptor });
    for (const listener of listeners) listener();
  };

  const retireGeneration = () => {
    const retiredSockets = [...sockets];
    sockets.clear();
    generationAbortController.abort();
    generationAbortController = new AbortController();
    for (const socket of retiredSockets) socket.close();
  };

  const acceptDescriptor = (candidate: unknown) => {
    descriptorRevision += 1;
    const descriptor = validateRuntimeDescriptor(candidate);
    if (!descriptor) {
      retireGeneration();
      publish('disconnected', null);
      return;
    }
    if (snapshot.descriptor?.generation === descriptor.generation) {
      if (!sameDescriptor(snapshot.descriptor, descriptor)) {
        retireGeneration();
        publish('disconnected', null);
      }
      return;
    }
    retireGeneration();
    publish('ready', descriptor);
  };

  const requireDescriptor = () => {
    if (snapshot.status !== 'ready' || !snapshot.descriptor) {
      throw new Error('Fusion runtime is disconnected');
    }
    return snapshot.descriptor;
  };

  return Object.freeze({
    start(): Promise<void> {
      if (startPromise) return startPromise;
      startPromise = (async () => {
        const api = dependencies.getElectronApi();
        if (!api?.getRuntimeDescriptor || !api?.onRuntimeDescriptorChanged) {
          acceptDescriptor(null);
          return;
        }
        const requestRevision = descriptorRevision;
        api.onRuntimeDescriptorChanged(acceptDescriptor);
        let descriptor: unknown = null;
        try {
          descriptor = await api.getRuntimeDescriptor();
        } catch {
          descriptor = null;
        }
        if (descriptorRevision === requestRevision) acceptDescriptor(descriptor);
      })();
      return startPromise;
    },
    getSnapshot(): RuntimeTransportSnapshot {
      return snapshot;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createWebSocket(): WebSocket {
      const socket = bindWebSocketToGeneration(
        dependencies.createWebSocket(requireDescriptor().webSocketUrl),
        generationAbortController.signal,
      );
      sockets.add(socket);
      socket.addEventListener('close', () => sockets.delete(socket), { once: true });
      return socket;
    },
    serverResourceUrl(path: string): string {
      return resolveServerPath(requireDescriptor(), path);
    },
    async fetchServer(path: string, init: RequestInit = {}): Promise<Response> {
      const descriptor = requireDescriptor();
      const url = resolveServerPath(descriptor, path);
      const requestController = new AbortController();
      const generationSignal = generationAbortController.signal;
      const callerSignal = init.signal;
      const abort = () => requestController.abort();
      generationSignal.addEventListener('abort', abort, { once: true });
      callerSignal?.addEventListener('abort', abort, { once: true });
      if (generationSignal.aborted || callerSignal?.aborted) abort();
      const release = () => {
        generationSignal.removeEventListener('abort', abort);
        callerSignal?.removeEventListener('abort', abort);
      };
      try {
        const response = await dependencies.fetch(url, { ...init, signal: requestController.signal });
        return bindResponseBodyToGeneration(response, requestController.signal, release);
      } catch (error) {
        release();
        throw error;
      }
    },
  });
}

export const runtimeTransport = createRuntimeTransport({
  getElectronApi: () => window.electronAPI,
  createWebSocket: (url) => new WebSocket(url),
  fetch: (input, init) => globalThis.fetch(input, init),
});

export const startRuntimeTransport = () => runtimeTransport.start();
export const getRuntimeTransportSnapshot = () => runtimeTransport.getSnapshot();
export const subscribeRuntimeTransport = (listener: () => void) => runtimeTransport.subscribe(listener);
export const createServerWebSocket = () => runtimeTransport.createWebSocket();
export const getServerResourceUrl = (path: string) => runtimeTransport.serverResourceUrl(path);
export const fetchServer = (path: string, init?: RequestInit) => runtimeTransport.fetchServer(path, init);
