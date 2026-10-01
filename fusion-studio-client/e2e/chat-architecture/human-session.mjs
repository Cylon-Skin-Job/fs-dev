import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {_electron as electron} from '@playwright/test';
import {readResumeOptions,stageResumeCode,retainedIdentities,verifyResumedSurface} from './human-session-resume.mjs';
import {stageFixture} from './stage-fixture.mjs';
import {markOwnedDirectory,assertSafePort} from './fixture-lifecycle.mjs';
import {createProject,createChat,withDb,waitFor,descendants} from './electron-case-helpers.mjs';
import {humanFrame,installHumanObserver} from './human-session-observer.mjs';
import {closeHumanRuntime} from './human-session-ownership.mjs';
import {createHumanJournal,assertHumanConfig,humanSmokeReply} from './human-session-recording.mjs';

// This detached driver owns its environment; match the copied workspace subtree.
process.env.FUSION_LOCAL_MACHINE='RC-MacAir-15';
const repoRoot=path.resolve(import.meta.dirname,'../../..');
const resume=readResumeOptions(process.argv.slice(2));
const runId=`human-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const token=`chat-architecture-owner-chat-arch-${runId}`;
const evidenceRoot=path.join(repoRoot,`ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/${resume?'render-diagnostics/HUMAN-RESUME':'spec-06/06B'}`,runId);
fs.mkdirSync(evidenceRoot,{recursive:true});
const tempRoot=resume?.prior.tempRoot??fs.mkdtempSync(path.join(os.tmpdir(),`${runId}-`));if(!resume)markOwnedDirectory(tempRoot,token,'human-session-retained');
const stageRoot=path.join(tempRoot,resume?`stage-${runId}`:'stage'),profileRoot=path.join(tempRoot,'profile'),workspaceRoot=path.join(tempRoot,'workspace');
const journal=createHumanJournal(path.join(evidenceRoot,'events'));
const status={runId,token,driverPid:process.pid,status:'preparing',startedAt:Date.now(),evidenceRoot,tempRoot,stageRoot,profileRoot,workspaceRoot,recording:true,automaticExpiry:false,humanReady:false,skippedResourceSamples:0};
const save=()=>{try{fs.writeFileSync(path.join(evidenceRoot,'session.json.tmp'),JSON.stringify(status,null,2));fs.renameSync(path.join(evidenceRoot,'session.json.tmp'),path.join(evidenceRoot,'session.json'));}catch{status.recording=false;console.error('HUMAN_RECORDING_STATUS_WRITE_FAILED');}};
const record=row=>{try{journal.write({at:Date.now(),...row});}catch{status.recording=false;status.recordingFailure='disk journal write failed';save();console.error('HUMAN_RECORDING_JOURNAL_WRITE_FAILED');}};
let lastDriverBeat=Date.now();
let journalTimer=setInterval(()=>{try{const now=Date.now();record({kind:'driver-heartbeat',gapMs:now-lastDriverBeat,lastRendererBatchAt:status.lastRendererBatchAt??null});lastDriverBeat=now;journal.flush();}catch{status.recording=false;status.recordingFailure='disk flush failed';save();}},1000);
let runtime=null,resourceTimer=null,resourceBusy=false,stopRequested=false,finishResolve;
const finished=new Promise(resolve=>{finishResolve=resolve;});
const finish=reason=>{if(stopRequested)return;stopRequested=true;status.closeReason=reason;save();finishResolve();};
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>finish(signal));
process.on('uncaughtException',error=>{status.fatal={name:error.name,code:error.code??null};save();finish('driver-error');});
process.on('unhandledRejection',()=>{status.fatal={name:'UnhandledRejection'};save();finish('driver-error');});
save();console.log('HUMAN_SESSION_PREPARING '+JSON.stringify(status));
try {
  const staged=resume?stageResumeCode({repoRoot,stageRoot,profileRoot,token}):await stageFixture({repoRoot,stageRoot,profileRoot,workspaceRoot,token,realServer:true});
  if(resume){
    status.retainedToken=resume.prior.retainedToken??resume.prior.token;status.resumedFrom=resume.receiptPath;status.profileBackup=resume.backupRoot;
    status.before=withDb(staged.dbPath,{readonly:true,fileMustExist:true},retainedIdentities);
    assert.ok(status.before.workspaces.some(row=>fs.realpathSync(row.repo_path)===fs.realpathSync(resume.prior.project)),'retained workspace missing');
    fs.writeFileSync(path.join(evidenceRoot,'loaded-stage-files.json'),JSON.stringify(staged.files,null,2));
    status.loadedStageManifestSha256=crypto.createHash('sha256').update(JSON.stringify(staged.files)).digest('hex');save();
  }
  const app=await electron.launch({cwd:staged.stagedClient,args:[path.join(staged.stagedClient,'electron/main.cjs'),`--chat-architecture-token=${token}`],env:{...process.env,FUSION_APP_USER_DATA:profileRoot,FUSION_LOCAL_MACHINE:'RC-MacAir-15'}});
  runtime={app,pid:app.process().pid};status.pid=runtime.pid;save();
  const page=await app.firstWindow();runtime.page=page;
  page.on('close',()=>finish('owner-window-closed'));app.on('close',()=>finish('application-closed'));
  page.on('crash',()=>{record({kind:'renderer-crash'});finish('renderer-crash');});
  page.on('pageerror',error=>record({kind:'renderer-error',name:error.name}));
  page.on('websocket',socket=>{record({kind:'socket-open'});socket.on('close',()=>record({kind:'socket-close'}));for(const [event,direction]of [['framesent','outbound'],['framereceived','inbound']])socket.on(event,({payload})=>{const row=humanFrame(direction,payload);if(row){if(row.type==='turn_end'&&row.threadId===status.threadId)status.smokeTerminal=row;record(row);}});});
  await page.waitForURL('fusion-shell://app/',{timeout:30000});
  await app.context().exposeBinding('__fusionHumanRecord',({frame},batch)=>{if(frame!==page.mainFrame()||frame.url()!=='fusion-shell://app/')throw Error('human observer frame mismatch');status.lastRendererBatchAt=Date.now();record(batch);});
  await app.context().addInitScript(installHumanObserver);await page.evaluate(installHumanObserver);
  await page.waitForFunction(()=>document.body?.innerText.includes('Connected'),null,{timeout:30000});
  const port=Number(fs.readFileSync(path.join(profileRoot,'server.port'),'utf8'));assertSafePort(port);assert.ok(port>0);status.port=port;
  const project=path.join(workspaceRoot,'Human-Test');status.project=project;
  if(resume){
    status.surface=await verifyResumedSurface(page,status.before);status.threadId=status.surface.threadId;
    status.after=withDb(staged.dbPath,{readonly:true,fileMustExist:true},retainedIdentities);
    assert.deepEqual(status.after,status.before,'retained workspace, conversations, and provider identities changed during preparation');
    status.serverUrl=`http://127.0.0.1:${port}`;
  }else{
  await createProject(app,page,project,'Instrumented Human Test');
  const configDir=path.join(project,'ai/RC-MacAir-15/System/config');fs.mkdirSync(configDir,{recursive:true});
  status.configuration={};
  for(const name of ['cli.json','opencode-models.json']){const source=path.join(repoRoot,'ai/RC-MacAir-15/System/config',name),target=path.join(configDir,name);fs.copyFileSync(source,target);status.configuration[name]={source,target,sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')};}
  const require=createRequire(path.join(staged.stagedServer,'package.json'));
  status.requested=assertHumanConfig(await require('./lib/cli-config/resolver.js').resolveCliConfig(project,'capture-viewer'));save();
  await page.reload();await page.waitForFunction(()=>document.body?.innerText.includes('Connected'),null,{timeout:30000});
  const panel=await createChat(page,staged.dbPath);
  const thread=withDb(staged.dbPath,{readonly:true,fileMustExist:true},db=>db.prepare('SELECT thread_id,harness_id,harness_config FROM threads ORDER BY rowid DESC LIMIT 1').get());
  status.threadId=thread.thread_id;status.persistedHarness=thread.harness_id;
  const persisted=JSON.parse(thread.harness_config||'{}');status.persistedSelection={model:persisted.model,variant:persisted.variant};
  assert.equal(thread.harness_id,'opencode');if(persisted.model)assert.equal(persisted.model,status.requested.model);if(persisted.variant)assert.equal(persisted.variant,'high');
  const composer=panel.locator('textarea.rv-chat-input').first();await composer.waitFor();await waitFor(page,()=>composer.isEnabled(),'real composer ready');
  // Preparation-only harmless public route smoke. No automation follows HUMAN_SESSION_READY.
  const smokeText='Reply with exactly HUMAN_SESSION_READY. Do not call tools, read or change files, or run commands.';
  const captureProvider=()=>{for(const pid of descendants(runtime.pid)){const command=spawnSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'}).stdout;if(!command.includes(project)||!command.includes('opencode'))continue;const model=command.match(/--model\s+(\S+)/)?.[1],variant=command.match(/--variant\s+(\S+)/)?.[1];if(model){status.providerInvocation={pid,model,variant,thinking:/(?:^|\s)--thinking(?:\s|$)/.test(command),observedAt:Date.now()};save();}}};
  const providerTimer=setInterval(captureProvider,300);
  try{
    await composer.fill(smokeText);await panel.getByRole('button',{name:'Send message',exact:true}).click();
    await waitFor(page,()=>withDb(staged.dbPath,{readonly:true,fileMustExist:true},db=>db.prepare('SELECT id FROM exchanges WHERE thread_id=? LIMIT 1').get(thread.thread_id)),'real provider saved reply',120000);
  }finally{clearInterval(providerTimer);}
  const exchange=withDb(staged.dbPath,{readonly:true,fileMustExist:true},db=>db.prepare('SELECT id,user_input,assistant,metadata FROM exchanges WHERE thread_id=? ORDER BY seq DESC LIMIT 1').get(thread.thread_id));
  const receipt=withDb(staged.dbPath,{readonly:true,fileMustExist:true},db=>db.prepare('SELECT request_id,turn_id,outcome FROM prompt_submission_receipts WHERE thread_id=? ORDER BY rowid DESC LIMIT 1').get(thread.thread_id));
  const reply=humanSmokeReply(exchange,receipt,status.smokeTerminal);
  await panel.locator('.rv-message-assistant').filter({hasText:'HUMAN_SESSION_READY'}).last().waitFor({timeout:30000});
  assert.equal(status.providerInvocation?.model,status.requested.model);assert.equal(status.providerInvocation?.variant,'high');assert.equal(status.providerInvocation?.thinking,true);
  status.providerSmoke={receipt,exchangeId:exchange.id,reply};record({kind:'provider-smoke',...status.providerSmoke});
  await waitFor(page,()=>composer.isEnabled(),'composer ready after saved smoke');
  }
  const native=await app.evaluate(({BrowserWindow,app},title)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='fusion-shell://app/');if(!w)throw Error('owned main window missing');w.setTitle(title);w.show();w.moveTop();app.focus({steal:true});w.focus();return {windowId:w.id,title:w.getTitle(),pid:process.pid};},`HUMAN TEST — ${runId}`);
  Object.assign(status,native);
  await app.evaluate(({BrowserWindow},windowId)=>{const w=BrowserWindow.fromId(windowId);const state={events:[],dropped:0};for(const type of ['focus','blur','show','hide','minimize','restore','close'])w.on(type,()=>{if(state.events.length>=256){state.events.shift();state.dropped++;}state.events.push({at:Date.now(),type});});global.__humanNativeEvents=state;},status.windowId);
  const cdp=await app.context().newCDPSession(page);
  resourceTimer=setInterval(async()=>{if(resourceBusy){status.skippedResourceSamples++;save();return;}resourceBusy=true;try{const [dom,memory]=await Promise.all([cdp.send('Memory.getDOMCounters'),app.evaluate(async({app,BrowserWindow})=>({nativeEvents:global.__humanNativeEvents.events.splice(0),nativeEventsDropped:global.__humanNativeEvents.dropped,appActive:app.isActive(),appHidden:app.isHidden(),memory:await process.getProcessMemoryInfo(),metrics:app.getAppMetrics().map(({pid,type,memory})=>({pid,type,memory})),windows:BrowserWindow.getAllWindows().map(w=>({windowId:w.id,focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized()}))}))]);record({kind:'resources',dom,...memory});}catch{record({kind:'resource-observation-unavailable'});}finally{resourceBusy=false;}},10000);
  await page.evaluate(()=>window.__fusionHumanObserver.flush());
  assert.ok(status.lastRendererBatchAt&&Date.now()-status.lastRendererBatchAt<5000,'live renderer recording not established');
  assert.equal(status.recording,true,'human recording unavailable');
  status.status='ready';status.humanReady=true;status.readyAt=Date.now();save();record({kind:'human-ready',pid:status.pid,windowId:status.windowId});journal.flush();console.log('HUMAN_SESSION_READY '+JSON.stringify(status));
  await finished;
} catch(error){status.status='failed';status.failure={name:error.name,message:error.message};save();record({kind:'driver-failure',name:error.name,message:error.message});}
finally {
  clearInterval(resourceTimer);clearInterval(journalTimer);
  record({kind:'closing',reason:status.closeReason??'preparation-failed'});
  status.lingeringOwnedPids=await closeHumanRuntime(runtime,{token,root:tempRoot,record});status.endedAt=Date.now();status.status=status.failure?'failed':'closed';status.retainedForDiagnosis=true;save();record({kind:'closed',lingeringOwnedPids:status.lingeringOwnedPids,profileRetained:true});journal.close();
}
