# Documentation evidence only: reads files and Git metadata; never imports application modules.
from pathlib import Path
import json,hashlib,datetime,re,subprocess
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
paths=set()
manifest=json.loads((C/'S02-CHANGE-MANIFEST.json').read_text())
for r in manifest['pages']:
 txt=Path(r['path']).read_text().split('  source-files:',1)[1].split('  connected-skills:',1)[0]
 paths.update(re.findall(r'    - (.+)',txt))
paths.update('fusion-studio-server/lib/'+p for p in '''db.js event-registry/repository.js event-registry/canonical-json.js event-registry/schema-validator.js event-registry/capability-catalog.js event-registry/seed-catalog.js subscriptions/handler-catalog.js subscriptions/host-bootstrap.js subscriptions/file-provenance-bootstrap.js subscriptions/handlers/agent-provenance-ledger.js subscriptions/handlers/agent-resource-observer.js subscriptions/handlers/resource-render-projection.js file-mutations/durable-reservations.js file-mutations/save-owner.js file-mutations/file-operation-repository.js file-mutations/file-version-repository.js file-mutations/stable-resource-repository.js file-mutations/sqlite-contention.js agent-provenance/activity-owner.js agent-provenance/activity-repository.js agent-provenance/checkpoint-repository.js agent-provenance/observation-job-repository.js agent-provenance/exchange-bind-repository.js agent-provenance/renderer-projection-job-repository.js agent-provenance/renderer-projection-authority.js agent-provenance/renderer-projection-scheduler.js ws/resource-projection-publisher.js ws/file-save-route.js watch/workspace-watcher.js chat-metadata/collectors/file-mutations.js'''.split())
paths.update('fusion-studio-client/'+p for p in ['src/lib/ws/file-handlers.ts','src/state/fileDataStore.ts','src/components/file-explorer/FileViewer.tsx','src/lib/save-action-context.ts','src/components/ContentArea.tsx','src/components/view-tabs/ViewTabBar.tsx','src/components/view-tabs/viewTabAdapters.ts','src/components/view-tabs/fileConnectedAdapter.ts','src/components/file-explorer/FileDocumentPresenter.tsx'])
paths.update('fusion-studio-server/test/'+p for p in ['subscriptions/admission.test.js','subscriptions/controller.test.js','subscriptions/compatibility.test.js','event-registry/seed-reconciliation.test.js','ledger/resource-provenance-repository.test.js','ledger/event-ledger.test.js','agent-provenance/fact-authority-and-ledger.test.js','resources/save-controller.test.js'])
files=[]
for p in sorted(paths):
 lines=Path(p).read_text().splitlines();anchors=[]
 for i,line in enumerate(lines,1):
  if re.search(r'(^|\s)(async )?function |CREATE TABLE|createTable\(|test\(|STATIC_PUBLISHERS|SYSTEM_SCHEMA_SEEDS|SOURCE_DEFINITIONS|BATCH_LIMIT|STARTUP_BUDGET_MS|REQUIRED_ACK_TIMEOUT_MS|RETRY_DELAYS|LEASE_MS|handleResourceChanged:|handleResourceRefreshRequired:',line):anchors.append({'line':i,'text':line.strip()})
 if p.endswith('.json'):anchors=[{'line':i,'text':line.strip()} for i,line in enumerate(lines,1) if '"required"' in line or '"$id"' in line or '"const"' in line]
 files.append({'path':p,'sha256':sha(p),'line_count':len(lines),'evidence':'test asserted, not rerun' if '/test/' in p else 'source inspected for bounded S02 claims','anchors':anchors})
commands=[]
for argv in [
 ['git','rev-parse','--show-toplevel'],['git','rev-parse','HEAD'],['git','for-each-ref','--format=%(refname) %(objectname)'],['git','status','--short'],
 ['rg','-n','resource:invalidate|ledger_events|PreparedCanonicalCandidate|prepareCanonicalCandidate|AcceptedCanonicalRef|loadAcceptedLedgerRowRef|publishCanonical','fusion-studio-server/lib','fusion-studio-client/src'],
 ['rg','-n','STATIC_PUBLISHERS|producerId:|schemaKey:|preDispatchCommit','fusion-studio-server/lib/subscriptions/admission.js'],
 ['rg','-n','createTable|CREATE TABLE','fusion-studio-server/lib/db/migrations/029_event_ledger.js','fusion-studio-server/lib/db/migrations/034_event_registry_authority.js','fusion-studio-server/lib/db/migrations/035_file_provenance.js','fusion-studio-server/lib/db/migrations/036_agent_tool_provenance.js'],
 ['rg','-n','file.command_accepted|resource.mutated|agent.tool_completed|resource.state_observed','fusion-studio-server/lib/event-registry/filter.js','fusion-studio-server/lib/event-registry/subscription-seed-catalog.js','fusion-studio-server/lib/ledger','fusion-studio-server/lib/agent-provenance/agent-ledger-repository.js'],
 ['rg','-n','emit\(|file:changed|thread:state_changed|workspace:switched','fusion-studio-server/lib/watch/workspace-watcher.js','fusion-studio-server/lib/thread/lifecycle-controller.js','fusion-studio-server/lib/workspace','fusion-studio-server/lib/wire/canonical-chat-event-applier.js'],
 ['rg','-n','emit\(|file:changed|thread:state_changed|workspace:switched','fusion-studio-server/lib/watch/workspace-watcher.js','fusion-studio-server/lib/thread/thread-lifecycle-controller.js','fusion-studio-server/lib/workspace','fusion-studio-server/lib/wire/canonical-chat-event-applier.js']
]:
 r=subprocess.run(argv,text=True,capture_output=True);commands.append({'at':datetime.datetime.now().astimezone().isoformat(),'command':argv,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
base=json.loads((C/'EXECUTION-BASELINE.json').read_text());prior=base['source_test_hashes'];prior={r['path']:r['sha256'] for r in prior} if isinstance(prior,list) else prior
drift=[p for p in paths if p in prior and (prior[p].get('sha256') if isinstance(prior[p],dict) else prior[p])!=sha(p)]
out={'at':datetime.datetime.now().astimezone().isoformat(),'candidate':'PW01-f24d5cd427b9ca14','head':commands[1]['stdout'].strip(),'files':files,'commands':commands,'source_drift_from_S00':drift,'ref_drift_from_S00':dict(line.split(' ',1) for line in commands[2]['stdout'].splitlines())!={r['ref']:r['commit'] for r in base['refs']},'relevant_ref_drift':{k:v for k,v in dict(line.split(' ',1) for line in commands[2]['stdout'].splitlines()).items() if k.startswith(('refs/heads/','refs/remotes/','refs/tags/'))}!={r['ref']:r['commit'] for r in base['refs'] if r['ref'].startswith(('refs/heads/','refs/remotes/','refs/tags/'))},'scope':'Read-only source/static test assertions. No runtime, live DB, test execution, fetch, or app operation.'}
(C/'S02-SOURCE-EVIDENCE.json').write_text(json.dumps(out,indent=2)+'\n')
print('Source records',len(files),'drift',drift)
print('Command results',[(x['command'][:3],x['exit']) for x in commands])
