"""Root-owned provenance and deviation handoff; no product implementation."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,os,stat,collections
E=Path(__file__).resolve().parent;C=E.parents[2];R=C.parents[2];K=C/'.agents/skills/mc-commit-supervisor'
def now():return datetime.now(timezone.utc).isoformat()
def load(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def fp(p):
 p=Path(p)
 try:s=p.lstat()
 except FileNotFoundError:return {'path':str(p),'exists':False}
 d={'path':str(p),'exists':True,'kind':'symlink'if p.is_symlink()else'file','mode':s.st_mode,'size':s.st_size,'sha256':hashlib.sha256(os.fsencode(os.readlink(p))if p.is_symlink()else p.read_bytes()).hexdigest()}
 return d
def save(p,d):
 with p.open('x')as f:json.dump(d,f,indent=2);f.write('\n')
 p.chmod(0o444)
ledger=load(E/'slice-ledger.json');assert all(s['state']=='accepted'for s in ledger['slices'])
activation=load(E/'SPEC-final-check-activation.json');assert activation['accepted_slices']==['S1','S2','S3','S4','S5','S6']
assert load(E/'SPEC-final-static/result.json')['result']=='FINAL_STATIC_AND_SOURCE_PRESERVATION_PASSED'
assert load(E/'SPEC-final-preservation/result.json')['result']=='FINAL_PROCESS_STORAGE_RECOVERY_PRESERVATION_PASSED'
assert load(E/'SPEC-final-suite/python-verification.json')['named_tests']==55
assert load(E/'SPEC-final-suite/node-post.json')['pass']==17
neutral=load(E/'SPEC-neutral-deviations.json');assert neutral['contextual_entry_count']==111
classified=[]
def records(d):
 if isinstance(d,list):return d
 if 'entries'in d:return d['entries']
 if 'deviations'in d:return d['deviations']
 return [d]
for i,n in enumerate(neutral['entries']):
 p=n.get('original_source'); name=Path(p).name if p else 'reviewer-procedural-deviations-addendum.json'
 if name=='slice-ledger.json':source=E/name;original=[x for s in ledger['slices']for x in s['deviations']if x['id']==n['id']][0]
 elif name.startswith('S4-race-'):
  source=Path(p);original={'classification':'accepted','root_basis':'Responsible S4 builder and distinct fresh acceptance gates, actual 17 regression/race receipts, current source inspection and protected runtime readbacks establish necessary bounded repair; original contexts remain separate.'}
 elif name=='deviations-neutral-v3.json':source=E/'S6-closeout-deviation-classifications.json';original=next(x for x in records(load(source))if x.get('id')==n['id'])
 elif p is None:source=E/'S6-reviewer-procedural-classifications.json';original=next(x for x in records(load(source))if x.get('id')==n['id'])
 else:
  source=Path(p); candidates=[x for x in records(load(source))if x.get('id',x.get('original_domain_record',{}).get('id'))==n['id']];assert len(candidates)==1,(i,n['id'],str(source));original=candidates[0]
 disposition=original.get('classification',original.get('root_classification'));assert disposition in ['accepted','downstream_impact'],(n['id'],disposition)
 row=dict(n,context=i+1,classification=disposition,classification_owner='/root',classification_source=str(source),classification_source_sha256=sha(source),root_basis=original.get('root_basis','Independent original-authority/source/raw inspection retained in the named classified context. No necessary behavior waived; source/test/runtime/history qualifications remain explicit.'))
 if n['id']=='S6-D12'and name=='S6-preparation-deviation-classifications.json':
  row.update(classification='accepted',historical_classification='downstream_impact',downstream_resolution='Originally pending canonical Wiki/central record closeout performed by responsible S6 builder with complete preimage, current source accountability and independent own/root full S6 gates; original preparation record preserved unchanged.',resolution_evidence=[str(E/'S6-closeout-manifest.json'),str(E/'S6-root-builder-terminal.json'),str(E/'S6-full-acceptance.json')])
 classified.append(row)
assert len(classified)==111 and len({x['id']for x in classified})==105
save(E/'SPEC-final-deviation-classifications.json',{'at':now(),'actor':'/root','contextual_entry_count':111,'unique_ids':105,'entries':classified,'counts':dict(collections.Counter(x['classification']for x in classified)),'owner_rulings_required':[],'required_repairs':[],'downstream_impact':'compatible deviation','downstream_correction_required':False,'limits':'Known factual lookup/native fallback/runtime provenance and historical qualifications retained. Future product integration, setup acceptance, publication, Alpha and consumer adoption remain separate authorities.'})
manifest=load(E/'S6-closeout-manifest.json')
paths=set()
for s in ledger['slices']:
 for d in s.get('current_revision')or[]:paths.add(d['path'])
for p in C.joinpath('.codex/agents').glob('*.toml'):paths.add(str(p))
for name in ['mc-commit-supervisor','mc-code-review-orchestrator','mc-commit-repair-worker']:
 paths.update(str(p)for p in C.joinpath('.agents/skills',name).rglob('*')if p.is_file()and '__pycache__'not in p.parts)
paths.update(x['path']for x in manifest['changed_documentation'])
paths.update(str(C/n)for n in ['.agents/skills/mc-review-and-merge/SKILL.md','.codex/agents/mc-review-and-merge.toml','.codex/config.toml'])
current=[fp(p)for p in sorted(paths)]
receipts=[fp(p)for dirname in ['SPEC-final-suite','SPEC-final-static','SPEC-final-preservation']for p in sorted((E/dirname).rglob('*'))if p.is_file()]
helpernames=['SPEC-final-suite-runner.py','SPEC-final-python-bindings.py','SPEC-final-static-checks.py','SPEC-final-preservation-check.py','SPEC-final-process-readback.mjs','SPEC-final-python-derivation.json','SPEC-final-process-derivation.json','SPEC-final-suite-continuation.py','SPEC-final-check-continuations.py','SPEC-final-static-continuation.py','SPEC-final-static-continuation-2.py','SPEC-final-preservation-continuation.py','SPEC-final-readonly-check-derivations.json','SPEC-final-static-state-derivation.json','SPEC-final-unowned-current-differences.json']
raw_baselines=[fp(E/'source-file-baseline.json'),fp(C/'jobs/commit-supervisor/rehearsal-20261004-s6/recovery-1/initial.json'),fp(E/'S6-review-criterion-definitions.json')]
preimages=[fp(p)for base in [E/'S5/preimages',E/'S6-closeout/preimages']for p in sorted(base.rglob('*'))if p.is_file()]
packet={'at':now(),'kind':'Current integrated original-authority source and command-only evidence; no previous OUTER verdicts','SPEC':fp(C/'planning/commit-supervisor/SPEC.md'),'owner_assignment':fp(E/'approval-receipt.md'),'source_repo':str(R),'private_candidate':'/private/tmp/mc-s6-commit-supervisor-20261004/candidate','current_integrated_sources':current,'authority_sources':manifest['authority'],'current_S6_raw_manifest':fp(E/'S6-closeout-manifest.json'),'final_raw_checks':receipts,'check_helpers_and_derivations':[fp(E/n)for n in helpernames],'raw_baselines':raw_baselines,'documentation_preimages':preimages,'neutral_deviations':fp(E/'SPEC-neutral-deviations.json'),'scope_rule':'Neutral extracted eight fields only. Source preimage copies preserve complete provenance but classification/verdict fields and previous outer gate reports/author/root assessments are excluded. Actual J domain reports are outputs under behavioral test after independent derivation. Current abandoned private seed is restored, fixed owner-ready packets are historical.','protected_volatile_storage_rule':'Check existence/kind/mode/dev/inode and raw current process identity; do not demand frozen byte hashes for live normal/Alpha storage.'}
save(E/'SPEC-final-current-manifest.json',packet)
assignment=(E/'SPEC-final-review-packet-draft.md').read_text().replace('# Inactive whole-SPEC independent review packet','# Active fresh whole-SPEC independent review assignment')
start=assignment.index('This packet becomes executable');end=assignment.index('\n\nIndependently derive',start)
assignment=assignment[:start]+'Assigned read-only by root for the whole current original SPEC. This grants no implementation, dispatch, runtime, Git, scheduling or publication authority. No prior conclusions supplied.'+assignment[end:]
assignment=assignment.replace('Produce one new raw independent report in the root-assigned exclusive output path.','Produce your complete raw independent report INLINE in the final answer only. Write no files; root preserves it in E/SPEC-final-integration-review-1.md.')
assignment+='\n\nBindings: C='+str(C)+'; R='+str(R)+'; E='+str(E)+'; W=R/ai/RC-MacAir-15/Wiki; J=C/jobs/commit-supervisor/rehearsal-20261004-s6. Read E/SPEC-final-current-manifest.json (sha256 '+sha(E/'SPEC-final-current-manifest.json')+'). It supplies exact current sources/authority and final command receipts/helpers/preimages. Read complete E/SPEC-neutral-deviations.json (111 factual contexts/105 distinct IDs), no original verdict/classification fields at derivation pointers. Exclude E/slice-ledger.json states, E/S6-actual-criteria.json, all root terminal/inspection/acceptance/classification reports, all prior OUTER builder or acceptance reviewer reports/lifecycles, author conversations/narratives and E/SPEC-final-deviation-classifications.json. Actual J domain gates/checkpoints are outputs under test after original independent derivation and allowed. Current source discovery/prerequisites and exact original release criteria remain required. Every Git read clears inherited GIT variables then sets GIT_OPTIONAL_LOCKS=0. No suites/runtime/UI/protected DB content or effectful checks. Report complete current-source/criterion/five-lens coverage, raw checks/limits, factual deviations and concrete material findings if any; do not assume desired outcome or missing native model/TOML metadata. Inherit root model/effort without overrides; record native permissions/lifecycle accurately.\n'
(E/'SPEC-final-integration-assignment.md').write_text(assignment)
print(json.dumps({'sources':len(current),'final_receipts':len(receipts),'preimages':len(preimages),'deviation_contexts':111,'manifest_sha256':sha(E/'SPEC-final-current-manifest.json'),'assignment_sha256':sha(E/'SPEC-final-integration-assignment.md')}))
