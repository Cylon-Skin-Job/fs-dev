"""Readback and command receipts for the explicitly assigned second recovery turn."""
from pathlib import Path
from datetime import datetime, timezone
import json, os, stat, subprocess, sys, tomllib

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R = C.parents[2]
K = C / '.agents/skills/mc-commit-supervisor'
E = C / 'planning/commit-supervisor/execution'
J = C / 'jobs/commit-supervisor/rehearsal-20261004-s6'
I = J / 'interruption-1'
N = J / 'recovery-1'
P = Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
PROFILE = P.parent / 'profile'
ACTOR = '/root/s6_supervisor_recovery_1'
ASSIGNMENT = E / 'S6-supervisor-recovery-1-assignment.md'
ASSIGNMENT_HASH = '66fe3046ad52385dc7824e473061a3acb087848fa0784814c0a40938b3447a70'
ARCHIVES = [J, J/'recovery-supplements/first-wiki-1', J/'fixed-candidates/first',
            J/'recovery-supplements/fix-xy-wiki-1', J/'fixed-candidates/fix-xy', I/'fixed-checkpoint']
for key in list(os.environ):
    if key.startswith('GIT_'):
        del os.environ[key]
os.environ.update(GIT_OPTIONAL_LOCKS='0', GIT_LITERAL_PATHSPECS='1', PYTHONDONTWRITEBYTECODE='1')
sys.path.insert(0, str(K/'scripts'))
from snapshot_state import digest, encoded, git, relevant_state, semantic, unrelated
from job_snapshot import load, read_payload

def now():
    return datetime.now(timezone.utc).isoformat()

def read(path):
    return json.loads(Path(path).read_bytes())

def save(name, value):
    path = N/name
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')
    return str(path)

def raw(name, data):
    path = N/name
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as handle:
        handle.write(data)
    return {'path': str(path), 'sha256': digest(data), 'size': len(data)}

def run(tag, args, data=None):
    start = now()
    result = subprocess.run(args, cwd=C, env=os.environ, input=data, capture_output=True)
    receipt = {'actor': ACTOR, 'cwd': str(C), 'command': args,
               'started': start, 'finished': now(), 'exit_code': result.returncode,
               'environment_overrides': {'GIT_OPTIONAL_LOCKS':'0', 'GIT_LITERAL_PATHSPECS':'1', 'PYTHONDONTWRITEBYTECODE':'1'},
               'inherited_git_variables_removed': 'ALL GIT_* repository/index/object/alternate variables',
               'stdout_raw': raw(tag+'.stdout', result.stdout), 'stderr_raw': raw(tag+'.stderr', result.stderr)}
    save(tag+'.command.json', receipt)
    return result, receipt

def public(tag, operation, job, ownership=None):
    args = ['python3.12','-B', str(K/'scripts/job_snapshot.py'), operation, '--job', str(job)]
    if operation != 'verify':
        args += ['--repo', str(P)]
    if ownership:
        args += ['--ownership-file', str(ownership)]
    result, receipt = run(tag, args)
    output = json.loads(result.stdout if result.returncode == 0 else result.stderr)
    return result, output, receipt

def leaf(path):
    path = Path(path)
    try:
        st = path.lstat()
    except FileNotFoundError:
        return {'exists':False}
    kind = 'symlink' if stat.S_ISLNK(st.st_mode) else 'file' if stat.S_ISREG(st.st_mode) else 'directory' if stat.S_ISDIR(st.st_mode) else 'special'
    record = {'exists': True, 'kind':kind, 'mode':st.st_mode, 'dev':st.st_dev, 'ino':st.st_ino,
              'size':st.st_size, 'mtime_ns':st.st_mtime_ns}
    if kind in ('symlink','file'):
        record['sha256'] = digest(os.fsencode(os.readlink(path)) if kind=='symlink' else path.read_bytes())
    return record

def tree(path):
    return {str(p.relative_to(path)):leaf(p) for p in sorted(Path(path).rglob('*')) if p.is_file() or p.is_symlink()}

def schedules():
    records = []
    for path in sorted(Path('/Users/rccurtrightjr./.codex/automations').glob('*/automation.toml')):
        data = path.read_bytes()
        entry = tomllib.loads(data.decode())
        records.append({'path':str(path),'sha256':digest(data),'status':entry.get('status'),
                        'matching':any(s in data.decode() for s in ['rehearsal-20261004-s6','mc-s6-commit-supervisor','s6_supervisor','planning/commit-supervisor'])})
    assert not any(r['matching'] for r in records)
    return records

def state():
    _, manifest = load(I/'fixed-checkpoint')
    return relevant_state(P, manifest['owned'], manifest['protected_repos'])

def scoped_status(data, exclusions):
    """Retain NUL-safe porcelain records, excluding only explicitly assigned namespaces."""
    records=data.split(b'\0'); result=[]; i=0
    while i<len(records):
        record=records[i];i+=1
        if not record:continue
        names=[record[3:]];group=[record]
        if b'R' in record[:2] or b'C' in record[:2]:
            group.append(records[i]);names.append(records[i]);i+=1
        if not all(any(os.fsdecode(name).startswith(prefix) for prefix in exclusions) for name in names):
            result.extend(group)
    return b'\0'.join(result)+(b'\0' if result else b'')

def snapshot(tag):
    assert Path.cwd()==C
    cp, manifest = load(I/'fixed-checkpoint')
    current = state()
    raw_git = {}
    for label, repo in [('candidate',P),('source',R)]:
        raw_git[label] = {}
        for what,args in [('status',['status','--porcelain=v1','-z','--untracked-files=all']),
                          ('index-stage',['ls-files','--stage','-z']),('index-flags',['ls-files','-v','-z']),
                          ('refs',['for-each-ref','--format=%(refname)%00%(objectname)']),
                          ('configuration',['config','--null','--list','--show-origin']),('remotes',['remote','-v']),
                          ('branch',['symbolic-ref','-q','HEAD']),('head',['rev-parse','HEAD']),
                          ('reflogs',['reflog','show','--all','--format=%H%x00%gD%x00%gs'])]:
            result,receipt=run(tag+'-'+label+'-'+what,['git','-C',str(repo),*args])
            assert result.returncode==0 or what=='branch' and result.returncode==1
            raw_git[label][what]=receipt
        raw_git[label]['physical-index']=raw(tag+'-'+label+'-physical-index.bin',(repo/'.git/index').read_bytes())
    names=set()
    for args in [('diff','--name-only','-z'),('diff','--cached','--name-only','-z'),('ls-files','--others','--exclude-standard','-z')]:
        names.update(os.fsdecode(n) for n in git(R,*args).split(b'\0') if n)
    exclusions=[str(J.relative_to(R))+'/',str(E.relative_to(R))+'/']
    old=read(I/'after-interruption.json')
    source={name:leaf(R/name) for name in sorted(names) if not any(name.startswith(x) for x in exclusions)}
    caches={name:leaf(R/name) for name in old['source_build_caches']}
    storage={name:leaf(name) for name in old['protected_profile_storage']}
    history={str(p.relative_to(J)):leaf(p) for p in sorted(J.rglob('*')) if N not in p.parents and (p.is_file() or p.is_symlink())}
    archives=[]
    for job in ARCHIVES:
        checkpoint, archive=load(job)
        archives.append({'job':str(job), 'manifest_sha256':digest((checkpoint/'manifest.json').read_bytes()),
                         'owner':archive['owner'],'owned_count':len(archive['owned']),
                         'full_inventory_count':len(archive['baseline']['paths']),
                         'archive_leaves':tree(checkpoint), 'payloads_valid':True})
    authorities={name:{'expected':sha,'current':digest(Path(name).read_bytes())} for name,sha in manifest['authority_hashes'].items()}
    assert all(row['expected']==row['current'] for row in authorities.values())
    record={'at':now(),'actor':ACTOR,'tag':tag,'candidate':current,'raw_git':raw_git,
            'source_leaves':source,'source_exclusions':exclusions,'source_build_caches':caches,
            'protected_profile_storage':storage,'private_profile_storage':tree(PROFILE),
            'historical_job':history,'archives':archives,'authority165':authorities,'schedules':schedules(),
            'limits':'No profile/database copy or restoration. Protected running DB bytes are volatile; existence/kind/mode/dev/inode are storage boundaries. Full exact source/evidence preservation excludes only assigned J/E namespaces.'}
    save(tag+'.json',record)
    print(json.dumps({'record':str(N/(tag+'.json')),'candidate_paths':len(current['paths']), 'source_leaves':len(source),
                      'caches':len(caches),'historical_job_leaves':len(history),'archives':len(archives),'authority_matches':True}))
    return record

def ownership(name, job):
    checkpoint,manifest=load(job)
    receipt={'owner':manifest['owner'],'paths':list(manifest['owned']),'conflicting_writers':[],
             'captured_manifest_owner':manifest['owner'],'captured_owner_active':False,
             'active_actor':ACTOR,'root_transfer':str(ASSIGNMENT),'root_transfer_sha256':ASSIGNMENT_HASH,
             'root_native_additional_control_namespace_authorization': '2026-10-04 direct collaboration.send_message from /root: byte-exact unique public-controls; original guards retained in place',
             'predecessor':'/root/s6_supervisor_interruption_1',
             'predecessor_native_terminal': 'collaboration.list_agents exact subtree independently returned completed unmet-gate/END, no descendants',
             'historical_owners_inactive':list({load(a)[1]['owner'] for a in ARCHIVES}),
             'active_actor_native_subtree':'collaboration.list_agents exact subtree contains only ACTOR running; no children',
             'descendants':[],'matching_schedules':schedules(),'private_runtime_stop_retained':str(I/'owned-stop.json'),
             'private_tree_absence_evidence':str(N/'initial-processes.json'),'current_ready':False,
             'CLI_limit':'Matching captured owner/scope is not independent proof of agent lifecycle; native terminal and explicit transfer are separately observed',
             'at':now()}
    save(name,receipt)
    return N/name

def exact_semantics(tag,job):
    checkpoint,manifest=load(job)
    current=relevant_state(P,manifest['owned'],manifest['protected_repos'])
    assert semantic(current)==semantic(manifest['baseline'])
    assert git(P,'status','--porcelain=v1','-z','--untracked-files=all').hex()==manifest['status_z_hex']
    checks={}
    for name, entry in manifest['owned'].items():
        actual=current['paths'][name]
        assert actual['index']==[{k:v for k,v in stage.items() if k not in ('sha256','payload')} for stage in entry['index']]
        assert actual['flag']==entry['flag']
        assert actual['worktree']=={k:v for k,v in entry['worktree'].items() if k!='payload'}
        index_bytes=[]
        for stage in entry['index']:
            data=git(P,'cat-file','blob',stage['oid'])
            assert data==read_payload(checkpoint,stage)
            index_bytes.append({'stage':stage['stage'],'mode':stage['mode'],'oid':stage['oid'],'sha256':digest(data),'hex':data.hex()})
        wt=entry['worktree'];data=None
        if wt['kind']=='file': data=(P/name).read_bytes()
        if wt['kind']=='symlink': data=os.fsencode(os.readlink(P/name))
        if data is not None:assert data==read_payload(checkpoint,wt)
        checks[name]={'current':actual,'base':entry['base'],'index_byte_readbacks':index_bytes,
                      'worktree_bytes_equal':True, 'worktree_hex':data.hex() if name.startswith('rehearsal-inputs/') and data is not None else None,
                      'job_created':entry['job_created']}
    result={'at':now(),'actor':ACTOR,'original_checkpoint':str(job),'manifest_sha256':digest((checkpoint/'manifest.json').read_bytes()),
            'matches_checkpoint_semantic':True,'status_equal':True,'owned_count':len(checks),'full_inventory_count':len(current['paths']),
            'all_paths':checks,'complete_current':current,'unrelated_count':len(unrelated(current,manifest['owned'])),
            'limit':'Semantic index entries/flags/modes/blob bytes exact. Candidate physical index timestamps/extensions may differ; protected physical source index must remain exact.'}
    save(tag+'.json',result)
    return result

if __name__=='__main__':
    snapshot(sys.argv[1])
