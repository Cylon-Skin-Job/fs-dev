import {expect,test} from '@playwright/test';
import {installWatchedPointer,readWatchedPointer,removeWatchedPointer} from './chat-architecture/watched-pointer.mjs';
test('watched readiness rejects untrusted dispatch and records only trusted pointer type/time',async({page})=>{
 await page.setContent('<button>fixture click</button>');
 await installWatchedPointer(page);
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerdown')));
 expect(await readWatchedPointer(page)).toBeNull();
 // Test-only browser input exercises trusted event handling; not native owner evidence.
 await page.getByRole('button').click();
 const event=await readWatchedPointer(page);
 expect(Object.keys(event).sort()).toEqual(['at','type']);
 expect(event.type).toBe('pointerdown');expect(event.at).toBeGreaterThan(0);
 await removeWatchedPointer(page);
 await page.getByRole('button').click();
 expect(await readWatchedPointer(page)).toBeNull();
});
