import assert from 'node:assert/strict';

export async function observeNativeInput(page, workspaceName = false) {
  await page.evaluate(workspaceName => {
    window.__nativeInputEvents = [];
    window.__nativeInputOverflow = 0;
    for (const type of ['beforeinput','input','compositionstart','compositionupdate','compositionend']) {
      document.addEventListener(type, event => {
        if (!event.target.matches(workspaceName
          ? 'textarea.rv-chat-input,input[placeholder="Derived from folder name if blank"]'
          : 'textarea.rv-chat-input')) return;
        const events = window.__nativeInputEvents;
        if (events.length === 4096) { events.shift(); window.__nativeInputOverflow++; }
        events.push({ type, field:event.target.tagName==='INPUT'?'workspace-name':'composer', inputType:event.inputType ?? null, data:event.data ?? null,
          isComposing:event.isComposing ?? false, isTrusted:event.isTrusted,
          value:event.target.value, at:performance.now() });
      }, true);
    }
  }, workspaceName);
}

export async function manualInputWindow(runtime, durationMs, identity, saveProgress) {
  assert.ok([180000,600000].includes(durationMs), 'bounded manual observation window');
  const result = { startedAt:new Date().toISOString(), durationMs, identity,
    ownerAcceptance:'pending: manual observation is not an owner receipt' };
  console.log('ISOLATED_NATIVE_MANUAL_READY '+JSON.stringify(identity));
  await saveProgress(result);
  const end=Date.now()+durationMs;
  while (Date.now()<end) {
    await runtime.page.waitForTimeout(Math.min(20000,end-Date.now()));
    Object.assign(result, await runtime.page.evaluate(() => ({
      events:window.__nativeInputEvents, overflow:window.__nativeInputOverflow,
      composers:[...document.querySelectorAll('textarea.rv-chat-input')].map(node=>({
        threadId:node.closest('[data-chat-thread-id]')?.getAttribute('data-chat-thread-id'), value:node.value,
      })),
    })));
    await saveProgress(result);
    console.log('ISOLATED_NATIVE_MANUAL_PROGRESS '+Date.now());
  }
  result.endedAt=new Date().toISOString();
  await saveProgress(result);
  return result;
}
