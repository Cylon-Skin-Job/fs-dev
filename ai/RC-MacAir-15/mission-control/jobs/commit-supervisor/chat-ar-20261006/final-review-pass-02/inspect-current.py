import os, json, pathlib, hashlib, subprocess, stat, datetime

J = pathlib.Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/jobs/commit-supervisor/chat-ar-20261006')
O = J / 'final-review-pass-02'
C = pathlib.Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
S = pathlib.Path('/Users/rccurtrightjr./projects/fs-dev')
ARTICLE = 'ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md'
ENV = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
def sha(b): return hashlib.sha256(b).hexdigest()
def read(n): return json.loads((J / n).read_text())
def git(repo, *args): return subprocess.check_output(['git', '-C', str(repo), *args], env=ENV)
def row(root, rel):
    p = root / rel
    if not p.exists() and not p.is_symlink(): return {'path': rel, 'kind': 'absent'}
    st = p.lstat()
    b = os.readlink(p).encode() if p.is_symlink() else p.read_bytes()
    return {'path': rel, 'kind': 'symlink' if p.is_symlink() else 'file', 'mode': stat.S_IMODE(st.st_mode), 'bytes': len(b), 'sha256': sha(b)}
def matches(expected, actual):
    kind = expected.get('kind')
    if kind in ('absent','missing'): return actual['kind'] == 'absent'
    for k,v in expected.items():
        if k == 'mode' and isinstance(v,str): v = int(v,8)
        if k in ('path','kind','mode','bytes','sha256') and actual.get(k) != v: return False
    return True
def compare(root, rows):
    return [{'expected': r, 'actual': row(root,r['path'])} for r in rows if not matches(r,row(root,r['path']))]
def tree(t):
    raw = git(C,'ls-tree','-r','-z',t)
    out = {}
    for x in raw.split(b'\0'):
        if not x: continue
        m,p = x.split(b'\t',1); mode,kind,blob = m.split()
        out[p.decode()] = [mode.decode(),blob.decode()]
    return out,raw
def index():
    raw = git(C,'ls-files','--stage','-z'); out={}; stages=[]
    for x in raw.split(b'\0'):
        if not x: continue
        m,p=x.split(b'\t',1); mode,blob,stage=m.split()
        out[p.decode()] = [mode.decode(),blob.decode()]
        if stage != b'0': stages.append(x.decode())
    return out,raw,stages
def seal_check(folder):
    d=json.loads((folder/'seal.json').read_text())
    return {'seal_sha256':sha((folder/'seal.json').read_bytes()), 'member_count':len(d['files']), 'mismatches':[n for n,h in d['files'].items() if sha((folder/n).read_bytes()) != h]}

ident=read('final-candidate-identity.json')
prior=read('final-pass-01/final-candidate-identity.json')
cur,tree_raw=tree(ident['tree']); old,_=tree(prior['tree']); idx,index_raw,stages=index()
delta=[{'path':p,'before':old.get(p),'after':cur.get(p)} for p in sorted(set(cur)|set(old)) if cur.get(p)!=old.get(p)]
owned=read('final-candidate-owned-inventory.json'); source=read('final-source-owned-inventory.json')
prior_owned={r['path']:r for r in read('final-pass-01/final-candidate-owned-inventory.json')}
prior_source={r['path']:r for r in read('final-pass-01/final-source-owned-inventory.json')}
paths=read('final-commit-paths.json')
support=read('final-candidate-runtime-support.json')
dep=read('unaffected-evidence-dependencies.json'); w=read('wiki-editor/current-byte-evidence.json')
prev_dep=read('final-review/dependency-inspection.json')
code=read('final-review/code-evidence.json')
authorities=read('final-review/authority-and-standards.json')
new_deps=[]
for r in dep['comparisons']:
    for k,root in [('source',S),('candidate',C)]:
        if not matches(dict(r[k],path=r['path']),row(root,r['path'])): new_deps.append({'side':k,'row':r,'actual':row(root,r['path'])})
raw_logs=[]
for r in prev_dep['screenshot_raw_logs']+prev_dep['wiki_raw_logs']:
    p=pathlib.Path(r['path']); actual=sha(p.read_bytes())
    raw_logs.append({'path':str(p),'expected':r['expected'],'actual':actual,'matches':actual==r['expected'],'exitCode':r.get('exitCode')})
oracles=[]
for r in read('cumulative-oracle-dependencies.json')['comparisons']:
    oracles.append({'path':r['path'],'source_sha256':row(S,r['path']).get('sha256'),'candidate_sha256':row(C,r['path']).get('sha256'),'expected':r['current_candidate_sha256']})
authority_drift=[r for r in authorities if sha(pathlib.Path(r['path']).read_bytes())!=r['sha256']]
frozen=read('frozen-source-inventory.json')
eof=read('screenshot-repair/eof-trim-readback.json'); current_reader=pathlib.Path(eof['path']).read_bytes(); before=pathlib.Path(eof['preimagePath']).read_bytes()
refs=git(S,'for-each-ref','--format=%(objectname) %(refname)','refs/heads','refs/remotes').decode()
bound_files=['final-candidate-identity.json','final-candidate-owned-inventory.json','final-source-owned-inventory.json','final-commit-paths.json','final-commit-paths.z','final-candidate-runtime-support.json']
history_root='ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/implementation/FINAL-ROADMAP/'
history_receipts=[]
for name,expected in [('MERGE-RECEIPT.json','79a8dbd64bee71001be789675dda326bfdf6fbedf652b1caddfe3b8f122b7c3e'),('ALPHA-DEPLOYMENT.json','4b6dad87ba3b1cec61cf95d9bc4973baa40e32d5679dc44532df69b91ddfd2f1')]:
    rel=history_root+name
    history_receipts.append({'path':rel,'expected_source_sha256':expected,'current_source':row(S,rel),'publication_present':rel in cur})
preimage_hash='ccf7a76b4201ce3f5a95b29816f72f85cf1506b6f94172a581c100170dd4b94e'
preimage_file=J/'restart-wiki-deferral-recovery/recovery/payloads'/preimage_hash
report={
 'at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'mode':'final', 'pass':2, 'memory_cwd':str(pathlib.Path.cwd()),
 'candidate':{'root':str(C),'git_root':git(C,'rev-parse','--show-toplevel').decode().strip(),'head':git(C,'rev-parse','HEAD').decode().strip(),'branch':git(C,'branch','--show-current').decode().strip(),'raw_index_sha256':sha((C/'.git/index').read_bytes()),'index_semantic_sha256':sha(index_raw),'index_entries':len(idx),'tree':ident['tree'],'tree_rows_sha256':sha(tree_raw),'index_tree_mismatches':[p for p in set(cur)|set(idx) if cur.get(p)!=idx.get(p)],'nonzero_stages':stages},
 'source':{'root':str(S),'git_root':git(S,'rev-parse','--show-toplevel').decode().strip(),'head':git(S,'rev-parse','HEAD').decode().strip(),'branch':git(S,'branch','--show-current').decode().strip(),'raw_index_sha256':sha((S/'.git/index').read_bytes()),'raw_index_matches_frozen':sha((S/'.git/index').read_bytes())==ident['source_index_sha256'],'refs_match_frozen':refs==ident['product_refs'],'remote_configuration_matches_frozen':git(S,'remote','-v').decode()==ident['remote_configuration']},
 'identity_file_bindings':{n:sha((J/n).read_bytes()) for n in bound_files},
 'candidate_owned_rows':len(owned),'candidate_owned_drift':compare(C,owned),'source_owned_rows':len(source),'source_owned_drift':compare(S,source),
 'original_source_rows':len(frozen),'original_source_drift':compare(S,frozen),
 'whole_tree_delta_from_pass_01':delta,'only_article_changed':len(delta)==1 and delta[0]['path']==ARTICLE,
 'owned_selector_removed':sorted(set(prior_owned)-set(paths)),'owned_selector_added':sorted(set(paths)-set(prior_owned)),
 'retained_candidate_owned_rows_drift':[r['path'] for r in owned if r!=prior_owned.get(r['path'])],
 'retained_source_owned_rows_drift':[r['path'] for r in source if r!=prior_source.get(r['path'])],
 'publication_change_count':len(git(C,'diff','--name-only','-z','HEAD',ident['tree']).split(b'\0'))-1,
 'publication_changed_markdown_count':sum(1 for p in git(C,'diff','--name-only','-z','HEAD',ident['tree']).split(b'\0') if p.endswith(b'.md')),
 'deferred_article':{'candidate':row(C,ARTICLE),'source':row(S,ARTICLE),'head_sha256':sha(git(C,'show',ident['head']+':'+ARTICLE)),'tree_sha256':sha(git(C,'show',ident['tree']+':'+ARTICLE)),'tree_entry':cur[ARTICLE],'not_publication_selector':ARTICLE not in paths,'identity_matches':matches(ident['deferred_restart_article'],row(C,ARTICLE))},
 'deferred_current_article_preimage':{'path':str(preimage_file),'sha256':sha(preimage_file.read_bytes()),'expected':preimage_hash,'matches':sha(preimage_file.read_bytes())==preimage_hash},
 'historical_advisory_receipts':history_receipts,
 'runtime_support_rows':len(support),'runtime_support_drift':compare(C,support),'runtime_support_published_overlap':[r['path'] for r in support if r['path'] in paths],
 'retained_server_electron_rows':len(dep['comparisons']),'retained_server_electron_drift':new_deps,
 'wiki_source_rows':len(w['sources']),'wiki_source_drift':compare(C,w['sources']),
 'wiki_affected_pages_rows':len(w['pages']),'wiki_affected_pages_drift':compare(C,w['pages']),
 'wiki_version_rows':len(w['versions']),'wiki_version_drift':compare(C,w['versions']),
 'code_review_named_dependency_drift':[p for p,h in code['currentCodeSha256'].items() if row(C,p)['sha256']!=h],
 'screenshot_unchanged_dependency_drift':[r['path'] for r in read('screenshot-repair/current-byte-evidence.json')['unchangedDependencies'] if row(C,r['path']).get('sha256')!=r['candidateSha256'] or row(S,r['path']).get('sha256')!=r['sourceSha256']],
 'raw_check_logs':raw_logs,'cumulative_oracles':oracles,'authority_binding_count':len(authorities),'authority_binding_drift':authority_drift,
 'eof_trim_before_equals_current_plus_newline':before==current_reader+b'\n','eof_current_sha256':sha(current_reader),
 'prior_pass_seal':seal_check(J/'final-review'),'leaf_restoration_seal':seal_check(J/'restart-wiki-scope-repair'),
 'handoff_acceptance':{'sha256':sha((J/'restart-wiki-handoff-acceptance.json').read_bytes()),'raw_sha256':sha((J/'restart-wiki-handoff-01/review.raw.md').read_bytes()),'raw_matches_acceptance':sha((J/'restart-wiki-handoff-01/review.raw.md').read_bytes())==read('restart-wiki-handoff-acceptance.json')['raw_report_sha256']},
 'method':'Read/hash/stat; GIT_OPTIONAL_LOCKS=0 read-only rev-parse/branch/ls-files/ls-tree/show/diff/for-each-ref/remote. No write-tree, hash-object, mutation, runtime or archival tool execution.'
}
out=O/('final-byte-inspection.json' if os.environ.get('FINAL_REVIEW_READBACK')=='1' else 'current-byte-inspection.json')
out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'file':str(out),'candidate_owned_rows':len(owned),'candidate_drift':len(report['candidate_owned_drift']),'source_drift':len(report['source_owned_drift']),'source_original_drift':len(report['original_source_drift']),'index_tree_drift':len(report['candidate']['index_tree_mismatches']),'whole_tree_delta':delta,'authority_drift':len(authority_drift),'server_electron_drift':len(new_deps),'wiki_source_drift':len(report['wiki_source_drift']),'prior_seal_mismatches':report['prior_pass_seal']['mismatches'],'leaf_seal_mismatches':report['leaf_restoration_seal']['mismatches']}))
