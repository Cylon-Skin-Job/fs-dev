import { expect, test } from '@playwright/test';
import { getEventListeners } from 'node:events';
import { loadIcon, getCachedIcon } from '../src/lib/icon-registry';
import { startRuntimeTransport } from '../src/lib/runtime-transport';

test('missing icon bodies release generation listeners while successful icons remain cached', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const addListener = AbortSignal.prototype.addEventListener;
  const signals = new Set<AbortSignal>();
  let canceled = 0;
  let successfulFetches = 0;
  AbortSignal.prototype.addEventListener = function(type, listener, options) {
    if (type === 'abort') signals.add(this);
    return addListener.call(this, type, listener, options);
  };
  globalThis.window = { electronAPI: {
    getRuntimeDescriptor: async () => ({ generation: 'icon_generation_001', httpOrigin: 'http://127.0.0.1:41001', webSocketUrl: 'ws://127.0.0.1:41001' }),
    onRuntimeDescriptorChanged: () => () => {},
  } } as unknown as Window & typeof globalThis;
  globalThis.fetch = async input => {
    if (String(input).endsWith('/present.svg')) {
      successfulFetches += 1;
      return new Response('<svg/>');
    }
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('missing')); },
      cancel() { canceled += 1; },
    }), { status: 404 });
  };
  try {
    await startRuntimeTransport();
    for (let i = 0; i < 20; i++) {
      expect(await loadIcon(`missing-${i}`)).toBeNull();
      expect([...signals].reduce((count, signal) => count + getEventListeners(signal, 'abort').length, 0)).toBe(0);
    }
    expect(canceled).toBe(20);
    expect(await loadIcon('present')).toBe('<svg/>');
    expect(await loadIcon('present')).toBe('<svg/>');
    expect(getCachedIcon('present')).toBe('<svg/>');
    expect(successfulFetches).toBe(1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    AbortSignal.prototype.addEventListener = addListener;
  }
});
