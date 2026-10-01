import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import {earlyLifecycleOptions,observeEarlyActivation,finishEarlyLifecycle,withEarlyLaunchCleanup,markEarly} from './early-lifecycle-driver.mjs';
import {SCENARIOS,ENFORCE_GROUPS} from './scenario-inventory.mjs';
const require=createRequire(import.meta.url),{installEarlyLifecycle,startEarlyLifecycle,assertSameDirectory}=require('./early-lifecycle-preload.cjs');
const root=path.resolve(import.meta.dirname,'../..'),asar=require('@electron/asar');
const ownedDirectories=[];
afterEach(()=>{for(const directory of ownedDirectories.splice(0))fs.rmSync(directory,{recursive:true,force:true});});
function fixture(){
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'chat-architecture-cwd-test-'));ownedDirectories.push(cwd);const entry=path.join(cwd,'main.cjs');
 const events=[],summaries=[],app=new EventEmitter(),owned=new EventEmitter();
 Object.assign(app,{isActive:()=>false,isHidden:()=>false,dock:{isVisible:()=>true}});
 Object.assign(owned,{pid:123,execPath:'/Electron',argv:['/Electron','-r','/preload',entry,'--chat-architecture-token=owned'],cwd:()=>cwd});
 return {app,owned,events,summaries,options:{app,process:owned,config:{entry,cwd,token:'owned',summary:path.join(cwd,'summary.json')},self:'/preload',write:e=>events.push(e),writeSummary:e=>summaries.push(e)}};
}
test('actual Electron default_app parser preloads installed Playwright loader then fixture before original main',async()=>{
 const source=asar.extractFile(path.join(root,'node_modules/electron/dist/Electron.app/Contents/Resources/default_app.asar'),'main.js').toString();
 const parser=source.slice(source.indexOf('// Parse command line options.'),source.indexOf('// See lib/browser/desktop-name.ts'));
 const loader=fs.readFileSync(path.join(root,'node_modules/playwright-core/lib/server/electron/loader.js'),'utf8');
 const f=fixture(),order=[];let trace;const nativeReady=Promise.resolve('ready'),originalReady=()=>nativeReady;
 f.app.whenReady=originalReady;f.app.commandLine={appendSwitch:()=>{}};
 const argv=['/Electron','-r','/installed-loader','--inspect=0','--remote-debugging-port=0','-r','/preload',f.options.config.entry,'--chat-architecture-token=owned'];
 f.owned.argv=argv;f.owned.env={};f.owned.exit=()=>{throw Error('unexpected exit');};
 const context=vm.createContext({process:f.owned,console,Module:{_preloadModules(modules){
  assert.deepEqual(Array.from(modules),['/installed-loader','/preload']);
  for(const module of modules){order.push(module);if(module==='/installed-loader')vm.runInContext(loader,context);else trace=installEarlyLifecycle(f.options);}
 }},require:name=>name==='electron'?{app:f.app}:{chromiumSwitches:()=>[]}});
 vm.runInContext(parser,context);assert.equal(vm.runInContext('option.file',context),f.options.config.entry);
 assert.deepEqual(argv,['/Electron',f.options.config.entry,'--chat-architecture-token=owned']);assert.equal(f.owned.cwd(),f.options.config.cwd);
 const wrappedReady=f.app.whenReady,wrappedEmit=f.app.emit,wrappedIsReady=f.app.isReady;
 assert.equal(f.app.isReady(),false);order.push('original-main');f.app.on('ready',()=>order.push('ready-to-main'));
 f.app.emit('ready','native ready');assert.equal(order.includes('ready-to-main'),false);
 await vm.runInContext('__playwright_run()',context);assert.equal(f.app.isReady(),true);assert.ok(order.includes('ready-to-main'));
 assert.equal(f.app.whenReady,wrappedReady);assert.equal(f.app.emit,wrappedEmit);assert.equal(f.app.isReady,wrappedIsReady);trace.stop();
 assert.deepEqual(order.slice(0,3),['/installed-loader','/preload','original-main']);
});
test('binding observes only first owned window, unavailable getters explicit, events bounded/restored',()=>{
 const f=fixture();Object.defineProperty(f.app,'dock',{get(){throw Error('unavailable');}});
 const trace=installEarlyLifecycle({...f.options,limit:5});const window=new EventEmitter();Object.assign(window,{id:1,isFocused:()=>false,isVisible:()=>true,isMinimized:()=>false,isFocusable:()=>true});
 f.app.emit('browser-window-created',{},window);f.app.emit('browser-window-created',{},new EventEmitter());window.emit('focus');window.emit('blur');window.emit('hide');
 trace.stop();assert.equal(f.events[0].state.dockVisible.available,false);assert.equal(trace.snapshot().unexpectedWindows,1);assert.ok(trace.snapshot().overflow>0);
 assert.equal(f.app.listenerCount('ready'),0);assert.equal(window.listenerCount('focus'),0);assert.equal(f.owned.listenerCount('exit'),0);assert.equal(f.summaries.length,1);
});
test('argv mismatch fails before listeners/mutation; partial installation preserves original error and restores',()=>{
 const f=fixture();f.owned.argv.push('unexpected');assert.throws(()=>installEarlyLifecycle(f.options),/ARGV_MISMATCH/);assert.equal(f.app.eventNames().length,0);assert.equal(f.owned.argv.length,6);
 f.owned.argv.pop();const original=f.app.on;const failure=new Error('listener failure');f.app.on=function(name,fn){if(name==='ready')throw failure;return original.call(this,name,fn);};
 assert.throws(()=>installEarlyLifecycle(f.options),e=>e===failure);assert.equal(f.app.listenerCount('will-finish-launching'),0);
});
test('only second launch gets transient preload arguments and ordinary cases remain unchanged',()=>{
 const options={entry:'/stage/main.cjs',cwd:'/stage',stageRoot:'/stage-root',token:'owned',evidenceRoot:'/evidence'};
 assert.equal(earlyLifecycleOptions({...options,launchNumber:1,enabled:false}),null);
 assert.throws(()=>earlyLifecycleOptions({...options,launchNumber:1,enabled:true}),/second owned launch/);
 const second=earlyLifecycleOptions({...options,launchNumber:2,enabled:true});assert.deepEqual(second.args.slice(2),[options.entry,'--chat-architecture-token=owned']);assert.equal(second.args[0],'-r');
 const helper=fs.readFileSync(new URL('./electron-case-helpers.mjs',import.meta.url),'utf8');for(const marker of ['electron-launch-return','firstWindow-return','renderer-Connected'])assert.ok(helper.includes(marker));
});
test('one initial attempt then full15s observation survives failure, with no repeated activation',async()=>{
 let now=0,calls=0,reads=0;const failure=new Error('activation failed');
 const result=await observeEarlyActivation({now:()=>now,activate:async()=>{calls++;throw failure;},observe:async()=>{reads++;},wait:async ms=>{now+=ms;},mark:()=>{}});
 assert.equal(result.endedAt-result.startedAt,15000);assert.equal(calls,1);assert.equal(reads,15);assert.equal(result.failure,failure);
});
test('exit writes durable summary and missing summary is explicitly incomplete after cleanup',()=>{
 const f=fixture(),trace=installEarlyLifecycle(f.options);f.owned.emit('exit',0);assert.equal(trace.snapshot().stopped,true);assert.ok(f.events.some(e=>e.kind==='process-exit'));assert.equal(f.summaries[0].stopped,true);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chat-architecture-early-test-'));
 try{const result=finishEarlyLifecycle({timeline:path.join(dir,'events'),summary:path.join(dir,'missing')},{fixtureRootsRemoved:true},[]);assert.equal(result.complete,false);assert.equal(result.summaryStatus,'unavailable');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('early lifecycle is explicit diagnostic scope with hard240s deadline and no policy/protocol mutation',()=>{
 const id='R9-EARLY-LIFECYCLE';assert.equal(SCENARIOS.find(s=>s.id===id).state,'diagnostic-only');for(const ids of Object.values(ENFORCE_GROUPS))assert.ok(!ids.includes(id));
 const runner=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8');assert.match(runner,/'R9-EARLY-LIFECYCLE': \{[\s\S]*?explicitOnly: true, diagnosticDeadlineMs: 240000/);
 const preload=fs.readFileSync(new URL('./early-lifecycle-preload.cjs',import.meta.url),'utf8');assert.doesNotMatch(preload,/setActivationPolicy|dock\.(show|hide)|setFocusable|\.focus\(|\.show\(/);
 const driver=fs.readFileSync(new URL('./early-lifecycle-driver.mjs',import.meta.url),'utf8');assert.doesNotMatch(driver,/installNodeInspector|keyboard|\.click\(/);
});

test('failed firstWindow/URL or marker path closes captured app, preserves original error/config and cannot skip cleanup',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chat-architecture-early-failure-'));
 try{
  const config={timeline:path.join(dir,'missing','events'),summary:path.join(dir,'missing-summary')};
  const failure=new Error('firstWindow rejected');let closed=0;
  await assert.rejects(withEarlyLaunchCleanup(config,async()=>{markEarly(config,'launch-return');throw failure;},async()=>{closed++;return [];}),error=>error===failure);
  assert.equal(closed,1);assert.ok(config.driverWriteErrors>0);assert.deepEqual(config.failedLaunchLingering,[]);
  const result=finishEarlyLifecycle(config,{fixtureRootsRemoved:true,portFileRemoved:true},[]);assert.equal(result.complete,false);assert.ok(result.driverWriteErrors>0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('real filesystem symlink alias passes directory identity without changing argv/cwd or entry',()=>{
 const f=fixture(),actual=f.options.config.cwd,alias=actual+'-alias';ownedDirectories.push(alias);fs.symlinkSync(actual,alias,'dir');
 f.options.config.cwd=alias;const originalArgv=f.owned.argv.slice();const originalCwd=f.owned.cwd();
 const trace=installEarlyLifecycle(f.options);assert.equal(f.owned.cwd(),originalCwd);assert.deepEqual(f.owned.argv,[originalArgv[0],...originalArgv.slice(3)]);
 const installed=f.events.find(e=>e.kind==='preload-installed-before-main');assert.equal(installed.entry,f.options.config.entry);assert.equal(installed.cwdIdentity.sameDirectory,true);assert.equal(installed.cwdIdentity.actualCanonical,installed.cwdIdentity.configuredCanonical);trace.stop();
});
test('different, missing and nondirectory cwd fail closed before argv/listener changes with bounded category',()=>{
 const f=fixture(),other=fs.mkdtempSync(path.join(os.tmpdir(),'chat-architecture-other-cwd-'));ownedDirectories.push(other);
 const file=path.join(other,'file');fs.writeFileSync(file,'fixture');
 for(const [cwd,category] of [[other,'EARLY_PRELOAD_CWD_MISMATCH'],[path.join(other,'missing'),'EARLY_PRELOAD_CWD_UNAVAILABLE'],[file,'EARLY_PRELOAD_CWD_UNAVAILABLE']]){
  f.options.config.cwd=cwd;const before=f.owned.argv.slice();assert.throws(()=>startEarlyLifecycle(f.options),error=>error.message===category);
  assert.deepEqual(f.owned.argv,before);assert.equal(f.app.eventNames().length,0);
  const receipt=JSON.parse(fs.readFileSync(path.join(path.dirname(f.options.config.summary),'early-preload-failure.json'),'utf8'));assert.equal(receipt.category,category);assert.equal(Object.keys(receipt).sort().join(','),'category,monoMs,pid,scope,timeOrigin,wallMs');
 }
 assert.throws(()=>assertSameDirectory(path.join(other,'also-missing'),other),/CWD_UNAVAILABLE/);
});
test('pre-init category persistence preserves original failure and withholds arbitrary error text',()=>{
 const f=fixture(),failure=new Error('SECRET original failure');f.app.on=()=>{throw failure;};
 assert.throws(()=>startEarlyLifecycle(f.options),error=>error===failure);
 const receipt=fs.readFileSync(path.join(path.dirname(f.options.config.summary),'early-preload-failure.json'),'utf8');assert.ok(!receipt.includes('SECRET'));assert.equal(JSON.parse(receipt).category,'EARLY_PRELOAD_INITIALIZATION_FAILED');
});
