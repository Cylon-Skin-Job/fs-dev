from pathlib import Path
from datetime import datetime, timezone
import json, hashlib
BASE=Path(__file__).resolve().parents[1]
ORIGINAL=BASE.parent.parent/'chokidar-retirement-and-harness-launch/spec/implementation'
AT=datetime.now(timezone.utc).isoformat()
sha=lambda data:hashlib.sha256(data).hexdigest()
candidate=json.loads((BASE/'R3/ACCEPTANCE-CANDIDATE.json').read_text())
checks=[]
for row in candidate['checks']+candidate['currentManagerRecords']:
 p=Path(row['path']); raw=p.read_bytes()
 if row.get('prefixOnly'): raw=raw[:row['bytesHashed']]
 checks.append({'path':str(p),'expected':row['sha256'],'actual':sha(raw),'matches':sha(raw)==row['sha256']})
assert all(c['matches'] for c in checks)
dest=BASE/'final-integration/r3-acceptance-recorded'
dest.mkdir(exist_ok=False)
raw=BASE/'R3/R3-ACCEPTANCE-REVIEW-01-RAW.md'
life=json.loads((BASE/'R3/ACCEPTANCE-LIFECYCLE.json').read_text())
life.update(status='completed',verdict='CLEAN',terminalObservedAt=AT,rawReportPath=str(raw),rawReportSha256=sha(raw.read_bytes()),closeAgent='not exposed; available tool inventory checked',firstCleanStop=True,materialFindings=0,advisory='dated ledger provenance-schema topic count; nonblocking; retained for final inspection')
(BASE/'R3/ACCEPTANCE-LIFECYCLE.json').write_text(json.dumps(life,indent=2)+'\n')
accepted={'at':AT,'slice':'R3','state':'accepted','builder':'/root/startup_integrity_repair_orchestrator/r3_builder','builderReviewer':'/root/startup_integrity_repair_orchestrator/r3_builder/r3_builder_review_01','acceptanceReviewer':life['reviewer'],'candidateSha256':sha((BASE/'R3/ACCEPTANCE-CANDIDATE.json').read_bytes()),'rawReportSha256':sha(raw.read_bytes()),'scopedComparisonsVerified':len(checks),'allMatch':True,'checks':checks,'productOrEvidenceChanged':False,'deviationsClassified':'DEV-R1-01..03, DEV-R2-01..04, R3-D01..09 and original D-01..03; D07 downstream_impact, rest accepted','remaining':'fresh full repair+original final integration, coordinated marker-owned cleanup, human completed-work acceptance'}
(BASE/'R3/R3-ACCEPTANCE.json').write_text(json.dumps(accepted,indent=2)+'\n')
changes=[]
def record(p,content,name):
 before=p.read_bytes();(dest/name).write_bytes(before);p.write_text(content)
 changes.append({'path':str(p),'preimage':str(dest/name),'beforeSha256':sha(before),'afterSha256':sha(p.read_bytes()),'reason':'actual terminal R3 acceptance and pending full both-contract final review; administrative adoption'})
current=f'''## Current state — {AT}

R1, R2 and R3 are accepted on current bytes. Whole-R3 builder and separate fresh acceptance gates are CLEAN; the actual authenticated OpenCode exchange, persistence, post-completion passive reopen, protected supported scratch stop and original S3/S4/ledger adoption are complete. No further human UI action is required. A fresh complete repair+original final integration and coordinated marker-owned cleanup remain required; completed-work owner acceptance is separate.

Next action: one new final reviewer independently inspects both entire approved contracts/current bytes/raw evidence and retained resources, followed by protected cleanup and exact receipt verification. [Actual R3 acceptance](R3/R3-ACCEPTANCE.json), [raw independent return](R3/R3-ACCEPTANCE-REVIEW-01-RAW.md), [original adoption](original-adoption-20261006/ADOPTION-MANIFEST.json), [sealed public proof](OPENCODE-PUBLIC-SMOKE.md) and [final cumulative checks](final-integration/CUMULATIVE-CHECK-RESULT.json) identify current facts. Earlier pending/unperformed/manual-only statements are dated history, superseded only within the completed scope.

'''
for name in ['STARTUP-REPAIR-REPORT.md','REGRESSION-RESULTS.md','GUARDED-SERVER-PROOF.md','SLICE-AND-DEVIATION-LEDGER.md']:
 p=BASE/name;text=p.read_text();head=text.split('\n',1)[0];history=text[text.index('## Earlier execution account and command evidence'):]
 if name=='SLICE-AND-DEVIATION-LEDGER.md':
  history+=f'''\n## Actual R3 acceptance — {AT}\n\nSingle fresh builder gate and separate orchestrator acceptance are terminal CLEAN. Responsible builder and raw handoff remain whole-builder-gate-20261006T082447Z; reviewer {life['reviewer']}, raw SHA {sha(raw.read_bytes())}, candidate f2f937431cb570ba9a8f53d484c8f5b2a8e78a58c8050457478ef25153f84dfa. All355 scoped comparisons and9 manager records match at independent acceptance and manager seal. Ten lifecycle and six ordered-history cases independently pass; current safe SQLite and child/session/post-terminal readback are directly inspected. All16 repair deviations classified, original3 unchanged. Nonblocking dated topic-count wording advisory retained. First clean stop; no accepted lower test or product/build invalidation. Fresh full BOTH-contract final integration and protected marker cleanup remain pending; owner acceptance is separate.\n'''
 record(p,head+'\n\n'+current+history,name)
p=ORIGINAL/'S4-repaired-integration-report.md';text=p.read_text()
text=text.replace('**evidence adopted; fresh whole-R3 builder/acceptance and complete repair+original final reviews pending**','**evidence adopted; R1/R2/R3 accepted; fresh complete repair+original final review and marker cleanup pending**')
text=text.replace('Whole-R3 builder, separate acceptance and fresh complete both-contract final review follow.','Whole-R3 builder and separate acceptance are now CLEAN; fresh complete both-contract final review and marker cleanup follow.')
text=text.replace('**Pending gates remain pending** at this revision','**Full integration and owner gates remain pending** at this revision')
text=text.replace('## Remaining fresh integration and owner checkpoint','## Original adoption-stage account of remaining gates')
text+=f'''\n## Actual R3 acceptance and full integration boundary — {AT}\n\nThe fresh whole-R3 builder and separate orchestrator acceptance gates are terminal CLEAN; [acceptance receipt](../../../startup-integrity-repair/implementation/R3/R3-ACCEPTANCE.json) and [verbatim independent report](../../../startup-integrity-repair/implementation/R3/R3-ACCEPTANCE-REVIEW-01-RAW.md), SHA {sha(raw.read_bytes())}. All355 reviewed comparisons and9 current manager records matched. The separate reviewer independently inspected exact scratch SQLite/native child/session/ordered post-terminal readback and passed ten lifecycle/six ordered cases. R1/R2 accepted states and original history/D01–D03 remain intact. Dated topic-count wording is an advisory, not a new implementation or waiver.\n\nOne new final reviewer must cover BOTH complete original and repair contracts/current bytes/raw evidence, including every original §4/§6/§7/§8/§9 criterion and repair REQ01–07/§7–9. Retained raw resources are inspected before coordinated marker-owned cleanup; exact cleanup/protected-state receipts are then independently verified before its final verdict. No technical or human whole-job acceptance is claimed by this current R3 gate. The earlier adoption-stage pending paragraph is historical; current next action is full integration.\n'''
record(p,text,'original-S4-repaired-integration-report.md')
p=ORIGINAL/'SLICE-AND-DEVIATION-LEDGER.md'
assert sha(p.read_bytes()[:9630])=='8efd20ee63567330fab117435feaf9e1014b3ba269c0a895c10d75b3d8710240'
text=p.read_text()+f'''\n## Current successor R3 acceptance — {AT}\n\nActual incorporation remains complete. R1/R2/R3 are accepted; whole-R3 builder and fresh separate acceptance gates terminal CLEAN. [Acceptance receipt](../../../startup-integrity-repair/implementation/R3/R3-ACCEPTANCE.json) and [verbatim raw report](../../../startup-integrity-repair/implementation/R3/R3-ACCEPTANCE-REVIEW-01-RAW.md), SHA {sha(raw.read_bytes())}, record direct current bytes/355+9 comparisons, safe native provider/SQLite/reopen/shutdown/preservation proof and sixteen repair deviations. Original D01–D03, original historical reports and exact9630-byte ledger prefix are unchanged. One dated provenance-schema topic-count advisory is retained for final review, no product repair requested.\n\nCurrent remaining gates: one fresh full original+repair integrated reviewer, marker-owned cleanup after raw review with coordinated protected comparison on both outcomes, exact verification and completed-work human acceptance. Earlier manual/adoption/builder wait statements remain dated chronology; no new UI request, subsequent SPEC, publication or broad harness redesign follows this gate.\n'''
record(p,text,'original-SLICE-AND-DEVIATION-LEDGER.md')
assert sha(p.read_bytes()[:9630])=='8efd20ee63567330fab117435feaf9e1014b3ba269c0a895c10d75b3d8710240'
p=BASE/'final-integration/COMPLETION-CANDIDATE.md';text=p.read_text().replace('R1/R2 are accepted; whole-R3 builder gate is clean. Separate R3 acceptance is active, followed by','R1/R2/R3 are accepted; whole-R3 builder and separate acceptance gates are clean. Remaining:')
text=text.replace('Separate R3/fresh final review and cleanup remain pending here','Fresh full final review and cleanup remain pending here')
text=text.replace('Fresh separate r3_acceptance_review_01 is active; a different subsequent final reviewer must cover both whole contracts/currentbytes/rawproof.','Fresh separate r3_acceptance_review_01 is terminal CLEAN; raw R3/R3-ACCEPTANCE-REVIEW-01-RAW.md and R3/R3-ACCEPTANCE.json identify its exact current scope. A different subsequent final reviewer must cover both whole contracts/currentbytes/rawproof.')
record(p,text,'COMPLETION-CANDIDATE.md')
(BASE/'final-integration/R3-ACCEPTANCE-ADOPTION-REFRESH.json').write_text(json.dumps({'at':AT,'changes':changes,'prefixPreserved':True,'productOrWikiOrNormativeOrSealedRuntimeChange':False,'testInvalidation':False,'remaining':'full both-contract final integration/cleanup/owner acceptance'},indent=2)+'\n')
source=json.loads((BASE/'SOURCE-FINGERPRINTS.json').read_text())
source['implementationSnapshots'].append({'at':AT,'stage':'R3 accepted; original and current aggregate acceptance annotations','path':str(BASE/'final-integration/R3-ACCEPTANCE-ADOPTION-REFRESH.json'),'sha256':sha((BASE/'final-integration/R3-ACCEPTANCE-ADOPTION-REFRESH.json').read_bytes()),'changes':changes,'ownerAcceptance':'pending'})
(BASE/'SOURCE-FINGERPRINTS.json').write_text(json.dumps(source,indent=2)+'\n')
print(json.dumps({'at':AT,'rawSha256':sha(raw.read_bytes()),'acceptanceReceiptSha256':sha((BASE/'R3/R3-ACCEPTANCE.json').read_bytes()),'comparisons':len(checks),'updatedRecords':len(changes),'allProductEvidenceUnchanged':True,'originalPrefixPreserved':True}))

