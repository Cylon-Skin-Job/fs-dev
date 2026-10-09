"""Exercise the public collision refusal and recover the saved interrupted turn."""
from pathlib import Path
import sys, stat
sys.path.insert(0,str(Path(__file__).resolve().parent))
import recovery_evidence as p

alias=p.N/'public-controls/fixed'
assert p.state()==p.read(p.N/'initial.json')['candidate']
assert p.read(p.N/'initial-processes.json')['selected']==[]
receipt=p.ownership('ownership-fixed.json',alias)
result,guard,command=p.public('fixed-fresh-guard','guard',alias,receipt)
assert result.returncode==0 and guard['result']=='GUARDED'
assert guard['expected_sha256']=='6dbdf53b8ac8c64554ec194365b18410bea163af27d97024af5b5d43a42e4a8c'
guardbytes=(alias/'restore-guard.json').read_bytes()
p.raw('saved-fixed-fresh-guard.json',guardbytes)
binary=p.P/'rehearsal-inputs/checkpoint.bin'
original=binary.read_bytes()
assert p.digest(original)=='a9c4ca3841b8c8c8ceeb84488d6c501543d0ae673f06e6ae67111d61f9bdb07b'
assert stat.S_ISREG(binary.lstat().st_mode) and not binary.is_symlink()
collision=b'\x00\xffS6 SECOND collision-only binary worktree\n\x80\x00\xfc'
plan={'at':p.now(),'actor':p.ACTOR,'path':str(binary),'original':p.raw('collision-known-original.bin',original),
      'original_hex':original.hex(),'collision':p.raw('collision-known-value.bin',collision),'collision_hex':collision.hex(),
      'allowed_scope':'ONLY working bytes of already-owned binary; no Git staging/index/ref/runtime effects',
      'saved_guard':str(p.N/'saved-fixed-fresh-guard.json'),'guard_sha256':p.digest(guardbytes)}
p.save('collision-plan.json',plan)
assert binary.read_bytes()==original
binary.write_bytes(collision)
before=p.snapshot('collision-before-refusal')
result,refusal,command=p.public('fixed-actual-collision-refusal','restore',alias)
assert result.returncode==1 and refusal=={'result':'REFUSED','reason':'current-byte collision; nothing restored'}
after=p.snapshot('collision-after-refusal')
assert before['candidate']==after['candidate']
assert (alias/'restore-guard.json').read_bytes()==guardbytes
for label in ['candidate','source']:
    for what in before['raw_git'][label]:
        a=before['raw_git'][label][what];b=after['raw_git'][label][what]
        assert (a['stdout_raw']['sha256'] if 'stdout_raw' in a else a['sha256'])==(b['stdout_raw']['sha256'] if 'stdout_raw' in b else b['sha256'])
assert before['source_leaves']==after['source_leaves']
assert before['source_build_caches']==after['source_build_caches']
assert before['historical_job']==after['historical_job']
assert before['archives']==after['archives']
p.save('collision-nonmutation-proof.json',{'at':p.now(),'actor':p.ACTOR,'actual_public_refusal':refusal,'receipt':command,
       'full_candidate4355_index_work_ref_protected_exact':True,'physical_candidate_and_source_indexes_exact':True,
       'all_NUL_status_index_flags_stage_raw_refs_config_remotes_reflogs_exact':True,
       'source11977_cache193_history1844_archive6_exact':True,'saved_guard_exact':True,
       'before':str(p.N/'collision-before-refusal.json'),'after':str(p.N/'collision-after-refusal.json')})
# Undo only this actor's recorded known worktree control; no broad reset or index operation.
assert binary.read_bytes()==collision
binary.write_bytes(original)
assert p.state()==p.read(alias/'restore-guard.json')['expected']
p.save('collision-control-undone.json',{'at':p.now(),'actor':p.ACTOR,'only_path':str(binary),
       'working_sha256':p.digest(binary.read_bytes()),'full_current_guard_equal':True,'fresh_guard_expected':guard['expected_sha256']})
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
