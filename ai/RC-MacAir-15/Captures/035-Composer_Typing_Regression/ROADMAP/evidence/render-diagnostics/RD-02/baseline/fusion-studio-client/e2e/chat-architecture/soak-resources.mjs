import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { instrumentMessageList } from './message-list-observation.mjs';

// Observation-only adapters, installed exclusively into a marked disposable stage.
// They return counts; no store, cache, runtime or admission state is changed.
export function installResourceObservation(fixture) {
  const excludedRuntimeLogs=Object.fromEntries(['server-live.log','server.log','wire-debug.log','wire-debug.log.old'].map(name=>[name,!fs.existsSync(path.join(fixture.stagedServer,name))]));
  assert.ok(Object.values(excludedRuntimeLogs).every(Boolean),'known runtime logs excluded before staged launch');
  const assets = path.join(fixture.stagedClient, 'dist/assets');
  const candidates = fs.readdirSync(assets).filter(name => name.endsWith('.js'))
    .filter(name => fs.readFileSync(path.join(assets, name), 'utf8').includes('useChatSubmissionStore=create'));
  assert.equal(candidates.length, 1, 'unique built store module');
  const rendererPath=path.join(assets,candidates[0]);
  const original=fs.readFileSync(rendererPath,'utf8');
  fs.writeFileSync(rendererPath,instrumentMessageList(original));
  fs.appendFileSync(rendererPath, `\nwindow.__chatArchResourceCounts = () => {
    const s = usePanelStore.getState();
    const d = useChatComposerDraftStore.getState();
    const a = useChatFileLinkStore.getState();
    const p = useChatSubmissionStore.getState();
    return Object.fromEntries(Object.entries({
      worksurfaceEntries:s.worksurfaceEntries, remoteRevisions:s.worksurfaceRemoteRevisions, members:s.threadMembersByGroup,
      chats:s.projectChats, usage:s.contextUsageByThread, tokens:s.tokenUsageByThread,
      wire:s.wireReadyByThread, selection:s.harnessSelectionByThread,
      drafts:d.draftsByOwner, revisions:d.revisionsByOwner,
      attachments:a.pendingAttachmentsByOwner, attachmentGenerations:a.attachmentGenerationsByOwner,
      attempts:p.attemptsByOwner, feedback:p.feedbackByOwner
    }).map(([key,value]) => [key,Object.keys(value).length]));
  };
  window.__chatArchWorksurfaceObservation = () => {
    const s=usePanelStore.getState();return {bindings:s.worksurfaceBindings,
      pending:Object.fromEntries(Object.entries(s.worksurfacePendingCaptures).map(([key,c])=>[key,{seq:c.seq,reason:c.reason,expected:c.expectedContentRevision,contentBytes:JSON.stringify(c.content).length}])),
      conflicts:s.worksurfaceConflicts,entries:Object.keys(s.worksurfaceEntries),remote:s.worksurfaceRemoteRevisions};
  };\n`);
  const target = path.join(fixture.evidenceRoot, 'soak-server-resources.ndjson');
  fs.appendFileSync(path.join(fixture.stagedServer, 'server.js'), `\n{
    const fs = require('node:fs');
    const { registry } = require('./lib/harness/registry');
    const { threadRuntimeManager } = require('./lib/thread/thread-runtime-manager');
    const { _getProjectThreadManagers } = require('./lib/thread/thread-manager-registry');
    const { bus } = require('./lib/event-bus');
    setInterval(() => {
      const managers = [..._getProjectThreadManagers().values()];
      fs.appendFileSync(${JSON.stringify(target)}, JSON.stringify({ at:Date.now(), pid:process.pid,
        adapterSessions:registry.get('opencode')?.sessions.size ?? 0,
        runtimes:threadRuntimeManager.runtimes.size,
        drains:[...threadRuntimeManager.runtimes.values()].filter(r=>r.activeDrain).length,
        sessions:managers.reduce((n,m)=>n+m.sessionManager.activeSessions.size,0),
        timeouts:managers.reduce((n,m)=>n+m.sessionManager.timeouts.size,0),
        listeners:bus.eventNames().reduce((n,k)=>n+bus.listenerCount(k),0),
        memory:process.memoryUsage()
      })+'\\n');
    },1000).unref();
  }\n`);
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  return { excludedRuntimeLogs, renderer: candidates[0], originalRendererSha256:digest(original), observedRendererSha256:digest(fs.readFileSync(rendererPath)), server: target, mode: 'read-only counts; fixture-only stage observation, bounded 16 thread IDs' };
}

async function listenerCensus(cdp) {
  const result={};
  const group='soak-listener-census';
  const summarize=async objectId => {
    const {listeners}=await cdp.send('DOMDebugger.getEventListeners',{objectId});
    return listeners.map(({type,useCapture,passive,once,scriptId,lineNumber,columnNumber})=>({type,useCapture,passive,once,scriptId,lineNumber,columnNumber}));
  };
  try {
    for(const name of ['window','document']) {
      const {result:object}=await cdp.send('Runtime.evaluate',{expression:name,objectGroup:group});
      result[name]=await summarize(object.objectId);
    }
    for(const name of ['WebSocket','AbortSignal']) {
      const {result:prototype}=await cdp.send('Runtime.evaluate',{expression:name+'.prototype',objectGroup:group});
      const {objects}=await cdp.send('Runtime.queryObjects',{prototypeObjectId:prototype.objectId,objectGroup:group});
      const {result:properties}=await cdp.send('Runtime.getProperties',{objectId:objects.objectId,ownProperties:true});
      result[name]=[];
      for(const p of properties.filter(p=>/^\d+$/.test(p.name) && p.value?.objectId)) {
        result[name].push(await summarize(p.value.objectId));
      }
    }
    return result;
  } finally {await cdp.send('Runtime.releaseObjectGroup',{objectGroup:group});}
}

export async function sampleResources(runtime, fixture) {
  const cdp = await runtime.page.context().newCDPSession(runtime.page);
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    const listeners = await listenerCensus(cdp);
    const caches = await runtime.page.evaluate(() => window.__chatArchResourceCounts());
    const fetches=await runtime.page.evaluate(()=>window.__chatArchSustained.fetchRecords);
    const processMemory = await runtime.app.evaluate(async ({ app }) => ({
      metrics: app.getAppMetrics().map(({ pid, type, memory }) => ({ pid, type, memory })),
      main: await process.getProcessMemoryInfo(),
    }));
    const lines = fs.readFileSync(path.join(fixture.evidenceRoot, 'soak-server-resources.ndjson'), 'utf8').trim().split('\n');
    const server = JSON.parse(lines.at(-1));
    assert.ok(Date.now() - server.at < 5000, 'fresh server resource observation');
    return { at: Date.now(), heap, dom, listeners, fetches, caches, processMemory, server };
  } finally { await cdp.detach(); }
}

export function assertEquivalentResources(sample,baseline) {
  assert.deepEqual(sample.caches,baseline.caches,'equivalent settled renderer cache counts');
  assert.equal(sample.dom.jsEventListeners,baseline.dom.jsEventListeners,'equivalent settled renderer listeners');
  for(const key of ['adapterSessions','runtimes','drains','sessions','timeouts','listeners'])
    assert.equal(sample.server[key],baseline.server[key],`equivalent settled server ${key}`);
}
