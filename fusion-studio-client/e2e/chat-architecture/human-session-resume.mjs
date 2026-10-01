// Resume preparation is intentionally separate from stageFixture, whose registry
// reset is correct for new fixtures but destructive to a retained human session.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {assertDisposablePath,markOwnedDirectory} from './fixture-lifecycle.mjs';
import {exactOwnedPids,commandFor} from './human-session-ownership.mjs';

export function readResumeOptions(args, {ownedPids=exactOwnedPids,command=commandFor,parentPid=process.ppid}={}) {
  if (!args.length) return null;
  assert.equal(args.length,4,'resume requires --resume-receipt FILE --profile-backup DIRECTORY');
  assert.equal(args[0],'--resume-receipt');assert.equal(args[2],'--profile-backup');
  const receiptPath=path.resolve(args[1]),backupRoot=path.resolve(args[3]);
  const prior=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  assert.equal(prior.status,'closed','previous session must be closed');
  assert.ok(prior.endedAt&&prior.retainedForDiagnosis,'closed retained receipt required');
  for (const root of [prior.tempRoot,prior.profileRoot,prior.workspaceRoot]) assertDisposablePath(root,prior.retainedToken??prior.token);
  assert.equal(prior.profileRoot,path.join(prior.tempRoot,'profile'));
  assert.equal(prior.workspaceRoot,path.join(prior.tempRoot,'workspace'));
  assert.equal(prior.project,path.join(prior.workspaceRoot,'Human-Test'));
  assert.ok(fs.statSync(prior.project).isDirectory());
  assert.notEqual(fs.realpathSync(backupRoot),fs.realpathSync(prior.profileRoot),'backup must be independent');
  assert.ok(fs.statSync(path.join(backupRoot,'server-data/fusion.db')).isFile(),'snapshot database required');
  assert.ok(fs.statSync(path.join(prior.profileRoot,'server-data/fusion.db')).isFile());
  // The detached wrapper may still be exiting while this child imports. Only
  // our actual parent running this exact resume command is exempt, never a
  // arbitrary process whose arguments merely mention the retained root.
  const parentCommand=command(parentPid);
  const isLauncherParent=/(?:^|\/)human-session-launch\.mjs(?:\s|$)/.test(parentCommand)
    && args.every(arg=>parentCommand.includes(arg));
  assert.deepEqual(ownedPids(prior.token,prior.tempRoot).filter(pid=>pid!==process.pid&&!(pid===parentPid&&isLauncherParent)),[],'prior session processes still running');
  return {prior,receiptPath,backupRoot};
}

export function stageResumeCode({repoRoot,stageRoot,profileRoot,token}) {
  assert.ok(!fs.existsSync(stageRoot),'resume stage must be new');
  markOwnedDirectory(stageRoot,token,'human-resume-stage');
  const stagedClient=path.join(stageRoot,'fusion-studio-client'),stagedServer=path.join(stageRoot,'fusion-studio-server');
  const copy=(source,target,excluded=[])=>fs.cpSync(source,target,{recursive:true,dereference:false,
    filter: candidate=>!excluded.includes(path.basename(candidate))&&!fs.lstatSync(candidate).isSymbolicLink()});
  fs.mkdirSync(stagedClient);
  for(const name of ['electron','dist','src','package.json'])copy(path.join(repoRoot,'fusion-studio-client',name),path.join(stagedClient,name),['resources']);
  copy(path.join(repoRoot,'fusion-studio-server'),stagedServer,['node_modules','data','.git','coverage','release','server-live.log','server.log','wire-debug.log','wire-debug.log.old']);
  for(const name of ['ai-template','global-configs'])copy(path.join(repoRoot,'System_Manager',name),path.join(stageRoot,'System_Manager',name));
  for(const [source,target] of [
    ['fusion-studio-client/node_modules',path.join(stagedClient,'node_modules')],
    ['fusion-studio-client/electron/resources',path.join(stagedClient,'electron/resources')],
    ['fusion-studio-server/node_modules',path.join(stagedServer,'node_modules')],
  ])fs.symlinkSync(path.join(repoRoot,source),target,'dir');
  // No initDb, registry mutation, config copy, or profile write occurs here.
  const files=[];
  const visit=directory=>{for(const name of fs.readdirSync(directory).sort()){
    const file=path.join(directory,name),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink())continue;
    if(stat.isDirectory())visit(file);
    else files.push({path:path.relative(stageRoot,file),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
  }};visit(stageRoot);
  return {stagedClient,stagedServer,dbPath:path.join(profileRoot,'server-data/fusion.db'),files};
}

export function retainedIdentities(db) {
  return {
    workspaces:db.prepare('SELECT * FROM workspaces ORDER BY rowid').all(),
    threads:db.prepare('SELECT thread_id,harness_id,harness_config FROM threads ORDER BY rowid').all().map(({harness_config,...row})=>({...row,harnessConfigSha256:crypto.createHash('sha256').update(harness_config||'').digest('hex')})),
    exchanges:db.prepare('SELECT id,thread_id,seq FROM exchanges ORDER BY id').all(),
  };
}

export async function verifyResumedSurface(page,identities) {
  const composer=page.locator('textarea.rv-chat-input:visible').first();
  await composer.waitFor({timeout:30000});
  await page.waitForFunction(()=>[...document.querySelectorAll('textarea.rv-chat-input')].some(n=>n.getClientRects().length&&!n.disabled),null,{timeout:30000});
  assert.ok(await composer.isEnabled(),'retained composer must be editable');
  const surface=composer.locator('xpath=ancestor::*[@data-chat-thread-id][1]');
  const threadId=await surface.getAttribute('data-chat-thread-id');
  assert.ok(identities.threads.some(row=>row.thread_id===threadId),'selected chat must be retained');
  await surface.locator('.rv-message-assistant').first().waitFor({timeout:30000});
  await surface.getByRole('button',{name:'More options',exact:true}).click();
  await page.getByRole('menuitem',{name:'Diagnostics',exact:true}).click();
  await page.getByLabel('Stream diagnostics',{exact:true}).waitFor();
  const close=page.getByRole('button',{name:'Close Diagnostics',exact:true});
  const rail=close.locator('xpath=ancestor::*[@role="tablist"][1]');
  assert.match(await rail.getByRole('tab').last().innerText(),/Diagnostics/);
  assert.equal(await rail.getByRole('tab').last().getAttribute('aria-selected'),'true');
  await close.click();
  await composer.waitFor();assert.equal(await surface.getAttribute('data-chat-thread-id'),threadId);
  assert.ok(await composer.isEnabled());
  return {threadId,diagnosticsRightmost:true,diagnosticsClosed:true,historyVisible:true,composerEnabled:true};
}
