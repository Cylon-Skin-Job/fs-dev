import { expect, test } from '@playwright/test';
import { createShellSocketAuthenticator } from '../src/lib/shell-auth-client';

const generation = 'generation_auth_000001';
const serverNonce = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';
const rendererNonce = 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM';

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    type: 'shell-auth:challenge', version: 1,
    connectionId: 'connection_auth_000001', serverNonce, generation,
    issuedAt: 1_000, expiresAt: 11_000,
    ...overrides,
  };
}

function proof(value = challenge()) {
  return {
    type: 'shell-auth:proof', version: 1,
    connectionId: value.connectionId,
    serverNonce: value.serverNonce,
    rendererNonce,
    generation: value.generation,
    expiresAt: value.expiresAt,
    proof: 'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ',
  };
}

function harness(api: ((value: ReturnType<typeof challenge>, nonce: string) => Promise<unknown>) | null = async (value) => proof(value)) {
  const sent: Record<string, unknown>[] = [];
  const delivered: unknown[] = [];
  const order: string[] = [];
  let closes = 0;
  const authenticator = createShellSocketAuthenticator({
    generation,
    electronApi: api ? { authorizeShellChallenge: api } : undefined,
    send: (value) => { sent.push(JSON.parse(value)); },
    close: () => { closes += 1; },
    authenticated: () => { order.push('authenticated'); },
    deliver: (value) => { order.push('deliver'); delivered.push(value); },
    now: () => 2_000,
    randomBytes: () => new Uint8Array(32).fill(3),
  });
  return { authenticator, sent, delivered, order, closes: () => closes };
}

test('authenticates before releasing buffered initialization frames', async () => {
  const fixture = harness();
  await fixture.authenticator.receive(challenge());
  expect(fixture.sent).toEqual([proof()]);
  await fixture.authenticator.receive({ type: 'connected', connectionId: 'connection_auth_000001' });
  await fixture.authenticator.receive({ type: 'workspace:init', workspaces: [] });
  expect(fixture.delivered).toEqual([]);
  await fixture.authenticator.receive({ type: 'shell-auth:authenticated', version: 1 });
  expect(fixture.order).toEqual(['authenticated', 'deliver', 'deliver']);
  expect(fixture.authenticator.isAuthenticated()).toBe(true);
});

test('rejects missing preload authority and never sends a proof', async () => {
  const fixture = harness(null);
  await fixture.authenticator.receive(challenge());
  expect(fixture.sent).toEqual([]);
  expect(fixture.closes()).toBe(1);
});

for (const [label, value] of [
  ['stale generation', challenge({ generation: 'generation_auth_000002' })],
  ['expired challenge', challenge({ expiresAt: 2_000 })],
  ['delegated field', challenge({ role: 'trusted-shell' })],
  ['malformed nonce', challenge({ serverNonce: 'short' })],
] as const) {
  test(`rejects ${label} before invoking preload`, async () => {
    let calls = 0;
    const fixture = harness(async () => { calls += 1; return proof(); });
    await fixture.authenticator.receive(value);
    expect(calls).toBe(0);
    expect(fixture.closes()).toBe(1);
  });
}

test('rejects a mismatched proof and a reordered second challenge', async () => {
  const mismatch = harness(async (value) => ({ ...proof(value), connectionId: 'connection_auth_000002' }));
  await mismatch.authenticator.receive(challenge());
  expect(mismatch.sent).toEqual([]);
  expect(mismatch.closes()).toBe(1);

  const reordered = harness();
  await reordered.authenticator.receive(challenge());
  await reordered.authenticator.receive(challenge({ connectionId: 'connection_auth_000002' }));
  expect(reordered.closes()).toBe(1);
});

test('retirement clears buffered frames without delivering or closing twice', async () => {
  const fixture = harness();
  await fixture.authenticator.receive(challenge());
  await fixture.authenticator.receive({ type: 'workspace:init', workspaces: [] });
  fixture.authenticator.retire();
  await fixture.authenticator.receive({ type: 'shell-auth:authenticated', version: 1 });
  expect(fixture.delivered).toEqual([]);
  expect(fixture.closes()).toBe(0);
});

test('product frames wait behind a delayed signer while proof keeps the authentication lane', async () => {
  let releaseProof: (() => void) | null = null;
  const fixture = harness((value) => new Promise((resolve) => {
    releaseProof = () => resolve(proof(value));
  }));
  const authenticating = fixture.authenticator.receive(challenge());

  expect(fixture.authenticator.sendProduct(JSON.stringify({
    type: 'clipboard:append', text: 'clipboard canary', source: 'auto',
  }))).toBe(true);
  expect(fixture.authenticator.sendProduct(JSON.stringify({ type: 'thread:list' }))).toBe(true);
  expect(fixture.sent).toEqual([]);

  await Promise.resolve();
  expect(releaseProof).not.toBeNull();
  releaseProof?.();
  await authenticating;
  expect(fixture.sent).toEqual([proof()]);
  await fixture.authenticator.receive({ type: 'shell-auth:authenticated', version: 1 });
  expect(fixture.sent).toEqual([
    proof(),
    { type: 'clipboard:append', text: 'clipboard canary', source: 'auto' },
    { type: 'thread:list' },
  ]);
});

test('retiring a delayed signer prevents its proof and queued products reaching a replacement', async () => {
  let releaseProof: (() => void) | null = null;
  const fixture = harness((value) => new Promise((resolve) => {
    releaseProof = () => resolve(proof(value));
  }));
  const authenticating = fixture.authenticator.receive(challenge());
  expect(fixture.authenticator.sendProduct(JSON.stringify({
    type: 'clipboard:append', text: 'old generation', source: 'auto',
  }))).toBe(true);

  fixture.authenticator.retire();
  releaseProof?.();
  await authenticating;
  expect(fixture.sent).toEqual([]);
  expect(fixture.closes()).toBe(0);
  expect(fixture.authenticator.isAuthenticated()).toBe(false);
});

test('activation failure closes and releases neither initialization nor queued products', async () => {
  const sent: Record<string, unknown>[] = [];
  const delivered: unknown[] = [];
  let closes = 0;
  const authenticator = createShellSocketAuthenticator({
    generation,
    electronApi: { authorizeShellChallenge: async (value) => proof(value) },
    send: (value) => { sent.push(JSON.parse(value)); },
    close: () => { closes += 1; },
    authenticated: () => { throw new Error('activation failed'); },
    deliver: (value) => { delivered.push(value); },
    now: () => 2_000,
    randomBytes: () => new Uint8Array(32).fill(3),
  });
  await authenticator.receive(challenge());
  await authenticator.receive({ type: 'workspace:init', workspaces: [] });
  expect(authenticator.sendProduct(JSON.stringify({ type: 'clipboard:append' }))).toBe(true);
  await authenticator.receive({ type: 'shell-auth:authenticated', version: 1 });
  expect(sent).toEqual([proof()]);
  expect(delivered).toEqual([]);
  expect(closes).toBe(1);
  expect(authenticator.isAuthenticated()).toBe(false);
});

test('retirement and authentication failure discard queued product frames', async () => {
  for (const failConnection of [
    async (fixture: ReturnType<typeof harness>) => fixture.authenticator.retire(),
    async (fixture: ReturnType<typeof harness>) => fixture.authenticator.receive(challenge({ generation: 'generation_auth_000002' })),
    async (fixture: ReturnType<typeof harness>) => fixture.authenticator.receive({ type: 'shell-auth:denied', version: 1 }),
  ]) {
    const fixture = harness();
    expect(fixture.authenticator.sendProduct(JSON.stringify({ type: 'clipboard:append' }))).toBe(true);
    await failConnection(fixture);
    await fixture.authenticator.receive({ type: 'shell-auth:authenticated', version: 1 });
    expect(fixture.sent).toEqual([]);
  }
});

test('outbound queue overflow closes once and never delays or emits a proof', async () => {
  const fixture = harness();
  for (let index = 0; index < 64; index += 1) {
    expect(fixture.authenticator.sendProduct(JSON.stringify({ type: 'queued', index }))).toBe(true);
  }
  expect(fixture.authenticator.sendProduct(JSON.stringify({ type: 'overflow' }))).toBe(false);
  expect(fixture.closes()).toBe(1);
  await fixture.authenticator.receive(challenge());
  await fixture.authenticator.receive({ type: 'shell-auth:authenticated', version: 1 });
  expect(fixture.sent).toEqual([]);

  const byteOverflow = harness();
  expect(byteOverflow.authenticator.sendProduct('x'.repeat(1_048_577))).toBe(false);
  expect(byteOverflow.closes()).toBe(1);
  expect(byteOverflow.sent).toEqual([]);
});

test('built renderer holds automatic clipboard traffic until authentication acknowledgement', async ({ page }) => {
  await page.addInitScript(() => {
    type RecordedFrame = Record<string, unknown> & { type: string };
    const recorded: RecordedFrame[] = [];
    Object.defineProperty(window, '__shellOutboundFrames', { value: recorded, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: async () => 'DELAYED_CLIPBOARD_CANARY_00B' },
    });
    localStorage.setItem('fusion.clipboard.monitor.enabled', 'true');

    class DelayedAuthSocket extends EventTarget {
      static readonly CONNECTING = WebSocket.CONNECTING;
      static readonly OPEN = WebSocket.OPEN;
      static readonly CLOSING = WebSocket.CLOSING;
      static readonly CLOSED = WebSocket.CLOSED;
      readonly CONNECTING = WebSocket.CONNECTING;
      readonly OPEN = WebSocket.OPEN;
      readonly CLOSING = WebSocket.CLOSING;
      readonly CLOSED = WebSocket.CLOSED;
      readyState = WebSocket.CONNECTING;
      bufferedAmount = 0;
      extensions = '';
      protocol = '';
      url: string;
      binaryType: BinaryType = 'blob';
      onopen: ((event: Event) => unknown) | null = null;
      onmessage: ((event: MessageEvent) => unknown) | null = null;
      onclose: ((event: CloseEvent) => unknown) | null = null;
      onerror: ((event: Event) => unknown) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        setTimeout(() => {
          this.readyState = WebSocket.OPEN;
          this.onopen?.(new Event('open'));
          const now = Date.now();
          this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({
            type: 'shell-auth:challenge', version: 1,
            connectionId: 'connection_auth_000001',
            serverNonce: 'S'.repeat(43), generation: 'generation_auth_000001',
            issuedAt: now, expiresAt: now + 10_000,
          }) }));
        });
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data !== 'string') throw new Error('Unexpected binary fixture frame');
        const frame = JSON.parse(data) as RecordedFrame;
        recorded.push(frame);
        if (frame.type === 'shell-auth:proof') {
          queueMicrotask(() => this.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({ type: 'shell-auth:authenticated', version: 1 }),
          })));
        }
      }

      close() {
        if (this.readyState === WebSocket.CLOSED) return;
        this.readyState = WebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
      }
    }

    Object.defineProperty(window, 'WebSocket', { configurable: true, value: DelayedAuthSocket });
    let releaseSigner: (() => void) | null = null;
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: Object.freeze({
        getRuntimeDescriptor: async () => ({
          generation: 'generation_auth_000001',
          httpOrigin: `http://127.0.0.1:${location.port}`,
          webSocketUrl: `ws://127.0.0.1:${location.port}`,
        }),
        onRuntimeDescriptorChanged: () => () => {},
        authorizeShellChallenge: (value: Record<string, unknown>, nonce: string) => new Promise((resolve) => {
          releaseSigner = () => resolve({
            type: 'shell-auth:proof', version: 1,
            connectionId: value.connectionId, serverNonce: value.serverNonce,
            rendererNonce: nonce, generation: value.generation,
            expiresAt: value.expiresAt, proof: 'P'.repeat(43),
          });
          Object.defineProperty(window, '__releaseShellSigner', { value: releaseSigner, configurable: true });
        }),
        setWorkspaceRoot: () => {},
      }),
    });
  });

  await page.goto('/');
  await page.waitForFunction(() => typeof (window as unknown as { __releaseShellSigner?: unknown }).__releaseShellSigner === 'function');
  await page.waitForTimeout(1_100);
  expect(await page.evaluate(() => (window as unknown as { __shellOutboundFrames: unknown[] }).__shellOutboundFrames)).toEqual([]);
  await page.evaluate(() => (window as unknown as { __releaseShellSigner: () => void }).__releaseShellSigner());
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __shellOutboundFrames: Array<{ type: string }> }
  ).__shellOutboundFrames.map((frame) => frame.type))).toContain('clipboard:append');
  const frames = await page.evaluate(() => (
    window as unknown as { __shellOutboundFrames: Array<Record<string, unknown>> }
  ).__shellOutboundFrames);
  expect(frames[0]?.type).toBe('shell-auth:proof');
  expect(frames.filter((frame) => frame.type === 'clipboard:append')).toEqual([{
    type: 'clipboard:append', text: 'DELAYED_CLIPBOARD_CANARY_00B', source: 'auto',
  }]);
});
