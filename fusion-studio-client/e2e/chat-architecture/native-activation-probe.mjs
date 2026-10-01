import fs from 'node:fs';
import path from 'node:path';
import {installNodeInspectorObservation} from './node-inspector-observation.mjs';
const clock=()=>({wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin});
// Failure text here is a local category only; the tap owns sanitized original protocol reasons.
export async function observeNativeActivation({activate,query,wait,record,now=Date.now,durationMs=130000}) {
 let firstFailure=null,lastCompleted=null,queries=0,failures=0;
 record('initial-activation-start');
 try{await activate();}catch(error){firstFailure=error;failures++;record('initial-activation-failed');}
 record('initial-activation-end');
 const startedAt=now();record('native-observation-start',{startedAt,durationMs,cadenceMs:100});
 while(now()-startedAt<durationMs){
  const queryStartedAt=now();
  try{const state=await query();lastCompleted={observedAt:now(),state};record('native-query',{query:++queries,queryStartedAt,durationMs:now()-queryStartedAt,...lastCompleted});}
  catch(error){firstFailure??=error;failures++;record('native-query-failed',{query:++queries,queryStartedAt,failedAt:now(),durationMs:now()-queryStartedAt});}
  await wait(Math.min(100,Math.max(0,durationMs-(now()-startedAt))));
 }
 const endedAt=now();record('native-observation-end',{endedAt,queries,failures});
 return {status:firstFailure?'failed-inconclusive':'observation-completed-no-acceptance',startedAt,endedAt,durationMs,queries,failures,lastCompleted,firstFailure};
}

export function createNativeActivationProbe(runtime,evidenceRoot,identity) {
 const file=path.join(evidenceRoot,'native-activation.ndjson'),protocolFile=path.join(evidenceRoot,'node-inspector.ndjson');
 let records=0,overflow=0,writeErrors=0,protocolRecords=0,protocolWriteErrors=0,completed=null;
 const append=(file,event)=>fs.appendFileSync(file,JSON.stringify(event)+'\n');
 const record=(kind,detail={})=>{if(records>=2048){overflow++;return;}try{append(file,{...clock(),kind,...detail});records++;}catch{writeErrors++;}};
 const tap=installNodeInspectorObservation(runtime.app,{expectedPid:runtime.pid,emit:event=>{try{append(protocolFile,event);protocolRecords++;}catch{protocolWriteErrors++;}}});
 return {
  async run({token,fixture}){
   const runId=token.replace(/^chat-architecture-owner-/,'');
   console.log('ACTIVATION_PROBE_READY '+JSON.stringify({runId,...identity,title:`ISOLATED ACTIVATION PROBE — ${runId}`,profile:fixture.profileRoot,workspace:fixture.workspaceRoot,clickRequired:false,durationMs:130000}));
   completed=await observeNativeActivation({record,activate:()=>runtime.app.evaluate(({BrowserWindow,app},{windowId,runId})=>{
    const w=BrowserWindow.fromId(windowId);if(!w)throw Error('owned activation window unavailable');
    w.setTitle(`ISOLATED ACTIVATION PROBE — ${runId}`);
    if(w.isMinimized())w.restore();w.show();w.moveTop();app.focus({steal:true});w.focus();w.webContents.focus();
   },{windowId:identity.windowId,runId}),query:()=>runtime.app.evaluate(({BrowserWindow,app},windowId)=>{
    const w=BrowserWindow.fromId(windowId);if(!w)throw Error('owned observation window unavailable');
    return {pid:process.pid,windowId:w.id,focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),appHidden:app.isHidden(),appActive:app.isActive(),ownedWindowIsKey:BrowserWindow.getFocusedWindow()===w};
   },identity.windowId),wait:ms=>new Promise(resolve=>setTimeout(resolve,ms))});
   return completed;
  },
  finish(){
   tap.restore();const protocol=tap.snapshot();
   const {firstFailure,...observation}=completed||{};
   const result={scope:'native-activation/protocol only; no typing, native-input or performance acceptance',identity,
    domFocus:'emulated by Playwright1.58.2',domVisibility:'affected by backgroundThrottling:false',
    observation:{...observation,...(protocol.errorResponses?{status:'failed-inconclusive'}:{})},records,overflow,writeErrors,protocolRecords,protocolWriteErrors,protocol:{...protocol,events:undefined},
    complete:protocol.errorResponses===0&&completed!==null&&overflow===0&&writeErrors===0&&protocolWriteErrors===0&&protocol.overflow===0&&protocol.recordingErrors===0&&protocol.restored};
   fs.writeFileSync(path.join(evidenceRoot,'native-activation-result.json'),JSON.stringify(result,null,2));return result;
  },
 };
}
