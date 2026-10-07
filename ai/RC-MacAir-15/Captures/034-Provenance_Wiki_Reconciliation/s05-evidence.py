"""Read-only source discovery; writes documentation evidence only."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,re,subprocess
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
manifest=json.loads((C/'S05-CHANGE-MANIFEST.json').read_text())
paths=set()
for row in manifest['pages']:
 paths.update(re.findall(r'^    - (fusion-studio-.*)$',Path(row['path']).read_text(),re.M))
paths.update('fusion-studio-server/lib/'+p for p in ['ws/client-message-router.js','event-registry/subscription-seed-catalog.js','subscriptions/controller.js','triggers/hold-registry.js','ledger/event-ledger.js','file-mutations/save-controller.js'])
paths.update('fusion-studio-client/src/'+p for p in ['components/office/OfficeDocumentPage.tsx','components/email/EmailDocumentPage.tsx','components/documentSaveAcknowledgement.ts','state/chatFileLinkStore.ts','lib/ws/workspace-handlers.ts'])
paths.update('fusion-studio-server/test/'+p for p in ['resources/reported-ui-context.test.js','ws/file-save-route.test.js','triggers/trigger-loader.test.js','triggers/cron-scheduler.test.js','ws/resource-provenance-route.test.js','ws/agent-activity-route.test.js'])
paths.update(['fusion-studio-client/e2e/component-action-context-source.spec.ts','fusion-studio-client/e2e/resource-provenance-protocol-source.spec.ts'])
paths.update(str(p) for p in Path('ai/RC-MacAir-15/Wiki/000-Wiki_Guidance').rglob('PAGE.md') if '.versions' not in p.parts)
paths.update('ai/RC-MacAir-15/Captures/'+p for p in ['008-Provenance-Temp/34-ui-action-provenance-module.md','008-Provenance-Temp/37-automation-trigger-scheduler-provenance.md','008-Provenance-Temp/38-audit-query-review-provenance-loops.md','008-Provenance-Temp/39-change-storm-control-compaction.md','008-Provenance-Temp/provenance-schema-findings.md','023-MVP-Provenance-Subscriptions/DECISIONS.md','023-MVP-Provenance-Subscriptions/RELEASE-MANIFEST.md','024-Agent-Tool-Provenance/DECISIONS.md','024-Agent-Tool-Provenance/RELEASE-MANIFEST.md','002-SPECs/TABS-PROVENANCE-BRIDGE/DECISIONS.md','002-SPECs/TABS-PROVENANCE-BRIDGE/RELEASE-MANIFEST.md','030-Plugin_System/decisions.md','032-Plugin_Backend/backend-architecture.md'])
base={r['path']:r['sha256'] for r in json.loads((C/'EXECUTION-BASELINE.json').read_text())['source_test_hashes']}
pattern=re.compile(r'function |test\(|const .*SEED|reportedUiContext|runId|automation.kind|AUT-D0|BRG-D|MVP-D1[467]|ATP-D1[567]|PLUG-D012|source-files|last-modified|queryResourceProvenance|ui.action|file.command_accepted|resource.mutated|agent.tool_completed|resource.state_observed')
files=[]
for p in sorted(paths):
 b=Path(p).read_bytes(); lines=b.decode().splitlines(); digest=hashlib.sha256(b).hexdigest()
 files.append({'path':p,'sha256':digest,'line_count':len(lines),'evidence':'test assertions inspected, not rerun' if '/test/' in p or '/e2e/' in p else 'bounded source/authority inspection','s00_sha256':base.get(p),'unchanged_from_s00':None if p not in base else base[p]==digest,'anchors':[{'line':i,'text':s} for i,s in enumerate(lines,1) if pattern.search(s)]})
commands=[]
for args in [
 ['git','rev-parse','--show-toplevel'],['git','rev-parse','HEAD'],['git','status','--short'],
 ['rg','-n','uiActionSeed|ui\\.action|chat.send_with_resource|changeStorm|automation\\.runId','fusion-studio-client/src','fusion-studio-server/lib'],
 ['rg','-n','queryResourceProvenance|agent:activity|resource:provenance','fusion-studio-client/src'],
 ['rg','-n','readSaveActionContext|saveFile\\(','fusion-studio-client/src'],
 ['rg','-n','loadTriggers|createCronScheduler|_autoHold|runId','fusion-studio-server/lib/startup.js','fusion-studio-server/lib/triggers','fusion-studio-server/lib/runner','fusion-studio-server/lib/watcher'],
 ['rg','-n','CHAT_ACTION_EVENT|pendingAttachmentsByOwner|sendMessage\\(|type: .prompt.','fusion-studio-client/src/components/chat/useLegacyChatHost.ts','fusion-studio-client/src/state/slices/chatSlice.ts','fusion-studio-client/src/components/SendToChatButton.tsx'],
]:
 r=subprocess.run(args,text=True,capture_output=True);commands.append({'command':args,'at':datetime.now(timezone.utc).isoformat(),'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
(C/'S05-SOURCE-EVIDENCE.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'candidate':'PW01-f24d5cd427b9ca14','files':files,'commands':commands,'limits':'No product module execution, runtime, app, DB, build or tests. Hashes identify bounded inspected owners, not whole-module certification.'},indent=2)+'\n')
print('Recorded',len(files),'source/test/authority identities and',len(commands),'commands')
