import pathlib,json,hashlib,datetime,subprocess,difflib,re,os
home=pathlib.Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
out=home/'jobs/commit-supervisor/chat-ar-20261006/wiki-editor'; job=out.parent
freeze=json.loads((out/'pre-edit-freeze.json').read_text()); root=pathlib.Path(freeze['candidate'])
sha=lambda b:hashlib.sha256(b).hexdigest()
write=lambda n,d:(out/n).write_text(json.dumps(d,indent=2)+'\n')
checks=[]
def run(cmd,log,expected=0,cwd=root):
 p=subprocess.run(cmd,cwd=cwd,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'},stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (out/log).write_bytes(p.stdout);checks.append({'command':cmd,'cwd':str(cwd),'exit_status':p.returncode,'expected_exit':expected,'result':'PASS' if p.returncode==expected else 'FAIL','raw_log':str(out/log),'raw_log_sha256':sha(p.stdout)})
 assert p.returncode==expected,(cmd,p.returncode,p.stdout.decode());return p
run(['node',str(out/'check-wiki.cjs')],'mechanical-checks.log',cwd=home)
mechanical=json.loads((out/'mechanical-checks.json').read_text()); assert not mechanical['failures']
edits=json.loads((out/'edit-receipt.json').read_text()); changed=[e['page'] for e in edits['pages']]
run(['git','diff','--check','--',*changed],'diff-check.log')
run(['rg','-n','chokidar|watch/core|watch/workspace-watcher|hotkey-screenshot-watcher|watch/calendar-watcher|abandonAll|screenshot:refresh-source','fusion-studio-server/lib','fusion-studio-server/package.json','fusion-studio-client/src/lib/ws-client.ts','fusion-studio-client/src/lib/ws'],'retirement-sweep.log',expected=1)
nav=json.loads((out/'navigation-checks.json').read_text())
for r in nav['runs']:checks.append({'command':r['command'],'cwd':str(home),'exit_status':r['exit_status'],'result':'PASS','raw_log':r['raw_log'],'raw_log_sha256':r['raw_log_sha256'],'run':r['run'],'changed_pages':r['changed_pages']})
assert nav['repeated_generation_stable'] and nav['runs'][1]['changed_pages']==[]
assert nav['generated_state_imported']==False and nav['live_audit_state_before']==nav['live_audit_state_after']
# Exact settled source evidence: source bytes, ranges and hashes, rather than writer claims.
S='fusion-studio-server/';C='fusion-studio-client/'
E={
 'startup-lease':[(S+'lib/views/readiness-startup.js',1,80),(S+'lib/startup.js',630,875),(S+'lib/views/readiness-coordinator.js',1,260),(S+'lib/views/readiness-runtime.js',1,180)],
 'retired-observation':[(S+'lib/startup.js',630,875),(S+'lib/triggers/trigger-loader.js',165,214),(S+'lib/ledger/event-ledger.js',1,190)],
 'calendar':[(S+'lib/calendar/index.js',1,30),(S+'lib/calendar/google/poller.js',1,40),(C+'src/components/calendar/CalendarViewer.tsx',1,120),(C+'src/state/calendarStore.ts',1,210)],
 'legacy-trigger':[(S+'lib/triggers/trigger-loader.js',1,214),(S+'lib/triggers/cron-scheduler.js',1,245),(S+'lib/watcher/actions.js',1,240),(S+'lib/runner/index.js',1,200),(S+'lib/runner/heartbeat.js',1,180)],
 'legacy-ledger':[(S+'lib/event-bus.js',1,260),(S+'lib/ledger/event-ledger.js',1,190),(S+'lib/ledger/event-ledger-subscriber.js',1,160)],
 'mutation-association':[(S+'lib/chat-metadata/collectors/file-mutations.js',1,150)],
 'governed-bounded':[(S+'lib/subscriptions/admission.js',1,280),(S+'lib/subscriptions/controller.js',1,260),(S+'lib/event-registry/seed-catalog.js',1,220),(S+'lib/subscriptions/generation-compiler.js',1,240)],
 'save-render':[(S+'lib/file-mutations/save-controller.js',1,270),(S+'lib/subscriptions/handlers/resource-render-projection.js',1,170),(S+'lib/ws/resource-projection-publisher.js',1,160),(C+'src/lib/ws/file-handlers.ts',1,190),(C+'src/state/fileDataStore.ts',1,240)],
 'tool-checkpoints':[(S+'lib/agent-provenance/resource-observer.js',1,220),(S+'lib/agent-provenance/checkpoint-repository.js',1,200),(S+'lib/agent-provenance/agent-ledger-repository.js',1,220)],
 'screenshot-owner':[(C+'src/screenshots/chatScreenshotCapture.ts',1,210),(C+'src/components/chat/ConnectedChatComposer.tsx',1,145),(C+'src/components/chat/ChatComposerAddMenu.tsx',1,105),(C+'src/components/chat/ChatSurface.tsx',1,115),(C+'src/components/chat/ChatSurfaceComponentMount.tsx',1,170),(C+'src/lib/chat/side-chat-placements.ts',1,120),(C+'src/state/slices/chatSurfaceSlice.ts',1,250),(C+'src/components/App.tsx',65,85)],
 'screenshot-persist':[(C+'electron/ipc/capture-handlers.cjs',1,180),(S+'lib/screenshot/ws-handlers.js',1,160),(C+'src/state/chatFileLinkStore.ts',1,180)],
 'screenshot-gallery-preview':[(C+'electron/ipc/screenshot-handlers.cjs',1,230),(C+'src/screenshots/ScreenshotsTrigger.tsx',1,190),(C+'src/hooks/useScreenshotCapture.ts',1,180),(S+'lib/workspace/screenshot-service.js',1,180)],
 'screenshot-test-assertions':[(C+'e2e/threaded-chat-host.spec.ts',1120,1430),(S+'test/screenshot-file-capture-request-id.test.js',1,200)],
 'startup-test-assertions':[(S+'test/runtime/workspace-startup-integrity.test.js',1,270),(S+'test/views/readiness-startup.test.js',1,220),(S+'test/calendar/apple-listener-retirement.test.js',1,180),(S+'test/triggers/trigger-loader.test.js',1,220)],
 'chat-runtime':[(S+'lib/thread/thread-open-handler.js',1,210),(S+'lib/thread/session-lifecycle.js',1,200),(S+'lib/thread/runtime-stop.js',1,200),(S+'lib/thread/thread-runtime-manager.js',1,180)],
 'navigation-tool':[(S+'scripts/wiki.js',1,200),(S+'lib/wiki/audit/toc-sync.js',1,230)]
}
source_map={s['path']:s for s in freeze['sources']};evidence={};raw=[]
for key,spans in E.items():
 evidence[key]=[]
 for p,start,end in spans:
  b=(root/p).read_bytes();assert p in source_map and sha(b)==source_map[p]['sha256'];lines=b.decode().splitlines(True);end=min(end,len(lines));excerpt=''.join(lines[start-1:end]);
  entry={'path':p,'sha256':sha(b),'bytes':len(b),'lines':[start,end],'excerpt_sha256':sha(excerpt.encode())};evidence[key].append(entry)
  raw.append('\n'+key+' | '+p+' | '+entry['sha256']+' | lines '+str(start)+'-'+str(end)+'\n');raw.extend(str(i)+': '+line for i,line in enumerate(lines[start-1:end],start))
(out/'source-evidence.log').write_text(''.join(raw))
# Each of the 17 originally selected retirement/startup subjects receives a substantive disposition.
rows=[
 ('002-Server_And_Runtime/006-Background_Services/PAGE.md','retained','Verified lease-gated post-listen automation, no automatic broad observation, independent Google polling and boot CSS remain; existing failure and worker/runtime limits remain accurate.',['startup-lease','retired-observation','calendar','legacy-trigger','startup-test-assertions']),
 ('003-Automation_And_Agents/005-Background_Agents/PAGE.md','retained','Legacy event and cron trigger registration survives admitted startup. File-change definitions have no watcher input. Trigger/action files do not prove autonomous worker launch or governed permission.',['startup-lease','legacy-trigger','retired-observation','startup-test-assertions']),
 ('007-Chat_System/006-Runtime_Model/PAGE.md','metadata-only','Fixed duplicate metadata.last-modified using strict installed gray-matter parse; body and source list preserved. Existing passive/assistant activation, persistence, stop and optional independent mutation association remain scoped.',['chat-runtime','mutation-association','legacy-ledger']),
 ('004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md','rewritten-bounded','Direct capture awaits matching save acknowledgment, then adds saved PNG to the exact pending owner. Main view/group selection, explicit component session scope, Side placement, header qualified Main/Legacy fallback and actual hidden-view/unmount/away-return cancellation are documented. Retained gallery, preview, retired macOS source and privacy limits remain.',['screenshot-owner','screenshot-persist','screenshot-gallery-preview','screenshot-test-assertions']),
 ('001-Workspaces_And_Views/016-Calendar_View/PAGE.md','retained','Apple automatic sync/refresh remains retired; rows may be stale. Google independent opt-in polling, demo mounted UI and deferred store write-back remain. Future native monitoring and storage alignment remain separate.',['calendar','retired-observation']),
 ('005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md','retained','Legacy emit/on persists alongside four private governed facts. Broad watcher retirement and the two-event legacy ledger whitelist already match source; bounded save/tool protection and future permission rules remain.',['legacy-ledger','governed-bounded','save-render','tool-checkpoints']),
 ('010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md','retained','Existing watcher/ledger statements are current. Settled System/history and bounded save/tool/UI-context agreements remain direction distinct from open plugin, wider causality, retention and calendar choices.',['legacy-ledger','governed-bounded','save-render','tool-checkpoints']),
 ('010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md','retained','Current private admission/delivery remains separate from synchronous legacy API. Broad watcher retirement and file:changed ledger exclusion are already explicit; no wider publisher or plugin activation claimed.',['legacy-ledger','governed-bounded']),
 ('010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md','retained','Current governed save/tool fact catalog remains bounded; legacy chat/trigger colon topics and watcher retirement do not become general governed file, automation, version or UI-action facts.',['governed-bounded','legacy-ledger','legacy-trigger']),
 ('010-Events_And_Ledger/003-Provenance_Model/PAGE.md','retained','Reported/observed identities retain separate meaning. Independent legacy mutation-to-turn association remains optional after broad watcher retirement; timing does not prove cause or create missing preimages.',['mutation-association','legacy-ledger','tool-checkpoints','save-render']),
 ('010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md','retained','Mediated-save/agent projections still target bounded File Viewer consumers; separate legacy file_changed compatibility remains. No general watcher, arbitrary external writes or Wiki/style/config freshness is promised.',['save-render','tool-checkpoints','retired-observation']),
 ('010-Events_And_Ledger/007-Correlation_And_Causality/PAGE.md','retained','Full epoch/thread/turn identity or one unique active workspace/root turn can associate independently supplied file:changed. Partial/ambiguous tuples reject; the retired watcher supplies no general observations, and the legacy ledger ignores the topic.',['mutation-association','legacy-ledger','tool-checkpoints']),
 ('010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md','metadata-only','Removed one exact duplicate event-bus.js source path, stamped actual quoted UTC, preserved entire body. Broad watcher/rename retirement, surviving synchronous bus guards, bounded checkpoints and future storm/compaction choices remain accurate.',['legacy-ledger','retired-observation','tool-checkpoints','governed-bounded']),
 ('010-Events_And_Ledger/010-Structure/PAGE.md','retained','Source map already excludes removed watcher owners and describes optional independent file:changed collection. Legacy whitelist, four governed facts and bounded producer/projection owners remain; planned wider modules stay future.',['legacy-ledger','mutation-association','governed-bounded','save-render']),
 ('010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md','retained','Real post-listen readiness lease reaches current components/actions/triggers/cron/runner; no file watcher input. Legacy run records are separate from future durable governed automation identity and output choices.',['startup-lease','legacy-trigger','retired-observation','startup-test-assertions']),
 ('002-Server_And_Runtime/PAGE.md','retained','Startup readiness and production-entry canary scope already match accepted repair. Existing System/database, calendar content gap, view path and open preservation limits remain; no installed/public runtime certification.',['startup-lease','startup-test-assertions','calendar','governed-bounded']),
 ('007-Chat_System/005-Testing_And_Operations/PAGE.md','retained','Existing text distinguishes source assertions and scratch production-entry canaries from actual authenticated public provider/runtime evidence. Historical watcher correlation tests do not imply a current generic watcher; no fresh pass is claimed here.',['startup-test-assertions','mutation-association','chat-runtime'])
]
extra=[
 ('007-Chat_System/004-Chat_UI/001-Composer/PAGE.md','rewritten-bounded','Composer capture uses exact workspace/view/group/session and fresh mount lifetime; view-bound Main follows selection, explicit Main and Side are session-bound. Hidden retained views and away-return cancel old capture; closed Side cancels; pending save can retain gallery PNG without attachment. Header behavior links to canonical Screenshot article.',['screenshot-owner','screenshot-persist','screenshot-test-assertions']),
 ('010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md','generated-block-only','Imported exactly two generated section-toc description deltas for Change Storm and Structure. Authored body outside that block is byte-preserved; generator output matches after stabilization.',['navigation-tool','legacy-ledger','mutation-association'])
]
pages={p['path']:p for p in mechanical['pages']};coverage=[]
for original,records in ((True,rows),(False,extra)):
 for rel,disposition,claim,refs in records:
  p='ai/RC-MacAir-15/Wiki/'+rel;m=pages[p];f=next(x for x in freeze['pages'] if x['path']==p)
  coverage.append({'page':p,'original_retirement_startup_subject':original,'disposition':disposition,'claim':claim,'preimage_sha256':f['sha256'],'page_sha256':m['sha256'],'body_sha256':m['bodySha256'],'changed_by_leaf':m['changed'],'last_modified':m['lastModified'],'evidence_ids':refs,'sources':[s for ref in refs for s in evidence[ref]],'limits':'Read current actual code/test sources; test assertions and accepted historical results do not certify native capture, ordinary provider operation or installed Alpha.'})
assert len(rows)==17 and len(coverage)==19 and sum(p['changed_by_leaf'] for p in coverage)==5
# Preserve the exact final diff from leaf launch preimages, not the entire integration diff.
diff=[]
for e in edits['pages']:
 before=(root/e['version']).read_text();after=(root/e['page']).read_text();diff.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile=e['page']+' pre-leaf',tofile=e['page']+' final'))
(out/'final-articles.patch').write_text(''.join(diff))
heading=next(e for e in edits['pages'] if '/000-Events_And_Ledger/PAGE.md' in e['page']);body=lambda t:t.split('\n---\n',1)[1]
withouttoc=lambda t:re.sub(r'<!-- section-toc:start -->.*?<!-- section-toc:end -->','',body(t),flags=re.S)
assert withouttoc((root/heading['version']).read_text())==withouttoc((root/heading['page']).read_text())
# Root recovery manifest hashes and captured file hashes are distinct identities.
root_recoveries=[];reserved=[]
for directory in ('wiki-final-preedit','fifth-wiki-preimage'):
 p=job/directory/'recovery/manifest.json';b=p.read_bytes();d=json.loads(b);root_recoveries.append({'manifest':str(p),'manifest_sha256':sha(b),'owned_preimages':{k:v['worktree'] for k,v in d['owned'].items()}})
 for k,v in d['owned'].items():
  if '/.versions/' in k and v['worktree']['kind'] in ('absent','missing'):assert not (root/k).exists();reserved.append({'path':k,'kind':'absent'})
assert len(reserved)==4
accept=job/'screenshot-handoff-acceptance.json';assert json.loads(accept.read_text())==freeze['code_acceptance']
for n,expected in [('current-byte-evidence.json',freeze['code_acceptance']['current_code_packet_sha256']),('checks.json',freeze['code_acceptance']['checks_sha256'])]:
 p=job/'screenshot-repair'/n;assert sha(p.read_bytes())==expected
current={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pages':mechanical['pages'],'versions':mechanical['versions'],'sources':freeze['sources'],'retired_source_absences':freeze['deleted_source_absences'],'root_reserved_version_absences':reserved,'root_recovery_manifests':root_recoveries,'index_semantic_sha256':freeze['candidate_index_semantic_sha256'],'index_preserved':mechanical['candidateIndexPreserved'],'code_acceptance_sha256':sha(accept.read_bytes()),'settled_code_packet_sha256':freeze['code_acceptance']['current_code_packet_sha256'],'settled_code_checks_sha256':freeze['code_acceptance']['checks_sha256'],'authored_events_body_preserved':True,'recovery_extension':'Seven exclusive adjacent version leaves extend original automatic checkpoint deletion inventory. Root must include their exact final inventory for manual cleanup or abandonment within this private candidate only; no source restoration or runtime/DB recovery.'}
write('current-byte-evidence.json',current)
write('coverage.json',{'at':current['at'],'original_subject_count':17,'total_page_count':19,'changed':5,'retained':14,'claims':coverage,'evidence':evidence,'source_evidence_log':str(out/'source-evidence.log'),'source_evidence_log_sha256':sha((out/'source-evidence.log').read_bytes())})
write('checks.json',{'at':current['at'],'commands':checks,'mechanical_counts':{k:mechanical[k] for k in ('pageCount','changedPageCount','uniqueSourceFilesChecked','declaredSourceReferencesChecked','localLinksChecked','retiredSourceAbsences','completeVersionCount','candidateIndexPreserved','failures')},'accepted_code_checks':freeze['code_acceptance'],'skips':['No leaf product test/build rerun: code/tests are frozen with separate fresh accepted handoff, and this leaf changes Wiki bytes only.','Native app capture, normal provider completion, installed Alpha and final whole-candidate/runtime gates belong to root; no runtime/profile/provider/DB actions taken.'],'omissions':['No empty legacy 006-System_Manager/PAGE.md adoption or its generated Guidance link.','No audit-state import, extra parent/Guide refresh, new articles, operational MC/Capture035 or restored operational Launchpad changes.'],'deviations':['Self-check clarification preserved two additional exact intermediate versions before correction; all seven actual-timestamp leaves are mechanical recovery extensions authorized by root release.'],'result':'PASS'})
report='''READY_FOR_HANDOFF_REVIEW

Five bounded articles are complete in the private candidate. Screenshot Capture and Composer now describe exact Main/Side/header destination ownership, correlated saved-PNG acknowledgment, pending attachments and actual hidden-view/unmount/away-return cancellation. Runtime Model and Change Storm received metadata-only fixes with entire bodies preserved. Events heading imports only its two generated description deltas; authored prose outside the block is preserved.

All 17 originally selected retirement/startup subjects have substantive retained/corrected dispositions in coverage.json; Composer and Events heading bring coverage to 19. Fourteen pages were retained byte-for-byte because their current/future/open distinctions already match the settled source. Claims bind exact page/source hashes and source line ranges, including the new pure Side placement helper, real owning callers and cancellation assertions. The freeze/current manifests include all 199 supporting code/test/tool files.

Leaf checks pass: 19 strict installed-gray-matter parses, 304 exact live file references unique per page, 115 local links, six retired-source absences, seven complete adjacent preimages, unchanged candidate index and git diff --check. Disposable navigation audit exits 0 twice and stabilizes on pass two. Only the two Events descriptions are imported. A disposable Guidance link to the excluded empty legacy System Manager page and all generated audit state remain excluded. Commands, exits and raw-log hashes are in checks.json; final-articles.patch is the exact leaf preimage-to-final diff.

The five initial preimages and two intermediate wording-clarification preimages were declared absent, created exclusively, hash/mode/readback verified before each replacement, and retained without modifying older versions. Their actual local timestamp names are 2026-10-06-151426.md (five) and 2026-10-06-151519.md (Screenshot and Composer). They extend the original automatic checkpoint deletion inventory: root must account for these exact leaves before private-clone cleanup/abandonment. Root recovery manifest identities are bb33708b… (four articles/reserved absences) and acff9375… (fifth); the fifth page preimage itself is 78a9d4aa… . Four root-reserved 2026-10-06-145212.md absences remain untouched.

No agents, Git index/ref/commit operations, source writes, central-memory edits, product build/test reruns, runtime/app/provider/profile/DB actions or publication occurred. Code checks remain the separate accepted 34 focused / 106 cumulative / build exit 0 packet d2a8d88c… with checks 64c2fd4c… . Native capture, ordinary provider operation, installed Alpha and final runtime/whole-candidate approval remain root gates. This leaf is ready for the separate fresh documentation handoff reviewer; it does not self-grant independent review or publication approval.
'''
(out/'report.md').write_text(report)
files=['report.md','coverage.json','current-byte-evidence.json','checks.json','final-articles.patch','pre-edit-freeze.json','edit-receipt.json','version-extension-receipt.json','version-readback.json','selfcheck-correction-preimage-absence.json','selfcheck-correction-version-readback.json','selfcheck-correction-receipt.json','mechanical-checks.json','navigation-checks.json','mechanical-checks.log','diff-check.log','retirement-sweep.log','navigation-run-1.log','navigation-run-2.log','source-evidence.log','check-wiki.cjs','check-navigation.py','apply-bounded-edits.py','finalize.py']
manifest={'state':'READY_FOR_HANDOFF_REVIEW','worker':'/root/integration_wiki_editor','manager':'/root','controller_home':str(home),'actual_cwd':str(home),'source_read_only':freeze['source_read_only'],'candidate':str(root),'head':freeze['head'],'branch':freeze['branch'],'model_effort':'inherited root; no override','all_candidate_writes_frozen':True,'owned_articles':[{**{k:e[k] for k in ('page','preimage_sha256','final_sha256','last_modified')},'bytes':(root/e['page']).stat().st_size,'mode':oct((root/e['page']).stat().st_mode & 0o777)} for e in edits['pages']],'owned_versions':mechanical['versions'],'source_page_dependency_binding_verified':True,'navigation_stable':True,'original_subject_count':17,'total_page_count':19,'leaf_checks':'PASS','fresh_independent_docs_review':'Required; commissioned by root after this handoff','files':[{'path':str(out/n),'sha256':sha((out/n).read_bytes())} for n in files]}
write('handoff-manifest.json',manifest)
print(json.dumps({'state':manifest['state'],'report':str(out/'report.md'),'manifest_sha256':sha((out/'handoff-manifest.json').read_bytes()),'pages':19,'versions':7,'checks':'PASS'}))
