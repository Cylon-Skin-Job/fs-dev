import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function observeBeforeDeadline(observe,remainingMs) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Object.assign(new Error('Post-warmup native observation deadline elapsed'),
      {code:'POST_WARMUP_FOREGROUND_UNAVAILABLE'})),Math.max(0,remainingMs));
    Promise.resolve().then(observe).then(resolve,reject).finally(()=>clearTimeout(timer));
  });
}

export async function waitForNativeForeground({observe,wait,now=Date.now,startedAt=now(),deadlineAt=startedAt+120000}) {
  let stableSince=null,last=null,lastObservedAt=null,observations=0;
  const evidence=()=>({startedAt,deadlineAt,endedAt:now(),last,lastObservedAt,observations,stableMs:2000});
  try {
    while(now()<=deadlineAt) {
      last=await observeBeforeDeadline(observe,deadlineAt-now());lastObservedAt=now();observations++;
      const ready=last?.appActive===true&&last.focused===true&&last.visible===true
        &&last.minimized===false&&last.appHidden===false;
      stableSince=ready?(stableSince??lastObservedAt):null;
      if(ready&&lastObservedAt<=deadlineAt&&lastObservedAt-stableSince>=2000)return evidence();
      if(now()>=deadlineAt)break;
      await wait(Math.min(100,deadlineAt-now()));
    }
    const error=new Error('Post-warmup native foreground unavailable before deadline');
    error.code='POST_WARMUP_FOREGROUND_UNAVAILABLE';throw error;
  } catch(error){error.observation=evidence();throw error;}
}

// Exact owned window only. A separate agent may activate it; this helper only
// sets its identifying title and observes native state, never requests focus.
export async function acquirePostWarmupForeground(runtime,fixture,{token,evidenceRoot,timeoutMs=120000}) {
  assert.equal(timeoutMs,120000,'post-warmup handoff has a fixed120s deadline');
  const handle=await runtime.app.browserWindow(runtime.page);
  let windowId;try{windowId=await handle.evaluate(w=>w.id);}finally{await handle.dispose();}
  const runId=token.replace(/^chat-architecture-owner-/,''),title=`ISOLATED SOAK HANDOFF — ${runId}`;
  const identity=await runtime.app.evaluate(({BrowserWindow},{windowId,title,pid})=>{
    const w=BrowserWindow.fromId(windowId);
    if(process.pid!==pid||!w||!w.webContents.getURL().startsWith('fusion-shell://app/'))throw Error('post-warmup exact owned window unavailable');
    w.setTitle(title);return {pid:process.pid,windowId:w.id,title:w.getTitle()};
  },{windowId,title,pid:runtime.pid});
  const startedAt=Date.now(),receipt={operator:'agent',status:'waiting',runId,...identity,
    profile:fixture.profileRoot,workspace:fixture.workspaceRoot,startedAt,deadlineAt:startedAt+timeoutMs,
    clickEvidence:'separate agent action receipt; not inferred from native focus',ownerAcceptance:false};
  const output=path.join(evidenceRoot,'post-warmup-foreground-result.json');
  const save=()=>fs.writeFileSync(output,JSON.stringify(receipt,null,2));
  save();console.log('POST_WARMUP_READY '+JSON.stringify(receipt));
  try {
    receipt.acquisition=await waitForNativeForeground({startedAt,deadlineAt:receipt.deadlineAt,
      observe:()=>runtime.app.evaluate(({BrowserWindow,app},windowId)=>{
        const w=BrowserWindow.fromId(windowId);
        if(!w)throw Error('post-warmup owned window retired');
        return {windowId:w.id,appActive:app.isActive(),focused:w.isFocused(),visible:w.isVisible(),
          minimized:w.isMinimized(),appHidden:app.isHidden()};
      },windowId),wait:ms=>runtime.page.waitForTimeout(ms)});
    receipt.status='acquired';save();console.log('POST_WARMUP_ACQUIRED '+JSON.stringify(receipt));return receipt;
  } catch(error) {
    receipt.status='failed';receipt.failure={message:error.message,code:error.code??'POST_WARMUP_NATIVE_OBSERVATION_FAILED',observation:error.observation};
    try{save();}catch{receipt.failureReceiptWriteFailed=true;}
    console.log('POST_WARMUP_FAILED '+JSON.stringify(receipt));throw error;
  }
}
