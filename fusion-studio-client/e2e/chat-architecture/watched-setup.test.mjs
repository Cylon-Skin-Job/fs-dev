import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCENARIOS,ENFORCE_GROUPS,assertEnforcementCoverage } from './scenario-inventory.mjs';
test('watched setup is explicit diagnostic scope and cannot supply R1 enforcement credit',()=>{
 const id='R9-WATCHED-FOREGROUND-SETUP';
 assert.equal(SCENARIOS.find(s=>s.id===id).state,'diagnostic-only');
 for(const group of Object.values(ENFORCE_GROUPS))assert.ok(!group.includes(id));
 assert.throws(()=>assertEnforcementCoverage('render',[id],{[id]:{scenarioIds:[id]}},['R1-FIVE-MINUTE-TYPING']),/missing executable enforcement/);
 const runner=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8');
 assert.match(runner,/'R9-WATCHED-FOREGROUND-SETUP': \{[\s\S]*?explicitOnly: true, diagnosticDeadlineMs: 240000/);
 const script=fs.readFileSync(new URL('./r1-sustained-electron.mjs',import.meta.url),'utf8');
 assert.match(script,/if\(setupOnly\)\{result.status='setup-only-passed';[^\n]+\}\n  else \{\n  result.measurementStarted = true/);
 assert.match(script,/CHAT_ARCH_WATCHED_SETUP_ONLY_OK/);
});
