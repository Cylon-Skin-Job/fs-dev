import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const allowed=new Set(['Runtime.evaluate','Runtime.callFunctionOn','Runtime.getProperties','Runtime.releaseObject','Runtime.releaseObjectGroup','Runtime.enable','Runtime.disable','Runtime.runIfWaitingForDebugger']);
const knownReasons=new Map([
 ['Cannot find context with specified id','context-not-found'],
 ['Cannot find object with given id','object-not-found'],
 ['Could not find object with given id','object-not-found'],
 ['Inspected target navigated or closed','target-unavailable'],
 ['Execution context was destroyed.','context-destroyed'],
 ['Execution was terminated','execution-terminated'],
 ['Internal error','internal-error'],
 ['Invalid parameters','invalid-parameters'],
]);
export function sanitizeProtocolError(error) {
 const message=typeof error?.message==='string'?error.message:'';
 const category=knownReasons.get(message)||'unrecognized-redacted';
 return {code:Number.isFinite(error?.code)?error.code:null,category,
  message:category==='unrecognized-redacted'?'[unrecognized protocol error; text withheld]':message};
}
export function assertNodeInspectorSupport() {
 const pkg=require.resolve('playwright-core/package.json'),version=require(pkg).version;
 if(version!=='1.58.2')throw Error('NODE_OBSERVER_UNSUPPORTED_PLAYWRIGHT_VERSION');
 const folder=path.dirname(pkg);
 const debugLogger=require(path.join(folder,'lib/server/utils/debugLogger.js')).debugLogger;
 if(debugLogger.isEnabled('protocol'))throw Error('NODE_OBSERVER_BROAD_PROTOCOL_DEBUG_ENABLED');
 return {version,disconnectedEvent:require(path.join(folder,'lib/server/chromium/crConnection.js')).ConnectionEvents.Disconnected,protocolDebugEnabled:false};
}
// Tests inject version/event metadata. Runtime resolves these from the installed package only.
export function installNodeInspectorObservation(app,{version,disconnectedEvent,protocolDebugEnabled,expectedPid,emit=()=>{},limit=16384,pendingLimit=256,now=()=>({wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin})}={}) {
 if(version===undefined)({version,disconnectedEvent,protocolDebugEnabled}=assertNodeInspectorSupport());
 if(protocolDebugEnabled!==false)throw Error('NODE_OBSERVER_BROAD_PROTOCOL_DEBUG_UNVERIFIED');
 if(version!=='1.58.2')throw Error('NODE_OBSERVER_UNSUPPORTED_PLAYWRIGHT_VERSION');
 const bridge=app?._connection;
 if(typeof bridge?.toImpl!=='function')throw Error('NODE_OBSERVER_UNSUPPORTED_IN_PROCESS_BRIDGE');
 const impl=Reflect.apply(bridge.toImpl,bridge,[app]);
 const connection=impl?._nodeConnection,ownedProcess=app.process?.();
 if(!ownedProcess||!Number.isSafeInteger(ownedProcess.pid)||ownedProcess.pid<=0||(expectedPid!==undefined&&ownedProcess.pid!==expectedPid))throw Error('NODE_OBSERVER_UNSUPPORTED_OWNED_PROCESS');
 if(!connection||impl._nodeSession!==connection.rootSession||impl.process?.()!==ownedProcess
  ||typeof connection._protocolLogger!=='function'||typeof connection.on!=='function'||typeof disconnectedEvent!=='symbol')
  throw Error('NODE_OBSERVER_UNSUPPORTED_OWNED_NODE_CONNECTION');
 const descriptor=Object.getOwnPropertyDescriptor(connection,'_protocolLogger'),original=connection._protocolLogger;
 const pending=new Map(),events=[];
 let overflow=0,recordingErrors=0,sequence=0,restored=false,errorResponses=0;
 const record=(kind,detail={})=>{
  try{const event={sequence:++sequence,...now(),kind,...detail};if(events.length>=limit){overflow++;return;}events.push(event);emit(event);}
  catch{recordingErrors++;}
 };
 const capture=(direction,message)=>{
  if(direction==='send'&&allowed.has(message?.method)&&Number.isSafeInteger(message.id)){
   if(pending.size>=pendingLimit){overflow++;return;}
   const start=now();pending.set(message.id,{method:message.method,start});record('request',{id:message.id,method:message.method});
  } else if(direction==='receive'){
   const request=pending.get(message?.id);
   if(request){pending.delete(message.id);if(message.error)errorResponses++;record('response',{id:message.id,method:request.method,durationMs:now().monoMs-request.start.monoMs,...(message.error?{error:sanitizeProtocolError(message.error)}:{})});}
   else if(message?.method==='Runtime.executionContextCreated')record('context-created',{contextId:Number.isSafeInteger(message.params?.context?.id)?message.params.context.id:null});
   else if(message?.method==='Runtime.executionContextDestroyed')record('context-destroyed',{contextId:Number.isSafeInteger(message.params?.executionContextId)?message.params.executionContextId:null});
   else if(message?.method==='Runtime.executionContextsCleared')record('contexts-cleared');
  }
 };
 function logger(...args){try{capture(args[0],args[1]);}catch{recordingErrors++;}return Reflect.apply(original,this,args);}
 const disconnected=()=>record('node-disconnected');
 const restore=()=>{
  if(restored)return;
  try{connection.removeListener(disconnectedEvent,disconnected);}catch{recordingErrors++;}
  if(connection._protocolLogger===logger){try{if(descriptor)Object.defineProperty(connection,'_protocolLogger',descriptor);else delete connection._protocolLogger;}catch{recordingErrors++;}}
  else {recordingErrors++;record('restoration-conflict');}
  restored=true;record('node-observer-restored',{pendingCount:pending.size});
 };
 try{
  Object.defineProperty(connection,'_protocolLogger',{value:logger,writable:true,configurable:true,enumerable:descriptor?.enumerable??false});
  connection.on(disconnectedEvent,disconnected);record('node-observer-installed',{version});
 }catch(error){restore();throw error;}
 return {restore,snapshot:()=>({version,events:[...events],overflow,recordingErrors,pendingCount:pending.size,errorResponses,restored})};
}
