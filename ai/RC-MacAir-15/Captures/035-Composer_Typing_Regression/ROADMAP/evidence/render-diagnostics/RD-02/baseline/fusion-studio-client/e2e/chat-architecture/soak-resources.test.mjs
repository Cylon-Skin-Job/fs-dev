import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEquivalentResources } from './soak-resources.mjs';

test('final settled sample rejects end-only cache, listener and server retention', () => {
  const baseline={caches:{drafts:1,members:2},dom:{jsEventListeners:900},
    server:{adapterSessions:0,runtimes:2,drains:0,sessions:0,timeouts:0,listeners:30}};
  assert.doesNotThrow(()=>assertEquivalentResources(structuredClone(baseline),baseline));
  for(const [section,key] of [['caches','drafts'],['dom','jsEventListeners'],
    ...Object.keys(baseline.server).map(key=>['server',key])]) {
    const final=structuredClone(baseline);final[section][key]++;
    assert.throws(()=>assertEquivalentResources(final,baseline),/equivalent settled/);
  }
});
