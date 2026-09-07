import type { BrowserContext } from '@playwright/test';

/**
 * Give browser-only production-App fixtures the runtime surface normally
 * supplied by Electron. Authentication stays inside this test-owned socket
 * adapter; no product request field or server/renderer seam gains authority.
 */
export async function installTrustedShellBrowserFixture(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const descriptor = Object.freeze({
      generation: 'provfixture000001',
      httpOrigin: `http://127.0.0.1:${window.location.port}`,
      webSocketUrl: `ws://127.0.0.1:${window.location.port}`,
    });
    const NativeWebSocket = window.WebSocket;

    class AuthenticatedFixtureWebSocket extends EventTarget {
      static readonly CONNECTING = NativeWebSocket.CONNECTING;
      static readonly OPEN = NativeWebSocket.OPEN;
      static readonly CLOSING = NativeWebSocket.CLOSING;
      static readonly CLOSED = NativeWebSocket.CLOSED;

      readonly CONNECTING = NativeWebSocket.CONNECTING;
      readonly OPEN = NativeWebSocket.OPEN;
      readonly CLOSING = NativeWebSocket.CLOSING;
      readonly CLOSED = NativeWebSocket.CLOSED;
      onopen: ((event: Event) => unknown) | null = null;
      onmessage: ((event: MessageEvent) => unknown) | null = null;
      onclose: ((event: CloseEvent) => unknown) | null = null;
      onerror: ((event: Event) => unknown) | null = null;
      private readonly nativeSocket: WebSocket;
      private authenticated = false;
      private proofSeen = false;
      private readonly bufferedMessages: MessageEvent[] = [];

      constructor(url: string | URL, protocols?: string | string[]) {
        super();
        this.nativeSocket = protocols === undefined
          ? new NativeWebSocket(url)
          : new NativeWebSocket(url, protocols);
        this.nativeSocket.addEventListener('open', () => {
          const event = new Event('open');
          this.emitEvent(event);
          queueMicrotask(() => this.emitMessage(JSON.stringify({
            type: 'shell-auth:challenge',
            version: 1,
            connectionId: 'provfixtureconnection000001',
            serverNonce: 'S'.repeat(43),
            generation: descriptor.generation,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 10_000,
          })));
        });
        this.nativeSocket.addEventListener('message', (event) => {
          const copy = new MessageEvent('message', { data: event.data });
          if (this.authenticated) this.emitEvent(copy);
          else {
            this.bufferedMessages.push(copy);
            if (this.proofSeen && this.isFinalBootstrapFrame(event.data)) this.finishAuthentication();
          }
        });
        this.nativeSocket.addEventListener('close', (event) => {
          this.emitEvent(new CloseEvent('close', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          }));
        });
        this.nativeSocket.addEventListener('error', () => {
          this.emitEvent(new Event('error'));
        });
      }

      dispatchEvent(event: Event) {
        const dispatched = super.dispatchEvent(event);
        // Browser WebSocket event-handler properties participate in normal
        // EventTarget ordering. Reproduce that behavior so provenance tests
        // can inject frames with dispatchEvent and an earlier observer can
        // stop a held response before the application onmessage callback.
        if (!event.cancelBubble) {
          if (event.type === 'open') this.onopen?.call(this, event);
          else if (event.type === 'message') this.onmessage?.call(this, event as MessageEvent);
          else if (event.type === 'close') this.onclose?.call(this, event as CloseEvent);
          else if (event.type === 'error') this.onerror?.call(this, event);
        }
        return dispatched;
      }

      private emitEvent<T extends Event>(event: T) {
        this.dispatchEvent(event);
      }

      private emitMessage(data: string) {
        this.emitEvent(new MessageEvent('message', { data }));
      }

      private isFinalBootstrapFrame(data: unknown) {
        if (typeof data !== 'string') return false;
        try { return JSON.parse(data)?.type === 'panel_config'; } catch { return false; }
      }

      private finishAuthentication() {
        if (this.authenticated) return;
        this.authenticated = true;
        this.emitMessage(JSON.stringify({ type: 'shell-auth:authenticated', version: 1 }));
        for (const event of this.bufferedMessages.splice(0)) {
          this.emitEvent(event);
        }
      }

      get binaryType() { return this.nativeSocket.binaryType; }
      set binaryType(value) { this.nativeSocket.binaryType = value; }
      get bufferedAmount() { return this.nativeSocket.bufferedAmount; }
      get extensions() { return this.nativeSocket.extensions; }
      get protocol() { return this.nativeSocket.protocol; }
      get readyState() { return this.nativeSocket.readyState; }
      get url() { return this.nativeSocket.url; }

      close(code?: number, reason?: string) { this.nativeSocket.close(code, reason); }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed?.type === 'shell-auth:proof') {
              this.proofSeen = true;
              if (this.bufferedMessages.some((event) => this.isFinalBootstrapFrame(event.data))) {
                this.finishAuthentication();
              }
              return;
            }
          } catch {
            // Ordinary non-JSON frames still reach the fixture server.
          }
        }
        this.nativeSocket.send(data);
      }
    }

    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: AuthenticatedFixtureWebSocket,
    });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: Object.freeze({
        getRuntimeDescriptor: async () => descriptor,
        onRuntimeDescriptorChanged: () => () => {},
        authorizeShellChallenge: async (challenge: Record<string, unknown>, rendererNonce: string) => ({
          type: 'shell-auth:proof',
          version: 1,
          connectionId: challenge.connectionId,
          serverNonce: challenge.serverNonce,
          rendererNonce,
          generation: challenge.generation,
          expiresAt: challenge.expiresAt,
          proof: 'P'.repeat(43),
        }),
        setWorkspaceRoot: () => {},
      }),
    });
  });
}
