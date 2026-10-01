import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {observeNativeActivation} from './native-activation-probe.mjs';
import {waitForOwnerForeground,pointerEvidence} from './owner-foreground.mjs';
import {SCENARIOS,ENFORCE_GROUPS} from './scenario-inventory.mjs';
test('one activation precedes full observation even unfocused; failed queries continue without passing',async()=>{
 let now=0,activated=0,queries=0;const failure=new Error('original query failure'),events=[];
 const result=await observeNativeActivation({now:()=>now,durationMs:500,activate:async()=>{activated++;return {focused:false};},query:async()=>{if(++queries===2)throw failure;return {focused:false,appActive:false};},wait:async ms=>{now+=ms;},record:(kind,detail)=>events.push({kind,...detail})});
 assert.equal(activated,1);assert.equal(queries,5);assert.equal(result.endedAt,500);assert.equal(result.firstFailure,failure);assert.equal(result.failures,1);assert.equal(result.status,'failed-inconclusive');assert.equal(result.lastCompleted.observedAt,400);
 assert.ok(events.find(e=>e.kind==='native-query-failed'));assert.equal(events[0].kind,'initial-activation-start');
});
test('failed initial activation is retained and does not gate observation',async()=>{
 let now=0,queries=0;const failure=new Error('activation failed');
 const result=await observeNativeActivation({now:()=>now,durationMs:200,activate:async()=>{throw failure;},query:async()=>{queries++;return {};},wait:async ms=>{now+=ms;},record:()=>{}});
 assert.equal(queries,2);assert.equal(result.firstFailure,failure);assert.equal(result.endedAt,200);
});
test('acquisition errors preserve last completed observation/time and exact original error',async()=>{
 let now=0,calls=0;const failure=new Error('main query error'),last={focused:false,pointer:{type:'pointerdown',at:0}};
 await assert.rejects(waitForOwnerForeground({now:()=>now,wait:async ms=>{now+=ms;},observe:async()=>{if(calls++)throw failure;return last;}}),error=>error===failure&&error.observation.last===last&&error.observation.lastObservedAt===0&&error.observation.endedAt===100);
 assert.deepEqual(await pointerEvidence(async()=>null,()=>3),{status:'null',observedAt:3,event:null});
 assert.deepEqual(await pointerEvidence(async()=>{throw failure;},()=>4),{status:'unavailable',observedAt:4,event:null});
});
test('native protocol case is explicit-only diagnostic and cannot supply performance coverage',()=>{
 const id='R9-NATIVE-ACTIVATION-PROTOCOL';assert.equal(SCENARIOS.find(s=>s.id===id).state,'diagnostic-only');
 for(const group of Object.values(ENFORCE_GROUPS))assert.ok(!group.includes(id));
 const runner=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8');assert.match(runner,/'R9-NATIVE-ACTIVATION-PROTOCOL': \{[\s\S]*?explicitOnly: true, diagnosticDeadlineMs: 240000/);
 const source=fs.readFileSync(new URL('./r1-sustained-electron.mjs',import.meta.url),'utf8');assert.match(source,/if\(activationOnly\)\{[\s\S]+nativeProbe.run\([\s\S]+\}else \{\n  await phase\('owner-acquisition'/);
});
