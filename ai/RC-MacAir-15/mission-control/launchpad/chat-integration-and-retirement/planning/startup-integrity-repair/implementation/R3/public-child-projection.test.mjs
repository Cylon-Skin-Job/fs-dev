import assert from 'node:assert/strict';import {projectOpenCodeChild} from './public-child-projection.mjs';
const scratch='/tmp/owned-scratch';const record={pid:1,ppid:2,start:'controlled',command:'/opt/homebrew/bin/opencode run --auto --format json --dir '+scratch+' Reply with exactly CHAT-AR-REPAIR-READY.'};
assert.equal(projectOpenCodeChild(record,scratch).runtimeCandidate,true);
assert.equal(projectOpenCodeChild({...record,command:'/opt/homebrew/bin/opencode --version'},scratch).runtimeCandidate,false);
assert.equal(projectOpenCodeChild({...record,command:record.command.replace(scratch,'/tmp/foreign')},scratch).runtimeCandidate,false);
assert.equal(projectOpenCodeChild({...record,command:record.command.replace('Reply with exactly CHAT-AR-REPAIR-READY.','unrelated prompt')},scratch).runtimeCandidate,false);
assert.equal(projectOpenCodeChild({...record,command:'/bin/other run'},scratch),null);
console.log(JSON.stringify({fixtureOnly:true,cases:5,passed:true,scope:'role/argument booleans; live child/session proof remains separate'}));
