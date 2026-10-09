import fs from 'node:fs';
import path from 'node:path';
import {createWatchedTraceCore} from './watched-trace-core.mjs';
import {watchedRendererTrace} from './watched-renderer-trace.mjs';

// Driver journal survives renderer/main shutdown. Never installed by a timing case.
export async function installWatchedSetupTrace(runtime,evidenceRoot) {
  const file=path.join(evidenceRoot,'watched-setup-timeline.ndjson');
  const summary={status:'observing',gaps:[],documents:{},main:null,renderer:null,processExitObserved:false};
  let written=0,journalOverflow=0,journalWriteErrors=0;
  const append=event=>{if(written>=4096){journalOverflow++;return;}try{fs.appendFileSync(file,JSON.stringify(event)+'\n');written++;}catch{journalWriteErrors++;}};
  const mark=(kind,detail={})=>append({source:'driver',wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin,kind,...detail});
  const rememberDocument=value=>{
    if(!value?.documentId)return;
    if(!summary.documents[value.documentId]&&Object.keys(summary.documents).length>=8){journalOverflow++;return;}
    const prior=summary.documents[value.documentId]||{};
    summary.documents[value.documentId]={timeOrigin:value.timeOrigin,
      overflow:Math.max(prior.overflow||0,value.overflow||0),
      emitFailures:Math.max(prior.emitFailures||0,value.emitFailures||0),
      trafficOverflow:Math.max(prior.trafficOverflow||0,value.trafficOverflow||0)};
  };
  const seen=new Map();
  const recordBatch=batch=>{
    if(!batch)return;
    for(const event of batch.events){const key=event.source+':'+(event.documentId??event.pid);if(!seen.has(key)&&seen.size>=8){journalOverflow++;continue;}if(event.sequence>(seen.get(key)||0)){append(event);seen.set(key,event.sequence);}}
  };
  await runtime.page.exposeBinding('__chatArchEmitWatchedTrace',({frame},event)=>{
    if(frame===runtime.page.mainFrame())recordBatch({events:[event]});
  });
  await runtime.page.addInitScript(watchedRendererTrace);
  await runtime.page.evaluate(watchedRendererTrace);
  const identity=await runtime.app.evaluate(({BrowserWindow,app},{coreSource})=>{
    const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('fusion-shell://app/'));
    if(!w)throw Error('owned diagnostic window unavailable');
    // Source is this fixture's frozen portable recorder, never application input.
    const create=(0,eval)('('+coreSource+')');
    const trace=create({clock:()=>({source:'main',pid:process.pid,windowId:w.id,wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin}),
      sample:()=>({focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),appHidden:app.isHidden()})});
    globalThis.__chatArchMainTrace=trace;
    for(const name of ['show','showInactive','hide','minimize','restore','focus','blur','moveTop'])trace.wrap(w,name,'window.'+name);
    for(const name of ['show','hide','focus'])trace.wrap(app,name,'app.'+name);
    trace.wrap(w.webContents,'focus','webContents.focus');
    for(const name of ['show','hide','minimize','restore','focus','blur','close','closed'])trace.listen(w,name,'window.'+name);
    for(const name of ['activate','browser-window-focus','browser-window-blur','before-quit','will-quit'])trace.listen(app,name,'app.'+name);
    trace.record('main-observer-installed');return {pid:process.pid,windowId:w.id};
  },{coreSource:createWatchedTraceCore.toString()});
  summary.identity=identity;
  const driver=createWatchedTraceCore({clock:()=>({source:'driver-method',pid:process.pid,wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin}),emit:append});
  driver.wrap(runtime.page,'bringToFront','fixture.page.bringToFront');
  const ownedProcess=runtime.app.process();
  const onExit=(code,signal)=>{summary.processExitObserved=true;mark('owned-process-exit',{pid:identity.pid,code,signal});};
  ownedProcess.once('exit',onExit);
  let flushing=false,stopped=false;
  const flush=async()=>{
    if(flushing||stopped)return;flushing=true;
    try {
      const results=await Promise.allSettled([
        runtime.app.evaluate(()=>globalThis.__chatArchMainTrace?.snapshot()),
        runtime.page.evaluate(()=>{const s=window.__chatArchWatchedTrace;s?.collect();return s?{events:s.events,overflow:s.overflow,emitFailures:s.emitFailures,trafficOverflow:s.trafficOverflow,documentId:s.documentId,timeOrigin:s.timeOrigin}:null;}),
      ]);
      for(let i=0;i<results.length;i++){
        const value=results[i];if(value.status==='fulfilled'){recordBatch(value.value);if(i)rememberDocument(value.value);summary[i?'renderer':'main']=value.value?{...value.value,events:undefined}:null;}
        else {const gap={side:i?'renderer':'main',wallMs:Date.now(),phase:'observation-poll'};if(summary.gaps.length<32)summary.gaps.push(gap);mark('observation-incomplete',gap);}
      }
    } finally {flushing=false;}
  };
  const timer=setInterval(()=>{void flush();},1000);timer.unref();
  mark('diagnostic-trace-installed',identity);
  return {
    async phase(name,action){mark('phase-start',{phase:name});await flush();try{return await action();}finally{await flush();mark('phase-end',{phase:name});}},
    async close(closeOwnedApp){
      mark('diagnostic-complete-closing');console.log('DIAGNOSTIC_COMPLETE_CLOSING '+JSON.stringify(identity));
      await runtime.app.evaluate(({BrowserWindow},id)=>{const w=BrowserWindow.fromId(id);if(w)w.setTitle(w.getTitle()+' — DIAGNOSTIC COMPLETE; CLOSING');},identity.windowId).catch(()=>{});
      await new Promise(resolve=>setTimeout(resolve,1000));
      clearInterval(timer);while(flushing)await new Promise(resolve=>setTimeout(resolve,10));
      await flush();stopped=true;
      try {summary.renderer=await runtime.page.evaluate(()=>window.__chatArchWatchedTrace?.stop());rememberDocument(summary.renderer);}
      catch {summary.gaps.push({side:'renderer',phase:'restore',wallMs:Date.now()});}
      try {const batch=await runtime.app.evaluate(()=>{const s=globalThis.__chatArchMainTrace;s?.stop();return s?.snapshot();});recordBatch(batch);summary.main=batch?{...batch,events:undefined}:null;}
      catch {summary.gaps.push({side:'main',phase:'restore',wallMs:Date.now()});}
      driver.stop();
      mark('close-request',{pid:identity.pid,windowId:identity.windowId,mainObserverTail:'restored before close; driver records process exit/completion'});
      try {return await closeOwnedApp(runtime);}finally{mark('close-completion',{processExitObserved:summary.processExitObserved});}
    },
    finish(cleanup,lingering){
      ownedProcess.removeListener('exit',onExit);mark('fixture-cleanup-completion',{cleanup,lingeringOwnedPidCount:lingering.length});
      summary.status='closed';summary.written=written;summary.journalOverflow=journalOverflow;summary.journalWriteErrors=journalWriteErrors;
      summary.driver=driver.snapshot();summary.driver.events=undefined;
      summary.complete=Object.values(summary.documents).every(d=>d.overflow===0&&d.emitFailures===0&&d.trafficOverflow===0)&&journalWriteErrors===0&&summary.renderer?.restored===true&&summary.renderer?.trafficOverflow===0&&[summary.main,summary.driver].every(s=>s?.observationErrors===0&&s?.overflow===0&&s?.coverage?.every(c=>c.status==='wrapped'))&&summary.processExitObserved&&summary.gaps.length===0&&journalOverflow===0&&summary.main?.overflow===0&&summary.main?.observationErrors===0&&summary.renderer?.overflow===0&&summary.renderer?.emitFailures===0;
      fs.writeFileSync(path.join(evidenceRoot,'watched-setup-trace-summary.json'),JSON.stringify(summary,null,2));return summary;
    },
  };
}
