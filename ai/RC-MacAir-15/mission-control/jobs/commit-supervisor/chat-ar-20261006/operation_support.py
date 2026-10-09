from pathlib import Path
import os,json,stat,hashlib,subprocess
from datetime import datetime,timezone
JOB=Path(__file__).resolve().parent
SOURCE=Path('/Users/rccurtrightjr./projects/fs-dev')
CANDIDATE=Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
ENV={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args],env=ENV)
def write(name,data):
 with (JOB/name).open('x') as f:json.dump(data,f,indent=2);f.write('\n')
def check_leaf(repo,r):
 p=repo/r['path']
 if r['kind']=='absent':assert not p.exists() and not p.is_symlink(),r['path'];return
 assert p.is_file() and not p.is_symlink(),r['path']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],r['path']
 assert stat.S_IMODE(p.stat().st_mode)==r['mode'],r['path']
def verify_seal(folder):
 seal=json.loads((JOB/folder/'seal.json').read_text())
 for name,h in seal['files'].items():assert hashlib.sha256((JOB/folder/name).read_bytes()).hexdigest()==h,(folder,name)
 return seal
def precheck(label,source_copied=False,source_staged=False,candidate_committed=False):
 identity=json.loads((JOB/'final-candidate-identity.json').read_text())
 assert git(SOURCE,'rev-parse','--show-toplevel').decode().strip()==str(SOURCE)
 assert git(CANDIDATE,'rev-parse','--show-toplevel').decode().strip()==str(CANDIDATE)
 assert git(CANDIDATE,'branch','--show-current').decode().strip()==identity['branch']
 assert git(SOURCE,'remote','-v').decode()==identity['remote_configuration']
 for repo in [SOURCE,CANDIDATE]:
  result=subprocess.run(['git','-C',str(repo),'config','--get','core.hooksPath'],env=ENV,capture_output=True)
  hook_path=Path(result.stdout.decode().strip()) if result.returncode==0 else repo/'.git/hooks'
  assert not hook_path.exists() or not any(f.is_file() and os.access(f,os.X_OK) and not f.name.endswith('.sample') for f in hook_path.iterdir()),'Unexpected executable Git hook'
 assert not (SOURCE/'.git/index.lock').exists() and not (CANDIDATE/'.git/index.lock').exists()
 subprocess.run(['python3',str(JOB/'verify-candidate.py')],check=True,capture_output=True)
 subprocess.run(['python3',str(JOB/'protect-unselected.py'),'verify'],check=True,capture_output=True)
 final=verify_seal('final-review-pass-02');assert final['state']=='REVIEW_COMPLETE' and final['result']=='clean' and final['tree']==identity['tree']
 verify_seal('restart-wiki-scope-repair')
 root=json.loads((JOB/'runtime-location.json').read_text())['root'];root=Path(root)
 for name in ['runtime-chat-smoke.json','runtime-wiki-smoke.json']:assert json.loads((root/name).read_text())['status']=='PASS'
 assert json.loads((root/'runtime-stop-receipt.json').read_text())['status']=='OWNED_RUNTIME_STOPPED'
 assert json.loads((JOB/'runtime-preservation-receipt.json').read_text())['protected_files_equal']
 runtime=json.loads((JOB/'runtime-acceptance.json').read_text());assert runtime['state']=='RUNTIME_VALIDATED' and runtime['tree']==identity['tree']
 for member in runtime['files']:assert hashlib.sha256(Path(member['path']).read_bytes()).hexdigest()==member['sha256'],member['path']
 for row in json.loads((JOB/'preoperation-recovery-readback.json').read_text())['records']:
  assert hashlib.sha256(Path(row['manifest']).read_bytes()).hexdigest()==row['sha256'],row['manifest']
 assert (JOB/'owner-packet.md').exists() and (JOB/'owner-operation-authority.md').exists()
 expected=json.loads((JOB/('final-candidate-owned-inventory.json' if source_copied else 'final-source-owned-inventory.json')).read_text())
 for r in expected:check_leaf(SOURCE,r)
 check_leaf(CANDIDATE,identity['deferred_restart_article'])
 if source_staged:assert git(SOURCE,'ls-files','--stage','-z')==git(CANDIDATE,'ls-tree','-r','-z','--format=%(objectmode) %(objectname) 0%x09%(path)',identity['tree'])
 else:assert hashlib.sha256((SOURCE/'.git/index').read_bytes()).hexdigest()==identity['source_index_sha256']
 if not candidate_committed:assert git(CANDIDATE,'rev-parse','HEAD').decode().strip()==identity['head']
 else:
  commit=json.loads((JOB/'local-commit-receipt.json').read_text())['commit']
  assert git(CANDIDATE,'rev-parse','HEAD').decode().strip()==commit
  assert git(CANDIDATE,'rev-parse','HEAD^{tree}').decode().strip()==identity['tree']
 data={'at':datetime.now(timezone.utc).isoformat(),'label':label,'tree':identity['tree'],'candidate_head':git(CANDIDATE,'rev-parse','HEAD').decode().strip(),'source_head':git(SOURCE,'rev-parse','HEAD').decode().strip(),'source_branch':git(SOURCE,'branch','--show-current').decode().strip(),'source_refs':git(SOURCE,'for-each-ref','--format=%(objectname) %(refname)','refs/heads/','refs/remotes/').decode(),'candidate_support_separate':True,'source_copied':source_copied,'source_staged':source_staged,'required_current_gates_match':True,'unselected_source_bytes_match':True,'owner_authority':'Actual human local merge/commit and coherent inspected-documentation instructions, owner-operation-authority.md; no push/PR/Alpha.'}
 write(label+'-precheck.json',data);return data
def execute(label,repo,args):
 assert not (JOB/(label+'-receipt.json')).exists()
 started={'at':datetime.now(timezone.utc).isoformat(),'repo':str(repo),'argv':['git','-C',str(repo),*args]}
 write(label+'-started.json',started)
 r=subprocess.run(started['argv'],env=ENV,capture_output=True)
 (JOB/(label+'-stdout.bin')).write_bytes(r.stdout);(JOB/(label+'-stderr.bin')).write_bytes(r.stderr)
 result={**started,'finished':datetime.now(timezone.utc).isoformat(),'exit_code':r.returncode,'stdout_sha256':hashlib.sha256(r.stdout).hexdigest(),'stderr_sha256':hashlib.sha256(r.stderr).hexdigest()}
 write(label+'-receipt.json',result)
 print(json.dumps(result))
 assert r.returncode==0,r.stderr.decode(errors='replace')
 return result
