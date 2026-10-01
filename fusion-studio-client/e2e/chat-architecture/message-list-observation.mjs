import assert from 'node:assert/strict';

// Disposable-stage instrumentation only; never changes product stores or caches.
export function instrumentMessageList(source) {
  const signature=/function MessageList\([^)]*\)\{/g;
  assert.equal([...source.matchAll(signature)].length,1,'unique MessageList observation target');
  return `window.__chatArchMessageListObservation={enabled:true,counts:{},overflow:0};
function chatArchRecordMessageList(threadId){
  const observation=window.__chatArchMessageListObservation;
  const key=String(threadId??'[none]');
  if(Object.hasOwn(observation.counts,key)||Object.keys(observation.counts).length<16)
    observation.counts[key]=(observation.counts[key]||0)+1;
  else observation.overflow++;
}
`+source.replace(signature,match=>match+`if(window.__chatArchMessageListObservation.enabled)chatArchRecordMessageList(arguments[0]?.threadId);`);
}

export function attributionViolations(observation,coverage,{composerThreadId,liveThreadId}={}) {
  const total=Object.values(observation.counts).reduce((n,count)=>n+count,0);
  return [
    observation.overflow||total!==coverage.chatArchRecordMessageList||total>coverage.MessageList
      ?'MessageList attribution incomplete':null,
    (observation.counts[composerThreadId]??0)!==0?'F2 MessageList work':null,
    Object.entries(observation.counts).some(([id,count])=>count!==0&&id!==liveThreadId)
      ?'idle thread MessageList work':null,
  ].filter(Boolean);
}
