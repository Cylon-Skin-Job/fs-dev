"""Bounded S6 refusal observer; writes exclusively to its own negative-control records."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib,json,os,stat,subprocess,sys,tomllib
C=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R=Path('/Users/rccurtrightjr./projects/fs-dev')
P=Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
J=C/'jobs/commit-supervisor/rehearsal-20261004-s6'; N=J/'negative-control-1'
E=C/'planning/commit-supervisor/execution'; CTRL=E/'S6-negative-controls'
K=C/'.agents/skills/mc-commit-supervisor'
PROFILE=P.parent/'profile'; ACTOR='/root/s6_supervisor_refusal_1'
sys.path.insert(0,str(K/'scripts'))
from snapshot_state import relevant_state,repository,git,ref_state
from job_snapshot import load
assert Path.cwd()==C and N.resolve()==N

def now():return datetime.now(timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(Path(p).read_bytes())
def save(name,d):
 p=N/name; assert p.parent==N
 with p.open('x') as f:json.dump(d,f,indent=2);f.write('\n')
def raw(name,b):
 p=N/name; assert p.parent==N
 with p.open('xb') as f:f.write(b)
 return {'path':str(p),'sha256':sha(b),'size':len(b)}
def run(tag,args,cwd=C):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',GIT_LITERAL_PATHSPECS='1',PYTHONDONTWRITEBYTECODE='1')
 for n in ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES']:env.pop(n,None)
 started=now(); q=subprocess.run(args,cwd=cwd,env=env,capture_output=True)
 receipt={'command':args,'cwd':str(cwd),'environment_overrides':{'GIT_OPTIONAL_LOCKS':'0','GIT_LITERAL_PATHSPECS':'1','PYTHONDONTWRITEBYTECODE':'1'},'started':started,'finished':now(),'exit_code':q.returncode,'stdout':q.stdout.decode(errors='replace'),'stderr':q.stderr.decode(errors='replace'),'stdout_raw':raw('inspection2-'+tag+'.stdout',q.stdout),'stderr_raw':raw('inspection2-'+tag+'.stderr',q.stderr)}
 save('inspection2-'+tag+'.command.json',receipt);return q,receipt

def leaf(p):
 p=Path(p)
 try:s=p.lstat()
 except FileNotFoundError:return {'exists':False}
 d={'exists':True,'mode':oct(s.st_mode),'kind':'symlink' if stat.S_ISLNK(s.st_mode) else 'file' if stat.S_ISREG(s.st_mode) else 'directory' if stat.S_ISDIR(s.st_mode) else 'special'}
 if d['kind'] in ('file','symlink'):d['sha256']=sha(os.fsencode(os.readlink(p)) if d['kind']=='symlink' else p.read_bytes())
 return d

def metadata(p):
 d=leaf(p)
 if d['exists']:
  s=Path(p).lstat();d.update(dev=s.st_dev,ino=s.st_ino,size=s.st_size,mtime_ns=s.st_mtime_ns)
 return d

def tree(root):
 return {str(p.relative_to(root)):metadata(p) for p in sorted(root.rglob('*')) if not p.is_dir() and not (root==J and N in p.parents)}

def capture(tag):
 _,m=load(J/'fixed-candidates/fix-xy')
 candidate=relevant_state(P,m['owned'],[str(R)])
 rawgit={}
 for label,repo in [('source',R),('candidate',P)]:
  rawgit[label]={}
  for what,args in [('status',['status','--porcelain=v1','-z','--untracked-files=all']),('index-stage',['ls-files','--stage','-z']),('index-flags',['ls-files','-v','-z']),('refs',['for-each-ref','--format=%(refname)%00%(objectname)']),('configuration',['config','--null','--list','--show-origin']),('remotes',['remote','-v']),('branch',['symbolic-ref','-q','HEAD']),('head',['rev-parse','HEAD'])]:
   q,r=run(tag+'-'+label+'-'+what,['git','-C',str(repo),*args]);assert q.returncode in (0,1) and (q.returncode==0 or what=='branch')
   rawgit[label][what]=r
  rawgit[label]['physical-index']=raw(tag+'-'+label+'-physical-index.bin',(repo/'.git/index').read_bytes())
 names=set()
 for args in [('diff','--name-only','-z'),('diff','--cached','--name-only','-z'),('ls-files','--others','--exclude-standard','-z')]:names.update(os.fsdecode(n) for n in git(R,*args).split(b'\0') if n)
 exclusions=[str(J.relative_to(R))+'/',str(E.relative_to(R))+'/']
 source_paths={n:metadata(R/n) for n in sorted(names) if not any(n.startswith(x) for x in exclusions)}
 baseline=read(J/'evidence/fix-xy-protection-post-runtime.json')
 caches={n:metadata(R/n) for n in baseline['source_build_caches']}
 protected={n:metadata(Path(n)) for n in baseline['profile_storage']}
 processes=[]
 for pid in [int(r['pid']) for r in baseline['processes']]+[31000,31008,31036,31138]:
  q,r=run(tag+'-process-'+str(pid),['ps','-p',str(pid),'-o','pid=,ppid=,lstart=,command=']); f,fr=run(tag+'-process-files-'+str(pid),['lsof','-a','-p',str(pid),'-d','cwd,txt','-Fn']);processes.append({'pid':pid,'identity':r,'cwd_executable':fr})
 schedules=[]
 for p in sorted(Path('/Users/rccurtrightjr./.codex/automations').glob('*/automation.toml')):
  b=p.read_bytes(); d=tomllib.loads(b.decode()); schedules.append({'path':str(p),'sha256':sha(b),'status':d.get('status'),'kind':d.get('kind'),'matching':any(s in b.decode() for s in ['rehearsal-20261004-s6','s6_supervisor_fix_xy_1','s6_supervisor_refusal_1'])})
 d={'at':now(),'actor':ACTOR,'candidate':candidate,'raw_git':rawgit,'source_paths':source_paths,'source_exclusions':exclusions,'source_build_caches':caches,'protected_profile_storage':protected,'private_profile_storage':tree(PROFILE),'historical_job':tree(J),'processes':processes,'schedules':schedules,'runtime_effects_performed':[],'limit':'Reads preserve fingerprints; access-time changes excluded. Live DB/log/profile hashes may vary naturally; exact changes disclosed separately. No user/database contents copied.'}
 save(tag+'.json',d);print(json.dumps({'snapshot':tag,'at':d['at'],'candidate_paths':len(candidate['paths']),'source_leaves':len(source_paths),'cache_leaves':len(caches),'private_profile_leaves':len(d['private_profile_storage']),'historical_job_leaves':len(d['historical_job']),'processes':len(processes)}))
 return d

if sys.argv[1]=='before':
 capture('before')
elif sys.argv[1]=='inspect':
 controls=read(CTRL/'controls.json');plan=read(CTRL/'plan.json');selection=read(CTRL/'selected-source.json'); owner=read(J/'evidence/fix-xy-owner-runtime-identity.json');checkpoint=read(J/'checkpoint-fix-xy.json'); op=read(J/'hypothetical-operation-packet-fix-xy.json')
 results={}
 for tag,repo,ref in [('selected-existing',Path(selection['repository']),selection['ref']+'^{commit}'),('target-current',P,plan['target_ref']),('source-current',R,'HEAD'),('candidate-current',P,'HEAD')]:
  q,r=run(tag,['git','-C',str(repo),'rev-parse','--verify',ref]);assert q.returncode==0;results[tag]={'commit':q.stdout.decode().strip(),'receipt':r}
 for tag,ref in [('selected-object',selection['ref']),('baseline-object',checkpoint['target_baseline'])]:
  q,r=run(tag,['git','-C',str(P),'cat-file','-p',ref]);assert q.returncode==0;results[tag]=r
 syntax=read(N/'fault-module-check.command.json'); assert syntax['exit_code']!=0 and 'SyntaxError' in syntax['stderr']
 results['actual_syntax_check']=syntax
 b=(P/controls['candidate_fault']).read_bytes(); pre=(CTRL/'controller.preimage.bin').read_bytes();raw('controller-current.bin',b);raw('controller-fixed-preimage.bin',pre)
 assert sha(b)==controls['current_fault_sha256'] and sha(pre)==plan['controller_preimage_sha256']
 q,verify=run('fixed-public-verify',['python3.12','-B',str(K/'scripts/job_snapshot.py'),'verify','--job',str(J/'fixed-candidates/fix-xy')]); assert q.returncode==0
 verification=json.loads(q.stdout);assert verification['payloads_valid'] and not verification['matches_checkpoint']
 results['fixed_public_verify']=verify
 current=relevant_state(P,owner['owned'],[str(R)])
 fixed=read(J/'fixed-candidates/fix-xy/recovery/manifest.json')
 results['candidate_fixed_diff']=[k for k in current['paths'] if current['paths'][k]!=fixed['baseline']['paths'].get(k)]
 results['candidate_root_after_equal']=current==read(CTRL/'after.json')
 assert results['candidate_fixed_diff']==[controls['candidate_fault']] and results['candidate_root_after_equal']
 recoveries=[]
 for job in [J,J/'recovery-supplements/wiki-union-1',J/'fixed-candidates/first',J/'recovery-supplements/fix-xy-wiki-1',J/'fixed-candidates/fix-xy',E/'S6-prep/final-recovery/preparation-recovery']:
  if not (job/'recovery/manifest.json').exists():
   recoveries.append({'job':str(job),'exists':False});continue
  recovery,m=load(job);recoveries.append({'job':str(job),'manifest_sha256':sha((recovery/'manifest.json').read_bytes()),'owned_count':len(m['owned']),'payload_count':len(list((recovery/'payloads').iterdir())),'payloads_valid':True,'runtime':m['runtime'],'source_commits':m['source_commits'],'target':m['target_commit']})
 results['recovery']=recoveries
 results['gate_identity_comparisons']={}
 for name in ['fix-xy-code-handoff-identity','fix-xy-wiki-handoff-identity','fix-xy-final3-identity','fix-xy-owner-runtime-identity']:
  gate=read(J/('evidence/'+name+'.json'))
  results['gate_identity_comparisons'][name]={'sha256':sha((J/('evidence/'+name+'.json')).read_bytes()),'covered_target':gate['target'],'covered_sources':gate['sources'],'selected_source_matches':results['selected-existing']['commit'] in [x['commit'] for x in gate['sources']],'target_matches':results['target-current']['commit']==gate['target'],'owned_differences':[n for n,v in gate['owned'].items() if leaf(P/n)!=v],'authority_differences':[n for n,v in gate['authority'].items() if leaf(n)!=v],'configuration_differences':[n for n,v in gate['configuration'].items() if leaf(n)!=v]}
 results['unchanged_support']={}
 for name,key in [('fix-xy-python-pre2','dependencies'),('fix-xy-node17-current-bindings','unique_source_dependencies')]:
  path=J/('evidence/'+name+'.json');d=read(path); differences={n:{'covered':v,'current':leaf(n)} for n,v in d[key].items() if leaf(n)!=v};results['unchanged_support'][name]={'identity_path':str(path),'identity_sha256':sha(path.read_bytes()),'count':len(d[key]),'differences':differences,'limit':'Dependency readback only; no suite rerun or earlier verdict certification.'}
 receipt=read(CTRL/'simulated-commit-only-receipt.json');request=read(CTRL/'simulated-push-request.json')
 results['operation']={'receipt':receipt,'request':request,'scope_matches':receipt['allowed_operation']==request['requested_operation'],'packet_hash_matches':receipt['candidate_packet_sha256']==sha((C/receipt['candidate_packet']).read_bytes()),'actual_authorization':'NONE','actual_operations':[],'hypothetical_packet_sha256':sha((J/'hypothetical-operation-packet-fix-xy.json').read_bytes()),'hypothetical':op}
 for tag,args in [('proposed-scope-stage',['ls-files','--stage','-z','--',*op['candidate_paths_and_fingerprints']]),('uncertain-reflogs',['reflog','show','--all','--format=%H%x00%gD%x00%gs']),('uncertain-operation-branch',['show-ref','--verify','refs/heads/codex/s6-rehearsal-fix-xy'])]:
  q,r=run(tag,['git','-C',str(P),*args]); results[tag]=r
 results['checkpoint_actual_operations']=checkpoint['actual_operations'];results['current_ready']=False;results['phase']='unmet-gate';save('inspection.json',results)
 print(json.dumps({'phase':'unmet-gate','current_ready':False,'source':results['selected-existing']['commit'],'target':results['target-current']['commit'],'fault_sha256':sha(b),'node_check_exit':syntax['exit_code'],'fixed_verify':verification,'fixed_differences':results['candidate_fixed_diff'],'gate_comparisons':results['gate_identity_comparisons'],'unchanged_support':results['unchanged_support'],'operation_matches':results['operation']['scope_matches'],'hypothetical_keys':list(op)},indent=2))
elif sys.argv[1]=='after':
 capture('after')
else:raise ValueError('Unsupported observer mode')
