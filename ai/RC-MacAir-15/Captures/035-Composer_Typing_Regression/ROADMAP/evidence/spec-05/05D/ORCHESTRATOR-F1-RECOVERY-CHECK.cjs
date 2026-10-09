// Same preserved root reproduction, asserting required recovery on repaired bytes.
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const path = require('node:path');
const fromRepo = createRequire(path.join(process.cwd(), 'package.json'));
const tws = fromRepo.resolve('./fusion-studio-server/lib/thread/ThreadWebSocketHandler');
require.cache[tws] = { id:tws, filename:tws, loaded:true, exports:{ getState:()=>null } };
const { SessionManager } = fromRepo('./fusion-studio-server/lib/thread/session-manager');
const { SessionLifecycle } = fromRepo('./fusion-studio-server/lib/thread/session-lifecycle');
const { threadRuntimeManager: runtime } = fromRepo('./fusion-studio-server/lib/thread/thread-runtime-manager');
const { stopRuntimeTurn } = fromRepo('./fusion-studio-server/lib/thread/runtime-stop');
const { createCanonicalDrainControl, createCanonicalRouteContext } = fromRepo('./fusion-studio-server/lib/thread/canonical-drain-context');
(async () => {
 const key = { workspaceId:'review-owned', projectRoot:'/nonexistent/review-owned', workspaceEpoch:'review-epoch', scope:'project', threadId:'review-thread' };
 const sessions = new SessionManager(); let suspends=0, stopCalls=0;
 const index={list:async()=>[],activate:async()=>{},markResumed:async()=>{},suspend:async()=>{suspends++;}};
 const lifecycle=new SessionLifecycle({...key,index,sessionManager:sessions,mirror:{}});
 const ws={send(){},readyState:1}; const wire=new EventEmitter(); wire.kill=()=>true;
 await lifecycle.openSession(key.threadId,wire,ws,{workspaceEpoch:key.workspaceEpoch});
 const operations={...key,getSession:sessions.getSession.bind(sessions),beginSessionRetirement:sessions.beginSessionRetirement.bind(sessions),completeStoppedSession:lifecycle.completeStoppedSession.bind(lifecycle),reconcileProviderExit:lifecycle.reconcileProviderExit.bind(lifecycle)};
 const control=createCanonicalDrainControl({drainId:'accepted-prebegin-drain',runtimeKey:key,touchThreadSession(){},stopHarness:async()=>{stopCalls++;throw new Error('controlled bounded provider termination failure');}});
 const route=createCanonicalRouteContext({...key,workspace:'workspace:review-owned',acceptedUserInput:'fixture',attachments:[]});
 runtime.claimActiveDrain(key,control,route);runtime.markInFlight(key);const ownership=runtime.captureOwnership(key);
 let completeIterator;const completion=new Promise(resolve=>{completeIterator=resolve;});
 runtime.bindActiveDrainLifecycle(key,control.drainId,{completion,retire:()=>stopRuntimeTurn({ws,session:{workspaceEpoch:key.workspaceEpoch},clientMsg:{threadId:key.threadId},allowInactiveDrain:true,returnOutcome:true,runtimeBinding:{sessions:operations,wire,runtimeKey:key,drainId:control.drainId,ownership}})});
 let firstError;try{await lifecycle.closeSession(key.threadId);}catch(e){firstError=e.message;}
 const exactSession=sessions.getSession(key.threadId);assert.equal(firstError,'Canonical drain retirement failed');
 completeIterator();wire.exitCode=0;wire.emit('exit',0,null);const reconciliation=exactSession.exitReconciliation;
 let lateError;try{await reconciliation;}catch(e){lateError=e.message;}await new Promise(resolve=>setImmediate(resolve));
 let retryError;try{await lifecycle.closeSession(key.threadId);}catch(e){retryError=e.message;}
 console.log(JSON.stringify({firstError,lateError,retryError,providerExitObserved:exactSession.providerExitObserved,sessionRetained:sessions.getSession(key.threadId)===exactSession,sessionState:exactSession.state,runtimeState:runtime.getRuntimeState(key),activeDrainRetained:!!runtime.getActiveDrain(key),suspends,stopCalls,idleTimers:sessions.timeouts.size}));
 assert.equal(lateError,undefined);assert.equal(retryError,undefined);assert.equal(sessions.getSession(key.threadId),undefined);assert.equal(runtime.getRuntimeState(key),'cold');assert.equal(runtime.getActiveDrain(key),null);assert.equal(suspends,1);assert.equal(stopCalls,1);assert.equal(sessions.timeouts.size,0);
 sessions.completeStoppedSession(key.threadId,wire);runtime.runtimes.clear();
})().catch(e=>{console.error(e);process.exitCode=1;});
