'use strict';

const { EventEmitter } = require('node:events');
const { createDeferredProductConnection } = require('../../lib/ws/deferred-product-connection');

function socket() {
  const ws = new EventEmitter();
  ws.once = ws.once.bind(ws);
  return ws;
}

describe('deferred product connection', () => {
  test('pending close constructs and cleans up no product state', async () => {
    const ws = socket();
    const build = jest.fn();
    const owner = createDeferredProductConnection({ ws, build });
    ws.emit('close');
    await expect(owner.initialize()).rejects.toThrow('product connection initialization failed');
    expect(build).not.toHaveBeenCalled();
  });

  test('initialization exposes routing and later close cleans up exactly once', async () => {
    const ws = socket();
    const handleMessage = jest.fn(() => 'routed');
    const handleClose = jest.fn();
    const productFactory = jest.fn(async () => ({ handleMessage, handleClose }));
    const owner = createDeferredProductConnection({ ws, build: productFactory });
    await owner.initialize();
    expect(productFactory).toHaveBeenCalledTimes(1);
    expect(owner.handleMessage('frame', false)).toBe('routed');
    expect(handleMessage).toHaveBeenCalledWith('frame', false);
    ws.emit('close');
    ws.emit('close');
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(() => owner.handleMessage('late', false)).toThrow('product connection unavailable');
    await expect(owner.initialize()).rejects.toThrow('product connection initialization failed');
  });

  test('close during product factory construction cleans the completed graph exactly once', async () => {
    const ws = socket();
    const handleClose = jest.fn();
    let finishBuild;
    const build = jest.fn(() => new Promise((resolve) => { finishBuild = resolve; }));
    const owner = createDeferredProductConnection({ ws, build });
    const initializing = owner.initialize();
    ws.emit('close');
    finishBuild({ handleMessage: jest.fn(), handleClose });
    await expect(initializing).rejects.toThrow('product connection initialization failed');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('malformed product graph never becomes routable', async () => {
    const ws = socket();
    const owner = createDeferredProductConnection({ ws, build: async () => ({}) });
    await expect(owner.initialize()).rejects.toThrow('product connection initialization failed');
    expect(() => owner.handleMessage('frame', false)).toThrow('product connection unavailable');
  });

  test('malformed acquired product graph is cleaned exactly once', async () => {
    const ws = socket();
    const handleClose = jest.fn();
    const owner = createDeferredProductConnection({
      ws,
      build: async () => ({ handleClose }),
    });

    await expect(owner.initialize()).rejects.toThrow('product connection initialization failed');
    expect(handleClose).toHaveBeenCalledTimes(1);
    ws.emit('close');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('build rejection cleans a partially acquired graph exactly once', async () => {
    const ws = socket();
    const handleClose = jest.fn();
    const owner = createDeferredProductConnection({
      ws,
      build: async ({ ownCleanup }) => {
        ownCleanup(handleClose);
        throw new Error('later factory failed');
      },
    });

    await expect(owner.initialize()).rejects.toThrow('product connection initialization failed');
    expect(handleClose).toHaveBeenCalledTimes(1);
    ws.emit('close');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('a throwing acquired cleanup remains contained and one-use', async () => {
    const ws = socket();
    const handleClose = jest.fn(() => { throw new Error('cleanup failure'); });
    const owner = createDeferredProductConnection({
      ws,
      build: async () => ({ handleMessage: jest.fn(), handleClose }),
    });
    await owner.initialize();

    expect(() => ws.emit('close')).not.toThrow();
    ws.emit('close');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
