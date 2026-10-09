import json, pathlib, hashlib, re, os, datetime, difflib
from zoneinfo import ZoneInfo
HOME=pathlib.Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
ROOT=pathlib.Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
OUT=HOME/'jobs/commit-supervisor/chat-ar-20261006/wiki-editor'
freeze=json.loads((OUT/'pre-edit-freeze.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
def recheck_sources():
 for f in freeze['sources']+freeze['deleted_source_absences']:
  p=ROOT/f['path']
  assert (not p.exists()) if f['kind']=='absent' else p.is_file() and sha(p.read_bytes())==f['sha256'], ('source drift',f['path'])
recheck_sources()
pre={p: (ROOT/p).read_bytes() for p in freeze['writable_pages']}
for f in freeze['pages']:
 if f['path'] in pre: assert sha(pre[f['path']])==f['sha256'], ('page drift',f['path'])
local=datetime.datetime.now(ZoneInfo('America/Los_Angeles'))
base=local.strftime('%Y-%m-%d-%H%M%S')
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'local_capture_timestamp':base,'local_timezone':'America/Los_Angeles','extension_authority':'Root explicit release allows actual-timestamp version leaves. These extend automatic-checkpoint deletion scope and require final root owned inventory/manual private-clone-only cleanup or abandonment; no source restore.','pages':[]}
for p,b in pre.items():
 q=ROOT/p; d=q.parent/'.versions'; name=base; suffix=0
 while (d/(name+'.md')).exists():
  suffix+=1; name=base+'-'+str(suffix).zfill(2)
 version=d/(name+'.md')
 assert not version.exists()
 receipt['pages'].append({'page':p,'preimage_sha256':sha(b),'preimage_bytes':len(b),'preimage_mode':oct(q.stat().st_mode&0o777),'version':str(version.relative_to(ROOT)),'version_preimage_kind':'absent','version_preimage_absence_verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
# Declare every exact version absence before creating any of the leaves.
(OUT/'version-extension-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
for entry in receipt['pages']:
 q=ROOT/entry['page']; version=ROOT/entry['version']; b=pre[entry['page']]
 assert q.read_bytes()==b
 version.parent.mkdir(exist_ok=True)
 fd=os.open(version,os.O_WRONLY|os.O_CREAT|os.O_EXCL,q.stat().st_mode&0o777)
 try:
  with os.fdopen(fd,'wb') as f: f.write(b); f.flush(); os.fsync(f.fileno())
  os.chmod(version,q.stat().st_mode&0o777)
 except BaseException: raise
 readback=version.read_bytes()
 assert readback==b and sha(readback)==entry['preimage_sha256']
 entry['version_readback_sha256']=sha(readback);entry['version_readback_bytes']=len(readback);entry['version_readback_mode']=oct(version.stat().st_mode&0o777);entry['preimage_preserved_before_replace']=True
 (OUT/'version-readback.json').write_text(json.dumps(receipt,indent=2)+'\n')

def stamp(t):
 utc=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
 front,body=t.split('\n---\n',1)
 lines=front.splitlines(); indices=[i for i,l in enumerate(lines) if re.match(r'^  last-modified:',l)]
 assert indices
 lines[indices[0]]='  last-modified: "'+utc+'"'
 for i in reversed(indices[1:]): del lines[i]
 return '\n'.join(lines)+'\n---\n'+body,utc

def add_sources(t,items):
 for s in items:
  line='    - '+s+'\n'
  if line not in t: t=t.replace('  source-files:\n','  source-files:\n'+line,1)
 return t

changed=[]
for e in receipt['pages']:
 p=e['page']; b=pre[p]; t=b.decode(); before=t
 if p.endswith('007-Chat_System/006-Runtime_Model/PAGE.md'):
  pass # stamp removes the repeated key; source list and body remain exact.
 elif p.endswith('004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md'):
  t=t.replace('description: App captures, macOS screenshot imports, optional CLI access, and storage limits.','description: Direct app captures, exact chat attachments, saved-image gallery, workspace previews, and storage limits.',1)
  old="In the desktop app, **Take screenshot** captures the focused Fusion Studio window. The server saves a PNG under the active workspace's `ai/<machine>/Data/Screenshots/`, and the current chat receives a pending file attachment. The Screenshots gallery lists image files from that workspace folder and can attach an existing one. Workspace preview images are separate: they capture the app panel on workspace changes and are stored as one PNG row per workspace in SQLite for the ribbon and carousel."
  new="In the desktop app, **Take screenshot** captures the focused Fusion Studio window. The capture controller snapshots the destination chat and socket before awaiting native capture, then sends `screenshot:file-capture` with that workspace and a request ID. The server validates the active workspace and saves a PNG under its `ai/<machine>/Data/Screenshots/`. Only the matching `screenshot:file-captured` response supplies the saved path for a pending attachment in that exact workspace and chat session; an unrelated response cannot attach a file.\n\nThe composer Add menu supplies its explicit workspace, view, Thread group, chat session and mounted-surface lifetime. The view's Main Chat follows its selected Thread group and current primary session. A Main Chat mounted as an explicit content component keeps its hydrated session independently of the outer thread rail. A Side Chat keeps its own session and open service-managed placement, so changing Main Chat selection cannot redirect its capture. The global header camera resolves the selected Main Chat in the active view; it falls back to the current Legacy session only when no qualified Main Chat is available.\n\nThe controller checks ownership before capture and again after native capture and saving. A workspace, owning-view, selected Main Chat or session change cancels attachment. Connected composers also cancel when they become inactive or unmount, or when their Side Chat placement closes. A content component retained in a hidden view cannot finish a capture for that view; switching away and back does not revive the old composer capture. Cancellation before the save request leaves no new saved file. Cancellation while the save is pending can leave the PNG in the workspace gallery, but it does not attach it to another chat.\n\nThe Screenshots gallery lists image files from the workspace folder and can attach an existing one. Workspace preview images are separate: they capture the app panel on workspace changes and are stored as one PNG row per workspace in SQLite for the ribbon and carousel."
  assert old in t;t=t.replace(old,new,1)
  t=add_sources(t,['fusion-studio-client/src/components/App.tsx','fusion-studio-client/src/components/chat/ChatComposerAddMenu.tsx','fusion-studio-client/src/components/chat/ConnectedChatComposer.tsx','fusion-studio-client/src/components/chat/ChatSurface.tsx','fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx','fusion-studio-client/src/state/slices/chatSurfaceSlice.ts','fusion-studio-client/src/lib/chat/side-chat-placements.ts','fusion-studio-client/src/state/chatFileLinkStore.ts'])
 elif p.endswith('007-Chat_System/004-Chat_UI/001-Composer/PAGE.md'):
  old="Screenshot capture snapshots `{workspaceId, threadId, surface}` before its\nfirst await and revalidates that owner after capture and save. If the chat\nchanges, the attachment is cancelled with a fixed safe status rather than\nbeing added to the new chat."
  new="The Add menu's **Take screenshot** action snapshots this composer's exact workspace, view, Thread group, chat session and mounted-surface lifetime before its first await. The view's Main Chat follows the selected Thread group and current primary session; an explicit Main content component keeps its hydrated session independently of the outer rail. A Side Chat keeps its own session and open service-managed placement when Main Chat selection changes.\n\nOwnership is checked before capture, after native capture and after the correlated saved-PNG response. A changed workspace, owning view, Main selection or session, an inactive or unmounted composer, or a closed Side Chat placement cancels attachment with a fixed safe status. Content components retained in a hidden view are cancelled too; returning to the same view or session does not revive that old capture. If saving has already begun, its PNG can remain in the gallery, but no attachment is added to another chat. The global header camera has its own Main Chat/Legacy resolution; [Screenshot Capture](../../../004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md#in-app-captures-and-attachments) owns that behavior and the separate gallery and workspace-preview paths."
  assert old in t;t=t.replace(old,new,1)
  t=add_sources(t,['fusion-studio-client/src/components/chat/ChatComposerAddMenu.tsx','fusion-studio-client/src/components/chat/ChatSurface.tsx','fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx','fusion-studio-client/src/state/slices/chatSurfaceSlice.ts','fusion-studio-client/src/lib/chat/side-chat-placements.ts'])
 elif p.endswith('010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md'):
  generated=pathlib.Path('/private/tmp/chat-ar-integration-r6pe5gmi/wiki-navigation/Wiki/010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md').read_text()
  assert sha(generated.encode())==freeze['navigation_input']['page_sha256']
  markers=r'<!-- section-toc:start -->.*?<!-- section-toc:end -->'
  old=re.search(markers,t,re.S).group();new=re.search(markers,generated,re.S).group()
  delta=[l for l in difflib.ndiff(old.splitlines(),new.splitlines()) if l.startswith(('- ','+ '))]
  assert len(delta)==4 and all(('Change Storm Control' in l or 'Structure]' in l) for l in delta),delta
  t=t.replace(old,new,1)
 elif p.endswith('010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md'):
  line='    - fusion-studio-server/lib/event-bus.js\n';assert t.count(line)==2
  at=t.find(line);t=t[:at]+t[at:].replace(line,'',1)
 else: raise AssertionError(p)
 t,utc=stamp(t)
 assert t!=before
 if p.endswith(('007-Chat_System/006-Runtime_Model/PAGE.md','010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md')):
  assert t.split('\n---\n',1)[1]==before.split('\n---\n',1)[1]
 # Immediate exact page/source reread after full preimage capture, before replacement.
 recheck_sources();assert (ROOT/p).read_bytes()==b;assert (ROOT/e['version']).read_bytes()==b
 (ROOT/p).write_bytes(t.encode())
 actual=(ROOT/p).read_bytes();assert actual==t.encode()
 e['last_modified']=utc;e['final_sha256']=sha(actual);e['final_bytes']=len(actual);e['final_mode']=oct((ROOT/p).stat().st_mode&0o777)
 changed.append(p)
 (OUT/'edit-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 (OUT/(pathlib.Path(p).parent.name+'-edit.patch')).write_text(''.join(difflib.unified_diff(before.splitlines(True),t.splitlines(True),fromfile=p+' before',tofile=p+' after')))
print(json.dumps({'edited':changed,'versions':[e['version'] for e in receipt['pages']],'receipt':str(OUT/'edit-receipt.json')}))
