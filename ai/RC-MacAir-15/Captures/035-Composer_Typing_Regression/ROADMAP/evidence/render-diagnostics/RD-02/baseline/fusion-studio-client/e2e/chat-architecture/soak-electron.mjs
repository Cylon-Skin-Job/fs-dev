import { prepareOwnerForeground } from './owner-foreground.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cleanupFixture,closeOwnedApp,createProject,selectPanel,stageAndLaunch,waitFor,withDb } from './electron-case-helpers.mjs';
import { buildF2Exchanges,materializeF3Workspace } from './fixture-workloads.mjs';
import { observerBootstrap,waitForScreenshotBootstrapQuiescence,takePreciseCoverage,installMeasurement,readMeasurement } from './soak-measurement.mjs';
import { assertCoverageTargetsCalibrated,R1_COVERAGE_TARGETS } from './coverage-observation.mjs';
import { assertFocusedBeforeTyping,establishFocusedWindow } from './window-focus.mjs';
import { installResourceObservation,sampleResources,assertEquivalentResources } from './soak-resources.mjs';
import { attributionViolations } from './message-list-observation.mjs';
import { observeNativeInput,manualInputWindow } from './manual-input-window.mjs';
import { installOwnedFocusObservation,readOwnedFocusObservation,focusIntervalEvidence } from './owned-focus-observation.mjs';
import { observeRoutes,newGroup,send,stop,deleteGroup,lifecycleCycle,dbRead } from './soak-actions.mjs';
import { prepareFinalSoakWindow } from './soak-preparation.mjs';
import { acquirePostWarmupForeground } from './soak-foreground-handoff.mjs';
import { createDeleteNativeCheckpoint } from './soak-delete-native.mjs';

const [token,evidenceRoot,tempRoot,variant] = process.argv.slice(2);
assert.match(token||'',/^chat-architecture-owner-chat-arch-/);
const lifecycleOnly=variant==='--lifecycle-only';
const deleteNativeMs=Number(process.env.FUSION_CHAT_ARCH_DELETE_NATIVE_MS || 0);
assert.ok([0,120000].includes(deleteNativeMs));
assert.ok(!lifecycleOnly || deleteNativeMs===0);
const manualMs=Number(process.env.FUSION_CHAT_ARCH_POST_SOAK_MANUAL_MS || 0);
const handoffMs=Number(process.env.FUSION_CHAT_ARCH_POST_WARMUP_FOREGROUND_MS || 0);
assert.ok([0,120000].includes(handoffMs));
assert.ok(!lifecycleOnly || handoffMs===0);
assert.ok([0,180000].includes(manualMs));
assert.ok(!lifecycleOnly || manualMs===0);
const durationMs = lifecycleOnly?2700000:Number(process.env.FUSION_CHAT_ARCH_DURATION_MS);
assert.equal(durationMs,2_700_000,'V-SOAK requires exactly the approved 45-minute workload');
const repoRoot=path.resolve(import.meta.dirname,'../../..');
const f2=buildF2Exchanges();
const evidence={status:'setup',windows:[],cycles:[],samples:[],durationMs,errors:[]};
const output=path.join(evidenceRoot,'soak-result.json');
const save=()=>fs.writeFileSync(output,JSON.stringify(evidence,null,2));
let fixture,runtime,failure,deleteCheckpoint;
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
async function focus(request) {
  return runtime.app.evaluate(({BrowserWindow,app},request)=>{
    const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('fusion-shell://app/'));
    if(!w)return {available:false,focused:false};
    if(request){w.show();w.moveTop();app.focus({steal:true});w.focus();w.webContents.focus();}
    return {available:true,focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),windowId:w.id,url:w.webContents.getURL()};
  },request);
}
async function hydrate(groupId,count=60) {
  const panel=await selectPanel(runtime.page,'capture-viewer','Captures');
  await panel.locator(`.rv-chat-item[data-thread-group-id="${groupId}"]`).click();
  await waitFor(runtime.page,()=>panel.locator('.rv-message').count().then(n=>n===count),'F2 hydration',90_000);
  return panel;
}
async function measure(label,{streaming=false,short=false,routes,streamThreadId}={}) {
  deleteCheckpoint?.assertHealthy();
  const {page}=runtime; const panel=page.locator('.rv-panel.active');
  const composer=panel.locator('textarea.rv-chat-input').first();
  await composer.fill('');await composer.focus();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.__chatArchSustained.documentId),evidence.bootstrap.documentId,'same prepared document');
  const before=assertFocusedBeforeTyping(await focus(false),label);
  await installMeasurement(page);
  const chars=short?68:9520,delay=short?25:32;
  const seed='the quick brown fox jumps over the lazy dog and then types some more ';
  const text=seed.repeat(Math.ceil(chars/seed.length)).slice(0,chars);
  const streamBefore=routes?.content[streamThreadId]?.count??0;
  const began=Date.now();
  const coverage=await takePreciseCoverage(page,async()=>{
    await page.evaluate(()=>{const m=window.__chatArchSustained.measurement;m.captureOutbound=true;m.outboundStartedAt=performance.now();window.__chatArchMessageListObservation={enabled:true,counts:{},overflow:0,startedAt:Date.now()};});
    try{await page.keyboard.type(text,{delay});}
    finally{await page.evaluate(()=>{window.__chatArchSustained.measurement.captureOutbound=false;const o=window.__chatArchMessageListObservation;o.enabled=false;o.endedAt=Date.now();});}
  },[...R1_COVERAGE_TARGETS,'chatArchRecordMessageList']);
  const ended=Date.now();
  const wallMs=ended-began;
  const focusInterval=focusIntervalEvidence(await readOwnedFocusObservation(runtime),began,ended);
  const metrics=await readMeasurement(page);
  const after=await focus(false);
  const attribution=await page.evaluate(()=>{const s=window.__chatArchMessageListObservation;s.enabled=false;return s;});
  const retained=await composer.inputValue();
  const zeroNames=R1_COVERAGE_TARGETS.filter(n=>n!=='ChatAreaFooter'&&(!streaming||n!=='MessageList'));
  const attributedTotal=Object.values(attribution.counts).reduce((n,count)=>n+count,0);
  const stream=streaming?{...routes.content[streamThreadId],framesDuring:(routes.content[streamThreadId]?.count??0)-streamBefore,nominalFramesPerSecond:20,observedFramesPerSecond:((routes.content[streamThreadId]?.count??0)-streamBefore)/(wallMs/1000)}:null;
  const violations=[!focusInterval.valid?'focus interval interrupted/incomplete':null,after.focused!==true?'completion focus lost; timing inconclusive':null,retained!==text?'text retention':null,
    ...attributionViolations(attribution,coverage.summary.counts,{composerThreadId:evidence.identity.baseThreadId,liveThreadId:streaming?streamThreadId:undefined}),
    metrics.inputCount!==chars||metrics.nextRafCount!==chars?'incomplete event samples':null,
    metrics.inputP95Ms>3?'input p95':null,
    metrics.nextRafP95Ms>(streaming?32:20)||metrics.nextRafMaxMs>(streaming?100:50)?'rAF latency':null,
    !metrics.longTaskObserverSupported||metrics.longTaskCount!==0?'long tasks':null,
    metrics.wsSent!==0||metrics.outboundEvidenceOverflow?'typing outbound traffic':null,
    wallMs>chars*delay*1.5||(!short&&wallMs<300000)?'wall time':null,
    zeroNames.some(n=>coverage.summary.counts[n]!==0)?'unrelated render/formatter work':null,
    coverage.summary.counts.ChatAreaFooter<chars?'coverage positive control':null,
    streaming&&(!stream||stream.framesDuring<wallMs/1000*19||Date.now()-stream.lastAt>1000||stream.maxCharacters>200)?'stream workload coverage':null].filter(Boolean);
  const result={label,streaming,short,at:began,wallMs,characters:chars,delay,exactRetention:retained===text,sha256:hash(text),metrics,coverage:coverage.summary,messageListAttribution:{...attribution,total:attributedTotal,liveThreadId:streamThreadId??null,composerThreadId:evidence.identity.baseThreadId},focus:{before,after,interval:focusInterval},stream,violations};
  evidence.windows.push(result);save();assert.deepEqual(violations,[],`${label}: ${violations.join(', ')}`);
  // Release only fixture observation arrays; product drafts/caches are untouched.
  await page.evaluate(()=>{window.__chatArchSustained.measurement=null;});
  return result;
}
try {
  fixture=await stageAndLaunch({repoRoot,tempRoot,token,casePrefix:'soak',evidenceRoot,initScript:observerBootstrap,
    faultSchedule:{'before-ack':{action:'delay',delayMs:400},'before-save-ack':{action:'delay',delayMs:250}},
    eventScript:{frameIntervalMs:50,textFrames:10000}});
  evidence.observationAdapter=installResourceObservation(fixture);
  runtime=await fixture.launch();
  const project=path.join(fixture.workspaceRoot,'sustained-project');
  await createProject(runtime.app,runtime.page,project,'Sustained Input Fixture');
  await runtime.page.reload();await runtime.page.waitForFunction(()=>document.body.innerText.includes('Connected'));
  const base=await newGroup(runtime,fixture);const dense=await newGroup(runtime,fixture);
  await closeOwnedApp(runtime);runtime=null;
  const f3=materializeF3Workspace(project);
  withDb(fixture.dbPath,{},db=>db.transaction(()=>{
    const insert=db.prepare('INSERT INTO exchanges(thread_id,seq,ts,user_input,assistant,metadata) VALUES(?,?,?,?,?,?)');
    for(const [id,exchanges] of [[base.threadId,f2.exchanges],[dense.threadId,f2.dense]])for(const x of exchanges)insert.run(id,x.seq,1780000000000+x.seq,x.user,JSON.stringify(x.assistant),JSON.stringify(x.metadata));
  })());
  evidence.fixtures={f2:f2.manifest,f3:{...f3,files:undefined,supportFiles:undefined},f5:{frameIntervalMs:50,textFrames:10000,maxCharacters:200}};
  fs.writeFileSync(path.join(evidenceRoot,'soak-f3-manifest.json'),JSON.stringify(f3,null,2));
  evidence.identity={baseThreadId:base.threadId,baseGroupId:base.group.group_id,denseThreadId:dense.threadId,project};
  runtime=await fixture.launch();
  if(deleteNativeMs)deleteCheckpoint=createDeleteNativeCheckpoint(runtime,fixture,{token,evidenceRoot,timeoutMs:deleteNativeMs});
  else runtime.page.on('dialog',dialog=>dialog.accept());
  const routes=observeRoutes(runtime.page,path.join(evidenceRoot,'soak-route-receipts.ndjson'));evidence.routes=routes;
  await installOwnedFocusObservation(runtime);
  if(!lifecycleOnly)await prepareOwnerForeground(runtime,fixture,{token,evidenceRoot});
  const calibration=await takePreciseCoverage(runtime.page,async()=>{await runtime.page.reload();await runtime.page.waitForFunction(()=>document.body.innerText.includes('Connected'));await hydrate(base.group.group_id);});
  assertCoverageTargetsCalibrated(calibration.summary,R1_COVERAGE_TARGETS);evidence.calibration=calibration.summary;
  evidence.attributionCalibration=await runtime.page.evaluate(()=>{const s=window.__chatArchMessageListObservation;s.enabled=false;return s;});
  assert.ok(evidence.attributionCalibration.counts[base.threadId]>0,'positive exact F2 MessageList calibration');
  assert.equal(evidence.attributionCalibration.overflow,0);
  if (!lifecycleOnly) {
    evidence.setupBootstrap = await waitForScreenshotBootstrapQuiescence(runtime.page);
  }
  else evidence.bootstrap = {status:'not-applicable-to-non-timing-lifecycle-check'};
  // Positive long-task calibration outside every input/memory interval.
  evidence.observerCalibration=await runtime.page.evaluate(async()=>{
    if(!PerformanceObserver.supportedEntryTypes.includes('longtask'))throw Error('longtask observer unavailable');
    const tasks=[];const o=new PerformanceObserver(l=>tasks.push(...l.getEntries().map(e=>e.duration)));o.observe({type:'longtask'});
    await new Promise(r=>setTimeout(r,50));const t=performance.now();while(performance.now()-t<75){};
    await new Promise(r=>setTimeout(r,100));o.disconnect();return tasks;
  });assert.ok(evidence.observerCalibration.some(n=>n>=50));
  await hydrate(dense.group.group_id,4);await hydrate(base.group.group_id);
  evidence.warmup=await lifecycleCycle(runtime,fixture,routes,'warmup',base.group.group_id,deleteCheckpoint);
  await runtime.page.locator('.rv-panel.active textarea.rv-chat-input').first().fill('warm persistent composer owner');
  await runtime.page.locator('.rv-panel.active textarea.rv-chat-input').first().fill('');
  if(!lifecycleOnly)Object.assign(evidence,await prepareFinalSoakWindow({page:runtime.page,
    setupBootstrap:evidence.setupBootstrap,
    establishFocus:()=>handoffMs?acquirePostWarmupForeground(runtime,fixture,{token,evidenceRoot,timeoutMs:handoffMs})
      :establishFocusedWindow({observeAndFocus:()=>focus(true),wait:ms=>runtime.page.waitForTimeout(ms)})}));
  else {await runtime.page.waitForTimeout(45_000);evidence.settleMs=45000;}
  evidence.samples.push({label:'warmed-baseline',...await sampleResources(runtime,fixture)});save();
  if(!lifecycleOnly){
  for(let i=1;i<=3;i++)await measure(`short-idle-${i}`,{short:true});
  evidence.workloadStartedAt=Date.now();save();
  await measure('initial-five-minute-idle');
  const streaming=await newGroup(runtime,fixture,'file-viewer','Files');
  const streamSend=await send(runtime,streaming.panel,routes,'Five minute streaming workload');
  await hydrate(base.group.group_id);await runtime.page.waitForTimeout(1000);
  for(let i=1;i<=3;i++)await measure(`short-streaming-${i}`,{short:true,streaming:true,routes,streamThreadId:streaming.threadId});
  await measure('five-minute-streaming',{streaming:true,routes,streamThreadId:streaming.threadId});
  const streamPanel=await selectPanel(runtime.page,'file-viewer','Files');
  await stop(runtime,streamPanel,fixture,streaming.threadId);await deleteGroup(runtime,fixture,streaming.group,deleteCheckpoint);
  evidence.streamSend=streamSend;await hydrate(base.group.group_id);
  await runtime.page.locator('.rv-panel.active textarea.rv-chat-input').first().fill('');
  }
  const finalStart=lifecycleOnly?Date.now():evidence.workloadStartedAt+durationMs-350000;
  for(let i=1;i<=20 || Date.now()<finalStart;i++){
    const cycle=await lifecycleCycle(runtime,fixture,routes,i,base.group.group_id,deleteCheckpoint);
    const sample={label:`cycle-${i}`,...await sampleResources(runtime,fixture)};
    evidence.cycles.push(cycle);evidence.samples.push(sample);save();
    assertEquivalentResources(sample,evidence.samples[0]);
    assert.deepEqual(routes.errors,[],'uncaught renderer errors');
  }
  if(!lifecycleOnly){
  await measure('final-five-minute-idle');
  while(Date.now()<evidence.workloadStartedAt+durationMs)await runtime.page.waitForTimeout(Math.min(20000,evidence.workloadStartedAt+durationMs-Date.now()));
  evidence.workloadElapsedMs=Date.now()-evidence.workloadStartedAt;
  await runtime.page.locator('.rv-panel.active textarea.rv-chat-input').first().fill('');
  await runtime.page.waitForTimeout(2000);
  const end=await sampleResources(runtime,fixture);evidence.samples.push({label:'final',...end});
  save();assertEquivalentResources(end,evidence.samples[0]);
  const start=evidence.samples[0];evidence.heap={start:start.heap.usedSize,end:end.heap.usedSize,growth:end.heap.usedSize-start.heap.usedSize,limit:Math.max(32*1024*1024,start.heap.usedSize*.2)};
  assert.ok(evidence.heap.growth<=evidence.heap.limit,'retained heap growth');
  assert.ok(evidence.workloadElapsedMs>=durationMs);assert.deepEqual(routes.errors,[]);
  }
  if(manualMs){
    await observeNativeInput(runtime.page);
    await manualInputWindow(runtime,manualMs,{...evidence.identity,pid:runtime.pid,profile:fixture.profileRoot,
      rendererLifetime:'same renderer after successful complete 45-minute workload'},window=>{evidence.manualWindow=window;save();});
  }
  deleteCheckpoint?.assertHealthy();
  evidence.routes=routes;evidence.status='passed';evidence.scope=lifecycleOnly?'lifecycle-only; does not satisfy V-SOAK':'full45minute';
} catch(error){failure=error;evidence.status='failed';evidence.failure={message:error.message,stack:error.stack};
 if(runtime)evidence.failure.dom=await runtime.page.evaluate(()=>({body:document.body.innerText.slice(0,12000),surfaces:[...document.querySelectorAll('[data-chat-thread-id]')].map(n=>({thread:n.getAttribute('data-chat-thread-id'),host:n.getAttribute('data-chat-host')}))})).catch(()=>null);
}
finally{
  deleteCheckpoint?.dispose();
  evidence.ownedFocus=await readOwnedFocusObservation(runtime);
  evidence.lingeringOwnedPids=await closeOwnedApp(runtime);
  if(fixture)evidence.cleanup=cleanupFixture(fixture,token);
  save();
}
assert.deepEqual(evidence.lingeringOwnedPids,[]);
if(failure)throw failure;
console.log(lifecycleOnly?'CHAT_ARCH_LIFECYCLE_RESOURCES_OK':'CHAT_ARCH_45_MINUTE_SOAK_OK');
