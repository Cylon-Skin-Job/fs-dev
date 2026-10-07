import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {resolveTarget} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-target.mjs';
import {systemProcesses,selectOwnedProcesses,validateRuntime,listenerPids,sameProcess} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-processes.mjs';
import {stopOwned} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart.mjs';
const root=process.argv[2],nonce=process.argv[3];if(fs.readFileSync(path.join(root,'.chat-ar-r3-owned'),'utf8')!==nonce+'\n')throw Error('unowned stage');
const target=resolveTarget(['--repo','/Users/rccurtrightjr./projects/fs-dev','--machine','RC-MacAir-15','--user-data',path.join(root,'public-profile-2')]);
const verified=JSON.parse(fs.readFileSync(path.join(target.runtime,'run-gWZBmc','verified.json'),'utf8'));
const records=systemProcesses(),identity=validateRuntime(records,target,57401,52199,listenerPids(52199),52197,listenerPids(52197));
if(identity.serverPid!==57425||!identity.rendererPids.includes(57444))throw Error('exact attributed runtime changed');
const owned=selectOwnedProcesses(records,target),ownedIds=new Set(owned.map(r=>r.pid));
if(![57401,57425,57444].every(pid=>ownedIds.has(pid)))throw Error('incomplete exact selected ownership');
const knownOlder=[77002,77007,77021,12886,12892,12904,48636,48653,48666];if(knownOlder.some(pid=>ownedIds.has(pid)))throw Error('older instance entered owned stop scope');
const older=records.filter(r=>knownOlder.includes(r.pid)),project=r=>({pid:r.pid,ppid:r.ppid,start:r.start,commandSha256:createHash('sha256').update(r.command).digest('hex')});
const sha=value=>createHash('sha256').update(String(value)).digest('hex');
const sqlite=createRequire(path.join(target.repo,'fusion-studio-server/package.json'))('better-sqlite3');
const scratchSnapshot=()=>{const db=new sqlite(target.database,{readonly:true,fileMustExist:true});try{
 const registry=db.prepare('SELECT id,repo_path FROM workspaces ORDER BY id').all(),selected=db.prepare("SELECT value FROM system_config WHERE key='last_active_workspace_id'").get();
 if(registry.length!==1||registry[0].id!=='public-scratch-2'||registry[0].repo_path!==path.join(root,'public-scratch-2')||selected.value!==registry[0].id)throw Error('scratch registry selection changed');
 const threads=db.prepare('SELECT thread_id,harness_id,harness_config,message_count FROM threads WHERE workspace_id=? ORDER BY thread_id').all('public-scratch-2').map(t=>({threadId:t.thread_id,harnessId:t.harness_id,sessionId:JSON.parse(t.harness_config||'{}').opencodeSessionId,messageCount:t.message_count}));
 const groups=db.prepare('SELECT group_id,view_id,current_primary_thread_id FROM thread_groups WHERE workspace_id=? ORDER BY group_id').all('public-scratch-2');
 const receipts=db.prepare('SELECT thread_id,request_id,turn_id,outcome,execution,reason FROM prompt_submission_receipts WHERE workspace_id=? ORDER BY request_id').all('public-scratch-2');
 const exchanges=db.prepare('SELECT e.id,e.thread_id,e.seq,e.ts,e.user_input,e.assistant,e.metadata,j.turn_id,j.state FROM exchanges e JOIN threads t ON t.thread_id=e.thread_id LEFT JOIN agent_exchange_bind_jobs j ON j.exchange_id=e.id WHERE t.workspace_id=? ORDER BY e.id').all('public-scratch-2').map(e=>({id:e.id,threadId:e.thread_id,seq:e.seq,ts:e.ts,userHash:sha(e.user_input),assistantHash:sha(e.assistant),metadataHash:sha(e.metadata),turnId:e.turn_id,bindState:e.state}));
 const value={registry,selected,threads,groups,receipts,exchanges};return {sha256:sha(JSON.stringify(value)),...value};
 }finally{db.close();}};
function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return 'missing';
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function hashTree(root) {
  if (!fs.existsSync(root)) return 'missing';
  const digest = createHash('sha256');
  function visit(directory, relative = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full, rel);
      else if (entry.isFile()) {
        digest.update(rel).update('\0').update(fs.readFileSync(full)).update('\0');
      } else {
        digest.update(rel).update('\0non-regular\0');
      }
    }
  }
  visit(root);
  return digest.digest('hex');
}


const protectedSnapshot=()=>({developmentDb:hashFile(path.join(target.repo,'fusion-studio-server/data/fusion.db')),normalProfileDb:hashFile(path.join(os.homedir(),'Library/Application Support/Fusion Studio/server-data/fusion.db')),developerWorkspace:hashTree(path.join(target.repo,'ai/RC-MacAir-15')),repositoryPlaywrightOutput:hashTree(path.join(target.client,'test-results'))});
const before=protectedSnapshot(),scratchBefore=scratchSnapshot();if(scratchBefore.threads.length!==2||scratchBefore.exchanges.length!==3||scratchBefore.receipts.length!==3)throw Error('expected completed three-exchange scratch history changed');
const beforeReceipt={at:new Date().toISOString(),identity,owned:owned.map(project),older:older.map(project),protected:before,scratch:scratchBefore,stopOwner:'scripts/fusion-restart.mjs stopOwned; no rebuild/cache reset/relaunch',noRawArgv:true};
fs.writeFileSync(path.join(root,'public-scratch-stop-before.json'),JSON.stringify(beforeReceipt,null,2)+'\n',{flag:'wx',mode:0o600});
let failure=null;try{await stopOwned(owned);}catch(error){failure={name:error.name,marker:'OWNED_SCRATCH_STOP_FAILED'};}
const current=systemProcesses();let protectedAfter=null,scratchAfter=null;const snapshotErrors=[];try{protectedAfter=protectedSnapshot();}catch(error){snapshotErrors.push({scope:'protected',name:error.name,marker:'PROTECTED_SNAPSHOT_FAILED'});}try{scratchAfter=scratchSnapshot();}catch(error){snapshotErrors.push({scope:'scratch',name:error.name,marker:'SCRATCH_SNAPSHOT_FAILED'});}
const oldUnchanged=older.every(r=>sameProcess(r,current.find(x=>x.pid===r.pid)));
const result={at:new Date().toISOString(),outcome:failure||snapshotErrors.length?'stop-or-snapshot-failed':'stopped',failure,snapshotErrors,ownedPids:owned.map(r=>r.pid),ownedRemaining:owned.filter(r=>current.some(c=>c.pid===r.pid)).map(r=>r.pid),serverListenerAfter:listenerPids(52199),debugListenerAfter:listenerPids(52197),protectedBefore:before,protectedAfter,protectedUnchanged:JSON.stringify(before)===JSON.stringify(protectedAfter),olderBefore:older.map(project),olderAfter:current.filter(r=>knownOlder.includes(r.pid)).map(project),olderUnchanged:oldUnchanged,scratchBefore,scratchAfter,scratchDurableUnchanged:scratchAfter!==null&&scratchBefore.sha256===scratchAfter.sha256,preservedMarkerAndProfile:true,noCleanup:true};
fs.writeFileSync(path.join(root,'public-scratch-stop-after.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(result));
if(failure||snapshotErrors.length||result.ownedRemaining.length||result.serverListenerAfter.length||result.debugListenerAfter.length||!result.protectedUnchanged||!result.olderUnchanged||!result.scratchDurableUnchanged)process.exitCode=1;
