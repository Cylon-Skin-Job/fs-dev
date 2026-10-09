from pathlib import Path
import sys,json,hashlib,os
C=Path.cwd(); P=Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate'); J=C/'jobs/commit-supervisor/rehearsal-20261004-s6'
sys.path.insert(0,str(C/'.agents/skills/mc-commit-supervisor/scripts'))
from snapshot_state import relevant_state,worktree,ref_state
m_path=J/'fixed-candidates/first/recovery/manifest.json'; m=json.loads(m_path.read_bytes())
assigned=[f'rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/{n}' for n in ['checklist-controller.js','checklist-view.js','index.html','checklist.css']]
now=relevant_state(P,m['owned'],m['protected_repos'])
before=m['baseline']
assert now['refs']==before['refs']
assert now['protected']==before['protected']
deltas={k:{'before':before['paths'].get(k),'after':now['paths'].get(k)} for k in set(before['paths'])|set(now['paths']) if before['paths'].get(k)!=now['paths'].get(k)}
assert set(deltas)==set(assigned),list(deltas)
for d in deltas.values():
 assert d['before']['index']==d['after']['index']
 assert d['before']['flag']==d['after']['flag']
 assert d['before']['worktree']['mode']==d['after']['worktree']['mode']
suite=json.loads((J/'evidence/first-unaffected-suite-reuse.json').read_bytes());matches=[]
for item in suite['dependencies']:
 p=Path(item['path']); actual={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':oct(p.stat().st_mode)}
 assert actual['sha256']==item['sha256'] and actual['mode']==item['mode'],item['path']
 matches.append({'path':str(p),**actual})
identity=json.loads((J/'evidence/fix-xy-entry-identity.json').read_bytes())
authorities={}
for name, expected in identity['authority'].items():
 p=Path(name)
 if not p.exists(): actual={'exists':False}
 else:
  data=os.readlink(p).encode() if p.is_symlink() else p.read_bytes()
  actual={'exists':True,'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(p.lstat().st_mode),'kind':'symlink' if p.is_symlink() else 'file'}
 assert actual==expected,name
 authorities[name]=actual
print(json.dumps({'candidate_inventory_count':len(now['paths']),'deltas':deltas,'refs':now['refs'],'protected':now['protected'],'suite_dependencies_matching':matches,'authority_matching':authorities,'fixed_manifest_sha256':hashlib.sha256(m_path.read_bytes()).hexdigest(),'original_manifest_sha256':hashlib.sha256((J/'recovery/manifest.json').read_bytes()).hexdigest()},indent=2))

