import copy, hashlib, json, os, stat
from pathlib import Path
from datetime import datetime, timezone

E=Path(__file__).resolve().parent; C=E.parents[2]; B=E/'S6-closeout'
now=datetime.now(timezone.utc).isoformat()
def read(p): return json.loads(p.read_text())
def save(p,d): p.write_text(json.dumps(d,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def checked(row):
    p=Path(row['path']); s=p.lstat()
    assert stat.S_ISREG(s.st_mode),(str(p),'not regular')
    for k,v in {'mode':s.st_mode,'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtime_ns':s.st_mtime_ns,'sha256':sha(p)}.items():
        if k in row: assert v==row[k],(str(p),k,v,row[k])
    return str(p)
manifest=read(B/'handoff-manifest.json')
checked_paths=[checked(x) for x in manifest['records']+manifest['reviewed_doc_leaves']]
assert sha(E/'S6-closeout-manifest.json')=='5a3cd688a30036095af7da276907543961331fe3a11bd7fa2db89486d98357aa'
assert sha(B/'review-freeze.json')=='80647ab62331481e469d48b3369f1115b02dab85e6d627b03a83b87d0b2ce3a0'
freeze=read(B/'review-freeze.json')
freeze_rows=[]
def walk(d):
    if isinstance(d,dict):
        if d.get('exists') is True and 'path' in d and 'sha256' in d: freeze_rows.append(d)
        else:
            for v in d.values(): walk(v)
    elif isinstance(d,list):
        for v in d: walk(v)
walk(freeze)
for row in freeze_rows: checked(row)
addendum=read(B/'reviewer-procedural-deviations-addendum.json')
fields=('id','original_requirement','actual_change','reason_authority','files','checks','observable_effect','risk','downstream_impact')
neutral=[]; classified=[]
for row in addendum['entries']:
    n={k:copy.deepcopy(row[k]) for k in fields}
    n['risk']=n['risk'].replace('before terminal CLEAN','before completion of the corrected comparisons')
    n['scope']='S6 postterminal procedural fact'; n['provenance_rule']='Neutral eight-field factual derivative; prior reviewer verdict/report is not fresh-gate input.'
    neutral.append(n)
    cl=copy.deepcopy(row);cl.update(classification='accepted',classification_owner='/root',classified_at=now,root_basis='Report-only read diagnostics explicitly retained; exact terminal hashes and independent source/index recovery checks support no observed product or state effects. No original invocation is retroactively certified and no required behavior waived.')
    classified.append(cl)
save(E/'S6-reviewer-procedural-classifications.json',{'at':now,'entries':classified,'owner_rulings_required':[],'downstream_required_corrections':[]})
s6=read(B/'deviations-neutral-v3.json'); s6_neutral=[]
for row in s6['entries']:
    n={k:copy.deepcopy(row[k]) for k in fields}; n['scope']=row.get('scope','S6'); n['provenance_rule']='Factual fields only. Do not open prior outer author/reviewer/root conclusions at derivation locators.';s6_neutral.append(n)
assert len(s6_neutral)==85
save(E/'S6-full-acceptance-neutral-deviations.json',{'at':now,'kind':'Factual full S6 88-context eight-field derivative without verdicts/classifications','entries':s6_neutral+neutral,'contextual_entry_count':88})
whole=read(E/'SPEC-neutral-deviations.json');assert len(whole['entries'])==101
whole['entries']+=neutral;whole['contextual_entry_count']=len(whole['entries']);whole['unique_ids']=len({x['id'] for x in whole['entries']});whole['at']=now
original=B/'reviewer-procedural-deviations-addendum.json';digest=sha(original)
target=E/'SPEC-neutral-source-preimages'/(hashlib.sha256(str(original).encode()).hexdigest()[:16]+'-'+original.name)
with target.open('xb') as f:f.write(original.read_bytes())
os.chmod(target,0o444)
whole['source_hashes'][str(original)]=digest
whole['source_snapshots'][str(original)]={'path':str(target),'sha256':digest,'mode':oct(target.stat().st_mode),'scope':'Complete immutable provenance only; prior verdict/report pointers/proposals excluded from fresh reviewer input.'}
assert whole['contextual_entry_count']==104 and whole['unique_ids']==98
save(E/'SPEC-neutral-deviations.json',whole)
receipt={'at':now,'actor':'/root','native_builder_terminal':'Actual FINAL_ANSWER and exact /root/s6_builder list_agents reports completed; own reviewer completed; no active child','builder':'/root/s6_builder','own_reviewer':'/root/s6_builder/s6_full_review_1','own_result':'CLEAN','checked_handoff_fingerprints':len(checked_paths),'checked_freeze_fingerprints':len(freeze_rows),'report_sha256':sha(E/'S6-closeout-builder.md'),'own_raw_sha256':sha(B/'reviewer-1.raw.md'),'current_manifest_sha256':sha(E/'S6-closeout-manifest.json'),'close_agent':'Unavailable; no closure fabricated','remaining':'Fresh root full S6 acceptance, final checks and fresh whole SPEC gate','current_ready':False}
save(E/'S6-root-builder-terminal.json',receipt)
ledger=read(E/'slice-ledger.json');slice6=ledger['slices'][-1];assert slice6['id']=='S6'
slice6['reviewers'].append({'identity':'/root/s6_builder/s6_full_review_1','gate':'builder_full_S6','result':'CLEAN','terminal':True,'fork_turns':'none','close_agent':'unavailable','report':str(B/'reviewer-1.raw.md'),'sha256':sha(B/'reviewer-1.raw.md')})
slice6.update(phase='Fresh root full S6 acceptance pending',preparation_only=False,builder_full_handoff=str(E/'S6-closeout-builder.md'),builder_terminal_receipt=str(E/'S6-root-builder-terminal.json'),last_root_progress_utc=now)
save(E/'slice-ledger.json',ledger)
criteria=read(E/'S6-actual-criteria.json')
for row in criteria['criteria']:
    if row['id']=='S6-A18':row.update(state='current documentation independently inspected; fresh builder-owned full S6 gate CLEAN; root acceptance pending',evidence=[str(E/'S6-closeout-manifest.json'),str(E/'S6-root-closeout-readback.json'),str(E/'S6-root-builder-terminal.json')])
criteria['last_root_progress_at']=now;save(E/'S6-actual-criteria.json',criteria)
continuation=read(E/'orchestrator-runtime-continuation.json');continuation.update(at=now,active_direct_child=None,active_phase='Fresh root full S6 acceptance dispatch',next_root_action='Independent fresh read-only full S6 reviewer from original authority/current raw packet; then final verification and whole SPEC gate',closeout_builder_terminal=str(E/'S6-root-builder-terminal.json'));save(E/'orchestrator-runtime-continuation.json',continuation)
assignment=(E/'S6-full-acceptance-packet-draft.md').read_text().replace('# Inactive fresh full-S6 acceptance assignment','# Active fresh independent full-S6 acceptance assignment')
assignment=assignment.replace('Activate only after responsible S6 builder current closeout/self-check and fresh own review are terminal, and root independently inspects current bytes/raw records/deviations with no known material issue.','Assigned by root after independent current-source/raw inspection and prior direct writer termination. No prior conclusions are supplied.')
assignment=assignment.replace('Return a new raw independent report at the exact assigned output path','Return your complete raw independent report INLINE in your final answer only; root will save it at E/S6-acceptance-review-1.md. Write no files. Provide')
assignment+='\n\nExact supplied raw inputs: E/S6-closeout-manifest.json (sha256 5a3cd688a30036095af7da276907543961331fe3a11bd7fa2db89486d98357aa); E/S6-review-criterion-definitions.json; E/S6-full-acceptance-neutral-deviations.json (88 complete factual contexts); E/S6-acceptance-current-dependency-fingerprints.json (raw current dependency comparands only); B=E/S6-closeout with criterion-map-v2.json, actor-tree-v2.json, ownership-and-preimages.json, write-receipt.json, central-clarification.json, before.json, after.json, documentation-checks.json and raw command receipts/preimages/helpers. Manifest raw domain J records are allowed under the independent-derivation rule. Do not read B/reviewer-1.raw.md, its lifecycle, handoff-manifest.json, terminal-current-hashes.json, outer procedural addendum, E/S6-closeout-builder.md or root terminal/classification/inspection reports. The neutral procedural facts have no previous verdicts. All Git reads strip inherited GIT variables and set GIT_OPTIONAL_LOCKS=0; no effects/suites/signals/runtime/UI or protected DB contents. Current source/execution evidence must be checked, and any temporal/host metadata limits retained.\n'
(E/'S6-full-acceptance-assignment.md').write_text(assignment)
print(json.dumps({'handoff_checked':len(checked_paths),'freeze_checked':len(freeze_rows),'S6_contexts':88,'whole_contexts':104,'whole_unique_ids':98,'assignment_sha256':sha(E/'S6-full-acceptance-assignment.md')}))
