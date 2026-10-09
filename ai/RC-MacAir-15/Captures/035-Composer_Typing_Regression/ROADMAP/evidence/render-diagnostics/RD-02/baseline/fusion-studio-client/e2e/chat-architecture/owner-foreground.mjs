import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { installWatchedPointer,readWatchedPointer,removeWatchedPointer } from './watched-pointer.mjs';

export async function waitForOwnerForeground({observe,wait,now=Date.now,timeoutMs=120000,stableMs=2000,requirePointer=false}) {
  const startedAt=now();let stableSince=null,last=null,observations=0,lastObservedAt=null;
  try {
  while(now()-startedAt<=timeoutMs) {
    last=await observe();lastObservedAt=now();observations++;
    if(last?.focused===true&&last.visible===true&&last.minimized===false&&last.appHidden===false&&(!requirePointer||last.pointer?.type==='pointerdown')) {
      stableSince??=now();
      if(now()-stableSince>=stableMs)return {startedAt,endedAt:now(),stableMs,observations,last,lastObservedAt};
    } else stableSince=null;
    if(now()-startedAt>=timeoutMs)break;
    await wait(Math.min(100,timeoutMs-(now()-startedAt)));
  }
  }catch(error){error.observation={startedAt,endedAt:now(),observations,last,lastObservedAt};throw error;}
  const error=new Error(`Owner foreground acquisition unavailable: ${JSON.stringify(last)}`);
  error.code='OWNER_FOREGROUND_UNAVAILABLE';error.observation={startedAt,endedAt:now(),observations,last,lastObservedAt};throw error;
}

export async function pointerEvidence(read,now=Date.now){
  try{const event=await read();return {status:event?'observed':'null',observedAt:now(),event};}
  catch{return {status:'unavailable',observedAt:now(),event:null};}
}

// Preparation only: never called from a typing interval or used to refocus one.
export async function prepareOwnerForeground(runtime,fixture,{token,evidenceRoot,requirePointer=false}) {
  const timeoutMs=Number(process.env.FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS||(requirePointer?120000:0));
  assert.ok([0,120000].includes(timeoutMs),'owner acquisition accepts only opt-in120000ms');
  assert.ok(!requirePointer||timeoutMs===120000,'watched diagnostic requires shared120sdeadline');
  if(!timeoutMs)return {enabled:false};
  const runId=token.replace(/^chat-architecture-owner-/,'');
  const identity=await runtime.app.evaluate(({BrowserWindow},runId)=>{
    const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('fusion-shell://app/'));
    if(!w)throw Error('exact owned fixture window unavailable');
    w.setTitle(`ISOLATED ACCEPTANCE — ${runId}`);w.show();w.moveTop();
    return {pid:process.pid,windowId:w.id,title:w.getTitle(),url:w.webContents.getURL()};
  },runId);
  const receipt={clickRequired:requirePointer,enabled:true,status:'waiting',runId,...identity,profile:fixture.profileRoot,workspace:fixture.workspaceRoot,timeoutMs};
  const output=path.join(evidenceRoot,'owner-foreground-result.json');
  const save=()=>fs.writeFileSync(output,JSON.stringify(receipt,null,2));save();
  const observePointer=async()=>{
    const observation=await pointerEvidence(()=>readWatchedPointer(runtime.page));
    if(observation.event&&!receipt.firstTrustedPointer){receipt.firstTrustedPointer=observation.event;save();}
    return observation;
  };
  let primaryFailure=null;
  try {
    if(requirePointer)await installWatchedPointer(runtime.page);
    console.log('FOREGROUND_READY '+JSON.stringify(receipt));
    receipt.acquisition=await waitForOwnerForeground({timeoutMs,requirePointer,
      observe:async()=>{const pointer=requirePointer?await observePointer():null;const focus=await runtime.app.evaluate(({BrowserWindow,app},windowId)=>{
        const w=BrowserWindow.fromId(windowId);
        return w?{focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),appHidden:app.isHidden(),windowId:w.id}:null;
      },identity.windowId);return requirePointer?{...focus,pointer:pointer?.event??null,pointerObservation:pointer}:focus;},wait:ms=>runtime.page.waitForTimeout(ms)});
    receipt.status='acquired';save();return receipt;
  } catch(error){primaryFailure=error;receipt.status='failed';receipt.failure={message:error.message,code:error.code,observation:error.observation};save();throw error;}
  finally {if(requirePointer){
    try{receipt.finalPointerObservation=await observePointer();save();}
    catch(error){if(!primaryFailure)throw error;}
    finally{await removeWatchedPointer(runtime.page);}
  }}
}
