# Documentation evidence only; reads source/test text and Git metadata, never imports app modules.
from pathlib import Path
import json,hashlib,datetime,re,subprocess
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
paths=set()
manifest=json.loads((C/'S03-CHANGE-MANIFEST.json').read_text())
for r in manifest['pages']:
 txt=Path(r['path']).read_text().split('  source-files:',1)[1].split('  connected-skills:',1)[0]
 paths.update(re.findall(r'    - (.+)',txt))
paths.update('fusion-studio-server/lib/'+p for p in '''startup.js event-registry/subscription-seed-catalog.js subscriptions/admission.js subscriptions/controller.js subscriptions/capability-factory.js subscriptions/file-provenance-bootstrap.js file-mutations/save-owner.js file-mutations/durable-reservations.js ledger/provenance-ledger-handler.js ledger/provenance-query-paths.js ws/file-viewer-read-route.js ws/workspace-request-handlers.js watch/workspace-watcher.js views/protected-path-policy.js'''.split())
paths.update('fusion-studio-client/'+p for p in '''src/lib/ws-client.ts src/lib/ws/workspace-handlers.ts src/lib/ws/file-save-protocol.ts src/components/file-explorer/FileContentRenderer.tsx src/components/file-explorer/FileExplorer.tsx src/components/view-tabs/fileConnectedTabs.ts'''.split())
paths.update('fusion-studio-server/test/'+p for p in '''ws/file-save-route.test.js ws/resource-projection-publisher.test.js ws/resource-provenance-route.test.js resources/save-controller.test.js resources/path-authority-and-atomic-writer.test.js resources/reconciliation.test.js resources/reported-ui-context.test.js resources/file-provenance-integration.test.js ledger/resource-provenance-repository.test.js subscriptions/resource-render-projection-handler.test.js'''.split())
paths.update('fusion-studio-client/'+p for p in '''e2e/provenance/file-viewer-live-resource.spec.ts e2e/file-save-protocol-source.spec.ts e2e/agent-resource-projection-source.spec.ts e2e/resource-provenance-protocol-source.spec.ts'''.split())
files=[]
for p in sorted(paths):
 lines=Path(p).read_text().splitlines()
 anchors=[{'line':i,'text':line.strip()} for i,line in enumerate(lines,1) if re.search(r'function |createTable\(|test\(|handleSave|saveFile:|applyTargetedProjection:|beginWorkspaceGeneration:|case .resource:|causation_id|correlation_id|reportedUiContext|MAX_SNAPSHOT_BYTES',line)]
 files.append({'path':p,'sha256':sha(p),'line_count':len(lines),'evidence':'test assertions inspected selectively; not rerun' if '/test/' in p or '/e2e/' in p else 'source inspected for bounded S03 claims','anchors':anchors})
commands=[]
for argv in [
 ['git','rev-parse','--show-toplevel'],['git','rev-parse','HEAD'],['git','status','--short'],['git','for-each-ref','--format=%(refname) %(objectname)'],
 ['rg','-n','saveFile\\(|queryResourceProvenance|readSaveActionContext','fusion-studio-client/src'],
 ['rg','-n','resource:provenance|file_save|handleFileMessage','fusion-studio-client/src/lib/ws-client.ts','fusion-studio-server/lib/ws/client-message-router.js'],
 ['rg','-n','readSnapshotBytes|file\\.version|restoreOfVersionId|resource:invalidate|recoveryRemote|conflict_pending|uiActionSeed|PreparedCanonicalCandidate','fusion-studio-server/lib','fusion-studio-client/src'],
 ['rg','-n','file_changed|file:changed','fusion-studio-server/lib/ws/workspace-request-handlers.js','fusion-studio-server/lib/watch/workspace-watcher.js'],
 ['rg','-n','file.command_accepted|resource.mutated|resource-render-projection|deliveryPolicy','fusion-studio-server/lib/event-registry/subscription-seed-catalog.js'],
 ['rg','-n','dirty|reconnect|generation|stale|snapshot|post-write|pre-rename','fusion-studio-client/e2e/file-save-protocol-source.spec.ts','fusion-studio-client/e2e/agent-resource-projection-source.spec.ts','fusion-studio-server/test/resources/save-controller.test.js'],
]:
 r=subprocess.run(argv,text=True,capture_output=True);commands.append({'at':datetime.datetime.now().astimezone().isoformat(),'command':argv,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
base=json.loads((C/'EXECUTION-BASELINE.json').read_text());prior=base['source_test_hashes'];prior={r['path']:r['sha256'] for r in prior} if isinstance(prior,list) else prior
drift=[p for p in paths if p in prior and (prior[p].get('sha256') if isinstance(prior[p],dict) else prior[p])!=sha(p)]
refs=dict(line.split(' ',1) for line in commands[3]['stdout'].splitlines())
out={'at':datetime.datetime.now().astimezone().isoformat(),'candidate':'PW01-f24d5cd427b9ca14','head':commands[1]['stdout'].strip(),'files':files,'commands':commands,'source_drift_from_S00':drift,'relevant_ref_drift':{k:v for k,v in refs.items() if k.startswith(('refs/heads/','refs/remotes/','refs/tags/'))}!={r['ref']:r['commit'] for r in base['refs'] if r['ref'].startswith(('refs/heads/','refs/remotes/','refs/tags/'))},'scope':'Read-only source and static test assertions; no product runtime, live database, test execution, fetch or app operation.'}
(C/'S03-SOURCE-EVIDENCE.json').write_text(json.dumps(out,indent=2)+'\n')
print('Source records',len(files),'drift',drift,'ref drift',out['relevant_ref_drift'])
print('Command results',[(x['command'][:3],x['exit']) for x in commands])
