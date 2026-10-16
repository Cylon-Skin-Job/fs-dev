/* A03 runtime assertions on installed Chrome; only disposable fixture mutations. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
module.exports=async function({context,root,file,child,manifest}){
  const page=await context.newPage(),errors=[],network=[];const simulatedNode='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',simulatedRevision='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('file:'))network.push(r.url());});
  const publicUpdate=mode=>JSON.parse(execFileSync(process.env.LP_PYTHON||'python3',[path.join(__dirname,'restore_sample.py'),root,mode],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'}));
  const ready=()=>page.waitForFunction(()=>globalThis.LPHost&&document.querySelector('.rv-logo'));
  const settled=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,30)))));
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(LPHost.storageKey)));
  const originalClipboard=execFileSync('/usr/bin/pbpaste',[],{encoding:'utf8'});
  const prepare=publicUpdate('prepare');
  try{
    await page.setViewportSize({width:1100,height:600});await page.goto(file);await page.waitForFunction(()=>globalThis.LPHost);
    await page.evaluate(()=>LPHost.showPlan());await settled();
    await page.locator('.rv-timeline-viewport').evaluate(x=>{x.scrollLeft=260;x.focus({preventScroll:true});});await settled();const planState=await saved();
    await page.reload();await page.waitForFunction(()=>globalThis.LPHost);await settled();assert.equal(await page.locator('.rv-timeline-viewport').evaluate(x=>x.scrollLeft),260);
    assert.equal((await saved()).focus.role,'timeline');assert.equal((await saved()).ticket_uuid,null);
    await page.evaluate(id=>LPHost.showTicket(id),manifest.ticket_uuids[0]);await ready();await settled();
    const ids=await page.evaluate(()=>{const t=LPHost.model.tickets[0];return {ticket:t.root.uuid,capture:t.records.find(x=>x.kind==='content'&&x.body.title==='Initial Capture').uuid,
      category:t.records.find(x=>x.kind==='category'&&x.body.title==='Capture').uuid,workflow:t.records.find(x=>x.kind==='workflow_node'&&x.body.title==='Intake Capture').uuid};});
    const node=id=>page.locator('[data-node-uuid="'+id+'"]');
    await node(ids.workflow).locator('.rv-chevron').first().click(); // explicit false
    await node(ids.category).locator('.rv-chevron').first().click();await node(ids.category).locator('.rv-chevron').first().click(); // explicit true
    await page.evaluate(()=>{scrollTo(0,80);document.querySelector('.rv-workflow').scrollTop=210;document.querySelector('.rv-ticket-content').scrollTop=140;});await settled();
    await node(ids.capture).getByRole('button',{name:'Initial Capture',exact:true}).focus();await settled();
    // A toggle intent is durable even if a reload immediately follows its gesture.
    await Promise.all([page.waitForNavigation(),page.evaluate(id=>{document.querySelector('[data-node-uuid="'+id+'"] .rv-chevron').click();location.reload();},ids.workflow)]);await ready();await settled();
    assert.equal(await node(ids.workflow).locator('.rv-chevron').first().getAttribute('aria-expanded'),'true');await node(ids.workflow).locator('.rv-chevron').first().click();
    await page.evaluate(()=>{scrollTo(0,80);document.querySelector('.rv-workflow').scrollTop=210;document.querySelector('.rv-ticket-content').scrollTop=140;});await node(ids.capture).getByRole('button',{name:'Initial Capture',exact:true}).focus();await settled();
    const beforeState=await saved();assert.equal(beforeState.expanded[ids.workflow],false);assert.equal(beforeState.expanded[ids.category],true);
    assert.ok(beforeState.scroll.main.y>0);assert.ok(beforeState.scroll.containers['workflow:'+ids.ticket].y>0);assert.ok(beforeState.scroll.containers['categories:'+ids.ticket].y>0);
    await page.reload();await ready();await settled();
    const restored=await saved();assert.equal(restored.ticket_uuid,ids.ticket);assert.equal(restored.section_uuid,ids.category);
    assert.equal(await node(ids.workflow).locator('.rv-chevron').first().getAttribute('aria-expanded'),'false');assert.equal(await node(ids.category).locator('.rv-chevron').first().getAttribute('aria-expanded'),'true');
    assert.deepEqual(restored.scroll,beforeState.scroll);assert.deepEqual(restored.focus,beforeState.focus);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.targetUuid),ids.capture);
    await node(ids.capture).getByRole('button',{name:'Initial Capture',exact:true}).click();await page.locator('dialog').waitFor();
    const content=await page.locator('.rv-modal-scroll').textContent();const actual=await page.evaluate(id=>LPHost.model.tickets[0].records.find(x=>x.uuid===id),ids.capture);
    assert.deepEqual(JSON.parse(content),actual);assert.match(content,/<script>/);assert.match(content,/javascript:alert/);assert.equal(await page.evaluate(()=>globalThis.LP_UNSAFE),undefined);
    assert.equal(await page.locator('dialog a').count(),0);await page.locator('.rv-modal-scroll').evaluate(x=>{x.scrollTop=260;x.focus({preventScroll:true});});await settled();
    const modalState=await saved();assert.equal(modalState.modal.selector,'current');assert.ok(modalState.scroll.containers['modal:'+ids.capture].y>0);
    await page.reload();await ready();await page.locator('dialog').waitFor();await settled();assert.equal(await page.locator('.rv-modal-scroll').textContent(),content);
    assert.equal((await saved()).scroll.containers['modal:'+ids.capture].y,modalState.scroll.containers['modal:'+ids.capture].y);
    // Pin current bytes before a real public commit; old tab remains a captured generation.
    await page.getByRole('button',{name:'Pin revision',exact:true}).click();await settled();const pin=await saved();const pinContent=await page.locator('.rv-modal-scroll').textContent();
    assert.equal(pin.modal.selector,'pinned');assert.equal(pin.modal.revision_uuid,actual.revision_uuid);
    const prior=await context.newPage();await prior.goto(child);await prior.locator('.rv-logo').waitFor();const oldGeneration=await prior.evaluate(()=>LPHost.model.generation);
    const advance=publicUpdate('advance');assert.notEqual(advance.generation,prepare.generation);
    assert.equal(await page.evaluate(()=>LPHost.model.generation),prepare.generation);assert.equal(await prior.evaluate(()=>LPHost.model.generation),oldGeneration);
    assert.match(await prior.locator('.rv-generation').textContent(),new RegExp(oldGeneration));
    await page.reload();await ready();await page.locator('dialog').waitFor();await settled();assert.equal(await page.evaluate(()=>LPHost.model.generation),advance.generation);
    assert.equal(await page.locator('.rv-modal-scroll').textContent(),pinContent);assert.equal((await saved()).modal.revision_uuid,pin.modal.revision_uuid);
    assert.match(await page.locator('.rv-ticket-content').textContent(),/New restore-default fixture node/);
    const newItem=await page.evaluate(()=>LPHost.model.tickets[0].records.find(x=>x.kind==='source_item'&&x.body.source_alias==='todo-restore-new').uuid);assert.equal(Object.hasOwn((await saved()).expanded,newItem),false);
    const todo=await page.evaluate(()=>LPHost.model.tickets[0].records.find(x=>x.kind==='content'&&x.body.title==='ToDo').body.category_uuid);assert.equal(await node(todo).locator('.rv-chevron').first().getAttribute('aria-expanded'),'true');
    await page.getByRole('button',{name:'Show current',exact:true}).click();await settled();assert.match(await page.locator('.rv-modal-scroll').textContent(),/Restore stress fixture advance/);assert.notEqual(await page.locator('.rv-modal-scroll').textContent(),pinContent);
    await page.reload();await ready();await page.locator('dialog').waitFor();assert.match(await page.locator('.rv-modal-scroll').textContent(),/Restore stress fixture advance/);
    // Exercise the actual browser clipboard call once and its selectable failure route.
    await page.evaluate(()=>{globalThis.LPCopies=0;const original=navigator.clipboard.writeText.bind(navigator.clipboard);globalThis.LPWriteSystem=value=>{LPCopies++;return original(value);};navigator.clipboard.writeText=LPWriteSystem;});
    const copyText=await page.locator('.rv-modal-scroll').textContent();await page.bringToFront();await page.getByRole('button',{name:'Copy JSON',exact:true}).click();await settled();assert.equal(await page.evaluate(()=>LPCopies),1);
    const actualClipboard=execFileSync('/usr/bin/pbpaste',[],{encoding:'utf8'});const clipboardSucceeded=actualClipboard===copyText;
    assert.equal(clipboardSucceeded,true,'Actual system clipboard must match the exact displayed JSON');
    await page.evaluate(()=>{navigator.clipboard.writeText=()=>{LPCopies++;return Promise.reject(Error('test denial'));};});await page.getByRole('button',{name:'Copy JSON',exact:true}).click();await settled();assert.equal(await page.evaluate(()=>LPCopies),2);
    assert.equal(await page.evaluate(()=>getSelection().toString()),copyText);assert.match(await page.locator('dialog').textContent(),/Copy unavailable/);
    await page.getByRole('button',{name:'Close',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.dataset.targetUuid),ids.capture);
    await page.evaluate(()=>{navigator.clipboard.writeText=LPWriteSystem;});const logoText=await page.locator('.rv-logo').textContent();await page.locator('.rv-logo').click();await settled();assert.equal(await page.evaluate(()=>LPCopies),3);assert.equal(execFileSync('/usr/bin/pbpaste',[],{encoding:'utf8'}),logoText);
    await page.evaluate(()=>{navigator.clipboard.writeText=()=>{LPCopies++;return Promise.reject(Error('test denial'));};});await page.locator('.rv-logo').click();await settled();assert.equal(await page.evaluate(()=>LPCopies),4);assert.equal(await page.locator('.rv-copy-fallback').textContent(),logoText);
    await node(ids.capture).getByRole('button',{name:'Initial Capture',exact:true}).click();await page.locator('dialog').waitFor();
    await Promise.all([page.waitForNavigation(),page.evaluate(()=>{document.querySelector('[data-focus-role="modal-close"]').click();location.reload();})]);await ready();await settled();assert.equal(await page.locator('dialog').count(),0);
    await prior.reload();await prior.locator('.rv-logo').waitFor();assert.equal(await prior.evaluate(()=>LPHost.model.generation),advance.generation);await prior.close();
    // Fresh host pages receive out-of-range UI storage / deleted-target models at load.
    const clampPage=await context.newPage();await clampPage.setViewportSize({width:1100,height:600});
    await clampPage.addInitScript(()=>{const read=Storage.prototype.getItem;Storage.prototype.getItem=function(key){const raw=read.call(this,key);if(!raw)return raw;const v=JSON.parse(raw);if(v.scroll){v.scroll.main={x:999999,y:999999};Object.values(v.scroll.containers).forEach(x=>{x.x=999999;x.y=999999;});return JSON.stringify(v);}return raw;};});
    await clampPage.goto(file);await clampPage.locator('.rv-logo').waitFor();await clampPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const clamped=await clampPage.evaluate(()=>({main:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),containers:[...document.querySelectorAll('[data-scroll-key]')].map(x=>({y:x.scrollTop,max:Math.max(0,x.scrollHeight-x.clientHeight)}))}));
    assert.ok(clamped.max>0);assert.equal(clamped.main,clamped.max);clamped.containers.forEach(x=>assert.equal(x.y,x.max));await clampPage.close();
    // LP02 deletion is absent: isolated pre-host parsing simulates missing current target
    // and a new expandable node, retaining original historical revisions. No source writes.
    await node(ids.capture).getByRole('button',{name:'Initial Capture',exact:true}).click();await page.locator('dialog').waitFor();await settled();
    const deletedState=await saved(),key=await page.evaluate(()=>LPHost.storageKey),deletedPage=await context.newPage();await deletedPage.setViewportSize({width:1100,height:600});
    await deletedPage.addInitScript(({ids,simulatedNode,simulatedRevision,state,key})=>{localStorage.setItem(key,JSON.stringify(state));const parse=JSON.parse;JSON.parse=function(raw,...args){const data=parse.call(this,raw,...args);if(data?.tickets?.[ids.ticket]){const snapshot=data.tickets[ids.ticket];snapshot.current=snapshot.current.filter(x=>x.entry_uuid!==ids.capture);const template=snapshot.revisions.find(x=>x.kind==='workflow_node'&&x.body.parent_uuid===null);const fresh=parse(JSON.stringify(template));fresh.uuid=simulatedNode;fresh.revision_uuid=simulatedRevision;fresh.body.title='New node (host-model simulation)';fresh.body.order=999;snapshot.revisions.push(fresh);snapshot.current.push({entry_uuid:fresh.uuid,revision_uuid:fresh.revision_uuid});}return data;};},{ids,simulatedNode,simulatedRevision,state:deletedState,key});
    await deletedPage.goto(file);await deletedPage.locator('.rv-logo').waitFor();await deletedPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await deletedPage.locator('dialog').count(),0);assert.equal(await deletedPage.evaluate(()=>document.activeElement.dataset.targetUuid),ids.category);assert.equal(await deletedPage.evaluate(()=>JSON.parse(localStorage.getItem(LPHost.storageKey)).section_uuid),ids.category);
    assert.equal(await deletedPage.locator('[data-node-uuid="'+simulatedNode+'"] .rv-chevron').first().getAttribute('aria-expanded'),'true');assert.equal(await deletedPage.evaluate(id=>Object.hasOwn(JSON.parse(localStorage.getItem(LPHost.storageKey)).expanded,id),simulatedNode),false);await deletedPage.close();
    await page.goto(child);await ready();assert.equal(await page.evaluate(()=>LPHost.model.generation),advance.generation);
    await page.screenshot({path:path.join(root,'chrome-restore-ticket.png'),fullPage:true});
    // Isolated actual Chrome pages load normal content under storage access/read/write faults.
    const storage=[];
    for(const mode of ['denied','corrupt','invalid','quota']){const fault=await context.newPage();await fault.addInitScript(({mode})=>{
      if(mode==='denied')Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}});
      else if(mode==='corrupt'||mode==='invalid')Storage.prototype.getItem=()=>mode==='corrupt'?'{broken':'{"version":1}';
      else Storage.prototype.setItem=()=>{throw Error('quota');};
    },{mode});await fault.goto(child);await fault.locator('.rv-logo').waitFor();await fault.locator('.rv-header .rv-notice').waitFor();assert.match(await fault.locator('.rv-header .rv-notice').textContent(),/Read-only content remains available/);assert.equal(await fault.locator('.rv-ticket').count(),1);storage.push(mode);await fault.close();}
    // Shared ticket-view storage never changes the identity of a child entry.
    const aliasPage=await context.newPage();await aliasPage.goto(child);await aliasPage.locator('.rv-logo').waitFor();
    await aliasPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const embeddedFirst=await aliasPage.evaluate(()=>LPHost.model.ticket_uuid);assert.equal(await aliasPage.locator('.rv-ticket').getAttribute('data-ticket-uuid'),embeddedFirst);
    await aliasPage.getByRole('button',{name:'Initial Capture',exact:true}).click();await aliasPage.locator('dialog').waitFor();
    const currentPlan=JSON.parse(fs.readFileSync(path.join(root,'work-tickets/sample/CURRENT/plan.json')));
    const secondBinding=currentPlan.revisions.find(x=>x.kind==='plan').body.ticket_bindings.find(x=>x.ticket_uuid!==embeddedFirst);
    const secondUrl=pathToFileURL(path.join(root,'work-tickets/sample',secondBinding.current_home,'ticket.html')).href;
    await aliasPage.goto(secondUrl);await aliasPage.locator('.rv-logo').waitFor();await aliasPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const embeddedSecond=await aliasPage.evaluate(()=>LPHost.model.ticket_uuid);assert.notEqual(embeddedSecond,embeddedFirst);assert.equal(await aliasPage.locator('.rv-ticket').getAttribute('data-ticket-uuid'),embeddedSecond);
    assert.equal(await aliasPage.locator('dialog').count(),0);assert.equal(await aliasPage.evaluate(()=>JSON.parse(localStorage.getItem(LPHost.storageKey)).section_uuid),null);
    await aliasPage.reload();await aliasPage.locator('.rv-logo').waitFor();assert.equal(await aliasPage.locator('.rv-ticket').getAttribute('data-ticket-uuid'),embeddedSecond);await aliasPage.close();
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
    const report={result:'PASS',generation:advance.generation,initial_generation:prepare.generation,old_open_generation:oldGeneration,clipboard_system_readback:clipboardSucceeded,
      checks:['current-first latest embedded snapshot','selected ticket and section','explicit false and true expansion','independent main workflow categories scroll and focus','current modal and nested scroll reload','exact historical pin unchanged after public commit','new public-seeded ToDo visible and simulated new expandable node defaults','current modal switches to latest record','real public commit plan+ticket alias generation agreement','earlier open page labels old generation','postlayout scroll clamping','actual JSON payload rendered safely and supporting paths text only','one browser system clipboard attempt and selectable failure fallback','logo copy once with selectable text fallback','sequential child aliases enforce embedded target and clear foreign modal/selection'],
      deletion_evidence:'Host-model simulation only: pre-host browser parsing removes a current binding and adds a synthetic expandable node; original retained historical revisions untouched. No public LP02 deletion operation claimed.',storage_faults:storage,errors,network};
    fs.writeFileSync(path.join(root,'chrome-restore-report.json'),JSON.stringify(report,null,2)+'\n');return report;
  }finally{execFileSync('/usr/bin/pbcopy',[],{input:originalClipboard});await page.close();}
};
