// Executed only in the exact owned diagnostic renderer, including its final reload.
export function watchedRendererTrace() {
  if(window.__chatArchWatchedTrace)return;
  const documentId=crypto.randomUUID(),timeOrigin=performance.timeOrigin;
  const state={documentId,timeOrigin,events:[],overflow:0,sequence:0,pending:new Set(),emitFailures:0};
  window.__chatArchWatchedTrace=state;
  const record=(kind,detail={})=>{
    try {
    const event={sequence:++state.sequence,source:'renderer',documentId,timeOrigin,
      wallMs:Date.now(),monoMs:performance.now(),kind,...detail,
      state:{hasFocus:document.hasFocus(),visibilityState:document.visibilityState}};
    if(state.events.length===512){state.events.shift();state.overflow++;}state.events.push(event);
    if(typeof window.__chatArchEmitWatchedTrace==='function'&&state.pending.size<64) {
      const pending=window.__chatArchEmitWatchedTrace(event).catch(()=>{state.emitFailures++;}).finally(()=>state.pending.delete(pending));
      state.pending.add(pending);
    } else state.emitFailures++;
    } catch {state.emitFailures++;}
  };
  state.record=record;
  const timers=new Set(),listeners=[];
  const listen=(target,name)=>{
    const listener=()=>{record('event',{event:name});if(timers.size>=64){state.overflow++;return;}const t=setTimeout(()=>{timers.delete(t);record('post-event-sample',{event:name});},200);timers.add(t);};
    target.addEventListener(name,listener);listeners.push(()=>target.removeEventListener(name,listener));
  };
  for(const name of ['focus','blur','pagehide','pageshow'])listen(window,name);
  listen(document,'visibilitychange');
  // Read the existing bounded, type-only bootstrap receipt. No second WebSocket wrapper.
  // sourceMonoMs belongs to this document's timeOrigin, never a previous reload.
  let trafficSequence=0;
  const screenshotTypes=new Set(['screenshot:capture','screenshot:updated','screenshot:request','screenshot:data']);
  state.collect=()=>{
    const receipt=window.__chatArchSustained;
    state.trafficOverflow=receipt?.trafficEvidenceOverflow??0;
    for(const event of receipt?.trafficEvidence??[]){
      if(event.sequence<=trafficSequence)continue;
      trafficSequence=event.sequence;
      if(screenshotTypes.has(event.type))record('screenshot-frame',{
        direction:event.direction,type:event.type,trafficSequence:event.sequence,
        sourceMonoMs:event.atMs,sourceEpochMs:timeOrigin+event.atMs,
        clockProvenance:'source atMs rounded to 0.1ms + same-document timeOrigin; wallMs is observation time',
      });
    }
  };
  const interval=setInterval(()=>{state.collect();record('periodic-sample');},1000);
  state.stop=async()=>{
    clearInterval(interval);for(const t of timers)clearTimeout(t);for(const remove of listeners)remove();
    state.collect();record('observers-restored');await Promise.allSettled([...state.pending]);
    return {documentId,timeOrigin,overflow:state.overflow,emitFailures:state.emitFailures,trafficOverflow:state.trafficOverflow,restored:true};
  };
  record('document-observer-installed');
}
