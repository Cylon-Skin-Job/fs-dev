from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,re
repo=Path('/Users/rccurtrightjr./projects/fs-dev');wiki=repo/'ai/RC-MacAir-15/Wiki';out=Path(__file__).parent
h=lambda b:hashlib.sha256(b).hexdigest()
paths=[
'002-Server_And_Runtime/006-Background_Services/PAGE.md','003-Automation_And_Agents/005-Background_Agents/PAGE.md','007-Chat_System/006-Runtime_Model/PAGE.md','004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md','001-Workspaces_And_Views/016-Calendar_View/PAGE.md','005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md','010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md','010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md','010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md','010-Events_And_Ledger/003-Provenance_Model/PAGE.md','010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md','010-Events_And_Ledger/007-Correlation_And_Causality/PAGE.md','010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md','010-Events_And_Ledger/010-Structure/PAGE.md','010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md','002-Server_And_Runtime/PAGE.md','007-Chat_System/005-Testing_And_Operations/PAGE.md']
pre={p:(wiki/p).read_bytes() for p in paths};texts={p:b.decode() for p,b in pre.items()};updated={}
def replace(p,old,new):
 t=texts[p];assert t.count(old)==1,(p,old[:80],t.count(old));texts[p]=t.replace(old,new);updated[p]=True
p=paths[0]
replace(p,'After listening, component definitions, declarative trigger loading, configured cron jobs and runner heartbeat start through the current workspace startup path.', 'After listening, the `workspace-automation-pipeline` startup effect captures the canonical active workspace ID and root from the workspace controller. `views/readiness-startup.js` ensures workspace view readiness and holds a verified readiness lease through view-root resolution, optional issue-script loading, component definitions, action wiring, declarative trigger loading, configured cron registration and runner heartbeat initialization. A missing active ID or root skips the pipeline. Unavailable, preparing or retiring view readiness admits no pipeline initialization; the lease releases on success or failure. Existing startup exception handling remains bounded to this pipeline. Production-entry canaries exercise the real effect registry, readiness runtime/coordinator and relocation owner; their scratch consumers establish startup reachability, not an active trigger or provider session on this machine.')
p=paths[1]
replace(p,'After an active workspace starts, the server reads its Agents registry and scans registered agent folders recursively for `TRIGGERS.md`.', 'The post-listen workspace automation effect first captures the canonical active workspace identity and obtains a verified view-readiness lease through `views/readiness-startup.js`. Only admitted startup reads its Agents registry and scans registered agent folders recursively for `TRIGGERS.md`. Missing identity or unavailable, preparing or retiring readiness skips this initialization. The lease spans root resolution, optional issue-script loading, components, actions, trigger/cron registration and runner setup, and releases after completion or failure. Startup-entry canaries check these consumers and the four legacy event trigger families in scratch workspaces; they do not certify a worker launch or live provider response.')
p=paths[14]
replace(p,'Status: source inspected on 2026-09-19 in the development checkout. Legacy triggers, cron jobs and agent-run records exist; a general governed automation run/match schema and executor are not implemented. Future contracts below are distinct from current runtime behavior. No product tests or runtime were run.', 'Status: current source describes legacy triggers, cron jobs and agent-run records; a general governed automation run/match schema and executor are not implemented. Startup-entry tests exercise the real effect and view-readiness owners with scratch consumers. Those tests establish bounded startup reachability, not an active automation run or measured public provider behavior. Future contracts below are distinct from current runtime behavior.')
replace(p,'`startup.js` reads the Agents registry, loads component definitions and action handlers, then calls `loadTriggers`.', '`startup.js` registers one post-listen `workspace-automation-pipeline` effect. Its readiness wrapper captures the active workspace ID/root from the controller, ensures view readiness and holds a verified lease while resolving view roots and initializing issue scripts, components, actions, triggers, cron and runner monitoring. Missing identity or unavailable, preparing or retiring readiness admits none of these consumers. The lease releases on success or failure; the existing outer startup catch remains. Within admitted initialization, startup reads the Agents registry, loads component definitions and action handlers, then calls `loadTriggers`.')
p=paths[15]
anchor='## Current View Path Runtime\n'
replace(p,anchor,'''## Workspace startup readiness

The post-listen `workspace-automation-pipeline` effect in `lib/startup.js` delegates to `lib/views/readiness-startup.js`. The workspace controller supplies the active ID and canonical root. The wrapper ensures readiness through `readiness-runtime.js` and acquires a verified coordinator lease before view-root resolution, optional issue-script loading, components, action handlers, event/cron triggers or runner monitoring. Missing identity skips initialization; unavailable, preparing or retiring readiness cannot enter it. The lease releases on success or failure, with existing bounded pipeline error handling retained.

`test/runtime/workspace-startup-integrity.test.js` exercises the production startup entry and listen registration, real effect registry, runtime/coordinator and relocation recovery owners, and scratch downstream consumers. `test/views/readiness-startup.test.js` covers asynchronous initialization and lease release. `test/views/view-readiness-coordinator.test.js` and `test/views/view-relocation-recovery.test.js` cover the underlying readiness and recovery boundaries. These are bounded source/test contracts; they do not establish ordinary authenticated OpenCode completion or an installed app's health. [Chat Testing And Operations](../007-Chat_System/005-Testing_And_Operations/PAGE.md) separates that public runtime evidence from fixtures.

'''+anchor)
p=paths[16]
anchor='<!-- children:start -->'
replace(p,anchor,'''## Startup retirement and guarded provenance

Startup or workspace-readiness changes run the production-entry `test/runtime/workspace-startup-integrity.test.js`, strict registry `test/runtime/isolated-provenance-runtime.test.js`, retirement `test/watch/watcher-retirement.test.js`, startup-order `test/event-registry/startup-integration.test.js`, and `test/views/readiness-startup.test.js`, together with coordinator/recovery, ledger, direct screenshot, Calendar, trigger, shutdown and save/tool provenance regressions. Source/dependency sweeps verify the retired workspace, screenshot-folder and Apple directory watchers remain absent. Ready-startup scratch canaries verify components/actions, legacy chat/ticket/agent/system event triggers, cron and runner setup under the held readiness lease. They do not launch a real autonomous worker.

After building the renderer, `node e2e/provenance/run-file-viewer-live.mjs` from the client runs normal and fact-publication-failure scenarios against the actual isolated server. Each scenario uses `NODE_ENV=test`, `Test-Provenance`, exactly two registered scratch workspaces, a marker-owned profile, a fresh non-3001 port and `reuseExistingServer: false`. The audit expects all seven startup effects and runtime harness HTTP revalidation to be blocked, with zero effect factories, filesystem watchers or children. The browser assertions retain registry authority, mediated-save/prewrite protection, postwrite recovery and narrowly scoped refresh behavior.

The launcher compares protected developer databases, the normal profile database, workspace bytes and repository Playwright output on both success and failure. Before nonce-checked scenario cleanup, it retains the content-free isolated audit and safe failure artifacts in a separate marker-owned temporary evidence directory. Raw traces receive only size/hash receipts because they can contain authentication material; their payloads are not copied. A failure keeps its original phase and error boundary, and evidence-finalization failure retains the original owned scenario directory for investigation. These fixture checks do not establish actual public provider operation.

Public OpenCode acceptance additionally uses the ordinary authenticated Electron shell with a disposable profile and an actually registered and selected scratch workspace. Observe the first and second New Chat selections, real prompt acceptance and canonical completion, the exact durable exchange, and passive reopening of the same thread. Provider-free fixtures, startup readiness, connection indicators, generic spawn success and redacted error markers cannot substitute for those observations. Any unperformed manual runtime step remains an explicit acceptance gap.

'''+anchor)
common=['fusion-studio-server/lib/views/readiness-startup.js','fusion-studio-server/lib/views/readiness-runtime.js','fusion-studio-server/lib/views/readiness-coordinator.js','fusion-studio-server/lib/views/relocation-service.js','fusion-studio-server/lib/workspace/workspace-controller.js','fusion-studio-server/lib/testing/isolated-provenance-runtime.js','fusion-studio-server/test/runtime/workspace-startup-integrity.test.js','fusion-studio-server/test/views/readiness-startup.test.js']
# The relocation owner is resolved below rather than assuming a similarly named file.
actual=[x for x in common if (repo/x).exists()]
assert len(actual)==len(common),(set(common)-set(actual))
now=datetime.now(timezone.utc);timestamp=now.strftime('%Y-%m-%dT%H:%M:%SZ');version=now.astimezone().strftime('%Y-%m-%d-%H%M%S')
for p in updated:
 t=texts[p];end=t.index('\n---',4)
 fm=t[:end];body=t[end:]
 sources=common[:]
 if p==paths[16]:sources += ['fusion-studio-client/e2e/provenance/run-file-viewer-live.mjs','fusion-studio-client/e2e/provenance/guarded-proof-lifecycle.mjs','fusion-studio-client/e2e/provenance/guarded-proof-lifecycle.test.mjs','fusion-studio-client/e2e/provenance/file-viewer-live-resource.spec.ts','fusion-studio-client/playwright.provenance.config.ts','fusion-studio-client/playwright.chat-architecture.config.ts','fusion-studio-client/e2e/threaded-chat-host.spec.ts']
 for s in sources:
  assert (repo/s).is_file(),s
  if f'    - {s}\n' not in fm+'\n': fm += f'\n    - {s}' if fm.rstrip().splitlines()[-1].startswith('    - ') else ''
 # Insert under source-files rather than after other frontmatter keys.
 existing=set(re.findall(r'^    - (.+)$',t[:end],re.M))
 additions=''.join(f'    - {s}\n' for s in sources if s not in existing)
 fm=t[:end].replace('  source-files:\n','  source-files:\n'+additions)
 fm=re.sub(r'  last-modified: "[^"]+"',f'  last-modified: "{timestamp}"',fm)
 texts[p]=fm+body
 dst=wiki/p;assert dst.read_bytes()==pre[p],f'concurrent edit {p}'
 versions=dst.parent/'.versions';versions.mkdir(exist_ok=True)
 snapshot=versions/(version+'.md');snapshot.write_bytes(pre[p]) if not snapshot.exists() else (_ for _ in ()).throw(RuntimeError(str(snapshot)))
 dst.write_text(texts[p]);updated[p]={'preimage':str(snapshot),'preimageSha256':h(pre[p]),'sha256':h(dst.read_bytes()),'sourceFilesAdded':[s for s in sources if s not in existing]}
records=[]
for i,p in enumerate(paths):
 dst=wiki/p;records.append({'path':str(dst),'inventory':'original-RV2-A01-16' if i<16 else 'repair-section-8','beforeSha256':h(pre[p]),'afterSha256':h(dst.read_bytes()),'disposition':'scoped-update' if p in updated else 'unchanged-accurate','details':updated.get(p,{'reason':'Retirement, ledger whitelist, independent save/tool evidence and noncausal/future limits remain accurate; startup repair adds no invalidated claim.'})})
(out/'wiki-inventory.json').write_text(json.dumps({'checkedAt':timestamp,'originalInventoryCount':16,'extraRepairArticleCount':1,'articles':records},indent=2)+'\n')
print(json.dumps({'updated':list(updated),'reviewedOriginalInventory':16,'repairArticle':1},indent=2))
