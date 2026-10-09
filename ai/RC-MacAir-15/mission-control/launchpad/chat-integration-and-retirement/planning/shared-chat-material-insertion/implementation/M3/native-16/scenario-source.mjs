/** Actual compiled Electron capture/save/pill and independent public Send/readback. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cleanupFixture, closeOwnedApp, createChat, createProject, stageAndLaunch,
  waitFor, withDb, descendants, selectPanel } from './chat-architecture/electron-case-helpers.mjs';
import { markOwnedDirectory, assertDisposablePath } from './chat-architecture/fixture-lifecycle.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function tree(root) {
  const rows = {};
  const visit = dir => { for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) visit(file);
    else rows[path.relative(root, file)] = hash(fs.readFileSync(file));
  } }; visit(root); return rows;
}
const processRows = () => spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout.split('\n')
  .filter(row => /Fusion Studio|Electron|fusion-studio.*server|server\.js/.test(row));

export async function runChatMaterialNativeScenario() {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const token = `chat-architecture-owner-material-${process.pid}-${crypto.randomUUID()}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-material-native-'));
  markOwnedDirectory(tempRoot, token, 'native-case');
  const evidenceRoot = process.env.CHAT_MATERIAL_EVIDENCE_ROOT || fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-material-evidence-'));
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const report = { started: new Date().toISOString(), repoRoot, HEAD: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim(),
    token, tempRoot, evidenceRoot, protectedProcessesBefore: processRows(), captures: [], sends: [], limits: [
      'Deterministic staged provider and inherited admission/ACK fault seams; no public provider certification.',
      'Capture IPC, preload, screenshot save/path protection, production renderer and SQLite persistence remain actual.',
      'Only bounded synthetic fixture prompts and image hashes/dimensions are retained; no PNG payload copied.'
    ] };
  let fixture, runtime; const sent = [], received = [], diagnostics = [];
  report.diagnostics = diagnostics;
  try {
    const consoleState=spawnSync('/usr/sbin/ioreg',['-n','Root','-d1'],{encoding:'utf8'}).stdout;
    report.nativeCapability={at:new Date().toISOString(),desktopLocked:/"IOConsoleLocked" = Yes/.test(consoleState)};
    assert.equal(report.nativeCapability.desktopLocked,false,'native desktop focus unavailable while locked');
    // A bounded delay before ACK makes the absence of optimistic bubbles observable.
    fixture = await stageAndLaunch({ repoRoot, tempRoot, evidenceRoot, token, casePrefix: 'material-native',
      faultSchedule: { 'before-ack': { action: 'delay', delayMs: 1000 } }, eventScript: { frameIntervalMs: 30, textFrames: 3 } });
    report.identities = { stagedClient: fixture.stagedClient, stagedServer: fixture.stagedServer,
      profile: fixture.profileRoot, machine: 'RC-MacAir-15', workspaceRoot: fixture.workspaceRoot, dbPath: fixture.dbPath,
      renderer: tree(path.join(fixture.stagedClient, 'dist')), electron: tree(path.join(fixture.stagedClient, 'electron')),
      server: tree(path.join(fixture.stagedServer, 'lib')), serverEntry: hash(fs.readFileSync(path.join(fixture.stagedServer, 'server.js'))),
      electronBinary: { path: fs.realpathSync(path.join(fixture.stagedClient, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')), sha256: hash(fs.readFileSync(path.join(fixture.stagedClient, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'))) }, nativeObserver: hash(fs.readFileSync(path.join(fixture.stagedServer, 'native/secure-file-observer/build/Release/secure_file_observer.node'))) };
    runtime = await fixture.launch();
    const { app, page } = runtime; page.setDefaultTimeout(30_000);
    page.on('pageerror', error => diagnostics.push({kind:'pageerror',message:error.message}));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    report.runtime = { pid: runtime.pid, descendants: descendants(runtime.pid), port: runtime.port,
      commands: spawnSync('ps', ['-p', [runtime.pid, ...descendants(runtime.pid)].join(','), '-o', 'pid=,command='], { encoding: 'utf8' }).stdout,
      url: page.url() };

    const bindSocket = socket => {
      socket.on('framesent', ({ payload }) => { try {
        const f = JSON.parse(String(payload));
        if (['screenshot:file-capture', 'prompt', 'thread:open-assistant'].includes(f.type)) {
          const { dataUrl, ...safe } = f; sent.push({ ...safe, ...(dataUrl ? { pngPayloadSha256: hash(Buffer.from(dataUrl.split(',')[1], 'base64')) } : {}) });
        }
      } catch {} });
      socket.on('framereceived', ({ payload }) => { try {
        const f = JSON.parse(String(payload)); if (['workspace:init', 'screenshot:file-captured', 'message:sent', 'chat-turn:saved'].includes(f.type)) received.push(f);
        else diagnostics.push({kind:'received',type:f.type,workspaceId:f.workspaceId,viewId:f.viewId,threadId:f.threadId,threadGroupId:f.threadGroupId,bindingRevision:f.bindingRevision,historyOnly:f.historyOnly});
      } catch {} });
    };
    page.on('websocket', bindSocket);
    let projectPath = path.join(fixture.workspaceRoot, 'material-project');
    await createProject(app, page, projectPath, 'Material Native Fixture');
    projectPath = fs.realpathSync(projectPath);
    fs.writeFileSync(path.join(projectPath, 'material-native.txt'), 'Owned material resource');
    const resourceRelative = '999-Material_Native/001-Owned_Material/PAGE.md';
    const resourcePath = path.join(projectPath, 'ai/RC-MacAir-15/Wiki', resourceRelative);
    fs.mkdirSync(path.dirname(resourcePath), {recursive:true}); fs.writeFileSync(resourcePath, '# Owned Material\n\nOwned native resource route.\n');
    await page.reload(); await page.waitForFunction(() => document.body.innerText.includes('Connected'));
    await waitFor(page, () => received.some(f => f.type === 'workspace:init'), 'actual workspace init');
    await page.waitForTimeout(800); assert.ok(await page.locator('body').innerText().then(s => s.includes('Connected')));
    await page.evaluate(() => {
      window.__materialNativeObservations=[];
      new MutationObserver(()=>{ const message=document.querySelector('.rv-toast')?.textContent; if(message && window.__materialNativeObservations.at(-1)?.message!==message) window.__materialNativeObservations.push({kind:'toast',message}); }).observe(document.body,{subtree:true,childList:true,characterData:true});
      window.addEventListener('fusion:chat-action',event=>{ const d=event.detail; if(d?.kind==='material') window.__materialNativeObservations.push({kind:'commit',owner:{workspaceId:d.operation.owner.workspaceId,viewId:d.operation.owner.viewId,threadId:d.operation.owner.threadId,generation:d.operation.owner.generation,current:d.operation.owner.current},bindingSerial:d.operation.bindingSerial,bindingRevision:d.operation.bindingRevision}); },true);
    });
    const read = fn => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, fn);
    report.workspace = read(db => db.prepare('SELECT id, repo_path FROM workspaces WHERE repo_path = ?').get(projectPath));
    assert.ok(report.workspace?.id);
    for (const [view, title] of [['file-viewer', 'Files'], ['issues-viewer', 'Issues']]) {
      const panel = await createChat(page, fixture.dbPath, view, title);
      const group = read(db => db.prepare('SELECT group_id, current_primary_thread_id FROM thread_groups WHERE view_id = ? ORDER BY rowid DESC LIMIT 1').get(view));
      const sideId = group.current_primary_thread_id;
      await panel.locator('.rv-chat-header-btn[aria-label="More options"]').first().click();
      await page.getByRole('menu', { name: 'Chat options' }).getByRole('menuitem', { name: 'Move Chat to Side Chat' }).click();
      await waitFor(page, () => read(db => db.prepare('SELECT COUNT(*) n FROM thread_group_members WHERE group_id = ?').get(group.group_id).n === 2), 'public Move');
      const mainId = read(db => db.prepare('SELECT current_primary_thread_id id FROM thread_groups WHERE group_id = ?').get(group.group_id).id);
      // Move creates a cold empty Main member. Public group selection supplies
      // its passive history hydration before it can be an eligible destination.
      // Select another public group first: a same-group content selection is a
      // no-op and does not issue a new history open.
      await createChat(page, fixture.dbPath, view, title);
      const setupMainId = read(db => db.prepare('SELECT current_primary_thread_id id FROM thread_groups WHERE view_id=? AND group_id<>? ORDER BY rowid DESC LIMIT 1').get(view, group.group_id).id);
      await waitFor(page,()=>diagnostics.some(f=>f.kind==='received' && f.type==='thread:opened' && f.threadId===setupMainId),'public other-group hydration');
      await panel.locator(`.rv-chat-area[data-chat-thread-id="${setupMainId}"]`).waitFor();
      await panel.locator(`.rv-chat-item[data-thread-group-id="${group.group_id}"] .rv-chat-item-text`).click();
      await waitFor(page,()=>diagnostics.some(f=>f.kind==='received' && f.type==='thread:opened' && f.threadId===mainId),'public Main hydration');
      const tab = panel.locator('.rv-view-tab-list [role="tab"]', { hasText: 'Side Chat' }); await tab.waitFor(); await tab.click();
      const main = panel.locator(`.rv-chat-area[data-chat-thread-id="${mainId}"]`);
      const side = panel.locator(`.rv-chat-area[data-chat-thread-id="${sideId}"]`);
      await main.waitFor(); await side.waitFor();
      await main.locator('textarea').fill(`MAIN ${view}`); await side.locator('textarea').fill(`SIDE ${view}`);
      const stagedStart = sent.length;
      async function capture(target, other, threadId, kind) {
        const targetCount = await target.locator('.rv-chat-attachment-pill').count(), otherCount = await other.locator('.rv-chat-attachment-pill').count();
        const drafts = [await target.locator('textarea').inputValue(), await other.locator('textarea').inputValue()];
        const count = sent.filter(f => f.type === 'screenshot:file-capture').length;
        await waitFor(page, () => app.evaluate(({app,BrowserWindow})=>{app.setActivationPolicy('regular');app.dock?.show();app.focus({steal:true});const win=BrowserWindow.getAllWindows()[0];if(win.isMinimized())win.restore();win.show();win.moveTop();win.focus();win.webContents.focus();return BrowserWindow.getFocusedWindow()===win;}), 'owned native capture focus');
        await target.locator('textarea').click();
        diagnostics.push({stage:'capture',view,threadId,kind,dom:await target.evaluate(el=>({threadId:el.dataset.chatThreadId,viewId:el.dataset.chatViewId,host:el.dataset.chatHost,surface:el.dataset.surfaceId})),capability:await page.evaluate(()=>typeof window.electronAPI?.capturePage),focus:await app.evaluate(({BrowserWindow})=>BrowserWindow.getFocusedWindow()?.id??null)});
        if (kind === 'global') await page.getByRole('button', { name: 'Take screenshot', exact: true }).click();
        else { await target.getByRole('button', { name: 'Add', exact: true }).click();
          await target.getByRole('menuitem', { name: 'Take screenshot', exact: true }).click(); }
        await waitFor(page, () => sent.filter(f => f.type === 'screenshot:file-capture').length === count + 1, 'native save request');
        const request = sent.filter(f => f.type === 'screenshot:file-capture').at(-1);
        await waitFor(page, () => received.some(f => f.type === 'screenshot:file-captured' && f.requestId === request.requestId), 'correlated saved PNG');
        const result = received.find(f => f.type === 'screenshot:file-captured' && f.requestId === request.requestId);
        const bytes = fs.readFileSync(result.savedPath);
        assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
        const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20); assert.ok(width > 0 && height > 0);
        assert.equal(hash(bytes), request.pngPayloadSha256); assert.equal(result.workspaceId, report.workspace.id);
        assert.ok(result.savedPath.startsWith(path.join(projectPath, 'ai/RC-MacAir-15/Data/Screenshots') + path.sep));
        await waitFor(page, () => target.locator('.rv-chat-attachment-pill').count().then(n => n === targetCount + 1), 'exact captured pill');
        assert.equal(await target.locator('.rv-chat-attachment-pill').last().getAttribute('title'), result.savedPath);
        assert.equal(await other.locator('.rv-chat-attachment-pill').count(), otherCount);
        assert.deepEqual([await target.locator('textarea').inputValue(), await other.locator('textarea').inputValue()], drafts);
        report.captures.push({ view, host: threadId === mainId ? 'main' : 'side', kind, threadId, requestId: request.requestId,
          workspaceId: request.workspaceId, savedPath: result.savedPath, bytes: bytes.length, width, height, sha256: hash(bytes),
          renderedPath: await target.locator('.rv-chat-attachment-pill').last().getAttribute('title'), nonTargetPreserved: true });
      }
      await capture(main, side, mainId, 'global'); await capture(side, main, sideId, 'global');
      await capture(main, side, mainId, 'own'); await capture(side, main, sideId, 'own');
      // Actual gallery IPC discovers each opposite owner's saved capture, without capture/save stubs.
      for (const [target, other, owner] of [[main, side, 'main'], [side, main, 'side']]) {
        const galleryPath = report.captures.find(c => c.view === view && c.host !== owner).savedPath;
        const otherPaths = await other.locator('.rv-chat-attachment-pill').evaluateAll(items => items.map(item => item.getAttribute('title')));
        await target.getByRole('button', { name: 'Add', exact: true }).click();
        await target.getByRole('menuitem', { name: 'Browse screenshots', exact: true }).click();
        const item = page.locator('.rv-hover-icon-modal-row', { hasText: path.basename(galleryPath).replace(/\.png$/, '') });
        await item.click(); await waitFor(page, () => target.locator(`.rv-chat-attachment-pill[title="${galleryPath}"]`).count().then(n => n === 1), 'gallery saved path');
        assert.deepEqual(await other.locator('.rv-chat-attachment-pill').evaluateAll(items => items.map(item => item.getAttribute('title'))), otherPaths);
        (report.galleries ??= []).push({ view, host: owner, path: galleryPath, nonTargetPreserved: true });
      }
      if (view === 'file-viewer') {
        // Hydrate a real retained source view, then return to the foreground
        // destination. Its DOM button invokes the actual product handler; the
        // hidden source observation is explicit, not a store/transport patch.
        await selectPanel(page, 'wiki-viewer', 'Wiki');
        const sourcePanel = page.locator('.rv-panel[data-panel="wiki-viewer"]');
        const sourceRow = sourcePanel.locator('.rv-wiki-topic-item', {hasText:'Owned Material'});
        await sourceRow.waitFor();
        for (const [target, other, owner, threadId] of [[main, side, 'main', mainId], [side, main, 'side', sideId]]) {
          await selectPanel(page, view, title); await tab.click(); await target.locator('textarea').click();
          const otherPaths = await other.locator('.rv-chat-attachment-pill').evaluateAll(items => items.map(item => item.getAttribute('title')));
          const drafts = [await target.locator('textarea').inputValue(), await other.locator('textarea').inputValue()];
          const before = await target.locator('.rv-chat-attachment-pill').count();
          await sourceRow.locator('button[title="Send article path to chat"]').evaluate(button=>button.click());
          await waitFor(page, () => target.locator('.rv-chat-attachment-pill').count().then(n => n === before + 1), 'global resource exact owner');
          const renderedPath = await target.locator('.rv-chat-attachment-pill').last().getAttribute('title');
          assert.equal(renderedPath, resourcePath);
          assert.deepEqual(await other.locator('.rv-chat-attachment-pill').evaluateAll(items => items.map(item => item.getAttribute('title'))), otherPaths);
          assert.deepEqual([await target.locator('textarea').inputValue(), await other.locator('textarea').inputValue()],drafts);
          (report.resources ??= []).push({ sourceView: 'wiki-viewer', destinationView: view, sourceRelative: resourceRelative, sourcePath: resourcePath,
            workspaceId: report.workspace.id, threadId, host: owner, renderedPath, sourceVisibleAtInvocation:false, actualRetainedDOMButton:true, nonTargetPreserved: true });
        }
        await selectPanel(page, view, title);
      }
      assert.equal(sent.slice(stagedStart).filter(f => ['prompt', 'thread:open-assistant'].includes(f.type)).length, 0);
      await tab.click();
      for (const [target, other, threadId] of [[main, side, mainId], [side, main, sideId]]) {
        const text = `MATERIAL ACCEPT ${view} ${threadId}`;
        const otherState = [await other.locator('textarea').inputValue(), await other.locator('.rv-chat-attachment-pill').count()];
        await target.locator('textarea').fill(text);
        const attachmentPaths = await target.locator('.rv-chat-attachment-pill').evaluateAll(items => items.map(item => item.getAttribute('title')));
        await target.getByRole('button', { name: 'Send message' }).click();
        await waitFor(page, () => sent.some(f => f.type === 'prompt' && f.threadId === threadId && f.user_input === text), 'public prompt enqueue');
        assert.equal(await target.locator('.rv-message-user-content', { hasText: text }).count(), 0, 'no optimistic bubble');
        assert.equal(await target.locator('textarea').inputValue(), text, 'draft retained before ACK');
        // Newer editing and removal/readdition while pending are covered by the renderer generation checks;
        // this native route checks actual receipt-driven clearing of its accepted snapshot.
        await waitFor(page, () => received.some(f => f.type === 'message:sent' && f.threadId === threadId && f.content === text), 'real ACK');
        await target.locator('.rv-message-user-content', { hasText: text }).waitFor();
        await waitFor(page, () => target.locator('textarea').inputValue().then(v => v === ''), 'exact draft ACK clear');
        assert.equal(await target.locator('.rv-chat-attachment-pill').count(), 0);
        assert.deepEqual([await other.locator('textarea').inputValue(), await other.locator('.rv-chat-attachment-pill').count()], otherState);
        await waitFor(page, () => read(db => db.prepare('SELECT COUNT(*) n FROM exchanges WHERE thread_id = ? AND user_input = ?').get(threadId, text).n === 1), 'saved exchange');
        const exchange = read(db => db.prepare('SELECT id, thread_id, user_input, metadata FROM exchanges WHERE thread_id = ? AND user_input = ?').get(threadId, text));
        const ack = received.find(f => f.type === 'message:sent' && f.threadId === threadId && f.content === text);
        const request = sent.find(f => f.type === 'prompt' && f.threadId === threadId && f.user_input === text);
        assert.equal(request.requestId, ack.requestId);
        const metadata = JSON.parse(exchange.metadata); assert.deepEqual(metadata.attachments.map(a => a.path), attachmentPaths);
        report.sends.push({ view, threadId, requestId: ack.requestId, turnId: ack.turnId, exchangeId: exchange.id,
          attachments: metadata.attachments, noOptimisticBubble: true, exactACKClear: true, nonTargetPreserved: true });
      }
    }
    assert.deepEqual(report.resources?.map(r => r.host), ['main', 'side'], 'required global resources for both destinations');
    assert.equal(report.galleries?.length, 4);
    report.status = 'PASS';
  } catch (error) {
    if(runtime) report.nativeWindow=await runtime.app.evaluate(({app,BrowserWindow})=>({appActive:app.isActive(),appHidden:app.isHidden(),windows:BrowserWindow.getAllWindows().map(w=>({id:w.id,url:w.webContents.getURL(),focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),focusable:w.isFocusable(),key:BrowserWindow.getFocusedWindow()===w}))})).catch(()=>null);
    if(runtime) report.failureDOM = await runtime.page.evaluate(()=>({observations:window.__materialNativeObservations,pills:[...document.querySelectorAll('.rv-chat-attachment-pill')].map(el=>({path:el.title,threadId:el.closest('.rv-chat-area')?.dataset.chatThreadId})),status:[...document.querySelectorAll('.rv-toast,.rv-connection-status,.rv-workspace-name')].map(el=>el.textContent),destinations:[...document.querySelectorAll('.rv-chat-area')].map(el=>({threadId:el.dataset.chatThreadId,viewId:el.dataset.chatViewId,host:el.dataset.chatHost,surfaceId:el.dataset.surfaceId})),capability:typeof window.electronAPI?.capturePage,connected:document.body.innerText.includes('Connected')})).catch(()=>null);
    report.status = 'FAIL'; report.error = { name: error.name, message: error.message }; throw error;
  } finally {
    if (runtime) { report.lingeringOwnedPids = await closeOwnedApp(runtime); assert.deepEqual(report.lingeringOwnedPids, []); }
    if (fixture) report.cleanup = cleanupFixture(fixture, token);
    report.wire = { sent, received: received.map(({type,requestId,threadId,workspaceId,savedPath})=>({type,requestId,threadId,workspaceId,savedPath})) };
    report.protectedProcessesAfter = processRows(); report.ended = new Date().toISOString();
    fs.writeFileSync(path.join(evidenceRoot, 'native-receipt.json'), JSON.stringify(report, null, 2) + '\n');
    assertDisposablePath(tempRoot, token); fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  return { status: report.status, captures: report.captures.length, sends: report.sends.length, receipt: path.join(evidenceRoot, 'native-receipt.json') };
}
if (process.argv[1] === import.meta.filename) console.log(JSON.stringify(await runChatMaterialNativeScenario()));
