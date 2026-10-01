import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChat, selectPanel, waitFor, withDb } from './electron-case-helpers.mjs';

export function observeRoutes(page, receiptPath) {
  const evidence = { sequence:0, frames: [], content: {}, errors: [], worksurfaces:[] };
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('websocket', socket => {
    for (const [event, direction] of [['framesent', 'outbound'], ['framereceived', 'inbound']]) {
      socket.on(event, ({ payload }) => {
        let f; try { f = JSON.parse(String(payload)); } catch { return; }
        if (f.type === 'content') {
          const c = evidence.content[f.threadId] ||= { count: 0, firstAt: Date.now(), maxCharacters: 0 };
          c.count++; c.lastAt = Date.now(); c.maxCharacters = Math.max(c.maxCharacters, String(f.text ?? f.content ?? '').length);
        }
        if (['prompt','message:sent','turn_begin','turn_end','chat-turn:saved','thread:action:completed','thread:action:error','state:worksurface_result','state:worksurface_error','state:worksurface_changed','error'].includes(f.type)) {
          const record = { sequence:++evidence.sequence, at: Date.now(), direction, type:f.type, action:f.action,
            requestId:f.requestId, threadId:f.threadId, turnId:f.turnId, code:f.code,
            receiptOutcome:f.receipt?.outcome, groupId:f.threadGroupId, lane:f.lane, contentRevision:f.contentRevision, placementRevision:f.placementRevision };
          evidence.frames.push(record);
          if(receiptPath)fs.appendFileSync(receiptPath,JSON.stringify(record)+"\n");
          if (evidence.frames.length > 1000) evidence.frames.shift();
        }
      });
    }
  });
  return evidence;
}
export const dbRead = (fixture, fn) => withDb(fixture.dbPath, { readonly:true, fileMustExist:true }, fn);
export async function newGroup(runtime, fixture, panelId='capture-viewer', title='Captures') {
  const panel = await createChat(runtime.page, fixture.dbPath, panelId, title);
  const group = dbRead(fixture, db => db.prepare('SELECT * FROM thread_groups ORDER BY rowid DESC LIMIT 1').get());
  await panel.locator(`.rv-chat-item[data-thread-group-id="${group.group_id}"]`).click();
  await panel.locator(`[data-chat-thread-id="${group.current_primary_thread_id}"] textarea.rv-chat-input`).waitFor();
  await waitFor(runtime.page, () => panel.locator(`[data-chat-thread-id="${group.current_primary_thread_id}"] textarea.rv-chat-input`).isEnabled(), 'new group ready');
  return { panel, group, threadId:group.current_primary_thread_id };
}
export async function send(runtime, root, routes, text) {
  const from = routes.sequence;
  const composer = root.locator('textarea.rv-chat-input').first();
  await composer.fill(text);
  await root.getByRole('button', { name:'Send message', exact:true }).click();
  await waitFor(runtime.page, () => routes.frames.filter(f=>f.sequence>from).some(f=>f.type==='message:sent'), 'correlated prompt acceptance');
  const prompt = routes.frames.filter(f=>f.sequence>from).find(f=>f.type==='prompt');
  const ack = routes.frames.filter(f=>f.sequence>from).find(f=>f.type==='message:sent');
  assert.ok(prompt?.requestId && ack?.turnId);
  assert.equal(prompt.requestId, ack.requestId);
  assert.equal(prompt.threadId, ack.threadId);
  await root.locator('button[title="Stop generating"]').waitFor();
  return { prompt, ack };
}
export async function stop(runtime, root, fixture, threadId) {
  await root.locator('button[title="Stop generating"]').click();
  await waitFor(runtime.page, () => root.locator('textarea.rv-chat-input').first().isEnabled()
    .then(async enabled => enabled && await root.getByRole('button', {name:'Send message',exact:true}).count()===1), 'saved Stop idle', 30_000);
  const receipt = dbRead(fixture, db=>db.prepare('SELECT request_id,turn_id,outcome FROM prompt_submission_receipts WHERE thread_id=? ORDER BY rowid DESC LIMIT 1').get(threadId));
  const exchange = dbRead(fixture, db=>db.prepare('SELECT id,metadata FROM exchanges WHERE thread_id=? ORDER BY seq DESC LIMIT 1').get(threadId));
  assert.equal(receipt.outcome, 'accepted');
  assert.equal(JSON.parse(exchange.metadata).partial,true);
  return { receipt, exchangeId:exchange.id };
}
export async function deleteGroup(runtime, fixture, group, nativeCheckpoint) {
  const panel = await selectPanel(runtime.page, group.view_id, group.view_id==='file-viewer'?'Files':'Captures');
  const row = panel.locator(`.rv-chat-item[data-thread-group-id="${group.group_id}"]`);
  await row.locator('.rv-thread-menu-btn').click();
  const trigger=()=>runtime.page.getByRole('menu', {name:'Thread options'}).getByRole('menuitem',{name:'Delete',exact:true}).click();
  const durable=async()=>{
    await waitFor(runtime.page, () => !dbRead(fixture,db=>db.prepare('SELECT group_id FROM thread_groups WHERE group_id=?').get(group.group_id)), 'group SQL deletion');
    await row.waitFor({state:'detached'});
  };
  if(nativeCheckpoint)await nativeCheckpoint.run(group,trigger,durable);
  else {await trigger();await durable();}
}
export async function lifecycleCycle(runtime, fixture, routes, number, baseGroupId, nativeCheckpoint) {
  const {page} = runtime;
  const snapshot=async label=>{routes.worksurfaces.push({cycle:number,label,...await page.evaluate(()=>window.__chatArchWorksurfaceObservation())});if(routes.worksurfaces.length>20)routes.worksurfaces.shift();};
  const item = await newGroup(runtime,fixture);
  const draft = `cycle ${number} exact draft before Move`;
  await item.panel.locator('textarea.rv-chat-input').first().fill(draft);
  await item.panel.locator('.rv-chat-header-btn[aria-label="More options"]').first().click();
  await page.getByRole('menu',{name:'Chat options'}).getByRole('menuitem',{name:'Move Chat to Side Chat'}).click();
  await waitFor(page,()=>dbRead(fixture,db=>db.prepare('SELECT count(*) n FROM thread_group_members WHERE group_id=?').get(item.group.group_id).n)===2,'Move peers');
  const tab = page.locator('.rv-view-tab-list [role="tab"]',{hasText:'Side Chat'});
  await tab.waitFor(); await tab.click();
  const side = page.locator('.rv-chat-area[data-chat-thread-id="'+item.threadId+'"]');
  // Surface identity is explicit in the production DOM.
  await side.waitFor();
  assert.equal(await side.locator('textarea.rv-chat-input').inputValue(),draft);
  const mainId = dbRead(fixture,db=>db.prepare('SELECT current_primary_thread_id id FROM thread_groups WHERE group_id=?').get(item.group.group_id).id);
  const main = page.locator('.rv-panel.active .rv-chat-area[data-chat-thread-id="'+mainId+'"]');
  const sideSend = await send(runtime,side,routes,`cycle ${number} Side stream`);
  const mainSend = await send(runtime,main,routes,`cycle ${number} Main stream`);
  await page.waitForTimeout(1200);
  assert.ok(routes.content[item.threadId]?.count>0 && routes.content[mainId]?.count>0);
  await selectPanel(page,'file-viewer','Files');
  await selectPanel(page,'capture-viewer','Captures');
  await tab.click();
  const mainBeforeStop = routes.content[mainId]?.count ?? 0;
  const sideStop = await stop(runtime,side,fixture,item.threadId);
  await page.waitForTimeout(600);
  assert.ok(routes.content[mainId]?.count > mainBeforeStop, 'Main continues after exact Side Stop');
  const resumedSide = await send(runtime,side,routes,`cycle ${number} Side next Send after Stop`);
  assert.notEqual(resumedSide.ack.turnId, sideSend.ack.turnId);
  const sideBeforeMainStop = routes.content[item.threadId]?.count ?? 0;
  const mainStop = await stop(runtime,main,fixture,mainId);
  await page.waitForTimeout(600);
  assert.ok(routes.content[item.threadId]?.count > sideBeforeMainStop, 'Side continues after exact Main Stop');
  const resumedSideStop = await stop(runtime,side,fixture,item.threadId);
  const retainedSideDraft = `cycle ${number} retained Side draft`;
  await side.locator('textarea.rv-chat-input').fill(retainedSideDraft);
  await tab.locator('..').locator('.rv-view-tab-close').click();
  await tab.waitFor({state:'detached'});
  const row = item.panel.locator(`.rv-chat-item[data-thread-group-id="${item.group.group_id}"]`);
  await row.locator('.rv-thread-menu-btn').click();
  await page.getByRole('menu',{name:'Thread options'}).getByRole('menuitem',{name:/\(closed\)$/}).click();
  await side.waitFor();
  assert.equal(await side.locator('textarea.rv-chat-input').inputValue(),retainedSideDraft);
  await snapshot("before-reconnect");
  // Transport fault/recovery on the same renderer; never reload the heap.
  const oldSocket=await page.evaluate(() => {
    const s=window.__chatArchSustained.sockets.find(s=>s.readyState===WebSocket.OPEN && s.__fixtureAuthenticated);
    if(!s)throw Error('no authenticated socket');const id=s.__fixtureId;s.close();return id;
  });
  await page.waitForFunction(id=>window.__chatArchSustained.sockets.some(s=>s.__fixtureId!==id && s.readyState===WebSocket.OPEN && s.__fixtureAuthenticated),oldSocket,{timeout:30_000});
  await page.waitForTimeout(1200);
  await snapshot("after-reconnect");
  await selectPanel(page,'capture-viewer','Captures');
  await deleteGroup(runtime,fixture,item.group,nativeCheckpoint);
  await snapshot("after-delete");
  const base = await selectPanel(page,'capture-viewer','Captures');
  await base.locator(`.rv-chat-item[data-thread-group-id="${baseGroupId}"]`).click();
  await waitFor(page,()=>base.locator('.rv-message').count().then(n=>n===60),'equivalent F2 history');
  await base.locator('textarea.rv-chat-input').first().focus();
  await page.waitForTimeout(2000);
  return { number, groupId:item.group.group_id, memberIds:[item.threadId,mainId], sideSend,mainSend,sideStop,mainStop,resumedSide,resumedSideStop,
    faults:['authenticated socket close/reconnect'], viewSwitches:2, move:true, sideCloseReopen:true, delete:true };
}
