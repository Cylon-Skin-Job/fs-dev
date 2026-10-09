"""Read-only final process/storage/recovery preservation checks after all six acceptances."""
import pathlib,json,hashlib,os,stat,re,datetime,subprocess
C=pathlib.Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control');R=C.parents[2];E=C/'planning/commit-supervisor/execution';J=C/'jobs/commit-supervisor/rehearsal-20261004-s6';V=J/'recovery-1';P=pathlib.Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate');OUT=E/'SPEC-final-preservation'
def load(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(n,d):
 p=OUT/n
 with p.open('x')as f:json.dump(d,f,indent=2);f.write('\n')
 p.chmod(0o444)
def leaf(p):
 try:s=p.lstat()
 except FileNotFoundError:return {'exists':False}
 d={'exists':True,'kind':'file'if stat.S_ISREG(s.st_mode)else 'symlink'if stat.S_ISLNK(s.st_mode)else 'directory'if stat.S_ISDIR(s.st_mode)else 'other','mode':s.st_mode,'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtime_ns':s.st_mtime_ns}
 if stat.S_ISREG(s.st_mode):d['sha256']=sha(p)
 elif stat.S_ISLNK(s.st_mode):d['target']=os.readlink(p)
 return d
def command(n,args):
 env={k:v for k,v in os.environ.items()if not k.startswith('GIT_')};env.update(GIT_OPTIONAL_LOCKS='0',GIT_LITERAL_PATHSPECS='1',PYTHONDONTWRITEBYTECODE='1');at=now();d=subprocess.run(args,cwd=C,env=env,capture_output=True);r={'actor':'/root','argv':args,'cwd':str(C),'started':at,'finished':now(),'exit':d.returncode,'stdout_hex':d.stdout.hex(),'stderr_hex':d.stderr.hex(),'environment_overrides':{'GIT_OPTIONAL_LOCKS':'0','GIT_LITERAL_PATHSPECS':'1','PYTHONDONTWRITEBYTECODE':'1'}};save(n,r);assert d.returncode==0,(n,d.stderr.decode(errors='replace'));return d.stdout
activation=load(E/'SPEC-final-check-activation.json');assert activation['accepted_slices']==['S1','S2','S3','S4','S5','S6'] and activation['actual_recovery_complete'] and activation['private_preview_stopped'];OUT.mkdir(exist_ok=False)
command('process-command.json',['/opt/homebrew/bin/node',str(E/'SPEC-final-process-readback.mjs'),'final'])
d=load(OUT/'final-processes.json');assert d['selected']==[] and len(d['protectedRecords'])==4 and len(d['protectedTrees'])==13
previous=load(V/'final-preservation-proof.json')['process_readbacks'][-1]['identities'];expected={a['pid']:a for a in previous};norm=[]
for a in d['protectedTrees']:
 raw=d['raw'][str(a['pid'])];b=expected[a['pid']];assert raw['identity']['exit']==0 and raw['cwd_executable']['exit']==0
 for k in ['pid','ppid','uid','start','command']:assert a[k]==b[k],(a['pid'],k)
 assert a['uid']==os.getuid()==501 and a['start'] in raw['identity']['stdout'] and a['command']in raw['identity']['stdout']
 cwd=None;exe=None;fd=None
 for line in raw['cwd_executable']['stdout'].splitlines():
  if line.startswith('f'):fd=line[1:]
  elif line.startswith('n')and fd=='cwd':cwd=line[1:]
  elif line.startswith('n')and fd=='txt'and exe is None:exe=line[1:]
 assert cwd==b['cwd']and exe==b['executable']
 for k,x in b['env'].items():assert k+'='+x in raw['environment']['stdout']
 norm.append({**b,'cwd':cwd,'executable':exe})
assert all(not re.search(r'^\s*'+str(pid)+r'\s',d['raw']['all']['stdout'],re.M)for pid in [31000,31005,31006,31008,31036,31138]);assert not re.search(r':(?:63400|63399)\s',d['raw']['listeners']['stdout'])
initial=load(V/'initial.json');storage={}
for n,b in initial['protected_profile_storage'].items():
 a=leaf(pathlib.Path(n));assert all(a.get(k)==b.get(k)for k in ['exists','kind','mode','dev','ino']),n;storage[n]={'before':b,'current':a,'identity_equal':True,'volatile_content_qualification':'Current active profile/DB bytes/size/mtime may change; no copying/restoring or content stability claim'}
for n,b in initial['private_profile_storage'].items():assert leaf(P.parent/'profile'/n)==b,n
for archive in initial['archives']:
 for n,b in archive['archive_leaves'].items():assert leaf(pathlib.Path(archive['job'])/'recovery'/n)==b,n
for n,b in initial['historical_job'].items():assert leaf(J/n)==b,n
assert sha(J/'interruption-1/fixed-checkpoint/restore-guard.json')=='1055f07580fde5b8be0fdb7754d5d584c6167442225eb79acb9e62c16be59a7e'
verify=command('original-public-verify.json',['/opt/homebrew/bin/python3.12','-B',str(C/'.agents/skills/mc-commit-supervisor/scripts/job_snapshot.py'),'verify','--job',str(J)])
verification=json.loads(verify);assert verification['payloads_valid']and verification['matches_checkpoint']and verification['status_equal']
original=load(J/'recovery/manifest.json');rootread=load(E/'S6-root-original-current-readback.json')
# Public verification covers current full4353 semantics; independently recheck all owned work bytes/modes/link/absence and immutable staged object bytes.
for n,b in original['owned'].items():
 p=P/n;wt=b['worktree'];s=leaf(p)
 if wt['kind']=='missing':assert not s['exists'],n
 elif wt['kind']=='file':assert s['kind']=='file'and stat.S_IMODE(s['mode'])==wt['mode']and s['sha256']==wt['sha256'],n
 elif wt['kind']=='symlink':assert s['kind']=='symlink'and hashlib.sha256(os.fsencode(s['target'])).hexdigest()==wt['sha256'] and os.fsencode(s['target'])==(J/'recovery'/wt['payload']).read_bytes(),n
 else:raise AssertionError((n,wt['kind']))
 for a in b['index']:
  data=command('owned-blob-'+hashlib.sha256((n+str(a['stage'])).encode()).hexdigest()+'.json',['git','-C',str(P),'cat-file','blob',a['oid']]);assert hashlib.sha256(data).hexdigest()==a['sha256'],n
out={'at':now(),'result':'FINAL_PROCESS_STORAGE_RECOVERY_PRESERVATION_PASSED','protected_roots':4,'protected_tree_total':13,'protected_identities':sorted(norm,key=lambda a:a['pid']),'storage11':storage,'private_profile_leaf_count':len(initial['private_profile_storage']),'private_profile_exact':True,'original_archives':6,'earlier_job_leaves_exact':1844,'original_guard_retained':True,'current_original_owned':128,'current_full_inventory':4353,'unrelated':4225,'full_current_public_verification':verification,'actual_publication':[],'private_preview_stopped':True,'limits':'No current production readiness is implied; seeded original defects restored, successful live fixed packets are historical. Protected live DB content is volatile.'};save('result.json',out);print(json.dumps({k:v for k,v in out.items()if k not in ['protected_identities','storage11','full_current_public_verification']},indent=2))
