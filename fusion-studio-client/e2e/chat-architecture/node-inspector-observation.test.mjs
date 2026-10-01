import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installNodeInspectorObservation,assertNodeInspectorSupport} from './node-inspector-observation.mjs';
const disconnectedEvent=Symbol('disconnected'),options={version:'1.58.2',disconnectedEvent,protocolDebugEnabled:false};
function fixture(logger=()=>{}){
 const connection=new EventEmitter();connection.rootSession={};connection._protocolLogger=logger;
 const child={pid:123},impl={_nodeConnection:connection,_nodeSession:connection.rootSession,process:()=>child};
 const app={process:()=>child,_connection:{toImpl(value){assert.equal(this,app._connection);assert.equal(value,app);return impl;}}};
 return {app,connection,impl};
}
test('exact owned Node hook preserves original logger receiver, arguments, returns and exceptions',()=>{
 const returned={},failure=new Error('original logger'),calls=[];
 const {app,connection}=fixture(function(...args){calls.push({receiver:this,args});if(args[0]==='throw')throw failure;return returned;});
 const original=Object.getOwnPropertyDescriptor(connection,'_protocolLogger');
 const hook=installNodeInspectorObservation(app,options),params={functionDeclaration:'private source',arguments:['private argument']};
 const sent={id:1,method:'Runtime.callFunctionOn',params};
 assert.equal(connection._protocolLogger('send',sent),returned);assert.equal(calls[0].receiver,connection);assert.equal(calls[0].args[1],sent);
 assert.throws(()=>connection._protocolLogger('throw',sent),e=>e===failure);
 connection._protocolLogger('receive',{id:1,error:{code:-32000,message:'Cannot find context with specified id'}});
 assert.deepEqual(hook.snapshot().events.find(e=>e.kind==='response').error,{code:-32000,category:'context-not-found',message:'Cannot find context with specified id'});
 hook.restore();assert.deepEqual(Object.getOwnPropertyDescriptor(connection,'_protocolLogger'),original);assert.equal(connection.listenerCount(disconnectedEvent),0);
});
test('filtered receipt excludes params/results/console and redacts unknown error content',()=>{
 const {app,connection}=fixture(),hook=installNodeInspectorObservation(app,options);
 connection._protocolLogger('send',{id:7,method:'Runtime.evaluate',params:{expression:'SECRET'}});
 connection._protocolLogger('receive',{id:7,result:{value:'SECRET'},error:{code:-123,message:'SECRET function() text'}});
 connection._protocolLogger('receive',{method:'Runtime.consoleAPICalled',params:{args:['SECRET']}});
 connection._protocolLogger('send',{id:8,method:'Page.getResourceContent',params:{SECRET:true}});
 connection._protocolLogger('receive',{method:'Runtime.executionContextCreated',params:{context:{id:9,name:'SECRET',origin:'SECRET'}}});
 connection.emit(disconnectedEvent);hook.restore();const result=hook.snapshot();
 assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(result.events.some(e=>e.error?.category==='unrecognized-redacted'&&e.error.code===-123));
 assert.deepEqual(result.events.find(e=>e.kind==='context-created').contextId,9);assert.ok(result.events.some(e=>e.kind==='node-disconnected'));
});
test('unsupported version/bridge/session/debug rejects before mutation and partial install restores',()=>{
 const {app,connection,impl}=fixture(),original=connection._protocolLogger;
 for(const extra of [{version:'1.59.0'},{protocolDebugEnabled:true},{protocolDebugEnabled:undefined},{expectedPid:124}])assert.throws(()=>installNodeInspectorObservation(app,{...options,...extra}),/NODE_OBSERVER_/);
 impl._nodeSession={};assert.throws(()=>installNodeInspectorObservation(app,options),/OWNED_NODE_CONNECTION/);impl._nodeSession=connection.rootSession;
 connection.on=()=>{throw Error('failed listener install');};assert.throws(()=>installNodeInspectorObservation(app,options),/failed listener install/);
 assert.equal(connection._protocolLogger,original);assert.throws(()=>installNodeInspectorObservation({},options),/IN_PROCESS_BRIDGE/);
});
test('buffers/maps and recording failures are bounded without changing logger behavior',()=>{
 const {app,connection}=fixture(()=>42),hook=installNodeInspectorObservation(app,{...options,limit:3,pendingLimit:2,emit(){throw Error('sink');}});
 for(let id=1;id<=20;id++)assert.equal(connection._protocolLogger('send',{id,method:'Runtime.evaluate',params:{secret:id}}),42);
 const before=hook.snapshot();assert.equal(before.pendingCount,2);assert.ok(before.overflow>0);assert.ok(before.recordingErrors>0);assert.ok(before.events.length<=3);hook.restore();assert.equal(hook.snapshot().restored,true);
});
test('installed private hook version/debug preflight is explicitly supported without Electron launch',()=>{
 const info=assertNodeInspectorSupport();assert.equal(info.version,'1.58.2');assert.equal(info.protocolDebugEnabled,false);assert.equal(typeof info.disconnectedEvent,'symbol');
});

test('missing owned PID rejects, original Promise identity is unchanged, protocol failures counted',()=>{
 const promise=Promise.resolve(3),{app,connection,impl}=fixture(()=>promise);
 const child=app.process();child.pid=undefined;assert.throws(()=>installNodeInspectorObservation(app,options),/OWNED_PROCESS/);child.pid=123;
 const hook=installNodeInspectorObservation(app,options);
 assert.equal(connection._protocolLogger('send',{id:1,method:'Runtime.evaluate'}),promise);
 connection._protocolLogger('receive',{id:1,error:{code:-1,message:'private unknown'}});
 assert.equal(hook.snapshot().errorResponses,1);hook.restore();
});
