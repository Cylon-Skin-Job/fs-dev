from pathlib import Path
from datetime import datetime, timezone
import hashlib, json

HERE = Path(__file__).resolve().parent
ORIGINAL = HERE.parents[1] / 'chokidar-retirement-and-harness-launch/spec/implementation'
PREFIX = '../../../startup-integrity-repair/implementation/'
NOW = datetime.now(timezone.utc).isoformat()
sha = lambda b: hashlib.sha256(b).hexdigest()
manifest = json.loads((HERE / 'ORIGINAL-INCORPORATION-TARGETS-20261006.json').read_text())
checks = []
for item in manifest['files']:
    raw = Path(item['path']).read_bytes()
    assert sha(raw) == item['sha256'], item['path']
    checks.append({'path': item['path'], 'sha256': sha(raw), 'bytes': len(raw)})
for name in ['S3-startup-integrity-reassessment.md', 'S4-repaired-integration-report.md']:
    assert not (ORIGINAL / name).exists(), name
preimage = (ORIGINAL / 'SLICE-AND-DEVIATION-LEDGER.md').read_bytes()
archive = HERE / 'original-adoption-20261006'
archive.mkdir(exist_ok=False)
(archive / 'original-ledger-preimage.md').write_bytes(preimage)
proposal = (HERE / 'ORIGINAL-OWNER-INCORPORATION.md').read_bytes()
assert sha(proposal) == '9a54d314554f91db7d001ca2e7a389414e8105b9b3c8772ba464cee0f884de0b'
(archive / 'owner-reviewed-incorporation-proposal.md').write_bytes(proposal)
approval = HERE.parent / 'ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md'
ack = f'''# Bounded successor acknowledgment and actual adoption

Codex side chat (ephemeral), runtime `/root/startup_integrity_repair_orchestrator`, {NOW}. I acknowledge the human **“Yes. Continue.”** recorded in [successor receipt](../../ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md), SHA-256 `{sha(approval.read_bytes())}`. I alone write the three original targets. R3 builder remains terminal while this additive incorporation is performed; afterward it owns R3 evidence and its fresh builder review only. It must route any original-record finding to me.

Role remains mc-spec-orchestrator; controller `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`, memory `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`, distinct product `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`. Dirty owner/worker work is preserved; effective filesystem unrestricted, approval never, no model/effort override. Root/MC/domain AGENTS and session/orchestrator/review contracts apply; current preferences, all routed standards and mandatory Chat/domain authorities remain unsuperseded.

Fresh native checks before these writes: original implementation01a1042c-09df-7473-a1e1-f458eee6b93d notLoaded/latest interrupted; source/manual01a0ea32-f152-77a2-afc2-b73e8976685a notLoaded/latest completed. Root's matching source heartbeat inventory is PAUSED, no implementation-target schedule observed. NotLoaded supplies no process-stop inference. All direct children are terminal, close_agent unavailable. Source manifest's ten originals match; addenda absent and ledger8efd20… unchanged before this write. No protected interval remains active; prior interval ended07:40:28.716Z. First action preserves ledger/proposal preimages then adds the two reassessments and an additive ledger qualification. The human appointment supplies authority, not an inferred transfer from inactivity.

No registered-main/checkpoint, domain record, older-app, Alpha, messaging, timer, next-SPEC or publication authority is acquired. R3/final reviews and completed-work human acceptance remain separate.
'''
(archive / 'SUCCESSOR-ACKNOWLEDGMENT.md').write_text(ack)
def table(text, marker):
    rest = text.split(marker, 1)[1]
    start = rest.index('| ID /')
    return rest[start:].split('\n\n', 1)[0]
r1 = table((HERE/'R1/ORCHESTRATOR-INSPECTION.md').read_text(), 'Manager deviation classifications')
r2 = table((HERE/'R2/ORCHESTRATOR-INSPECTION.md').read_text(), 'Manager deviation classifications')
r3txt=(HERE/'R3/ORCHESTRATOR-INSPECTION.md').read_text()
r3 = table(r3txt, '## Manager deviation dispositions')
r3later = r3txt.split('## Current actual-runtime and shutdown supplement',1)[1]
r3extra = r3later[r3later.index('| ID /'):].split('\n\n',1)[0]
s3 = f'''# S3 startup integrity reassessment — current additive repair

Codex side chat (ephemeral), acknowledged bounded successor `/root/startup_integrity_repair_orchestrator`, {NOW}. [Actual appointment](../../../startup-integrity-repair/ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md) and [acknowledgment/preimages]({PREFIX}original-adoption-20261006/SUCCESSOR-ACKNOWLEDGMENT.md) precede this write. This reassesses the contradicted startup seam in original CHAT-AR-SPEC-01; it preserves dated retirement acceptance and does not supply pending R3/final verdicts.

## Original contract and discovered confidence gap

Original §6.S3 preserves post-listen components/actions, event/cron triggers and runner; §7 preserves established owners/shutdown. Repair CHAT-AR-REPAIR-01 additionally restores the retained operation-level readiness admission/lease. Original A-05 removes a prerequisite on future replacement observation, not this existing migration lease. Approved original SPEC remains `{checks[0]['sha256']}`; approval `{checks[1]['sha256']}`. Historical S3 builder/acceptance and old “deviations: none” are retained as dated evidence, now qualified at this composition seam.

| Finding | Audited source/evidence | Actual consequence and current disposition |
|---|---|---|
| IA-01 | Startup defines `workspace-automation-pipeline`; real registry expected retired `workspace-watcher-trigger-pipeline`. Real registry throws before factory; startup catches it. | Normal listen can resolve without preserved consumers; isolated final audit cannot complete. R1 uses sole valid name in registry/browser and retains caught definition violations as audit-fatal. Actual startup/listen canary reaches consumers; isolated literal seven-name oracle verifies start1/block1/factory0/prohibited0 and installed watch/child guards0. |
| IA-02 | Old startup calls private pipeline directly; retained `startWorkspacePipelineWhenReady` was disconnected. Controller readiness catches unavailable statuses and holds no later operation lease. | Identity repair alone exposes readiness bypass. R2 calls/returns/awaits existing wrapper with controller canonical root/ID, verified admission and lease/finally. Missing either identity refuses work. No coordinator/schema/public protocol/watcher replacement. |
| Assertion/fixture gap | Old source tests required readiness-wrapper name absent; runtime tests iterated their own list; old unavailable test exercised an orphan helper. | R1/R2 add executable exported startup/listen tests using real registry/readiness/runtime/coordinator/consumers and independent state/effect oracles. Source-order/retirement assertions remain supporting evidence. Earlier suite pass did not prove this seam. |

Original raw authority: [repair SPEC §2](../../../startup-integrity-repair/SPEC-01-STARTUP-INTEGRITY-REPAIR.md), its SOURCES and linked original audit/probe; [negative proofs]({PREFIX}STARTUP-NEGATIVE-PROOF.md). This was a controlled seam failure, not proof of user data corruption or renderer-delay cause.

## Distinct exact negative controls and repaired positive boundary

Pristine audited control retains eleven exact preimages, nonce `cdb2d006-35ae-4123-9145-35ebbe3b301f`, receipt SHA `0fa2d8e35f4dffffd9b583689c83d79da24247b67a0eb13f74759ca125ec80b2`. Actual startup normal canary fails as required: genuine unknown effect rejection, expected components1/actual0. [R1 preimage receipt]({PREFIX}R1/PREIMAGE-RECEIPT.json) records every hash/owned root; [independent R1 raw negative]({PREFIX}R1/orchestrator-negative-preimage.log).

Separately identified counterfactual has only the old-to-valid effect literal changed in copied registry. Original copied startup SHA `cab1812bcf64f579b64c70d22d54ac93042d24aeb5ba2d21dc6ab660f2a2bda3` remains disconnected; four executed dependency symlinks are hash-verified. Nonce `3847d4ec-ccb9-4e01-9679-65e3d92d5803`; [identity-control receipt]({PREFIX}R2/IDENTITY-CONTROL.json) gives eleven hashes and sole delta. Actual ready and genuinely unavailable startup both perform eleven stages at lease0; two selected readiness assertions fail, eleven filtered skips, no unknown-name error. This is identity-only masking control, never pristine production. [Independent raw negative]({PREFIX}R2/orchestrator-identity-only-negative.log).

Repaired actual startup: ready initialization holds lease1 across eleven root/script/component/action/event/cron/runner stages, acquire/release1 and final0. Genuine unavailable, retirement-before-admission and incomplete root/ID execute zero work. Pending preparation joins before work; admitted retirement drains until release and refuses late leases/admission. Relocation loads canonical script only. Downstream failure enters existing catch and releases in finally; async pending/reject support verifies lease duration. Components, actions, four real event deliveries, controlled real cron and runner owner remain observable. Lease protects initialization, not indefinite cron/runner execution or governed scheduling.

## Reviewed current revisions and preservation

R1 manifest `600e884f0f277545f6bb59c50db15a76b807e4b0497a222e06e1660d00f03f5d`, R2 manifest `5c3268ba72fa1c14ed1b3606b344dd54dfe8701bf45139e7987ce34644aedbb8`. [R1 builder]({PREFIX}R1/R1-BUILDER-REPORT.md), [R2 builder]({PREFIX}R2/R2-BUILDER-REPORT.md) enumerate changed files/current hashes, self-review, fixture adapters and exact commands. R1 required33/support29; R2 required117/support20; independent orchestrator and fresh reviewers reproduce positive and negative boundaries. R1 builder reviewer `r1_builder/r1_builder_review_01`, acceptance `r1_acceptance_review_01`; R2 builder reviewer `r2_builder/r2_builder_review_01`, acceptance `r2_acceptance_review_01`, all under `/root/startup_integrity_repair_orchestrator`, terminal CLEAN. [R1 acceptance]({PREFIX}R1/R1-ACCEPTANCE-REVIEW-01.md), [R2 acceptance]({PREFIX}R2/R2-ACCEPTANCE-REVIEW-01.md).

Chokidar/deleted watcher/filter/abandon hooks stay absent; theme/CLI bootstrap, workspace, shutdown ordering, ledger workspace/thread drain, direct screenshot/attachment, Apple no-wait/Google polling and independent save/tool consumers remain. [Current integrated checks]({PREFIX}REGRESSION-RESULTS.md), [guarded real-server proof]({PREFIX}GUARDED-SERVER-PROOF.md), [S4 reassessment](S4-repaired-integration-report.md) carry current preservation evidence. Five external fixture stubs are outside changed seam. Fixture owner-drain fallback/cleanup does not establish production graceful shutdown. Real Date with controlled cron callbacks is explicit scope. No live failure/corruption or autonomous worker guarantee is inferred.

## Adopted R1/R2 deviations and downstream effects

The following original text/change/reason/files/checks/effect/risk/impact entries are copied from the independent inspections; no deviation disappears in original adoption.

{r1}

{r2}

Overall downstream impact: compatible wiring/test/evidence corrections. R3/current original integration must consume both distinctly named negatives, real startup readiness results and strict audit; broader snapshots/native Calendar/harness/logging remain separately owned. No owner product ruling remains. R3 and fresh complete repair/original integration reviews are pending at this adoption revision; later substantive result is recorded in S4/ledger without rewriting historical S3.
'''
s4 = f'''# S4 repaired integration — original and repair complete-contract mapping

Codex side chat (ephemeral), bounded acknowledged successor `/root/startup_integrity_repair_orchestrator`, {NOW}. Owner **“Yes. Continue.”** appoints this writer for this addendum and scoped ledger incorporation; [receipt](../../../startup-integrity-repair/ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md). Current state: **evidence adopted; fresh whole-R3 builder/acceptance and complete repair+original final reviews pending**. Automated and actual provider evidence are substantiated; completed-work human acceptance remains separate.

## Current bytes, history and validation selection

Original candidate `ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144` and repair candidate `29749ceb65dab37535a047f64cbd57aa1ddd6f149191c1a4f6ae6d1bf31cf6e4` retain approved normative bytes. Original SPEC SHA `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`; repair SPEC `0d7a3176cca89b017162970b2fe8f28a5c8b902547fba48f797a2cc68060ac3c`, SOURCES `d124abc38a76f7e63011184387c6d2c5b6e5778333c4d29c146a8bb9d07cdaff`. Product root/branch/HEAD remain `/Users/rccurtrightjr./projects/fs-dev` / `agent/exact-workspace-paths` / `d15792920731f85e45b743519d4af2b807d95a9c`, dirty owner/worker baseline preserved. [Current fingerprints]({PREFIX}SOURCE-FINGERPRINTS.json), [R3 candidate]({PREFIX}R3/CURRENT-FINGERPRINTS.json) and [sealed runtime manifest]({PREFIX}R3/runtime-complete-20261006T074525Z/RUNTIME-CURRENT-FINGERPRINTS.json) identify actual bytes, not HEAD alone.

Historical S1/S2 retirement acceptance, S3 dated acceptance, S4 old manual/blocker chronology, D-01 catalog/stale-fixture cleanup, D-02 New Chat handler repair and D-03 fixtures retain their full original text/approval/gates in unchanged ledger prefix and dated reports. New Chat three reviewed files remain unchanged; current34 isolated checks and two usable owner-created chats provide current continuity. Prior `CLEAN-EXCEPT-UI-BLOCKER` did not rerun tests or prove provider success; it is not the current verdict. [S3 reassessment](S3-startup-integrity-reassessment.md) adopts IA-01/IA-02 and seven R1/R2 deviations. This writer acquires no main/checkpoint/domain/messaging/publication/Alpha authority.

Exact command outcomes/raw logs/hashes/ports are retained in [regression results]({PREFIX}REGRESSION-RESULTS.md), [R3 checks]({PREFIX}R3/CHECKS.json), [independent inspection]({PREFIX}R3/ORCHESTRATOR-INSPECTION.md) and [guarded proof]({PREFIX}GUARDED-SERVER-PROOF.md). Nineteen required suites186 tests pass independently (including all original focused eight paths), separate async wrapper2 pass. Full `npm test -- --runInBand` runs native-observer pretest/node-gyp successfully,221 suites3265passed/one existing Kimi CLI TODO skip,112.097s. Client `npm run build` exit0,1957modules,3.86s. Exact architecture Playwright config/two specs at reserved51978 with external output:34passes/24.3s. Node localstorage/DEP0190, gray-matter eval, CaptureTiles mixed imports, large chunks and Playwright color warnings remain explicit. Kimi skip and historical45-minute soak waiver do not waive public OpenCode.

Faithful ordinary production server under isolated-v1 normal/fact-publish-failure: both execute, safe non3001 ports52375/52389 builder and52422/52436 independent, exact two scratch registry paths, seven start1/block1/factory0/prohibited0, watch/child0, harness-http revalidationblocked, save preimage/postwrite recovery/authority and narrow refresh/readback verified. Allfour protected hashes unchanged; marker cleanup succeeds. Failed audits/error/image/tracehashsize are retained before cleanup, protected state compared on failure and success. Ten lifecycle failure tests pass; inability to save proof fails closed/retains appropriate roots. Fixture success never becomes real-provider success.

## Complete original §8 and repair requirement matrix

| Original criterion | Current substantive proof | Repair mapping / scope limit |
|---|---|---|
| 1 changed paths/deviations | Current R1/R2/R3 manifests/deltas and both addenda/ledger; all DEV-R1-01…03, DEV-R2-01…04, R3-D01…09 and historical D-01…03 accounted. | REQ-07. Dirty unrelated files preserved; no source hash rewritten in approval. |
| 2 focused/full/native/build | Exact186 focused, full3265/1skip/nativepretest, client build and34NewChat raw evidence above. | REQ-03/04/05, R3. Unaffected commands reused on independently matched scoped current bytes; evidence-oracle corrections rerun six meaningful cases. |
| 3 watcher retirement | Literal original production rg/import/dependency parse yields0 matches; five retired paths absent; no abandon callback, startup filter or replacement detector. | REQ-04; readiness is retained migration/operation lease, not observation. |
| 4 legacy ledger | Required event-ledger suite exercises file:changed exclusion and workspace/thread durability/drain; existing bus remains. | REQ-04 and preservation; no global topic suppression/history cleanup. |
| 5 direct screenshot | Required request-ID/protected-view routes prove direct PNG capture/attachment; source refresh retired; gallery/ribbon ownership distinct. | REQ-04, save/tool preservation. Source cache table untouched. |
| 6 Apple/Google | Apple listener-retirement/no-wait checks and actual startup inventory; Calendar routes/UI/broadcaster and opt-in Google polling preserved. | REQ-04. Automatic Apple refresh stops/cached rows may stale; I-021/D-020/I-022 future; repo snapshots not Calendar freshness. |
| 7 cron/event consumers | Real exported startup/listen consumer/canonical root/script/action observations under genuine lease; four delivered topics and controlled real cron/runner start; trigger/cron suites. | REQ-01/02/03/05; no file trigger input or autonomous-worker/governed scheduling claim. |
| 8 actual authenticated OpenCode | Exact two created/selected chats, focalPID24140/turn/SID/exchange2 normal completed persisted response, passive post-completion open returns[2] then[2,3], visible ordered accepted/completed rows, no passive activation/duplicate; supported scratch stop. | REQ-06 and all §7; actual extra ordinary owner sends accepted as D08, owner clocks separate callback order D09. |
| 9 canonical docs/maps | All16 original RV2-A01 +ChatTesting inventory:5scoped updates/12unchanged accurate; exact hashes/preimages/source maps/links. | REQ-07. No unrelated proposals rewritten or fixture→provider inference. |
| 10 fresh independent gates | R1/R2 builder and acceptance CLEAN; independent R3 implementation/runtime checks. Actual original adoption now exists. Whole-R3 builder, separate acceptance and fresh complete both-contract final review follow. | REQ-07/§9. **Pending gates remain pending** at this revision; owner completed-work acceptance is separate. |

The remaining REQ-01–05 mapping is explicit in S3 and manifests: sole valid identity/strict seven-effect audit; actual startup invocation; genuine unavailable/preparing/retiring/relocation/error/no-identity lease proof; exact pristine and sole identity-only negative controls; full retained consumer preservation. Original §4R01–R07, §6all slices, §7compatibility and §9deferrals remain in scope of the forthcoming fresh full review, not just repair requirements.

## Actual public runtime and post-completion durable reopen

[Sealed public report]({PREFIX}OPENCODE-PUBLIC-SMOKE.md) SHA `53a5de958f839cfe0a6505b52d7beb6f1513a542fce009a716efc9c0dff9757a`; [final runtime handoff]({PREFIX}R3/runtime-complete-20261006T074525Z/FINAL-RUNTIME-HANDOFF.md) SHA `f75449f3766023179a18cb9b63c17111f1b81ad20511a0302663a9f69be65080`; manifest `2af6542b8c3776bb8c183f8c3d46a91dd78e185ec2a74e446782149f20586cb0`. Exact external marker-owned profile2/registered-selected sole public-scratch-2, RC-MacAir-15; main57401/server57425/renderer57444, HTTP52199/CDP52197, fusion-shell://app/ normal authentication/init/continuing connection. Native window142887 owned57401 shows Public Scratch2 /Local:RC-MacAir-15. First thread2026-10-06T00-19-54-139 and second2026-10-06T00-20-09-736 have distinct accepted group/binding identities. Owner performed all product inputs; agents only safe read-only observation.

Focal second request894fa70643b44870ba0b83d06c662cf2, turn27ebfe22-7ebd-4119-bd23-1c78d136e7fa, genuine OpenCodePID24140 under57425, nativeJSON exit0/turnEndtrue/stopRequestedfalse close07:20:25.436Z, SIDcommit07:20:25.439Z `ses_eefea3c2cffeSfl9mxF0cGlbma`, exchange2/seq1/applied normalreasonstop/partialfalse. First child11302 never substitutes focal identity. Additional ordinary second sendturn60a5264c-61ce-4d8d-976c-125e416bb85c/PID5018/exchange3seq2 has sameSID and distinct accepted turn. All three actual sends/children/normalexchanges remain chronology, not passive duplication.

Actual first→second owner open07:29:58.725/.730 then07:30:00.555/.557 is after focal completion; wire readback returns[2]. After extra completion07:30:18.918, ownerfirst→second07:30:23.699/.705 then07:30:24.724/.725, wire returns[2,3]. FinalreadonlyDOM07:36:02.410 matches same selectedgroup/thread/SID and two ordered accepted-user/completed-nonstreaming assistant rows; exact user bytes and assistant normalized whitespace hashes match durable rows with raw hashes retained. No newactivation/turn follows final passive return. All37 safe owner stages remain; source payload fieldcontent/owner-clock order differ from old unsupportedtext/aggregate projections. Six meaningful ordered-oracle cases pass; no raw prompt/providerframes/secrets/private configuration are published. Earlier opens before completion remain explicitly historical. Withdrawn Discovering Panels report is no defect; interrupted diagnostic performed no tools/edit/process.

V4 collector49427 stopped own marker07:39:13.033Z. Protected no-write boundary07:39:19.402Z through independent end07:40:28.716Z; root/builder/orchestrator coordinated. Canonical selectOwnedProcesses/stopOwned exactscratch stop exit0 at07:39:25.338Z, fiveownedPIDs/HTTP/CDPlisteners/window gone. DeveloperDB/normal-profileDB/fulldeveloperai tree/clienttest-results before/after unchanged; nine older normal/manual/Alpha process identities unchanged; scratchlogical registry/groups/threads/SIDs/threeacceptedreceipts/exchanges hash `5379a6ca5bf8111f5b6c91bb20d305f4eaa93b93f0167028c0bc94d2669c9cd9` unchanged. PhysicalWAL checkpoint is not logical drift. [Independent shutdown receipt]({PREFIX}R3/orchestrator-shutdown-inspection.json) SHA `05d044e83302c37415e9685cf64baa1ef0ff716506b65c75513e85d71ce22fc3`. Exactsafe roots/evidence retained through review; marker-owned cleanup follows reviews. This proves supported scratch process stop/protection, not every production graceful shutdown phase.

## Documentation, deviations and downstream assessment

[Seventeen-article inventory]({PREFIX}R3/wiki-inventory.json) and [independent exact map check]({PREFIX}R3/ORCHESTRATOR-WIKI-CURRENT-INSPECTION.json) name every original required article/currenthash/disposition. Five changes describe current effect/readiness/consumer reachability and guarded/public evidence boundaries; remaining12 retain accurate ledger/screenshot/Apple/Google/save/tool/noncausal/future scope. Preimage `.versions` records retained. No canonical page is made proof of runtime acceptance.

S3 adopts all seven R1/R2 deviations with every field; historical original D-01/D-02/D-03 remain unchanged. Current R3 dispositions below carry original text/change/reason/files/checks/effect/risk/impact:

{r3}

{r3extra}

Overall impact: **compatible deviation**. Current source owners remain; original reassessment selects current safe ordered/timestamped receipts and retains dated failures/limits. Broader harness retry/error/performance, health subscriptions, snapshot/file-trigger/native Apple replacement, publication/deployment retain original and repair explicit resolver/trigger/required evidence; none is silently implemented or used to waive acceptance. Existing temporary provider diagnostic migration/deletion duty remains deferred to actual owner, not converted into new logging.

## Remaining fresh integration and owner checkpoint

Actual original-record adoption releases only the incorporation dependency. Responsible R3 builder resumes one fresh read-only whole-R3 reviewer with original/repair authority/current bytes/raw evidence and deviations, then separate orchestrator acceptance. A subsequent new reviewer must independently cover **both complete original CHAT-AR-SPEC-01 and repair CHAT-AR-REPAIR-01**, all slices/preservation/compatibility/docs/negative/publicproof/cleanup. No prior label dictates a verdict. Material findings repair through responsible builder with fresh affected gates. Actual identities/results/bytes and final cleanup will be added here and to both ledgers before SPEC_READY_FOR_OWNER_REVIEW; human completed-work acceptance remains pending. No repeat live provider scenario or broad rerun solely elapsed time is required on unchanged valid bytes.
'''
(ORIGINAL/'S3-startup-integrity-reassessment.md').write_text(s3)
(ORIGINAL/'S4-repaired-integration-report.md').write_text(s4)
append = f'''\n\n## Current bounded successor adoption — {NOW}

The entire preceding ledger is preserved byte-for-byte as historical source (9630bytes, SHA-2568efd20ee63567330fab117435feaf9e1014b3ba269c0a895c10d75b3d8710240). Human **“Yes. Continue.”** appoints runtime `/root/startup_integrity_repair_orchestrator` as bounded acknowledged successor for these two addenda and this additive ledger only; [approval](../../../startup-integrity-repair/ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md), [explicit acknowledgment/preimage]({PREFIX}original-adoption-20261006/SUCCESSOR-ACKNOWLEDGMENT.md). Current source/writers/paused source heartbeat were rechecked before writes. No main/checkpoint/domain/publication/Alpha/messaging authority transfers.

[S3 startup reassessment](S3-startup-integrity-reassessment.md) adopts newly substantiated IA-01 effect identity omission, IA-02 removed readiness admission/lease and composition-test gaps. Historical S3 acceptance/“deviations none” remain dated; current qualified seam is repaired and independently accepted R1/R2. All DEV-R1-01…03 and DEV-R2-01…04 are adopted with full original/change/reason/files/checks/effect/risk/downstream fields. Retirement and S1/S2 consumer acceptance are retained.

[S4 current complete-contract mapping](S4-repaired-integration-report.md) adopts guarded normal/fact-publish-failure, full nativepretest/server/build/34NewChat, all17docs and actual authenticated OpenCodePID24140/focalexchange2 normalcompletion/persistence/post-completion passive reopen/supported scratchshutdown/protection. R3-D01…06/D08/D09 accepted; D07 downstream_impact requires original/final readers select current versus dated evidence and loaded-subset scope. Exact full entries in S4 and [repair ledger]({PREFIX}SLICE-AND-DEVIATION-LEDGER.md). Original D-01/D-02/D-03 and historical manual chronology are unchanged. Three harmless actual accepted sends are distinct turns/exchanges, no passive activation duplication. Old native-manual blocker is superseded by sealed actual proof, not startup/fixture/owner testimony alone.

Current state: original incorporation exists; **whole-R3 builder review, separate acceptance and fresh full repair+original integration are pending**, followed by marker-owned resource cleanup and explicit human completed-work acceptance. R1/R2 accepted/unaffected checks preserved. Previous final label is historical, not current full verdict. No nextSPEC or publication is authorized. Writer remains single orchestrator for original records; R3 builder owns its evidence/review continuation.
'''
ledger = ORIGINAL/'SLICE-AND-DEVIATION-LEDGER.md'
assert ledger.read_bytes() == preimage
ledger.write_bytes(preimage+append.encode())
assert ledger.read_bytes().startswith(preimage)
targets=[]
for name in ['S3-startup-integrity-reassessment.md','S4-repaired-integration-report.md','SLICE-AND-DEVIATION-LEDGER.md']:
 p=ORIGINAL/name; b=p.read_bytes(); targets.append({'path':str(p),'sha256':sha(b),'bytes':len(b)})
receipt={'at':NOW,'writer':'/root/startup_integrity_repair_orchestrator','approvalPath':str(approval),'approvalSha256':sha(approval.read_bytes()),'acknowledgment':str(archive/'SUCCESSOR-ACKNOWLEDGMENT.md'),'authority':'Yes. Continue. bounded acknowledged successor','singleWriter':True,'historicalFilesVerifiedBefore':checks,'originalLedgerPrefixBytes':len(preimage),'originalLedgerPrefixSha256':sha(preimage),'prefixPreserved':True,'originalTargets':targets,'state':'ACTUAL_ORIGINAL_ADOPTION_COMPLETE_FRESH_R3_FINAL_GATES_PENDING','ownerAcceptance':'pending'}
(archive/'ADOPTION-MANIFEST.json').write_text(json.dumps(receipt,indent=2)+'\n')
(HERE/'ORIGINAL-OWNER-INCORPORATION.md').write_text(f'''# Actual bounded original-record incorporation

Current {NOW}. Human **“Yes. Continue.”** has granted the bounded successor appointment; [receipt](../ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md). Runtime `/root/startup_integrity_repair_orchestrator` explicitly acknowledged and alone wrote the two original addenda plus additive ledger qualification after source/writer checks. Actual records now exist; this releases original incorporation only, not fresh whole-R3/final review or human completed-work acceptance.

[Reviewed pre-authorization proposal](original-adoption-20261006/owner-reviewed-incorporation-proposal.md) retains exact SHA9a54d314554f91db7d001ca2e7a389414e8105b9b3c8772ba464cee0f884de0b. [Acknowledgment](original-adoption-20261006/SUCCESSOR-ACKNOWLEDGMENT.md) and [actual target/historical-prefix manifest](original-adoption-20261006/ADOPTION-MANIFEST.json) supply exact authority/bytes/single-writer record. Original9630byte ledger prefix remains SHA8efd20ee63567330fab117435feaf9e1014b3ba269c0a895c10d75b3d8710240; all ten original source preimages matched before adoption.

| Actual target | Adopted content |
|---|---|
| [S3 reassessment](../../chokidar-retirement-and-harness-launch/spec/implementation/S3-startup-integrity-reassessment.md) | IA-01/IA-02/assertion gaps, distinct exact audited/identity-only negatives, accepted current R1/R2 and all seven deviations, preserved consumers/limits. |
| [S4 integration](../../chokidar-retirement-and-harness-launch/spec/implementation/S4-repaired-integration-report.md) | Complete original/repair mapping, raw automated/guarded/docs/liveOpenCode/durablepost-completionreopen/protectedshutdown receipts, R3-D01…09 and pending fresh gates. |
| [Original ledger](../../chokidar-retirement-and-harness-launch/spec/implementation/SLICE-AND-DEVIATION-LEDGER.md) | Additive current qualification/dispositions/links; all historicalprefix/D01-D03/manualchronology/frozenapproval preserved. |

Publicsmoke53a5de958f839cfe0a6505b52d7beb6f1513a542fce009a716efc9c0dff9757a and runtimehandofff75449f3766023179a18cb9b63c17111f1b81ad20511a0302663a9f69be65080 remain sealed/unchanged. R1/R2 accepted, R3/final pending; no hands-on test needed. Resume existing responsibleR3builder for fresh whole-slice review, own independent inspection/acceptance then fresh BOTHcompletecontract final review. No originalmain/checkpoint/domain-record/persistentmessage/publication/Alpha/nextSPEC authority is acquired. Ownercompleted-workacceptance remains separate.
''')
with (HERE/'SLICE-AND-DEVIATION-LEDGER.md').open('a') as f:
 f.write(f'\n\n## Actual original adoption — {NOW}\n\nHuman successor appointment and explicit single-writer acknowledgment precede additive original S3/S4/ledger incorporation. [Actual adoption](original-adoption-20261006/ADOPTION-MANIFEST.json) verifies all ten preimages and original9630byte ledger prefix preserved. [Current incorporation](ORIGINAL-OWNER-INCORPORATION.md) supersedes earlier ungranted/parked/manual-only next-action statements as dated history. Required live smoke/reopen/supported shutdown are complete, app/collector stopped; no further owner UI action. Current R3 state `reviewing`: existing responsible builder resumes whole-R3 builder-owned fresh review, followed by separate acceptance and full both-contract final review. Neither R3 nor SPEC is accepted yet; human final acceptance remains separate.\n')
with (HERE/'R3/ORCHESTRATOR-INSPECTION.md').open('a') as f:
 f.write(f'\n\n## Current successor adoption — {NOW}\n\nEarlier ungranted/prepared-only/review-held sections are dated. Human Yes. Continue. and explicit acknowledgment now permit actual original S3/S4/ledger adoption; [manifest](../original-adoption-20261006/ADOPTION-MANIFEST.json). Sealed actualruntime/shutdown remains unchanged. This releases incorporation; fresh R3 builder/acceptance and full both-contract final gates remain pending. Orchestrator is sole original-record writer, builder resumes R3 evidence/review only. No current owner UI/runtime wait or protected interval exists.\n')
print(json.dumps({'at':NOW,'adoptionManifestSha256':sha((archive/'ADOPTION-MANIFEST.json').read_bytes()),'targets':targets,'preservedPrefixSha256':sha(preimage)},indent=2))
