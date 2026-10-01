import { expect,test } from '@playwright/test';
import { installCompositionControl,readCompositionControl } from './chat-architecture/native-composition-control.mjs';

// Browser-mechanics checks only: Playwright/synthetic events do not establish native OS input.
test('unhandled iframe keeps keys outside parent handlers; later-task snapshot observes completed dispatch',async({page})=>{
  await page.setContent('<div data-chat-thread-id="fixture-thread"><textarea class="rv-chat-input" aria-label="Real fixture composer"></textarea></div>');
  const installed=await installCompositionControl(page);
  expect(installed.documents.map(d=>d.surface)).toEqual(['real-composer','unhandled-control']);
  expect(new Set(installed.documents.map(d=>d.documentId)).size).toBe(2);
  await page.evaluate(()=>{
    window.__testParentKeyCalls=0;
    document.addEventListener('keydown',e=>{window.__testParentKeyCalls++;if(e.key==='Enter'){e.preventDefault();document.activeElement.blur();}});
  });
  const control=page.frameLocator('iframe[data-native-composition-control]').getByRole('textbox',{name:'Native composition control (unhandled)'});
  await control.press('Enter');await expect(control).toHaveValue('\n');
  expect(await page.evaluate(()=>window.__testParentKeyCalls)).toBe(0);
  await page.getByRole('textbox',{name:'Real fixture composer'}).press('Enter');
  await expect.poll(async()=> (await readCompositionControl(page)).events.filter(e=>e.snapshotPhase==='later-task-after-dispatch'&&e.type==='keydown'&&e.surface==='real-composer').length).toBe(1);
  const trace=await readCompositionControl(page),rows=trace.events.filter(e=>e.type==='keydown'&&e.surface==='real-composer');
  expect(rows.map(e=>[e.snapshotPhase,e.defaultPrevented])).toEqual([['capture',false],['later-task-after-dispatch',true]]);
  expect(rows[0].eventId).toBe(rows[1].eventId);expect(rows[1].focus.target).toBe('other');
  expect(rows.every(e=>typeof e.wallAt==='number'&&typeof e.performanceAt==='number'&&typeof e.timeOrigin==='number')).toBe(true);
  expect(trace.events.find(e=>e.surface==='unhandled-control'&&e.type==='keydown')?.defaultPrevented).toBe(false);
  expect(rows[0].threadId).toBe('fixture-thread');
  await page.evaluate(()=>window.__nativeCompositionControl.cleanup());
  expect(await page.locator('iframe').count()).toBe(0);
});

test('observer preserves composing/untrusted flags and never cancels or forwards control events',async({page})=>{
  await page.setContent('<textarea class="rv-chat-input"></textarea>');await installCompositionControl(page);
  const dispatch=await page.evaluate(()=>{
    const frame=document.querySelector('iframe'),doc=frame.contentDocument,input=doc.querySelector('textarea');
    const win=doc.defaultView;
    const key=new win.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter',keyCode:229,isComposing:true,altKey:true});
    const returned=input.dispatchEvent(key);
    input.dispatchEvent(new win.CompositionEvent('compositionend',{bubbles:true,data:'é'}));
    return {returned,prevented:key.defaultPrevented};
  });
  expect(dispatch).toEqual({returned:true,prevented:false});
  await expect.poll(async()=> (await readCompositionControl(page)).events.length).toBe(3);
  const {events}=await readCompositionControl(page);
  expect(events.every(e=>e.surface==='unhandled-control'&&e.isTrusted===false)).toBe(true);
  expect(events[0]).toMatchObject({key:'Enter',code:'Enter',keyCode:229,isComposing:true,altKey:true});
  expect(events[1]).toMatchObject({type:'compositionend',data:'é',isTrusted:false});
});

test('bounded overflow/truncation and cleanup cancel pending snapshots and remove all listeners',async({page})=>{
  await page.setContent('<textarea class="rv-chat-input"></textarea>');await installCompositionControl(page);
  await page.evaluate(()=>{
    const t=document.querySelector('textarea');t.value='x'.repeat(513);
    for(let i=0;i<2200;i++)t.dispatchEvent(new InputEvent('input',{bubbles:true,data:'x'.repeat(129)}));
  });
  let trace=await readCompositionControl(page);
  expect(trace.events.length).toBe(2048);expect(trace.overflow).toBe(152);expect(trace.truncated).toBe(4400);
  expect(trace.events[0]).toMatchObject({valueTruncated:true,dataTruncated:true});
  const retired=await page.evaluate(()=>{
    const s=window.__nativeCompositionControl,t=document.querySelector('textarea');
    t.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    window.__retiredControl=s;s.cleanup();return {count:s.events.length,sequence:s.sequence};
  });
  await page.waitForTimeout(20);
  expect(await page.evaluate(()=>({count:window.__retiredControl.events.length,sequence:window.__retiredControl.sequence}))).toEqual(retired);
  expect(await page.evaluate(()=>({timers:window.__retiredControl.timers.size,listeners:window.__retiredControl.listeners.length,installed:!!window.__nativeCompositionControl}))).toEqual({timers:0,listeners:0,installed:false});
  expect(await page.locator('iframe').count()).toBe(0);
});
