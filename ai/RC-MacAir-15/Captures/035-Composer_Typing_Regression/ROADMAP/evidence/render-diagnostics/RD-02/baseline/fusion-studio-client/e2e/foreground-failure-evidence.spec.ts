import {expect,test} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareOwnerForeground} from './chat-architecture/owner-foreground.mjs';
test('failed main query persists final trusted pointer type/time before removing observer and preserves failure',async({page})=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chat-architecture-pointer-receipt-'));
 const previous=process.env.FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS;process.env.FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS='120000';
 try{
  await page.setContent('<button>isolated pointer test</button>');let calls=0;const failure=new Error('original main query failure');
  const app={evaluate:async()=>{if(calls++===0)return {pid:123,windowId:1,title:'isolated test'};await page.getByRole('button').click();throw failure;}};
  await expect(prepareOwnerForeground({app,page},{profileRoot:root,workspaceRoot:root},{token:'chat-architecture-owner-test',evidenceRoot:root,requirePointer:true})).rejects.toBe(failure);
  const result=JSON.parse(fs.readFileSync(path.join(root,'owner-foreground-result.json'),'utf8'));
  expect(result.status).toBe('failed');expect(result.finalPointerObservation.status).toBe('observed');
  expect(result.firstTrustedPointer).toEqual(result.finalPointerObservation.event);expect(Object.keys(result.firstTrustedPointer).sort()).toEqual(['at','type']);
  expect(result.failure.observation.last).toBeNull();expect(result.failure.observation.lastObservedAt).toBeNull();
  expect(await page.evaluate(()=>window.__chatArchWatchedPointer)).toBeUndefined();
  // Browser test click is trusted but is not physical owner input evidence.
 }finally{if(previous===undefined)delete process.env.FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS;else process.env.FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS=previous;fs.rmSync(root,{recursive:true,force:true});}
});
test('unavailable final pointer read remains explicit and cannot replace original main failure',async({page})=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chat-architecture-pointer-receipt-'));
 try{
  await page.setContent('<div>isolated fixture</div>');let calls=0;const failure=new Error('original query failed');
  const app={evaluate:async()=>{if(calls++===0)return {pid:123,windowId:1};await page.close();throw failure;}};
  await expect(prepareOwnerForeground({app,page},{profileRoot:root,workspaceRoot:root},{token:'chat-architecture-owner-test',evidenceRoot:root,requirePointer:true})).rejects.toBe(failure);
  const result=JSON.parse(fs.readFileSync(path.join(root,'owner-foreground-result.json'),'utf8'));
  expect(result.finalPointerObservation.status).toBe('unavailable');expect(result.finalPointerObservation.event).toBeNull();expect(result.firstTrustedPointer).toBeUndefined();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
