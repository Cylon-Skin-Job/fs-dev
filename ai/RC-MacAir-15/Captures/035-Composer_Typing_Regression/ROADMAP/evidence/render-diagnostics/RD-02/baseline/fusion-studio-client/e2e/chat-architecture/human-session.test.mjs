import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {signalExactOwned} from './human-session-ownership.mjs';
import {humanFrame} from './human-session-observer.mjs';
import {createHumanJournal,assertHumanConfig,humanSmokeReply} from './human-session-recording.mjs';

test('wire telemetry excludes auth/header/content/error secrets while preserving receipt and terminal state',()=>{
  for(const type of ['shell-auth:response','shell-auth:challenge','connected'])assert.equal(humanFrame('outbound',JSON.stringify({type,token:'secret'})),null);
  const safe=humanFrame('inbound',JSON.stringify({type:'thread:action:completed',action:'prompt_receipt_status',requestId:'r',receipt:{outcome:'accepted',secret:'never'},headers:{Authorization:'secret'}}),1);
  assert.deepEqual(safe,{kind:'wire',at:1,direction:'inbound',type:'thread:action:completed',requestId:'r',action:'prompt_receipt_status',receiptOutcome:'accepted'});
  const end=humanFrame('inbound',JSON.stringify({type:'turn_end',reason:'error',terminalError:{code:'provider_error',message:'secret'},token:'secret'}));
  assert.equal(end.terminalErrorCode,'provider_error');assert.equal(end.reason,'error');assert.ok(!JSON.stringify(end).includes('secret'));
});
test('journal batches, retains rotated segments, flushes on close and reports bounded overflow',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'human-journal-test-'));
  try{const journal=createHumanJournal(dir,{segmentBytes:128});journal.write({kind:'first'});assert.equal(fs.readFileSync(path.join(dir,'events-0001.ndjson'),'utf8'),'');journal.flush();journal.write({kind:'second'});journal.flush();for(let n=0;n<4100;n++)journal.write({n});journal.close();const batches=fs.readdirSync(dir).sort().flatMap(name=>fs.readFileSync(path.join(dir,name),'utf8').trim().split('\n').map(JSON.parse));assert.equal(batches[0].records[0].kind,'first');assert.equal(batches[1].records[0].kind,'second');assert.equal(batches.at(-1).records.length,4096);assert.equal(batches.at(-1).dropped,4);assert.throws(()=>journal.write({}));assert.ok(fs.readdirSync(dir).length>1);}finally{fs.rmSync(dir,{recursive:true});}
});
test('requested runtime configuration fails closed on wrong model variant or thinking',()=>{
  const opencode={model:'togetherai/deepseek-ai/DeepSeek-V4.1-Flash',variant:'high',thinking:true};assert.equal(assertHumanConfig({opencode:{runtime:opencode}}).variant,'high');for(const patch of [{model:'other'},{variant:'low'},{thinking:false}])assert.throws(()=>assertHumanConfig({opencode:{runtime:{...opencode,...patch}}}));
});
test('durable driver uses real stage and closes on owned page close, without runtime expiry or post-ready input',()=>{
  const source=fs.readFileSync(new URL('./human-session.mjs',import.meta.url),'utf8');assert.match(source,/realServer:true/);assert.match(source,/page.on\('close',\(\)=>finish\('owner-window-closed'\)\)/);assert.match(source,/retainedForDiagnosis=true/);assert.doesNotMatch(source,/cleanupFixture\(|runOwnedCommand\(|setTimeout\(/);const afterReady=source.slice(source.indexOf("console.log('HUMAN_SESSION_READY"));assert.doesNotMatch(afterReady,/\.fill\(|\.click\(|\.press\(|\.focus\(/);
});

test('cleanup signals only current exact owned command identities',()=>{const commands={1:'unrelated',2:'electron --owned-token=fixture-token',3:'node /tmp/fixture-root/server.js',55084:'caffeinate'};const killed=[];signalExactOwned([1,2,3,55084],{token:'fixture-token',root:'/tmp/fixture-root',signal:'SIGTERM',command:pid=>commands[pid]||'',kill:(pid,sig)=>killed.push([pid,sig])});assert.deepEqual(killed,[[2,'SIGTERM'],[3,'SIGTERM']]);});

test('actual resolver reads copied requested config in exact machine subtree',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'human-resolver-test-'));const before=process.env.FUSION_LOCAL_MACHINE;process.env.FUSION_LOCAL_MACHINE='RC-MacAir-15';try{const destination=path.join(root,'ai/RC-MacAir-15/System/config');fs.mkdirSync(destination,{recursive:true});for(const name of ['cli.json','opencode-models.json'])fs.copyFileSync(new URL('../../../ai/RC-MacAir-15/System/config/'+name,import.meta.url),path.join(destination,name));const require=createRequire(import.meta.url);const resolved=await require('../../../fusion-studio-server/lib/cli-config/resolver.js').resolveCliConfig(root,'capture-viewer');assert.equal(assertHumanConfig(resolved).model,'togetherai/deepseek-ai/DeepSeek-V4.1-Flash');assert.equal(resolved.opencode.runtime.variant,'high');assert.equal(resolved.opencode.runtime.thinking,true);}finally{if(before===undefined)delete process.env.FUSION_LOCAL_MACHINE;else process.env.FUSION_LOCAL_MACHINE=before;fs.rmSync(root,{recursive:true});}});

test('provider smoke requires correlated successful actual text, not thinking or failed output',()=>{const receipt={outcome:'accepted',turn_id:'turn'},terminal={turnId:'turn',reason:'complete'},exchange={assistant:JSON.stringify({parts:[{type:'text',content:'HUMAN_SESSION_READY'}]}),metadata:'{}'};assert.equal(humanSmokeReply(exchange,receipt,terminal),'HUMAN_SESSION_READY');assert.throws(()=>humanSmokeReply({...exchange,assistant:JSON.stringify({parts:[{type:'thinking',content:'HUMAN_SESSION_READY'}]})},receipt,terminal));assert.throws(()=>humanSmokeReply({...exchange,metadata:'{"partial":true}'},receipt,terminal));assert.throws(()=>humanSmokeReply(exchange,receipt,{...terminal,terminalErrorCode:'failed'}));assert.throws(()=>humanSmokeReply(exchange,receipt,{...terminal,turnId:'other'}));});
