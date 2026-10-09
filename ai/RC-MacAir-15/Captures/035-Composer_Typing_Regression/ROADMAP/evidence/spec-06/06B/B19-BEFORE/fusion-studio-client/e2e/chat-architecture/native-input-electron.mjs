import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanupFixture, closeOwnedApp, createProject, selectPanel, stageAndLaunch, withDb, waitFor,clickWorkspaceMenu } from './electron-case-helpers.mjs';
import { buildF2Exchanges, materializeF3Workspace } from './fixture-workloads.mjs';
import { newGroup } from './soak-actions.mjs';
import { observeNativeInput,manualInputWindow } from './manual-input-window.mjs';

const [token,evidenceRoot,tempRoot,manual] = process.argv.slice(2);
assert.match(token||'',/^chat-architecture-owner-chat-arch-/);
const manualRequested=manual==='--manual' || process.env.FUSION_CHAT_ARCH_NATIVE_MANUAL_MS==='600000';
assert.ok(!process.env.FUSION_CHAT_ARCH_NATIVE_MANUAL_MS || process.env.FUSION_CHAT_ARCH_NATIVE_MANUAL_MS==='600000');
const result={status:'setup',nativeMethods:[],ownerAcceptance:'pending; explicit timestamped owner receipt required'};
let fixture,runtime,failure;
const save=()=>fs.writeFileSync(path.join(evidenceRoot,'native-input-result.json'),JSON.stringify(result,null,2));
const script=source=>spawnSync('/usr/bin/osascript',['-e',source],{encoding:'utf8',timeout:10000});
try {
  const lock=spawnSync('/usr/sbin/ioreg',['-n','Root','-d1'],{encoding:'utf8'}).stdout;
  result.capability={at:new Date().toISOString(),locked:/"IOConsoleLocked" = Yes/.test(lock)};
  if(result.capability.locked)throw Object.assign(Error('Desktop locked; no native interaction attempted'),{code:'NATIVE_CAPABILITY_UNAVAILABLE'});
  const repoRoot=path.resolve(import.meta.dirname,'../../..');
  fixture=await stageAndLaunch({repoRoot,token,tempRoot,evidenceRoot,casePrefix:'native',eventScript:{frameIntervalMs:50,textFrames:10000}});
  runtime=await fixture.launch();
  const project=path.join(fixture.workspaceRoot,'native-input');
  await createProject(runtime.app,runtime.page,project,'Native Input Fixture');
  await runtime.page.reload();await runtime.page.waitForFunction(()=>document.body.innerText.includes('Connected'));
  const {group,threadId}=await newGroup(runtime,fixture);
  await closeOwnedApp(runtime);runtime=null;
  const f2=buildF2Exchanges(),f3=materializeF3Workspace(project);
  withDb(fixture.dbPath,{},db=>db.transaction(()=>{const add=db.prepare('INSERT INTO exchanges(thread_id,seq,ts,user_input,assistant,metadata) VALUES(?,?,?,?,?,?)');for(const x of f2.exchanges)add.run(threadId,x.seq,1780000000000+x.seq,x.user,JSON.stringify(x.assistant),JSON.stringify(x.metadata));})());
  runtime=await fixture.launch();
  const panel=await selectPanel(runtime.page,'capture-viewer','Captures');
  await panel.locator(`.rv-chat-item[data-thread-group-id="${group.group_id}"]`).click();
  await waitFor(runtime.page,()=>panel.locator('.rv-message').count().then(n=>n===60),'native F2');
  const composer=panel.locator('textarea.rv-chat-input');await composer.fill('');await composer.focus();
  result.fixture={rendererLifetime:'fresh isolated candidate; not the post-soak renderer',f2:f2.manifest,f3:{...f3,files:undefined,supportFiles:undefined},project,profile:fixture.profileRoot,pid:runtime.pid,threadId};
  const focusOwned=()=>runtime.app.evaluate(({app,BrowserWindow})=>{
    const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('fusion-shell://app/'));
    if(!w)throw Error('Owned fixture window unavailable');
    w.show();w.moveTop();app.focus({steal:true});w.focus();w.webContents.focus();
    return {at:Date.now(),pid:process.pid,windowId:w.id,url:w.webContents.getURL(),focused:w.isFocused()};
  });
  result.focus=[await focusOwned()];
  await observeNativeInput(runtime.page,true);
  try {
  const nativePrefix=`tell application "System Events"\nset targetProcess to first application process whose unix id is ${runtime.pid}\nif frontmost of targetProcess is not true then error "Owned fixture is not frontmost"\n`;
  const expected='native keyboard 2227ebc2 ';
  const typed=script(nativePrefix+`keystroke "${expected}"\nend tell`);
  result.nativeMethods.push({method:'macOS System Events keystroke to verified exact owned frontmost PID',exit:typed.status,error:typed.stderr.trim()});
  if(typed.status!==0)throw Object.assign(Error('Native keyboard capability unavailable: '+typed.stderr.trim()),{code:'NATIVE_CAPABILITY_UNAVAILABLE'});
  await runtime.page.waitForTimeout(500);
  const actual=await composer.inputValue();result.keyboard={expected,actual,exact:actual===expected,wordBoundary:'native OS trailing space after synthetic suffix'};assert.equal(actual,expected);
  // Keep OS clipboard contents recoverable across the explicit native paste.
  const paste=' native paste 😀 café 日本語';
  const prior=await runtime.app.evaluate(({clipboard})=>clipboard.availableFormats().map(format=>({format,bytes:[...clipboard.readBuffer(format)]})));
  try {
    await runtime.app.evaluate(({clipboard},text)=>clipboard.writeText(text),paste);
    await composer.focus();result.focus.push(await focusOwned());
    const pasted=script(nativePrefix+'keystroke "v" using command down\nend tell');
    result.nativeMethods.push({method:'macOS Cmd+V with Electron OS clipboard',exit:pasted.status,error:pasted.stderr.trim()});
    assert.equal(pasted.status,0);await runtime.page.waitForTimeout(500);
    result.paste={expected:expected+paste,actual:await composer.inputValue()};assert.equal(result.paste.actual,result.paste.expected);
  } finally {await runtime.app.evaluate(({clipboard},formats)=>{clipboard.clear();for(const f of formats)clipboard.writeBuffer(f.format,Buffer.from(f.bytes));},prior);}
  // Reproduce the original synthetic label in its actual public name field.
  await clickWorkspaceMenu(runtime.app,'Create New Project...');
  const name=runtime.page.locator('input[placeholder="Derived from folder name if blank"]');
  await name.fill('');await name.focus();result.focus.push(await focusOwned());
  const label='R5 R6 2227ebc2 ';
  const named=script(nativePrefix+`keystroke "${label}"\nkey code 48\nend tell`);
  result.nativeMethods.push({method:'macOS keystroke original synthetic workspace label, trailing space and Tab in exact owned modal',exit:named.status,error:named.stderr.trim()});
  assert.equal(named.status,0);await runtime.page.waitForTimeout(750);
  result.workspaceLabel={expected:label,actual:await name.inputValue(),submitted:false};
  assert.equal(result.workspaceLabel.actual,label);
  await runtime.page.getByRole('button',{name:'Cancel',exact:true}).click();
  result.status='native-keyboard-paste-passed-manual-pending';
  } catch(error) {
    if(error.code!=='NATIVE_CAPABILITY_UNAVAILABLE' || !manualRequested)throw error;
    result.automationCapability={code:error.code,message:error.message};
    result.status='manual-ready-automation-unavailable';
  }
  result.events=await runtime.page.evaluate(()=>window.__nativeInputEvents);
  result.ime='not established: OS clipboard Unicode is not IME composition';
  result.emoji=result.paste?'native Unicode paste verified; Character Palette/manual autocomplete remains separate':'not established';
  save();
  if(manualRequested) {
    await manualInputWindow(runtime,600000,result.fixture,window=>{
      result.manualWindow=window;result.events=window.events ?? result.events;save();
    });
  }
} catch(error){failure=error;result.status=error.code==='NATIVE_CAPABILITY_UNAVAILABLE'?'capability-unavailable':'failed';result.failure={code:error.code??null,message:error.message,stack:error.stack};}
finally{
  if(runtime)result.events=await runtime.page.evaluate(()=>window.__nativeInputEvents ?? []).catch(()=>[]);
  result.lingering=await closeOwnedApp(runtime);if(fixture)result.cleanup=cleanupFixture(fixture,token);save();
}
assert.deepEqual(result.lingering,[]);
if(failure)throw failure;

// Script evidence cannot attest the external native/IME or owner symptom receipt.
if (!failure) { console.log('NATIVE_AUTOMATION_RECORDED_OWNER_ACCEPTANCE_PENDING'); process.exitCode=2; }
