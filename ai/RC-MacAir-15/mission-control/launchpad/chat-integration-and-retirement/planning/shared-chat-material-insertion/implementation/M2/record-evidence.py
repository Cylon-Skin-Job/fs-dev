#!/usr/bin/env python3
"""Bind M2 candidate and M1 preimages without changing product files."""
import datetime,difflib,hashlib,json,os,subprocess
from pathlib import Path
here=Path(__file__).resolve().parent
root=Path('/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev')
controller=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
package=here.parent.parent
start=json.loads((here/'START.json').read_text())
def git(*args): return subprocess.check_output(['git','-C',str(root),*args],text=True)
def sha(data):return hashlib.sha256(data).hexdigest()
names=set(git('diff','--name-only','HEAD').splitlines())|set(git('ls-files','--others','--exclude-standard','--full-name').splitlines())
files={};changes={};patch=[]
for name in sorted(names):
 p=root/name
 if p.is_symlink():files[name]={'symlink':os.readlink(p),'resolved':str(p.resolve()),'exists':p.exists()};continue
 if not p.is_file():files[name]={'absent':True};continue
 data=p.read_bytes();files[name]={'sha256':sha(data),'bytes':len(data),'mode':oct(p.stat().st_mode & 0o777)}
 base=here/'baseline'/name
 if name in start['files'] and base.exists(): old=base.read_bytes(); origin='M1 accepted pre-M2 working bytes'
 else:
  prior=subprocess.run(['git','-C',str(root),'show',f'HEAD:{name}'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
  old=prior.stdout if prior.returncode==0 else b'';origin='baseline HEAD' if prior.returncode==0 else 'new M2 file'
 if old!=data:
  changes[name]={'baseline':origin,'before_sha256':sha(old),'after_sha256':sha(data),'line_count':len(data.splitlines())}
  patch.extend(difflib.unified_diff(old.decode().splitlines(True),data.decode().splitlines(True),fromfile='pre-M2/'+name,tofile='M2/'+name))
(here/'M2-slice.patch').write_text(''.join(patch))
authorities=[package/'SPEC.md',package/'TICKET.md',package/'OWNER-REQUEST.md',package/'OWNER-APPROVAL.md',here.parent/'M2-DISPATCH.md',here.parent/'M1/ACCEPTANCE.json',controller/'session-contract.md',controller/'.agents/skills/mc-spec-slice-builder/SKILL.md',controller/'.agents/skills/mc-spec-review-gate/SKILL.md',root/'AGENTS.md']
wiki=controller.parent/'Wiki'
for relative in ['000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md','007-Chat_System/000-Overview_and_References/PAGE.md','007-Chat_System/001-Identity_And_Persistence/PAGE.md','007-Chat_System/004-Chat_UI/001-Composer/PAGE.md','007-Chat_System/005-Testing_And_Operations/PAGE.md','004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md','010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md','010-Events_And_Ledger/003-Provenance_Model/PAGE.md','010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md','010-Events_And_Ledger/011-UI_Action_Provenance_Module/001-Wiki_Viewer_UI_Context/PAGE.md','010-Events_And_Ledger/011-UI_Action_Provenance_Module/002-File_Viewer_UI_Context/PAGE.md']:
 authorities.append(wiki/relative)
for directory in ['000-Code_Standards','001-Architecture_Routing','002-Frontend_UI','003-State_Management','004-WebSocket_Protocol','005-Universal_Event_Bus','007-Persistence_And_Metadata','008-Testing_And_Smoke_Slices']:
 authorities.append(wiki/'005-Enforcement/001-Code_Standards'/directory/'PAGE.md')
auth={str(p):{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} if p.is_file() else {'absent':True} for p in authorities}
checks=[]
for path in sorted((here/'checks').glob('*.json')):
 r=json.loads(path.read_text());checks.append({'receipt':str(path),'sha256':sha(path.read_bytes()),'exit_code':r.get('exit_code'),'started':r.get('started'),'ended':r.get('ended'),'command':r.get('command'),'log':r.get('log'),'log_sha256':r.get('log_sha256')})
r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'head':git('rev-parse','HEAD').strip(),'branch':git('branch','--show-current').strip(),'status':git('status','--porcelain=v1'),'files':files,'M2_changes':changes,'M1_files_preserved_without_M2_edits':sorted(set(start['files'])-set(changes)),'M2_patch_sha256':sha((here/'M2-slice.patch').read_bytes()),'authorities':auth,'checks':checks}
(here/'SOURCE-SEAL.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({'M2_changed':len(changes),'all_dirty':len(files),'absent_authorities':[p for p,v in auth.items() if v.get('absent')]}))
