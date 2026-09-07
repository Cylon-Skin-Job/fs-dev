'use strict';

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const {
  ClientFrameError,
  MAX_SHELL_AUTH_FRAME_BYTES,
  decodeClientTextFrame,
} = require('../../lib/ws/client-frame-decoder');
const {
  MAX_APPLICATION_FRAME_BYTES,
  activateApplicationPayloadLimit,
} = require('../../lib/ws/websocket-payload-boundary');

describe('WebSocket payload boundary', () => {
  test('rejects oversized authentication text before JSON parsing', () => {
    const raw = Buffer.from(JSON.stringify({
      type: 'shell-auth:proof',
      padding: 'x'.repeat(MAX_SHELL_AUTH_FRAME_BYTES),
    }));

    expect(() => decodeClientTextFrame(raw, false, {
      maxBytes: MAX_SHELL_AUTH_FRAME_BYTES,
    })).toThrow(ClientFrameError);
    try {
      decodeClientTextFrame(raw, false, { maxBytes: MAX_SHELL_AUTH_FRAME_BYTES });
    } catch (error) {
      expect(error.closeCode).toBe(1009);
    }
  });

  test('raises only the owned pending receiver to the established application limit', () => {
    const ws = { _receiver: { _maxPayload: MAX_SHELL_AUTH_FRAME_BYTES } };
    activateApplicationPayloadLimit(ws);
    expect(ws._receiver._maxPayload).toBe(MAX_APPLICATION_FRAME_BYTES);
    expect(() => activateApplicationPayloadLimit(ws)).toThrow('WebSocket payload boundary unavailable');
    expect(() => activateApplicationPayloadLimit({})).toThrow('WebSocket payload boundary unavailable');
  });

  test('the protocol-sized receiver rejects a large raw frame before dispatch', async () => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server, maxPayload: MAX_SHELL_AUTH_FRAME_BYTES });
    let dispatched = false;
    const warnings = [];
    wss.on('connection', (ws) => {
      ws.on('error', () => warnings.push('[WS] transport_error'));
      ws.on('message', () => { dispatched = true; });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    await new Promise((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    const closed = new Promise((resolve) => client.once('close', (code) => resolve(code)));
    client.send('x'.repeat(MAX_SHELL_AUTH_FRAME_BYTES + 1));

    await expect(closed).resolves.toBe(1009);
    expect(dispatched).toBe(false);
    expect(warnings).toEqual(['[WS] transport_error']);
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  test('the managed production server contains an oversized raw socket', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-auth-payload-'));
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        FUSION_APP_USER_DATA: tmpDir,
        FUSION_ELECTRON_SERVER: '1',
        PORT: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
    });
    const bootstrap = `${JSON.stringify({
      version: 1,
      generation: 'generation_payload_0001',
      master: Buffer.alloc(32, 7).toString('base64url'),
    })}\n`;
    child.stdio[3].end(bootstrap);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    try {
      const port = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`managed server readiness timeout: ${stderr}`)), 20_000);
        const inspect = () => {
          const match = stdout.match(/SERVER_READY:(\d+)/);
          if (!match) return;
          clearTimeout(timeout);
          resolve(Number(match[1]));
        };
        child.stdout.on('data', inspect);
        inspect();
        child.once('exit', (code) => {
          clearTimeout(timeout);
          reject(new Error(`managed server exited before readiness: ${code}: ${stderr}`));
        });
      });
      const client = new WebSocket(`ws://127.0.0.1:${port}`, {
        origin: 'fusion-shell://app',
      });
      await new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
      });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('challenge timeout')), 2_000);
        client.once('message', () => { clearTimeout(timeout); resolve(); });
      });
      const closed = new Promise((resolve) => client.once('close', (code) => resolve(code)));
      client.send('RAW_PREAUTH_PAYLOAD_CANARY_00B'.repeat(200));
      await expect(closed).resolves.toBe(1009);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(child.exitCode).toBeNull();
      expect(stderr).not.toContain('Unhandled');
      const durableLog = fs.readFileSync(path.join(tmpDir, 'server-live.log'), 'utf8');
      expect(durableLog).not.toContain(tmpDir);
      expect(durableLog).not.toContain('RAW_PREAUTH_PAYLOAD_CANARY_00B');
    } finally {
      if (child.exitCode === null) child.kill('SIGTERM');
      await new Promise((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once('exit', resolve);
      });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30_000);
});
