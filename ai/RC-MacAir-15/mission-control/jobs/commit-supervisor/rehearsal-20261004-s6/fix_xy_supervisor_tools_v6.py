from pathlib import Path
from datetime import datetime, timezone
import json, os, hashlib, subprocess, sys, stat
C=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control'); J=C/'jobs/commit-supervisor/rehearsal-20261004-s6'; R=C.parents[2]; P=Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate'); E=C/'planning/commit-supervisor/execution'; K=C/'.agents/skills/mc-commit-supervisor'; ACTOR='/root/s6_supervisor_fix_xy_1'
def sha(b): return hashlib.sha256(b).hexdigest()
def now(): return datetime.now(timezone.utc).isoformat()
def leaf(p):
 if not p.exists() and not p.is_symlink(): return {'exists':False}
 s=p.lstat(); b=os.fsencode(os.readlink(p)) if p.is_symlink() else p.read_bytes(); return {'exists':True,'sha256':sha(b),'mode':oct(s.st_mode),'kind':'symlink' if p.is_symlink() else 'file'}
def save(name,d):
 p=J/name; p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x') as f: json.dump(d,f,indent=2); f.write('\n')
 return str(p)
def git(*a): return subprocess.check_output(['git','-C',str(P),*a],env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))
def freeze(label):
 m=json.loads((J/'recovery/manifest.json').read_text()); paths=set(m['owned']);
 for p in (P/'rehearsal-workspace/ai/MC-S6/Wiki').rglob('*'):
  if p.is_file(): paths.add(str(p.relative_to(P)))
 a=json.loads((J/'evidence/authority-readset.json').read_text()); records=a.get('files',a.get('readset',[]));
 if not records:
  records=next(v for v in a.values() if isinstance(v,list))
 authority={v['path']:leaf(Path(v['path'])) for v in records if isinstance(v,dict) and 'path' in v}
 for q in [E/'S6-provider-release.json',E/'S6-provider-sample.json',E/'S6-intent-resolution.json',E/'S6-supervisor-first-candidate-assignment.md',E/'S6-supervisor-fix-xy-assignment.md',E/'S6-fix-xy-event.json']:
  authority[str(q)]=leaf(q)
 for q in [C.parent/'Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md',C.parent/'Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md']:
  authority[str(q)]=leaf(q)
 union=J/'recovery-supplements/fix-xy-wiki-1/owned-paths.json'
 if not union.exists(): union=J/'recovery-supplements/first-wiki-1/owned-paths.json'
 if union.exists():
  for item in json.loads(union.read_text())['paths']:
   paths.add(item['path'] if isinstance(item,dict) else item)
  for q in json.loads(union.read_text())['authority_paths']: authority[q]=leaf(Path(q))
 for q in [J/'fix_xy_pre_restart_readback.mjs',J/'evidence/fix-xy-wiki-baseline-metadata.json',J/'fix-xy-neutral-change-accounting-v2.json',J/'fix-xy-final-review-assignment-3.md',J/'evidence/fix-xy-code-command-only.json',J/'evidence/fix-xy-wiki-command-only.json',J/'evidence/fix-xy-code-handoff-identity.json',J/'evidence/fix-xy-wiki-handoff-identity.json',J/'evidence/fix-xy-python-current-2-bindings.json',J/'evidence/fix-xy-python-pre2.json',J/'evidence/fix-xy-python-post2.json',J/'evidence/fix-xy-python-suite-current-2-command.json',J/'evidence/fix-xy-python-suite-current-2-stdout.log',J/'evidence/fix-xy-python-suite-current-2-stderr.log',J/'evidence/fix-xy-node17-current-bindings.json',J/'evidence/fix-xy-check-protection-comparison.json',J/'python_suite_bindings_v2.py',J/'python_suite_js_dependencies_v3.mjs',J/'evidence/fix-xy-python-js-closure-3-command.json']:
  authority[str(q)]=leaf(q)
 data={'at':now(),'actor':ACTOR,'target':m['target_commit'],'sources':m['source_commits'],'head':git('rev-parse','HEAD').decode().strip(),'branch':git('branch','--show-current').decode().strip(),'owned':{n:leaf(P/n)for n in sorted(paths)},'index_z_hex':git('ls-files','--stage','-z').hex(),'status_z_hex':git('status','--porcelain=v1','-z','--untracked-files=all').hex(),'authority':authority,'configuration':{str(J/'runtime-config-fix-xy.json'):leaf(J/'runtime-config-fix-xy.json')},'preparation':m['preparation'],'original_manifest':leaf(J/'recovery/manifest.json')}; p=save('evidence/'+label+'-identity.json',data); print(json.dumps({'path':p,'sha256':sha(Path(p).read_bytes()),'owned':len(paths)})); return data
if __name__=='__main__':
 if sys.argv[1]=='freeze': freeze(sys.argv[2])
 elif sys.argv[1]=='run':
  label=sys.argv[2]; cmd=sys.argv[3:]; start=now(); p=subprocess.run(cmd,cwd=C,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'),capture_output=True,text=True); loc=save('evidence/'+label+'-command.json',{'actor':ACTOR,'started':start,'finished':now(),'cwd':str(C),'command':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr}); print(json.dumps({'record':loc,'exit_code':p.returncode,'stdout':p.stdout[-1800:],'stderr':p.stderr[-1200:]})); sys.exit(p.returncode)
