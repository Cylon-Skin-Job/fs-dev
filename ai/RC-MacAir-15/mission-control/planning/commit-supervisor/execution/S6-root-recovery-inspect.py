import pathlib,json,hashlib,stat,os,datetime,re,subprocess
C=pathlib.Path.cwd(); R=C.parents[2]; E=C/'planning/commit-supervisor/execution'; J=C/'jobs/commit-supervisor/rehearsal-20261004-s6'; V=J/'recovery-1'
def load(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def pin(x):
 p=pathlib.Path(x['path']); assert sha(p)==x['sha256'],str(p)
 if 'size' in x:assert p.stat().st_size==x['size'],str(p)
def pins(x):
 if isinstance(x,dict):
  if 'path'in x and 'sha256'in x: pin(x)
  for a in x.values():pins(a)
 elif isinstance(x,list):
  for a in x:pins(a)
def leaf(p):
 try:s=p.lstat()
 except FileNotFoundError:return {'exists':False}
 d={'exists':True,'kind':'file' if stat.S_ISREG(s.st_mode) else 'symlink' if stat.S_ISLNK(s.st_mode) else 'directory' if stat.S_ISDIR(s.st_mode) else 'other','mode':s.st_mode,'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtime_ns':s.st_mtime_ns}
 if stat.S_ISREG(s.st_mode):d['sha256']=sha(p)
 elif stat.S_ISLNK(s.st_mode):d['target']=os.readlink(p)
 return d
def leaves(root,d):
 for n,a in d.items():assert leaf(root/n)==a,str(root/n)
def scoped(raw):
 b=pathlib.Path(raw['stdout_raw']['path']).read_bytes();a=b.split(b'\0');out=[];i=0
 prefixes=[str(J.relative_to(R))+'/',str(E.relative_to(R))+'/']
 while i<len(a):
  r=a[i];i+=1
  if not r:continue
  names=[r[3:]]; rec=[r]
  if r[:1] in [b'R',b'C'] or r[1:2] in [b'R',b'C']:
   rec.append(a[i]);names.append(a[i]);i+=1
  if not all(any(n.decode('utf-8','surrogateescape').startswith(p) for p in prefixes) for n in names):out.extend(rec)
 return out
initial=load(V/'initial.json'); final=load(V/'after-original.json'); commands=load(V/'all-raw-command-receipts.json')
assert commands['count']==len(commands['commands'])==191
exits={}
for p in commands['commands']:
 pin(p);d=load(p['path']); pins(d); assert d['command']==p['command'] and d['exit_code']==p['exit_code'];assert d['started']<=d['finished'];exits[d['exit_code']]=exits.get(d['exit_code'],0)+1
 assert d['exit_code']==0 or (d['exit_code']==1 and ('symbolic-ref' in d['command'] or pathlib.Path(p['path']).name in ['fixed-actual-collision-refusal.command.json','original-actual-scope-guard-refusal.command.json']))
for n,reason in [('fixed-actual-collision-refusal.command.json','current-byte collision; nothing restored'),('original-actual-scope-guard-refusal.command.json','unrelated entries changed; restore is non-mutating')]:
 d=load(V/n);assert d['exit_code']==1;assert json.loads(pathlib.Path(d['stderr_raw']['path']).read_text())=={'result':'REFUSED','reason':reason}
for b,a in [('collision-before-refusal.json','collision-after-refusal.json'),('original-premature-before.json','original-premature-after.json')]:
 b=load(V/b);a=load(V/a);assert b['candidate']==a['candidate']
 for k in ['source_leaves','source_build_caches','historical_job','archives','authority165','private_profile_storage']:assert b[k]==a[k],k
 for repo in ['candidate','source']:
  for k in b['raw_git'][repo]:
   p,q=b['raw_git'][repo][k],a['raw_git'][repo][k]
   assert scoped(p)==scoped(q) if repo=='source' and k=='status' else (pathlib.Path(p['stdout_raw']['path']).read_bytes()==pathlib.Path(q['stdout_raw']['path']).read_bytes() if 'stdout_raw' in p else pathlib.Path(p['path']).read_bytes()==pathlib.Path(q['path']).read_bytes()),(repo,k)
order=load(V/'actual-restore-order.json');assert [x['label']for x in order['reverse_unions_then_original_last']]==['fix-xy-wiki','first-wiki','original'];assert order['fixed_first']['actual_restore']['result']=='RESTORED'
readbacks=[]
for label,n,count,full in [('fixed','fixed-full-exact-readback.json',130,4355),('fix-xy-wiki','fix-xy-wiki-full-exact-readback.json',130,4355),('first-wiki','first-wiki-full-exact-readback.json',129,4354),('original','original-full-exact-readback.json',128,4353)]:
 d=load(V/n);m=load(pathlib.Path(d['original_checkpoint'])/'recovery/manifest.json'); assert sha(pathlib.Path(d['original_checkpoint'])/'recovery/manifest.json')==d['manifest_sha256'];assert d['owned_count']==count and d['full_inventory_count']==full and d['unrelated_count']==4225
 assert d['matches_checkpoint_semantic'] and d['status_equal']; assert len(d['all_paths'])==count and set(d['all_paths'])==set(m['owned'])
 assert d['complete_current']['paths']==m['baseline']['paths']
 for name,o in d['all_paths'].items():
  expected=m['owned'][name];assert o['current']=={'index':[{k:a[k] for k in ['mode','oid','stage']} for a in expected['index']],'flag':expected['flag'],'worktree':{k:a for k,a in expected['worktree'].items() if k!='payload'}};assert o['base']==expected['base']
  assert len(o['index_byte_readbacks'])==len(expected['index'])
  for actual,wanted in zip(o['index_byte_readbacks'],expected['index']):
   b=bytes.fromhex(actual['hex']);assert hashlib.sha256(b).hexdigest()==actual['sha256']==wanted['sha256'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==actual['oid']==wanted['oid'];assert actual['mode']==wanted['mode'] and actual['stage']==wanted['stage']
  if o['worktree_hex'] is not None:assert hashlib.sha256(bytes.fromhex(o['worktree_hex'])).hexdigest()==expected['worktree']['sha256']
 readbacks.append({'label':label,'owned':count,'full':full,'sha256':sha(V/n)})
original=load(J/'recovery/manifest.json');base=load(V/'original-base-full-readback.json');assert len(base['owned'])==128
for n,d in base['owned'].items():
 expected=original['owned'][n]['base'];assert d['actual_base']==[{k:a[k]for k in ['mode','kind','oid','sha256']}for a in expected]
 assert d['absent_base_exact']==(not expected)
for k in ['source_leaves','source_build_caches','historical_job','archives','authority165','private_profile_storage']:assert initial[k]==final[k],k
leaves(R,initial['source_leaves']);leaves(R,initial['source_build_caches']);leaves(J,initial['historical_job']);leaves(pathlib.Path('/private/tmp/mc-s6-commit-supervisor-20261004/profile'),initial['private_profile_storage'])
for a in initial['archives']:leaves(pathlib.Path(a['job'])/'recovery',a['archive_leaves'])
for n,h in initial['authority165'].items():assert sha(n)==(h['current'] if isinstance(h,dict) else h),n
for name in initial['raw_git']['source']:
 b,a=initial['raw_git']['source'][name],final['raw_git']['source'][name]
 assert scoped(b)==scoped(a) if name=='status' else (pathlib.Path(b['stdout_raw']['path']).read_bytes()==pathlib.Path(a['stdout_raw']['path']).read_bytes() if 'stdout_raw' in b else pathlib.Path(b['path']).read_bytes()==pathlib.Path(a['path']).read_bytes()),name
copies=load(V/'public-control-copy-equality.json')
for d in copies.values():
 assert d['all_archive_bytes_modes_times_equal'];assert set(d['copy_records'])==set(d['original_archive_records'])
 for n,x in d['copy_records'].items():
  y=d['original_archive_records'][n];assert {k:a for k,a in x.items()if k not in ['dev','ino']}=={k:a for k,a in y.items()if k not in ['dev','ino']}
  assert leaf(pathlib.Path(d['control_job'])/'recovery'/n)==x
proof=load(V/'final-preservation-proof.json');identities=[]
for p in proof['process_readbacks']:
 pin(p);d=load(p['path']);assert d['selected']==[];assert len(d['protectedRecords'])==4 and len(d['protectedTrees'])==13
 norm=[]; expected_identities={a['pid']:a for a in p['identities']}
 for a in d['protectedTrees']:
  raw=d['raw'][str(a['pid'])];assert raw['identity']['exit']==0 and raw['cwd_executable']['exit']==0
  line=raw['identity']['stdout'].strip();assert str(a['pid']) in line and a['start']in line and a['command']in line and a['uid']==501
  cwd=None;exe=None;fd=None
  for x in raw['cwd_executable']['stdout'].splitlines():
   if x.startswith('f'):fd=x[1:]
   elif x.startswith('n') and fd=='cwd':cwd=x[1:]
   elif x.startswith('n') and fd=='txt' and exe is None:exe=x[1:]
  expected=expected_identities[a['pid']];assert cwd==expected['cwd'] and exe==expected['executable']
  for k,val in expected['env'].items():assert k+'='+val in raw['environment']['stdout']
  norm.append({'pid':a['pid'],'ppid':a['ppid'],'uid':a['uid'],'start':a['start'],'command':a['command'],'cwd':cwd,'executable':exe,'machine':expected['env'].get('FUSION_LOCAL_MACHINE'),'env':expected['env']})
 assert sorted(norm,key=lambda a:a['pid'])==sorted(p['identities'],key=lambda a:a['pid'])
 if identities:assert sorted(norm,key=lambda a:a['pid'])==sorted(identities,key=lambda a:a['pid'])
 identities=norm
 assert all(not re.search(r'^\s*'+str(pid)+r'\s',d['raw']['all']['stdout'],re.M) for pid in [31000,31005,31006,31008,31036,31138])
 assert not re.search(r':(?:63400|63399)\s',d['raw']['listeners']['stdout'])
for n,b in initial['protected_profile_storage'].items():
 a=final['protected_profile_storage'][n];current=leaf(pathlib.Path(n))
 for k in ['exists','kind','mode','dev','ino']:assert b.get(k)==a.get(k)==current.get(k),(n,k)
cp=load(V/'checkpoint.json');pins(cp['raw_evidence']);pins(load(V/'completion-manifest.json'));criteria=load(V/'criterion-map.json');assert len(criteria['criteria'])==16;pins(criteria)
assert not cp['current_ready']and not cp['actual_publication_operations']and not cp['actual_commit_ids']
assert sha(J/'interruption-1/fixed-checkpoint/restore-guard.json')=='1055f07580fde5b8be0fdb7754d5d584c6167442225eb79acb9e62c16be59a7e'
for n in ['checkpoint.json','report.md','criterion-map.json','deviations.json','lifecycle.json','activation.json','completion-manifest.json']:
 p=V/'history/S6-SECOND-RECOVERY-COMPLETE-01'/n;assert p.read_bytes()==(V/n).read_bytes() and stat.S_IMODE(p.stat().st_mode)==0o444
out={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actor':'/root','native_actor':'/root/s6_supervisor_recovery_1','native_completion_observed':'actual FINAL plus exact-subtree list_agents completed/no children','closure':'close_agent unavailable; native END observed','inspection':'Full helpers/report/deviations/lifecycle read; independent raw comparisons and current filesystem checks','raw_receipts':191,'exit_counts':exits,'checkpoint_pins':27,'recovery_criteria':16,'readbacks':readbacks,'source_leaves':11977,'cache_leaves':193,'historical_job':1844,'archives':6,'public_byte_exact_control_copies':4,'protected_roots':4,'protected_tree_total':13,'process_samples':5,'storage_identities':11,'private_profile_exact':True,'profile_db_qualification':'Live protected DB byte/mtime/size volatility allowed; identities preserved; no database copy/restore','original_source_physical_index':'f37b5bfc9a44893b132661290fe095ddafccb79bed38ca9007dc3803d2ff7966','original_guard_retained':True,'root_current_original_readback':str(E/'S6-root-original-current-readback.json'),'current_ready':False,'private_preview_stopped':True,'publication':[],'result':'RECOVERY_RAW_AND_CURRENT_PRESERVATION_INSPECTED','remaining':'Responsible S6 factual docs and fresh full-S6/whole gates, final suite'}
(E/'S6-root-recovery-inspection.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
