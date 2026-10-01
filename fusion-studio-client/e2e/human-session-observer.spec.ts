import {test,expect} from '@playwright/test';
import {installHumanObserver} from './chat-architecture/human-session-observer.mjs';

test('passive human observer preserves composition/normal blur and flushes without input actions',async({page})=>{
  const batches:any[]=[];await page.exposeBinding('__fusionHumanRecord',(_,row)=>batches.push(row));
  await page.setContent('<div data-chat-thread-id="owned"><textarea class="rv-chat-input"></textarea><input type="password" value="never-record"></div>');await page.evaluate(installHumanObserver);
  const input=page.locator('textarea');await input.focus();
  const prevented=await input.evaluate(node=>{const e=new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true});node.dispatchEvent(e);return e.defaultPrevented;});expect(prevented).toBe(false);
  await input.fill('human test');await input.blur();
  await page.evaluate(()=>window.__fusionHumanObserver.flush());
  const events=batches.flatMap(b=>b.records);expect(events.some(e=>e.kind==='input'&&e.isComposing===true&&typeof e.eventTimeStamp==='number'&&typeof e.dispatchDelayMs==='number')).toBe(true);expect(events.some(e=>e.type==='blur')).toBe(true);expect(JSON.stringify(batches)).not.toContain('never-record');await expect(input).toHaveValue('human test');
  await page.evaluate(()=>window.__fusionHumanObserver.stop());const count=batches.length;await input.fill('after cleanup');await page.waitForTimeout(1100);expect(batches.length).toBe(count);
});
test('human observer reports overflow, bounded content and hidden/blocked heartbeat limits',async({page})=>{
  const batches:any[]=[];await page.exposeBinding('__fusionHumanRecord',(_,row)=>batches.push(row));await page.setContent('<textarea class="rv-chat-input"></textarea>');await page.evaluate(installHumanObserver);
  await page.evaluate(()=>{const node=document.querySelector('textarea')!;for(let n=0;n<2200;n++)node.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));});await page.evaluate(()=>window.__fusionHumanObserver.flush());expect(batches[0].dropped).toBeGreaterThan(0);expect(batches[0].records.length).toBe(2048);await page.waitForTimeout(1100);expect(batches.some(b=>b.records.some(e=>e.kind==='heartbeat'&&typeof e.gapMs==='number'))).toBe(true);await page.evaluate(()=>window.__fusionHumanObserver.stop());
});

test('failed renderer delivery reports loss and later flush recovers without cancelling input',async({page})=>{
  const batches:any[]=[];let calls=0;await page.exposeBinding('__fusionHumanRecord',(_,row)=>{if(++calls===1)throw Error('fixture disk unavailable');batches.push(row);});await page.setContent('<textarea class="rv-chat-input"></textarea>');await page.evaluate(installHumanObserver);await page.locator('textarea').fill('kept');await page.evaluate(()=>window.__fusionHumanObserver.flush());await page.evaluate(()=>window.__fusionHumanObserver.flush());expect(batches.at(-1).dropped).toBeGreaterThan(0);await expect(page.locator('textarea')).toHaveValue('kept');await page.evaluate(()=>window.__fusionHumanObserver.stop());
});
