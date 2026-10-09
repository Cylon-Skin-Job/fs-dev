// Read actual current private ownership and protected process identity without effects.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const N='/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/jobs/commit-supervisor/rehearsal-20261004-s6/interruption-1';
const candidate='/private/tmp/mc-s6-commit-supervisor-20261004/candidate';
const profile='/private/tmp/mc-s6-commit-supervisor-20261004/profile';
const {resolveTarget}=await import(pathToFileURL(`${candidate}/scripts/fusion-restart-target.mjs`).href);
const {systemProcesses,selectOwnedProcesses,descendants}=await import(pathToFileURL(`${candidate}/scripts/fusion-restart-processes.mjs`).href);
const tag=process.argv[2];
const save=(name,data)=>fs.writeFileSync(`${N}/${tag}-${name}`,data,{flag:'wx'});
const command=(name,cmd,args)=>{try{const out=execFileSync(cmd,args,{maxBuffer:32*1024*1024});save(`${name}.stdout`,out);return {exit:0,stdout:out.toString(),command:[cmd,...args]};}catch(e){save(`${name}.stdout`,e.stdout||'');save(`${name}.stderr`,e.stderr||'');return {exit:e.status,stdout:String(e.stdout||''),stderr:String(e.stderr||''),command:[cmd,...args]};}};
const target=resolveTarget(['--repo',candidate,'--machine','MC-S6','--user-data',profile]);
const records=systemProcesses();
const selected=selectOwnedProcesses(records,target);
const protectedRoots=[77002,77007,48636,48653];
const protectedRecords=records.filter(r=>protectedRoots.includes(r.pid));
assert.equal(protectedRecords.length,4);
assert(protectedRecords.every(r=>r.uid===process.getuid()&&r.start&&r.cwd&&r.executables?.[0]&&r.env));
assert(protectedRecords.every(r=>!selected.some(s=>s.pid===r.pid)));
const protectedTrees=[...new Map(protectedRoots.flatMap(pid=>descendants(records,pid)).map(r=>[r.pid,r])).values()];
const raw={all:command('ps-all','ps',['-axo','pid=,ppid=,uid=,stat=,lstart=,command=']),listeners:command('listeners-all','lsof',['-n','-P','-iTCP','-sTCP:LISTEN'])};
for(const r of [...selected,...protectedTrees]){
 raw[r.pid]={identity:command(`pid${r.pid}-identity`,'ps',['-p',String(r.pid),'-o','pid=,ppid=,uid=,stat=,lstart=,command=']),cwd_executable:command(`pid${r.pid}-files`,'lsof',['-a','-p',String(r.pid),'-d','cwd,txt','-Fn']),environment:command(`pid${r.pid}-environment`,'ps',['eww','-p',String(r.pid),'-o','command=']),listeners:command(`pid${r.pid}-listeners`,'lsof',['-n','-P','-a','-p',String(r.pid),'-iTCP','-sTCP:LISTEN'])};
}
const d={at:new Date().toISOString(),actor:'/root/s6_supervisor_interruption_1',target,selected,protectedRecords,protectedTrees,raw,limits:'PID is only a lookup. Selection validated UID/start/executable/CWD/entry/FUSION profile/machine/ancestry; raw actual environments retained locally, not echoed.'};
save('processes.json',JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({record:`${N}/${tag}-processes.json`,owned:selected.map(r=>({pid:r.pid,uid:r.uid,start:r.start,cwd:r.cwd,env:r.env})),protected:protectedRecords.map(r=>({pid:r.pid,uid:r.uid,start:r.start,cwd:r.cwd,env:r.env})),protectedTreeCount:protectedTrees.length}));
