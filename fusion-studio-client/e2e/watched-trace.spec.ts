import {expect,test} from '@playwright/test';
import {watchedRendererTrace} from './chat-architecture/watched-renderer-trace.mjs';
test('diagnostic renderer clocks identify reloads, project only screenshot types, and restore event observers',async({page})=>{
 const events:any[]=[];
 await page.exposeBinding('__chatArchEmitWatchedTrace',(_source,event)=>events.push(event));
 await page.addInitScript(watchedRendererTrace);
 await page.route('http://localhost/watched-trace',route=>route.fulfill({body:'<html><body>isolated observer fixture</body></html>',contentType:'text/html'}));
 await page.goto('http://localhost/watched-trace');
 const first=await page.evaluate(()=>({id:window.__chatArchWatchedTrace.documentId,origin:performance.timeOrigin}));
 await page.reload();
 const second=await page.evaluate(()=>{
  const s=window.__chatArchWatchedTrace;
  window.__chatArchSustained={trafficEvidenceOverflow:0,trafficEvidence:[{sequence:1,atMs:12.3,direction:'outbound',type:'screenshot:capture',privateContent:'must not record'},{sequence:2,atMs:14,direction:'inbound',type:'private-message'}]};
  s.collect();window.dispatchEvent(new Event('blur'));
  return {id:s.documentId,origin:performance.timeOrigin,socket:typeof WebSocket};
 });
 expect(second.id).not.toBe(first.id);expect(second.origin).toBeGreaterThanOrEqual(first.origin);
 const summary=await page.evaluate(()=>window.__chatArchWatchedTrace.stop());
 expect(summary.restored).toBe(true);expect(summary.emitFailures).toBe(0);
 const before=events.length;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(250);
 expect(events.length).toBe(before);
 const frame=events.find(e=>e.kind==='screenshot-frame');expect(frame.documentId).toBe(second.id);
 expect(frame.sourceEpochMs).toBe(second.origin+12.3);expect(frame.sourceMonoMs).toBe(12.3);
 expect(frame.wallMs).toBeGreaterThan(0);expect(frame.monoMs).toBeGreaterThanOrEqual(0);
 expect(JSON.stringify(events)).not.toContain('must not record');expect(JSON.stringify(events)).not.toContain('private-message');
 expect(events.some(e=>e.kind==='event'&&e.event==='blur'&&typeof e.state.hasFocus==='boolean')).toBe(true);
});
