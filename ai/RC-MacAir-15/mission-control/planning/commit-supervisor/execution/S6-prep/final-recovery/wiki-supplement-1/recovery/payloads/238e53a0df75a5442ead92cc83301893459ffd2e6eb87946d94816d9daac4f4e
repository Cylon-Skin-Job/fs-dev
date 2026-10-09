// Verify the selected live shell via its existing WebSocket-derived DOM state.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { listenerPids, systemProcesses, validateRuntime } from './fusion-restart-processes.mjs';

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function loadChromium(target) {
  // This library attaches to the selected app; it does not supply Electron.
  return createRequire(path.join(target.client, 'package.json'))('@playwright/test').chromium;
}
export function assertConnectedShell(sample) {
  if (sample.url !== 'fusion-shell://app/' || sample.connected !== 1 || sample.text !== 'Connected') {
    throw new Error('renderer disconnected or workspace:init shell unavailable');
  }
}
export async function observeConnection(read, options = {}) {
  const { sleep = delay, samples = 11, interval = 200 } = options;
  for (let i = 0; i < samples; i += 1) {
    assertConnectedShell(await read());
    if (i < samples - 1) await sleep(interval);
  }
  return { connectedAfterWorkspaceInit: true, samples, durationMs: (samples - 1) * interval };
}
export async function verifyLive(target, mainPid, debugPort, chromium = loadChromium(target)) {
  let browser;
  let port;
  let lastError;
  // Wait for the selected server/probe, never substitute any listening process.
  for (let i = 0; i < 60; i += 1) {
    try {
      port = Number(fs.readFileSync(target.portFile, 'utf8').trim());
      validateRuntime(systemProcesses(), target, mainPid, port, listenerPids(port), debugPort, listenerPids(debugPort));
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 1000 });
      break;
    } catch (error) { lastError = error; await delay(500); }
  }
  if (!browser) throw new Error(`live identity/probe unavailable: ${lastError?.message}`);
  try {
    let page;
    for (let i = 0; i < 60; i += 1) {
      page = browser.contexts().flatMap((context) => context.pages()).find((p) => p.url() === 'fusion-shell://app/');
      if (page) break;
      await delay(500);
    }
    if (!page) throw new Error('selected Fusion shell unavailable');
    await page.locator('.rv-connection-status.connected').waitFor({ state: 'visible', timeout: 30_000 });
    const read = () => page.evaluate(() => ({
      url: location.href,
      connected: document.querySelectorAll('.rv-connection-status.connected').length,
      text: document.querySelector('.rv-connection-status.connected')?.textContent,
    }));
    const connection = await observeConnection(read);
    const identity = validateRuntime(systemProcesses(), target, mainPid, port, listenerPids(port), debugPort, listenerPids(debugPort));
    return { ...identity, ...connection, serverUrl: `http://localhost:${port}` };
  } finally {
    // connectOverCDP.close detaches this client; it never owns the Electron app.
    await browser.close();
  }
}
