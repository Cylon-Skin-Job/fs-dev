import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForOwnerForeground } from './owner-foreground.mjs';
const focused={focused:true,visible:true,minimized:false,appHidden:false};
test('owner acquisition requires sustained real focus before the next preparation step',async()=>{
 let now=0;const order=[];
 const result=await waitForOwnerForeground({now:()=>now,wait:async ms=>{now+=ms;},timeoutMs:1000,stableMs:200,
  observe:async()=>{order.push(now);return {...focused,focused:now!==100};}});
 order.push('calibration may now reload');
 assert.equal(result.endedAt,400);assert.equal(order.at(-1),'calibration may now reload');
});
test('hidden app, transient focus and missing window time out without a pass',async()=>{
 for(const observation of [null,{...focused,focused:false},{...focused,appHidden:true}]) {
  let now=0;
  await assert.rejects(waitForOwnerForeground({now:()=>now,wait:async ms=>{now+=ms;},timeoutMs:200,
   observe:async()=>observation}),error=>error.code==='OWNER_FOREGROUND_UNAVAILABLE'&&error.observation.endedAt===200);
 }
});
test('watched acquisition does not advance on focus alone and shares one click/focus deadline',async()=>{
 let now=0;
 const result=await waitForOwnerForeground({now:()=>now,wait:async ms=>{now+=ms;},timeoutMs:1000,stableMs:200,requirePointer:true,
  observe:async()=>({...focused,pointer:now>=500?{type:'pointerdown',at:500}:null})});
 assert.equal(result.endedAt,700);assert.equal(result.last.pointer.at,500);
 now=0;
 await assert.rejects(waitForOwnerForeground({now:()=>now,wait:async ms=>{now+=ms;},timeoutMs:1000,stableMs:200,requirePointer:true,
  observe:async()=>({...focused,pointer:now>=900?{type:'pointerdown',at:900}:null})}),error=>error.observation.endedAt===1000);
});
