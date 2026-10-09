"""Root-owned completed-SPEC bookkeeping after native admissible CLEAN."""
import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
E = C / 'planning/commit-supervisor/execution'
at = datetime.now(timezone.utc).isoformat()

def load(name):
    return json.loads((E / name).read_text())

def pin(p):
    p = Path(p)
    return {'path': str(p), 'size': p.stat().st_size,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}

def new(name, value):
    p = E / name
    assert not p.exists(), p
    p.write_text(json.dumps(value, indent=2) + '\n')
    p.chmod(0o444)
    return p

def update(name, value):
    p = E / name
    assert p.exists() and p.stat().st_mode & 0o200, p
    p.write_text(json.dumps(value, indent=2) + '\n')

life = load('SPEC-final-review-2-lifecycle.json')
assert life['native_state'] == 'completed' and life['gate_admissible']
assert life['result'] == 'REVIEW_COMPLETE / CLEAN'
assert life['raw_report']['sha256'] == '403c11eda1663b11d538ad62891daebe043ac22923b24b15464f509c96429802'
assert (E / 'SPEC-final-integration-review-2.md').read_text().startswith('REVIEW_COMPLETE — CLEAN\n')
ledger = load('slice-ledger.json')
assert len(ledger['slices']) == 6 and all(s['state'] == 'accepted' for s in ledger['slices'])
refs = load('SPEC-final-internal-ref-readback.json')
assert refs['non_checkpoint_refs_exact'] and len(refs['removed']) == 3 and len(refs['added']) == 1

facts = [
    {'id': 'SPEC-FINAL-REF-TEMPORAL-D1', 'scope': 'Final preservation temporal qualification',
     'original_source': str(E/'SPEC-final-internal-ref-readback.json'),
     'original_requirement': 'Preserve source/shared branch, index and unrelated state; qualify later observations instead of attributing unrelated live changes',
     'actual_change': 'Later root and independent reviewer readbacks found three removed and one new refs/codex/turn-diffs/checkpoints entry; every surviving ref and heads/remotes/stash match, as do HEAD/index/config/remotes/reflogs',
     'reason_authority': 'Actual later raw delta requires narrowing historical all-refs equality; no source repair or writer attribution is justified',
     'files': [str(E/'SPEC-final-static/git-refs.json'),str(E/'SPEC-final-internal-ref-readback.json'),str(E/'SPEC-final-integration-review-2.md')],
     'checks': 'Independent reviewer current comparison at 2026-10-05T04:42:20.375647Z and root command-only readback agree on exact delta. Raw baseline hex receipt unchanged; commands clear inherited GIT* and set optional locks0; no ref mutation',
     'observable_effect': 'Final report does not claim present all-ref equality. Shared branches and required recovery archives remain exact',
     'risk': 'Internal-ref writer and causal origin are unestablished; no restoration or checkpoint cleanup attempted',
     'downstream_impact': 'Compatible evidence/time qualification only; no product or downstream SPEC correction'},
    {'id': 'SPEC-FINAL-REVIEW2-P01', 'scope': 'Fresh final reviewer procedure',
     'original_source': str(E/'SPEC-final-integration-review-2.md'),
     'original_requirement': 'Read-only exact-file independent review; failed or truncated diagnostics are not proof',
     'actual_change': 'Fresh reviewer corrected read-helper parse/lookup/oversized-output failures and a checker-only symlink-mode representation assumption through bounded reads; exact target bytes and current fingerprints match',
     'reason_authority': 'Retain self-disclosed procedure without inventing successful initial reads or changing product',
     'files': [str(E/'SPEC-final-integration-review-2.md'),str(E/'SPEC-final-review-2-progress.raw.json')],
     'checks': 'Exact native final and four preserved progress messages; fresh actual CLEAN/END with strict whitelist observed. All101/74/35/15/142 and3309 domain fingerprints match, plus current dependencies',
     'observable_effect': 'No source/evidence/runtime effect, no excluded history exposure, no suite replay; corrected reads support acceptance',
     'risk': 'Fingerprint coverage is distinct from semantic/visual coverage; database contents/process replay were excluded and retained raw checks reused honestly',
     'downstream_impact': 'Report-only procedure; no required downstream correction'},
    {'id': 'SPEC-FINAL-COORDINATION-P02', 'scope': 'Root final bookkeeping diagnostics',
     'original_source': '/Users/rccurtrightjr./.codex/sessions/2026/10/04/rollout-2026-10-04T00-58-05-01a105eb-8add-7e12-a454-a96b64465cca.jsonl',
     'original_requirement': 'Preserve exact native evidence and distinguish failed diagnostics from successful current proof; Git read environment must be explicit',
     'actual_change': 'Root re-entry pure root lookup omitted explicit GIT environment/optional-lock settings. A draft delete/add patch was rejected, a heading-count assertion failed before writing, and first late-ref schema probe assumed stdout rather than stdout_hex. Bounded corrections produced the exact intended draft and raw hex ref readback',
     'reason_authority': 'Pure root coordination correction; existing frozen source/review packets remain unchanged',
     'files': [str(E/'SPEC-final-report-draft.md'),str(E/'SPEC-final-internal-ref-readback.json')],
     'checks': 'Actual failed diagnostics retained in verified root rollout; no draft write on either failed attempt, no Git mutation observed, current HEAD/index remain exact; corrected exact native capture and ref raw receipt preserved',
     'observable_effect': 'No product/source/runtime change; no failing probe or missing flag is retroactively certified',
     'risk': 'Initial lookup setting was omitted; no unsupported claim about that invocation. Completed check suites were not replayed',
     'downstream_impact': 'Coordination-only qualification; no later SPEC correction'}]
add = new('SPEC-final-procedural-and-preservation-addendum.json',
          {'at':at,'actor':'/root','entries':facts,'native_clean_gate':pin(E/'SPEC-final-integration-review-2.md'),
           'ref_raw_readback':pin(E/'SPEC-final-internal-ref-readback.json'),
           'product_changed':False,'passing_suites_replayed':False,'fresh_gate_repeated':False})
n = load('SPEC-neutral-deviations-v2.json')
n['entries'] += facts
n.update(at=at,contextual_entry_count=len(n['entries']),unique_ids=len({r['id'] for r in n['entries']}))
assert (n['contextual_entry_count'], n['unique_ids']) == (119,113)
snap = new('SPEC-neutral-source-preimages/final-procedural-preservation-addendum.json',load(add.name))
n['source_hashes'][str(add)] = pin(add)['sha256']
n['source_snapshots'][str(add)] = {**pin(snap),'mode':'0o100444',
    'scope':'Complete post-gate factual provenance; owner handoff only, not an additional review pass'}
n['derivation'] += ' Three post-gate reviewer/root procedural and later internal-ref qualifications added; implementation/evidence inputs unchanged. Actual raw final report assesses all116 supplied contexts; owning root classifies its own additional procedure.'
neutral = new('SPEC-neutral-deviations-final.json', n)
classes = load('SPEC-final-deviation-classifications-v2.json')
for r in classes['entries']:
    if r['id'] == 'SPEC-FINAL-REVIEW1-P01':
        r['classification_history'] = [{'at':r['classified_at'],'classification':'repair_required',
            'basis':r['root_basis'],'excluded_report_remains_inadmissible':True}]
        r.update(classification='accepted',classified_at=at,
            root_basis='Different fresh exact-file reviewer /root/spec_final_review_2 completed admissible CLEAN on unchanged current product/raw checks; original exposed pass remains permanently excluded',
            resolution_evidence=[str(E/'SPEC-final-integration-review-2.md'),str(E/'SPEC-final-review-2-lifecycle.json')])
for f in facts:
    f=copy.deepcopy(f)
    f.update(classification='accepted',classification_owner='/root',classified_at=at,
             root_basis=f['checks']+'; compatible report-only facts, no material product defect or missing acceptance outcome')
    classes['entries'].append(f)
classes.update(at=at,contextual_entry_count=119,unique_ids=113,
    counts={'accepted':119,'repair_required':0,'owner_ruling_required':0,'downstream_impact':0},
    required_repairs=[],owner_rulings_required=[],downstream_impact='compatible deviation',
    downstream_correction_required=False,final_gate=pin(E/'SPEC-final-integration-review-2.md'))
assert len(classes['entries']) == 119 and all(r['classification']=='accepted' for r in classes['entries'])
classified = new('SPEC-final-deviation-classifications-final.json',classes)

release = new('SPEC-final-release-manifest.json',{'at':at,'result':'SPEC_READY_FOR_OWNER_REVIEW',
    'original_SPEC':pin(E.parent/'SPEC.md'),'owner_assignment':pin(E/'approval-receipt.md'),
    'reviewed_current_source_and_raw_checks':pin(E/'SPEC-final-current-manifest-v2.json'),
    'reviewed_neutral_contexts':116,'final_contexts':119,'unique_final_ids':113,
    'current_owned_implementation_surface':pin(E/'SPEC-owned-implementation-surface.json'),
    'native_CLEAN_report':pin(E/'SPEC-final-integration-review-2.md'),
    'native_CLEAN_lifecycle':pin(E/'SPEC-final-review-2-lifecycle.json'),
    'excluded_first_pass':pin(E/'SPEC-final-review-lifecycle.json'),
    'final_neutral':pin(neutral),'final_classifications':pin(classified),
    'post_gate_factual_addendum':pin(add),'later_current_ref_readback':pin(E/'SPEC-final-internal-ref-readback.json'),
    'implemented_product_source_changed_after_review':False,'owner_acceptance':False,
    'agent_publication_operations':[],'Alpha_operations':[],'next_SPEC_started':False})

draft=(E/'SPEC-final-report-draft.md').read_text()
replacements={
    '**PREPARATION DRAFT — final independent gate pending.** This file grants no completed-SPEC result. The completed handoff will be `SPEC-final-report.md` after an admissible fresh whole-SPEC gate ends clean.':
        f'**SPEC_READY_FOR_OWNER_REVIEW** — all six slices accepted, required final checks passed, admissible fresh whole-SPEC integration gate **CLEAN**. Completed at `{at}`. Owner acceptance remains pending.',
    'A different fresh reviewer `/root/spec_final_review_2` receives': 'A different fresh reviewer `/root/spec_final_review_2` received',
    'This repairs review provenance without changing product bytes or replaying passing suites.':
        'That reviewer completed an admissible **REVIEW_COMPLETE — CLEAN** on unchanged current product and raw evidence. The first pass remains permanently excluded. Review provenance is repaired without product changes or passing-suite replay.',
    'The [replacement assignment](SPEC-final-integration-assignment-v2.md) and [actual lifecycle](SPEC-final-review-2-lifecycle.json) record that boundary.':
        'The [replacement assignment](SPEC-final-integration-assignment-v2.md), [complete raw CLEAN report](SPEC-final-integration-review-2.md), SHA `403c11eda1663b11d538ad62891daebe043ac22923b24b15464f509c96429802`, and [actual completed lifecycle](SPEC-final-review-2-lifecycle.json) record that boundary. All original slices/final criteria and five lenses were assessed. The [owner lifecycle inventory](SPEC-root-lifecycle-inventory-v2.json) preserves six builders, nineteen slice-review records and both whole-gate histories. No further confirmation pass was run.',
    'Source refs/config/remotes/reflogs and 193 cache leaves agree with original evidence.':
        'Source heads/remotes/stash, configuration, remotes, reflogs and 193 cache leaves agree with original evidence. Retained all-ref equality belongs to the 03:30 UTC check. Later reviewer/root readbacks agree on three removed and one new `refs/codex/turn-diffs/checkpoints/` entry, with no surviving ref movement. The [exact later raw delta](SPEC-final-internal-ref-readback.json) is preserved without writer attribution or ref repair; present all-ref equality is not claimed.',
    '[neutral factual ledger](SPEC-neutral-deviations-v2.json)': '[neutral factual ledger](SPEC-neutral-deviations-final.json)',
    '**116 contextual records / 110 distinct IDs**': '**119 contextual records / 113 distinct IDs**',
    'Eighteen immutable source snapshots preserve provenance.': 'Nineteen immutable source snapshots preserve provenance. The independent gate read all 116 supplied contexts; the additional three final procedural/temporal contexts are fully recorded and root-classified, with no changed product or invalidated checks.',
    '[classifications v2](SPEC-final-deviation-classifications-v2.json); all previously accepted implementation/rehearsal deviations remain classified, and first whole-review provenance repair remains pending until the fresh admissible gate ends.':
        '[final classifications](SPEC-final-deviation-classifications-final.json): all 119 contexts accepted; zero required repair, owner ruling or downstream correction. The first exposed gate remains excluded, while its repair-required history and actual fresh-gate resolution are retained. The [release manifest](SPEC-final-release-manifest.json) binds reviewed source, final raw CLEAN/lifecycle, neutral records/classifications and late preservation qualifications.',
    'Expected downstream impact is **compatible deviation**': 'Final downstream impact is **compatible deviation**',
    'This assignment performed no primary/shared commit, push, merge, cherry-pick, rebase, remote fetch/pull, PR publication or Alpha operation.':
        'This assignment executed no agent primary/shared commit, push, merge, cherry-pick, rebase, remote fetch/pull, PR publication or Alpha operation. Later internal Codex checkpoint-ref changes are observed separately with no writer attribution.',
    'Final whole-SPEC gate, final classification closure and completed report timestamp will be filled from actual native terminal evidence before issuing `SPEC_READY_FOR_OWNER_REVIEW`.':
        'The exact native terminal CLEAN report was captured at 2026-10-05T04:48:01.868Z and its completed state independently observed. All required work is complete for this SPEC. The next safe action is owner review/acceptance of this setup; do not start another SPEC or publish/deploy a candidate from this handoff.\n\nRecorded by: Codex side chat (ephemeral), acting as owner-assigned mc-orchestrator; ISO UTC completion above.'}
for before,after in replacements.items():
    assert before in draft, before
    draft=draft.replace(before,after)
report=E/'SPEC-final-report.md'
assert not report.exists()
assert 'PREPARATION DRAFT' not in draft and 'final independent gate pending' not in draft
report.write_text(draft);report.chmod(0o444)

ledger['completed_SPEC']={'at':at,'result':'SPEC_READY_FOR_OWNER_REVIEW','owner_accepted':False,
    'final_gate':'CLEAN','reviewer':'/root/spec_final_review_2','report':str(report),
    'release_manifest':str(release),'final_classifications':str(classified),
    'current_integrated_revision':str(E/'SPEC-final-current-manifest-v2.json'),
    'next_safe_action':'Owner reviews/accepts completed setup; no next SPEC or publication authorized'}
ledger['slices'][-1]['next_safe_action']=ledger['completed_SPEC']['next_safe_action']
update('slice-ledger.json',ledger)
criteria=load('S6-actual-criteria.json')
for criterion in criteria['criteria']:
    criterion['historical_state_before_final_closeout']=criterion['state']
    criterion['state']='accepted_full_S6_and_final_SPEC_integration'
    criterion['evidence'] += [str(E/'S6-full-acceptance.json'),str(E/'SPEC-final-integration-review-2.md'),str(report)]
criteria.update(at=at,final_result='SPEC_READY_FOR_OWNER_REVIEW',owner_accepted=False,
    original_and_refined_outcomes='All15 original and19 refined accepted; no required outcome deferred')
update('S6-actual-criteria.json',criteria)
inventory=load('SPEC-root-lifecycle-inventory-v2.json')
inventory.update(at=at,whole_SPEC_gates=[load('SPEC-final-review-lifecycle.json'),life],pending=[],
    terminal_result='SPEC_READY_FOR_OWNER_REVIEW',final_report=str(report),close_agent='Unavailable; actual native END recorded, no fabricated closure')
update('SPEC-root-lifecycle-inventory-v2.json',inventory)
runtime=load('orchestrator-runtime-continuation.json')
runtime.update(at=at,phase='SPEC_READY_FOR_OWNER_REVIEW',active_direct_child=None,
    actual_terminal_direct_child='/root/spec_final_review_2',all_slices_accepted=True,final_integration='CLEAN',
    final_report=str(report),final_classifications=str(classified),required_repairs=[],owner_rulings_required=[],
    next_safe_action=ledger['completed_SPEC']['next_safe_action'],next_SPEC_started=False)
update('orchestrator-runtime-continuation.json',runtime)
receipt=new('SPEC-final-completion.json',{'at':at,'result':'SPEC_READY_FOR_OWNER_REVIEW',
    'report':pin(report),'release_manifest':pin(release),'all_slices':'accepted','independent_final_gate':'CLEAN',
    'contextual_deviations':119,'unique_ids':113,'all_deviations_classified':True,
    'required_repairs':[],'owner_rulings_required':[],'downstream_impact':'compatible deviation',
    'owner_accepted':False,'private_preview':'stopped; original fixture restored; fixed archives retained',
    'publication_operations':[],'Alpha_operations':[],'operational_MC_activation':False,
    'monitoring_started':False,'next_SPEC_started':False})
print(json.dumps({'completion':pin(receipt),'report':pin(report),'release_manifest':pin(release),
                  'contexts':119,'unique_ids':113,'classified':'119 accepted / 0 unresolved',
                  'final_native_gate':'admissible CLEAN / actual completed','source_changes':False},indent=2))
