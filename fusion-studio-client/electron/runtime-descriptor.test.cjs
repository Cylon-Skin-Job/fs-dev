'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createRuntimeDescriptor,
  createRuntimeDescriptorOwner,
} = require('./runtime-descriptor.cjs');

test('runtime descriptor is exact, immutable, and loopback-only', () => {
  const descriptor = createRuntimeDescriptor(43123, 'generation_000001');
  assert.deepEqual(descriptor, {
    generation: 'generation_000001',
    httpOrigin: 'http://127.0.0.1:43123',
    webSocketUrl: 'ws://127.0.0.1:43123',
  });
  assert.equal(Object.isFrozen(descriptor), true);
  assert.throws(() => createRuntimeDescriptor(0, 'generation_000001'));
  assert.throws(() => createRuntimeDescriptor(65_536, 'generation_000001'));
  assert.throws(() => createRuntimeDescriptor(43123, 'short'));
});

test('runtime descriptor owner rotates generation and clears unavailable state', () => {
  const values = ['generation_000001', 'generation_000002'];
  const owner = createRuntimeDescriptorOwner({ createGeneration: () => values.shift() });
  const first = owner.activate(41001);
  const second = owner.activate(41002);
  assert.notEqual(first.generation, second.generation);
  assert.equal(owner.getCurrent(), second);
  owner.clear();
  assert.equal(owner.getCurrent(), null);
});
