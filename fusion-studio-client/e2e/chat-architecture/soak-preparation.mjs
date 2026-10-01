import assert from 'node:assert/strict';
import { waitForScreenshotBootstrapQuiescence } from './soak-measurement.mjs';

// Called only after all warm-up actions. Revalidate the genuine lifecycle in the
// retained document and observe fresh quiet; this does not request a new capture.
export async function prepareFinalSoakWindow({page,setupBootstrap,establishFocus,
  bootstrap=waitForScreenshotBootstrapQuiescence,wait=ms=>page.waitForTimeout(ms)}) {
  assert.ok(typeof setupBootstrap?.documentId==='string' && setupBootstrap.documentId.length>0,
    'setup bootstrap document identity required');
  const documentId=await page.evaluate(()=>window.__chatArchSustained.documentId);
  assert.equal(documentId,setupBootstrap.documentId,'same document after soak warmup');
  const focusPreparation=await establishFocus();
  const finalBootstrap=await bootstrap(page);
  assert.equal(finalBootstrap.documentId,documentId,'same document through final soak preparation');
  assert.ok(finalBootstrap.finalTrafficSequence>=setupBootstrap.finalTrafficSequence,
    'final bootstrap observes current traffic sequence');
  await wait(45_000);
  return {focusPreparation,bootstrap:finalBootstrap,settleMs:45_000,
    lifecycleScope:'existing ordered current-document lifecycle; fresh final 500ms quiet after warmup'};
}
