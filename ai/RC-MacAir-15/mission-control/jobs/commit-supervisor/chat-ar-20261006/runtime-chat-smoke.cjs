'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const candidate = '/private/tmp/chat-ar-integration-r6pe5gmi/candidate';
const { chromium } = require(candidate + '/fusion-studio-client/node_modules/@playwright/test');
const root = process.argv[2], nonce = process.argv[3];
assert.equal(fs.readFileSync(path.join(root, '.chat-ar-integration-owned'), 'utf8'), nonce + '\n');
const prep = JSON.parse(fs.readFileSync(path.join(root, 'runtime-preparation.json'), 'utf8'));
const runs = fs.readdirSync(path.join(prep.profile, 'fusion-restart')).filter(n => n.startsWith('run-'));
assert.equal(runs.length, 1);
const verified = JSON.parse(fs.readFileSync(path.join(prep.profile, 'fusion-restart', runs[0], 'verified.json'), 'utf8'));
const frames = [], captures = [], chats = [], samples = [];
let browser;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const save = (name, data) => fs.writeFileSync(path.join(root, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const record = (direction, event) => {
  let message; try { message = JSON.parse(event.response.payloadData); } catch { return; }
  if (!['thread:created', 'thread:opened', 'thread:open-assistant', 'thread:create', 'screenshot:file-capture', 'screenshot:file-captured', 'screenshot:error'].includes(message.type)) return;
  const row = { at: new Date().toISOString(), direction, type: message.type };
  for (const key of ['requestId', 'workspaceId', 'viewId', 'threadId', 'threadGroupId', 'savedPath', 'message']) if (message[key] !== undefined) row[key] = message[key];
  if (message.thread) row.thread = { id: message.thread.id, workspaceId: message.thread.workspaceId, viewId: message.thread.viewId, threadGroupId: message.thread.threadGroupId };
  if (message.type === 'screenshot:file-capture') row.pngDataUrlSupplied = typeof message.dataUrl === 'string' && message.dataUrl.startsWith('data:image/png;base64,');
  frames.push(row);
};
(async () => {
  try {
    const debugPort = verified.debugPort;
    assert.ok(Number.isInteger(debugPort));
    browser = await chromium.connectOverCDP('http://127.0.0.1:' + debugPort);
    const pages = browser.contexts().flatMap(context => context.pages()).filter(page => page.url().startsWith('fusion-shell://app/'));
    assert.equal(pages.length, 1);
    const page = pages[0];
    await page.bringToFront();
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    session.on('Network.webSocketFrameSent', event => record('sent', event));
    session.on('Network.webSocketFrameReceived', event => record('received', event));
    const main = page.locator('.rv-chat-area--active[data-chat-host="main"]:visible');
    const createChat = async () => {
      const prior = await main.count() ? await main.getAttribute('data-chat-thread-id') : null;
      const rail = page.locator('.rv-new-chat-btn:visible');
      if (await rail.count()) await rail.first().click();
      else await page.getByRole('button', { name: 'New chat', exact: true }).click();
      await page.waitForFunction(previous => {
        const surface = [...document.querySelectorAll('.rv-chat-area--active[data-chat-host="main"]')].find(e => e.getBoundingClientRect().width > 0);
        const id = surface?.getAttribute('data-chat-thread-id');
        return Boolean(id && id !== previous);
      }, prior, { timeout: 20000 });
      assert.equal(await main.count(), 1);
      const row = { threadId: await main.getAttribute('data-chat-thread-id'), workspaceId: await main.getAttribute('data-chat-workspace-id'), viewId: await main.getAttribute('data-chat-view-id') };
      assert.equal(row.workspaceId, prep.active.workspaceId);
      assert.equal(row.viewId, 'file-viewer');
      chats.push(row);
      return row;
    };
    const capture = async (entry, owner) => {
      const prior = await main.locator('.rv-chat-attachment-pill').count();
      const frameStart = frames.length;
      if (entry === 'composer') {
        await main.getByRole('button', { name: 'Add', exact: true }).click();
        await main.getByRole('menuitem', { name: 'Take screenshot', exact: true }).click();
      } else await page.locator('.rv-header:visible').getByRole('button', { name: 'Take screenshot', exact: true }).click();
      await page.waitForFunction(({ id, count }) => {
        const e = [...document.querySelectorAll('.rv-chat-area--active[data-chat-host="main"]')].find(n => n.getAttribute('data-chat-thread-id') === id);
        return e && e.querySelectorAll('.rv-chat-attachment-pill').length === count + 1;
      }, { id: owner.threadId, count: prior }, { timeout: 15000 });
      const pill = main.locator('.rv-chat-attachment-pill').last();
      const savedPath = await pill.getAttribute('title');
      assert.ok(savedPath.startsWith(path.join(prep.workspace, 'ai', prep.machine, 'Data', 'Screenshots') + path.sep));
      assert.equal(await main.getAttribute('data-chat-thread-id'), owner.threadId);
      const bytes = fs.readFileSync(savedPath);
      assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
      assert.ok(bytes.length > 1000);
      const sent = frames.slice(frameStart).filter(row => row.direction === 'sent' && row.type === 'screenshot:file-capture');
      const received = frames.slice(frameStart).filter(row => row.direction === 'received' && row.type === 'screenshot:file-captured');
      assert.equal(sent.length, 1); assert.equal(received.length, 1);
      assert.equal(sent[0].requestId, received[0].requestId);
      assert.equal(sent[0].workspaceId, owner.workspaceId);
      assert.equal(received[0].workspaceId, owner.workspaceId);
      assert.equal(received[0].savedPath, savedPath);
      assert.equal(sent[0].pngDataUrlSupplied, true);
      captures.push({ entry, owner, savedPath, pngSha256: sha(bytes), bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), requestId: sent[0].requestId,
        pendingAttachmentCount: prior + 1, savedPathMatchesAcknowledgment: true });
    };
    const first = await createChat();
    await capture('composer', first);
    await capture('header', first);
    const second = await createChat();
    assert.notEqual(first.threadId, second.threadId);
    assert.equal(await main.locator('.rv-chat-attachment-pill').count(), 0);
    await capture('composer', second);
    for (let i = 0; i < 11; i++) {
      const status = await page.locator('.rv-connection-status:visible').innerText();
      assert.equal(status, 'Connected'); samples.push({ at: new Date().toISOString(), status });
      if (i !== 10) await page.waitForTimeout(200);
    }
    await page.screenshot({ path: path.join(root, 'real-chat-ui.png') });
    save('runtime-chat-smoke.json', { status: 'PASS', at: new Date().toISOString(), candidate, profile: prep.profile, workspace: prep.workspace, machine: prep.machine,
      pageUrl: page.url(), chats, captures, sustainedConnectionSamples: samples, frames,
      boundary: 'Actual candidate Electron native capture + actual server request/ack + pending attachment DOM; no runtime replacements/interception/stubs, store mutation or provider prompt.' });
    await session.detach();
    console.log(JSON.stringify({ status: 'PASS', chats: chats.length, captures: captures.length, output: path.join(root, 'runtime-chat-smoke.json') }));
  } catch (error) {
    save('runtime-chat-smoke-failure.json', { status: 'FAIL', at: new Date().toISOString(), name: error.name, message: error.message, frames, chats, captures, samples });
    throw error;
  } finally { if (browser) await browser.close(); }
})();
