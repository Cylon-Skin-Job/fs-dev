import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { waitForNativeForeground } from './soak-foreground-handoff.mjs';

export function validateDeleteAck(ack, request, now=Date.now()) {
  assert.ok(ack && typeof ack==='object','malformed native Delete ACK');
  for(const key of ['runId','pid','windowId','groupId','sequence','nonce','deadlineAt'])
    assert.equal(ack[key],request[key],`native Delete ACK ${key} mismatch`);
  assert.equal(ack.operator,'agent');assert.equal(ack.ownerAcceptance,false);
  assert.equal(ack.status,'closed','native Delete operator reported failure');
  assert.equal(ack.nativeSheetAbsent,true);assert.equal(ack.unknownDialog,false);
  assert.ok(['none','cancel-matching-residual'].includes(ack.action));
  assert.ok(Number.isFinite(ack.observedAt)&&ack.observedAt>=request.startedAt
    &&ack.observedAt<=now&&now<=request.deadlineAt,'stale/future native Delete ACK');
  return ack;
}

export async function waitForDeleteAck(request,{read,wait,now=Date.now}) {
  while(now()<request.deadlineAt) {
    const value=read();
    if(value!==null)return validateDeleteAck(JSON.parse(value),request,now());
    await wait(Math.min(100,request.deadlineAt-now()));
  }
  throw Error('native Delete ACK deadline elapsed');
}

// One controller per owned soak renderer; no native UI actions or renderer listeners.
export function createDeleteNativeCheckpoint(runtime,fixture,{token,evidenceRoot,timeoutMs=120000}) {
  assert.equal(timeoutMs,120000);
  let sequence=0,active=null,fault=null;
  const assertHealthy=()=>{if(fault)throw fault;};
  const onDialog=dialog=>{
    if(!active || active.dialogSeen || dialog.type()!=='confirm' || dialog.message()!=='Delete this conversation?') {
      fault=Error('unexpected dialog at native Delete boundary');
      active?.reject(fault);return;
    }
    active.dialogSeen=true;
    // Preserve the actual CDP promise, including failure, before durable deletion.
    Promise.resolve().then(()=>dialog.accept()).then(active.resolve,active.reject);
  };
  runtime.page.on('dialog',onDialog);
  return {
    assertHealthy,
    dispose(){runtime.page.off('dialog',onDialog);},
    async run(group,trigger,waitDurable) {
      assertHealthy();assert.equal(active,null,'overlapping native Delete boundaries');
      let timer,receipt,output;
      try {
        const accepted=new Promise((resolve,reject)=>{
          active={resolve,reject,dialogSeen:false};
          timer=setTimeout(()=>reject(Error('expected Delete dialog deadline elapsed')),30000);
        });
        // Attach rejection handling before the click can synchronously emit a dialog.
        await Promise.all([accepted,Promise.resolve().then(trigger)]);
        clearTimeout(timer);assertHealthy();await waitDurable();assertHealthy();
        const handle=await runtime.app.browserWindow(runtime.page);
        let windowId;try{windowId=await handle.evaluate(w=>w.id);}finally{await handle.dispose();}
        const identity=await runtime.app.evaluate(({BrowserWindow},{pid,windowId})=>{
          const w=BrowserWindow.fromId(windowId);
          if(process.pid!==pid||!w||!w.webContents.getURL().startsWith('fusion-shell://app/'))throw Error('native Delete exact owned window unavailable');
          return {pid:process.pid,windowId:w.id,title:w.getTitle()};
        },{pid:runtime.pid,windowId});
        const startedAt=Date.now(),stem=`delete-native-${String(++sequence).padStart(4,'0')}`;
        receipt={status:'waiting',operator:'agent',ownerAcceptance:false,
          runId:token.replace(/^chat-architecture-owner-/,''),...identity,
          profile:fixture.profileRoot,workspace:fixture.workspaceRoot,groupId:group.group_id,sequence,
          nonce:crypto.randomUUID(),startedAt,deadlineAt:startedAt+timeoutMs,
          ackPath:path.join(evidenceRoot,`${stem}-ack.json`)};
        output=path.join(evidenceRoot,`${stem}-ready.json`);
        fs.writeFileSync(output,JSON.stringify(receipt,null,2));
        console.log('DELETE_NATIVE_READY '+JSON.stringify(receipt));
        receipt.ack=await waitForDeleteAck(receipt,{
          read:()=>{assertHealthy();try{assert.ok(fs.statSync(receipt.ackPath).size<=16384,'native Delete ACK exceeds bounded size');return fs.readFileSync(receipt.ackPath,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}},
          wait:ms=>new Promise(resolve=>setTimeout(resolve,ms))});
        receipt.focus=await waitForNativeForeground({startedAt,deadlineAt:receipt.deadlineAt,
          observe:()=>{assertHealthy();return runtime.app.evaluate(({BrowserWindow,app},{pid,windowId})=>{
            const w=BrowserWindow.fromId(windowId);
            if(process.pid!==pid||!w||!w.webContents.getURL().startsWith('fusion-shell://app/'))throw Error('native Delete owned window retired');
            return {windowId:w.id,appActive:app.isActive(),focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),appHidden:app.isHidden()};
          },{pid:runtime.pid,windowId});},wait:ms=>new Promise(resolve=>setTimeout(resolve,ms))});
        assertHealthy();receipt.status='acquired';receipt.endedAt=Date.now();
        fs.writeFileSync(output,JSON.stringify(receipt,null,2));console.log('DELETE_NATIVE_ACQUIRED '+JSON.stringify(receipt));
      } catch(error) {
        fault=error;
        const failure={...(receipt??{sequence:sequence+1,groupId:group.group_id}),status:'failed',endedAt:Date.now(),
          failure:{message:error.message,observation:error.observation}};
        try{fs.writeFileSync(output??path.join(evidenceRoot,'delete-native-preparation-failed.json'),JSON.stringify(failure,null,2));}
        catch{failure.failureReceiptWriteFailed=true;}
        console.log('DELETE_NATIVE_FAILED '+JSON.stringify(failure));throw error;
      } finally {clearTimeout(timer);active=null;}
    }
  };
}
