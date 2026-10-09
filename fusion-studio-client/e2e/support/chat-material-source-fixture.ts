/** Controlled transport/native source responses; production source APIs and consumers stay real. */
import { connectWs } from '../../src/lib/ws-client';
import { usePanelStore } from '../../src/state/panelStore';

export async function installMaterialSources(sendProduct: (value: string) => void) {
  const reads: Record<string, number> = {}, holds = new Set<string>(), pending: { kind: string; done: () => void }[] = [];
  const count = (kind: string) => { reads[kind] = (reads[kind] ?? 0) + 1; };
  const defer = (kind: string, done: () => void) => {
    if (holds.has(kind)) pending.push({ kind, done }); else queueMicrotask(done);
  };
  const emit = (data: unknown) => raw.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  const native = window.WebSocket;
  let raw: FixtureSocket;
  let cameraMode = 'normal', saveMode = 'normal';
  const listeners = { message: new Set<any>(), close: new Set<any>() };
  const cameraResolvers: ((value: string | null) => void)[] = [];
  class FixtureSocket extends EventTarget {
    static OPEN = native.OPEN; static CLOSED = native.CLOSED; static CONNECTING = native.CONNECTING; static CLOSING = native.CLOSING;
    readyState = native.OPEN; bufferedAmount = 0;
    constructor() {
      super(); raw = this;
      queueMicrotask(() => {
        this.dispatchEvent(new Event('open'));
        const now = Date.now();
        emit({ type: 'shell-auth:challenge', version: 1, connectionId: 'material-connection', serverNonce: 'n'.repeat(43),
          generation: 'material_fixture_generation', issuedAt: now, expiresAt: now + 30000 });
      });
    }
    addEventListener(type: string, listener: any, options?: any) {
      if (type === 'message' || type === 'close') listeners[type].add(listener);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type: string, listener: any, options?: any) {
      if (type === 'message' || type === 'close') listeners[type].delete(listener);
      super.removeEventListener(type, listener, options);
    }
    dispatchEvent(event: Event) {
      const dispatched = super.dispatchEvent(event);
      const handler = (this as any)[`on${event.type}`];
      if (typeof handler === 'function') handler.call(this, event);
      return dispatched;
    }
    close() { this.readyState = native.CLOSED; this.dispatchEvent(new Event('close')); }
    send(value: string) {
      const f = JSON.parse(value);
      if (f.type === 'shell-auth:proof') { queueMicrotask(() => emit({ type: 'shell-auth:authenticated', version: 1 })); return; }
      sendProduct(value);
      if (f.type === 'screenshot:file-capture') { count('screenshot-save'); if (saveMode === 'throw') throw new Error('owned send throw'); }
      if (f.type === 'clipboard:list') {
        count('clipboard-list'); defer('clipboard-list', () => emit({ type: 'clipboard:list', items: [clipboard(1), clipboard(2)], total: 2 }));
      }
      if (f.type === 'clipboard:use') {
        count('clipboard-use'); defer(`clipboard-use-${f.id}`, () => emit({ type: 'clipboard:use', id: f.id, value: `CLIPBOARD ${f.id}` }));
      }
      if (f.type === 'recent_files_request') {
        count('recent'); defer('recent', () => emit({ type: 'recent_files_response', panel: f.panel, success: true,
          files: [{ name: 'recent.ts', path: '/source/recent.ts', mtime: 100, size: 1024 }] }));
      }
      if (f.type === 'chat-turn:diagnostic:get') {
        count('diagnostic'); defer('diagnostic', () => emit({ ...f, type: 'chat-turn:diagnostic:report', report: {
          version: 1, harnessId: 'opencode', category: 'runtime', message: 'SAFE REDACTED DETAIL',
          hadRenderableOutput: false, hadToolCalls: false, truncatedFields: [] } }));
      }
    }
  }
  const clipboard = (id: number) => ({ id, type: 'text', preview: `Clipboard row ${id}`, source: 'fixture', last_used_at: id, created_at: id });
  Object.defineProperty(window, 'WebSocket', { configurable: true, value: FixtureSocket });
  const sourceFetch: typeof fetch = async (url, options) => {
    const pathname = new URL(String(url), location.href).pathname;
    if (pathname === '/api/transcribe') {
      count('transcribe');
      return new Promise<Response>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => { count('transcribe-abort'); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
        defer('transcribe', () => resolve(new Response(JSON.stringify({ success: true, text: 'MIC TRANSCRIPT' }), { status: 200 })));
      });
    }
    return new Response(JSON.stringify({ success: true, items: [] }), { status: 200 });
  };
  Object.defineProperty(window, 'fetch', { configurable: true, value: sourceFetch });
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    getRuntimeDescriptor: async () => ({ generation: 'material_fixture_generation', httpOrigin: 'http://127.0.0.1:43177', webSocketUrl: 'ws://127.0.0.1:43177' }),
    onRuntimeDescriptorChanged: () => () => {},
    authorizeShellChallenge: async (challenge: any, rendererNonce: string) => ({ type: 'shell-auth:proof', version: 1, connectionId: challenge.connectionId, serverNonce: challenge.serverNonce, generation: challenge.generation, expiresAt: challenge.expiresAt, rendererNonce, proof: 'p'.repeat(43) }),
    capturePage: async () => {
      count('capture');
      if (cameraMode === 'error') throw new Error('owned capture failure');
      if (cameraMode === 'empty') return null;
      return new Promise<string | null>(resolve => cameraResolvers.push(resolve));
    },
    listScreenshots: async () => { count('gallery'); return [{ name: 'gallery.png', path: '/source/Data/Screenshots/gallery.png' }]; },
    readScreenshot: async () => ({ base64: '', mimeType: 'image/png' }),
  } });
  const stream = () => ({ getTracks: () => [{ stop: () => count('track-stop') }] }) as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async () => { count('permission'); return new Promise<MediaStream>(resolve => defer('permission', () => resolve(stream()))); },
    enumerateDevices: async () => [],
  } });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: 'granted' }) } });
  class Recorder {
    static isTypeSupported = () => true;
    state = 'inactive'; onstop?: () => void; ondataavailable?: (event: { data: Blob }) => void;
    start() { this.state = 'recording'; count('recorder-start'); }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['x'.repeat(2048)]) }); queueMicrotask(() => this.onstop?.()); }
  }
  Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: Recorder });
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: class {
    state = 'running'; close = async () => {}; resume = async () => {};
    createMediaStreamSource = () => ({ connect: () => {} });
    createAnalyser = () => ({ fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 32, getByteFrequencyData: () => {} });
  } });
  connectWs();
  await new Promise<void>((resolve) => {
    const ready = () => { if (usePanelStore.getState().ws) resolve(); else setTimeout(ready, 0); }; ready();
  });
  return { socket: usePanelStore.getState().ws!, reads,
    hold: (kind: string) => holds.add(kind),
    release: (kind: string) => { holds.delete(kind); pending.filter(item => item.kind === kind).forEach(item => { pending.splice(pending.indexOf(item), 1); item.done(); }); },
    pending: () => pending.map(item => item.kind),
    emit,
    camera: { mode: (value: string) => { cameraMode = value; if (value === 'unsupported') delete (window.electronAPI as any).capturePage; },
      finish: (index = 0) => cameraResolvers.splice(index, 1)[0]?.('fixture-png-base64'),
      saveMode: (value: string) => { saveMode = value; },
      disconnect: () => raw.close(), listeners: () => ({ message: listeners.message.size, close: listeners.close.size }) },
  };
}
