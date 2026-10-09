import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const base = '/private/tmp/fusion-main-consolidation-95vxg0_h';
const repo = `${base}/candidate`;
const run = fs.readdirSync(`${base}/profile/fusion-restart`).find(name => fs.existsSync(`${base}/profile/fusion-restart/${name}/verified.json`));
const verified = JSON.parse(fs.readFileSync(`${base}/profile/fusion-restart/${run}/verified.json`, 'utf8'));
const { chromium } = createRequire(`${repo}/fusion-studio-client/package.json`)('@playwright/test');
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${verified.debugPort}`);
const receipt = { started: new Date().toISOString(), candidate: repo, profile: verified.profile, machine: verified.machine, serverUrl: verified.serverUrl, source: 'Canonical unmodified production app/server; observer-only socket subclass captures the real initialized transport. No provider/admission/ACK substitutions or public prompt.' };
const created = [];
try {
  const page = browser.contexts().flatMap(context => context.pages()).find(item => item.url() === 'fusion-shell://app/');
  assert.ok(page);
  await page.addInitScript(() => {
    const Original = window.WebSocket;
    window.__canonicalSockets = [];
    window.__canonicalReplies = [];
    window.WebSocket = class extends Original {
      constructor(...args) {
        super(...args);
        window.__canonicalSockets.push(this);
        this.addEventListener('message', event => {
          try {
            const f = JSON.parse(event.data);
            if (f.type === 'workspace:init') window.__canonicalInit = { workspaceId: f.workspaceId, activeRepoPath: f.activeRepoPath, workspaceEpoch: f.workspaceEpoch, bindingRevision: f.bindingRevision };
            if (f.requestId?.startsWith('canonical-public-save-')) window.__canonicalReplies.push(f);
          } catch {}
        });
      }
    };
  });
  await page.reload();
  await page.locator('.rv-connection-status.connected').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.__canonicalInit?.workspaceId);
  const init = await page.evaluate(() => window.__canonicalInit);
  assert.equal(fs.realpathSync(init.activeRepoPath), repo);
  receipt.workspace = init;
  const images = [await page.screenshot(), await page.screenshot({ clip: { x: 0, y: 0, width: 180, height: 120 } })];
  const requestIds = images.map(() => `canonical-public-save-${crypto.randomUUID()}`);
  await page.evaluate(({ init, requestIds, data }) => {
    const socket = window.__canonicalSockets.find(item => item.readyState === WebSocket.OPEN);
    if (!socket) throw new Error('No actual initialized socket');
    data.forEach((png, index) => socket.send(JSON.stringify({ type: 'screenshot:file-capture', workspaceId: init.workspaceId, requestId: requestIds[index], dataUrl: `data:image/png;base64,${png}` })));
  }, { init, requestIds, data: images.map(bytes => bytes.toString('base64')) });
  await page.waitForFunction(ids => ids.every(id => window.__canonicalReplies.some(reply => reply.requestId === id)), requestIds);
  const replies = await page.evaluate(() => window.__canonicalReplies);
  receipt.saves = requestIds.map((id, index) => {
    const reply = replies.find(item => item.requestId === id);
    assert.equal(reply.type, 'screenshot:file-captured');
    assert.ok(reply.savedPath.startsWith(`${repo}/ai/RC-MacAir-15/Data/Screenshots/`));
    assert.match(path.basename(reply.savedPath), /-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.png$/);
    created.push(reply.savedPath);
    const stored = fs.readFileSync(reply.savedPath);
    assert.deepEqual(stored, images[index]);
    return { requestId: id, path: reply.savedPath, bytes: stored.length, sha256: crypto.createHash('sha256').update(stored).digest('hex'), width: stored.readUInt32BE(16), height: stored.readUInt32BE(20) };
  });
  assert.notEqual(receipt.saves[0].path, receipt.saves[1].path);
  const gallery = await page.evaluate(() => window.electronAPI.listScreenshots());
  assert.ok(receipt.saves.every(save => gallery.some(item => item.path === save.path)));
  receipt.galleryFoundBoth = true;
  const badId = `canonical-public-save-${crypto.randomUUID()}`;
  await page.evaluate(id => window.__canonicalSockets.find(item => item.readyState === WebSocket.OPEN).send(JSON.stringify({ type: 'screenshot:file-capture', workspaceId: 'not-the-owned-workspace', requestId: id, dataUrl: 'data:image/png;base64,AA==' })), badId);
  await page.waitForFunction(id => window.__canonicalReplies.some(item => item.requestId === id), badId);
  receipt.failure = await page.evaluate(id => window.__canonicalReplies.find(item => item.requestId === id), badId);
  assert.equal(receipt.failure.type, 'screenshot:error');
  assert.match(receipt.failure.message, /Workspace mismatch/);
  await page.locator('.rv-connection-status.connected').waitFor({ state: 'visible' });
  receipt.result = 'passed';
} catch (error) {
  receipt.result = 'failed';
  receipt.error = error.message;
  process.exitCode = 1;
} finally {
  for (const leaf of created) fs.unlinkSync(leaf);
  receipt.ownedCaptureFilesRemoved = created.every(leaf => !fs.existsSync(leaf));
  receipt.ended = new Date().toISOString();
  fs.writeFileSync(`${base}/canonical-public-save-smoke.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ result: receipt.result, saves: receipt.saves?.length, gallery: receipt.galleryFoundBoth, error: receipt.error, cleanup: receipt.ownedCaptureFilesRemoved }));
}
