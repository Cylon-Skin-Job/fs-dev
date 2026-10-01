import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {createWatchedTraceCore} from './watched-trace-core.mjs';
const clock=()=>({wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin});
test('tracing preserves receiver, arguments, return/promise/exception identity and restores descriptors',()=>{
 const arg={},returned={},promise=Promise.resolve(returned),failure=new Error('private error');
 const target={method(value){assert.equal(this,target);assert.equal(value,arg);return returned;},promise(){return promise;},fail(){throw failure;}};
 const descriptors=Object.getOwnPropertyDescriptors(target);
 const trace=createWatchedTraceCore({clock});
 for(const key of Object.keys(target))trace.wrap(target,key,key);
 assert.equal(target.method(arg),returned);assert.equal(target.promise(),promise);assert.throws(()=>target.fail(),e=>e===failure);
 trace.stop();assert.deepEqual(Object.getOwnPropertyDescriptors(target),descriptors);
 const receipt=JSON.stringify(trace.snapshot());assert.ok(!receipt.includes('private error'));assert.ok(!receipt.includes('arguments'));
});
test('recording failure does not replace original outcome; inherited methods and listeners restore',()=>{
 const original=()=>42,target=Object.create({method:original}),emitter=new EventEmitter();
 const trace=createWatchedTraceCore({clock,emit(){throw Error('sink unavailable');}});
 trace.wrap(target,'method','inherited');trace.listen(emitter,'focus');assert.equal(target.method(),42);
 emitter.emit('focus');trace.stop();assert.equal(Object.hasOwn(target,'method'),false);assert.equal(emitter.listenerCount('focus'),0);
 assert.ok(trace.snapshot().observationErrors>0);
});
test('bounded recorder reports overflow and restoration conflicts without overwriting replacement',()=>{
 const target={method(){return 1;}},trace=createWatchedTraceCore({clock,limit:2});trace.wrap(target,'method','method');
 target.method();target.method();const replacement=()=>2;target.method=replacement;trace.stop();
 assert.equal(target.method,replacement);assert.ok(trace.snapshot().overflow>0);
 assert.ok(trace.snapshot().coverage.some(c=>c.status==='restoration-conflict'));assert.equal(trace.snapshot().events.length,2);
});
test('diagnostic integration is setup-only, records cleanup outside renderer, and retains four-minute scope',()=>{
 const source=fs.readFileSync(new URL('./r1-sustained-electron.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(setupOnly\)diagnosticTrace=await installWatchedSetupTrace/);
 assert.match(source,/phase\('settle-45s',\(\)=>runtime.page.waitForTimeout\(45_000\)\)/);
 const trace=fs.readFileSync(new URL('./watched-setup-trace.mjs',import.meta.url),'utf8');
 assert.match(trace,/const ownedProcess=runtime.app.process/);assert.match(trace,/source:'driver-method',pid:process.pid/);
 assert.ok(trace.indexOf("mark('close-request'")<trace.indexOf('await closeOwnedApp(runtime)'));
 assert.ok(trace.indexOf("mark('close-completion'")>trace.indexOf('await closeOwnedApp(runtime)'));
 assert.match(trace,/ownedProcess.once\('exit',onExit\)/);
});
