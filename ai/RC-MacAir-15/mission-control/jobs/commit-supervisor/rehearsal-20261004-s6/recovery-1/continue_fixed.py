"""Continue from proved collision refusal, preserving the failed evidence assertion."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import recovery_evidence as p
alias=p.N/'public-controls/fixed';guardbytes=(p.N/'saved-fixed-fresh-guard.json').read_bytes()
before=p.read(p.N/'collision-before-refusal.json');after=p.read(p.N/'collision-after-refusal.json')
assert before['candidate']==after['candidate']==p.state()
assert (alias/'restore-guard.json').read_bytes()==guardbytes
for label in ['candidate','source']:
    for what in before['raw_git'][label]:
        a=before['raw_git'][label][what];b=after['raw_git'][label][what]
        if label=='source' and what=='status':
            initial=Path(a['stdout_raw']['path']).read_bytes();latest=Path(b['stdout_raw']['path']).read_bytes()
            assert p.scoped_status(initial,before['source_exclusions'])==p.scoped_status(latest,after['source_exclusions'])
            continue
        assert (a['stdout_raw']['sha256'] if 'stdout_raw' in a else a['sha256'])==(b['stdout_raw']['sha256'] if 'stdout_raw' in b else b['sha256'])
assert before['source_leaves']==after['source_leaves']
assert before['source_build_caches']==after['source_build_caches']
assert before['historical_job']==after['historical_job']
assert before['archives']==after['archives']
refusal=p.read(p.N/'fixed-actual-collision-refusal.command.json')
actual=p.read(refusal['stderr_raw']['path'])
assert refusal['exit_code']==1 and actual=={'result':'REFUSED','reason':'current-byte collision; nothing restored'}
p.save('collision-nonmutation-proof.json',{'at':p.now(),'actor':p.ACTOR,'actual_public_refusal':actual,'receipt':refusal,
       'full_candidate4355_index_work_ref_protected_exact':True,'physical_candidate_and_source_indexes_exact':True,
       'candidate_all_NUL_status_index_flags_stage_refs_config_remotes_reflogs_exact':True,
       'source_scoped_NUL_status_exact':True,'source_status_exclusions':before['source_exclusions'],
       'source_raw_status_qualification':'Whole source porcelain includes explicitly assigned recovery-1 receipts written between samples; all other full NUL-safe entries and11977 leaves remain exact',
       'source11977_cache193_history1844_archive6_exact':True,'saved_guard_exact':True,
       'failed_proof_attempt':'collision_and_fixed.py stopped after public refusal at raw whole-source status equality; no restore executed. Saved snapshots are reused, no collision/helper replay',
       'before':str(p.N/'collision-before-refusal.json'),'after':str(p.N/'collision-after-refusal.json')})
binary=p.P/'rehearsal-inputs/checkpoint.bin'
original=(p.N/'collision-known-original.bin').read_bytes();collision=(p.N/'collision-known-value.bin').read_bytes()
assert binary.read_bytes()==collision
binary.write_bytes(original)
assert p.state()==p.read(alias/'restore-guard.json')['expected']
p.save('collision-control-undone.json',{'at':p.now(),'actor':p.ACTOR,'only_path':str(binary),
       'working_sha256':p.digest(binary.read_bytes()),'full_current_guard_equal':True,
       'fresh_guard_expected':p.digest(p.encoded(p.state()))})
result,restored,command=p.public('fixed-guarded-restore','restore',alias)
assert result.returncode==0 and restored['result']=='RESTORED' and restored['index_worktree_equal'] and restored['status_equal']
for label,job in [('control',alias),('original-namespace',p.I/'fixed-checkpoint')]:
    result,verified,receipt=p.public('fixed-'+label+'-verify','verify',job)
    assert result.returncode==0 and verified['payloads_valid'] and verified['matches_checkpoint'] and verified['status_equal']
semantics=p.exact_semantics('fixed-full-exact-readback',p.I/'fixed-checkpoint')
afterfixed=p.snapshot('after-fixed')
assert afterfixed['source_leaves']==p.read(p.N/'initial.json')['source_leaves']
assert afterfixed['source_build_caches']==p.read(p.N/'initial.json')['source_build_caches']
assert afterfixed['historical_job']==p.read(p.N/'initial.json')['historical_job']
p.save('fixed-recovery-result.json',{'at':p.now(),'actor':p.ACTOR,'result':'SAVED_INTERRUPTED_TURN_RECOVERED',
       'actual_restore':restored,'owned130_full4355_exact':True,'unrelated4225_exact':True,'original_guard_retained_in_place':True,
       'actual_original_namespace_public_verify':str(p.N/'fixed-original-namespace-verify.command.json'),
       'complete_readback':str(p.N/'fixed-full-exact-readback.json'),'current_ready':False,
       'runtime':'Private preview remains stopped; this restores code/index/worktree only'})
print(p.json.dumps({'collision_refused_nonmutating':True,'fixed_restore':restored,'fixed_owned':semantics['owned_count'],
                    'full_inventory':semantics['full_inventory_count'],'current_ready':False}))
