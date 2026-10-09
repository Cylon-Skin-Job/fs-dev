import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCENARIOS,ENFORCE_GROUPS,assertEnforcementCoverage } from './scenario-inventory.mjs';

test('composition control is explicit diagnostic only with fixed bounds and no native/performance credit',()=>{
  const id='R9-NATIVE-COMPOSITION-CONTROL';
  assert.equal(SCENARIOS.find(s=>s.id===id).state,'diagnostic-only');
  for(const group of Object.values(ENFORCE_GROUPS))assert.ok(!group.includes(id));
  assert.throws(()=>assertEnforcementCoverage('native',[id],{[id]:{scenarioIds:[id]}},['R9-NATIVE-OWNER-SYMPTOMS']),/missing executable enforcement/);
  const runner=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8');
  assert.match(runner,/'R9-NATIVE-COMPOSITION-CONTROL': \{[\s\S]*?explicitOnly: true, diagnosticDeadlineMs: 900000/);
  const native=fs.readFileSync(new URL('./native-input-electron.mjs',import.meta.url),'utf8');
  assert.match(native,/if\(compositionControl\)\{[\s\S]*?runCompositionControl[\s\S]*?\} else \{\n  await observeNativeInput/);
  assert.match(native,/!failure && !compositionControl[\s\S]*?process.exitCode=2/);
  const helper=fs.readFileSync(new URL('./native-composition-control.mjs',import.meta.url),'utf8');
  assert.match(helper,/assert.equal\(durationMs,600000\)/);
  assert.match(helper,/Math.min\(2000,result.deadlineAt-Date.now\(\)\)/);
  assert.match(helper,/lastProgress>=20000/);
  assert.match(helper,/NATIVE_COMPOSITION_PROGRESS/);
  assert.doesNotMatch(helper,/\.preventDefault\(|\.stopPropagation\(|\.dispatchEvent\(|osascript|System Events|\.focus\(/);
});
