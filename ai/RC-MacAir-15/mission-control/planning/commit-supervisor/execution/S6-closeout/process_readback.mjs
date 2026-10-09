import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {systemProcesses,selectOwnedProcesses,listenerPids,parseEnvironment} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-processes.mjs';
import {resolveTarget} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-target.mjs';
const C='/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control';
const J=C+'/jobs/commit-supervisor/rehearsal-20261004-s6';
const previous=JSON.parse(fs.readFileSync(J+'/recovery-1/final-preservation-proof.json'));
const ids=previous.process_readbacks.at(-1).identities.map(r=>r.pid);
const inventory=systemProcesses();
const target=resolveTarget(['--repo','/private/tmp/mc-s6-commit-supervisor-20261004/candidate','--machine','MC-S6','--user-data','/private/tmp/mc-s6-commit-supervisor-20261004/profile']);
const protectedRecords=ids.map(pid=>{
 const record=inventory.find(r=>r.pid===pid);if(!record)throw new Error('protected process absent: '+pid);
 const files=execFileSync('lsof',['-a','-p',String(pid),'-d','cwd,txt','-Fn'],{encoding:'utf8'}).split('\n').filter(n=>n.startsWith('n')).map(n=>n.slice(1));
 const raw=execFileSync('ps',['eww','-p',String(pid),'-o','command='],{encoding:'utf8'}).trim();
 return {pid,ppid:record.ppid,uid:record.uid,start:record.start,command:record.command,cwd:files[0],executable:files[1],env:parseEnvironment(raw)};
});
console.log(JSON.stringify({at:new Date().toISOString(),prior_observation_source:J+'/recovery-1/final-preservation-proof.json',prior_times:previous.process_readbacks.map(r=>r.tag),owned_tree:selectOwnedProcesses(inventory,target),protected:protectedRecords,private_listeners:{server63400:listenerPids(63400),CDP63399:listenerPids(63399)},limit:'Earlier process sample is historical raw recovery evidence; this current readback is after doc-only effects, no invented preeffect own process sample.'},null,2));
