import { expect, test } from '@playwright/test';
import { instrumentMessageList, attributionViolations } from './chat-architecture/message-list-observation.mjs';
import { takePreciseCoverage } from './chat-architecture/soak-measurement.mjs';
import { R1_COVERAGE_TARGETS } from './chat-architecture/coverage-observation.mjs';

test('nested attribution excludes stream calls before and after typing while CDP retains them', async ({page}) => {
  await page.goto('about:blank');
  await page.addScriptTag({content:instrumentMessageList('function MessageList({threadId}){return threadId;}')});
  await page.evaluate(()=>{
    (window as any).__chatArchMessageListObservation.enabled=false;
    (window as any).__stream=setInterval(()=>(window as any).MessageList({threadId:'live'}),5);
  });
  const coverage=await takePreciseCoverage(page,async()=>{
    await page.waitForTimeout(50);
    await page.evaluate(()=>{
      (window as any).__chatArchMessageListObservation={enabled:true,counts:{},overflow:0};
      (window as any).MessageList({threadId:'live'});
    });
    await page.waitForTimeout(50);
    await page.evaluate(()=>{(window as any).__chatArchMessageListObservation.enabled=false;});
    await page.waitForTimeout(50);
  },[...R1_COVERAGE_TARGETS,'chatArchRecordMessageList']);
  const observation=await page.evaluate(()=>{
    clearInterval((window as any).__stream);return (window as any).__chatArchMessageListObservation;
  });
  expect(observation.counts.live).toBeGreaterThan(0);
  expect(coverage.summary.counts.MessageList).toBeGreaterThan(observation.counts.live);
  expect(coverage.summary.counts.chatArchRecordMessageList).toBe(observation.counts.live);
  expect(attributionViolations(observation,coverage.summary.counts,{composerThreadId:'F2',liveThreadId:'live'})).toEqual([]);
  expect(attributionViolations({...observation,counts:{...observation.counts,F2:1}},coverage.summary.counts,{composerThreadId:'F2',liveThreadId:'live'})).toContain('F2 MessageList work');
  expect(attributionViolations({...observation,overflow:1},coverage.summary.counts,{composerThreadId:'F2',liveThreadId:'live'})).toContain('MessageList attribution incomplete');
});
