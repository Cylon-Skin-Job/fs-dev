// Passive human-session telemetry. This is diagnostic instrumentation, not a benchmark.
export const HUMAN_FRAME_TYPES = new Set(['prompt','message:not-sent','thread:action','turn:stop','message:sent','turn_begin','turn_end','chat-turn:saved','thread:state_changed','wire_ready','wire_disconnected','content','thinking','step_begin','error','thread:action:error','thread:action:completed']);
export function humanFrame(direction, payload, at=Date.now()) {
  let frame;try{frame=JSON.parse(String(payload));}catch{return null;}
  if(!HUMAN_FRAME_TYPES.has(frame.type))return null;
  const record={kind:'wire',at,direction,type:frame.type};
  for(const key of ['requestId','threadId','turnId','workspaceId','threadGroupId','streamSeq','state','code','action','model','variant','reason','recoverable']) {
    if(['string','number','boolean'].includes(typeof frame[key]))record[key]=typeof frame[key]==='string'?frame[key].slice(0,512):frame[key];
  }
  if(frame.receipt&&typeof frame.receipt.outcome==='string')record.receiptOutcome=frame.receipt.outcome.slice(0,128);
  if(frame.terminalError&&typeof frame.terminalError.code==='string')record.terminalErrorCode=frame.terminalError.code.slice(0,128);
  if(['content','thinking'].includes(frame.type))record.characters=String(frame.text??frame.content??'').length;
  return record;
}

export function installHumanObserver() {
  if(window.__fusionHumanObserver)return;
  const state={sequence:0,records:[],dropped:0,inFlight:false,closed:false};
  const clock=()=>({at:Date.now(),performanceAt:performance.now(),timeOrigin:performance.timeOrigin});
  const add=row=>{if(state.closed)return;if(state.records.length>=2048){state.records.shift();state.dropped++;}state.records.push({sequence:++state.sequence,...clock(),...row});};
  const listeners=[];const listen=(target,type,fn)=>{target.addEventListener(type,fn,{capture:true,passive:true});listeners.push([target,type,fn]);};
  let lastKeyAt=null;
  const inputEvent=event=>{
    const node=event.target;if(!(node instanceof HTMLTextAreaElement)||!node.matches('.rv-chat-input'))return;
    if(event.type==='keydown')lastKeyAt=performance.now();
    const value=node.value;
    const dispatchAt=performance.now(),eventTimeStamp=event.timeStamp;
    const row={kind:'input',eventTimeStamp,dispatchDelayMs:Number.isFinite(eventTimeStamp)&&eventTimeStamp>=0&&eventTimeStamp<=dispatchAt?dispatchAt-eventTimeStamp:null,type:event.type,key:event.key??null,code:event.code??null,keyCode:event.keyCode??null,isComposing:event.isComposing??null,isTrusted:event.isTrusted,inputType:event.inputType??null,defaultPrevented:event.defaultPrevented,threadId:node.closest('[data-chat-thread-id]')?.getAttribute('data-chat-thread-id')??null,data:typeof event.data==='string'?event.data.slice(0,256):null,dataTruncated:typeof event.data==='string'&&event.data.length>256,valueLength:value.length};
    if(event.type==='input'){row.keyToInputMs=lastKeyAt===null?null:performance.now()-lastKeyAt;lastKeyAt=null;const inputAt=performance.now();requestAnimationFrame(()=>add({kind:'input-raf',delayMs:performance.now()-inputAt,threadId:row.threadId}));}
    add(row);
  };
  for(const type of ['keydown','keyup','beforeinput','input','compositionstart','compositionupdate','compositionend','focus','blur'])listen(document,type,inputEvent);
  listen(document,'click',event=>{const button=event.target instanceof Element?event.target.closest('button'):null;if(!button)return;const label=button.getAttribute('aria-label')||button.getAttribute('title')||'';if(/Send message|Stop generating/.test(label))add({kind:'intent',label,isTrusted:event.isTrusted,threadId:button.closest('[data-chat-thread-id]')?.getAttribute('data-chat-thread-id')??null});});
  for(const type of ['focus','blur','pageshow','pagehide'])listen(window,type,()=>add({kind:'window',type,documentHasFocus:document.hasFocus(),visibility:document.visibilityState}));
  listen(document,'visibilitychange',()=>add({kind:'window',type:'visibilitychange',visibility:document.visibilityState}));
  let observer=null;
  if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('longtask')){observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())add({kind:'longtask',startTime:entry.startTime,duration:entry.duration});});observer.observe({type:'longtask'});}
  add({kind:'installed',longtaskSupported:!!observer,contentLogging:'composer text first16384 characters; overflow explicit',focusIsGate:false});
  let lastBeat=performance.now();
  const beat=setInterval(()=>{const now=performance.now();const gapMs=now-lastBeat;lastBeat=now;const composers=[...document.querySelectorAll('textarea.rv-chat-input')].map(node=>({threadId:node.closest('[data-chat-thread-id]')?.getAttribute('data-chat-thread-id')??null,disabled:node.disabled,length:node.value.length,value:node.value.slice(0,16384),valueTruncated:node.value.length>16384}));add({kind:'heartbeat',gapMs,visibility:document.visibilityState,documentHasFocus:document.hasFocus(),composers,sendButtons:document.querySelectorAll('button[aria-label="Send message"]').length,stopButtons:document.querySelectorAll('button[title="Stop generating"]').length});void flush();},1000);
  async function flush(){if(state.closed||typeof window.__fusionHumanRecord!=='function')return;if(state.inFlight)return state.inFlight;state.inFlight=(async()=>{const records=state.records.splice(0);const dropped=state.dropped;state.dropped=0;try{await window.__fusionHumanRecord({kind:'renderer-batch',...clock(),records,dropped});}catch{state.dropped+=records.length+dropped;}finally{state.inFlight=false;}})();return state.inFlight;}
  window.__fusionHumanObserver={flush,stop:async()=>{clearInterval(beat);observer?.disconnect();for(const [target,type,fn]of listeners)target.removeEventListener(type,fn,true);await flush();if(state.records.length)await flush();state.closed=true;delete window.__fusionHumanObserver;}};
}
