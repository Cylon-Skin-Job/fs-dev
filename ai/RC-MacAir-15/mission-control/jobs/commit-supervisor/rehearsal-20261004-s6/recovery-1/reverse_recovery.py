"""Refuse premature original recovery, then restore every Wiki union and original last."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import recovery_evidence as p

def compare_nonmutating(before,after):
    assert before['candidate']==after['candidate']
    for label in ['candidate','source']:
        for what in before['raw_git'][label]:
            a=before['raw_git'][label][what];b=after['raw_git'][label][what]
            if label=='source' and what=='status':
                assert p.scoped_status(Path(a['stdout_raw']['path']).read_bytes(),before['source_exclusions'])==p.scoped_status(Path(b['stdout_raw']['path']).read_bytes(),after['source_exclusions'])
                continue
            assert (a['stdout_raw']['sha256'] if 'stdout_raw' in a else a['sha256'])==(b['stdout_raw']['sha256'] if 'stdout_raw' in b else b['sha256'])
    for key in ['source_leaves','source_build_caches','historical_job','archives']:
        assert before[key]==after[key]

originalalias=p.N/'public-controls/original'
assert p.read(p.N/'fixed-recovery-result.json')['result']=='SAVED_INTERRUPTED_TURN_RECOVERED'
assert p.read(p.N/'after-fixed-processes.json')['selected']==[]
before=p.snapshot('original-premature-before')
receipt=p.ownership('ownership-original-premature.json',originalalias)
result,refusal,command=p.public('original-actual-scope-guard-refusal','guard',originalalias,receipt)
assert result.returncode==1 and refusal=={'result':'REFUSED','reason':'unrelated entries changed; restore is non-mutating'}
assert not (originalalias/'restore-guard.json').exists()
after=p.snapshot('original-premature-after')
compare_nonmutating(before,after)
_,original=p.load(p.J)
outside=p.unrelated(p.relevant_state(p.P,original['owned'],original['protected_repos']),original['owned'])
added=sorted(set(outside)-set(p.unrelated(original['baseline'],original['owned'])))
assert len(added)==2 and all('/.versions/' in name for name in added)
p.save('original-scope-refusal-nonmutation-proof.json',{'at':p.now(),'actor':p.ACTOR,'actual_public_guard_refusal':refusal,
       'original_manifest_sha256':p.digest((p.J/'recovery/manifest.json').read_bytes()),'receipt':command,
       'actual_out_of_original_scope_Wiki_versions':added,'full_candidate_index_work_ref_protected_exact':True,
       'candidate_and_source_physical_indexes_exact':True,'source11977_cache193_history1844_archive6_exact':True,
       'source_scoped_status_exact':True,'source_exclusions':before['source_exclusions'],
       'before':str(p.N/'original-premature-before.json'),'after':str(p.N/'original-premature-after.json')})
order=[]
for label,job in [('fix-xy-wiki',p.J/'recovery-supplements/fix-xy-wiki-1'),
                  ('first-wiki',p.J/'recovery-supplements/first-wiki-1'),('original',p.J)]:
    alias=p.N/'public-controls'/label
    cp,manifest=p.load(job)
    beforestate=p.state()
    receipt=p.ownership('ownership-'+label+'-actual.json',alias)
    result,guard,guardcommand=p.public(label+'-fresh-guard','guard',alias,receipt)
    assert result.returncode==0 and guard['result']=='GUARDED'
    p.raw(label+'-saved-guard.json',(alias/'restore-guard.json').read_bytes())
    result,restore,restorecommand=p.public(label+'-guarded-restore','restore',alias)
    assert result.returncode==0 and restore['result']=='RESTORED' and restore['index_worktree_equal'] and restore['status_equal']
    for namespace,verifyjob in [('control',alias),('original-namespace',job)]:
        result,verification,command=p.public(label+'-'+namespace+'-verify','verify',verifyjob)
        assert result.returncode==0 and verification['payloads_valid'] and verification['matches_checkpoint'] and verification['status_equal']
    semantics=p.exact_semantics(label+'-full-exact-readback',job)
    afterstate=p.state()
    removed=[name for name in manifest['owned'] if beforestate['paths'][name]['worktree']['kind']!='missing' and afterstate['paths'][name]['worktree']['kind']=='missing']
    assert all(manifest['owned'][name]['job_created'] and manifest['owned'][name]['worktree']['kind']=='missing' for name in removed)
    after=p.snapshot('after-'+label)
    initial=p.read(p.N/'initial.json')
    for key in ['source_leaves','source_build_caches','historical_job','archives']:
        assert after[key]==initial[key]
    result,processcommand=p.run('after-'+label+'-process-command',['node',str(p.N/'process-readback.mjs'),'after-'+label])
    assert result.returncode==0 and p.read(p.N/('after-'+label+'-processes.json'))['selected']==[]
    row={'at':p.now(),'actor':p.ACTOR,'label':label,'original_job':str(job),'control_job':str(alias),
         'manifest_sha256':p.digest((cp/'manifest.json').read_bytes()),'historical_owner':manifest['owner'],
         'active_actor':p.ACTOR,'guard':guard,'actual_restore':restore,
         'removed_only_manifest_declared_job_created_absent_leaves':removed,
         'owned_count':semantics['owned_count'],'full_inventory_count':semantics['full_inventory_count'],
         'full_readback':str(p.N/(label+'-full-exact-readback.json')),'current_ready':False,
         'original_namespace_public_verify':str(p.N/(label+'-original-namespace-verify.command.json')),
         'all_source_refs_config_physical_index_history_archives_protected_preserved':True}
    order.append(row)
    p.save(label+'-recovery-result.json',row)
    print(p.json.dumps({'restore':label,'manifest':row['manifest_sha256'],'owned':row['owned_count'],
                       'full_inventory':row['full_inventory_count'],'removed':removed,'public_verified':True,'current_ready':False}))
p.save('actual-restore-order.json',{'at':p.now(),'actor':p.ACTOR,'fixed_first':p.read(p.N/'fixed-recovery-result.json'),
       'original_scope_refusal':str(p.N/'original-scope-refusal-nonmutation-proof.json'),'reverse_unions_then_original_last':order,
       'current_ready':False,'result':'REHEARSAL_RECOVERY_PATHS_PROVED'})
