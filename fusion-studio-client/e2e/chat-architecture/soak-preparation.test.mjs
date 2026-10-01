import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareFinalSoakWindow } from './soak-preparation.mjs';
import { waitForScreenshotBootstrapQuiescence } from './soak-measurement.mjs';

const lifecycle=()=>['screenshot:capture','screenshot:updated','screenshot:request','screenshot:data']
  .map((type,index)=>({type,sequence:index+1,direction:index%2?'inbound':'outbound',atMs:index}));
async function withPage(action,{trafficEvidence=lifecycle(),overflow=0,onWait=()=>{}}={}) {
  const originalWindow=globalThis.window,originalNow=Date.now;let clock=0;
  const state={documentId:'current-document',trafficSequence:4,trafficEvidence,
    trafficEvidenceOverflow:overflow};
  globalThis.window={__chatArchSustained:state};Date.now=()=>clock;
  const page={evaluate:async fn=>fn(),waitForTimeout:async ms=>{clock+=ms;onWait(state,clock);}};
  try{return await action({page,state,now:()=>clock});}
  finally{Date.now=originalNow;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
}

test('final preparation revalidates sealed same-document lifecycle and fresh quiet after warmup',async()=>{
  await withPage(async({page,state,now})=>{
    const setup=await waitForScreenshotBootstrapQuiescence(page);
    assert.equal(state.bootstrapComplete,true);state.trafficSequence=100;
    const before=now(),order=[];
    const result=await prepareFinalSoakWindow({page,setupBootstrap:setup,
      establishFocus:async()=>{order.push('focus');return {observation:{focused:true}};},
      bootstrap:async p=>{order.push('bootstrap');return waitForScreenshotBootstrapQuiescence(p);},
      wait:async ms=>{order.push('settle');assert.equal(ms,45000);assert.ok(now()-before>=500);await page.waitForTimeout(ms);}});
    assert.deepEqual(order,['focus','bootstrap','settle']);
    assert.equal(result.bootstrap.documentId,setup.documentId);
    assert.equal(result.bootstrap.finalTrafficSequence,100);
    assert.deepEqual(result.bootstrap.lifecycle,setup.lifecycle);
    assert.equal(now()-before,45500);
  });
});

test('final quiet restarts on continuing traffic even after bootstrap buffer is sealed',async()=>{
  await withPage(async({page,state,now})=>{
    state.bootstrapComplete=true;
    const result=await waitForScreenshotBootstrapQuiescence(page);
    assert.equal(now(),1200);assert.equal(result.finalTrafficSequence,18);
    assert.deepEqual(result.lifecycle,lifecycle());
  },{onWait:(state,clock)=>{if(clock<=700)state.trafficSequence++;}});
});

test('final preparation rejects changed/missing document or focus failure before settling',async()=>{
  for(const failure of ['missing','before','during','focus','sequence'])await withPage(async({page,state})=>{
    const setup={documentId:'current-document',finalTrafficSequence:4};let settled=false;
    if(failure==='missing')delete setup.documentId;
    if(failure==='before')state.documentId='other-document';
    await assert.rejects(prepareFinalSoakWindow({page,setupBootstrap:setup,
      establishFocus:async()=>{if(failure==='focus')throw Error('native focus unavailable');},
      bootstrap:async()=>({documentId:failure==='during'?'other-document':state.documentId,
        finalTrafficSequence:failure==='sequence'?3:4}),wait:async()=>{settled=true;}}));
    assert.equal(settled,false);
  });
});

test('missing, out-of-order, overflowed lifecycle and never-quiet final traffic fail closed',async()=>{
  const reversed=lifecycle();reversed[1].sequence=0;
  for(const options of [{trafficEvidence:[]},{trafficEvidence:reversed},{overflow:1},
    {onWait:state=>state.trafficSequence++}])await withPage(async({page})=>{
      let settled=false;
      await assert.rejects(prepareFinalSoakWindow({page,
        setupBootstrap:{documentId:'current-document',finalTrafficSequence:4},
        establishFocus:async()=>({observation:{focused:true}}),wait:async()=>{settled=true;}}),
      /overflowed|did not quiesce/);
      assert.equal(settled,false);
    },options);
});

test('integration places final preparation after all warmup and before baseline and typing',()=>{
  const source=fs.readFileSync(new URL('./soak-electron.mjs',import.meta.url),'utf8');
  const setup=source.indexOf('evidence.setupBootstrap ='),warmup=source.indexOf('evidence.warmup='),
    draft=source.indexOf(".first().fill('');",warmup),final=source.indexOf('await prepareFinalSoakWindow('),
    baseline=source.indexOf("label:'warmed-baseline'"),typing=source.indexOf('await measure(`short-idle-');
  assert.ok(setup<warmup&&warmup<draft&&draft<final&&final<baseline&&baseline<typing);
  assert.equal((source.match(/observeAndFocus:\(\)=>focus\(true\)/g)||[]).length,1);
  const measure=source.slice(source.indexOf('async function measure('),source.indexOf('\ntry {'));
  assert.ok(measure.includes('await focus(false)'));assert.equal(measure.includes('focus(true)'),false);
});
