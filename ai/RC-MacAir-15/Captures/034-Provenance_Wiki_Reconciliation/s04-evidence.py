"""Read-only source inventory; writes documentation receipts only, not an acceptance test."""
from pathlib import Path
from datetime import datetime
import hashlib,json,re,subprocess
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
manifest=json.loads((C/'S04-CHANGE-MANIFEST.json').read_text())
paths=set()
for row in manifest['pages']:
 paths.update(re.findall(r'^    - (fusion-studio-.+)$',Path(row['path']).read_text(),re.M))
paths.update('fusion-studio-server/lib/'+p for p in ['agent-provenance/turn-authority.js','agent-provenance/bounded-canonical-hash.js','agent-provenance/observation-job-repository.js','agent-provenance/fact-authority-repository.js','agent-provenance/exchange-binder.js','agent-provenance/agent-ledger-reconciler.js','agent-provenance/renderer-projection-scheduler.js','ws/workspace-session.js','ledger/provenance-query-paths.js','subscriptions/admission.js'])
paths.update('fusion-studio-client/src/'+p for p in ['lib/ws/workspace-handlers.ts','components/file-explorer/FileViewer.tsx','components/file-explorer/FileDocumentPresenter.tsx'])
# Find exact current presenter owner rather than guessing its directory.
paths={p for p in paths if not p.endswith('/FileDocumentPresenter.tsx')}
paths.update(str(p) for p in Path('fusion-studio-client/src').rglob('FileDocumentPresenter.tsx'))
paths.update('fusion-studio-server/test/agent-provenance/'+p+'.test.js' for p in ['activity-owner','candidates-and-activity','jobs-and-checkpoints','resource-observer','exchange-bind-and-query','exchange-binder','announced-activity-reconciler','renderer-projection-runtime'])
paths.update(str(p) for p in Path('ai/RC-MacAir-15/Wiki/000-Wiki_Guidance').glob('*/PAGE.md'))
paths.update(['ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md','ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md','ai/RC-MacAir-15/Captures/024-Agent-Tool-Provenance/DECISIONS.md','ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/DECISIONS.md','ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/RELEASE-MANIFEST.md','ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md'])
base={r['path']:r['sha256'] for r in json.loads((C/'EXECUTION-BASELINE.json').read_text())['source_test_hashes']}
pattern=re.compile(r'function |async \w+\(|test\(|test.each|tool_snapshot|terminalSnapshot|secure_open_unavailable|agent_exchange_bind_jobs|agent:activity|resource:provenance|queryResourceProvenance|resource:changed|handleResource|applyTargeted|fact_admission_state|MAX_|\.start\(|ATP-D1[567]|BRIDGE-02 APPROVED|last-modified|source-files')
files=[]
for p in sorted(paths):
 b=Path(p).read_bytes(); lines=b.decode().splitlines(); digest=hashlib.sha256(b).hexdigest()
 files.append({'path':p,'sha256':digest,'line_count':len(lines),'evidence':'test asserted, not rerun' if '/test/' in p else 'source/authority inspected for bounded S04 claims','s00_sha256':base.get(p),'unchanged_from_s00':None if p not in base else base[p]==digest,'anchors':[{'line':i,'text':s} for i,s in enumerate(lines,1) if pattern.search(s)]})
commands=[]
for args in [
 ['git','rev-parse','--show-toplevel'],['git','rev-parse','HEAD'],['git','status','--short'],
 ['rg','-n','queryResourceProvenance|agent:activity|resource:provenance','fusion-studio-client/src'],
 ['rg','-n','enableSyntheticIncrementalProvenance','fusion-studio-server/lib'],
 ['rg','-n','createAgentTurnAuthorityRef|bindingAuthorityFor|installAgentExchangeBinding','fusion-studio-server/lib'],
 ['rg','-n','agent:activity:query|resource:provenance:query','fusion-studio-server/lib/ws/client-message-router.js'],
 ['rg','-n','FileDocumentPresenter|FileViewer|useFileDataStore','fusion-studio-client/src'],
]:
 r=subprocess.run(args,text=True,capture_output=True); commands.append({'command':args,'at':datetime.now().astimezone().isoformat(),'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
(C/'S04-SOURCE-EVIDENCE.json').write_text(json.dumps({'at':datetime.now().astimezone().isoformat(),'candidate':'PW01-f24d5cd427b9ca14','files':files,'commands':commands,'limits':'Source inspection only. No application modules imported or executed, tests/builds/runtime not run. S02/S03 evidence reused for admission and renderer mounting outside changed claims.'},indent=2)+'\n')
print('Recorded',len(files),'source/test/authority files;',len(commands),'read-only commands')
