from pathlib import Path
import os,sys,json,hashlib,stat,subprocess
from datetime import datetime,timezone
JOB=Path(__file__).resolve().parent
SOURCE=Path('/Users/rccurtrightjr./projects/fs-dev')
CANDIDATE=Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
ENV={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args],env=ENV)
def leaf(repo,p):
 f=repo/p
 if not f.exists() and not f.is_symlink():return {'path':p,'kind':'absent','mode':None,'sha256':None,'bytes':0}
 st=f.lstat()
 if f.is_symlink():b=os.readlink(f).encode();kind='symlink'
 else:
  assert f.is_file(),p
  b=f.read_bytes();kind='file'
 return {'path':p,'kind':kind,'mode':stat.S_IMODE(st.st_mode),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
mode=sys.argv[1]
assert mode in ['capture','verify']
owned=set(json.loads((JOB/'final-commit-paths.json').read_text()))
job_relative=str(JOB.relative_to(SOURCE))+'/'
paths=set(p.decode() for p in git(SOURCE,'ls-files','--cached','--others','--exclude-standard','-z').split(b'\0') if p)
paths=sorted(p for p in paths if p not in owned and not p.startswith(job_relative))
rows=[leaf(SOURCE,p) for p in paths]
record=JOB/'primary-unselected-preoperation.json'
if mode=='capture':
 assert not record.exists()
 record.write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'scope':'All Git-indexed and nonignored untracked source leaves excluding explicit selected publication leaves and own job reports; bytes, regular mode/absence/symlink target. Runtime ignored caches/dependencies not claimed.','rows':rows},indent=2)+'\n')
else:
 expected=json.loads(record.read_text())['rows']
 assert rows==expected,'Unselected source inventory/bytes drift'
print(json.dumps({'mode':mode,'unselected_leaf_count':len(rows),'exact':True,'at':datetime.now(timezone.utc).isoformat()}))
