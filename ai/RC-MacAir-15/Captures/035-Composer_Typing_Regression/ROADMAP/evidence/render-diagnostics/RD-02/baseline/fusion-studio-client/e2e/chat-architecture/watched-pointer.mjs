// Fixture-owned renderer only; no content, coordinates or other windows observed.
export async function installWatchedPointer(page) {
  await page.evaluate(()=>{
    const state=window.__chatArchWatchedPointer={event:null};
    const listener=event=>{
      if(event.isTrusted&&event.type==='pointerdown'&&!state.event)
        state.event={type:event.type,at:Date.now()};
    };
    window.addEventListener('pointerdown',listener,true);
    state.cleanup=()=>window.removeEventListener('pointerdown',listener,true);
  });
}
export async function readWatchedPointer(page) {
  return page.evaluate(()=>window.__chatArchWatchedPointer?.event??null);
}
export async function removeWatchedPointer(page) {
  await page.evaluate(()=>{
    window.__chatArchWatchedPointer?.cleanup();delete window.__chatArchWatchedPointer;
  }).catch(()=>{});
}
