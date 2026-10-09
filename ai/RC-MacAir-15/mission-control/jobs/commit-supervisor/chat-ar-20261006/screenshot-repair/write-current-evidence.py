from pathlib import Path
from datetime import datetime, timezone
import subprocess, os, json, hashlib
CONTROLLER=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
JOB=CONTROLLER/'jobs/commit-supervisor/chat-ar-20261006'
OUT=JOB/'screenshot-repair'
CANDIDATE=Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
SOURCE=Path('/Users/rccurtrightjr./projects/fs-dev')
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def digest(p):
 return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def git(root,*args):
 return subprocess.check_output(['git',*args],cwd=root,env=env).decode().strip()
def gitpath(root,name):
 p=Path(git(root,'rev-parse','--git-path',name))
 return p if p.is_absolute() else root/p
names=['screenshot-repair','bounded-corrections-recovery','side-placement-recovery','side-rail-recovery','component-fixture-preimage']
owned={};recoveries=[]
for name in names:
 p=JOB/name/'recovery/manifest.json';m=json.loads(p.read_text())
 recoveries.append({'job':str(p.parent.parent),'manifest':str(p),'sha256':digest(p),'capturedAt':m['captured_at']})
 for path,row in m['owned'].items():
  if path.startswith('fusion-studio-client/'):
   owned.setdefault(path,{'recoveryJob':name,'preimage':row})
rows=[]
for path,raw in sorted(owned.items()):
 pre=raw['preimage'];index=[]
 for line in git(CANDIDATE,'ls-files','--stage','--',path).splitlines():
  if not line: continue
  mode,oid,stage=line.split('\t',1)[0].split()
  index.append({'mode':mode,'oid':oid,'stage':int(stage)})
 orig=[{k:r[k] for k in ('mode','oid','stage')} for r in pre['index']]
 h=digest(CANDIDATE/path); source=digest(SOURCE/path); prev=pre['worktree'].get('sha256')
 rows.append({'path':path,'currentSha256':h,'bytes':(CANDIDATE/path).stat().st_size,'lines':len((CANDIDATE/path).read_text().splitlines()),'preimageJob':raw['recoveryJob'],'preimageSha256':prev,'jobCreated':pre['job_created'],'changedByRepair':h!=prev,'sourceSha256':source,'sourceMatchesPreimage':source==prev,'indexUnchanged':index==orig,'index':index})
first=json.loads((OUT/'recovery/manifest.json').read_text())
latest=json.loads((JOB/'retained-view-correction-preimage/recovery/manifest.json').read_text())
refs=[]
for row in first['source_commits']:
 current=git(Path(row['repo']),'rev-parse',row['ref']);refs.append({**row,'currentCommit':current,'matches':current==row['commit']})
identities={}
for label,root in [('source',SOURCE),('candidate',CANDIDATE)]:
 base=first['baseline']['protected'][str(SOURCE)] if label=='source' else latest['baseline']['refs']
 identities[label]={'root':git(root,'rev-parse','--show-toplevel'),'branch':git(root,'symbolic-ref','HEAD'),'head':git(root,'rev-parse','HEAD'),'gitDir':git(root,'rev-parse','--absolute-git-dir'),'indexSha256':digest(gitpath(root,'index')),'baselineIndexSha256':base['index_file_sha256'],'indexMatchesBaseline':digest(gitpath(root,'index'))==base['index_file_sha256']}
deps=['src/components/App.tsx','src/components/App.css','src/components/WorkspacePanel.tsx','src/components/ContentArea.tsx','src/components/chat/ViewChatHost.tsx','src/components/chat/useChatSessionHost.ts','src/components/chat/useViewChatHost.ts','src/components/chat/useChatSessionActions.ts','src/components/chat/chatSurfaceRegistrationContract.ts','src/state/panelStore.ts','src/state/slices/chatSurfaceSlice.ts','src/state/slices/worksurfaceSlice.ts','src/state/chatFileLinkStore.ts','src/lib/ws/thread-handlers.ts','src/lib/ws/thread-history.ts','src/lib/ws/product-send.ts','src/components/view-tabs/ViewTabBar.tsx','src/components/view-tabs/ComponentTabPanel.tsx','src/components/view-tabs/componentTabResolver.ts','playwright.chat-architecture.config.ts','e2e/chat-transport-test-server.mjs','e2e/worksurface-harness.ts','package.json','package-lock.json']
dependencies=[]
for path in deps:
 rel='fusion-studio-client/'+path
 dependencies.append({'path':rel,'candidateSha256':digest(CANDIDATE/rel),'sourceSha256':digest(SOURCE/rel),'sameAsSource':digest(CANDIDATE/rel)==digest(SOURCE/rel)})
authorities=[CONTROLLER/'session-contract.md', CONTROLLER/'.agents/skills/mc-commit-repair-worker/SKILL.md', CONTROLLER/'.agents/skills/mc-commit-supervisor/references/workflow.md', CONTROLLER/'.agents/skills/mc-spec-review-gate/SKILL.md', JOB/'assignment.md', JOB/'initial-review/IR-CHAT-001-repair-packet.md', JOB/'initial-review/screenshot-owner-validation.json', JOB/'initial-review/screenshot-owner-candidate-dependencies.json', CONTROLLER/'launchpad/chat-integration-and-retirement/planning/chokidar-retirement-and-harness-launch/spec/SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md', CONTROLLER/'launchpad/chat-integration-and-retirement/planning/startup-integrity-repair/SPEC-01-STARTUP-INTEGRITY-REPAIR.md',SOURCE/'AGENTS.md',CANDIDATE/'AGENTS.md']
authorities += list((SOURCE/'ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards').glob('*/PAGE.md'))
authorities += [SOURCE/'ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md', SOURCE/'ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md', SOURCE/'ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/001-Composer/PAGE.md', SOURCE/'ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md', JOB/'screenshot-handoff-01/review.raw.md']
result={'at':datetime.now(timezone.utc).isoformat(),'state':'current bounded repair bytes; manager handoff review pending','worker':'/root/screenshot_repair','manager':'/root','controllerHome':str(CONTROLLER),'implementation':str(CANDIDATE),'acceptedTarget':'3356e1b73cc5d44028eac5baa02fd542a8bbc385','initialStagedTreeManagerRecord':'44b2592705cdbc35620207e579113ede27a4a787','identities':identities,'sourceRefs':refs,'allSourceProductRefsUnchanged':all(r['matches'] for r in refs),'allOwnedSourceBytesUnchanged':all(r['sourceMatchesPreimage'] for r in rows),'allOwnedCandidateIndexEntriesUnchanged':all(r['indexUnchanged'] for r in rows),'changedLeafCount':sum(r['changedByRepair'] for r in rows),'ownedLeafCount':len(rows),'files':rows,'unchangedDependencies':dependencies,'authorities':[{'path':str(p),'sha256':digest(p)} for p in authorities],'preimageManifests':recoveries,'retainedViewCorrectionManifestSha256':digest(JOB/'retained-view-correction-preimage/recovery/manifest.json'),'recoveryLimits':'File/base/index preimages only, not app/profile/database/provider/runtime recovery. No source product writes, index staging, commit or ref movement by worker. Full refs hash may drift from reserved Codex host checkpoint refs; product refs are compared explicitly.'}
(OUT/'current-byte-evidence.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['changedLeafCount','ownedLeafCount','allSourceProductRefsUnchanged','allOwnedSourceBytesUnchanged','allOwnedCandidateIndexEntriesUnchanged']}))
print(json.dumps(identities,indent=2))
