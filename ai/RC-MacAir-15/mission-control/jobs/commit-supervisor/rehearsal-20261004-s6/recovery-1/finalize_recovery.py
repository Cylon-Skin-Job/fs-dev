"""Save bounded recovery result without manufacturing current readiness or native END."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import recovery_evidence as p

at=p.now();proof=p.read(p.N/'final-preservation-proof.json');order=p.read(p.N/'actual-restore-order.json')
assert order['result']=='REHEARSAL_RECOVERY_PATHS_PROVED'
assert proof['original_owned128_full4353_index_work_modes_links_flags_deletions_absence_exact']
assert proof['current_ready'] is False
_,original=p.load(p.J);current=p.relevant_state(p.P,original['owned'],original['protected_repos'])
assert p.semantic(current)==p.semantic(original['baseline'])
pins={}
for name in ['activation.json','independent-entry-inspection.json','public-control-copy-equality.json',
             'saved-fixed-fresh-guard.json','collision-plan.json','collision-nonmutation-proof.json',
             'collision-control-undone.json','fixed-recovery-result.json','fixed-full-exact-readback.json',
             'original-scope-refusal-nonmutation-proof.json','fix-xy-wiki-recovery-result.json',
             'first-wiki-recovery-result.json','original-recovery-result.json','actual-restore-order.json',
             'original-full-exact-readback.json','original-base-full-readback.json','final-preservation-proof.json',
             'saved-interrupted-raw-bytes-validation.json','initial.json','collision-before-refusal.json',
             'collision-after-refusal.json','after-fixed.json','original-premature-before.json',
             'original-premature-after.json','after-fix-xy-wiki.json','after-first-wiki.json','after-original.json']:
    pins[name]={'path':str(p.N/name),'sha256':p.digest((p.N/name).read_bytes())}
commands=[]
for file in sorted(p.N.glob('*.command.json')):
    receipt=p.read(file)
    for key in ['stdout_raw','stderr_raw']:
        assert p.digest(Path(receipt[key]['path']).read_bytes())==receipt[key]['sha256']
    commands.append({'path':str(file),'sha256':p.digest(file.read_bytes()),'command':receipt['command'],
                     'exit_code':receipt['exit_code'],'stdout_raw':receipt['stdout_raw'],'stderr_raw':receipt['stderr_raw']})
p.save('all-raw-command-receipts.json',{'at':at,'actor':p.ACTOR,'count':len(commands),'commands':commands,
       'exit_qualification':'Two actual public negative controls exit1 as required. Detached candidate symbolic-ref reads exit1 normally. All restore and public verify commands exit0. No synthetic success receipts.'})
lifecycle={'at':at,'actual_actor':p.ACTOR,'manager':'/root','effective_host':'danger-full-access/never',
           'root_model_effort':'Inherited without overrides; concrete values/native role loader metadata unexposed',
           'actual_predecessor_native':'Exact collaboration.list_agents subtree independently completed unmet-gate/native END, no children at entry and final',
           'actual_self_native_at_save':{'tool':'collaboration.list_agents','path_prefix':p.ACTOR,
                                       'result':{'agents':[{'agent_name':p.ACTOR,'agent_status':'running'}]}},
           'children':[],'conflicting_writers':[],'matching_schedules':p.schedules(),
           'root_writer':'Root owns disjoint E and explicitly transferred SECOND private recovery only',
           'private_stop':'Retained real predecessor completed stop; never signaled any old/private/protected PID in this turn',
           'closure_capability':'close_agent unavailable; no closure fabricated',
           'next_native_action':'Return saved REHEARSAL_RECOVERY_COMPLETE test result and intentionally END',
           'actual_own_END_observation':'Not yet available inside this running turn; root must independently observe native terminal after final response'}
p.save('lifecycle.json',lifecycle)

def deviation(identifier,criterion,change,authority,files,effect,checks,risk,consumer):
    return {'id':identifier,'original_criterion':criterion,'actual_change':change,'reason_authority':authority,
            'files':[str(p.N/f) for f in files],'observable_effect':effect,'checks':checks,'risk':risk,
            'downstream_consumer_impact':consumer,'owning_classification':'accepted within this explicit recovery assignment',
            'classification_owner':p.ACTOR,'root_classification':'Pending separate root raw inspection; not fabricated',
            'proposed_classification':'accepted','owner':p.ACTOR}
deviations=[
 deviation('R1-D1','Exact installed role/CWD/permissions/root inheritance loading','Supported default runtime explicitly loaded exact SKILL/TOML/contracts/standards',
           'Bound assignment and session portability contract',['activation.json'],'No model/effort override or host configuration change',
           ['Current source hashes, verified actual CWD/separate roots, native identity'],'Concrete model/effort/native loader metadata unexposed','Root closeout retains actual fallback and loader limit'),
 deviation('R1-D2','Use public helpers while preserving all original immutable archives and prior guards',
           'Unique public-controls jobs contain exact copied immutable manifest/sidecar/payload sets; only their mutable guards/readbacks are consumed',
           'Public CLI exposes only default <job>/restore-guard.json. Root explicitly authorized exact control copies through direct native message; no new capture',
           ['public-control-copy-equality.json','public-controls','saved-fixed-fresh-guard.json'],
           'Original owners/repo/scopes/hashes retained; every old guard and all1844 earlier job leaves remain in place unchanged',
           ['Exclusive copy byte/mode/mtime equality, actual public restore/verify, original namespace verify after every restore'],
           'Copies have different physical inodes; original archive and guard identities remain exact',
           'Root/S6 gate must distinguish control namespaces from immutable original checkpoints; no installed capability change'),
 deviation('R1-D3','Read current contracts and schedule facts without guessing runtime dependencies',
           'Initial system python3 read-only inspection failed to import tomllib; inspection then used available python3.12 -B',
           'Installed predecessor command/runtime and Python3.12 support already available; no install/config change',
           ['diagnostic-attempts.json','independent-entry-inspection.json'],
           'First attempt made no candidate/source/profile writes; complete subsequent inspection succeeded',
           ['Original tool exception retained;104 full raw JSON records/78 command payload receipts independently parsed/readback'],
           'Default python3 cannot run this tomllib inspection','Root/successor uses the recorded Python3.12 executable; not a product defect'),
 deviation('R1-D4','Protect all current normal/Alpha identities using UID/start/exe/entry/CWD/environment/profile facts',
           'An initial local comparator expected cwd in every systemProcesses descendant record and stopped. Corrected extraction uses actual saved ps/lsof/environment fields for all13',
           'Some non-renderer helpers are not pre-enriched by systemProcesses; raw per-PID observations already exist',
           ['entry_inspection.py','independent-entry-inspection.json','diagnostic-attempts.json','final-preservation-proof.json'],
           'No effect or signal occurred; protected identities agree in five actual current samples',
           ['Exact13 UID/start/command/CWD/executable/machine/profile/ancestry comparisons; current private tree/listeners absent'],
           'Raw full environment records remain local and may contain sensitive environmental values',
           'Root inspects bounded normalized identity facts; no remote publication authorized'),
 deviation('R1-D5','Prove public collision refusal nonmutating for candidate/source scope',
           'After actual REFUSED, a local raw whole-source-porcelain equality assertion stopped because new recovery-1 receipts appeared. Corrected only the proof using exact J/E NUL-safe exclusions',
           'Root explicitly directed correction using assigned J/E records plus all outside leaves/staged entries/physical index/ref/config; no new authority',
           ['collision_and_fixed.py','continue_fixed.py','collision-nonmutation-proof.json','diagnostic-attempts.json'],
           'Full candidate4355/physical index/guard unchanged during refusal; source11977/index/flags/refs unchanged. Existing refusal was retained and not replayed; only known collision bytes undone',
           ['Before/after full relevant state equality, NUL-safe status with exact source J/E exclusions, full raw candidate/source stage/flags/config/ref/remotes/reflogs/physical indexes'],
           'Whole source porcelain differs legitimately from evidence records; it must not be represented as byte-identical',
           'Root/outer gates retain the failed proof and qualified successful correction; actual helper refusal passed'),
 deviation('R1-D6','Fully inspect required bound sources/raw facts with bounded outputs',
           'Oversized output requests truncated; required document sections were reread in smaller calls, and full raw JSON/command/payload structures were independently parsed and compared',
           'Read-only evidence scale; no source rewrite or lost raw receipts',
           ['activation.json','independent-entry-inspection.json'],
           'Full original governing contracts/standards and recovery state inspected; source/old evidence preserved',
           ['104 full raw predecessor JSON structures,78 raw commands, six archive/payload validation sets,165 current authority hashes'],
           'Large raw structures were programmatically inspected rather than all echoed into the conversation',
           'Root retains full saved raw files for its separate inspection; no prior verdict replaces raw verification'),
 deviation('R1-D7','Verify saved interrupted binary index/work bytes independently',
           'Saved initial staged OID/full current state matched before mutation; actual immutable staged object bytes were separately read after original restore. Actual working preimage was saved before collision',
           'Content-addressed saved OID remains available in private candidate; explicit time qualification retained',
           ['saved-interrupted-raw-bytes-validation.json','saved-interrupted-stage-blob-readback.command.json','collision-known-original.bin'],
           'Actual38-byte staged and50-byte work values independently match predecessor raw hex/hashes, differ and contain0/ff',
           ['Saved initial actual index OID match, actual git cat-file blob receipt, raw work preimage hash/hex'],
           'Stage-byte readback is subsequent; it is not described as a contemporaneous pre-control cat-file command',
           'Root/S6 gate keeps exact timing and immutable-OID derivation separate from original stage/work restoration'),
 deviation('R1-D8','Preserve protected live storage without claiming stable active DB content',
           'All11 storage identities unchanged; normal/Alpha DB hash/stat deltas recorded separately',
           'Original runtime ownership/recovery boundary; no protected/profile/live-server DB copy/restore permitted',
           ['initial.json','after-original.json','final-preservation-proof.json'],
           'Protected app roots/descendants unchanged, private disposable profile bytes/metadata unchanged throughout this turn',
           ['Existence/kind/mode/dev/inode equality and raw before/after metadata/hash samples'],
           'Running protected DBs naturally changed size/hash/mtime; no byte-stability claim',
           'Root/closeout reports process and storage boundaries, not database content equality'),
]
p.save('diagnostic-attempts.json',{'at':at,'actor':p.ACTOR,'records':[
 {'attempt':'Initial inline python3 full read-only inspection','original_tool_output':'Traceback (most recent call last): File "<stdin>", line 1, in <module> ModuleNotFoundError: No module named \'tomllib\'',
  'result_source':'Actual tool output retained here; initial wrapper exposed only output, not a separately captured exit code','candidate_mutation':False},
 {'attempt':'Initial inline predecessor proof comparator','original_tool_output':'Traceback (most recent call last): File "<stdin>", line 22, in <module>; File "<stdin>", line 20, in norm; KeyError: \'cwd\'',
  'result_source':'Actual tool output retained; no proof/control write had occurred before this exception','candidate_mutation':False},
 {'attempt':'collision_and_fixed.py','actual_session':57453,'actual_exit':1,
  'original_tool_output':'Actual public REFUSED already saved; local assertion stopped at collision_and_fixed.py line37 comparing whole source porcelain raw hashes',
  'preserved_script':str(p.N/'collision_and_fixed.py'),'candidate_state_at_stop':'Only recorded collision working bytes remain; no restore executed',
  'recovery':'continue_fixed.py validates same saved refusal/snapshots with exact J/E source scope, undoes only known collision control, then actual guarded fixed restore'},
 ],'limits':'These are preserved transcripts of actual original attempts, not new commands or fabricated re-execution receipts.'})
p.save('deviations.json',{'at':at,'schema':1,'actor':p.ACTOR,'entries':deviations,
       'inherited_first_interruption_deviations':{'path':str(p.I/'deviations.json'),'sha256':p.digest((p.I/'deviations.json').read_bytes()),'disposition':'All seven retained unchanged; not reclassified as new work'},
       'unresolved_in_scope_recovery_findings':[],'owner_rulings_required':[],'scope':'SECOND assigned recovery only; root fresh full-S6/whole gates pending'})
criteria=[
 ('REC-01','Exact second-only authority/role loading/CWD/host/root inheritance','activation.json'),
 ('REC-02','Actual predecessor terminal/no descendants, explicit ownership transfer, no writer/schedule','independent-entry-inspection.json'),
 ('REC-03','Actual interrupted full4355 state and immutable guard exact before effects','independent-entry-inspection.json'),
 ('REC-04','Complete saved mixed staged/work binary values and declared-created control','saved-interrupted-raw-bytes-validation.json'),
 ('REC-05','All original manifest/payload/guard/history evidence retained; copied controls byte-exact','public-control-copy-equality.json'),
 ('REC-06','Public fresh guard and actual binary collision restore refusal; full nonmutation','collision-nonmutation-proof.json'),
 ('REC-07','Undo only known collision value, then exact guarded fixed130 recovery','fixed-recovery-result.json'),
 ('REC-08','Full fixed base/index/work/mode/deletion/link/unusual/absence and both Wiki/watch paths exact','fixed-full-exact-readback.json'),
 ('REC-09','Actual premature original-scope public guard refusal while supplements exist','original-scope-refusal-nonmutation-proof.json'),
 ('REC-10','Restore actual X/Y union130 then actual first union129 then ORIGINAL128 LAST','actual-restore-order.json'),
 ('REC-11','Remove only each manifest-declared job-created initially absent paths','actual-restore-order.json'),
 ('REC-12','Complete original128 current staged/work byte/mode/link/index flag/deletion/unusual/absence exact','original-full-exact-readback.json'),
 ('REC-13','Actual HEAD/base blobs/modes/absence exact and4225 unrelated inputs exact','original-base-full-readback.json'),
 ('REC-14','Source11977/cache193/old job1844/all6 archive/source physical index/refs untouched','final-preservation-proof.json'),
 ('REC-15','Private tree/server/CDP remain absent; all protected4/13 process and11 storage identities preserved','final-preservation-proof.json'),
 ('REC-16','Historical owner packets qualified/current readinessfalse/no effects/replay/children/Git publication','lifecycle.json'),
]
criterionmap=[]
for identifier,criterion,file in criteria:
    criterionmap.append({'id':identifier,'criterion':criterion,'status':'proved','evidence':{'path':str(p.N/file),'sha256':p.digest((p.N/file).read_bytes())},
                         'covered_scope':'Original owner-approved S6 SECOND recovery assignment only','current_ready':False})
p.save('criterion-map.json',{'at':at,'actor':p.ACTOR,'criteria':criterionmap,'whole_S6_acceptance':'Not granted by this recovery actor; root separately inspects and assigns factual closeout plus fresh full-S6/whole gates'})
ownerpackets=[]
for name,sha in [('owner-packet-first.md','be1b988ced2b88b6e309e03f2831e2c8938034a1c79aeb3c8d0a75f50eb5fde9'),
                 ('owner-packet-fix-xy.md','4262b884dccc10a10b53a43e1a96e00167a5557b85f88802c324414410c29870')]:
    assert p.digest((p.J/name).read_bytes())==sha
    ownerpackets.append({'path':str(p.J/name),'sha256':sha,'status':'Historical actual time-qualified waiting-owner event; current readiness withheld'})
checkpoint={'schema':1,'checkpoint_id':'S6-SECOND-RECOVERY-COMPLETE-01','at':at,'actor':p.ACTOR,'manager':'/root',
            'signature':'Codex side chat (ephemeral)','actual_cwd':str(p.C),'controller_home':str(p.C),'source_repo':str(p.R),
            'candidate_location':str(p.P),'role':'Commit Supervisor SECOND recovery only','scope':'REHEARSAL_ONLY',
            'phase':'unmet-gate','test_result':'REHEARSAL_RECOVERY_COMPLETE','return':'REHEARSAL_RECOVERY_COMPLETE',
            'return_qualification':'Test result only, not a new installed production return-state contract',
            'current_ready':False,'preview':'Stopped and abandoned; original seeded inputs restored',
            'assignment':{'path':str(p.ASSIGNMENT),'sha256':p.ASSIGNMENT_HASH},
            'original_SPEC':{'path':str(p.C/'planning/commit-supervisor/SPEC.md'),'sha256':'6d7b351db87e535b0950f94c42c61d503a3ac3fef6587299dfc024c7887df664'},
            'source_current':current['protected'],'candidate_current_refs':current['refs'],
            'original_recovery':{'job':str(p.J),'manifest_sha256':'f827e476bb28bc720f14537ebf6a1edf514f122e3f6705c4e9fa0590912834fb','owned128_full4353_exact':True},
            'fixed_recovery_retained':{'job':str(p.I/'fixed-checkpoint'),'manifest_sha256':'a885cde0f24e25d9cea6437edad6b9258f365d3a2db08bcb426d690195e4291a','payload_count':119,'historical_exact_fixed_restore_proved':True},
            'restore_order':order,'raw_evidence':pins,'raw_command_receipts':{'path':str(p.N/'all-raw-command-receipts.json'),'count':len(commands)},
            'criterion_map':str(p.N/'criterion-map.json'),'deviations':str(p.N/'deviations.json'),'lifecycle':lifecycle,
            'owner_packets':ownerpackets,'historical_gates':'Raw actual earlier role/check/UI/runtime evidence retained unchanged; not relabeled current clean',
            'profile_recovery_limit':proof['database_boundary'],'actual_commit_ids':[],'actual_publication_operations':[],
            'runtime_build_UI_suites_task_MC_schedule_actions_this_turn':[],
            'accepted_progress':['Actual collision refused without mutation','Known work control undone; saved interrupted fixed130 state restored/publicly verified',
                                 'Actual premature original-scope guard refused without mutation','Both actual Wiki supplements reversed; original128 restored LAST',
                                 'Full exact original mixed/index/work/base/status readback; source/private unrelated/protected evidence preserved'],
            'next_unfinished_authorized_action':'None for this actor after END. Root independently observes native terminal and inspects raw recovery, then assigns responsible S6 factual documentation closeout and fresh FULL-S6/whole-SPEC gates. No automatic resumption.',
            'holds':[{'kind':'unmet-gate','affected':'Any current production candidate/runtime/owner/publication readiness',
                      'reason':'Rehearsal deliberately stopped/abandoned and original seeded defective fixture inputs restored',
                      'resolver':'A separately authorized future candidate workflow; not this recovery assignment','publication_authority':'NONE'}],
            'last_check_utc':at,'last_progress_utc':at,'native_END':'Not yet observed at save; immediate final response intentionally ends turn'}
p.save('checkpoint.json',checkpoint)
report=f'''# Actual SECOND recovery result — REHEARSAL_ONLY

**REHEARSAL_RECOVERY_COMPLETE**; current readiness **false**. Actor `{p.ACTOR}`, manager `/root`, saved {at}. This is the assigned test result, not a new installed production state, whole-S6 acceptance or publication permission. Installed readiness remains withheld in `unmet-gate`: the private preview is stopped/abandoned and the original seeded inputs are restored.

## Authority and actual lifecycle

Actual CWD/controller home `{p.C}`; separate source R `{p.R}` and independent candidate P `{p.P}`. Supported default fallback fully loaded the exact installed Commit Supervisor SKILL/TOML, original SPEC/approval, full workflow/template/owner/Wiki/runtime/session contracts, current full standards hub/routes and Preferences. Host `danger-full-access/never` is effective session evidence. Root model/effort inherited without overrides; concrete settings/native loader metadata remain unexposed. Assignment SHA `{p.ASSIGNMENT_HASH}` is unchanged. Source revisions are in activation.json.

Native predecessor `/root/s6_supervisor_interruption_1` independently returned completed unmet-gate/END with no descendants at both entry and final lookup. The predecessor's real six-process stop and full fixed capture were retained, never replayed. This actor has no children or conflicting writers; root writes disjoint E. No matching automation exists. At save this actor is actually running; final native END is the next action and must be observed by root. close_agent is unavailable.

## Public controls and actual restore order

Public CLI only exposes a default guard under each job and consumes it after restore. Root explicitly authorized unique recovery-1 control namespaces containing byte-exact copies of original immutable manifests/sidecars/payloads, with original ownership/repo/scope unchanged. Complete copy byte/mode/time equality is recorded. Original namespaces, all old guards and1844 previous job leaves remain unchanged in place. This is neither new capture nor mutation of historical ownership.

1. Fresh public fixed guard saved actual interrupted state SHA `6dbdf53b8ac8c64554ec194365b18410bea163af27d97024af5b5d43a42e4a8c`. Only binary working bytes changed to a recorded known collision value. Actual public restore returned exit1 `REFUSED: current-byte collision; nothing restored`. Full4355 candidate/index/work/ref/protected state, physical indexes, candidate NUL status/stage/flags and guard were exact around refusal. Source11977/cache193/staged entries/index/refs remained exact; source porcelain is qualified using only assigned J/E receipt exclusions. One failed whole-source status proof assertion was retained and corrected; the actual refusal was not replayed.
2. Only recorded collision work bytes were returned to their guarded50-byte interrupted value; full guard match passed. Actual guarded **fixed130** restore SHA `a885cde0f24e25d9cea6437edad6b9258f365d3a2db08bcb426d690195e4291a` succeeded. Both control and ORIGINAL namespace public verification passed payload/current/status checks. Full fixed130/4355 semantics and all4225 unrelated entries matched, including both Guide versions and both watcher leaves. Fixed raw candidate recovery remains retained with119 payloads.
3. Actual original128 public guard returned exit1 `REFUSED: unrelated entries changed; restore is non-mutating` while the two Guide versions remained outside the original inventory. Full before/after state and indexes/ref evidence matched; no guard or candidate mutation resulted.
4. Actual **X/Y Wiki130** checkpoint `5227a7a7d38dddec138aff13c16f2ee8a22bda1a53657f203a47d80857827617` restored first. Public ORIGINAL namespace verify passed. It removed only declared-absent `.versions/2026-10-04-095624.md` and watcher-runtime-2.
5. Actual **first Wiki129** checkpoint `36c99f10ccdc4eed268e2859d2f737eac282181784ea0385572e64d3221c7e75` restored next. Public ORIGINAL namespace verify passed. It removed only declared-absent `.versions/2026-10-04-080936.md` and watcher-runtime-1.
6. **ORIGINAL128 LAST**, checkpoint `f827e476bb28bc720f14537ebf6a1edf514f122e3f6705c4e9fa0590912834fb`, restored and publicly verified exact original4353 inventory/4225 unrelated, status and index/work semantics. No undeclared removal, reset, whole saved-index restore or private git add occurred in this turn.

All command argument arrays, exact CWD/environment/exit/stdout/stderr bytes are retained in {len(commands)} command receipts. Git repository/index/object/alternate environment variables were stripped; `GIT_OPTIONAL_LOCKS=0` and literal path handling were used. Native public helpers reconstructed only owned index entries in a private current-index copy. Candidate physical index timestamps/extensions may change; source physical index remains original `f37b5bfc9a44893b132661290fe095ddafccb79bed38ca9007dc3803d2ff7966`.

## Exact mixed-state readback

Original128 readback validates every owned current stage/mode/blob byte/flag, work raw byte/mode/target/absence, actual HEAD/base blob/mode/absence and full NUL status. Binary stage SHA `198a4c4bdd369fa70da3cbf62473846ce3c621d9f2c764d7c32a42a9f3fef621` differs from work SHA `c1c4d11e50d8b29cfde2163ba4009f20ab9c865c877fafe642c2c6918407b8b3`. Staged text and README retain distinct index/work/base values. executable.sh retains work0751 with index100644; symlink retains staged `staged-target` versus work `working-target`. HANDOFF staged deletion and work absence, untracked unusual quote/tab/newline/shell-character filename, future-leaf absence and all index flags match exactly. Saved interrupted38-byte index/50-byte work binary validation is separately time-qualified: stage object bytes were read later from the independently matched saved actual index OID; work bytes were saved before collision.

## Preservation and readiness limits

All11977 source outside-scope leaves,193 cache leaves and1844 previous job files remain exact in bytes/metadata. Source HEAD/branch/refs/config/remotes/reflogs/staged entries/physical index remain exact; candidate HEAD/refs/config/remotes/reflogs remain exact. All six original manifest/payload sets remain immutable, valid and independently publicly verified. Only original128 now matches current candidate, as expected after abandonment.

Five current process readbacks prove continued private P/profile tree absence, original six IDs absent and server63400/CDP63399 listeners absent. Actual UID/start/executable/entry/CWD/environment/machine/profile/ancestry facts of protected normal77002/server77007 and Alpha48636/server48653 remain exact. The actual protected tree inventory has13 distinct records in total, including those four roots; all13 match. All11 protected storage identities retain existence/kind/mode/dev/inode. Normal/Alpha live DB hash/stat changes are recorded and qualified; no byte-stability claim is made. Private disposable profile file bytes/metadata stayed exact during this successor turn. No protected/profile/live-server DB copy/restore, signals, runtime restart/build/UI/suite/task/MC/timer/publication/ref operation occurred. Code restoration applied exact manifest-owned fixture preimages; browser/profile/runtime DB effects remain outside recovery.

Both historical owner-ready packets remain immutable/time-qualified. Earlier raw actual role/gate/check/UI/runtime reports and screenshots/logs are preserved, with their existing limitations; this actor grants no renewed current clean/runtime/owner claim. Eight full-field procedural deviations and all seven inherited first-turn deviations are retained. Owning classifications are accepted within this assigned recovery scope; root classification/fresh outer gates remain separate pending facts. No in-scope recovery finding or owner ruling remains.

The16-row criterion-map.json binds every assigned recovery criterion to exact raw evidence. checkpoint.json, final-preservation-proof.json, actual-restore-order.json, all-raw-command-receipts.json and deviations.json are the concrete handoff. Root must independently observe this actor's native END, inspect this result, then assign responsible S6 factual documentation closeout and fresh FULL-S6/whole-SPEC gates. No auto-resumption, next-SPEC acceptance or publication permission is created. Intentional END follows this saved packet.
'''
with (p.N/'report.md').open('x') as handle:handle.write(report)
p.save('completion-manifest.json',{'at':at,'actor':p.ACTOR,'result':'REHEARSAL_RECOVERY_COMPLETE','current_ready':False,
       'files':{name:{'path':str(p.N/name),'sha256':p.digest((p.N/name).read_bytes())} for name in ['checkpoint.json','report.md','criterion-map.json','deviations.json','lifecycle.json','final-preservation-proof.json','actual-restore-order.json','all-raw-command-receipts.json']}})
history=p.N/'history/S6-SECOND-RECOVERY-COMPLETE-01';history.mkdir(parents=True)
for name in ['activation.json','checkpoint.json','lifecycle.json','report.md','criterion-map.json','deviations.json','completion-manifest.json']:
    with (history/name).open('xb') as handle:handle.write((p.N/name).read_bytes())
    (history/name).chmod(0o444)
print(p.json.dumps({'test_result':'REHEARSAL_RECOVERY_COMPLETE','current_ready':False,'report':str(p.N/'report.md'),
                    'report_sha256':p.digest((p.N/'report.md').read_bytes()),'checkpoint':str(p.N/'checkpoint.json'),
                    'checkpoint_sha256':p.digest((p.N/'checkpoint.json').read_bytes()),'criterion_count':len(criteria),
                    'raw_command_count':len(commands),'deviation_count':len(deviations),
                    'next':'Return actual test result and native END; root independently observes completion'}))
