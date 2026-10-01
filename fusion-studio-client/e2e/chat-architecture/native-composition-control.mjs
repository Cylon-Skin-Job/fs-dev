import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export async function installCompositionControl(page) {
  return page.evaluate(documentIds=>{
    if(window.__nativeCompositionControl)throw Error('composition control already installed');
    const frame=document.createElement('iframe');
    frame.title='Isolated native composition control';
    frame.setAttribute('data-native-composition-control','');
    Object.assign(frame.style,{position:'fixed',top:'64px',right:'24px',width:'400px',height:'170px',zIndex:'2147483647',background:'white',border:'3px solid #777'});
    document.body.append(frame);
    const doc=frame.contentDocument;
    if(!doc?.body){frame.remove();throw Error('unhandled control document unavailable');}
    const label=doc.createElement('label');label.textContent='DIAGNOSTIC ONLY — unhandled native textarea';
    const input=doc.createElement('textarea');input.setAttribute('aria-label','Native composition control (unhandled)');
    input.rows=4;input.cols=40;label.append(input);doc.body.append(label);
    const state={events:[],overflow:0,truncated:0,sequence:0,eventId:0,documents:[],timers:new Set(),listeners:[],frame};
    state.cleanup=()=>{
      for(const {ownerDocument,type,listener} of state.listeners)ownerDocument.removeEventListener(type,listener,true);
      for(const {ownerWindow,timer} of state.timers)ownerWindow.clearTimeout(timer);
      state.listeners.length=0;state.timers.clear();frame.remove();delete window.__nativeCompositionControl;
    };
    window.__nativeCompositionControl=state;
    const limit=(value,max)=>{const s=String(value??'');const truncated=s.length>max;if(truncated)state.truncated++;return {text:s.slice(0,max),truncated};};
    const append=row=>{row.sequence=++state.sequence;if(state.events.length===2048){state.events.shift();state.overflow++;}state.events.push(row);};
    for(const [surface,ownerDocument] of [['real-composer',document],['unhandled-control',doc]]) {
      const ownerWindow=ownerDocument.defaultView,documentId=documentIds[surface];
      state.documents.push({surface,documentId,timeOrigin:ownerWindow.performance.timeOrigin});
      const clock=()=>({wallAt:Date.now(),performanceAt:ownerWindow.performance.now(),timeOrigin:ownerWindow.performance.timeOrigin});
      const focus=()=>{const node=ownerDocument.activeElement;return {tag:node?.tagName??null,
        target:node===input?'unhandled-control':node?.matches?.('textarea.rv-chat-input')?'real-composer':'other',
        documentHasFocus:ownerDocument.hasFocus(),visibilityState:ownerDocument.visibilityState};};
      const listener=event=>{
        const target=event.target;
        if(surface==='real-composer'?!target?.matches?.('textarea.rv-chat-input'):target!==input)return;
        const eventId=++state.eventId,value=limit(target.value,512),data=limit(event.data,128);
        const base={eventId,surface,documentId,type:event.type,targetTag:target.tagName,
          threadId:surface==='real-composer'?target.closest('[data-chat-thread-id]')?.getAttribute('data-chat-thread-id')??null:null,
          key:typeof event.key==='string'?limit(event.key,64).text:null,code:typeof event.code==='string'?limit(event.code,64).text:null,
          altKey:event.altKey??null,ctrlKey:event.ctrlKey??null,metaKey:event.metaKey??null,shiftKey:event.shiftKey??null,
          keyCode:typeof event.keyCode==='number'?event.keyCode:null,isComposing:event.isComposing??null,
          isTrusted:event.isTrusted,inputType:event.inputType??null,data:data.text,dataTruncated:data.truncated,
          value:value.text,valueTruncated:value.truncated,selectionStart:target.selectionStart,selectionEnd:target.selectionEnd};
        append({...base,...clock(),snapshotPhase:'capture',defaultPrevented:event.defaultPrevented,focus:focus()});
        if(event.type==='keydown'||event.type==='keyup') {
          // A later task runs after dispatch; a microtask can run between listeners.
          const timer=ownerWindow.setTimeout(()=>{
            state.timers.delete(entry);const valueAfter=limit(target.value,512);
            append({...base,...clock(),snapshotPhase:'later-task-after-dispatch',defaultPrevented:event.defaultPrevented,
              value:valueAfter.text,valueTruncated:valueAfter.truncated,focus:focus()});
          },0);
          const entry={ownerWindow,timer};state.timers.add(entry);
        }
      };
      for(const type of ['keydown','keyup','beforeinput','input','compositionstart','compositionupdate','compositionend','focus','blur']) {
        ownerDocument.addEventListener(type,listener,true);state.listeners.push({ownerDocument,type,listener});
      }
    }
    return {documents:state.documents,controlFrameTitle:frame.title,controlLabel:input.getAttribute('aria-label'),
      bound:2048,valueLimit:512,dataLimit:128,retention:'newest2048 records; all trust values retained, overflow/truncation fail completeness'};
  },{'real-composer':crypto.randomUUID(),'unhandled-control':crypto.randomUUID()});
}

export async function readCompositionControl(page) {
  return page.evaluate(()=>{
    const s=window.__nativeCompositionControl;if(!s)throw Error('composition observer unavailable');
    const control=s.frame.contentDocument.querySelector('textarea');
    return {at:Date.now(),events:s.events,overflow:s.overflow,truncated:s.truncated,documents:s.documents,
      controlValue:control.value.slice(0,512),controlValueTruncated:control.value.length>512,
      composers:[...document.querySelectorAll('textarea.rv-chat-input')].map(n=>({threadId:n.closest('[data-chat-thread-id]')?.getAttribute('data-chat-thread-id')??null,value:n.value.slice(0,512),truncated:n.value.length>512}))};
  });
}

export async function runCompositionControl(runtime,identity,{evidenceRoot,token,durationMs=600000}) {
  assert.equal(durationMs,600000);
  const output=path.join(evidenceRoot,'native-composition-control-result.json');
  const result={status:'setup',scope:'diagnostic only; no native correctness, performance or owner acceptance credit',ownerAcceptance:false};
  const save=()=>fs.writeFileSync(output,JSON.stringify(result,null,2));
  let failure;
  try {
    result.observer=await installCompositionControl(runtime.page);
    const handle=await runtime.app.browserWindow(runtime.page);
    let windowId;try{windowId=await handle.evaluate(w=>w.id);}finally{await handle.dispose();}
    const runId=token.replace(/^chat-architecture-owner-/,''),title=`ISOLATED COMPOSITION CONTROL — ${runId}`;
    const windowIdentity=await runtime.app.evaluate(({BrowserWindow},{pid,windowId,title})=>{
      const w=BrowserWindow.fromId(windowId);
      if(process.pid!==pid||!w||!w.webContents.getURL().startsWith('fusion-shell://app/'))throw Error('composition exact owned window unavailable');
      w.setTitle(title);return {pid:process.pid,windowId:w.id,title:w.getTitle()};
    },{pid:runtime.pid,windowId,title});
    result.identity={...identity,...windowIdentity,runId};result.startedAt=Date.now();result.deadlineAt=result.startedAt+durationMs;
    result.status='observing';save();console.log('NATIVE_COMPOSITION_READY '+JSON.stringify({...result.identity,deadlineAt:result.deadlineAt,observer:result.observer}));
    let lastProgress=result.startedAt;
    while(Date.now()<result.deadlineAt) {
      await runtime.page.waitForTimeout(Math.min(2000,result.deadlineAt-Date.now()));
      result.observation=await readCompositionControl(runtime.page);save();
      if(Date.now()-lastProgress>=20000){lastProgress=Date.now();console.log('NATIVE_COMPOSITION_PROGRESS '+JSON.stringify({runId,at:lastProgress,events:result.observation.events.length,overflow:result.observation.overflow,deadlineAt:result.deadlineAt}));}
    }
    assert.equal(result.observation.overflow,0,'composition observation overflow');
    assert.equal(result.observation.truncated,0,'composition event text truncated');
    assert.equal(result.observation.controlValueTruncated,false);
    assert.ok(result.observation.composers.every(c=>!c.truncated));
    result.status='diagnostic-complete';result.endedAt=Date.now();
  } catch(error){failure=error;result.status='failed';result.failure={message:error.message};}
  finally {
    try{result.finalObservation=await readCompositionControl(runtime.page);
      assert.equal(result.finalObservation.overflow,0);assert.equal(result.finalObservation.truncated,0);
      assert.equal(result.finalObservation.controlValueTruncated,false);assert.ok(result.finalObservation.composers.every(c=>!c.truncated));}catch(error){result.finalObservationFailure=error.message;failure??=error;result.status='failed';}
    try{await runtime.page.evaluate(()=>window.__nativeCompositionControl?.cleanup());result.observerRemoved=true;}
    catch(error){result.cleanupFailure=error.message;failure??=error;result.status='failed';}
    save();
  }
  if(failure)throw failure;
  console.log('NATIVE_COMPOSITION_DIAGNOSTIC_COMPLETE');return result;
}
