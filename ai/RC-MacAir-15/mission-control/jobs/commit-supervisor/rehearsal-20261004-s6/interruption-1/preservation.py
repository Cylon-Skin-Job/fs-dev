"""Capture read-only raw repository and preservation evidence for the bounded interruption."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,stat,subprocess,sys,tomllib
C=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control');R=C.parents[2]
J=C/'jobs/commit-supervisor/rehearsal-20261004-s6';N=J/'interruption-1';E=C/'planning/commit-supervisor/execution';K=C/'.agents/skills/mc-commit-supervisor';P=Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate');PROFILE=P.parent/'profile'
for k in list(os.environ):
 if k.startswith('GIT_'):del os.environ[k]
os.environ.update(GIT_OPTIONAL_LOCKS='0',GIT_LITERAL_PATHSPECS='1',PYTHONDONTWRITEBYTECODE='1')
sys.path.insert(0,str(K/'scripts'))
from snapshot_state import relevant_state,git,ref_state,digest
from job_snapshot import load,verify
assert Path.cwd()==C

def now():return datetime.now(timezone.utc).isoformat()
def read(p):return json.loads(Path(p).read_bytes())
def save(name,value):
 p=N/name
 with p.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
 return str(p)
def raw(name,b):
 p=N/name
 with p.open('xb') as f:f.write(b)
 return {'path':str(p),'sha256':digest(b),'size':len(b)}
def run(tag,args):
 start=now();r=subprocess.run(args,cwd=C,env=os.environ,capture_output=True)
 d={'command':args,'cwd':str(C),'actor':'/root/s6_supervisor_interruption_1','started':start,'finished':now(),'exit_code':r.returncode,'environment_overrides':{'GIT_OPTIONAL_LOCKS':'0','GIT_LITERAL_PATHSPECS':'1','PYTHONDONTWRITEBYTECODE':'1'},'inherited_git_variables_removed':'ALL GIT_* repository/index/object/alternate variables','stdout_raw':raw(tag+'.stdout',r.stdout),'stderr_raw':raw(tag+'.stderr',r.stderr),'stdout':r.stdout.decode(errors='replace'),'stderr':r.stderr.decode(errors='replace')}
 save(tag+'.command.json',d);return r,d

def leaf(p):
 p=Path(p)
 try:s=p.lstat()
 except FileNotFoundError:return {'exists':False}
 d={'exists':True,'kind':'symlink' if stat.S_ISLNK(s.st_mode) else 'file' if stat.S_ISREG(s.st_mode) else 'directory' if stat.S_ISDIR(s.st_mode) else 'special','mode':s.st_mode,'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtime_ns':s.st_mtime_ns}
 if d['kind'] in ['symlink','file']:d['sha256']=digest(os.fsencode(os.readlink(p)) if d['kind']=='symlink' else p.read_bytes())
 return d

def capture(tag):
 cp,m=load(J/'fixed-candidates/fix-xy'); state=relevant_state(P,m['owned'],m['protected_repos'])
 raw_git={}
 for label,repo in [('candidate',P),('source',R)]:
  raw_git[label]={}
  for what,args in [('status',['status','--porcelain=v1','-z','--untracked-files=all']),('index-stage',['ls-files','--stage','-z']),('index-flags',['ls-files','-v','-z']),('refs',['for-each-ref','--format=%(refname)%00%(objectname)']),('configuration',['config','--null','--list','--show-origin']),('remotes',['remote','-v']),('branch',['symbolic-ref','-q','HEAD']),('head',['rev-parse','HEAD']),('reflogs',['reflog','show','--all','--format=%H%x00%gD%x00%gs'])]:
   r,d=run(tag+'-'+label+'-'+what,['git','-C',str(repo),*args]);assert r.returncode==0 or what=='branch' and r.returncode==1
   raw_git[label][what]=d
  raw_git[label]['physical-index']=raw(tag+'-'+label+'-physical-index.bin',(repo/'.git/index').read_bytes())
 names=set()
 for args in [('diff','--name-only','-z'),('diff','--cached','--name-only','-z'),('ls-files','--others','--exclude-standard','-z')]:names.update(os.fsdecode(n) for n in git(R,*args).split(b'\0') if n)
 exclusions=[str(J.relative_to(R))+'/',str(E.relative_to(R))+'/']
 source_leaves={n:leaf(R/n) for n in sorted(names) if not any(n.startswith(x) for x in exclusions)}
 baseline=read(J/'evidence/fix-xy-protection-post-runtime.json')
 caches={n:leaf(R/n) for n in baseline['source_build_caches']}
 storage={n:leaf(n) for n in baseline['profile_storage']}
 private_storage={str(p.relative_to(PROFILE)):leaf(p) for p in sorted(PROFILE.rglob('*')) if not p.is_dir()}
 history={str(p.relative_to(J)):leaf(p) for p in sorted(J.rglob('*')) if N not in p.parents and (p.is_file() or p.is_symlink())}
 archives=[]
 for job in [J,J/'recovery-supplements/first-wiki-1',J/'fixed-candidates/first',J/'recovery-supplements/fix-xy-wiki-1',J/'fixed-candidates/fix-xy']:
  checkpoint,manifest=load(job);q,receipt=run(tag+'-verify-'+str(len(archives)),['python3.12','-B',str(K/'scripts/job_snapshot.py'),'verify','--job',str(job)]);assert q.returncode==0
  archives.append({'job':str(job),'manifest_sha256':digest((checkpoint/'manifest.json').read_bytes()),'owner':manifest['owner'],'owned':len(manifest['owned']),'payload_count':len(list((checkpoint/'payloads').iterdir())),'public_verify':json.loads(q.stdout),'receipt':receipt})
 authorities={p:{'expected':h,'current':digest(Path(p).read_bytes())} for p,h in m['authority_hashes'].items()}
 assert all(v['expected']==v['current'] for v in authorities.values())
 schedule_records=[]
 for p in sorted(Path('/Users/rccurtrightjr./.codex/automations').glob('*/automation.toml')):
  b=p.read_bytes();x=tomllib.loads(b.decode());schedule_records.append({'path':str(p),'sha256':digest(b),'status':x.get('status'),'kind':x.get('kind'),'matching':any(s in b.decode() for s in ['rehearsal-20261004-s6','mc-s6-commit-supervisor','s6_supervisor','planning/commit-supervisor'])})
 assert not any(x['matching'] for x in schedule_records)
 d={'at':now(),'actor':'/root/s6_supervisor_interruption_1','tag':tag,'candidate':state,'raw_git':raw_git,'source_leaves':source_leaves,'source_exclusions':exclusions,'source_build_caches':caches,'protected_profile_storage':storage,'private_profile_storage':private_storage,'historical_job':history,'archives':archives,'authority165':authorities,'schedules':schedule_records,'limits':'No profile/DB contents copied. Hash and metadata reads may observe active protected profile changes; source/evidence namespaces exclude exact assigned J/E. Native lifecycle is independently observed, not proved by guard.'}
 save(tag+'.json',d)
 print(json.dumps({'record':str(N/(tag+'.json')),'candidate_paths':len(state['paths']),'owned':len(m['owned']),'source_leaves':len(source_leaves),'caches':len(caches),'history_leaves':len(history),'archives':[{'job':x['job'],'sha256':x['manifest_sha256'],'matches_current':x['public_verify']['matches_checkpoint'],'payloads_valid':x['public_verify']['payloads_valid']} for x in archives],'authority165_match':True}))
 return d

if __name__=='__main__':capture(sys.argv[1])
