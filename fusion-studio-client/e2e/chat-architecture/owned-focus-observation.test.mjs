import test from 'node:test';
import assert from 'node:assert/strict';
import { focusIntervalEvidence } from './owned-focus-observation.mjs';
const event=(type,at,focused=true)=>({type,at,focused,minimized:false});
test('transient blur/hide/minimize invalidate typing despite restored final focus',()=>{
 for(const type of ['blur','hide','minimize']) {
  const observation={overflow:0,events:[event('installed',1),event(type,12),event('focus',13)]};
  assert.equal(focusIntervalEvidence(observation,10,20).valid,false);
  assert.equal(focusIntervalEvidence(observation,14,20).valid,true);
 }
});
test('missing and overflowed observations never invent retained focus',()=>{
 assert.equal(focusIntervalEvidence(null,10,20).valid,false);
 assert.equal(focusIntervalEvidence({events:[event('installed',11)],overflow:0},10,20).valid,false);
 assert.equal(focusIntervalEvidence({events:[event('installed',1)],overflow:1},10,20).valid,false);
});
