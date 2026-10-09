'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const repo=fs.realpathSync(process.argv[4]);
assert.equal(repo,'/private/tmp/chat-ar-integration-r6pe5gmi/candidate');
const root=process.argv[2],nonce=process.argv[3];
assert.equal(fs.readFileSync(path.join(root,'.chat-ar-integration-owned'),'utf8'),nonce+'\n');
assert.ok(fs.realpathSync(root).startsWith(fs.realpathSync(require('os').tmpdir())+path.sep));
const profile=path.join(root,'candidate-profile'),workspace=path.join(root,'candidate-scratch');
for(const directory of [profile,workspace]){assert.equal(fs.existsSync(directory),false);fs.mkdirSync(directory,{mode:0o700});fs.writeFileSync(path.join(directory,'.chat-ar-integration-owned'),nonce+'\n',{flag:'wx',mode:0o600});}
const machine='RC-MacAir-15';process.env.FUSION_APP_USER_DATA=profile;process.env.FUSION_LOCAL_MACHINE=machine;
for(const key of Object.keys(process.env))if(/FUSION_PROVENANCE_TEST|CHAT_TRANSPORT_TEST|FUSION_.*(?:TEST|FIXTURE)|^ELECTRON_RUN_AS_NODE$/.test(key))delete process.env[key];
if(process.env.NODE_ENV==='test')delete process.env.NODE_ENV;
const write=(relative,value)=>{const destination=path.join(workspace,relative);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.writeFileSync(destination,value,{flag:'wx',mode:0o600});};
const view='ai/'+machine+'/System/Views/001-file-viewer/';
write(view+'manifest.md','---\nname: Repair Scratch Files\ndescription: Disposable candidate integration smoke workspace.\nmetadata:\n  view-id: file-viewer\n  view-type: file-explorer\n  data-source: project-root\n  enabled: true\n---\n');
write(view+'content.json',JSON.stringify({version:1,dataSource:'project-root',root:{type:'project-root'},chat:{type:'threaded',position:'right'}},null,2)+'\n');
write(view+'styles/icon.md','---\nname: Repair Scratch Files Icon\nmetadata:\n  icon-name: folder_code\n---\n');
write(view+'styles/layout.css','.rv-file-explorer-layout{display:flex;height:100%;}.rv-file-explorer-main{flex:1;}.rv-file-tree-sidebar{width:260px;overflow:auto;}\n');
write(view+'state/state.json','{"activity":{"recents":[],"navigation":{"stack":[],"index":-1},"tabs":[],"activeTabId":null}}\n');
write('ai/'+machine+'/System/config/cli.json','{"defaultHarness":"opencode","harnesses":{"opencode":{"enabled":true}}}\n');
write('ai/'+machine+'/System/state/state.json','{}\n');
write('scratch-readme.md','Disposable Chat integration verification workspace. No production files are attached.\n');

// Candidate Wiki is copied as disposable fixture content; no production workspace/profile is attached.
const wikiTarget=path.join(workspace,'ai',machine,'Wiki');
fs.cpSync(path.join(repo,'ai',machine,'Wiki'),wikiTarget,{recursive:true,filter:p=>!p.endsWith('/.audit-state.json')});
const wikiView='ai/'+machine+'/System/Views/002-wiki-viewer/';
write(wikiView+'manifest.md','---\nname: Candidate Wiki\ndescription: Disposable candidate documentation verification.\nmetadata:\n  view-id: wiki-viewer\n  view-type: wiki\n  data-source: Wiki\n  enabled: true\n---\n');
write(wikiView+'content.json',JSON.stringify({version:1,dataSource:'Wiki',root:{type:'workspace-relative',path:'ai/'+machine+'/Wiki'},chat:{type:'rolling-daily',position:'popup'}},null,2)+'\n');
write(wikiView+'styles/icon.md','---\nname: Wiki Icon\nmetadata:\n  icon-name: menu_book\n---\n');

const owner=(name)=>require(path.join(repo,'fusion-studio-server/lib',name));
(async()=>{
 const dbOwner=owner('db'),registry=owner('workspace/registry-service'),controller=owner('workspace/workspace-controller'),bus=owner('event-bus'),readiness=owner('views/readiness-runtime');
 assert.equal(dbOwner.DB_PATH,path.join(profile,'server-data','fusion.db'));assert.equal(fs.existsSync(dbOwner.DB_PATH),false);
 const receipts={root,profile,workspace,machine,nonce,database:dbOwner.DB_PATH,events:[]};
 try{
  const db=await dbOwner.initDb();await owner('workspace/ai-paths').initializeLocalMachineIdentity({db,fallback:machine});
  const seed=await registry.list();assert.equal(seed.length,1);assert.equal(seed[0].id,'fs-dev');assert.equal(owner('workspace/path-service').comparisonKey(seed[0].repoPath),owner('workspace/path-service').comparisonKey(repo));
  assert.equal(controller.getActiveWorkspaceId(),null);assert.equal(readiness.hasInstalledViewReadinessOwner(),false);
  assert.equal((await db('threads').count({count:'*'}).first()).count,0);
  receipts.seedRemoved={id:seed[0].id,repoPath:seed[0].repoPath,beforeControllerStart:true};assert.equal(await registry.remove(seed[0].id),true);assert.deepEqual(await registry.list(),[]);
  await controller.start();assert.equal(controller.getActiveWorkspaceId(),null);
  const unsubs=['workspace:added','workspace:switched'].map(type=>bus.on(type,e=>receipts.events.push({type,workspaceId:e.workspace?.id??e.to,repoPath:e.workspace?.repoPath??e.repoPath,viewRegistryUnavailable:e.viewRegistryUnavailable,bindingRevision:e.bindingRevision})));
  bus.emit('workspace:add_requested',{repoPath:workspace});await controller.runInWorkspaceLifecycle(()=>undefined);
  const rows=await registry.list();assert.equal(rows.length,1);const row=rows[0];assert.equal(row.repoPath,fs.realpathSync(workspace));assert.equal(receipts.events[0]?.viewRegistryUnavailable,false);
  bus.emit('workspace:switch_requested',{workspaceId:row.id});await controller.runInWorkspaceLifecycle(()=>undefined);
  assert.equal(controller.getActiveWorkspaceId(),row.id);assert.equal(controller.getActiveWorkspaceSync().repoPath,row.repoPath);
  const status=readiness.getViewReadinessStatus({workspaceId:row.id,projectRoot:row.repoPath});assert.equal(status.status,'ready');assert.equal(status.verified,true);assert.equal(status.leases,0);
  receipts.registry=rows.map(({id,repoPath})=>({id,repoPath}));receipts.active={workspaceId:controller.getActiveWorkspaceId(),repoPath:controller.getActiveWorkspaceSync().repoPath,bindingRevision:controller.getActiveWorkspaceBindingRevision()};receipts.readiness=status;
  receipts.lastActive=await db('system_config').select('key','value').where('key','last_active_workspace_id').first();assert.equal(receipts.lastActive.value,row.id);
  receipts.threads=(await db('threads').count({count:'*'}).first()).count;receipts.threadGroups=(await db('thread_groups').count({count:'*'}).first()).count;
  for(const unsub of unsubs)unsub();await readiness.retireWorkspaceViewReadiness({workspaceId:row.id,projectRoot:row.repoPath},()=>true);await dbOwner.closeDb();receipts.preparationOwnersClosed=true;
  fs.writeFileSync(path.join(root,'runtime-preparation.json'),JSON.stringify(receipts,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({status:'SCRATCH_PREPARED',root,profile,workspace,workspaceId:row.id,readiness:status,preparationOwnersClosed:true}));
 }catch(error){await dbOwner.closeDb();fs.writeFileSync(path.join(root,'runtime-preparation-failure.json'),JSON.stringify({status:'SCRATCH_PREPARATION_FAILED',stage:'registry-selection',name:error.name,code:error.code??null},null,2)+'\n',{flag:'wx',mode:0o600});throw error;}
})();
