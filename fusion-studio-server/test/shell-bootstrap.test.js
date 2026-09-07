'use strict';

const { EventEmitter } = require('node:events');
const {
  MAX_BOOTSTRAP_BYTES,
  parseBootstrapPayload,
  readBootstrapAuthority,
} = require('../lib/shell-bootstrap');

const GENERATION = 'generation_auth_000001';
const MASTER = Buffer.alloc(32, 1).toString('base64url');
const PAYLOAD = `${JSON.stringify({ version: 1, generation: GENERATION, master: MASTER })}\n`;

function streamFactory(events) {
  return () => {
    const stream = new EventEmitter();
    stream.destroy = (error) => queueMicrotask(() => stream.emit('error', error));
    queueMicrotask(() => {
      for (const [name, value] of events) stream.emit(name, value);
    });
    return stream;
  };
}

describe('shell bootstrap pipe', () => {
  test('parses one exact bounded payload and canonical master bytes', () => {
    const value = parseBootstrapPayload(PAYLOAD);
    expect(value.generation).toBe(GENERATION);
    expect(value.master.equals(Buffer.alloc(32, 1))).toBe(true);
    expect(() => parseBootstrapPayload(PAYLOAD + PAYLOAD)).toThrow('shell_bootstrap_invalid');
    expect(() => parseBootstrapPayload(JSON.stringify({ version: 1, generation: GENERATION, master: MASTER }))).toThrow();
    expect(() => parseBootstrapPayload(`${JSON.stringify({ version: 1, generation: GENERATION, master: MASTER, role: 'trusted-shell' })}\n`)).toThrow();
  });

  test('reads the dedicated stream through descriptor close before resolving', async () => {
    const pending = readBootstrapAuthority({
      packaged: true,
      expected: true,
      createReadStream: streamFactory([
        ['data', Buffer.from(PAYLOAD.slice(0, 20))],
        ['data', Buffer.from(PAYLOAD.slice(20))],
        ['end'],
        ['close'],
      ]),
    });
    await expect(pending).resolves.toMatchObject({ version: 1, generation: GENERATION });
  });

  test('rejects a pipe that closes before one complete payload reaches EOF', async () => {
    await expect(readBootstrapAuthority({
      packaged: true,
      expected: true,
      createReadStream: streamFactory([
        ['data', Buffer.from(PAYLOAD.slice(0, 20))],
        ['close'],
      ]),
    })).rejects.toThrow('shell_bootstrap_unavailable');
  });

  test('rejects over-bound and malformed inherited pipes', async () => {
    await expect(readBootstrapAuthority({
      packaged: true,
      expected: true,
      createReadStream: streamFactory([
        ['data', Buffer.alloc(MAX_BOOTSTRAP_BYTES + 1)],
      ]),
    })).rejects.toThrow('shell_bootstrap_invalid');
    await expect(readBootstrapAuthority({
      packaged: true,
      expected: true,
      createReadStream: streamFactory([['data', Buffer.from('{}\n')], ['end']]),
    })).rejects.toThrow('shell_bootstrap_invalid');
  });

  test('only a deliberately standalone non-packaged process may lack fd 3', async () => {
    const unavailable = () => { const error = new Error('bad fd'); error.code = 'EBADF'; throw error; };
    await expect(readBootstrapAuthority({ packaged: false, expected: false, createReadStream: unavailable })).resolves.toBeNull();
    await expect(readBootstrapAuthority({ packaged: true, expected: true, createReadStream: unavailable })).rejects.toThrow('shell_bootstrap_unavailable');
    await expect(readBootstrapAuthority({ packaged: false, expected: true, createReadStream: unavailable })).rejects.toThrow('shell_bootstrap_unavailable');
  });
});
