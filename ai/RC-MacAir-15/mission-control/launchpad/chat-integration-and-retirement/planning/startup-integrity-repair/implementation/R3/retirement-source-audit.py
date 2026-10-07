from pathlib import Path
from datetime import datetime,timezone
import subprocess,json,hashlib
repo=Path('/Users/rccurtrightjr./projects/fs-dev');server=repo/'fusion-studio-server';out=Path(__file__).parent
literal=r'''require\(['"]chokidar['"]\)|from ['"]chokidar['"]|watch/core|watch/workspace-watcher|hotkey-screenshot-watcher|watch/calendar-watcher|abandonAll'''
argv=['rg','-n',literal,'lib','package.json'];sweep=subprocess.run(argv,cwd=server,text=True,capture_output=True);assert sweep.returncode==1 and not sweep.stdout and not sweep.stderr
matches=[]
for file in ('package.json','package-lock.json'):
 data=json.loads((server/file).read_text())
 for key in ('dependencies','devDependencies','optionalDependencies'):
  if 'chokidar' in data.get(key,{}):matches.append({'file':file,'section':key})
 if file.endswith('lock.json'):
  matches.extend({'file':file,'packageKey':key} for key in data.get('packages',{}) if key.endswith('/chokidar'))
assert not matches
retired=['lib/watch/core.js','lib/watch/workspace-watcher.js','lib/screenshot/hotkey-screenshot-watcher.js','lib/screenshot/source-folder-service.js','lib/watch/calendar-watcher.js']
assert all(not (server/f).exists() for f in retired)
sources=['lib/startup.js','lib/views/readiness-startup.js','lib/testing/isolated-provenance-runtime.js','lib/shutdown.js','lib/calendar/index.js','lib/calendar/google/poller.js','lib/screenshot/ws-handlers.js','lib/workspace/screenshot-service.js','lib/ws/file-save-route.js','lib/file-mutations/save-controller.js','lib/chat-metadata/collectors/file-mutations.js','lib/wire/canonical-chat-tool-events.js','lib/agent-provenance/fact-authority-repository.js','lib/ledger/event-ledger.js']
a={'checkedAt':datetime.now(timezone.utc).isoformat(),'sourceSweep':{'argv':argv,'cwd':str(server),'exit':sweep.returncode,'matches':[],'stderr':''},'packageInspection':{'exactCommand':'python3 implementation/R3/retirement-source-audit.py','commandCwd':str(out.parent.parent),'sourceScript':str(Path(__file__).resolve()),'files':['package.json','package-lock.json'],'sections':['dependencies','devDependencies','optionalDependencies','lock packages keys ending /chokidar'],'exit':0,'matches':matches},'retiredPaths':{f:{'exists':False} for f in retired},'requiredSources':{f:{'sha256':hashlib.sha256((server/f).read_bytes()).hexdigest()} for f in sources}}
(out/'retirement-source-sweep-current.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'status':'RETIREMENT_ABSENCE_PRESERVED','sweepExit':sweep.returncode,'dependencyMatches':matches,'retiredPaths':len(retired)}))
