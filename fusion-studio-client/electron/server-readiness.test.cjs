'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createServerReadinessParser,
  parseServerReadyLine,
} = require('./server-readiness.cjs');

test('server readiness accepts only one exact valid port', () => {
  assert.equal(parseServerReadyLine('SERVER_READY:1'), 1);
  assert.equal(parseServerReadyLine('SERVER_READY:65535'), 65_535);
  assert.equal(parseServerReadyLine('[Server] booting'), null);
  for (const line of [
    'SERVER_READY:0',
    'SERVER_READY:65536',
    'SERVER_READY:03001',
    'SERVER_READY:3001 trailing',
    'SERVER_READY:localhost:3001',
  ]) assert.throws(() => parseServerReadyLine(line), /Invalid server readiness port/);
});

test('server readiness handles split chunks and settles once', () => {
  const ports = [];
  const failures = [];
  const parser = createServerReadinessParser(
    (port) => ports.push(port),
    (error) => failures.push(error),
  );
  parser.push('boot\nSERVER_');
  parser.push('READY:43123\nSERVER_READY:43124\n');
  assert.deepEqual(ports, [43123]);
  assert.deepEqual(failures, []);
});
