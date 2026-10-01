import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { waitForNativeForeground,acquirePostWarmupForeground } from './soak-foreground-handoff.mjs';

const ready=()=>({windowId:7,appActive:true,focused:true,visible:true,minimized:false,appHidden:false});
function clock(){let time=0;return {now:()=>time,wait:async ms=>{time+=ms;}};}

test('native app and window predicates independently gate stable acquisition without pointer events',async()=>{
  for(const [field,value] of [['appActive',false],['focused',false],['visible',false],['minimized',true],['appHidden',true]]) {
    const time=clock();await assert.rejects(waitForNativeForeground({...time,deadlineAt:3000,
      observe:async()=>({...ready(),[field]:value})}),error=>error.code==='POST_WARMUP_FOREGROUND_UNAVAILABLE'
      &&error.observation.last[field]===value&&error.observation.lastObservedAt===3000);
  }
  const time=clock();const result=await waitForNativeForeground({...time,observe:async()=>ready()});
  assert.equal(result.endedAt,2000);assert.equal(result.observations,21);
  assert.equal('pointer' in result.last,false,'activation click need not reach renderer');
});

test('transient native inactivity resets stability; query failure preserves original error and last observation',async()=>{
  const time=clock();const result=await waitForNativeForeground({...time,
    observe:async()=>({...ready(),appActive:time.now()!==1000})});
  assert.equal(result.endedAt,3100);
  const failed=clock(),original=Error('native query unavailable');let calls=0;
  await assert.rejects(waitForNativeForeground({...failed,observe:async()=>{
    if(calls++)throw original;return {...ready(),focused:false};
  }}),error=>error===original&&error.observation.last.focused===false&&error.observation.lastObservedAt===0);
});

test('hung native query is bounded by the shared deadline',async()=>{
  const startedAt=Date.now();await assert.rejects(waitForNativeForeground({startedAt,deadlineAt:startedAt+20,
    observe:()=>new Promise(()=>{}),wait:async()=>{}}),error=>error.code==='POST_WARMUP_FOREGROUND_UNAVAILABLE'
      &&error.observation.last===null&&error.observation.observations===0);
  assert.ok(Date.now()-startedAt<1000);
});

test('exact window receipt precedes passive wait; agent acquisition is separate from click/owner acceptance',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'soak-handoff-unit-'));
  const oldNow=Date.now,oldLog=console.log;const time=clock();Date.now=time.now;
  const events=[];let title='',disposed=false,queries=0;
  const w={id:7,webContents:{getURL:()=> 'fusion-shell://app/'},setTitle:value=>{title=value;events.push('title');},getTitle:()=>title,
    isFocused:()=>true,isVisible:()=>true,isMinimized:()=>false,
    show:()=>assert.fail('no presentation/focus operation during handoff'),focus:()=>assert.fail('no forced focus')};
  const app={isActive:()=>true,isHidden:()=>false,focus:()=>assert.fail('no app activation')};
  const BrowserWindow={fromId:id=>{assert.equal(id,7);return w;}};
  const runtime={pid:process.pid,page:{waitForTimeout:time.wait},app:{
    browserWindow:async page=>{assert.equal(page,runtime.page);return {evaluate:async fn=>fn(w),dispose:async()=>{disposed=true;}};},
    evaluate:async(fn,arg)=>{if(typeof arg==='number'){
      queries++;const persisted=JSON.parse(fs.readFileSync(path.join(directory,'post-warmup-foreground-result.json'),'utf8'));
      assert.equal(persisted.status,'waiting');assert.ok(events.includes('POST_WARMUP_READY'));
    }return fn({app,BrowserWindow},arg);}}};
  console.log=(marker)=>events.push(marker.split(' ')[0]);
  try {
    const receipt=await acquirePostWarmupForeground(runtime,{profileRoot:'/owned/profile',workspaceRoot:'/owned/workspace'},
      {token:'chat-architecture-owner-chat-arch-test',evidenceRoot:directory});
    assert.equal(disposed,true);assert.equal(queries,21);assert.equal(receipt.operator,'agent');
    assert.equal(receipt.ownerAcceptance,false);assert.equal(receipt.deadlineAt,120000);
    assert.equal(receipt.status,'acquired');assert.equal(receipt.pid,process.pid);assert.equal(receipt.windowId,7);
    assert.deepEqual(events,['title','POST_WARMUP_READY','POST_WARMUP_ACQUIRED']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'post-warmup-foreground-result.json'),'utf8')).status,'acquired');
  }finally{Date.now=oldNow;console.log=oldLog;fs.rmSync(directory,{recursive:true,force:true});}
});

test('opt-in replaces automatic final acquisition only, after warmup and before unchanged final barrier',()=>{
  const source=fs.readFileSync(new URL('./soak-electron.mjs',import.meta.url),'utf8');
  assert.match(source,/FUSION_CHAT_ARCH_POST_WARMUP_FOREGROUND_MS \|\| 0/);
  assert.match(source,/\[0,120000\]\.includes\(handoffMs\)/);
  assert.ok(source.indexOf('evidence.warmup=')<source.indexOf('establishFocus:()=>handoffMs?'));
  assert.match(source,/handoffMs\?acquirePostWarmupForeground[\s\S]*?:establishFocusedWindow/);
  const helper=fs.readFileSync(new URL('./soak-foreground-handoff.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(helper,/getAllWindows|bringToFront|\.focus\(|\.show\(|\.moveTop\(|pointerdown/);
});

test('failed native observation persists last completed state and FAILED before rethrowing original error',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'soak-handoff-failure-'));
  const oldNow=Date.now,oldLog=console.log,time=clock();Date.now=time.now;
  const original=Error('native query failed'),markers=[];let queries=0;
  const runtime={pid:process.pid,page:{waitForTimeout:time.wait},app:{
    browserWindow:async()=>({evaluate:async()=>7,dispose:async()=>{}}),
    evaluate:async(_fn,arg)=>{
      if(typeof arg!=='number')return {pid:process.pid,windowId:7,title:arg.title};
      if(queries++)throw original;return {...ready(),appActive:false};
    }}};
  console.log=marker=>markers.push(marker.split(' ')[0]);
  try {
    await assert.rejects(acquirePostWarmupForeground(runtime,{profileRoot:'/owned/profile',workspaceRoot:'/owned/workspace'},
      {token:'chat-architecture-owner-chat-arch-test',evidenceRoot:directory}),error=>error===original);
    const receipt=JSON.parse(fs.readFileSync(path.join(directory,'post-warmup-foreground-result.json'),'utf8'));
    assert.equal(receipt.status,'failed');assert.equal(receipt.failure.observation.last.appActive,false);
    assert.equal(receipt.failure.observation.lastObservedAt,0);assert.equal(receipt.failure.observation.endedAt,100);
    assert.equal(receipt.failure.code,'POST_WARMUP_NATIVE_OBSERVATION_FAILED');
    assert.deepEqual(markers,['POST_WARMUP_READY','POST_WARMUP_FAILED']);
  }finally{Date.now=oldNow;console.log=oldLog;fs.rmSync(directory,{recursive:true,force:true});}
});
