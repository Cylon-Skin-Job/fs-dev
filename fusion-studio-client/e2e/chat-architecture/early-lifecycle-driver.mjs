import fs from 'node:fs';
import path from 'node:path';
export function earlyLifecycleOptions({launchNumber,enabled,entry,cwd,stageRoot,token,evidenceRoot}) {
 if(!enabled)return null;
 if(launchNumber!==2)throw Error('early lifecycle is restricted to second owned launch');
 const preload=path.join(import.meta.dirname,'early-lifecycle-preload.cjs');
 const config={entry,cwd,stageRoot,token,timeline:path.join(evidenceRoot,'early-lifecycle.ndjson'),summary:path.join(evidenceRoot,'early-lifecycle-main-summary.json')};
 return {args:['-r',preload,entry,`--chat-architecture-token=${token}`],env:{FUSION_CHAT_ARCH_EARLY_LIFECYCLE:JSON.stringify(config)},config};
}
export function markEarly(config,kind,detail={}) {
 if((config.driverRecords||0)>=256){config.driverOverflow=(config.driverOverflow||0)+1;return;}
 config.driverRecords=(config.driverRecords||0)+1;
 try{fs.appendFileSync(config.timeline,JSON.stringify({source:'early-driver',pid:process.pid,wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin,kind,...detail})+'\n');}
 catch{config.driverWriteErrors=(config.driverWriteErrors||0)+1;}
}
export async function withEarlyLaunchCleanup(config,action,close) {
 try{return await action();}
 catch(error){
  markEarly(config,'launch-failure');
  try{config.failedLaunchLingering=await close();}catch{config.failedLaunchCloseUnavailable=true;}
  markEarly(config,'failed-launch-close-completion',{lingeringOwnedPidCount:config.failedLaunchLingering?.length??null,closeUnavailable:config.failedLaunchCloseUnavailable===true});
  throw error;
 }
}
export async function observeEarlyActivation({activate,observe,wait,mark,durationMs=15000,now=Date.now}) {
 mark('initial-activation-start');let failure=null;
 try{await activate();}catch(error){failure=error;mark('initial-activation-failed');}
 mark('initial-activation-end');const startedAt=now();mark('observation-start',{durationMs,startedAt});
 while(now()-startedAt<durationMs){try{await observe();}catch(error){failure??=error;mark('observation-unavailable');}await wait(Math.min(1000,Math.max(0,durationMs-(now()-startedAt))));}
 const endedAt=now();mark('observation-end',{startedAt,endedAt,durationMs});return {startedAt,endedAt,durationMs,failure};
}
export async function runEarlyLifecycle(runtime,{token,fixture}) {
 const config=runtime.earlyLifecycle,mark=(kind,detail)=>markEarly(config,kind,detail);
 const windowHandle=await runtime.app.browserWindow(runtime.page);
 const windowId=await windowHandle.evaluate(window=>window.id);await windowHandle.dispose();
 const identity={runId:token.replace(/^chat-architecture-owner-/,''),pid:runtime.pid,windowId,profile:fixture.profileRoot,workspace:fixture.workspaceRoot,clickRequired:false};
 console.log('EARLY_LIFECYCLE_READY '+JSON.stringify(identity));
 const observation=await observeEarlyActivation({mark,activate:()=>runtime.app.evaluate(({app,BrowserWindow},id)=>{
  const trace=globalThis.__chatArchEarlyLifecycle;
  if(trace?.snapshot().windowId!==id)throw Error('early lifecycle exact-window binding mismatch');
  const w=BrowserWindow.fromId(id);if(w.isMinimized())w.restore();w.show();w.moveTop();app.focus({steal:true});w.focus();w.webContents.focus();
 },windowId),observe:()=>runtime.app.evaluate(()=>{const trace=globalThis.__chatArchEarlyLifecycle;if(!trace)throw Error('early observer unavailable');trace.record('driver-observation');}),wait:ms=>new Promise(resolve=>setTimeout(resolve,ms))});
 return {identity,...observation};
}
export function finishEarlyLifecycle(config,cleanup,lingering) {
 markEarly(config,'fixture-cleanup-completion',{cleanup,lingeringOwnedPidCount:lingering.length});
 let main=null,summaryStatus='unavailable';
 try{main=JSON.parse(fs.readFileSync(config.summary,'utf8'));summaryStatus='observed';}catch{}
 markEarly(config,'main-summary-observation',{status:summaryStatus});
 const result={scope:'second-launch early lifecycle only; no acceptance credit',main,summaryStatus,driverWriteErrors:config.driverWriteErrors||0,driverOverflow:config.driverOverflow||0,failedLaunchCloseUnavailable:config.failedLaunchCloseUnavailable===true,cleanup,lingeringOwnedPids:lingering,
  complete:!config.driverOverflow&&!config.driverWriteErrors&&!config.failedLaunchCloseUnavailable&&cleanup?.dbQuickCheck==='ok'&&cleanup?.fixtureRootsRemoved===true&&cleanup?.portFileRemoved===true&&main?.stopped===true&&main.overflow===0&&main.writeErrors===0&&main.unexpectedWindows===0&&main.windowId!==null&&lingering.length===0};
 fs.writeFileSync(path.join(path.dirname(config.summary),'early-lifecycle-result.json'),JSON.stringify(result,null,2));return result;
}
