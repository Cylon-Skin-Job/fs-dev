import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { validateDeleteAck,waitForDeleteAck,createDeleteNativeCheckpoint } from './soak-delete-native.mjs';

const request={runId:'run',pid:12,windowId:1,groupId:'group',sequence:1,nonce:'unique',startedAt:100,deadlineAt:120100};
const ack={...request,operator:'agent',ownerAcceptance:false,status:'closed',action:'none',nativeSheetAbsent:true,unknownDialog:false,observedAt:200};
test('fresh exact native closure ACK accepts absent sheet or matching residual Cancel',()=>{
  for(const action of ['none','cancel-matching-residual'])assert.equal(validateDeleteAck({...ack,action},request,201).action,action);
});
test('every identity field fails closed',()=>{
  for(const key of ['runId','pid','windowId','groupId','sequence','nonce','deadlineAt'])assert.throws(()=>validateDeleteAck({...ack,[key]:'wrong'},request,201),new RegExp(key));
});
test('unknown UI, owner claims, wrong action, failed status and stale/future ACK fail closed',()=>{
  for(const patch of [{unknownDialog:true},{nativeSheetAbsent:false},{ownerAcceptance:true},{operator:'owner'},{action:'OK'},{status:'failed'},{observedAt:99},{observedAt:202}])
    assert.throws(()=>validateDeleteAck({...ack,...patch},request,201));
  assert.throws(()=>validateDeleteAck(ack,request,120101));
});
test('missing ACK deadline and malformed ACK are explicit failures',async()=>{
  let now=100;
  await assert.rejects(waitForDeleteAck({...request,deadlineAt:300},{read:()=>null,now:()=>now,wait:async ms=>{now+=ms;}}),/deadline/);
  await assert.rejects(waitForDeleteAck(request,{read:()=>'{',now:()=>200,wait:async()=>{}}),SyntaxError);
});
test('polling consumes only a fresh matching ACK',async()=>{
  let now=100,count=0;
  const result=await waitForDeleteAck(request,{read:()=>++count===2?JSON.stringify(ack):null,now:()=>now,wait:async ms=>{now+=ms;}});
  assert.equal(result.nonce,'unique');assert.equal(count,2);
});

function harness() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'delete-native-test-'));
  const page=new EventEmitter(),calls=[];
  const runtime={pid:12,page,app:{
    browserWindow:async p=>{assert.equal(p,page);return {evaluate:async()=>1,dispose:async()=>calls.push('handle-dispose')};},
    evaluate:async(fn,args)=>{
      const w={id:1,webContents:{getURL:()=> 'fusion-shell://app/'},getTitle:()=> 'isolated',isFocused:()=>true,isVisible:()=>true,isMinimized:()=>false};
      // Identity callback requires real process.pid; emulate only this mock's owned process.
      assert.equal(args.pid,12);
      if(fn.toString().includes('title:w.getTitle()'))return {pid:12,windowId:1,title:'isolated'};
      return {windowId:1,appActive:true,focused:true,visible:true,minimized:false,appHidden:false};
    }
  }};
  const controller=createDeleteNativeCheckpoint(runtime,{profileRoot:'profile',workspaceRoot:'workspace'},
    {token:'chat-architecture-owner-run',evidenceRoot:root});
  return {root,page,calls,controller,cleanup(){controller.dispose();fs.rmSync(root,{recursive:true,force:true});}};
}
test('exact accept promise precedes durable Delete and READY; ACK then stable native focus; no accumulating listeners',async()=>{
  const h=harness(),prior=console.log;let ready;
  console.log=(line)=>{
    if(line.startsWith('DELETE_NATIVE_READY ')){
      ready=JSON.parse(line.slice('DELETE_NATIVE_READY '.length));
      assert.deepEqual(h.calls.slice(0,3),['accept','accepted','durable']);
      assert.equal(fs.existsSync(path.join(h.root,'delete-native-0001-ready.json')),true);
      fs.writeFileSync(ready.ackPath,JSON.stringify({...ready,status:'closed',action:'none',nativeSheetAbsent:true,unknownDialog:false,observedAt:Date.now()}));
    }
  };
  try {
    await h.controller.run({group_id:'group'},async()=>h.page.emit('dialog',{
      type:()=> 'confirm',message:()=> 'Delete this conversation?',accept:async()=>{h.calls.push('accept');await new Promise(r=>setTimeout(r,10));h.calls.push('accepted');}}),
      async()=>h.calls.push('durable'));
    assert.equal(ready.sequence,1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(h.root,'delete-native-0001-ready.json'))).status,'acquired');
    assert.equal(h.page.listenerCount('dialog'),1);
    h.controller.dispose();assert.equal(h.page.listenerCount('dialog'),0);
  } finally {console.log=prior;h.cleanup();}
});
test('unexpected dialog rejects without accepting it or proceeding to durable work',async()=>{
  const h=harness(),prior=console.log;console.log=()=>{};let accepted=false,durable=false;
  try {
    await assert.rejects(h.controller.run({group_id:'group'},async()=>h.page.emit('dialog',{
      type:()=> 'confirm',message:()=> 'unrecognized',accept:async()=>{accepted=true;}}),async()=>{durable=true;}),/unexpected/);
    assert.equal(accepted,false);assert.equal(durable,false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(h.root,'delete-native-preparation-failed.json'))).status,'failed');
    assert.throws(h.controller.assertHealthy,/unexpected/);
  } finally {console.log=prior;h.cleanup();}
});
test('CDP acceptance failure preserves original error and prevents native READY',async()=>{
  const h=harness(),prior=console.log;console.log=()=>{};const original=Error('CDP failed');
  try {
    await assert.rejects(h.controller.run({group_id:'group'},async()=>h.page.emit('dialog',{
      type:()=> 'confirm',message:()=> 'Delete this conversation?',accept:async()=>{throw original;}}),async()=>assert.fail('durable after error')),e=>e===original);
    assert.equal(fs.existsSync(path.join(h.root,'delete-native-0001-ready.json')),false);
  } finally {console.log=prior;h.cleanup();}
});
test('soak opt-in surrounds all Delete boundaries, preserves duration and excludes lifecycle-only',()=>{
  const source=fs.readFileSync(new URL('./soak-electron.mjs',import.meta.url),'utf8');
  assert.match(source,/!lifecycleOnly \|\| deleteNativeMs===0/);
  assert.match(source,/'warmup',base.group.group_id,deleteCheckpoint/);
  assert.match(source,/deleteGroup\(runtime,fixture,streaming.group,deleteCheckpoint\)/);
  assert.match(source,/lifecycleCycle\(runtime,fixture,routes,i,base.group.group_id,deleteCheckpoint\)/);
  assert.match(source,/i<=20 \|\| Date.now\(\)<finalStart/);
  assert.match(source,/durationMs,2_700_000/);
  const helper=fs.readFileSync(new URL('./soak-delete-native.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(helper,/\.focus\(|\.show\(|\.moveTop\(|bringToFront|osascript|System Events/);
  assert.match(helper,/appActive:app.isActive\(\)/);
});
