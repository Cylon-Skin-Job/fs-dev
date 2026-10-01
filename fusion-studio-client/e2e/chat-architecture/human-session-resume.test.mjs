import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readResumeOptions,stageResumeCode} from './human-session-resume.mjs';
import {markOwnedDirectory} from './fixture-lifecycle.mjs';

function fixture(){
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'human-resume-test-')),token='resume-test';
  markOwnedDirectory(tempRoot,token,'human-session-retained');
  const profileRoot=path.join(tempRoot,'profile'),workspaceRoot=path.join(tempRoot,'workspace');
  for(const root of [profileRoot,workspaceRoot])markOwnedDirectory(root,token,'retained');
  const project=path.join(workspaceRoot,'Human-Test');fs.mkdirSync(project);
  const backupRoot=path.join(tempRoot,'backup');
  for(const root of [profileRoot,backupRoot]){fs.mkdirSync(path.join(root,'server-data'),{recursive:true});fs.writeFileSync(path.join(root,'server-data/fusion.db'),'retained-db');}
  const receiptPath=path.join(tempRoot,'receipt.json'),prior={status:'closed',endedAt:1,retainedForDiagnosis:true,tempRoot,profileRoot,workspaceRoot,project,token};
  fs.writeFileSync(receiptPath,JSON.stringify(prior));
  return {tempRoot,profileRoot,backupRoot,receiptPath,prior,token,args:['--resume-receipt',receiptPath,'--profile-backup',backupRoot]};
}

test('resume fails closed on wrong ownership, missing backup, live old process and accepts only its own driver PID',()=>{
  const f=fixture();try{
    assert.equal(readResumeOptions(f.args,{ownedPids:()=>[process.pid]}).prior.project,f.prior.project);
    assert.equal(readResumeOptions(f.args,{ownedPids:()=>[12345],parentPid:12345,command:()=>`node /repo/human-session-launch.mjs ${f.args.join(' ')}`}).prior.project,f.prior.project);
    assert.throws(()=>readResumeOptions(f.args,{ownedPids:()=>[12345],parentPid:12345,command:()=>`node /repo/unrelated.mjs ${f.args.join(' ')}`}),/still running/);
    assert.throws(()=>readResumeOptions(f.args,{ownedPids:()=>[process.pid,99999]}),/still running/);
    assert.throws(()=>readResumeOptions(f.args.slice(0,2)),/resume requires/);
    assert.throws(()=>readResumeOptions([...f.args.slice(0,3),f.profileRoot],{ownedPids:()=>[]}),/independent/);
    fs.rmSync(path.join(f.backupRoot,'server-data/fusion.db'));
    assert.throws(()=>readResumeOptions(f.args,{ownedPids:()=>[]}));
    fs.writeFileSync(path.join(f.backupRoot,'server-data/fusion.db'),'retained-db');
    fs.writeFileSync(f.receiptPath,JSON.stringify({...f.prior,status:'ready'}));
    assert.throws(()=>readResumeOptions(f.args,{ownedPids:()=>[]}),/must be closed/);
    fs.writeFileSync(f.receiptPath,JSON.stringify({...f.prior,token:'wrong'}));
    assert.throws(()=>readResumeOptions(f.args,{ownedPids:()=>[]}),/ownership mismatch/);
  }finally{fs.rmSync(f.tempRoot,{recursive:true});}
});

test('code-only staging preserves all profile/project/oldstage bytes and copies current server/renderer without runtime DB',()=>{
  const f=fixture();try{
    const repoRoot=path.join(f.tempRoot,'repo');
    for(const rel of ['fusion-studio-client/electron/main.cjs','fusion-studio-client/dist/index.html','fusion-studio-client/src/index.ts','fusion-studio-client/package.json','fusion-studio-server/server.js','fusion-studio-server/package.json','fusion-studio-server/data/fusion.db','System_Manager/ai-template/file','System_Manager/global-configs/file']){
      const p=path.join(repoRoot,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,rel);
    }
    for(const rel of ['fusion-studio-client/node_modules','fusion-studio-client/electron/resources','fusion-studio-server/node_modules'])fs.mkdirSync(path.join(repoRoot,rel),{recursive:true});
    fs.writeFileSync(path.join(f.prior.project,'owner.txt'),'owner-data');
    const oldStage=path.join(f.tempRoot,'stage');fs.mkdirSync(oldStage);fs.writeFileSync(path.join(oldStage,'old.txt'),'old-stage');
    const stageRoot=path.join(f.tempRoot,'stage-resume');
    const result=stageResumeCode({repoRoot,stageRoot,profileRoot:f.profileRoot,token:f.token});
    assert.equal(fs.readFileSync(result.dbPath,'utf8'),'retained-db');
    assert.equal(fs.readFileSync(path.join(f.prior.project,'owner.txt'),'utf8'),'owner-data');
    assert.equal(fs.readFileSync(path.join(oldStage,'old.txt'),'utf8'),'old-stage');
    assert.equal(fs.existsSync(path.join(result.stagedServer,'data')),false);
    assert.equal(fs.readFileSync(path.join(result.stagedClient,'dist/index.html'),'utf8'),'fusion-studio-client/dist/index.html');
    assert.ok(result.files.some(row=>row.path==='fusion-studio-server/server.js'&&row.sha256.length===64));
    assert.throws(()=>stageResumeCode({repoRoot,stageRoot,profileRoot:f.profileRoot,token:f.token}),/must be new/);
  }finally{fs.rmSync(f.tempRoot,{recursive:true});}
});

test('resume driver uses passive verification branch and never prompts or mutates fixture/profile after READY',()=>{
  const driver=fs.readFileSync(new URL('./human-session.mjs',import.meta.url),'utf8');
  const branch=driver.slice(driver.indexOf('  if(resume){\n    status.surface='),driver.indexOf('  }else{\n  await createProject'));
  assert.match(branch,/verifyResumedSurface/);assert.match(branch,/assert.deepEqual\(status.after,status.before/);
  assert.doesNotMatch(branch,/createChat|createProject|\.fill\(|stageFixture|copyFileSync/);
  const afterReady=driver.slice(driver.indexOf("console.log('HUMAN_SESSION_READY"));
  assert.doesNotMatch(afterReady,/\.fill\(|\.click\(|\.press\(|\.focus\(/);
  assert.match(driver,/root:tempRoot/);
  const cleanup=fs.readFileSync(new URL('./human-session-ownership.mjs',import.meta.url),'utf8');
  assert.match(cleanup,/exactOwnedPids\(token,root\)\.filter\(pid=>pid!==process.pid\)/);
});
